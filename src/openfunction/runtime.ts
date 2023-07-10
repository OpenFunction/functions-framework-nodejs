import {env} from 'process';

import {chain, get, has, extend, isPlainObject} from 'lodash';
import {Request, Response} from 'express';

import {DaprClient, CommunicationProtocolEnum} from '@dapr/dapr';
import {KeyValuePairType} from '@dapr/dapr/types/KeyValuePair.type';
import {KeyValueType} from '@dapr/dapr/types/KeyValue.type';
import {OperationType} from '@dapr/dapr/types/Operation.type';
import {IRequestMetadata} from '@dapr/dapr/types/RequestMetadata.type';
import {StateQueryType} from '@dapr/dapr/types/state/StateQuery.type';
import {StateQueryResponseType} from '@dapr/dapr/types/state/StateQueryResponse.type';

import {OpenFunction} from '../functions';

import {
  OpenFunctionComponent,
  OpenFunctionContext,
  ContextUtils,
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
   * The promise that handle data by state store.
   */
  abstract get state(): {
    save: (data: object, db?: string) => Promise<void>;
    get: (data: object, db?: string) => Promise<KeyValueType | string>;
    getBulk: (data: object, db?: string) => Promise<KeyValueType[]>;
    delete: (data: object, db?: string) => Promise<void>;
    transaction: (data: object, db?: string) => Promise<void>;
    query: (query: object, db?: string) => Promise<StateQueryResponseType>;
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
   * Get the state store
   * @param db the user specify the state store
   * @returns Corresponding state store
   */
  getState(db?: string): OpenFunctionComponent {
    // check the states field
    if (!this.context.states) {
      throw new Error('You must specify the state in the context');
    }

    // if you don't specify the db, we will use the first one defined in the context
    if (!db) {
      if (!ContextUtils.IsStateComponent(this.context.states![0])) {
        throw new Error('The state component type is wrong');
      }
      return Object.values(this.context.states!)[0];
    }

    // or we will use the one specified by user
    if (!ContextUtils.IsStateComponent(this.context.states![db])) {
      throw new Error('The state component type is wrong');
    }
    return this.context.states[db];
  }

  /**
   * Save the data to the state store
   * @param data The data for save operation
   * @param db The state store to save the data
   * @returns The promise of the save action being executed.
   */
  #stateSave(data: object, db?: string): Promise<void> {
    return this.daprClient.state.save(
      this.getState(db).componentName,
      data as KeyValuePairType[]
    );
  }

  /**
   * Get the data from the state store
   * @param data The data for get operation
   * @param db The state store to get the data
   * @returns The promise of the get action being executed.
   */
  #stateGet(data: object, db?: string): Promise<KeyValueType | string> {
    const data_length = Object.values(data).length;
    if (data_length > 1 || data_length <= 0) {
      throw new Error('State get method: invalid key number');
    }

    return this.daprClient.state.get(
      this.getState(db).componentName,
      Object.values(data)[0] as string
    );
  }

  /**
   * Get the datas from the state store
   * @param data The data for getBulk operation
   * @param db The state store to getBulk the data
   * @returns The promise of the getBulk action being executed.
   */
  #stateGetBulk(data: object, db?: string): Promise<KeyValueType[]> {
    const [keys, parallelism, metadata] = Object.values(data) as [
      string[],
      number,
      string
    ];
    return this.daprClient.state.getBulk(
      this.getState(db).componentName,
      keys,
      parallelism,
      metadata
    );
  }

  /**
   * Delete the data from the state store
   * @param data The data for delete operation
   * @param db The state store to delete the data
   * @returns The promise of the delete action being executed.
   */
  #stateDelete(data: object, db?: string) {
    const data_length = Object.values(data).length;
    if (data_length > 1 || data_length <= 0) {
      throw new Error('State get method: invalid keys number');
    }

    return this.daprClient.state.delete(
      this.getState(db).componentName,
      Object.values(data)[0] as string
    );
  }

  /**
   * Transaction the data from the state store
   * @param data The data for transaction operation
   * @param db The state store to transaction the data
   * @returns The promise of the transaction action being executed.
   */
  #stateTransaction(data: object, db?: string): Promise<void> {
    const [operations, metadata] = Object.values(data) as [
      OperationType[],
      IRequestMetadata
    ];
    return this.daprClient.state.transaction(
      this.getState(db).componentName,
      operations as OperationType[],
      metadata ? (metadata as IRequestMetadata) : null
    );
  }

  /**
   * query the data from the state store
   * @param data The data for query operation
   * @param db The state store to query the data
   * @returns The promise of the query action being executed.
   */
  #stateQuery(data: object, db?: string): Promise<StateQueryResponseType> {
    return this.daprClient.state.query(
      this.getState(db).componentName,
      Object.values(data)[0] as StateQueryType
    );
  }

  /**
   * The promise that handle data by state store.
   */
  get state(): {
    save: (data: object, db?: string) => Promise<void>;
    get: (data: object, db?: string) => Promise<KeyValueType | string>;
    getBulk: (data: object, db?: string) => Promise<KeyValueType[]>;
    delete: (data: object, db?: string) => Promise<void>;
    transaction: (data: object, db?: string) => Promise<void>;
    query: (query: object, db?: string) => Promise<StateQueryResponseType>;
  } {
    return {
      save: this.#stateSave.bind(this),
      get: this.#stateGet.bind(this),
      getBulk: this.#stateGetBulk.bind(this),
      delete: this.#stateDelete.bind(this),
      transaction: this.#stateTransaction.bind(this),
      query: this.#stateQuery.bind(this),
    };
  }
}
