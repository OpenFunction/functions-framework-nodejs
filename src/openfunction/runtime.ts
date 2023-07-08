import {env} from 'process';

import {chain, get, has, extend, isPlainObject} from 'lodash';
import {Request, Response} from 'express';

import {DaprClient, CommunicationProtocolEnum} from '@dapr/dapr';
import {KeyValuePairType} from '@dapr/dapr/types/KeyValuePair.type';
import {OperationType} from '@dapr/dapr/types/Operation.type';
import {IRequestMetadata} from '@dapr/dapr/types/RequestMetadata.type';
import {StateQueryType} from '@dapr/dapr/types/state/StateQuery.type';

import {OpenFunction} from '../functions';

import {
  OpenFunctionComponent,
  OpenFunctionContext,
  ContextUtils,
  ComponentSpec,
} from './context';

import {Plugin, PluginStore} from './plugin';

/**
 * Defining the interface of the HttpTarget.
 * @public
 */
export interface HttpTrigger {
  req?: Request;
  res?: Response;
}

/**
 * Defining the type union of OpenFunction trigger.
 * @public
 */
export type OpenFunctionTrigger = HttpTrigger;

/**
 * The OpenFunction's serving runtime abstract class.
 * @public
 */
export abstract class OpenFunctionRuntime {
  /**
   * The context of the OpenFunction.
   */
  protected readonly context: OpenFunctionContext;

  /**
   * The optional trigger of OpenFunction.
   */
  protected trigger?: OpenFunctionTrigger;

  /**
   * An object to hold local data.
   * TODO: Clarify the usage of this property
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly locals: Record<string, any>;

  /**
   * The optional error object to hold exception data.
   */
  error?: Error;

  /**
   * Constructor of the OpenFunctionRuntime.
   */
  constructor(context: OpenFunctionContext) {
    this.context = context;
    this.locals = {};
  }

  /**
   * Static method to parse the context and get runtime.
   */
  static Parse(context: OpenFunctionContext): OpenFunctionRuntime {
    return new DaprRuntime(context);
  }

  /**
   * It creates a proxy for the runtime object, which delegates all property access to the runtime object
   * @param context - The context object to be proxied.
   * @returns The proxy object.
   */
  static ProxyContext(context: OpenFunctionContext): OpenFunctionRuntime {
    // Get a proper runtime for the context
    const runtime = OpenFunctionRuntime.Parse(context);

    // Create a proxy for the context
    return new Proxy(runtime, {
      get: (target, prop) => {
        // Provide delegated property access of the context object
        if (has(target.context, prop)) return get(target.context, prop);
        // Otherwise, return the property of the runtime object
        else return Reflect.get(target, prop);
      },
    });
  }

  /**
   * It takes a user function and a context object, and returns a function that executes the user
   * function with the context object, and executes all the pre and post hooks before and after the user function.
   * @param userFunction - The function that you want to wrap.
   * @param context - This is the context object that is passed to the user function.
   * @returns A function that takes in data and returns a promise.
   */
  static WrapUserFunction(
    userFunction: OpenFunction,
    context: OpenFunctionContext | OpenFunctionRuntime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): (data: any) => Promise<void> {
    const ctx: OpenFunctionRuntime = !isPlainObject(context)
      ? (context as OpenFunctionRuntime)
      : OpenFunctionRuntime.ProxyContext(context as OpenFunctionContext);

    // Load plugin stores
    const userPlugins = PluginStore.Instance();
    const sysPlugins = PluginStore.Instance(PluginStore.Type.BUILTIN);

    return async data => {
      // Execute pre hooks, user plugins go first
      await userPlugins.execPreHooks(ctx);
      await sysPlugins.execPreHooks(ctx);

      // Execute user function and save error for lazy reporting
      try {
        await userFunction(ctx, data);
      } catch (ex) {
        ctx.error = <Error>ex;
      }

      // Execute pre hooks, user plugins go last
      await sysPlugins.execPostHooks(ctx);
      await userPlugins.execPostHooks(ctx);

      // Report error if exists at the very last
      if (ctx.error) throw ctx.error;
    };
  }

  /**
   * Getter for the port of Dapr sidecar
   */
  get sidecarPort() {
    return {
      HTTP: env.DAPR_HTTP_PORT || '3500',
      GRPC: env.DAPR_GRPC_PORT || '50001',
    };
  }

