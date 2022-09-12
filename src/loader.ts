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

import * as fs from 'fs';
import * as path from 'path';
import {pathToFileURL} from 'url';

import * as semver from 'semver';
import * as readPkgUp from 'read-pkg-up';
import {forEach} from 'lodash';

import {Plugin, PluginStore, PluginMap} from './openfunction/plugin';

import {HandlerFunction} from './functions';
import {getRegisteredFunction} from './function_registry';
import {SignatureType} from './types';
import {FrameworkOptions} from './options';
import {OpenFunctionContext} from './openfunction/context';
import {
  SKYWALKINGNAME,
  SkyWalkingPlugin,
} from './openfunction/plugin/skywalking/skywalking';

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

async function loadModule(modulePath: string) {
  let module;

  const esModule = await isEsModule(modulePath);
  if (esModule) {
    if (semver.lt(process.version, MIN_NODE_VERSION_ESMODULES)) {
      console.error(
        `Cannot load ES Module on Node.js ${process.version}. ` +
          `Please upgrade to Node.js v${MIN_NODE_VERSION_ESMODULES} and up.`
      );
      return null;
    }
    // Resolve module path to file:// URL. Required for windows support.
    const fpath = pathToFileURL(modulePath);
    module = await dynamicImport(fpath.href);
  } else {
    module = require(modulePath);
  }

  return module;
}

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

    // Firstly, we try to load function
    const functionModule = await loadModule(functionModulePath);

    // If the customer declaratively registered a function matching the target return that
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
 * It loads all the plugins from the provided code location.
 * @param codeLocation - The path to the plugin source codes.
 * @return A named plugin map object or null.
 */
export async function getFunctionPlugins(
  codeLocation: string
): Promise<PluginMap | null> {
  const files = getPluginsModulePath(codeLocation);
  if (!files) return null;

  // Try to load all plugin module files

  const store = PluginStore.Instance();
  const plugins: PluginMap = {};

  for (const file of files) {
    try {
      const modules = await loadModule(file);

      forEach(modules, module => {
        // All plugin modules should extend from Plugin abstract class
        if (module.prototype instanceof Plugin) {
          // Try to create plugin instance
          const plugin = new module();
          // Register plugin instance to plugin store
          store.register(plugin);
          // Also save to return records
          plugins[plugin.name] = plugin;
        }
      });
    } catch (ex) {
      const err = <Error>ex;
      console.error(
        "Provided module can't be loaded. Plesae make sure your module extend Plugin class properly." +
          `\nDetailed stack trace: ${err.stack}`
      );
    }
  }

  return plugins;
}

/**
 * Returns resolved path of the folder containing the user plugins.
 * Returns null if the plugin folder does not exist.
 * @param codeLocation Directory with user's code.
 * @return Resolved path of plugins or null.
 */
function getPluginsModulePath(codeLocation: string): string[] | null {
  try {
    const param = path.resolve(codeLocation + '/plugins');
    const files = fs.readdirSync(param);

    const pluginFiles: string[] = [];
    for (const file of files) {
      pluginFiles.push(require.resolve(path.join(param, file)));
    }
    return pluginFiles;
  } catch (ex) {
    console.error('Fail to load plugins: %s', ex);
    return null;
  }
}

/**
 * It loads BUIDIN type plugins from the /openfunction/plugin.
 * @param context - The context of OpenFunction.
 */
export async function loadBuidInPlugins(options: FrameworkOptions) {
  if (!options.context) {
    console.warn("The context is undefined can't load BUIDIN type plugins");
    return;
  }
  const store = PluginStore.Instance(PluginStore.Type.BUILTIN);
  //Provide system info for BUILDIN type plugins

  if (checkTraceConfig(options.context)) {
    const skywalking = new SkyWalkingPlugin(options);
    store.register(skywalking);
    options.context.prePlugins?.push(SKYWALKINGNAME);
    options.context.postPlugins?.push(SKYWALKINGNAME);
  }
}

/**
 * It check trace config ,it will set default value if it is enbaled.
 * @param tracing - The config of TraceConfig.
 */
function checkTraceConfig(context: OpenFunctionContext): boolean {
  if (!context.pluginsTracing) {
    console.warn('TraceConfig is invalid');
    return false;
  }
  if (!context.pluginsTracing.enabled) {
    return false;
  }
  if (!context.pluginsTracing.tags) {
    context.pluginsTracing.tags = {};
  }
  //Set default trace provider config
  context.pluginsTracing.provider = {
    name: context.pluginsTracing.provider?.name || SKYWALKINGNAME,
    oapServer: context.pluginsTracing.provider?.oapServer || '127.0.0.1:11800',
  };

  return true;
}
