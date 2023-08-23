module.exports = {
  knative: {
    FUNC_CONTEXT: JSON.stringify({
      name: 'my-knative-openfunction-pubsub-context',
      version: '1.0.0',
      runtime: 'knative',
      outputs: {
        kafka: {
          componentName: 'knative-openfunction-pubsub-component',
          componentType: 'pubsub.kafka',
          uri: 'create',
        },
      },
    }),
  },
};
