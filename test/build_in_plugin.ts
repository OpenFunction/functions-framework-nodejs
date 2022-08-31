import * as assert from 'assert';
import {createConnection} from 'net';
import axios from 'axios';

import {loadBuidInPlugins} from '../src/loader';
import {OpenFunctionContext} from '../src/openfunction/context';
import {PluginStore} from '../src/openfunction/plugin';
import {SKYWALKINGNAME} from '../src/openfunction/plugin/skywalking/skywalking';
import {OpenFunctionRuntime} from '../src/openfunction/runtime';
import {FrameworkOptions} from '../src/options';

import {Context} from './data/mock';

const TEST_CONTEXT = Context.AsyncBase;

const sleep = (val: number) => {
  return new Promise(resolve => setTimeout(resolve, val));
};

const query = async (traceId: string, url: string) => {
  return await axios.post(`http://${url}/graphql`, {
    query:
      'query queryTrace($traceId: ID!) {\n  trace: queryTrace(traceId: $traceId) {\n    spans {\n      traceId\n      segmentId\n      spanId\n      parentSpanId\n      refs {\n        traceId\n        parentSegmentId\n        parentSpanId\n        type\n      }\n      serviceCode\n      startTime\n      endTime\n      endpointName\n      type\n      peer\n      component\n      isError\n      layer\n      tags {\n        key\n        value\n      }\n      logs {\n        time\n        data {\n          key\n          value\n        }\n      }\n    }\n  }\n  }',
    variables: {
      traceId,
    },
  });
};

const checkConnection = (host: string, port: number, timeout: number) => {
  return new Promise<void>((resolve, reject) => {
    timeout = timeout || 10000; // default of 10 seconds
    const timer = setTimeout(() => {
      reject('timeout');
      socket.end();
    }, timeout);
    // eslint-disable-next-line no-var
    var socket = createConnection(port, host, () => {
      clearTimeout(timer);
      resolve();
      socket.end();
    });
    socket.on('error', (err: any) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};
export const check = async () => {
  try {
    await checkConnection('127.0.0.1', 8081, 3000);
  } catch (error) {
    console.warn('127.0.0.1:8088 has no server');
    return false;
  }
  return true;
};

const UIServer = '127.0.0.1:8088';

describe('BuildIn plugin', () => {
  const options = {
    target: 'test',
    context: {
      ...TEST_CONTEXT,
      tracing: {
        enabled: true,
      },
    },
  };

  it('skywalking plugin', async () => {
    if (!check()) {
      return;
    }
    await loadBuidInPlugins(options as FrameworkOptions);
    const skywalking = PluginStore.Instance(1).get(SKYWALKINGNAME);
    assert(skywalking.name === SKYWALKINGNAME);

    const runtime = OpenFunctionRuntime.ProxyContext(
      options.context as OpenFunctionContext
    );
    await skywalking.execPreHook(runtime, {});
    const traceId = runtime.locals.traceId;
    await sleep(2000);
    await skywalking.execPostHook(runtime, {});
    console.log(traceId);
    const response = query(traceId, UIServer);
    const data = (await response).data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: unknown | any = null;
    for (const item of data.data.trace.spans) {
      console.log(item.serviceCode);
      if (item.endpointName === `/${options.target}`) {
        target = item;
      }
    }
    assert(target !== null);
    assert(target.endpointName === `/${options.target}`);

    const ms = target.endTime - target.startTime;
    assert(ms >= 2000);
    assert(ms <= 3000);
    for (const tag in target.tags) {
      if (tag === 'RuntimeType') {
        assert(target.tags[tag] === options.context.runtime);
      }
    }
  });
});