  /**
   * Getter returns the request object from the trigger.
   * @returns The request object.
   */
  get req() {
    return this.trigger?.req;
  }

  /**
   * Getter returns the response object from the trigger.
   * @returns The res property of the trigger object.
   */
  get res() {
    return this.trigger?.res;
  }

  /**
   * It sets the trigger object to the request and response objects passed in
   * @param req - The HTTP request object
   * @param res - The HTTP response object
   */
  setTrigger(req: Request, res?: Response) {
    this.trigger = extend(this.trigger, {req, res});
  }

  /**
   * Get a plugin from the plugin store, or if it doesn't exist, get it from the built-in plugin store.
   *
   * @param name - The name of the plugin to get.
   * @returns A plugin object
   */
  getPlugin(name: string): Plugin {
    return (
      PluginStore.Instance().get(name) ||
      PluginStore.Instance(PluginStore.Type.BUILTIN).get(name)
    );
  }

  /**
   * The promise that send data to certain ouput.
   */
  abstract send(data: object, output?: string): Promise<object>;

  /**
   * The state store and its operations
   */
  abstract get state(): {
    save: (data: object, db?: string) => Promise<object>;
    get: (data: object, db?: string) => Promise<object>;
    getBulk: (data: object, db?: string) => Promise<object>;
    delete: (data: object, db?: string) => Promise<object>;
    transaction: (data: object, db?: string) => Promise<object>;
    query: (query: object, db?: string) => Promise<object>;
  };
}

/**
 * Dapr runtime class derived from OpenFunctionRuntime.
 */
class DaprRuntime extends OpenFunctionRuntime {
  /**
   * The Dapr client instance.
   */
  private daprClient!: DaprClient;

  /**
   * Constructor of the DaprRuntime.
   */
  constructor(context: OpenFunctionContext) {
    super(context);

    /**
     * NOTE: GRPC is not well supported so far in Dapr Node.js SDK
     * TODO: Should determine whether to use GRPC channel
     */
    this.daprClient = new DaprClient(
      process.env.DAPR_HOST,
      this.sidecarPort.HTTP,
      CommunicationProtocolEnum.HTTP
    );
  }

  /**
   * Send data to the Dapr runtime (sidecar).
   * @param {object} data - The data to send to the output.
   * @param {string} [output] - The output to send the data to.
   * @returns The promise of the actions being executed.
   */
  send(data: object, output?: string): Promise<object> {
    const actions = chain(this.context.outputs)
      .filter((v, k) => !output || k === output)
      .map((component: OpenFunctionComponent) => {
        if (ContextUtils.IsBindingComponent(component)) {
          return this.daprClient.binding.send(
            component.componentName,
            component.operation || '',
            data,
            component.metadata
          );
        } else if (ContextUtils.IsPubSubComponent(component)) {
          return this.daprClient.pubsub.publish(
            component.componentName,
            component.uri || '',
            data
          );
        }

        return Promise.resolve(undefined);
      })
      .value();

    return Promise.allSettled(actions);
  }

