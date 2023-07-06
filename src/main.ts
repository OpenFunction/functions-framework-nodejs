#!/usr/bin/env node

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

// Functions framework entry point that configures and starts Node.js server
// that runs user's code on HTTP request.
import * as process from 'process';

import {createHttpTerminator} from 'http-terminator';

import {getAysncServer} from './openfunction/async_server';
import {ContextUtils} from './openfunction/context';

import {getUserFunction, getFunctionPlugins, getBuiltinPlugins} from './loader';
import {ErrorHandler} from './invoker';
import {getServer} from './server';
import {parseOptions, helpText, OptionsError} from './options';
import {OpenFunction} from './functions';

/**
 * Main entrypoint for the functions framework that loads the user's function
 * and starts the HTTP server.
 */
export const main = async () => {
  try {
    const options = parseOptions();

    if (options.printHelp) {
      console.error(helpText);
      return;
    }

    const loadedFunction = await getUserFunction(
      options.sourceLocation,
      options.target,
      options.signatureType
    );
    if (!loadedFunction) {
      console.error('Could not load the function, shutting down.');
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
    const {userFunction, signatureType} = loadedFunction;

    // Load function plugins before starting server
    // First, we load system built-in function plugins
    await getBuiltinPlugins(options.context!);
    // Then, we load user-defined function plugins
    await getFunctionPlugins(options.sourceLocation);

    // Try to determine the server runtime
    // Considering the async runtime in the first place
    if (ContextUtils.IsAsyncRuntime(options.context!)) {
      options.context!.port = options.port;

      const server = getAysncServer(
        userFunction! as OpenFunction,
        options.context!
      );
      await server.start();

      // DaprServer uses httpTerminator in server.stop()
      handleShutdown(async () => await server.stop());
    }
    // Then taking sync runtime as the fallback
    else {
      const server = getServer(userFunction!, signatureType, options.context);
      const errorHandler = new ErrorHandler(server);
      server
        .listen(options.port, () => {
          errorHandler.register();
          if (process.env.NODE_ENV !== 'production') {
            console.log('Serving function...');
            console.log(`Function: ${options.target}`);
            console.log(`Signature type: ${signatureType}`);
            console.log(`URL: http://localhost:${options.port}/`);
          }
        })
        .setTimeout(0); // Disable automatic timeout on incoming connections.

      // Create and use httpTerminator for Express
      const terminator = createHttpTerminator({
        server,
      });
      handleShutdown(async () => await terminator.terminate());
    }
  } catch (e) {
    if (e instanceof OptionsError) {
      console.error(e.message);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
    throw e;
  }
};

// Call the main method to load the user code and start the http server.
main();

function handleShutdown(handler: () => Promise<void>): void {
  if (!handler) return;

  const shutdown = async (code: string) => {
    console.log(`🛑 Terminating OpenFunction server on code ${code}...`);
    await handler();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
