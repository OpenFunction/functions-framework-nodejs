// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// loader.ts
/**
 * This package contains the logic to load user's function.
 * @packageDocumentation
 */

import * as path from 'path';
import * as semver from 'semver';
import * as readPkgUp from 'read-pkg-up';
import * as fs from 'fs';
import {pathToFileURL} from 'url';
import {HandlerFunction, OpenFunctionRuntime} from './functions';
import {SignatureType} from './types';
import {getRegisteredFunction} from './function_registry';
import {Plugin, TraceConfig} from './openfunction/function_context';
import {FrameworkOptions} from './options';
import {forEach} from 'lodash';
import {SkywalkingPlugin} from './plugin/skywalking_plugin';

// Dynamic import function required to load user code packaged as an
// ES module is only available on Node.js v13.2.0 and up.
//   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#browser_compatibility
// Exported for testing.
export const MIN_NODE_VERSION_ESMODULES = '13.2.0';

/**
 * Determines whether the given module is an ES module.
 *
 * Implements "algorithm" described at:
 *   https://nodejs.org/api/packages.html#packages_type
 *
 * In words:
 *   1. A module with .mjs extension is an ES module.
 *   2. A module with .clj extension is not an ES module.
 *   3. A module with .js extensions where the nearest package.json's
 *      with "type": "module" is an ES module.
 *   4. Otherwise, it is not an ES module.
 *
 * @returns {Promise<boolean>} True if module is an ES module.
 */
async function isEsModule(modulePath: string): Promise<boolean> {
  const ext = path.extname(modulePath);
  if (ext === '.mjs') {
    return true;
  }
  if (ext === '.cjs') {
    return false;
  }

  const pkg = await readPkgUp({
    cwd: path.dirname(modulePath),
    normalize: false,
  });

  // If package.json specifies type as 'module', it's an ES module.
  return pkg?.packageJson.type === 'module';
}

/**
 * Dynamically load import function to prevent TypeScript from
 * transpiling into a require.
 *
 * See https://github.com/microsoft/TypeScript/issues/43329.
 */
const dynamicImport = new Function(
  'modulePath',
  'return import(modulePath)'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as (modulePath: string) => Promise<any>;

/**
 * Returns user's function from function file.
 * Returns null if function can't be retrieved.
 * @return User's function or null.
 */
export async function getUserFunction(
  codeLocation: string,
  functionTarget: string,
  signatureType: SignatureType
): Promise<{
  userFunction: HandlerFunction;
  signatureType: SignatureType;
} | null> {
  try {
    const functionModulePath = getFunctionModulePath(codeLocation);

    if (functionModulePath === null) {
      console.error('Provided code is not a loadable module.');
      return null;
    }

    let functionModule;
    const esModule = await isEsModule(functionModulePath);
    if (esModule) {
      if (semver.lt(process.version, MIN_NODE_VERSION_ESMODULES)) {
        console.error(
          `Cannot load ES Module on Node.js ${process.version}. ` +
            `Please upgrade to Node.js v${MIN_NODE_VERSION_ESMODULES} and up.`
        );
        return null;
      }
      // Resolve module path to file:// URL. Required for windows support.
      const fpath = pathToFileURL(functionModulePath);
      functionModule = await dynamicImport(fpath.href);
    } else {
      functionModule = require(functionModulePath);
    }

    // If the customer declaratively registered a function matching the target
    // return that.
    const registeredFunction = getRegisteredFunction(functionTarget);
    if (registeredFunction) {
      return registeredFunction;
    }

    let userFunction = functionTarget
      .split('.')
      .reduce((code, functionTargetPart) => {
        if (typeof code === 'undefined') {
          return undefined;
        } else {
          return code[functionTargetPart];
        }
      }, functionModule);

    // TODO: do we want 'function' fallback?
    if (typeof userFunction === 'undefined') {
      // eslint-disable-next-line no-prototype-builtins
      if (functionModule.hasOwnProperty('function')) {
        userFunction = functionModule['function'];
      } else {
        console.error(
          `Function '${functionTarget}' is not defined in the provided ` +
            'module.\nDid you specify the correct target function to execute?'
        );
        return null;
      }
    }

    if (typeof userFunction !== 'function') {
      console.error(
        `'${functionTarget}' needs to be of type function. Got: ` +
          `${typeof userFunction}`
      );
      return null;
    }

    return {userFunction: userFunction as HandlerFunction, signatureType};
  } catch (ex) {
    const err: Error = <Error>ex;
    let additionalHint: string;
    // TODO: this should be done based on ex.code rather than string matching.
    if (err.stack && err.stack.includes('Cannot find module')) {
      additionalHint =
        'Did you list all required modules in the package.json ' +
        'dependencies?\n';
    } else {
      additionalHint = 'Is there a syntax error in your code?\n';
    }
    console.error(
      `Provided module can't be loaded.\n${additionalHint}` +
        `Detailed stack trace: ${err.stack}`
    );
    return null;
  }
}

/**
 * Returns resolved path to the module containing the user function.
 * Returns null if the module can not be identified.
 * @param codeLocation Directory with user's code.
 * @return Resolved path or null.
 */
function getFunctionModulePath(codeLocation: string): string | null {
  let path: string | null = null;
  try {
    path = require.resolve(codeLocation);
  } catch (ex) {
    try {
      // TODO: Decide if we want to keep this fallback.
      path = require.resolve(codeLocation + '/function.js');
    } catch (ex) {
      return path;
    }
  }
  return path;
}

type PluginClass = Record<string, any>;
/**
 * Returns user's plugin from function file.
 * Returns null if plugin can't be retrieved.
 * @return User's plugins or null.
 */
export async function getUserPlugins(
  options: FrameworkOptions
): Promise<FrameworkOptions> {
  // Get plugin set
  const pluginSet: Set<string> = new Set();
  if (options.context) {
    if (options.context.prePlugins) {
      forEach(options.context.prePlugins, plugin => {
        typeof plugin === 'string' && pluginSet.add(plugin);
      });
    }
    if (options.context.postPlugins) {
      forEach(options.context.postPlugins, plugin => {
        typeof plugin === 'string' && pluginSet.add(plugin);
      });
    }

    try {
      type Instance = Record<string, Plugin>;
      // Load plugin js files
      const instances: Instance = {};

      const pluginFiles = getPluginFiles(options.sourceLocation);
      if (pluginFiles === null) {
        console.warn('[warn-!!!] user plugins files load failed ');
        options.context.prePlugins = [];
        options.context.postPlugins = [];
        return options;
      }

      // Find plugins class
      const tempMap: PluginClass = {};
      for (const pluginFile of pluginFiles) {
        const jsMoulde = require(pluginFile);
        processJsModule(jsMoulde, tempMap);
      }

      // Instance plugin dynamic set ofn_plugin_name
      const pluginNames = Array.from(pluginSet.values());
      for (const name of pluginNames) {
        const module = tempMap[name];
        if (module) {
          const instance = new module();
          instance[Plugin.OFN_PLUGIN_NAME] = module.Name;
          instance[Plugin.OFN_PLUGIN_VERSION] = module.Version || 'v1';

          //Set default method of pre post get
          if (!instance.execPreHook) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            instance.execPreHook = (ctx: OpenFunctionRuntime) => {
              console.log(
                `This plugin ${name}  method execPreHook is not implemented.`
              );
            };
          }
          if (!instance.execPostHook) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            instance.execPostHook = (ctx: OpenFunctionRuntime) => {
              console.log(
                `This plugin ${name}  method execPostHook is not implemented.`
              );
            };
          }
          if (!instance.get) {
            instance.get = (filedName: string) => {
              for (const key in instance) {
                if (key === filedName) {
                  return instance[key];
                }
              }
            };
          }
          instances[name] = instance as Plugin;
        }
      }

      const prePlugins: Array<Plugin> = [];
      const postPlugins: Array<Plugin> = [];
      if (options.context.prePlugins) {
        forEach(options.context.prePlugins, plugin => {
          if (typeof plugin === 'string') {
            const instance = instances[plugin];
            typeof instance === 'object' && prePlugins.push(instance);
          }
        });
      }
      if (options.context.postPlugins) {
        forEach(options.context.postPlugins, plugin => {
          if (typeof plugin === 'string') {
            const instance = instances[plugin];
            typeof instance === 'object' && postPlugins.push(instance);
          }
        });
      }

      options.context.prePlugins = prePlugins;
      options.context.postPlugins = postPlugins;
    } catch (error) {
      console.error('load plugins error reason: \n');
      console.error(error);
    }

    // Check default plugins config example trace
    loadTracePlugin(options);
  }
  return options;
}

