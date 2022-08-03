class ErrorPlugin{
    // static Version = "v1"
    static Name = "error-miss-version-plugin"
    constructor(){
      console.log(`init error plugins`);
    }
    async execPreHook(ctx){
      console.log(`-----------error plugin pre hook-----------`);
    }
    execPostHook(ctx){
      console.log(`-----------error plugin post hook-----------`);
    }
    get(filedName){
      for(let key in this){
        if(key === filedName){
          return this[key];
        }
      }
    }
}

module.exports = {ErrorPlugin};
