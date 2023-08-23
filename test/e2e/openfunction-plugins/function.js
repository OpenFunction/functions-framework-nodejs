async function writeSkywalkingLocalBindings(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  await ctx.state
    .save(data)
    .then(res => {
      console.log('✅ Success query');
      console.log(JSON.stringify(res));
    })
    .catch(err => {
      console.log('❌ Failure occurred: %o', err);
    });
}

module.exports = {
  writeSkywalkingLocalBindings,
};
