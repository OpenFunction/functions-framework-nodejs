import {deepStrictEqual} from 'assert';

import * as sinon from 'sinon';
import * as supertest from 'supertest';
import * as shell from 'shelljs';
import {cloneDeep, forEach, get, set} from 'lodash';

import {PluginStore} from '../../src/openfunction/plugin';
import {OpenFunctionRuntime} from '../../src/functions';
import {getServer} from '../../src/server';
import {getFunctionPlugins} from '../../src/loader';
import {FUNCTION_STATUS_HEADER_FIELD} from '../../src/types';

import {Context, Payload} from '../data/mock';

const TEST_CONTEXT = Context.KnativeBase;
const TEST_PAYLOAD = Payload.Plain.RAW;

describe('OpenFunction - HTTP Binding', () => {
  const APPID = 'http.dapr';

  before(done => {
    if (shell.exec('dapr', {silent: true}).code !== 0)
      throw new Error('Please ensure "dapr" is installed');

    // Try to run Dapr sidecar on port 3500 with components for testing
    shell.exec(
      `dapr run -H 3500 -G 50001 -d ./test/data/components/http -a ${APPID}`,
      {
        silent: true,
        async: true,
      }
    );

    getFunctionPlugins(process.cwd() + '/test/data').then(() => {
      // Wait 5 seconds for dapr sidecar to start
      setTimeout(done, 5000);
    });
  });

  after(() => {
    // Stop dapr sidecar process
    shell.exec(`dapr stop ${APPID}`, {
      silent: true,
    });
  });

  beforeEach(() => {
    // Prevent log spew from the PubSub emulator request.
    sinon.stub(console, 'error');
  });
  afterEach(() => {
    (console.error as sinon.SinonSpy).restore();
  });

  const testData = [
    {name: 'Save data', operation: 'create', listable: true},
    {name: 'Get data', operation: 'get', listable: true},
    {name: 'Delete data', operation: 'delete', listable: false},
    {name: 'Error data', operation: '', listable: false},
  ];

  testData.forEach(test => {
    it(test.name, async () => {
      const context = cloneDeep(TEST_CONTEXT);
      context.prePlugins = context.postPlugins = ['ticktock'];
      forEach(context.outputs, output =>
        set(output, 'operation', test.operation)
      );

      const server = getServer(
        async (ctx: OpenFunctionRuntime, data: {}) => {
          if (!test.operation) throw new Error('I crashed');

          await ctx.send(data);
          ctx.res?.send(data);
        },
        'openfunction',
        context
      );

      await supertest(server)
        .post('/')
        .send(TEST_PAYLOAD)
        .expect(test.operation ? 200 : 500)
        .expect(res => {
          const tick = get(PluginStore.Instance().get('ticktock'), 'value');
          if (!test.operation) {
            deepStrictEqual(
              res.headers[FUNCTION_STATUS_HEADER_FIELD.toLowerCase()],
              'error'
            );
            deepStrictEqual(tick, 1);
          } else {
            deepStrictEqual(res.body, TEST_PAYLOAD);
            deepStrictEqual(tick, 0);
          }
        });

      forEach(context.outputs, output => {
        const listable = shell.ls(output.metadata!.fileName).code === 0;
        deepStrictEqual(listable, test.listable);
      });
    });
  });
});
