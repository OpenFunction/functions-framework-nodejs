import {Plugin} from '../../../build/src/index.js';

export class Numbers extends Plugin {
  bin = 2;
  oct = 8;
  hex = 16;

  constructor() {
    super('numbers', 'v1');
  }
}
