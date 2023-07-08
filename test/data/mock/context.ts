import {
  OpenFunctionContext,
  TraceConfig,
  ComponentSpec,
} from '../../../src/openfunction/context';

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

export const TracerPluginBase: TraceConfig = {
  enabled: true,
  provider: {
    name: 'skywalking',
    oapServer: 'localhost:11800',
  },
  tags: {
    tag1: 'value1',
    tag2: 'value2',
  },
  baggage: {
    key: 'key1',
    value: 'value1',
  },
};

export const StateStoreBase: Record<string, ComponentSpec> = {
  redis: {
    type: 'state.redis',
    version: 'v1',
    metadata: {
      redisHost: 'localhost:6379',
      redisPassword: '',
    },
  },
  // mysql: {
  //   type: 'state.mysql',
  //   version: 'v1',
  //   metadata: {
  //     connectionString: '<CONNECTION STRING>',
  //     schemaName: '<SCHEMA NAME>',
  //     tableName: '<TABLE NAME>',
  //     timeoutInSeconds: '30',
  //     // Required if pemContents not provided. Path to pem file.
  //     pemPath: '<PEM PATH>',
  //     // Required if pemPath not provided. Pem value
  //     pemContents: '<PEM CONTENTS>',
  //   },
  // },
};
