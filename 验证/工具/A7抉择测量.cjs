// Read-only result-based choice audit. No clocks or worlds are advanced.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const root=path.resolve(__dirname,'../A7/7-全流程');
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]):[];
const lines=p=>fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(x=>JSON.parse(x));
const load=p=>{const r=JSON.parse(fs.readFileSync(p));return(r.encoding?JSON.parse(z.gunzipSync(Buffer.from(r.data,'base64'))):r).state;};
for(const route of ['public','industry']){
 const dir=path.join(root,route),measure=JSON.parse(fs.readFileSync(path.join(dir,'测量.json'))),gaps=measure.lineageSamplingGaps;
 const native=walk(dir).filter(p=>/战后文明-存档.*\.json$/.test(p)).map(p=>({p,s:load(p)})).sort((a,b)=>b.s.civilization.elapsed-a.s.civilization.elapsed)[0];
 const c=native.s.civilization,d=c.polity,f=d?.future,ending=d?.earth?.ending?.at||c.elapsed;
 const timeline=lines(path.join(dir,'timeline.ndjson')).filter(x=>!gaps.some(g=>x.wall>=g.from&&x.wall<=g.to)&&x.at<=ending+32*15);
 const inputs=walk(dir).filter(p=>p.endsWith('actions.ndjson')).flatMap(lines).filter(x=>!gaps.some(g=>x.wall>=g.from&&x.wall<=g.to));
 let active=0,high=0;const intervals=[];
 timeline.forEach((x,i)=>{const prev=timeline[Math.max(0,i-1)],end=Math.max(high,x.at),rate=prev.effectiveRate||prev.rate;intervals.push({from:high,to:end,active,rate,wall:x.wall});active+=(end-high)/rate;high=end;});
 const atMinute=at=>{const p=intervals.find(x=>x.to>=at)||intervals.at(-1);return(p.active+Math.max(0,at-p.from)/p.rate)/60;};
 const choices=[],add=(at,type,detail,proof)=>{if(at<=ending)choices.push({at,minute:atMinute(at),type,detail,proof});};
 for(const r of c.decisions?.records||[])if(r.kind==='policy'&&r.from!==r.to)add(r.at,'配给政策',r.to,'decisions.records');
 const founding=(c.decisions?.records||[]).filter(r=>r.kind==='founding');if(founding.length)add(founding[0].at,'共同章程',founding.map(r=>r.axis+':'+r.to).join('；'),'four constitutional axes counted as one bundle');
 if(c.course)add(c.course.chosenAt,'城镇发展方向',c.course.id,'course.chosenAt');
 if(c.course?.issue?.moved>0)add(c.course.issue.at,'城镇用工取舍',c.course.issue.option,'actual workers moved: '+c.course.issue.moved);
 if(c.course?.craftsman)add(c.course.craftsman.at,'工匠交接',c.course.craftsman.mode,'course.craftsman');
 for(const r of c.expedition?.records||[])if(['ruin','beetle'].includes(r.kind))add(r.at,'近郊选择',r.title+' '+r.detail,'expedition.records');
 for(const r of c.deliberation?.records||[]){const input=inputs.find(x=>x.kind==='deliberate_choice'&&x.agenda===r.id&&Math.abs(x.at-r.at)<=100);if(r.result==='passed'&&input?.changesRule===true)add(r.at,'已生效议案',r.id+':'+r.value,'passed civic record + before/after owner-rule comparison');}
 for(const e of d?.records||[]){const a=e.args;
  if(e.action==='earth'&&a.op==='offer')add(e.at,'地区责任方案',a.region+':'+a.mode,'funded earth offer in replay-validated public ledger');
  if(e.action==='future'&&a.op==='echo'&&a.choice!=='depart'&&f.echo?.choice===a.choice)add(e.at,'回响处置',a.choice,'completed same expedition');
  if(e.action==='future'&&a.op==='policy'&&a.key==='method')add(e.at,'生产机会成本',a.value,'paid production priority change');
  if(e.action==='future'&&a.op==='law'&&f.lawsHistory.some(r=>r.at>=e.at&&r.at<=e.at+1200&&r.key===a.key&&r.value===a.value&&r.accepted)){
   const represented=choices.some(r=>r.type==='已生效议案'&&Math.abs(r.at-e.at)<600&&r.detail.endsWith(':'+a.value));if(!represented)add(e.at,'身体与劳动制度',a.key+':'+a.value,'accepted lawsHistory');
  }
  if(e.action==='future'&&a.op==='adopt'&&(a.body==='synthetic'?f.created:f.converted[a.body])>=a.count)add(e.at,'自愿身体与人格方向',a.body+':'+a.count,'paid adoption + cumulative completed conversion/creation');
 }
 const unique=[...new Map(choices.sort((a,b)=>a.at-b.at).map(r=>[r.at+':'+r.type+':'+r.detail,r])).values()];
 const minutes=atMinute(ending),windows=Array.from({length:Math.ceil(minutes/30)},(_,i)=>({fromMinute:i*30,toMinute:Math.min((i+1)*30,minutes),count:0,choices:[]}));
 for(const choice of unique){const w=windows[Math.min(windows.length-1,Math.floor(choice.minute/30))];w.count++;w.choices.push(choice.type+' '+choice.detail);}
 const report={route,complete:!!d?.earth?.ending,native:path.relative(root,native.p),advanceMinutes:minutes,choices:unique,windows,fullWindowsBelowTwo:windows.filter(w=>w.toMinute-w.fromMinute>=29.9&&w.count<2),limits:['These are conservative, result-backed strategic changes. Construction, research, repeats, rejected proposals, intentional test outages, default confirmations and routine renewals are excluded.','A four-axis founding constitution counts once. Civic and owner-law results are deduplicated.','Windows use observed simulation progress divided by the selected rate, excluding paused interaction and development time; this is not a human attention clock.','15-second sampling approximates rate transitions. Timing density is diagnostic, not a new-player usability test.']};
 fs.writeFileSync(path.join(dir,'抉择测量.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({route,complete:report.complete,minutes,verifiedChoices:unique.length,windows:windows.map(w=>w.count),belowTwo:report.fullWindowsBelowTwo.length}));
}
