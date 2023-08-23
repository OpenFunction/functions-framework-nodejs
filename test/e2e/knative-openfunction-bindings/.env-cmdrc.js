module.exports = {
  knative: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'my-knative-openfunction-bindings-context',
      version: '1.0.0',
      runtime: 'knative',
      outputs: {
        kafka: {
          componentName: 'knative-openfunction-bindings-component',
          componentType: 'bindings.kafka',
          operation: 'create',
        },
        kafka: {
          componentName: 'knative-openfunction-bindings-component',
          componentType: 'bindings.kafka',
          operation: 'get',
        },
      },
    }),
  },
};
