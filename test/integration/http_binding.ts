import {deepStrictEqual} from 'assert';

import * as sinon from 'sinon';
import * as supertest from 'supertest';
import * as shell from 'shelljs';
import {cloneDeep, forEach, get, set} from 'lodash';

import {PluginStore} from '../../src/openfunction/plugin';
import {OpenFunctionRuntime} from '../../src/functions';
import {getServer} from '../../src/server';
import {getFunctionPlugins, getBuiltinPlugins} from '../../src/loader';
import {FUNCTION_STATUS_HEADER_FIELD} from '../../src/types';

import {Context, Payload} from '../data/mock';

const TEST_CONTEXT = {
  ...Context.KnativeBase,
  pluginsTracing: Context.TracerPluginBase,
};
const TEST_PAYLOAD = Payload.Plain.RAW;

describe('OpenFunction - HTTP Binding', () => {
  const APPID = 'http_dapr';

  before(done => {
    if (shell.exec('dapr', {silent: true}).code !== 0)
      throw new Error('Please ensure "dapr" is installed');

    if (shell.exec('docker', {silent: true}).code !== 0)
      throw new Error('Please ensure "docker" is installed');

    // Try to start up skywalking oap server docker container
    shell.exec(
      'docker run --name oap --rm -d -p 11800:11800 -p 12800:12800 apache/skywalking-oap-server:9.2.0',
      {silent: true}
    );

    // Try to run Dapr sidecar on port 3500 with components for testing
    shell.exec(
      `dapr run -H 3500 -G 50001 -d ./test/data/components/http -a ${APPID}`,
      {silent: true, async: true}
    );

    getFunctionPlugins(process.cwd() + '/test/data')
      .then(() => getBuiltinPlugins(TEST_CONTEXT))
      .then(() => {
        // FIXME: NEED wait quite a lot of time for oap server and dapr sidecar to bootup
        setTimeout(done, 30 * 1000);
      });
  });

  after(() => {
    // Stop skywalking oap server container
    shell.exec('docker stop oap', {silent: true});

    // Stop dapr sidecar process
    shell.exec(`dapr stop ${APPID}`, {silent: true});
  });

  beforeEach(() => {
    // Prevent log spew from the PubSub emulator request.
    sinon.stub(console, 'error');
  });
  afterEach(() => {
    (console.error as sinon.SinonSpy).restore();
  });

  const testData = [
    {name: 'Error data', operation: '', listable: false},
    {name: 'Save data', operation: 'create', listable: true},
    {name: 'Get data', operation: 'get', listable: true},
    {name: 'Delete data', operation: 'delete', listable: false},
  ];

  for (const test of testData) {
    it.skip(test.name, async () => {
      const context = cloneDeep(TEST_CONTEXT);
      context.prePlugins = context.postPlugins = ['ticktock'];
      context.postPlugins.push('sky-pathfinder');

      forEach(context.outputs, output =>
        set(output, 'operation', test.operation)
      );

      const server = getServer(
        async (ctx: OpenFunctionRuntime, data: {}) => {
          if (!test.operation) throw new Error('I crashed');

          await ctx.send(data);

          // FIXME: This makes server respond right away, even before post hooks
          ctx.res?.send(data);
        },
        'openfunction',
        context
      );

      await supertest(server)
        .post('/')
        .send(TEST_PAYLOAD)
        .expect(test.operation ? 200 : 500)
        // Assert HTTP response first
        .then(res => {
          if (!test.operation) {
            deepStrictEqual(
              res.headers[FUNCTION_STATUS_HEADER_FIELD.toLowerCase()],
              'error'
            );
          } else {
            deepStrictEqual(res.body, TEST_PAYLOAD);
          }
        })
        // Wait a few seconds for post hooks execution to complete
        .then(() => new Promise(r => setTimeout(r, 2000)))
        // Then assert user defined hooks are executed
        .then(() => {
          const tick = get(PluginStore.Instance().get('ticktock'), 'value');
          deepStrictEqual(tick, 0);
        })
        .then(() => {
          const sky = PluginStore.Instance().get('sky-pathfinder');
          const span = get(sky, 'span');

          deepStrictEqual(get(span, 'component'), 'OpenFunction');
          deepStrictEqual(get(span, 'layer'), 'FAAS');
          deepStrictEqual(get(span, 'isError'), !test.operation);
        });

      forEach(context.outputs, output => {
        const listable = shell.ls(output.metadata!.fileName).code === 0;
        deepStrictEqual(listable, test.listable);
      });
    });
  }
});
