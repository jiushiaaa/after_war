// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9344',dir='/tmp/postwar-a3-20261104/industrial-evidence',route='industry']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
const observe=()=>read(`(()=>{const s=State,c=s.civilization;return {at:c.elapsed,seed:c.census.seed,population:CivilCity.population(s),global:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,speed:c.speed,max:c.maxSpeed,paused:CivilClock.paused,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),local:c.city.wards,network:c.conurbation};})()`);
async function tab(id){await click('#location_city');for(let k=0;k<25&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);if(id)await click('#metroCity_select_'+id);}
async function freeze(){await raw('#speedButton');await raw('#event #pause');}
async function run(){await raw('#speedButton');if(await read('CivilClock.paused===true')){await raw('#event #pause');return;}const id=await read("[...document.querySelectorAll('#event .button')].filter(e=>!e.classList.contains('disabled')).find(e=>e.innerText.startsWith(State.civilization.maxSpeed+'×'))?.id");if(id)await raw('#event #'+id);}
async function exportSave(label){await freeze();const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});await raw('#saveMenu');await raw('#event #download');await sleep(1200);await raw('#event #close');const s=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(s,null,2));const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(image.result.data,'base64'));log('export',{label,at:s.at});}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();if(s.population<10000)throw Error('Import the existing natural city first');
const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{start:s.at,seed:s.seed,stage:'connect',last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));
const deadline=Date.now()+35*60*1000;
while(Date.now()<deadline){
 s=await observe();if(s.seed!==control.seed)throw Error('World changed');const d=s.network;
 if(s.at-control.last>=240){control.last=s.at;log('snapshot',{at:s.at,stage:control.stage,pop:s.population,network:d?{population:d.node?.cohorts.reduce((a,c)=>a+c.count,0),health:d.node?.health,stable:d.node?.stable,tools:d.node?.stores.tools,smith:d.node?.workers.smith,shipments:d.trips.length,arrived:d.trips.filter(p=>p.deliveredAt!==null).length}:null});console.log(JSON.stringify({at:s.at,stage:control.stage,ships:d?.trips.length,health:d?.node?.health,stable:d?.node?.stable}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}
 fs.writeFileSync(stateFile,JSON.stringify(control));
 if(s.event){const b=['engineer','wood','medicine','later','close','public'].map(id=>s.buttons.find(b=>b.id===id)).find(Boolean)||s.buttons[0];if(b)await raw('#event #'+b.id);continue;}
 if(s.paused||s.speed<s.max){await run();continue;}
 if(!d){await tab();await click('#cityView_overview');await click('#metroCity_survey');continue;}
 if(!d.node){await sleep(1800);continue;}
 if(!d.route){await tab('link');await select('#metroCityChoice_depot',route==='industry'?'yards':'canal');await click('#metroCity_build');continue;}
 if(d.route.phase!=='ready'){await sleep(1800);continue;}
 if(control.stage==='connect'){
   if(!d.contract){await tab('link');await select('#metroCityChoice_mode',route==='industry'?'industry':'provisions');await click('#metroCity_sign');continue;}
   if(!d.workshop){await tab('lake');await click('#metroCity_tab_assets');await click(route==='industry'?'#metroCity_workshopIron':'#metroCity_workshopTimber');}
   if(d.clusterAt!==null&&d.workshop?.completedAt!==null&&d.workshop&&d.office.records.length>0&&d.node.health>=95&&d.node.stable>=120&&d.trips.filter(p=>p.deliveredAt!==null).length>=4){
      await tab('link');await exportSave('connected');control.stage=route==='industry'?'burden':'done';fs.writeFileSync(stateFile,JSON.stringify(control));if(control.stage==='done'){done=true;break;}await run();
   }
 }else if(control.stage==='burden'){
   if(d.share!=='host'){await tab('link');await select('#metroCityChoice_share','host');await click('#metroCity_share');continue;}
   const active=d.trips.find(p=>p.status==='outbound');
   if(d.trips.some(p=>p.share==='host'&&p.deliveredAt!==null)&&active&&active.remaining<145&&active.remaining>50){await tab('link');await click('#metroCity_pause');control.cutAt=(await observe()).at;control.beforeCut=JSON.parse(JSON.stringify(d.node));control.stage='interruption';await exportSave('interrupted');fs.writeFileSync(stateFile,JSON.stringify(control));await run();}
 }else if(control.stage==='interruption'){
   if(!d.suspended)throw Error('Expected the user-visible supply stop');
   if(s.at-control.cutAt>=1000&&!d.trips.some(p=>['outbound','returning','recalled'].includes(p.status))){control.recoveryBase={at:s.at,produced:d.node.budget.produced,consumed:d.node.budget.consumed,workers:d.node.workers,stores:d.node.stores};fs.writeFileSync(path.join(dir,'local-fallback.json'),JSON.stringify(s,null,2));await tab('link');await click('#metroCity_end');control.stage='recover';}
 }else if(control.stage==='recover'){
   if(!d.contract){await tab('link');await select('#metroCityChoice_mode','provisions');await click('#metroCity_sign');continue;}
   const restored=d.trips.filter(p=>p.mode==='provisions'&&p.deliveredAt!==null);
   if(restored.length>=4&&restored.some(p=>p.out.medicine>0)&&d.node.health>=95&&d.node.stable>=120&&Object.values(s.local).every(n=>n.health>=95&&n.stable>=120)&&d.payments.length>=2){await tab('link');await exportSave('recovered');control.stage='done';fs.writeFileSync(stateFile,JSON.stringify(control));done=true;break;}
 }
 await sleep(1800);
}
if(!done)throw Error('Natural A3 incomplete; keep browser and resume controller');
console.log('ACCEPTED',JSON.stringify({at:(await observe()).at,route}));ws.close();
