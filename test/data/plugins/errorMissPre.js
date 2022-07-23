class ErrorPlugin{
    static Version = "v1"
    static Name = "error-miss-pre-plugin"

    execPostHook(ctx){
        console.log(`-----------error plugin post hook-----------`)
    }
    get(filedName){
        for(let key in this){
            if(key === filedName){
                return this[key]
            }
        }
    }
}

module.exports = ErrorPlugin;