  /**
   * Save the data to the state store
   * @param data The data for save operation
   * @param db The state store to save the data
   * @returns The promise of the save action being executed.
   */
  #save(data: object, db?: string): Promise<object> {
    if (!this.context.states) {
      return Promise.resolve([]);
    }
    const states = this.context.states;
    const actions = Object.keys(states)
      .filter(v => !db || v === db)
      .map((storeName: string) => {
        const component: ComponentSpec = states[storeName];
        if (ContextUtils.IsStateComponent(component)) {
          return this.daprClient.state.save(
            storeName,
            data as KeyValuePairType[]
          );
        }
        return Promise.resolve(undefined);
      })
      .values();
    return Promise.allSettled(actions);
  }

  /**
   * Get the data from the state store
   * @param data The data for get operation
   * @param db The state store to get the data
   * @returns The promise of the get action being executed.
   */
  #get(data: object, db?: string): Promise<object> {
    if (!this.context.states) {
      return Promise.resolve([]);
    }

    // check the data whether legal
    const data_length = Object.values(data).length;
    if (data_length > 1 || data_length <= 0) {
      throw new Error('State get method: invalid keys number');
    }

    const states = this.context.states;
    const actions = Object.keys(states)
      .filter(v => !db || v === db)
      .map((storeName: string) => {
        const component: ComponentSpec = states[storeName];
        if (ContextUtils.IsStateComponent(component)) {
          return this.daprClient.state.get(
            storeName,
            Object.values(data)[0] as string
          );
        }
        return Promise.resolve(undefined);
      })
      .values();
    return Promise.allSettled(actions);
  }

  /**
   * Get the datas from the state store
   * @param data The data for getBulk operation
   * @param db The state store to getBulk the data
   * @returns The promise of the getBulk action being executed.
   */
  #getBulk(data: object, db?: string) {
    if (!this.context.states) {
      return Promise.resolve([]);
    }
    const states = this.context.states;
    const actions = Object.keys(states)
      .filter(v => !db || v === db)
      .map((storeName: string) => {
        const component: ComponentSpec = states[storeName];
        if (ContextUtils.IsStateComponent(component)) {
          const [keys, parallelism, metadata] = Object.values(data) as [
            string[],
            number,
            string
          ];
          return this.daprClient.state.getBulk(
            storeName,
            keys,
            parallelism,
            metadata
          );
        }
        return Promise.resolve(undefined);
      })
      .values();
    return Promise.allSettled(actions);
  }

  /**
   * Delete the data from the state store
   * @param data The data for delete operation
   * @param db The state store to delete the data
   * @returns The promise of the delete action being executed.
   */
  #delete(data: object, db?: string): Promise<object> {
    if (!this.context.states) {
      return Promise.resolve([]);
    }

    // check the data whether legal
    const data_length = Object.values(data).length;
    if (data_length > 1 || data_length <= 0) {
      throw new Error('State get method: invalid keys number');
    }

    const states = this.context.states;
    const actions = Object.keys(states)
      .filter(v => !db || v === db)
      .map((storeName: string) => {
        const component: ComponentSpec = states[storeName];
        if (ContextUtils.IsStateComponent(component)) {
          return this.daprClient.state.delete(
            storeName,
            Object.values(data)[0] as string
          );
        }
        return Promise.resolve(undefined);
      })
      .values();
    return Promise.allSettled(actions);
  }

  /**
   * Transaction the data from the state store
   * @param data The data for transaction operation
   * @param db The state store to transaction the data
   * @returns The promise of the transaction action being executed.
   * Note that this depends on the state store component that supports multi-item transactions.
   * List of state stores that support transactions:
   * More information: https://docs.dapr.io/reference/components-reference/supported-state-stores/
   */
  #transaction(data: object, db?: string): Promise<object> {
    if (!this.context.states) {
      return Promise.resolve([]);
    }
    const states = this.context.states;
    const actions = Object.keys(states)
      .filter(v => !db || v === db)
      .map((storeName: string) => {
        const component: ComponentSpec = states[storeName];
        if (ContextUtils.IsStateComponent(component)) {
          const [operations, metadata] = Object.values(data) as [
            OperationType[],
            IRequestMetadata
          ];
          return this.daprClient.state.transaction(
            storeName,
            operations as OperationType[],
            metadata ? (metadata as IRequestMetadata) : null
          );
        }
        return Promise.resolve(undefined);
      })
      .values();
    return Promise.allSettled(actions);
  }

  /**
   * query the data from the state store
   * @param data The data for query operation
   * @param db The state store to query the data
   * @returns The promise of the query action being executed.
   */
  #query(data: object, db?: string): Promise<object> {
    if (!this.context.states) {
      return Promise.resolve([]);
    }
    const states = this.context.states;
    const actions = Object.keys(states)
      .filter(v => !db || v === db)
      .map((storeName: string) => {
        const component: ComponentSpec = states[storeName];
        if (ContextUtils.IsStateComponent(component)) {
          return this.daprClient.state.query(
            storeName,
            Object.values(data)[0] as StateQueryType
          );
        }
        return Promise.resolve(undefined);
      })
      .values();
    return Promise.allSettled(actions);
  }

  /**
   * Use getter to add a layer of objects
   */
  get state(): {
    save: (data: object, db?: string) => Promise<object>;
    get: (data: object, db?: string) => Promise<object>;
    getBulk: (data: object, db?: string) => Promise<object>;
    delete: (data: object, db?: string) => Promise<object>;
    transaction: (data: object, db?: string) => Promise<object>;
    query: (data: object, db?: string) => Promise<object>;
  } {
    return {
      save: this.#save.bind(this),
      get: this.#get.bind(this),
      getBulk: this.#getBulk.bind(this),
      delete: this.#delete.bind(this),
      transaction: this.#transaction.bind(this),
      query: this.#query.bind(this),
    };
  }
}
