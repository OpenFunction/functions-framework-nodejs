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
  inputs?: Record<string, OpenFunctionComponent>;
  /**
   * Optional output binding object.
   */
  outputs?: Record<string, OpenFunctionComponent>;
  /**
   * Optional state store config;
   */
  states?: Record<string, OpenFunctionComponent>;
  /**
   * Optional plugins to be executed before user function.
   */
  prePlugins?: string[];
  /**
   * Optional plugins to be executed after user function.
   */
  postPlugins?: string[];
  /**
   * Optional trace plugin config.
   */
  pluginsTracing?: TraceConfig;
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
  /**
   * The state type
   */
  State = 'state',
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
  /**
   * Checks if the component is a state component.
   * @param component - The component to check.
   * @returns A boolean value.
   */
  static IsStateComponent(component: OpenFunctionComponent): boolean {
    return component?.componentType.split('.')[0] === ComponentType.State;
  }
}

/**
 * The config of the trace plugin.
 * @public
 */
export interface TraceConfig {
  /**
   * Switch of the tracer
   */
  enabled: boolean;
  /**
   * Provider of the tracer
   */
  provider: TraceProvider;
  /**
   * Optional tags of the tracer
   */
  tags?: Record<string, string> & {func?: string};
  /**
   * Optional baggage of the tracer
   */
  baggage?: Record<string, string>;
}

/**
 * The trace provider object.
 * @public
 */
export interface TraceProvider {
  /**
   * The name of the provider.
   */
  name:
    | `${TraceProviderType}`
    | `${Capitalize<TraceProviderType>}`
    | `${Uppercase<TraceProviderType>}`;
  /**
   * The address of the OAP server.
   */
  oapServer: string;
}

/**
 * Defining trace provider type enumeration.
 * @public
 */
export enum TraceProviderType {
  /**
   * The SkyWalking type.
   */
  SkyWalking = 'skywalking',
  /**
   * The OpenTelemetry type.
   */
  OpenTelemetry = 'opentelemetry',
}
