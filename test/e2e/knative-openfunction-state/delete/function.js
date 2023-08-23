async function tryKnativeStateDelete(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  await ctx.state
    .delete(data)
    .then(res => {
      console.log('✅ Success delete');
      console.log(JSON.stringify(res));
    })
    .catch(err => {
      console.log('❌ Failure occurred: %o', err);
    });
}

module.exports = {
  tryKnativeStateDelete,
};
