// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9358',dir='/tmp/postwar-a3-budget-20261104/natural',mode='initial']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 await read(`(()=>{const e=${q(css)};if(e?.checkVisibility())e.scrollIntoView({block:'center',inline:'nearest'});})()`);await sleep(120);
 const box=await read(`(()=>{const e=${q(css)};if(!e||!e.checkVisibility()||e.classList.contains('disabled')||e.disabled)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText.slice(0,90)}:null;})()`);
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

const observe=()=>read(`(()=>{const s=State,c=s.civilization,a=CivilCityCouncil,l=CivilCityLabor,d=l.data(s);return {at:c.elapsed,seed:c.census.seed,world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,paused:!!CivilClock.paused,event:Events.activeEvent()?.title,pending:c.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),labor:d,budget:c.cityBudget,requests:a.ids(s).map(id=>({id,issues:CivilCityBudget.requests(s,id)})),homeCourses:CivilCityContinuity.local(s,'home').courses.length,maintenance:CivilCityHomes.data(s).estates,shipments:c.cityCouncil.shipments,homePolicy:CivilCityContinuity.local(s,'home').policy,projects:c.cityCouncil.projects.map(p=>({id:p.id,kind:p.kind,target:p.target,completedAt:p.completedAt,sites:p.sites})),cities:a.ids(s).map(id=>({id,population:CivilCity.count(a.local(s,id)),health:a.local(s,id).health,stable:a.local(s,id).stable,stores:a.local(s,id).stores,workers:a.local(s,id).workers,economy:a.local(s,id).economy,allowance:a.allowance(s,id),beds:CivilCityHomes.freeBeds(s,id),build:l.buildReason(s,id),ready:l.ready(s,id),qualified:l.count(l.qualifiedAt(s,id,c.elapsed)),dispatched:l.count(l.skilledGroups(s,id)),quota:a.data(s).offices[id].quota,order:l.contract(s,id)?l.departureReason(s,l.contract(s,id)):null})),homeBridge:l.orderReason(s,'home','bridge',24),ridgeBlocked:l.orderReason(s,'home','ridge',24)};})()`);
async function pause(value){for(let attempt=0;attempt<5;attempt++){if(await read('!!CivilClock.paused')===value)return;const state=await observe();if(state.event&&state.pending){const key=state.pending==='succession'?'engineer':state.pending==='cold'?'wood':state.pending==='roadIncident'?'repair':null;if(!key||!state.buttons.includes(key))throw Error('Unknown decision before pause');await raw('#event #'+key);continue;}await raw('#speedButton');await raw('#event #pause');}if(await read('!!CivilClock.paused')!==value)throw Error('Pause action failed');}
async function council(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_link');await click('#cityNet_council');}
async function exportSave(label){await pause(true);await council();if(!await read("document.querySelector('#cityBudgetDesk')?.open"))await click('#cityBudgetDesk > summary');const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('export not available');await sleep(1500);await raw('#event #close');const snapshot=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(snapshot,null,2));const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(img.result.data,'base64'));log('export',{label,at:snapshot.at});}
async function choose(city){await council();await select('#laborChoice_city',city);}
async function order(from,to,task){await choose(to);await select('#laborChoice_source',from);await select('#laborChoice_task',task);await select('#laborChoice_size','24');if(!await click('#labor_order'))throw Error('Order unavailable '+from+' / '+to+' / '+task);}
async function cooperative(mode){await council();await select('#homesChoice_city','home');await select('#homesChoice_mode',mode);if(await read('CivilCityHomes.estate(State,"home").mode')!==mode&&!await click('#homes_mode'))throw Error('Cooperative method unavailable');}
async function training(policy){await council();await select('#continuityChoice_city','home');await select('#continuityChoice_policy',policy);if(await read('CivilCityContinuity.local(State,"home").policy')!==policy&&!await click('#continuity_policy'))throw Error('Training policy unavailable');}
async function quota(city,value){await council();await select('#councilChoice_city',city);await select('#councilChoice_quota',value);if(await read(`CivilCityCouncil.data(State).offices[${JSON.stringify(city)}].quota`)!==value&&!await click('#council_quota'))throw Error('Quota unavailable');}

