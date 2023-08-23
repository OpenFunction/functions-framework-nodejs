module.exports = {
    async: {
      FUNC_CONTEXT: JSON.stringify({
        name: 'my-async-openfunction-pubsub-publisher-context',
        version: '1.0.0',
        runtime: 'async',
        inputs: {
          cron: {
            componentName: 'async-openfunction-pubsub-publisher-component-cron',
            componentType: 'bindings.cron',
          },
        },
        outputs: {
          kafka:{
            componentName: 'async-openfunction-pubsub-publisher-component-kafka',
            componentType: 'pubsub.kafka',
            uri: 'pubsub-topic'
          }
        },
      }),
    },
  };
  