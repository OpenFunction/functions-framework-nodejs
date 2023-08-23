async function tryKnativeStateQuery(ctx, data) {
  console.log('✅ Function should receive request: %o', data);
  await ctx.state
    .query(data)
    .then(res => {
      console.log('✅ Success query');
      res.results.forEach(result => {
        delete result.etag;
      });
      console.log(JSON.stringify(res));
    })
    .catch(err => {
      console.log('❌ Failure occurred: %o', err);
    });
}

module.exports = {
  tryKnativeStateQuery,
};
