module.exports = {
    async: {
      FUNC_CONTEXT: JSON.stringify({
        name: 'my-async-openfunction-pubsub-subscriber-context',
        version: '1.0.0',
        runtime: 'async',
        inputs: {
          kafka: {
            componentName: 'async-openfunction-pubsub-subscriber-component-kafka',
            componentType: 'pubsub.kafka',
            uri: 'pubsub-topic',
          },
        },
      }),
    },
  };
  