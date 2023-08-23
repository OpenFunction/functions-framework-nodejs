async function writeAsyncPubsubPublisher(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  const msg = {
    Hello: 'Openfunction-Nodejs-Async-Openfunction-Pubsub',
  };
  await ctx.send(msg, 'kafka');
}

module.exports = {
  writeAsyncPubsubPublisher,
};
