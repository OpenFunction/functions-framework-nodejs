import {forEach} from 'lodash';
import {DaprServer} from '@dapr/dapr';

import {OpenFunction} from '../functions';

import {OpenFunctionContext, ContextUtils} from './context';
import {OpenFunctionRuntime} from './runtime';

export type AsyncFunctionServer = DaprServer;

/**
 * Creates and configures an Dapr server and returns an HTTP server
 * which will run it.
 * @param userFunction User's function.
 * @param context Context of user's function.
 * @return HTTP server.
 */
export default function (
  userFunction: OpenFunction,
  context: OpenFunctionContext
): AsyncFunctionServer {
  // Initailize Dapr server
  const app = new DaprServer('127.0.0.1', context.port, process.env.DAPR_HOST);

  // Create wrapper for user function
  const wrapper = OpenFunctionRuntime.WrapUserFunction(userFunction, context);

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
