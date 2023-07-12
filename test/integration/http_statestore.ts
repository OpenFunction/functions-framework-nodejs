import {deepStrictEqual} from 'assert';

import * as sinon from 'sinon';
import * as supertest from 'supertest';
import * as shell from 'shelljs';
import {cloneDeep, map, omit} from 'lodash';

import {OpenFunctionRuntime} from '../../src/functions';
import {FUNCTION_STATUS_HEADER_FIELD} from '../../src/types';
import {getServer} from '../../src/server';
import {StateOperations} from '../../src/openfunction/runtime';

import {Context, Payload} from '../data/mock';
import {KeyValueType} from '@dapr/dapr/types/KeyValue.type';

const TEST_CONTEXT = {
  ...Context.KnativeBase,
};

const TEST_STATESTORE_SAVE = Payload.Plain.State!.Save;
const TEST_STATESTORE_GET = Payload.Plain.State!.Get;
const TEST_STATESTORE_BULK = Payload.Plain.State!.GetBulk;
const TEST_STATESTORE_DELETE = Payload.Plain.State!.Delete;
const TEST_STATESTORE_TRANSACTION = Payload.Plain.State!.Transaction;
const TEST_STATESTORE_QUERY = Payload.Plain.State!.Query;

type StateOperation = keyof StateOperations;

describe('OpenFunction - HTTP StateStore', () => {
  const APPID = 'http_statestore';

  before(() => {
    if (shell.exec('dapr', {silent: true}).code !== 0)
      throw new Error('Please ensure "dapr" is installed');

    if (shell.exec('docker', {silent: true}).code !== 0)
      throw new Error('Please ensure "docker" is installed');

    // Try to start up redis docker container
    shell.exec(
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
      expect: {
        city: 'Seattle',
        person: {
          id: 1036,
          org: 'Dev Ops',
        },
        state: 'WA',
      },
    },
    {
      name: 'GetBulk data',
      operation: 'getBulk',
      tosend: TEST_STATESTORE_BULK,
      expect: [
        {
          data: {
            city: 'Seattle',
            person: {
              id: 1036,
              org: 'Dev Ops',
            },
            state: 'WA',
          },
          key: '1',
        },
        {
          data: {
            city: 'Portland',
            person: {
              id: 1028,
              org: 'Hardware',
            },
            state: 'OR',
          },
          key: '2',
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

          await ctx.state[test.operation as StateOperation](data)
            .then(res => {
              if (test.operation === 'getBulk') {
                res = map(res as KeyValueType[], obj => omit(obj, 'etag'));
              }
              // todo: query still have some problems
              if (test.operation === 'query') {
                console.log(res);
              }
              deepStrictEqual(res, test.expect);
            })
            .catch(err => {
              console.log(err);
            });
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
