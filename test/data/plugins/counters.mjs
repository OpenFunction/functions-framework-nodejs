import {Plugin} from '../../../build/src/index.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export class TickTock extends Plugin {
  value = 0;

  constructor() {
    super('ticktock', 'v1');
  }

  async execPreHook(ctx, plugins) {
    this.value++;
  }

  async execPostHook(ctx, plugins) {
    this.value--;
  }
}

export class Countdown extends Plugin {
  // start: number;
  // end: number;
  // step: number;
  // current: number;

  constructor() {
    super('countdown', 'v1');
  }

  async execPreHook(ctx, plugins) {
    // Initialize step value from another plugin
    this.step = plugins['numbers'].bin;
  }

  async execPostHook(ctx, plugins) {
    // Load start value from context local data
    if (!this.start) {
      this.start = ctx.locals.start ?? 0;
      this.end = ctx.locals.end ?? 0;
      this.current = this.start;
    }
    if (this.current === this.end) return;

    // Sleep "10 milliseconds" x "current value"
    await sleep(10 * this.current);

    // Execute main countdown logic
    this.countdown(ctx, plugins);

    // Try to end the test if necessary
    if (this.current === this.end) ctx.locals.done?.();
  }

  countdown(ctx, plugins) {
    // Load self plugin instance
    const self = plugins[this.name];

    // Count down by step value, and save current stop
    self.current -= self.step;

    // Calibrate current value if it goes below the end value
    if (self.current < self.end) self.current = self.end;
  }
}
