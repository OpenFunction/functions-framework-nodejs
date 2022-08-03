import {forEach, invoke} from 'lodash';
import {DaprServer} from '@dapr/dapr';

import {OpenFunction} from '../functions';

import {OpenFunctionContext, ContextUtils} from './function_context';
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
    // Exec pre hooks
    console.log(context.prePlugins);
    if (context.prePlugins) {
      await context.prePlugins.reduce(async (_, current) => {
        await invoke(current, 'execPreHook', ctx);
        return [];
      }, Promise.resolve([]));
    }

    await userFunction(ctx, data);

    // Exec post hooks
    if (context.postPlugins) {
      await context.postPlugins.reduce(async (_, current) => {
        await invoke(current, 'execPostHook', ctx);
        return [];
      }, Promise.resolve([]));
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
