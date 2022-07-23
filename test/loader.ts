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
  const ofn_plugin_name = 'ofn_plugin_name';
  const ofn_plugin_version = 'ofn_plugin_version';
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
          prePlugins: ['error-miss-version-plugin'],
          postPlugins: ['error-miss-version-plugin'],
        },
      },
      except: {
        prePlugins: ['error-miss-version-plugin'],
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
        assert(item.get(ofn_plugin_version) === 'v1');
        current.prePlugins.push(item.get(ofn_plugin_name));
      });
      options.context!.postPlugins!.forEach(item => {
        assert(typeof item === 'object');
        assert(item.get(ofn_plugin_version) === 'v1');
        current.postPlugins.push(item.get(ofn_plugin_name));
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
  it('user plugin miss prehook', async () => {
    const data = copyAndSet('error-error-miss-pre-plugin');
    const options = await loader.getUserPlugins(data.options);
    assert.throws(() => {
      assert(options.context!.prePlugins!.length === 1);
      assert(typeof options.context!.prePlugins![0] === 'object');
      options.context!.prePlugins![0].execPreHook();
    });
  });
  it('user plugin miss posthook', async () => {
    const data = copyAndSet('error-error-miss-post-plugin');
    const options = await loader.getUserPlugins(data.options);
    assert.throws(() => {
      assert(options.context!.prePlugins!.length === 1);
      assert(typeof options.context!.prePlugins![0] === 'object');
      options.context!.prePlugins![0].execPostHook();
    });
  });
  it('user plugin miss get', async () => {
    const data = copyAndSet('error-error-miss-post-plugin');
    const options = await loader.getUserPlugins(data.options);
    assert.throws(() => {
      assert(options.context!.prePlugins!.length === 1);
      assert(typeof options.context!.prePlugins![0] === 'object');
      options.context!.prePlugins![0].get('');
    });
  });
  it('user plugin miss all', async () => {
    const data = copyAndSet('error-error-miss-all-plugin');
    const options = await loader.getUserPlugins(data.options);
    assert.throws(() => {
      assert(options.context!.prePlugins!.length === 1);
      assert(typeof options.context!.prePlugins![0] === 'object');
      options.context!.prePlugins![0].get('');
      options.context!.prePlugins![0].execPostHook();
      options.context!.prePlugins![0].execPreHook();
    });
  });
});
