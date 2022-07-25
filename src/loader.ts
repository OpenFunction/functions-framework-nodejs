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
import {Plugin} from './openfunction/function_context';
import {FrameworkOptions} from './options';
import {forEach} from 'lodash';

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

/**
 * Returns user's plugin from function file.
 * Returns null if plugin can't be retrieved.
 * @return User's plugins or null.
 */
export async function getUserPlugins(
  options: FrameworkOptions
): Promise<FrameworkOptions> {
  // get plugin set
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
      // load plugin js files
      const instances: Instance = {};
      const param = path.resolve(`${options.sourceLocation}/plugins`);
      const plugin_files: Array<string> = [];
      const files = fs.readdirSync(param);

      for (const k in files) {
        plugin_files.push(require.resolve(path.join(param, files[k])));
      }

      // find plugins class
      type PluginClass = Record<string, any>;
      const tempMap: PluginClass = {};
      for (const k in plugin_files) {
        const jsMoulde = require(plugin_files[k]);
        if (jsMoulde && jsMoulde.Name) {
          tempMap[jsMoulde.Name] = jsMoulde;
        }
      }

      // instance plugin dynamic set ofn_plugin_name
      const arr = Array.from(pluginSet.values());
      for (const k in arr) {
        const module = tempMap[arr[k]];
        if (module) {
          const instance = new module();
          instance['ofn_plugin_name'] = module.Name;
          instance['ofn_plugin_version'] = module.Version || 'v1';

          //set default method of pre post get
          if (!instance.execPreHook) {
            instance.execPreHook = (ctx?: OpenFunctionRuntime) => {
              console.log(ctx);
            };
          }
          if (!instance.execPostHook) {
            instance.execPostHook = (ctx?: OpenFunctionRuntime) => {
              console.log(ctx);
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
          instances[arr[k]] = instance as Plugin;
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
      console.error(error);
    }
  }
  return options;
}
