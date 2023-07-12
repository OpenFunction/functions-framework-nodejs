/* eslint-disable node/no-missing-require */
const fs = require('fs');

const debug = require('debug')('test:conformance');

const functions = require('@openfunction/functions-framework');
const fileName = 'function_output.json';

functions.http('writeHttpDeclarative', (req, res) => {
  writeJson(req.body);
  res.sendStatus(200);
});

functions.cloudEvent('writeCloudEventDeclarative', cloudEvent => {
  cloudEvent.datacontenttype = 'application/json';
  writeJson(cloudEvent);
});

function writeHttp(req, res) {
  writeJson(req.body);
  res.sendStatus(200);
}

function writeCloudEvent(cloudEvent) {
  cloudEvent.datacontenttype = 'application/json';
  writeJson(cloudEvent);
}

function writeLegacyEvent(data, context) {
  const content = {
    data: data,
    context: {
      eventId: context.eventId,
      timestamp: context.timestamp,
      eventType: context.eventType,
      resource: context.resource,
    },
  };
  writeJson(content);
}

function writeJson(content) {
  const json = JSON.stringify(content);
  fs.writeFileSync(fileName, json);
}

async function tryKnativeAsyncBindingAndPubSub(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.send(data);
  ctx.res.send(data);
}

async function tryKnativeAsyncStateSave(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.state
    .save(data)
    .then(res => {
      debug('✅ Success save: %o', res);
    })
    .catch(err => {
      debug('❌ Failure occurred: %o', err);
    });
  ctx.res.send(data);
}

async function tryKnativeAsyncStateGet(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.state
    .get(data)
    .then(res => {
      debug('✅ Success save: %o', res);
    })
    .catch(err => {
      debug('❌ Failure occurred: %o', err);
    });
  ctx.res.send(data);
}

async function tryKnativeAsyncStateGetBulk(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.state
    .getBulk(data)
    .then(res => {
      debug('✅ Success getBulk: %o', res);
    })
    .catch(err => {
      debug('❌ Failure occurred: %o', err);
    });
  ctx.res.send(data);
}

async function tryKnativeAsyncStateDelete(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.state
    .delete(data)
    .then(res => {
      debug('✅ Success delete: %o', res);
    })
    .catch(err => {
      debug('❌ Failure occurred: %o', err);
    });
  ctx.res.send(data);
}

async function tryKnativeAsyncStateTransaction(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.state
    .transaction(data)
    .then(res => {
      debug('✅ Success transaction: %o', res);
    })
    .catch(err => {
      debug('❌ Failure occurred: %o', err);
    });
  ctx.res.send(data);
}

async function tryKnativeAsyncStateQuery(ctx, data) {
  debug('✅ Function should receive request: %o', data);
  await ctx.state
    .query(data)
    .then(res => {
      debug('✅ Success query: %o', res);
    })
    .catch(err => {
      debug('❌ Failure occurred: %o', err);
    });
  ctx.res.send(data);
}

function tryAsync(ctx, data) {
  debug('✅ Function should receive from "%o": %o', ctx.inputs, data);
}

module.exports = {
  writeHttp,
  writeCloudEvent,
  writeLegacyEvent,
  tryKnativeAsyncBindingAndPubSub,
  tryKnativeAsyncStateSave,
  tryKnativeAsyncStateGet,
  tryKnativeAsyncStateGetBulk,
  tryKnativeAsyncStateDelete,
  tryKnativeAsyncStateTransaction,
  tryKnativeAsyncStateQuery,
  tryAsync,
};
