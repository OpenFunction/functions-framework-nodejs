import assert from 'assert';
import {Plugin} from '../../../build/src/index.js';
import {query,OapServer,sleep} from '../../../build/test/integration/build_in_plugin.js'
//Help to verify skywalking plugin
export class Assist extends Plugin {
    constructor() {
      super('assist', 'v1');
    }
  
    async execPreHook(ctx, plugins) {
    }
  
    async execPostHook(ctx, plugins) {
        const traceId = ctx.locals.traceId;
        const options = ctx.locals.options;
        sleep(3000).then(()=>{
          query(traceId,OapServer).then(res=>{
            res.json().then(res=>{
              if(res.data.trace.spans.length >=0){
                let target = null;
                for (const item of res.data.trace.spans) {
                  if (item.endpointName === `/${options.target}`) {
                    target = item;
                  }
                }
                assert(target !== null);
                assert(target.endpointName === `/${options.target}`);

                ctx.locals.done?.();
              }
            })
          })
        })
    }
  }