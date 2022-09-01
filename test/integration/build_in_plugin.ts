import {ifError, notStrictEqual, deepStrictEqual, ok} from 'assert';
import {createServer} from 'net';
import {execSync} from 'child_process';

import {get} from 'lodash';
import * as shell from 'shelljs';
import * as MQTT from 'aedes';
import fetch from 'node-fetch';

import {FrameworkOptions} from '../../src/options';
import {SKYWALKINGNAME} from '../../src/openfunction/plugin/skywalking/skywalking';
import {PluginStore} from '../../src/openfunction/plugin';
import {OpenFunctionRuntime} from '../../src/openfunction/runtime';
import {OpenFunctionContext} from '../../src/openfunction/context';
import getAysncServer from '../../src/openfunction/async_server';
import {getFunctionPlugins, loadBuidInPlugins} from '../../src/loader';

import {Context} from '../data/mock';

const TEST_CONTEXT = Context.AsyncBase;

export const OapServer = '127.0.0.1:12800';

export const sleep = (val: number) => {
  return new Promise(resolve => setTimeout(resolve, val));
};

export const query = async (traceId: string, url: string) => {
  const body = {
    query: `query queryTrace($traceId: ID!) {
          trace: queryTrace(traceId: $traceId) {
                spans {
                        traceId
                        segmentId
                        spanId
                        parentSpanId
                        refs {
                              traceId
                              parentSegmentId
                              parentSpanId
                              type
                              }
                        serviceCode
                        startTime
                        endTime
                        endpointName
                        type
                        peer
                        component
                        isError
                        layer
                        tags {
                          key
                          value
                        }
                        logs {
                          time
                          data {
                            key
                            value
                          }
                        }
                      }
                    }
                  }`,
    variables: {
      traceId,
    },
  };
  return await fetch(`http://${url}/graphql`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

//Verify skywalking proccess , start it if not exist
export const checkSkyWalkingProcess = async (
  reCheck: boolean
): Promise<boolean> => {
  try {
    const buffer = execSync('docker ps -a').toString();

    let flag = false;
    for (const line of buffer.split('\n')) {
      if (line.indexOf('apache/skywalking-oap-server:8.4.0-es6') !== -1) {
        if (line.indexOf('Up') !== -1) {
          console.log('skywalking oap server is start');
          flag = true;
        } else if (line.indexOf('Exited') !== -1) {
          console.log('skywalking oap server is stop , now start it ');
          console.log(
            execSync('docker start ' + line.substring(0, 13)).toString()
          );
          flag = true;
        }
        break;
      }
    }
    if (!flag) {
      const startCmd =
        'docker run -d --name oap -p 12800:12800 -p 11800:11800 apache/skywalking-oap-server:8.4.0-es6';
      execSync(startCmd);
      console.log(startCmd);
      return reCheck ? false : checkSkyWalkingProcess(true);
    }
  } catch (error) {
    console.log('start fail');
    return false;
  }
  return true;
};
describe('Build in plugin', () => {
  const APPID = 'async.dapr';
  const broker = MQTT.Server();
  const server = createServer(broker.handle);
  before(done => {
    // Start simple plain MQTT server via aedes
    server.listen(1883, () => {
      // Try to run Dapr sidecar and listen for the async server
      shell.exec(
        `dapr run -H 3500 -G 50001 -p ${TEST_CONTEXT.port} -d ./test/data/components/async -a ${APPID} --log-level debug`,
        {
          silent: true,
          async: true,
        }
      );
      done();
    });
  });

  after(done => {
    // Stop dapr sidecar process
    shell.exec(`dapr stop ${APPID}`, {
      silent: true,
    });
    server.close();
    broker.close(done);
  });

  it('mqtt binding w/ skywalking plugin', done => {
    const options: FrameworkOptions = {
      target: 'test',
      port: '',
      sourceLocation: '',
      signatureType: 'http',
      printHelp: false,
      context: {
        ...TEST_CONTEXT,
        tracing: {
          enabled: true,
        },
        prePlugins: ['assist'],
        postPlugins: ['assist'],
      },
    };
    getFunctionPlugins(process.cwd() + '/test/data').then(plugins => {
      loadBuidInPlugins(options).then(() => {
        const start = get(plugins!.numbers, 'oct');

        const app = getAysncServer((ctx, data) => {
          notStrictEqual(ctx.locals.traceId, null || undefined);
          // Passthrough test done handler
          ctx.locals.done = done;
          ctx.locals.app = app;
          ctx.locals.options = options;
          ctx.send({some: 'payload'});
        }, options.context!);

        // First, we start the async server
        app.start().then(() => {
          // Then, we send a number as start value to user function
          broker.publish(
            {
              cmd: 'publish',
              topic: 'default',
              payload: JSON.stringify({start}),
              qos: 0,
              retain: false,
              dup: false,
            },
            err => ifError(err)
          );
        });
      });
    });
  });

  it('skywalking plugin', async () => {
    const options = {
      target: 'test',
      context: {
        ...TEST_CONTEXT,
        tracing: {
          enabled: true,
        },
      },
    };
    ok((await checkSkyWalkingProcess(false)) === true);
    await loadBuidInPlugins(options as FrameworkOptions);
    const skywalking = PluginStore.Instance(1).get(SKYWALKINGNAME);
    ok(skywalking.name === SKYWALKINGNAME);

    const runtime = OpenFunctionRuntime.ProxyContext(
      options.context as OpenFunctionContext
    );
    await skywalking.execPreHook(runtime, {});
    const traceId = runtime.locals.traceId;
    await sleep(2000);
    await skywalking.execPostHook(runtime, {});
    console.log(traceId);
    const response = query(traceId, OapServer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await (await response).json()) as any;
    console.log(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target: unknown | any = null;
    for (const item of data.data.trace.spans) {
      console.log(item.serviceCode);
      if (item.endpointName === `/${options.target}`) {
        target = item;
      }
    }
    notStrictEqual(target, null);
    deepStrictEqual(target.endpointName, `/${options.target}`);

    const ms = target.endTime - target.startTime;
    ok(ms >= 2000);
    ok(ms <= 3000);
    for (const tag in target.tags) {
      if (tag === 'RuntimeType') {
        ok(target.tags[tag] === options.context.runtime);
      }
    }
  });
});
