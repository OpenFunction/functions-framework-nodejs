async function tryKnativeStateGetBulk(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  await ctx.state
    .getBulk(data)
    .then(res => {
      console.log('✅ Success getBulk');
      console.log(JSON.stringify(res));
    })
    .catch(err => {
      console.log('❌ Failure occurred: %o', err);
    });
}

module.exports = {
  tryKnativeStateGetBulk,
};
