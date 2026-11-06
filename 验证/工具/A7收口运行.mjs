// Independent fresh browser and sequential real-input drivers. Never sets game state or virtual time.
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const [port,route]=process.argv.slice(2);if(!['public','industry'].includes(route))throw Error('route');
const dir=path.resolve('验证/A7收口',route);fs.mkdirSync(dir,{recursive:true});
const env={...process.env,A7_NORMAL:'1',A7_ROUTE:route,CDP_PORT:port};
async function run(script,args,log,extra={}){const fd=fs.openSync(path.join(dir,log),'a');const c=spawn(process.execPath,[path.join('验证/工具',script),...args],{env:{...env,...extra},stdio:['ignore',fd,fd]});fs.writeFileSync(path.join(dir,'running.json'),JSON.stringify({script,pid:c.pid,at:new Date().toISOString()}));const code=await new Promise((res,rej)=>{c.on('error',rej);c.on('exit',res);});fs.closeSync(fd);if(code!==0)throw Error(script+' exited '+code);}
if(!fs.existsSync(path.join(dir,'start.json'))){
 const log=fs.openSync(path.join(dir,'chrome.log'),'a'),profile='/tmp/postwar-a7-final-'+route;
 if(fs.existsSync(profile))throw Error('Fresh profile already exists; inspect, never overwrite');
 const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','http://127.0.0.1:4180'],{detached:true,stdio:['ignore',log,log]});chrome.unref();fs.closeSync(log);
 fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify({pid:chrome.pid,profile,port}));
 for(let i=0;i<40;i++){try{if((await fetch(`http://127.0.0.1:${port}/json`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 await run('A7收口开局.mjs',[port,route],'start.log');
}
const obslog=fs.openSync(path.join(dir,'observer.log'),'a'),observer=spawn(process.execPath,['验证/工具/A7自然观测.mjs',port,route,dir],{stdio:['ignore',obslog,obslog]});fs.closeSync(obslog);
try{
 if(!fs.existsSync(path.join(dir,'baseline.json')))await run('A7节奏住房优先开局.mjs',[path.join(dir,'baseline.json'),'3600'],'opening.log',{STOP_AT_WORKSHOP:'1'});
 if(!fs.existsSync(path.join(dir,'village/result.json')))await run('A7收口路线/村镇玩家.mjs',[route==='public'?'commons':'industry',port,path.join(dir,'village')],'village.log',{BASELINE:path.join(dir,'baseline.json')});
 await run('A7收口接续.mjs',[port,route],'chain.log');
 fs.writeFileSync(path.join(dir,'complete.json'),JSON.stringify({at:new Date().toISOString(),status:'UI route reached first flight'}));
}finally{fs.writeFileSync(path.join(dir,'monitor.stop'),'stop');observer.kill('SIGTERM');}
