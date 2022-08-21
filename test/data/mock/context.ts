import {OpenFunctionContext} from '../../../src';

export const KnativeBase: OpenFunctionContext = {
  name: 'test-context',
  version: '1.0.0',
  runtime: 'Knative',
  outputs: {
    file1: {
      componentName: 'local',
      componentType: 'bindings.localstorage',
      metadata: {
        fileName: 'my-file1.txt',
      },
    },
    file2: {
      componentName: 'local',
      componentType: 'bindings.localstorage',
      metadata: {
        fileName: 'my-file2.txt',
      },
    },
  },
};

export const AsyncBase: OpenFunctionContext = {
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
