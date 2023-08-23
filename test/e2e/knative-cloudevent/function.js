function writeCloudEvent(cloudevent) {
  console.log(cloudevent);
  console.log(cloudevent.data);
}

module.exports = {
  writeCloudEvent,
};
