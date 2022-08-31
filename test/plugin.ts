/* eslint-disable @typescript-eslint/no-unused-vars */
import * as assert from 'assert';

import {fill, get, random, range} from 'lodash';

import {PluginStore, Plugin} from '../src/openfunction/plugin';
import {getFunctionPlugins} from '../src/loader';

class Concater extends Plugin {
  index = 0;
  value = '';

  constructor() {
    super('concater', 'v1');
  }

  async execPreHook(): Promise<void> {
    await new Promise(r => setTimeout(r, random(0, 10) * 10));
    this.value += this.index++;
  }
}

describe('Store for custom and builtin plugins', () => {
  before(async () => await getFunctionPlugins(process.cwd() + '/test/data'));

  const customs = PluginStore.Instance();

  it('can retrieve plugin by name', () => {
    ['numbers', 'ticktock', 'countdown'].forEach(v =>
      assert.strictEqual(customs.get(v)?.name, v)
    );
  });

  it('can execute custom plugins by sequence', async () => {
    const size = random(3, 5);
    const ticktock = customs.get('ticktock');
    const seq = fill(Array(size), ticktock.name);

    await customs.execPreHooks(null, seq);
    assert.strictEqual(get(ticktock, 'value'), size);

    await customs.execPostHooks(null, seq);
    assert.strictEqual(get(ticktock, 'value'), 0);
  });

  it('ensures the sequence of long running async plugins', async () => {
    customs.register(new Concater());

    const size = random(0, 9);
    const concater = customs.get('concater');
    const seq = fill(Array(size), concater.name);

    await customs.execPreHooks(null, seq);
    assert.strictEqual(get(concater, 'index'), size);
    assert.strictEqual(get(concater, 'value'), range(size).join(''));
  });
});
