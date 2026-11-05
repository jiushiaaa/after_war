// Offline measurement of observed UI play. Never advances or edits a game.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../A7/7-全流程');
const readLines=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const seconds=(a,b)=>(Date.parse(b)-Date.parse(a))/1000,round=n=>Math.round(n*100)/100;
function measure(route){
 const dir=path.join(root,route),initial=JSON.parse(fs.readFileSync(path.join(dir,'start.json'))),all=readLines(path.join(dir,'timeline.ndjson'));
 const end=all.findIndex(x=>x.ending),timeline=end<0?all:all.slice(0,end+1),last=timeline.at(-1);if(!last)throw Error('No observations');
 const inputs=walk(dir).filter(p=>p.endsWith('.ndjson')&&!p.endsWith('timeline.ndjson')).flatMap(readLines).filter(x=>x.wall&&x.wall<=last.wall).sort((a,b)=>a.wall.localeCompare(b.wall));
 const unique=[...new Map(inputs.map(x=>[JSON.stringify([x.wall,x.kind,x.css||x.expr,x.key]),x])).values()];
 const clicks=unique.filter(x=>x.kind==='click'),navigation=clicks.filter(x=>/#location_|#cityView_|#metroCity_select_|summary|#civilTab_|#cityWard_/.test(x.css||x.expr||''));
 const speed=clicks.filter(x=>/#speedButton|#speed_[0-9]|#event #pause/.test(x.css||x.expr||''));
 const relevant=x=>/#event #(?:course_|policy_|civic_|ex_(?:preserve|dismantle|observe|smoke|force|shoot|silent|invite|share))/.test(x.css||x.expr||'');
 const choices=clicks.filter(relevant).map(x=>({wall:x.wall,at:x.at,button:x.css||x.expr,text:x.text}));
 // Lower bound only: this does not count every construction, allocation or contract as a meaningful decision.
 const windows=Array.from({length:Math.ceil(seconds(initial.wall,last.wall)/1800)},(_,i)=>({fromMinute:i*30,toMinute:Math.min((i+1)*30,round(seconds(initial.wall,last.wall)/60)),explicitBranchClicks:0}));
 for(const c of choices){const i=Math.floor(seconds(initial.wall,c.wall)/1800);if(windows[i])windows[i].explicitBranchClicks++;}
 let chosenRateEquivalent=0,pausedWall=0,observedWall=0,highAt=timeline[0].at;const rates={},stages=[],reloadObservations=[];let stage;
 for(let i=0;i<timeline.length;i++){
  const x=timeline[i];if(x.stage!==stage){stage=x.stage;stages.push({stage,wall:x.wall,at:x.at,minutes:round(seconds(initial.wall,x.wall)/60),known:x.known,world:x.total});}
  if(!i)continue;const p=timeline[i-1],wall=seconds(p.wall,x.wall);if(wall<0)throw Error('Non-monotonic wall clock');if(x.at<p.at)reloadObservations.push({from:p.wall,to:x.wall,fromElapsed:p.at,toElapsed:x.at});const sim=Math.max(0,x.at-highAt);highAt=Math.max(highAt,x.at);
  observedWall+=wall;if(p.paused&&x.paused)pausedWall+=wall;
  const r=p.effectiveRate||p.rate;chosenRateEquivalent+=sim/r;rates[r]=(rates[r]||0)+sim;
 }
 const waits=[];let start=0;
 for(let i=1;i<=timeline.length;i++){
  const x=timeline[i],p=timeline[i-1],first=timeline[start];
  const unchanged=x&&x.stage===first.stage&&JSON.stringify(x.tech)===JSON.stringify(first.tech)&&x.proposals===first.proposals;
  if(!unchanged){const duration=seconds(first.wall,p.wall);if(duration>=120)waits.push({from:first.wall,to:p.wall,minutes:round(duration/60),stage:first.stage,simSeconds:p.at-first.at,pausedAtStart:first.paused,meaning:'same stage, learned base technology and civic-record count; may still contain real construction/transport/training'});start=i;}
 }
 const report={route,complete:!!last.ending,start:initial.wall,end:last.wall,wallMinutes:round(seconds(initial.wall,last.wall)/60),observedMinutes:round(observedWall/60),pausedMinutesLowerBound:round(pausedWall/60),rateAdjustedSimulationMinutes:round(chosenRateEquivalent/60),rateSimulationSeconds:rates,reloadObservations,elapsed:last.at,years:round(last.at/600),operations:{mouseClicks:clicks.length,navigationClicks:navigation.length,speedAndPauseClicks:speed.length,loggedKeyboardEvents:unique.filter(x=>x.kind==='key').length,nativeSelections:unique.filter(x=>x.kind==='select').length,explicitBranchClicks:choices.length},stages,windows,choices,waits,last,limits:['15-second sampling; rate transitions and pauses are approximate.','Reloaded intermediate observations below the prior maximum receive no additional simulation-time credit.','Wall time includes developer fixes and driver mistakes, retained rather than silently subtracted.','Scripted mouse/keyboard input is not a new-player usability test.','Early stage drivers logged native selection results without every key; keyboard events are a lower bound, not total actual keys.','Mouse counts include navigation, repeated polling and rejected/no-change controls; they are not the required player operation count.','Explicit branch clicks are an auditable lower bound, not proof that every click changed a rule.','Food accounts are separate local stocks; do not add a transit or public ledger twice.']};
 fs.writeFileSync(path.join(dir,'测量.json'),JSON.stringify(report,null,2)+'\n');
 const columns=['wall','sim_seconds','year','stage','rate','paused','origin_people','known_people','world_people','origin_food','origin_medicine','base_tech_count','wards_food','lake_food','ridge_food','north_local_food','east_local_food','national_public_food','advanced_food'];
 fs.writeFileSync(path.join(dir,'曲线.csv'),columns.join(',')+'\n'+timeline.map(x=>[x.wall,x.at,round(x.at/600),x.stage,x.effectiveRate||x.rate,!!x.paused,x.people,x.known,x.total,x.food,x.medicine,x.tech.length,x.foodLedgers?Object.values(x.foodLedgers.wards||{}).reduce((a,b)=>a+b,0):'',x.foodLedgers?.secondCity??'',x.foodLedgers?.thirdCity??'',x.foodLedgers?.northLocal??'',x.foodLedgers?.eastLocal??'',x.foodLedgers?.national??'',x.foodLedgers?.advanced??''].join(',')).join('\n')+'\n');
 const series=[['World population',x=>x.total],['Known population',x=>x.known||0],['Origin food (separate local stock)',x=>x.food||0],['Three local wards: food (not origin stock)',x=>x.foodLedgers?Object.values(x.foodLedgers.wards||{}).reduce((a,b)=>a+b,0):null],['Lake food (separate city stock)',x=>x.foodLedgers?.secondCity??null],['National public food (not regional households)',x=>x.foodLedgers?.national??null]],W=1000,H=220,L=90,R=20,T=30,B=35,maxX=Math.max(1,seconds(initial.wall,last.wall)/60);
 const plots=series.map(([title,value],idx)=>{const max=Math.max(1,...timeline.map(value)),h=H-T-B;const measured=timeline.filter(x=>value(x)!==null);const line=measured.map((x,i)=>(i?'L':'M')+(L+seconds(initial.wall,x.wall)/60*(W-L-R)/maxX).toFixed(1)+','+(T+h-value(x)*h/max).toFixed(1)).join(' ');return `<g transform="translate(0 ${idx*H})"><text x="${L}" y="20">${title}</text><path d="M${L} ${T}V${T+h}H${W-R}" stroke="#999" fill="none"/><text x="10" y="${T+10}">${Math.round(max).toLocaleString('en-US')}</text><text x="${L}" y="${H-10}">0</text><text x="${W-150}" y="${H-10}">${maxX.toFixed(1)} real minutes</text><path d="${line}" stroke="#222" stroke-width="1.5" fill="none"/></g>`;}).join('');
 fs.writeFileSync(path.join(dir,'曲线.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H*series.length}" viewBox="0 0 ${W} ${H*series.length}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="13" fill="#222">${plots}</g></svg>`);
 return {route,complete:report.complete,wallMinutes:report.wallMinutes,rateAdjustedSimulationMinutes:report.rateAdjustedSimulationMinutes,years:report.years,operations:report.operations,stages};
}
for(const route of ['public','industry'])console.log(JSON.stringify(measure(route)));
