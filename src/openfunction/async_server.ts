import {forEach} from 'lodash';
import {DaprServer} from '@dapr/dapr';

import {OpenFunction} from '../functions';

import {OpenFunctionContext, ContextUtils} from './function_context';
import {OpenFunctionRuntime} from './function_runtime';
import { PluginContext, PluginContextRuntime } from '../plugin_context';

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
  context: OpenFunctionContext,
  pluginContext?: PluginContext
): AsyncFunctionServer {
  const app = new DaprServer('localhost', context.port);
  const ctx = OpenFunctionRuntime.ProxyContext(context);

  const wrapper = async (data: object) => {
    let runtime : PluginContextRuntime | undefined = pluginContext ? {
      pluginContext: pluginContext,
      data: data,
      context: ctx
    } : undefined
    
    if(runtime){
      runtime.context = ctx
      runtime.data = data
      for(var i=0;i<runtime.pluginContext.prePluginFuncs!.length;i++){
        await runtime.pluginContext.prePluginFuncs![i](pluginContext)
        data = runtime.data
      }
    }
    await userFunction(ctx, data);
    if(runtime){
      runtime.context = ctx
      runtime.data = data
      for(var i=0;i<runtime.pluginContext.postPluginFuncs!.length;i++){
        await runtime.pluginContext.postPluginFuncs![i](pluginContext)
        data = runtime.data
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
