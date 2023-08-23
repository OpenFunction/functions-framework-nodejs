async function tryKnativeStateTransaction(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  await ctx.state
    .transaction(data)
    .then(res => {
      console.log('✅ Success transaction');
      console.log(JSON.stringify(res));
    })
    .catch(err => {
      console.log('❌ Failure occurred: %o', err);
    });
}

module.exports = {
  tryKnativeStateTransaction,
};
