// A7 adaptation of 验证/工具/A6地球首航玩家.mjs. Same UI-only controls, continuous fresh lineage.
import {handlePolish} from '../a7-decisions.mjs';
// Natural A6 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9372',dir='/tmp/postwar-a6-20261105/public']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0,done=false;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
ws.onclose=()=>{if(!done){console.error('Disconnected; retain browser and resume this existing save.');process.exit(2);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{if(method==='Input.dispatchKeyEvent'&&params.type==='rawKeyDown')log('key',{key:params.key});const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),q=css=>`document.querySelector(${JSON.stringify(css)})`;
const log=(kind,data)=>fs.appendFileSync(path.join(dir,'actions.ndjson'),JSON.stringify({wall:new Date().toISOString(),kind,...data})+'\n');
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});
async function raw(css){
 await read(`(()=>{const e=${q(css)};if(e?.checkVisibility())e.scrollIntoView({block:'center',inline:'nearest'});})()`);await sleep(120);
 const box=await read(`(()=>{const e=${q(css)};if(!e||!e.checkVisibility()||e.classList.contains('disabled')||e.disabled)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText.slice(0,90)}:null;})()`);
 if(!box){log('unreachable',{css,info:await read(`(()=>{const e=${q(css)};if(!e)return null;const r=e.getBoundingClientRect();return {rect:r.toJSON(),visible:e.checkVisibility(),disabled:e.disabled,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500)};})()`)});return false;}for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});log('click',{css,...box,at:await read('State.civilization.elapsed')});await sleep(250);return true;
}
async function click(css){
 const info=await read(`(()=>{const e=${q(css)};return e?{panel:e.closest('.location')?.id,folds:[...document.querySelectorAll('details:not([open])')].filter(d=>d.contains(e)&&e!==d.querySelector(':scope > summary')).map(d=>d.id)}:null;})()`);if(!info)return false;
 if(info.panel){const id=info.panel==='civilResearchPanel'?'research':info.panel.replace(/Panel$/,'');if(!await read(`${q('#location_'+id)}?.classList.contains('selected')`))await raw('#location_'+id);for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);}
 for(const id of info.folds){for(let n=0;n<3&&!await read(`${q('#'+id)}.open`);n++){await raw('#'+id+' > summary');await sleep(300);}if(!await read(`${q('#'+id)}.open`))throw Error('Could not unfold '+id);}return raw(css);
}
async function select(css,value){
 for(let n=0;n<6;n++){if(await click(css))break;if(n===5)throw Error('Cannot reach selection '+css);await sleep(300);}
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}



