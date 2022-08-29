import {deepStrictEqual, ifError, ok} from 'assert';
import {createServer} from 'net';

import {fill, get, isEmpty} from 'lodash';
import * as shell from 'shelljs';
import * as MQTT from 'aedes';

import getAysncServer from '../../src/openfunction/async_server';
import {getFunctionPlugins} from '../../src/loader';
import {FrameworkOptions} from '../../src/options';

import {Context, Payload} from '../data/mock';

const TEST_CONTEXT = Context.AsyncBase;
const TEST_PAYLOAD = Payload.Plain.RAW;
const TEST_PAYLOAD_CE = Payload.Plain.CE;

describe('OpenFunction - Async', () => {
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
    const app = getAysncServer(
      (ctx, data) => {
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
      },

      TEST_CONTEXT
    );

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
    const app = getAysncServer(
      (ctx, data) => {
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
      },

      TEST_CONTEXT
    );

    // First, we start the async server
    app.start().then(() => {
      // Then, we send a cloudevent format message to server
      broker.publish(
        {
          cmd: 'publish',
          topic: TEST_CONTEXT.inputs!.mqtt_sub.uri!,
          payload: JSON.stringify(TEST_PAYLOAD_CE),
          qos: 0,
          retain: false,
          dup: false,
        },
        err => ifError(err)
      );
    });
  });

  it('mqtt binding w/ custom plugins', done => {
    getFunctionPlugins({
      sourceLocation: process.cwd() + '/test/data',
    } as FrameworkOptions).then(plugins => {
      const start = get(plugins!.numbers, 'oct');

      const app = getAysncServer(
        (ctx, data) => {
          // Assert that user function receives correct data from input binding
          deepStrictEqual(get(data, 'start'), start);

          // Set local data for post hook plugin
          ctx.locals.start = start;
          ctx.locals.end = -start;

          // Passthrough test done handler
          ctx.locals.done = done;
        },
        {
          ...TEST_CONTEXT,
          prePlugins: ['countdown'],
          postPlugins: fill(Array(start), 'countdown'),
        }
      );

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
