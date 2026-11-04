// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9354',dir='/tmp/postwar-a3-labor-20261104/evidence',mode='initial']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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

const observe=()=>read(`(()=>{const s=State,c=s.civilization,a=CivilCityCouncil,l=CivilCityLabor,d=l.data(s);return {at:c.elapsed,seed:c.census.seed,world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,paused:!!CivilClock.paused,event:Events.activeEvent()?.title,pending:c.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),labor:d,homePolicy:CivilCityContinuity.local(s,'home').policy,cities:a.ids(s).map(id=>({id,population:CivilCity.count(a.local(s,id)),health:a.local(s,id).health,stable:a.local(s,id).stable,stores:a.local(s,id).stores,workers:a.local(s,id).workers,economy:a.local(s,id).economy,allowance:a.allowance(s,id),beds:CivilCityHomes.freeBeds(s,id),build:l.buildReason(s,id),ready:l.ready(s,id),order:l.contract(s,id)?l.departureReason(s,l.contract(s,id)):null})),homeBridge:l.orderReason(s,'home','bridge',24),ridgeBlocked:l.orderReason(s,'home','ridge',24)};})()`);
async function pause(value){if(await read('!!CivilClock.paused')===value)return;await raw('#speedButton');await raw('#event #pause');if(await read('!!CivilClock.paused')!==value)throw Error('Pause action failed');}
async function council(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_link');await click('#cityNet_council');}
async function exportSave(label){await pause(true);await council();if(!await read("document.querySelector('#cityLaborDesk')?.open"))await click('#cityLaborDesk > summary');const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('export not available');await sleep(1500);await raw('#event #close');const snapshot=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(snapshot,null,2));const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(img.result.data,'base64'));log('export',{label,at:snapshot.at});}
async function choose(city){await council();await select('#laborChoice_city',city);}
async function order(from,to){await choose(to);await select('#laborChoice_source',from);await select('#laborChoice_size','24');if(!await click('#labor_order'))throw Error('Order unavailable '+from+' / '+to);}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{start:s.at,seed:s.seed,stage:mode==='recovery'?'resume':'setup',last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));const saveControl=()=>fs.writeFileSync(stateFile,JSON.stringify(control));const deadline=Date.now()+25*60*1000;
while(Date.now()<deadline){s=await observe();if(s.seed!==control.seed)throw Error('World changed');if(s.at-control.last>=120){control.last=s.at;log('snapshot',s);console.log(JSON.stringify({at:s.at,stage:control.stage,cities:s.cities.map(c=>({id:c.id,ready:c.ready,beds:c.beds,stable:c.stable,why:c.order})),shifts:s.labor?.shifts.map(p=>({id:p.id,to:p.to,phase:p.phase,rounds:p.rounds.length,earned:p.earned,reason:p.reason}))}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}saveControl();
 if(s.event){const key=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!key||!s.buttons.includes(key))throw Error('Unrecognized decision '+s.event+' / '+s.pending);await raw('#event #'+key);continue;}
 if(control.stage==='setup'){
   await pause(true);await council();if(s.homePolicy!=='local'){await select('#continuityChoice_policy','local');if(!await click('#continuity_policy'))throw Error('Local succession policy unavailable');}
   for(const c of s.cities)if(c.build===null){await choose(c.id);if(!await click('#labor_build'))throw Error('Build unavailable '+c.id);}
   const now=await observe();if(now.cities.every(c=>now.labor?.offices[c.id]))control.stage='construct';saveControl();await pause(false);
 }else if(control.stage==='construct'&&s.cities.every(c=>c.ready)){await exportSave('234_five_city_jobs');control.stage='first_order';saveControl();await pause(false);}
 else if(control.stage==='first_order'&&!s.homeBridge){await pause(true);await order('home','bridge');control.stage='first_work';saveControl();await pause(false);}
 else if(control.stage==='first_work'&&s.labor.shifts[0]?.rounds.length>=5){await exportSave('235_commuting_and_escrow');await choose('bridge');if(!await click('#labor_toggle'))throw Error('Pause labor unavailable');control.pauseAt=(await observe()).at;control.stage='return';saveControl();await pause(false);}
 else if(control.stage==='return'&&s.labor.shifts[0]?.finishedAt!==null){await exportSave('236_early_return_and_salary');control.stage='resume';saveControl();}
 else if(control.stage==='resume'){await pause(true);await choose('bridge');if(!await click('#labor_toggle'))throw Error('Resume labor unavailable');control.stage='recovery';control.locals=[];saveControl();await pause(false);}
 else if(control.stage==='recovery'){
   for(const id of ['home','lake','ridge','estuary'])if(!control.locals.includes(id)&&!await read(`CivilCityLabor.orderReason(State,${JSON.stringify(id)},${JSON.stringify(id)},24)`)){await pause(true);await order(id,id);control.locals.push(id);saveControl();await pause(false);}
   const now=await observe();if(now.labor.shifts.some(p=>p.to==='bridge'&&p.id>1&&p.rounds.length===30&&p.finishedAt!==null)&&control.locals.length===4){await pause(true);for(const id of now.cities.map(c=>c.id)){await choose(id);if(await read(`!!CivilCityLabor.contract(State,${JSON.stringify(id)})`))if(!await click('#labor_cancel'))throw Error('Cancel future work unavailable');}control.stage='settle';saveControl();await pause(false);}
 }else if(control.stage==='settle'&&s.labor.shifts.every(p=>p.finishedAt!==null)&&s.cities.every(c=>c.health>=95&&c.stable>=120)){await exportSave(mode==='recovery'?'238_public_teaching_and_commuting':'237_five_city_work_recovered');control.stage='done';saveControl();done=true;break;}
 else if(control.stage==='done'){done=true;break;}
 await sleep(900);
}
if(!done)throw Error('Unfinished: retain browser and controller');console.log('ACCEPTED',JSON.stringify(control));ws.close();
