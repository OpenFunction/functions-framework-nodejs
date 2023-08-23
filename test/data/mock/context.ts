import {
  OpenFunctionContext,
  TraceConfig,
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
  states: {
    // there is a policy, if you don't specify the state component, we will use the first one
    // or you need specify the state name, then the context will use the one you specify
    // hint : specify the name is the record key, not the component name
    postgreSQL: {
      componentName: 'mypg',
      componentType: 'state.postgresql',
    },
    mysql: {
      componentName: 'mymysql',
      componentType: 'state.mysql',
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
