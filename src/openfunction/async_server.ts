import {forEach} from 'lodash';
import {DaprServer} from '@dapr/dapr';

import {OpenFunction} from '../functions';

import {
  OpenFunctionContext,
  ContextUtils,
  PluginContextRuntime,
} from './function_context';
import {OpenFunctionRuntime} from './function_runtime';

export type AsyncFunctionServer = DaprServer;

/**
 * Creates and configures an Dapr server and returns an HTTP server
 * which will run it.
 * @param userFunction User's function.
 * @param functionSignatureType Type of user's function signature.
 * @return HTTP server.
 */
export default function (
  userFunction: OpenFunction,
  context: OpenFunctionContext
): AsyncFunctionServer {
  const app = new DaprServer('localhost', context.port);
  const ctx = OpenFunctionRuntime.ProxyContext(context);

  const wrapper = async (data: object) => {
    const runtime: PluginContextRuntime = {
      context: context,
      data: data,
    };
    if (context.prePlugins) {
      for (let i = 0; i < context.prePlugins!.length; i++) {
        const p = context.pluginMap?.get(context.prePlugins![i]);
        if (p) {
          await p.execPreHook(runtime, context.pluginMap!);
          data = runtime.data;
        }
      }
    }
    await userFunction(ctx, data);
    if (context.postPlugins) {
      for (let i = 0; i < context.postPlugins!.length; i++) {
        const p = context.pluginMap?.get(context.postPlugins![i]);
        if (p) {
          await p.execPostHook(runtime, context.pluginMap!);
          data = runtime.data;
        }
      }
    }
  };

  // Initialize the server with the user's function.
  // For server interfaces, refer to https://github.com/dapr/js-sdk/blob/master/src/interfaces/Server/

  // For each input in context, bind the user function according to the component type.
  forEach(context.inputs, component => {
    if (ContextUtils.IsBindingComponent(component)) {
      app.binding.receive(component.componentName, wrapper);
    } else if (ContextUtils.IsPubSubComponent(component)) {
      app.pubsub.subscribe(
        component.componentName,
        component.uri || '',
        wrapper
      );
    }
  });

  return app;
}
