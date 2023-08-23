async function tryKnativeStateGet(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  await ctx.state
    .get(data)
    .then(res => {
      console.log('✅ Success get');
      console.log(JSON.stringify(res));
    })
    .catch(err => {
      console.log('❌ Failure occurred: %o', err);
    });
}

module.exports = {
  tryKnativeStateGet,
};
