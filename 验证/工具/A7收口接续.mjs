// Supervisor for sequential, UI-only stage drivers. Never substitutes old exports.
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {connect} from './a7-cdp.mjs';
const [port,route]=process.argv.slice(2);if(!['public','industry'].includes(route))throw Error('route');
const root=path.resolve('验证/A7收口',route),sleep=ms=>new Promise(r=>setTimeout(r,ms)),file=path.join(root,'chain.json');
const phases=[
 ['institutions','A7收口路线/城市机构玩家.mjs'],['two-cities','A7收口路线/城市群玩家.mjs',route==='public'?'commons':'industry'],
 ['three-cities','A7收口路线/三城玩家.mjs'],['region','A7收口路线/地区玩家.mjs'],['regions','A7收口路线/双地区玩家.mjs'],
 ['nation','A7收口路线/国约玩家.mjs'],['science','A7收口路线/先进前置玩家.mjs'],['advanced','A7收口路线/先进社会玩家.mjs'],
 ['labor','A7收口路线/先进社会玩家.mjs',null,{A5_PHASE:'mixed'}],['supply','A7收口路线/先进社会玩家.mjs',null,{A5_PHASE:'supply'}],['earth','A7收口路线/地球玩家.mjs']
];
const control=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{index:0,phases:[]};const save=()=>fs.writeFileSync(file,JSON.stringify(control,null,2));
while(!fs.existsSync(path.join(root,'village/result.json')))await sleep(2000);
for(;control.index<phases.length;control.index++){
 const [id,script,arg,env]=phases[control.index],dir=path.join(root,id);fs.mkdirSync(dir,{recursive:true});
 const p=await connect(port,dir),before=await p.read('({at:State.civilization.elapsed,seed:State.civilization.census.seed,polish:State.civilization.polishVersion})');p.close();
 if(before.polish!==1||before.seed!==7417)throw Error('Fresh-world identity changed');
 const record={id,before,start:new Date().toISOString()};control.phases.push(record);save();
 const out=fs.openSync(path.join(dir,'driver.log'),'a'),child=spawn(process.execPath,[path.join('验证/工具',script),port,dir,...(arg?[arg]:[])],{stdio:['ignore',out,out],env:{...process.env,A7_ROUTE:route,A7_NORMAL:'1',...env}});
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});fs.closeSync(out);record.end=new Date().toISOString();record.code=code;save();
 if(code!==0){const b=await connect(port,dir);if(!await b.read('CivilClock.paused')&&!await b.read('!!Events.activeEvent()')){await b.click('#speedButton');await b.raw('#event #pause');}b.close();throw Error('Stopped at '+id+'; retain live world and controller.');}
 console.log('COMPLETE',route,id);save();
}
control.complete=true;save();console.log('Fresh route reached the Earth ending',route);