/**
 * Returns resolved path to the dir containing the user plugins.
 * Returns null if the path is not exits
 * @param codeLocation Directory with user's code.
 * @return Resolved path or null.
 */
function getPluginFiles(codeLocation: string): Array<string> | null {
  const pluginFiles: Array<string> = [];
  try {
    const param = path.resolve(codeLocation + '/plugins');
    const files = fs.readdirSync(param);

    for (const file of files) {
      pluginFiles.push(require.resolve(path.join(param, file)));
    }
  } catch (ex) {
    const err: Error = <Error>ex;
    console.error(err.message);
    return null;
  }
  return pluginFiles;
}
/**
 * Returns rdetermine whether it is a class.
 * Returns boolean is can be class
 * @param obj jsmodule.
 * @return boolean of it is a class.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function couldBeClass(obj: any): boolean {
  return (
    typeof obj === 'function' &&
    obj.prototype !== undefined &&
    obj.prototype.constructor === obj &&
    obj.toString().slice(0, 5) === 'class'
  );
}

/**
 * Process jsMoulde if it can be a plugin class put it into tempMap.
 * @param obj jsmodule.
 * @param tempMap PluginClass.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processJsModule(obj: any, tempMap: PluginClass) {
  if (typeof obj === 'object') {
    for (const o in obj) {
      if (couldBeClass(obj[o]) && obj[o].Name) {
        tempMap[obj[o].Name] = obj[o];
      }
    }
  }
  if (couldBeClass(obj) && obj.Name) {
    tempMap[obj.Name] = obj;
  }
}

/**
 * Check and load Trace plugin if it enable;
 * @param option FrameworkOptions.
 */
function loadTracePlugin(option: FrameworkOptions) {
  if (option.context?.tracing?.enabled) {
    const config = option.context.tracing as TraceConfig;

    if (!config.provider) {
      console.error('Trace provider is missing');
      return;
    }

    // Load skywalking plugin
    if (
      config.provider.name &&
      config.provider.name === SkywalkingPlugin.Name
    ) {
      console.info('start load skywalking plugin');
      //TODO check provider oapServer is valid
      //checkOapServer
      const skywalkingPlugin = new SkywalkingPlugin(option.context);
      skywalkingPlugin.start();

      //Push skywalking plugin instance to context
      option.context.prePlugins?.push(skywalkingPlugin);
      option.context.postPlugins?.push(skywalkingPlugin);
    }
  }
}
