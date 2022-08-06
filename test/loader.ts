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

import * as assert from 'assert';
import * as express from 'express';
import * as semver from 'semver';
import * as functions from '../src/functions';
import * as loader from '../src/loader';
import * as FunctionRegistry from '../src/function_registry';
import {FrameworkOptions} from '../src/options';
import {Plugin} from '../src';
import {invoke} from 'lodash';

describe('loading function', () => {
  interface TestData {
    name: string;
    codeLocation: string;
    target: string;
  }

  const testData: TestData[] = [
    {
      name: 'function without "main" in package.json',
      codeLocation: '/test/data/without_main',
      target: 'testFunction',
    },
    {
      name: 'function with "main" in package.json',
      codeLocation: '/test/data/with_main',
      target: 'testFunction',
    },
  ];

  for (const test of testData) {
    it(`should load ${test.name}`, async () => {
      const loadedFunction = await loader.getUserFunction(
        process.cwd() + test.codeLocation,
        test.target,
        'http'
      );
      const userFunction =
        loadedFunction?.userFunction as functions.HttpFunction;
      const returned = userFunction(express.request, express.response);
      assert.strictEqual(returned, 'PASS');
    });
  }

  const esmTestData: TestData[] = [
    {
      name: 'specified in package.json type field',
      codeLocation: '/test/data/esm_type',
      target: 'testFunction',
    },
    {
      name: 'nested dir, specified in package.json type field',
      codeLocation: '/test/data/esm_nested',
      target: 'testFunction',
    },
    {
      name: '.mjs extension',
      codeLocation: '/test/data/esm_mjs',
      target: 'testFunction',
    },
  ];

  for (const test of esmTestData) {
    const loadFn: () => Promise<functions.HttpFunction> = async () => {
      const loadedFunction = await loader.getUserFunction(
        process.cwd() + test.codeLocation,
        test.target,
        'http'
      );
      return loadedFunction?.userFunction as functions.HttpFunction;
    };
    if (semver.lt(process.version, loader.MIN_NODE_VERSION_ESMODULES)) {
      it(`should fail to load function in an ES module ${test.name}`, async () => {
        assert.rejects(loadFn);
      });
    } else {
      it(`should load function in an ES module ${test.name}`, async () => {
        const loadedFunction = await loadFn();
        const returned = loadedFunction(express.request, express.response);
        assert.strictEqual(returned, 'PASS');
      });
    }
  }

  it('loads a declaratively registered function', async () => {
    FunctionRegistry.http('registeredFunction', () => {
      return 'PASS';
    });
    const loadedFunction = await loader.getUserFunction(
      process.cwd() + '/test/data/with_main',
      'registeredFunction',
      'http'
    );
    const userFunction = loadedFunction?.userFunction as functions.HttpFunction;
    const returned = userFunction(express.request, express.response);
    assert.strictEqual(returned, 'PASS');
  });

  it('allows a mix of registered and non registered functions', async () => {
    FunctionRegistry.http('registeredFunction', () => {
      return 'FAIL';
    });
    const loadedFunction = await loader.getUserFunction(
      process.cwd() + '/test/data/with_main',
      'testFunction',
      'http'
    );
    const userFunction = loadedFunction?.userFunction as functions.HttpFunction;
    const returned = userFunction(express.request, express.response);
    assert.strictEqual(returned, 'PASS');
  });

  it('respects the registered signature type', async () => {
    FunctionRegistry.cloudEvent('registeredFunction', () => {});
    const loadedFunction = await loader.getUserFunction(
      process.cwd() + '/test/data/with_main',
      'registeredFunction',
      'http'
    );
    assert.strictEqual(loadedFunction?.signatureType, 'cloudevent');
  });
});

