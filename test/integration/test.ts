/* eslint-disable no-restricted-properties */
import {deepStrictEqual, ifError, ok} from 'assert';
import {createServer} from 'net';

import {get, isEmpty} from 'lodash';
import * as shell from 'shelljs';
import * as MQTT from 'aedes';

import {OpenFunctionContext} from '../../src/openfunction/function_context';
import getAysncServer from '../../src/openfunction/async_server';
import {getUserPlugins} from '../../src/loader';
import {FrameworkOptions} from '../../src/options';
import assert = require('assert');

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
const TEST_PLUGIN_OPTIONS: FrameworkOptions = {
  port: '',
  target: '',
  sourceLocation: process.cwd() + '/test/data',
  signatureType: 'event',
  printHelp: false,
  context: {
    name: 'test-context-plugin',
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
    prePlugins: ['demo-plugin'],
    postPlugins: ['demo-plugin'],
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

describe('OpenFunction - Async - Binding with plugin', () => {
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

  it('mqtt sub w/ pub output with demo plugin', done => {
    const app = getAysncServer((ctx, data) => {
      if (isEmpty(data)) return;

      const context: any = ctx as any;
      assert(context['pre'] === 'pre-exec');
      context['pre'] = 'main-exec';

      // Assert that user function receives correct data from input binding
      deepStrictEqual(data, TEST_PAYLOAD);
      console.log(data);
      // Then forward received data to output channel
      const output = 'mqtt_pub';
      broker.subscribe(
        get(TEST_PLUGIN_OPTIONS.context!, `outputs.${output}.uri`),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (packet, _) => {
          const payload = JSON.parse(Buffer.from(packet.payload).toString());
          deepStrictEqual(payload.data, TEST_PAYLOAD);
          app
            .stop()
            .then(() => {
              assert(context['pre'] === 'main-exec');
              assert(context['post'] === 'post-exec');
            })
            .finally(done);
        },
        () => {
          ctx.send(TEST_PAYLOAD, output);
        }
      );
    }, TEST_PLUGIN_OPTIONS.context!);

    // First, we start the async server
    app.start().then(async () => {
      await getUserPlugins(TEST_PLUGIN_OPTIONS);
      console.log(TEST_PLUGIN_OPTIONS);
      // Then, we send a cloudevent format message to server
      broker.publish(
        {
          cmd: 'publish',
          topic: TEST_PLUGIN_OPTIONS.context!.inputs!.mqtt_sub.uri!,
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
