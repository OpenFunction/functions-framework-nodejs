/* eslint-disable no-restricted-properties */
import {deepStrictEqual, ifError, ok} from 'assert';
import {createServer} from 'net';

import {get, isEmpty} from 'lodash';
import * as shell from 'shelljs';
import * as MQTT from 'aedes';

import {OpenFunctionContext} from '../../src/openfunction/function_context';
import getAysncServer from '../../src/openfunction/async_server';

const TEST_CONTEXT: OpenFunctionContext = {
  name: 'test-context',
  version: '1.0.0',
  runtime: 'Async',
  port: '8080',
  inputs: {
    cron: {
      uri: 'cron_input',
      componentName: 'binding-cron',
      componentType: 'bindings.cron',
    },
    mqtt_binding: {
      uri: 'default',
      componentName: 'binding-mqtt',
      componentType: 'bindings.mqtt',
    },
    mqtt_sub: {
      uri: 'webup',
      componentName: 'pubsub-mqtt',
      componentType: 'pubsub.mqtt',
    },
  },
  outputs: {
    cron: {
      uri: 'cron_output',
      operation: 'delete',
      componentName: 'binding-cron',
      componentType: 'bindings.cron',
    },
    localfs: {
      uri: 'localstorage',
      operation: 'create',
      componentName: 'binding-localfs',
      componentType: 'bindings.localstorage',
      metadata: {
        fileName: 'output-file.txt',
      },
    },
    mqtt_pub: {
      uri: 'webup_pub',
      componentName: 'pubsub-mqtt',
      componentType: 'pubsub.mqtt',
    },
  },
};

const TEST_PAYLOAD = {data: 'hello world'};
const TEST_CLOUD_EVENT = {
  specversion: '1.0',
  id: 'test-1234-1234',
  type: 'ce.openfunction',
  source: 'https://github.com/OpenFunction/functions-framework-nodejs',
  traceparent: '00-65088630f09e0a5359677a7429456db7-97f23477fb2bf5ec-01',
  data: TEST_PAYLOAD,
};

describe('OpenFunction - Async - Binding', () => {
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

  it('stop cron after first trigger recived', done => {
    const app = getAysncServer((ctx, data) => {
      // Assert that user function receives data from input binding
      ok(data);

      // Assert that context data was passed through
      deepStrictEqual(get(ctx, 'runtime'), TEST_CONTEXT.runtime);
      deepStrictEqual(
        get(ctx, 'inputs.cron.uri'),
        TEST_CONTEXT.inputs!.cron.uri
      );

      // Then stop the cron scheduler
      ctx.send({}, 'cron').then(() => app.stop().finally(done));
    }, TEST_CONTEXT);

    app.start();
  });

  it('mqtt binding w/ file output', done => {
    const app = getAysncServer((ctx, data) => {
      // Assert that user function receives correct data from input binding
      deepStrictEqual(data, TEST_PAYLOAD);

      // Then write recived data to a local file
      ctx.send(data, 'localfs').then(() => {
        const file = TEST_CONTEXT.outputs!.localfs.metadata!.fileName;
        // Assert that the file is created
        deepStrictEqual(shell.ls(file).code, 0);

        shell.rm(file);
        app.stop().finally(done);
      });
    }, TEST_CONTEXT);

    // First, we start the async server
    app.start().then(() => {
      // Then, we send a message to the async server
      broker.publish(
        {
          cmd: 'publish',
          topic: 'default',
          payload: JSON.stringify(TEST_PAYLOAD),
          qos: 1,
          retain: false,
          dup: false,
        },
        err => ifError(err)
      );
    });
  });

  it('mqtt sub w/ pub output', done => {
    const app = getAysncServer((ctx, data) => {
      if (isEmpty(data)) return;

      // Assert that user function receives correct data from input binding
      deepStrictEqual(data, TEST_PAYLOAD);

      // Then forward received data to output channel
      const output = 'mqtt_pub';
      broker.subscribe(
        get(TEST_CONTEXT, `outputs.${output}.uri`),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (packet, _) => {
          const payload = JSON.parse(Buffer.from(packet.payload).toString());
          deepStrictEqual(payload.data, TEST_PAYLOAD);
          app.stop().finally(done);
        },
        () => {
          ctx.send(TEST_PAYLOAD, output);
        }
      );
    }, TEST_CONTEXT);

    // First, we start the async server
    app.start().then(() => {
      // Then, we send a cloudevent format message to server
      broker.publish(
        {
          cmd: 'publish',
          topic: TEST_CONTEXT.inputs!.mqtt_sub.uri!,
          payload: JSON.stringify(TEST_CLOUD_EVENT),
          qos: 0,
          retain: false,
          dup: false,
        },
        err => ifError(err)
      );
    });
  });
});