describe('loading plugins', () => {
  interface ExceptData {
    prePlugins: Array<string>;
    postPlugins: Array<string>;
  }

  interface TestData {
    options: FrameworkOptions;
    except: ExceptData;
  }
  const testData: TestData[] = [
    {
      options: {
        port: '8080',
        target: 'helloWorld',
        sourceLocation: process.cwd() + '/test/data',
        signatureType: 'event',
        printHelp: false,
        context: {
          name: 'demo',
          version: '',
          runtime: 'ASYNC',
          prePlugins: ['demo-plugin'],
          postPlugins: ['demo-plugin'],
        },
      },
      except: {
        prePlugins: ['demo-plugin'],
        postPlugins: ['demo-plugin'],
      },
    },
    {
      options: {
        port: '8080',
        target: 'helloWorld',
        sourceLocation: process.cwd() + '/test/data',
        signatureType: 'event',
        printHelp: false,
        context: {
          name: 'demo',
          version: '',
          runtime: 'ASYNC',
          prePlugins: ['demo-plugin'],
          postPlugins: [],
        },
      },
      except: {
        prePlugins: ['demo-plugin'],
        postPlugins: [],
      },
    },
    {
      options: {
        port: '8080',
        target: 'helloWorld',
        sourceLocation: process.cwd() + '/test/data',
        signatureType: 'event',
        printHelp: false,
        context: {
          name: 'demo',
          version: '',
          runtime: 'ASYNC',
          prePlugins: [],
          postPlugins: [],
        },
      },
      except: {
        prePlugins: [],
        postPlugins: [],
      },
    },
    {
      options: {
        port: '8080',
        target: 'helloWorld',
        sourceLocation: process.cwd() + '/test/data',
        signatureType: 'event',
        printHelp: false,
        context: {
          name: 'error',
          version: '',
          runtime: 'ASYNC',
          prePlugins: ['error-plugin'],
          postPlugins: ['error-plugin'],
        },
      },
      except: {
        prePlugins: [],
        postPlugins: [],
      },
    },
    {
      options: {
        port: '8080',
        target: 'helloWorld',
        sourceLocation: process.cwd() + '/test/data',
        signatureType: 'event',
        printHelp: false,
        context: {
          name: 'error',
          version: '',
          runtime: 'ASYNC',
          prePlugins: ['error-miss-version-plugin', 'demo-plugin'],
          postPlugins: ['error-miss-version-plugin'],
        },
      },
      except: {
        prePlugins: ['error-miss-version-plugin', 'demo-plugin'],
        postPlugins: ['error-miss-version-plugin'],
      },
    },
  ];

  it('load exits plugins', async () => {
    for (const test of testData) {
      const options = await loader.getUserPlugins(test.options);
      const current: ExceptData = {
        prePlugins: [],
        postPlugins: [],
      };

      options.context!.prePlugins!.forEach(item => {
        assert(typeof item === 'object');
        assert(item.get(Plugin.OFN_PLUGIN_VERSION) === 'v1');
        current.prePlugins.push(item.get(Plugin.OFN_PLUGIN_NAME));
      });
      options.context!.postPlugins!.forEach(item => {
        assert(typeof item === 'object');
        assert(item.get(Plugin.OFN_PLUGIN_VERSION) === 'v1');
        current.postPlugins.push(item.get(Plugin.OFN_PLUGIN_NAME));
      });

      assert.deepStrictEqual(current, test.except);
    }
  });

  const test: TestData = {
    options: {
      port: '8080',
      target: 'helloWorld',
      sourceLocation: process.cwd() + '/test/data',
      signatureType: 'event',
      printHelp: false,
      context: {
        name: 'error',
        version: '',
        runtime: 'ASYNC',
        prePlugins: [''],
        postPlugins: [''],
      },
    },
    except: {
      prePlugins: [''],
      postPlugins: [''],
    },
  };

  function copyAndSet(name: string): TestData {
    const data: TestData = JSON.parse(JSON.stringify(test));
    data.options.context!.prePlugins![0] = name;
    data.options.context!.postPlugins![0] = name;
    data.except.postPlugins[0] = name;
    data.except.prePlugins[0] = name;
    return data;
  }

  it('user plugin miss all', async () => {
    const data = copyAndSet('error-miss-all-plugin');
    const options = await loader.getUserPlugins(data.options);
    assert(typeof options.context!.prePlugins![0] === 'object');
    assert(
      options.context!.prePlugins![0].get(Plugin.OFN_PLUGIN_NAME) ===
        'error-miss-all-plugin'
    );
    assert(options.context!.prePlugins![0].execPreHook);
    assert(options.context!.prePlugins![0].execPostHook);
  });

  it('load multi plugins ', async () => {
    const data: FrameworkOptions = {
      port: '8080',
      target: 'helloWorld',
      sourceLocation: process.cwd() + '/test/data',
      signatureType: 'event',
      printHelp: false,
      context: {
        name: 'demo',
        version: '',
        runtime: 'ASYNC',
        prePlugins: ['demo-plugin', 'error-miss-all-plugin'],
        postPlugins: ['demo-plugin', 'error-miss-all-plugin'],
      },
    };
    assert.ok(await loader.getUserPlugins(data));
    console.log(data);
  });
});

