import {OpenFunctionRuntime} from './functions';
/**
 * The OpenFunction's plugin  context.
 * @public
 */
export interface PluginContext {
  /**
   * The name of the pre plugins.
   */
  prePlugins: Array<string>;
  /**
   * The name of the pre plugins.
   */
  postPlugins: Array<string>;
  /**
   * The func of the pre plugins.
   */
  prePluginFuncs?: Array<Function>;
  /**
   * The func of the pre plugins.
   */
  postPluginFuncs?: Array<Function>;
  /**
   * The refect between name func.
   */
  pluginMap?: Map<string, Function>;
}

/**
 * The OpenFunction's plugin  context runtime.
 * @public
 */
export interface PluginContextRuntime {
  /**
   * The refect between name func.
   */
  pluginContext: PluginContext;
  /**
   * OpenFunctionRuntime.
   */
  context?: OpenFunctionRuntime;
  /**
   * data.
   */
  data?: object;
}
