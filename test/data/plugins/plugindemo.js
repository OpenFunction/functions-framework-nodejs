function sleep(){
  return new Promise(resolve => setTimeout(resolve,3000));
}
class DemoPlugin{
    static Version = "v1";
    static Name = "demo-plugin";
    id = '666';
    constructor(){
      console.log(`init demo plugins`);
    }
    async execPreHook(ctx){
      console.log(`-----------demo plugin pre hook-----------`);
      ctx['pre'] = 'pre-exec';
      await sleep();
      console.log(`-----------pre sleep 3----------`)
    }
    async execPostHook(ctx){
      console.log(`-----------demo plugin post hook-----------`);
      ctx['post'] = 'post-exec';
      console.log(`-----------send post-----------`);
    }
    get(filedName){
      for(let key in this){
        if(key === filedName){
          return this[key];
        }
      }
    }
}

// module.exports = {DemoPlugin};
exports.DemoPlugin = DemoPlugin;
