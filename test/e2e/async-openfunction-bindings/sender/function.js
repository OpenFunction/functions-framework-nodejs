async function writeAsyncBindingsSender(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  const msg = {
    Hello: 'Openfunction-Nodejs-Async-Openfunction-Bindings',
  };
  await ctx.send(msg, 'kafka');
}

module.exports = {
  writeAsyncBindingsSender,
};
