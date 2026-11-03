// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9346',dir='/tmp/postwar-a3-third-20261104/evidence',route='industry']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 const info=await read(`(()=>{const e=${q(css)};return e?{panel:e.closest('.location')?.id,folds:[...document.querySelectorAll('details:not([open])')].filter(d=>d.contains(e)).map(d=>d.id)}:null;})()`);if(!info)return false;
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
const observe=()=>read(`(()=>{const s=State,c=s.civilization;return {at:c.elapsed,seed:c.census.seed,world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,home:CivilCity.population(s),speed:c.speed,max:c.maxSpeed,paused:CivilClock.paused,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),wards:c.city.wards,lake:c.conurbation,network:c.cityNetwork};})()`);
async function tab(id='link'){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#metroCity_select_'+id);}
async function pause(value){if(await read('CivilClock.paused')===value)return;await raw('#speedButton');await raw('#event #pause');}
async function run(){await pause(false);if(await read('State.civilization.speed<State.civilization.maxSpeed')){await raw('#speedButton');const id=await read("[...document.querySelectorAll('#event .button')].find(e=>e.innerText.startsWith(State.civilization.maxSpeed+'×'))?.id");if(id)await raw('#event #'+id);}}
async function exportSave(label){await pause(true);const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});await raw('#saveMenu');await raw('#event #download');await sleep(1500);await raw('#event #close');const snapshot=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(snapshot,null,2));const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(img.result.data,'base64'));log('export',{label,at:snapshot.at});}
async function budget(id,value){await tab();await click('#cityNet_tab_budget');await select('#cityNetChoice_budgetCity',id);await select('#cityNetChoice_budgetValue',value);return click('#cityNet_budget');}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();if(s.home<10000||!s.lake?.clusterAt)throw Error('Import native 213 / 214 first');
const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{start:s.at,seed:s.seed,stage:'connect',last:0,queued:false,overlap:false};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));
const deadline=Date.now()+30*60*1000;
while(Date.now()<deadline){
 s=await observe();if(s.seed!==control.seed)throw Error('World changed');const d=s.network;
 if(s.at-control.last>=120){control.last=s.at;log('snapshot',{at:s.at,stage:control.stage,world:s.world,home:s.home,network:d?{population:d.node?.cohorts.reduce((a,c)=>a+c.count,0),health:d.node?.health,stable:d.node?.stable,work:d.node?.workers,stores:d.node?.stores,ships:d.trips.length,waiting:d.waiting,budget:d.budget,inspections:d.inspections,expansion:d.expansion}:null});console.log(JSON.stringify({at:s.at,stage:control.stage,ships:d?.trips.length,waiting:d?.waiting,health:d?.node?.health}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}
 fs.writeFileSync(stateFile,JSON.stringify(control));
 if(s.event){const b=['engineer','wood','medicine','later','close','public'].map(id=>s.buttons.find(b=>b.id===id)).find(Boolean)||s.buttons[0];if(b)await raw('#event #'+b.id);continue;}
 if(s.paused||s.speed<s.max){await run();continue;}
 if(!d){await tab();await click('#metroCity_network');await sleep(600);continue;}
 if((d.waiting.lake!==null||d.waiting.ridge!==null)&&!d.expansion?.completedAt){if(!control.queued){log('shared_fleet_queue',{at:s.at,waiting:d.waiting,legacy:s.lake.trips.at(-1),ridge:d.trips.at(-1)});}control.queued=true;}
 const active=(s.lake.trips.some(p=>['outbound','returning','recalled'].includes(p.status))?1:0)+(d.trips.some(p=>p.status!=='complete')?1:0);if(active===2){if(!control.overlap)log('two_fleet_overlap',{at:s.at,expansion:d.expansion,legacy:s.lake.trips.at(-1),ridge:d.trips.at(-1)});control.overlap=true;}
 if(!d.survey){await tab();await click('#cityNet_tab_overview');await click('#cityNet_survey');continue;}
 if(!d.node){await sleep(1500);continue;}
 if(!d.road){await tab();await click('#cityNet_tab_overview');await click('#cityNet_build');await sleep(1500);continue;}
 if(!d.road.completedAt){await sleep(1500);continue;}
 if(!d.enabled){await tab();await click('#cityNet_tab_transport');await click('#cityNet_enable');continue;}
 if(control.stage==='connect'){
   if(d.trips.filter(p=>p.deliveredAt!==null).length>=3&&control.queued&&d.node.health>=95&&d.node.stable>=120){await tab();await click('#cityNet_tab_transport');await exportSave('215_three_cities');control.stage='cut';fs.writeFileSync(stateFile,JSON.stringify(control));await run();}
 }else if(control.stage==='cut'){
   if(d.budget.ridge!=='hold'){await budget('ridge','hold');control.cutAt=(await observe()).at;control.cutTrips=d.trips.length;control.stage='failure';fs.writeFileSync(stateFile,JSON.stringify(control));}
 }else if(control.stage==='failure'){
   if(s.at-control.cutAt>=620&&d.node.workers.smelter===0&&active<=1&&!d.trips.some(p=>p.status!=='complete')){await tab('ridge');await exportSave('216_budget_hold');control.baseTrips=d.trips.length;control.baseIron=d.node.budget.produced.iron;control.stage='recover';fs.writeFileSync(stateFile,JSON.stringify(control));await run();}
 }else if(control.stage==='recover'){
   if(d.budget.ridge!=='expand'){await budget('ridge','expand');continue;}
   if(d.budget.home!=='expand'){await budget('home','expand');continue;}
   if(d.priority!=='industry'){await tab();await click('#cityNet_tab_transport');await select('#cityNetChoice_priority','industry');await click('#cityNet_priority');continue;}
   if(!d.expansion){await tab();await click('#cityNet_tab_transport');await select('#cityNetChoice_method',route==='industry'?'steel':'timber');await click('#cityNet_expand');await sleep(1500);continue;}
   if(d.expansion.completedAt!==null&&control.overlap&&d.trips.filter(p=>p.deliveredAt!==null).length>=control.baseTrips+4&&d.node.budget.produced.iron>control.baseIron&&d.node.health>=95&&d.node.stable>=120&&s.lake.node.health>=95&&s.lake.node.stable>=120){await tab();await click('#cityNet_tab_transport');await exportSave('217_recovered_fleet');control.stage='done';fs.writeFileSync(stateFile,JSON.stringify(control));done=true;break;}
 }
 await sleep(1500);
}
if(!done)throw Error('Unfinished: preserve current browser/native evidence and resume controller');console.log('ACCEPTED',JSON.stringify({at:(await observe()).at,control}));ws.close();
