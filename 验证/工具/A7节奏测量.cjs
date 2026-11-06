// Read-only audit of UI inputs and native exports. No game ticks or scenario construction.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const root=path.resolve(__dirname,'../A7节奏'),prior=path.resolve(__dirname,'../A7/7-全流程');
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]):[];
const lines=p=>fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const load=p=>{const r=JSON.parse(fs.readFileSync(p));return(r.encoding?JSON.parse(z.gunzipSync(Buffer.from(r.data,'base64'))):r).state;};
const expr=x=>x.css||x.expr||x.selector||'';
const civilian=x=>x.kind==='click'&&/workers_row_(farmer|hunter|medic|teacher|smith|salvager)\b/.test(expr(x));
const output={kind:'UI-input and immutable-native-export audit, not human usability acceptance',routes:{}};
for(const route of ['public','industry']){
 const dir=path.join(root,route),all=walk(dir),inputs=all.filter(f=>f.endsWith('actions.ndjson')).flatMap(lines).sort((a,b)=>a.wall.localeCompare(b.wall));
 const exports=all.filter(f=>/战后文明-存档.*\.json$/.test(f)).map(file=>({file,s:load(file)})).sort((a,b)=>a.s.civilization.elapsed-b.s.civilization.elapsed);if(!exports.length)continue;
 const final=exports.at(-1),s=final.s,c=s.civilization,end=c.elapsed,city=c.city?.cityAt??end;
 const speeds=[{at:0,rate:1}];let high=0;
 for(const input of inputs){const at=input.at??input.sim;if(!Number.isFinite(at))continue;high=Math.max(high,at);const m=(input.text||'').match(/^(\d+)×$/)||expr(input).match(/startsWith\(['"](\d+)×['"]\)/)||expr(input).match(/#speed_(\d+)/);if(m&&Number(m[1])!==speeds.at(-1).rate)speeds.push({at:high,rate:Number(m[1])});}
 const minute=at=>speeds.reduce((n,x,i)=>n+Math.max(0,Math.min(at,speeds[i+1]?.at??at)-x.at)/x.rate,0)/60;
 const choices=[],add=(at,type,value,proof)=>{if(Number.isFinite(at)&&at<=end)choices.push({at,minute:minute(at),type,value,proof});};
 for(const r of c.decisions?.records||[])if(r.kind==='policy'&&r.from!==r.to)add(r.at,'配给政策',r.to,'decisions.records');
 const founding=(c.decisions?.records||[]).filter(r=>r.kind==='founding');if(founding.length)add(founding[0].at,'共同章程',founding.map(r=>r.axis+':'+r.to).join('；'),'four founding axes counted as one bundle');
 for(const [i,r]of(c.workMandate?.changes||[]).entries())if(r.enabled){const prev=c.workMandate.changes[i-1];if(!prev?.enabled||prev.mode!==r.mode)add(r.at,'轮值优先与实付授权',r.mode,'workMandate.changes + maintenance receipts');}
 for(const input of inputs)if(input.kind==='intake_priority'&&input.enabled===false&&c.urban.enabled===false)add(input.at,'接纳与公共服务材料取舍','暂缓新批次，保留在途家庭','actual intake click + final native urban.enabled=false');
 if(c.course){add(c.course.chosenAt,'城镇发展方向',c.course.id,'course.chosenAt');if(c.course.issue?.moved>0)add(c.course.issue.at,'城镇用工取舍',c.course.issue.option,'actual moved workers: '+c.course.issue.moved);if(c.course.craftsman)add(c.course.craftsman.at,'工匠交接',c.course.craftsman.mode,'course.craftsman');}
 for(const r of c.expedition?.records||[])if(['ruin','beetle'].includes(r.kind))add(r.at,'近郊处置',r.title+' '+r.detail,'expedition.records');
 for(const r of c.deliberation?.records||[]){const input=inputs.find(x=>x.kind==='deliberate_choice'&&x.agenda===r.id&&Math.abs(x.at-r.at)<=100);if(r.id!=='opening_work'&&r.result==='passed'&&input?.changesRule===true)add(r.at,'已生效议题',r.id+':'+r.value,'passed receipt + pre-choice owner value');}
 for(const r of c.conurbation?.policies||[])if(['sign','share'].includes(r.kind)){const agenda=r.kind==='sign'?'city_exchange':'city_burden';if(!choices.some(x=>x.type==='已生效议题'&&x.value===agenda+':'+r.value&&Math.abs(x.at-r.at)<=100))add(r.at,r.kind==='sign'?'实际两城协作方向':'实际道路分担',r.value,'conurbation.policies; manual and civic paths deduplicated');}
 for(const r of c.cityNetwork?.policies||[])if(r.kind==='priority'&&!choices.some(x=>x.type==='已生效议题'&&x.value==='cluster_freight:'+r.value&&Math.abs(x.at-r.at)<=100))add(r.at,'实付有限车辆优先',r.value,'cityNetwork.policies; no new fleet capacity');
 const unique=[...new Map(choices.map(x=>[x.at+':'+x.type+':'+x.value,x])).values()].sort((a,b)=>a.at-b.at);
 const choiceGaps=unique.slice(1).map((x,i)=>({from:unique[i].at,to:x.at,minutes:x.minute-unique[i].minute,previous:unique[i].type,next:x.type})).sort((a,b)=>b.minutes-a.minutes);
 const allWorkerClicks={};for(const input of inputs)if(input.kind==='click'){const m=expr(input).match(/workers_row_(\w+)/);if(m)allWorkerClicks[m[1]]=(allWorkerClicks[m[1]]||0)+1;}
 const windows=Array.from({length:Math.ceil(minute(end)/30)},(_,i)=>({from:i*30,to:Math.min((i+1)*30,minute(end)),count:unique.filter(x=>x.minute>=i*30&&x.minute<(i+1)*30).length}));
 const early=inputs.filter(x=>(x.at??0)<=city),enabled=c.workMandate?.changes.find(x=>x.enabled)?.at;
 const old=lines(path.join(prior,route,'village/actions.ndjson')).filter(civilian);
 const baseline=JSON.parse(fs.readFileSync(path.join(dir,'baseline.json'))),chainFile=path.join(dir,'chain.json'),chain=fs.existsSync(chainFile)?JSON.parse(fs.readFileSync(chainFile)):null;
 const start=JSON.parse(fs.readFileSync(path.join(dir,'start.json'))).wall,ending=inputs.filter(x=>x.kind==='export').at(-1)?.wall||inputs.at(-1).wall;
 const sampleFile=path.join(dir,'timeline.ndjson'),samples=fs.existsSync(sampleFile)?lines(sampleFile):[];
 const report={route,finalNative:path.relative(root,final.file),completeThreeCities:!!chain?.complete,elapsed:end,cityAt:city,advanceMinutes:minute(end),wallMinutes:(Date.parse(ending)-Date.parse(start))/60000,speeds,opening:baseline.log.filter(x=>['建成:hut','首批居民','稳定聚落'].includes(x.k)),civilianJobClicks:{before:old.length,now:early.filter(civilian).length,afterMandate:early.filter(x=>civilian(x)&&x.at>=enabled).length,note:'Prior village run includes intentional supply-cut verification; these are recorded script inputs, not a controlled human comparison.'},workChanges:c.workMandate?.changes,workFees:c.workMandate?.records.length,cityHandoff:c.workMandate?.handoffAt,choices:unique,choiceGaps,scriptInputCounts:{clicks:inputs.filter(x=>x.kind==='click').length,workerClicks:allWorkerClicks,note:'Recorded script inputs, including navigation and a threshold-oscillating industrial controller; not required player actions.'},windows,fullWindowsBelowTwo:windows.filter(x=>x.to-x.from>=29.9&&x.count<2),phases:chain?.phases,lateSamples:samples.length?{from:samples[0].at,to:samples.at(-1).at,count:samples.length}:null,limits:['Nominal active time integrates selected speed changes over simulation seconds; pauses, UI interaction and development are excluded. It is diagnostic, not a human attention clock.','Wall time includes debugging, native checkpoint reloads, screenshots and concurrent regression load. Do not claim controlled speed improvement or 12–15-hour calibration.','Choice count is a conservative lower bound: repeated/default confirmations, routine renewals, construction and research are excluded.','Continuous observer started during the town stage. Earlier time is reconstructed only from actual recorded speed clicks, not presented as sampled telemetry.','The final one-period maintenance hold is a stability check and is separately visible in the phase controller.']};
 output.routes[route]=report;fs.writeFileSync(path.join(dir,'测量.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({route,complete:report.completeThreeCities,at:end,minutes:report.advanceMinutes,civilian:report.civilianJobClicks,choices:unique.length,windows:windows.map(x=>x.count)}));
}
fs.writeFileSync(path.join(root,'测量汇总.json'),JSON.stringify(output,null,2)+'\n');
