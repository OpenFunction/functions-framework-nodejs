/**
 * The OpenFunction's serving context.
 * @public
 */
export interface OpenFunctionContext {
  /**
   * The name of the context.
   */
  name: string;
  /**
   * The version of the context.
   */
  version: string;
  /**
   * The target runtime of the context.
   */
  runtime:
    | `${RuntimeType}`
    | `${Capitalize<RuntimeType>}`
    | `${Uppercase<RuntimeType>}`;
  /**
   * Optional port string of the server.
   */
  port?: string;
  /**
   * Optional input binding object.
   */
  inputs?: OpenFunctionBinding;
  /**
   * Optional output binding object.
   */
  outputs?: OpenFunctionBinding;
  /**
   * Optional pre function exec plugins.
   */
  prePlugins?: Array<string>;
  /**
   * Optional post function exec plugins.
   */
  postPlugins?: Array<string>;
  /**
   * the map of plugin name & class.
   */
  pluginMap?: Map<string, Plugin>;
}

/**
 * The binding interface of the context.
 * @public
 */
export interface OpenFunctionBinding {
  /**
   * The hash map of the binding.
   */
  [key: string]: OpenFunctionComponent;
}

/**
 * The component interface of the context.
 * @public
 */
export interface OpenFunctionComponent {
  /**
   * The name of the component.
   */
  componentName: string;
  /**
   * The type of the component.
   */
  componentType: `${ComponentType}.${string}`;
  /**
   * The uri of the component.
   */
  uri?: string;
  /**
   * Optional operation of the component.
   */
  operation?: string;
  /**
   * Optional metadata as hash map for the component.
   */
  metadata?: Record<string, string>;
}

/**
 * Defining runtime type enumeration.
 * @public
 */
export enum RuntimeType {
  /**
   * The Knative type.
   */
  Knative = 'knative',
  /**
   * The async type.
   */
  Async = 'async',
}

/**
 * Defining component type enumeration.
 * @public
 */
export enum ComponentType {
  /**
   * The binding type.
   */
  Binding = 'bindings',
  /**
   * The pubsub type.
   */
  PubSub = 'pubsub',
}

/**
 * Provides a set of methods to help determine types used in FunctionContext.
 * @public
 */
export class ContextUtils {
  /**
   * Returns true if the runtime is Knative.
   * @param context - The OpenFunctionContext object.
   * @returns A boolean value.
   */
  static IsKnativeRuntime(context: OpenFunctionContext): boolean {
    return context?.runtime?.toLowerCase() === RuntimeType.Knative;
  }
  /**
   * Returns true if the runtime is Async.
   * @param context - The OpenFunctionContext object.
   * @returns A boolean value.
   */
  static IsAsyncRuntime(context: OpenFunctionContext): boolean {
    return context?.runtime?.toLowerCase() === RuntimeType.Async;
  }

  /**
   * Checks if the component is a binding component.
   * @param component - The component to check.
   * @returns A boolean value.
   */
  static IsBindingComponent(component: OpenFunctionComponent): boolean {
    return component?.componentType.split('.')[0] === ComponentType.Binding;
  }
  /**
   * Checks if the component is a pubsub component.
   * @param component - The component to check.
   * @returns A boolean value.
   */
  static IsPubSubComponent(component: OpenFunctionComponent): boolean {
    return component?.componentType.split('.')[0] === ComponentType.PubSub;
  }
}

/**
 * The OpenFunction's plugin template.
 * @public
 */
export class Plugin {
  /**
   * The plugin init method.
   * @method
   */
  async init() {
    console.log('init');
  }
  /**
   * The plugin pre hook.
   * @method
   */
  async execPreHook(ctx: PluginContextRuntime, plugins: Map<string, Plugin>) {
    console.log(ctx, plugins);
  }
  /**
   * The plugin post hook.
   * @method
   */
  async execPostHook(ctx: PluginContextRuntime, plugins: Map<string, Plugin>) {
    console.log(ctx, plugins);
  }
  /**
   * get plugin filed.
   * @method
   */
  get(filedName: string) {
    return filedName;
  }
  /**
   * get plugin name.
   * @method
   */
  pluginName(): string {
    return '';
  }
  /**
   * get plugin version.
   * @method
   */
  pluginVersion(): string {
    return '';
  }
}

/**
 * The OpenFunction's plugin  context runtime.
 * @public
 */
export interface PluginContextRuntime {
  /**
   * OpenFunctionRuntime.
   */
  context: OpenFunctionContext;
  /**
   * data.
   */
  data: object;
}
