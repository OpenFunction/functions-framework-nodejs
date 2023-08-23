function writeHttp(req, res) {
  console.log(req.body);
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(req.body);
}

module.exports = {
  writeHttp,
};
