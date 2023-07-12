module.exports = {
  knative: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'test-knative',
      version: '1.0.0',
      runtime: 'Knative',
      outputs: {
        fs: {
          componentName: 'local',
          componentType: 'bindings.localstorage',
          operation: 'list',
          metadata: {
            fileName: '.',
          },
        },
      },
      states: {
        // there is a policy, if you don't specify the state component, we will use the first one
        // or you need specify the state name, then the context will use the one you specify
        // hint : specify the name is the record key, not the component name
        redis: {
          componentName: 'myredis',
          componentType: 'state.redis',
        },
        mysql: {
          componentName: 'mymysql',
          componentType: 'state.mysql',
        },
      },
    }),
  },
  async: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'test-async',
      version: '1.0.0',
      runtime: 'Async',
      port: '8080',
      inputs: {
        cron: {
          uri: 'cron_input',
          componentName: 'binding-cron',
          componentType: 'bindings.cron',
        },
      },
      states: {
        // there is a policy, if you don't specify the state component, we will use the first one
        // or you need specify the state name, then the context will use the one you specify
        // hint : specify the name is the record key, not the component name
        redis: {
          componentName: 'myredis',
          componentType: 'state.redis',
        },
        mysql: {
          componentName: 'mymysql',
          componentType: 'state.mysql',
        },
      },
    }),
  },
};