const route=process.env.A6_PHASE?'public-branch':port==='9374'?'public':'industrial';
const observe=()=>read(`(()=>{const d=State.civilization.polity,g=d?.earth,f=d?.future;return {at:State.civilization.elapsed,speed:State.civilization.speed,max:State.civilization.maxSpeed,paused:!!CivilClock.paused,pending:State.civilization.pending,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),g:g?{tech:g.tech,work:g.work,research:g.research,build:g.build,survey:g.survey,ground:g.ground,unity:g.unity,ending:g.ending,last:g.last,paid:g.paid,missed:g.missed,flights:g.flights,regions:Object.fromEntries(Object.entries(g.regions).map(([id,r])=>[id,{mode:r.mode,project:r.project,stable:r.stable,paid:r.paid,missed:r.missed,last:r.last}]))}:null,f:f?{health:f.health,condition:f.condition,assets:f.assets,stock:f.stock,counts:CivilFuturePeople.counts(f),away:CivilFuturePeople.away(f),last:f.last,proposal:f.proposal}:null};})()`);
async function handle(){if(await handlePolish({read,raw,log,route:port==='9374'?'public':'industrial'}))return true;const s=await observe();if(!s.event)return false;const key={succession:'engineer',cold:'wood',roadIncident:'repair',financeOffer:'later',roadDefense:'detour'}[s.pending];if(!key||!s.buttons.includes(key))throw Error('Unknown event '+JSON.stringify({event:s.event,pending:s.pending,buttons:s.buttons}));log('decision',{at:s.at,pending:s.pending,key});await raw('#event #'+key);return true;}
async function pause(value){for(let i=0;i<8;i++){if(await read('!!CivilClock.paused')===value)return;if(await handle())continue;await raw('#speedButton');await raw('#event #pause');}throw Error('Pause failed');}
async function desk(){if(!await click('#location_research'))throw Error('Research location unavailable');for(let i=0;i<25&&await read("$('#locationSlider').is(':animated')");i++)await sleep(100);}
async function action(step){await pause(true);await desk();const prefix=step.module==='future'?'future':'earth';if(step.key==='start'){if(!await click('#'+prefix+'_begin'))throw Error('Cannot start '+prefix);}else{await select('#'+prefix+'Section',step.section);if(step.region)await select('#earthRegion',step.region);await select('#'+prefix+'Task',step.key);if(!await click('#'+prefix+'_commit'))throw Error('Cannot act '+step.key+' '+await read(`document.querySelector('#${prefix}Terms')?.innerText`));}await pause(false);}
async function exportSave(label){await pause(true);await desk();let dest=path.resolve(dir,label);if(fs.existsSync(path.join(dest,'战后文明-存档.json')))dest+='_'+(await observe()).at;fs.mkdirSync(dest,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dest});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('Export unavailable');await sleep(1800);await raw('#event #close');const s=await observe();fs.writeFileSync(path.join(dest,'observation.json'),JSON.stringify(s,null,2));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dest,'screen.png'),Buffer.from(shot.result.data,'base64'));log('export',{label,at:s.at});}
const a=(op,args,section,key,region)=>({op,args:args||{},section,key,region}),research=id=>a('research',{id},'science','research_'+id),build=id=>a('build',{id},'science','build_'+id),fbuild=id=>({...a('build',{id},'construction','build_'+id),module:'future'}),policy=(key,value)=>a('policy',{key,value},'mandates',key),hold=(test,label)=>({test,label}),launch=(kind,crew)=>a('launch',{kind,...(crew?{crew}:{})},'flight',kind==='probe'?'probe':'launch_'+crew);
const options=route==='public'?{north:'network',east:'wetland',west:'open',desert:'reclaim',rainforest:'corridor',islands:'beacons',plateau:'station',polar:'restore'}:{north:'reserve',east:'levee',west:'licensed',desert:'wells',rainforest:'canopy',islands:'harbor',plateau:'archive',polar:'preserve'};
const plan=[a('start',{},null,'start'),hold('!!g','01_global_start'),fbuild('solar'),fbuild('workshop'),research('mapping')];
for(const [region,mode]of Object.entries(options)){if(!['west','desert'].includes(region))plan.push(a('survey',{region},'regions','survey_'+region,region),hold(`!!g.regions.${region}`));plan.push(a('offer',{region,mode},'regions','offer_'+mode,region));if(region==='east')plan.push(research('navigation'),hold('g.regions.north.acceptedAt!==null&&g.regions.north.stable>=300','02_two_territories'));}
plan.push(hold('Object.keys(g.regions).length===8&&Object.values(g.regions).every(r=>r.acceptedAt!==null&&r.stable>=300)&&!g.survey','03_eight_regions'),a('regional',{region:'north',enabled:false},'regions','regional','north'),hold('g.regions.north.last?.paid===false&&g.regions.north.missed>=2','04_service_interrupted'),a('regional',{region:'north',enabled:true},'regions','regional','north'),hold('g.regions.north.stable>=300','05_service_recovered'),a('unity',{mode:route==='public'?'federal':'covenant'},'charter',route==='public'?'unity_federal':'unity_covenant'),hold('!!g.unity','06_earth_unified'),research('fabrication'),research('closed'),research('guidance'),build('works'),build('control'),a('ground',{},'flight','ground'));
if(route==='public')plan.push(hold('g.ground.progress>=120'),policy('power',false),hold('g.ground.missed>=2','07_ground_interrupted'),policy('power',true));
plan.push(hold('!!g.ground.completedAt','08_ground_proven'),launch('probe'),hold('CivilEarthFlight.done(g,"probe")','09_orbit_verified'),launch('departure',route==='public'?'organic':'mixed'),hold('CivilFuturePeople.away(f)===12','10_crew_in_flight'),policy('power',false),hold('!CivilEarthFlight.active(g)&&g.flights.at(-1).aborted','11_crew_returned_after_failure'),policy('power',true),launch('departure',route==='public'?'organic':'mixed'),hold('CivilEarthFlight.done(g,"departure")','12_first_flight_complete'),{duration:6000,label:'13_ten_years_after_flight'});
const branch=[launch('departure','uncrewed'),hold('CivilEarthFlight.done(g,"departure")','14_uncrewed_ending')];
const todo=process.env.A6_PHASE==='return'?[hold('CivilEarthFlight.done(g,"departure")','15_reimport_inflight_return')]:process.env.A6_PHASE==='uncrewed'?branch:plan,file=path.join(dir,'controller.json'),control=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{index:0,last:0};const save=()=>fs.writeFileSync(file,JSON.stringify(control));
// Real, paid governance before global offers. No repairs run during deliberate service/power failures.
async function capacity(){
 if(route!=='public'||control.index>22)return false;
 const f=await read('CivilFuture.data(State)'),steps=[];
 if(f.careMandate?.version===1)steps.push({...a('commission',{version:2},'mandate','clinical_upgrade'),module:'future'});
 else if((f.assets.clinic||0)<4&&!f.project)steps.push(fbuild('clinic'));
 if((f.assets.garden||0)<3&&!f.project)steps.push(fbuild('garden'));
 for(const step of steps)if(!await read(`CivilFuture.reason(State,${JSON.stringify(step.op)},${JSON.stringify(step.args)})`)){await action(step);log('capacity_governance',{at:await read('State.civilization.elapsed'),op:step.op,args:step.args});return true;}
 return false;
}
async function researchMaterials(step){
 if(step.op!=='research'||step.module==='future')return false;
 const s=await read(`(()=>{const f=CivilFuture.data(State),cfg=CivilEarthContent.tech[${JSON.stringify(step.args.id)}];return {reserve: f.exportPolicy==='reserve',missingCulture:(f.stock.culture||0)<(cfg.cost.culture||0),publicMedicine:State.civilization.polity.world.nodes.north.stores.medicine};})()`);
 // Pause paid outward orders while accumulating clinical research material; public supplies must cover the choice.
 if(s.missingCulture&&!s.reserve&&s.publicMedicine>500){await action({...a('policy',{key:'exportPolicy',value:'reserve'},'mandate','exports'),module:'future'});log('research_tradeoff',{at:await read('State.civilization.elapsed'),choice:'reserve clinical stock before research; existing shipments still complete'});return true;}
 return false;
}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await pause(false);const deadline=Date.now()+60*60*1000;
while(Date.now()<deadline&&control.index<todo.length){if(stopping){await pause(true);save();done=true;ws.close();process.exit(75);}const s=await observe(),step=todo[control.index];if(await handle())continue;if(s.speed!==s.max){await raw('#speedButton');await raw('#event #speed_'+s.max);continue;}if(await capacity())continue;const module=step.module==='future'?'CivilFuture':'CivilEarth';if(s.at-control.last>=300){control.last=s.at;log('snapshot',{index:control.index,...s});console.log(JSON.stringify({at:s.at,index:control.index,next:step.key||step.label,reason:step.op?await read(`${module}.reason(State,${JSON.stringify(step.op)},${JSON.stringify(step.args)})`):null,pop:s.f?.counts.total,away:s.f?.away,health:s.f?.health,food:Math.floor(s.f?.stock.food||0)}));save();}
 let complete=false;if(step.op==='unity'&&s.g?.unity){log('already_effective_via_actual_rules',{at:s.at,op:step.op,unity:s.g.unity});complete=true;}else if(step.op){const why=await read(`${module}.reason(State,${JSON.stringify(step.op)},${JSON.stringify(step.args)})`);if(!why){await action(step);complete=true;}else if(await researchMaterials(step))continue;}
 else if(step.test)complete=await read(`(()=>{const g=CivilEarth.data(State),f=CivilFuture.data(State);return !!(${step.test});})()`);
 else if(step.duration){if(!control.since){control.since=s.at;save();}complete=s.at-control.since>=step.duration;}
 if(complete){if(step.label)await exportSave(step.label);control.index++;delete control.since;save();if(control.index<todo.length)await pause(false);}await sleep(600);
}
if(control.index<todo.length)throw Error('Unfinished; preserve browser and resume controller');done=true;console.log('A6 route complete',route);ws.close();
