import { Plugin } from '../../../../build/src/index.js';

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