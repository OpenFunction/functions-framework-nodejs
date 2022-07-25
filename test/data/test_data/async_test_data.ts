import {OpenFunctionContext} from '../../../src';
import {FrameworkOptions} from '../../../src/options';

export const TEST_CONTEXT: OpenFunctionContext = {
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

export const TEST_PAYLOAD = {data: 'hello world'};

export const TEST_CLOUD_EVENT = {
  specversion: '1.0',
  id: 'test-1234-1234',
  type: 'ce.openfunction',
  source: 'https://github.com/OpenFunction/functions-framework-nodejs',
  traceparent: '00-65088630f09e0a5359677a7429456db7-97f23477fb2bf5ec-01',
  data: TEST_PAYLOAD,
};

export const TEST_PLUGIN_OPTIONS: FrameworkOptions = {
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
