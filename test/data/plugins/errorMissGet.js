class ErrorPlugin{
    static Version = "v1"
    static Name = "error-miss-get-plugin"

    execPreHook(ctx){
        console.log(`-----------error plugin pre hook-----------`)
    }
    execPostHook(ctx){
        console.log(`-----------error plugin post hook-----------`)
    }
}

module.exports = ErrorPlugin;
