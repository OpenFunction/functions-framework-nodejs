module.exports = {
  knative: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'openfunction-plugins-context',
      version: '1.0.0',
      runtime: 'knative',
      states: {
        // there is a policy, if you don't specify the state component, we will use the first one
        // or you need specify the state name, then the context will use the one you specify
        // hint : specify the name is the record key, not the component name
        pg: {
          componentName: 'pg',
          componentType: 'state.postgresql',
        },
      },
      pluginsTracing: {
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
      }
    }),
  },
};
