import {deepStrictEqual} from 'assert';

import * as sinon from 'sinon';
import * as supertest from 'supertest';
import * as shell from 'shelljs';
import {cloneDeep} from 'lodash';

import {OpenFunctionRuntime} from '../../src/functions';
import {FUNCTION_STATUS_HEADER_FIELD} from '../../src/types';
import {getServer} from '../../src/server';
import {KeyValueType} from '@dapr/dapr/types/KeyValue.type';

import {Context, StateStore} from '../data/mock';

const TEST_CONTEXT = {
  ...Context.KnativeBase,
};

const TEST_STATESTORE_SAVE = StateStore.Plain.Save;
const TEST_STATESTORE_GET = StateStore.Plain.Get;
const TEST_STATESTORE_BULK = StateStore.Plain.GetBulk;
const TEST_STATESTORE_DELETE = StateStore.Plain.Delete;
const TEST_STATESTORE_TRANSACTION = StateStore.Plain.Transaction;
const TEST_STATESTORE_QUERY = StateStore.Plain.Query;

describe('OpenFunction - HTTP StateStore', () => {
  const APPID = 'http_statestore';

  before(() => {
    if (shell.exec('dapr', {silent: true}).code !== 0)
      throw new Error('Please ensure "dapr" is installed');

    if (shell.exec('docker', {silent: true}).code !== 0)
      throw new Error('Please ensure "docker" is installed');

    // Try to start up redis docker container
    shell.exec(
      // 'docker run --name myredis --rm -d -p 6379:6379 redis:latest',
      'docker run --name myredis --rm -d -p 6379:6379 redis/redis-stack-server:latest',
      {
        silent: true,
      }
    );

    // Try to run Dapr sidecar on port 3500 with components for testing
    shell.exec(
      `dapr run -H 3500 -G 50001 -d ./test/data/components/state -a ${APPID}`,
      {silent: true, async: true}
    );
  });

  after(() => {
    // Stop redis container
    shell.exec('docker stop myredis', {silent: true});
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
    {
      name: 'Save data',
      tosend: TEST_STATESTORE_SAVE,
      operation: 'save',
      expect: undefined,
    },
    {
      name: 'Get data',
      operation: 'get',
      tosend: TEST_STATESTORE_GET,
      expect: 'DeathStar',
    },
    {
      name: 'GetBulk data',
      operation: 'getbulk',
      tosend: TEST_STATESTORE_BULK,
      expect: [
        {
          key: 'weapon',
          data: 'DeathStar',
        },
        {
          key: 'planet',
          data: {name: 'Tatooine'},
        },
      ],
    },
    {
      name: 'Delete data',
      operation: 'delete',
      tosend: TEST_STATESTORE_DELETE,
      expect: undefined,
    },
    {
      name: 'Transcation data',
      operation: 'transaction',
      tosend: TEST_STATESTORE_TRANSACTION,
      expect: undefined,
    },
    {
      name: 'Query data',
      operation: 'query',
      tosend: TEST_STATESTORE_QUERY,
      // expect: undefined,
    },
  ];
  for (const test of testData) {
    it(test.name, async () => {
      const context = cloneDeep(TEST_CONTEXT);
      // test the ouput of the state sotre
      const server = getServer(
        async (ctx: OpenFunctionRuntime, data: {}) => {
          if (!test.operation) throw new Error('I crashed');
          switch (test.operation) {
            case 'save':
              await ctx.state
                .save(data, 'redis')
                .then(res => {
                  deepStrictEqual(res, test.expect);
                })
                .catch(err => {
                  console.log(err);
                });
              break;
            case 'get':
              await ctx.state
                .get(data, 'redis')
                .then(res => {
                  deepStrictEqual(res, test.expect);
                })
                .catch(err => {
                  console.log(err);
                });
              break;
            case 'getbulk':
              await ctx.state
                .getBulk(data, 'redis')
                .then(res => {
                  const promise_data_remove_etag = res.map(obj => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const {etag, ...rest} = obj;
                    return rest;
                  });
                  deepStrictEqual(promise_data_remove_etag, test.expect);
                })
                .catch(err => {
                  console.log(err);
                });
              break;
            case 'delete':
              await ctx.state
                .delete(data, 'redis')
                .then(res => {
                  deepStrictEqual(res, test.expect);
                })
                .catch(err => {
                  console.log(err);
                });
              break;
            case 'transaction':
              await ctx.state
                .transaction(data, 'redis')
                .then(res => {
                  deepStrictEqual(res, test.expect);
                })
                .catch(err => {
                  console.log(err);
                });
              break;
            case 'query':
              await ctx.state
                .query(data, 'redis')
                .then(res => {
                  console.log(res);
                  // deepStrictEqual(Object.values(res)[0].value, test.expect);
                })
                .catch(err => {
                  console.log(err);
                });
              break;
            default:
              throw new Error(`Unknown operation: ${test.operation}`);
          }
          // FIXME: This makes server respond right away, even before post hooks
          ctx.res?.send(data);
        },
        'openfunction',
        context
      );

      await supertest(server)
        .post('/')
        .send(test.tosend)
        .expect(test.operation ? 200 : 500)
        // Assert HTTP response first
        .then(res => {
          if (!test.operation) {
            deepStrictEqual(
              res.headers[FUNCTION_STATUS_HEADER_FIELD.toLowerCase()],
              'error'
            );
          } else {
            deepStrictEqual(res.body, test.tosend);
          }
        });
    });
  }
});
