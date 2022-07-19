import * as path from 'path';
import * as fs from 'fs';
import {PluginContext} from './plugin_context'

export async function loadPlugins(codeLocation: string) :Promise<Map<string,Function>>{
    let funcMap : Map<string,Function> = new Map()
    let param = path.resolve(`${codeLocation}/plugins`)
    let plugin_files:Array<string> = []
    let files = fs.readdirSync(param)
    files.forEach(f=>{
        if(f.endsWith(".js")){
            plugin_files.push(path.join(param,f))
        }
    })
    console.log(plugin_files)
    plugin_files.forEach(f=>{
        let pluginModule = require(f)
        Object.keys(pluginModule).forEach(key=>{
            funcMap.set(key,pluginModule[key]) 
        })
    })
    return funcMap
}


export async function getPlugins(codeLocation: string, pluginContext:PluginContext) :Promise<PluginContext>{
    let funcMapResult : Map<string,Function> = new Map()
    let funcMap = await loadPlugins(codeLocation)
    pluginContext.pluginMap = funcMap
    pluginContext.prePluginFuncs = []
    pluginContext.postPluginFuncs = []
    pluginContext.prePlugins.forEach(p=>{
        let func = funcMap.get(p)
        if(func != null){
            funcMapResult.set(p,func)
            pluginContext.prePluginFuncs!.push(func)
            
        }else{
            console.error(`----------------error----------------`)
            console.error(`pre-plugin-function[${p}] is not found  \nDid you specify the correct target plugin-function to execute?`)
            console.error(`-------------------------------------`)
        }
    })
    pluginContext.postPlugins.forEach(p=>{
        let func = funcMap.get(p)
        if(func != null){
            funcMapResult.set(p,func)
            pluginContext.postPluginFuncs!.push(func)
        }else{
            console.error(`----------------error----------------`)
            console.error(`post-plugin-function[${p}] is not found  \nDid you specify the correct target plugin-function to execute?`)
            console.error(`-------------------------------------`)
        }
    })

    return pluginContext
}