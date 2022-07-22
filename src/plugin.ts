import * as path from 'path';
import * as fs from 'fs';
import {OpenFunctionContext, Plugin} from './openfunction/function_context';
import {forEach} from 'lodash';
export async function loadPlugins(
  codeLocation: string,
  context: OpenFunctionContext
): Promise<Map<string, Plugin>> {
  const pluginMap: Map<string, Plugin> = new Map();
  if (!context) {
    return pluginMap;
  }
  if (!context.prePlugins && !context.postPlugins) {
    return pluginMap;
  }
  const param = path.resolve(`${codeLocation}/plugins`);
  const plugin_files: Array<string> = [];
  const files = fs.readdirSync(param);
  files.forEach(f => {
    if (f.endsWith('.js')) {
      plugin_files.push(path.join(param, f));
    }
  });
  const set = new Set();
  if (context.prePlugins) {
    forEach(context.prePlugins, value => {
      set.add(value);
    });
  }
  if (context.postPlugins) {
    forEach(context.postPlugins, value => {
      set.add(value);
    });
  }
  console.log(plugin_files);
  plugin_files.forEach(f => {
    try {
      const pluginModule = require(f);
      const p = new pluginModule();
      if (
        p.pluginName &&
        p.pluginVersion &&
        p.get &&
        p.execPreHook &&
        p.execPostHook &&
        p.init &&
        set.has(p.pluginName())
      ) {
        pluginMap.set(p.pluginName(), p as Plugin);
      }
    } catch (error) {
      console.error(error);
    }
  });
  try {
    pluginMap.forEach(async item => {
      await item.init();
    });
  } catch (error) {
    console.error(error);
  }
  return pluginMap;
}