describe('loading default plugins', () => {
  const optionWithoutUserPlugin = {
    port: '8080',
    target: 'helloWorld',
    sourceLocation: process.cwd() + '/test/data',
    signatureType: 'event',
    printHelp: false,
    context: {
      name: 'demo',
      version: '',
      runtime: 'ASYNC',
      // prePlugins: ['demo-plugin'],
      // postPlugins: ['demo-plugin'],
      tracing: {
        enabled: true,
        provider: {
          name: 'skywalking',
          oapServer: 'skywalking-oap:11800',
        },
        tags: {
          func: 'function-a',
          layer: 'faas',
          tag1: 'value1',
          tag2: 'value2',
        },
        baggage: {
          key: 'key1',
          value: 'value1',
        },
      },
    },
  };
  const optionWithoutUserPluginEnabled = {
    port: '8080',
    target: 'helloWorld',
    sourceLocation: process.cwd() + '/test/data',
    signatureType: 'event',
    printHelp: false,
    context: {
      name: 'demo',
      version: '',
      runtime: 'ASYNC',
      // prePlugins: ['demo-plugin'],
      // postPlugins: ['demo-plugin'],
      tracing: {
        enabled: false,
        provider: {
          name: 'skywalking',
          oapServer: 'skywalking-oap:11800',
        },
        tags: {
          func: 'function-a',
          layer: 'faas',
          tag1: 'value1',
          tag2: 'value2',
        },
        baggage: {
          key: 'key1',
          value: 'value1',
        },
      },
    },
  };
  const optionWithUserPlugin = {
    port: '8080',
    target: 'helloWorld',
    sourceLocation: process.cwd() + '/test/data',
    signatureType: 'event',
    printHelp: false,
    context: {
      name: 'demo',
      version: '',
      runtime: 'ASYNC',
      prePlugins: ['demo-plugin'],
      postPlugins: ['demo-plugin'],
      tracing: {
        enabled: true,
        provider: {
          name: 'skywalking',
          oapServer: 'skywalking-oap:11800',
        },
        tags: {
          func: 'function-a',
          layer: 'faas',
          tag1: 'value1',
          tag2: 'value2',
        },
        baggage: {
          key: 'key1',
          value: 'value1',
        },
      },
    },
  };
  it('load trace skywalking ', async () => {
    const option = optionWithoutUserPlugin as FrameworkOptions;
    loader.getUserPlugins(option);
    console.log(optionWithoutUserPlugin);
  });

  it('load trace skywalking with user plugin', async () => {
    const option = optionWithUserPlugin as FrameworkOptions;
    loader.getUserPlugins(option);
    console.log(optionWithUserPlugin);
  });

  it('load trace skywalking enbale skywalking', async () => {
    const option = optionWithoutUserPluginEnabled as FrameworkOptions;
    loader.getUserPlugins(option);
    console.log(optionWithoutUserPluginEnabled);
  });
});
