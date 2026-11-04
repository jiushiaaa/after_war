// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9352',dir='/tmp/postwar-a3-continuity-20261104/evidence']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0,done=false;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
ws.onclose=()=>{if(!done){console.error('Disconnected; retain browser and resume this existing save.');process.exit(2);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),q=css=>`document.querySelector(${JSON.stringify(css)})`;
const log=(kind,data)=>fs.appendFileSync(path.join(dir,'actions.ndjson'),JSON.stringify({wall:new Date().toISOString(),kind,...data})+'\n');
async function raw(css){
 await read(`(()=>{const e=${q(css)};if(e?.getClientRects().length)e.scrollIntoView({block:'center',inline:'nearest'});})()`);await sleep(120);
 const box=await read(`(()=>{const e=${q(css)};if(!e||!e.getClientRects().length||e.classList.contains('disabled')||e.disabled)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText.slice(0,90)}:null;})()`);
 if(!box)return false;for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});log('click',{css,...box});await sleep(250);return true;
}
async function click(css){
 const info=await read(`(()=>{const e=${q(css)};return e?{panel:e.closest('.location')?.id,folds:[...document.querySelectorAll('details:not([open])')].filter(d=>d.contains(e)&&e!==d.querySelector(':scope > summary')).map(d=>d.id)}:null;})()`);if(!info)return false;
 if(info.panel){const id=info.panel.replace(/Panel$/,'');if(!await read(`${q('#location_'+id)}?.classList.contains('selected')`))await raw('#location_'+id);for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);}
 for(const id of info.folds)await raw('#'+id+' > summary');return raw(css);
}
async function select(css,value){
 if(!await click(css))return false;
 if(await read(`${q(css)}.size>1`)){await raw(css+' option[value="'+value+'"]');const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native list selection did not change: '+css);return true;}
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}

const observe=()=>read(`(()=>{const s=State,c=s.civilization,a=CivilCityCouncil,x=CivilCityContinuity,d=x.data(s),o=d?.offices.home;return {at:c.elapsed,seed:c.census.seed,world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,paused:!!CivilClock.paused,speed:c.speed,event:Events.activeEvent()?.title,pending:c.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),continuity:d?{town:{terms:d.town.terms,training:d.town.training,successor:d.town.successor,last:d.town.records.at(-1)},office:{...o,certificates:o.certificates.map(c=>({kind:c.kind,at:c.at,count:x.count(c.cohorts)})),services:o.services.length},invites:d.invites,qualified:x.count(x.qualified(s,'home')),waiting:x.count(x.waiting(s,'home')),inviteReason:x.inviteReason(s,'home')}:null,homes:c.cityHomes?{estate:c.cityHomes.estates.home,trips:c.cityHomes.trips.map(p=>({id:p.id,order:p.order,phase:p.phase,outcome:p.outcome,at:p.at,settledAt:p.settledAt,dead:p.dead}))}:null,registry:c.cityRegistry,registryReason:CivilCityRegistry.reason(s),projects:c.cityCouncil.projects.map(p=>({id:p.id,kind:p.kind,target:p.target,done:p.completedAt})),cities:a.ids(s).map(id=>({id,population:CivilCity.count(a.local(s,id)),health:a.local(s,id).health,stable:a.local(s,id).stable,workers:a.local(s,id).workers,stores:a.local(s,id).stores,worked:a.local(s,id).economy?.worked,quota:a.data(s).offices[id]?a.allowance(s,id):null}))};})()`);
async function pause(value){if(await read('!!CivilClock.paused')===value)return;await raw('#speedButton');await raw('#event #pause');if(await read('!!CivilClock.paused')!==value)throw Error('Pause action failed');}
async function council(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_link');await click('#cityNet_council');}
async function exportSave(label){await pause(true);const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('export not available');await sleep(1500);await raw('#event #close');const snapshot=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(snapshot,null,2));const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(img.result.data,'base64'));log('export',{label,at:snapshot.at});}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{start:s.at,seed:s.seed,stage:'found',last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));const saveControl=()=>fs.writeFileSync(stateFile,JSON.stringify(control));const deadline=Date.now()+35*60*1000;
while(Date.now()<deadline){
 s=await observe();if(s.seed!==control.seed)throw Error('World changed');
 if(s.at-control.last>=120){control.last=s.at;log('snapshot',s);console.log(JSON.stringify({at:s.at,stage:control.stage,term:s.continuity?.town.terms.length,course:s.continuity?.office.training?.rounds,completed:s.continuity?.office.courses.length,qualified:s.continuity?.qualified,invites:s.continuity?.invites.length,reason:s.registryReason}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}saveControl();
 if(s.event){const key=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!key||!s.buttons.some(b=>b.id===key))throw Error('Unrecognized decision '+s.event+' / '+s.pending);await raw('#event #'+key);continue;}
 if(control.stage==='found'){await pause(true);await council();if(!await click('#continuity_found'))throw Error('handover unavailable');control.stage='build';saveControl();await pause(false);}
 else if(control.stage==='build'&&s.continuity.office.completedAt!==null){await pause(true);await council();await select('#continuityChoice_policy','linked');if(!await click('#continuity_policy'))throw Error('hiring unavailable');await exportSave('228_handover_and_workshop');control.stage='learn';saveControl();await pause(false);}
 else if(control.stage==='learn'&&s.continuity.office.training?.rounds>=8){await pause(true);await council();if(!await click('#continuity_enabled'))throw Error('pause office unavailable');control.pauseAt=(await observe()).at;control.rounds=(await observe()).continuity.office.training.rounds;control.stage='paused';saveControl();await pause(false);}
 else if(control.stage==='paused'&&s.at>=control.pauseAt+300){if(s.continuity.office.training.rounds!==control.rounds)throw Error('course progressed while paused');await council();await exportSave('229_paused_course');if(!await click('#continuity_enabled'))throw Error('restore unavailable');control.stage='recover';saveControl();await pause(false);}
 else if(control.stage==='recover'&&s.continuity.office.courses.some(t=>t.status==='completed')&&s.homes.trips.slice(5).some(p=>p.outcome==='arrived')){await council();await exportSave('230_hiring_and_recovery');control.stage='handover';saveControl();await pause(false);}
 else if(control.stage==='handover'&&s.continuity.town.terms.length>=2&&!s.registryReason){await pause(true);await council();await exportSave('232_retirement_handover');control.stage='survey_start';saveControl();done=true;break;}
 else if(control.stage==='survey_start'){await pause(true);await council();if(!await click('#registry_survey'))throw Error('survey unavailable');control.stage='survey';saveControl();await pause(false);}
 else if(control.stage==='survey'&&s.registry?.finishedAt!==null&&s.registry&&s.cities.some(c=>c.id==='bridge'&&c.stable>=120)){await pause(true);await council();if(!await click('#registry_join'))throw Error('station unavailable');control.stage='station';saveControl();await pause(false);}
 else if(control.stage==='station'&&await read('CivilCityCouncil.activeOffice(State,"bridge")')){await pause(true);await council();await select('#councilChoice_project','road:academy');await select('#councilChoice_mode','self');if(!await click('#council_propose'))throw Error('road unavailable');if(!await read('State.civilization.cityCouncil.proposals.at(-1).accepted'))throw Error('road refused');control.stage='road';saveControl();await pause(false);}
 else if(control.stage==='road'&&s.projects.some(p=>p.target==='academy'&&p.done!==null)&&s.cities.every(c=>c.health>=95&&c.stable>=120)){await council();await exportSave('233_five_cities');control.stage='done';saveControl();done=true;break;}
 else if(control.stage==='done'){done=true;break;}
 await sleep(900);
}
if(!done)throw Error('Unfinished: retain browser and controller');console.log(control.stage==='done'?'ACCEPTED':'CHECKPOINT_FOR_NATIVE_REIMPORT',JSON.stringify(control));ws.close();