async function budget(scope,mode){await council();await select('#budgetChoice_scope',scope);await select('#budgetChoice_mode',mode);if(await read(`CivilCityBudget.applyReason(State,${JSON.stringify(scope)},${JSON.stringify(mode)})`)==='各城已按此安排办理')return;if(!await click('#budget_apply'))throw Error('Budget decision unavailable');}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();if(s.event){const key=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!key||!s.buttons.includes(key))throw Error('Resolve event before pause');await raw('#event #'+key);s=await observe();}await pause(true);await council();
const file=path.join(dir,'controller.json'),control=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{stage:'setup',start:s.at,initial:s.labor.shifts.length,courses:s.homeCourses,last:0};
const save=()=>fs.writeFileSync(file,JSON.stringify(control));if(control.stage!=='setup')await pause(false);const deadline=Date.now()+25*60*1000;
while(Date.now()<deadline){s=await observe();if(s.at-control.last>=240){control.last=s.at;log('snapshot',{at:s.at,stage:control.stage,requests:s.requests,homeCourses:s.homeCourses,cities:s.cities.map(c=>({id:c.id,population:c.population,health:c.health,stable:c.stable,allowance:c.allowance,why:c.order})),newShifts:s.labor.shifts.slice(control.initial).map(p=>({id:p.id,rounds:p.rounds.length,earned:p.earned,reason:p.reason,phase:p.phase}))});console.log(JSON.stringify({at:s.at,stage:control.stage,requests:s.requests,newShifts:s.labor.shifts.slice(control.initial).map(p=>({id:p.id,rounds:p.rounds.length,reason:p.reason,phase:p.phase}))}));}save();
 if(s.event){const key=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!key||!s.buttons.includes(key))throw Error('Unrecognised event '+s.event);await raw('#event #'+key);continue;}
 const fresh=s.labor.shifts.slice(control.initial);
 if(control.stage==='setup'){
  await pause(true);await budget('all','balanced');await cooperative('food');await order('home','home','tools');await exportSave('247_shared_budget');await quota('home','careful');control.cutAt=(await observe()).at;control.stage='crisis';save();await pause(false);
 }else if(control.stage==='crisis'&&s.at-control.cutAt>=360&&s.requests.find(r=>r.id==='home').issues.some(r=>r.kind==='maintenance')){
  await exportSave('248_local_maintenance_request');await budget('all','balanced');control.recoverAt=(await observe()).at;control.stage='recover';save();await pause(false);
 }else if(control.stage==='recover'&&fresh.some(p=>p.at>=control.recoverAt&&p.rounds.length>=10&&p.finishedAt!==null&&(p.reason===null||p.reason==='当地储备已足，结束本班'))&&!s.requests.find(r=>r.id==='home').issues.some(r=>r.kind==='maintenance')){
  await exportSave('249_budget_recovery');await budget('all','delivery');await select('#councilChoice_project','housing:lake');await select('#councilChoice_scale','neighborhood');await select('#councilChoice_mode','specialist');if(!await click('#council_propose'))throw Error('Common project unavailable');control.project=await read('CivilCityCouncil.data(State).projects.at(-1).id');if(!await read('CivilCityCouncil.data(State).proposals.at(-1).accepted'))throw Error('Proposal rejected; inspect real local requests');control.stage='project';save();await pause(false);
 }else if(control.stage==='project'&&!control.midway&&s.shipments.some(p=>p.project===control.project&&p.deliveredAt!==null)&&s.projects.find(p=>p.id===control.project).completedAt===null){
  await exportSave('250_specialist_supply');control.midway=true;save();await pause(false);
 }else if(control.stage==='project'&&s.projects.find(p=>p.id===control.project).completedAt!==null){
  await exportSave('251_lake_community');await budget('all','balanced');control.afterAt=(await observe()).at;control.stage='sustain';save();await pause(false);
 }else if(control.stage==='sustain'&&s.at-control.afterAt>=1800&&s.cities.every(c=>c.health>=95&&c.stable>=120)&&!s.requests.some(r=>r.issues.some(x=>x.kind==='maintenance'))){
  await pause(true);await choose('home');if(!await click('#labor_cancel'))throw Error('Cancel unavailable');control.stage='settle';save();await pause(false);
 }else if(control.stage==='settle'&&s.labor.shifts.every(p=>p.finishedAt!==null)&&s.shipments.every(p=>p.deliveredAt!==null&&p.legs.every(l=>l.finishedAt!==null))){
  await exportSave('252_shared_services_settled');control.stage='done';save();done=true;break;
 }else if(control.stage==='done'){done=true;break;}await sleep(900);
}
if(!done)throw Error('Unfinished; retain browser and controller');console.log('ACCEPTED',JSON.stringify(control));ws.close();
