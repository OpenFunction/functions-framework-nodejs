module.exports = {
  async: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'my-async-openfunction-bindings-target-context',
      version: '1.0.0',
      runtime: 'async',
      inputs: {
        kafka: {
          componentName: 'async-openfunction-bindings-target-component-kafka',
          componentType: 'bindings.kafka',
        },
      },
    }),
  },
};
