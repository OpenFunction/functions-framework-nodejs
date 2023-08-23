module.exports = {
  async: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'my-async-openfunction-bindings-sender-context',
      version: '1.0.0',
      runtime: 'async',
      inputs: {
        cron: {
          componentName: 'async-openfunction-bindings-sender-component-cron',
          componentType: 'bindings.cron',
        },
      },
      outputs: {
        kafka:{
          componentName: 'async-openfunction-bindings-sender-component-kafka',
          componentType: 'bindings.kafka',
          operation: 'create'
        }
      },
    }),
  },
};
