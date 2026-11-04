// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9348',dir='/tmp/postwar-a3-council-20261104/evidence',route='industry']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
const observe=()=>read(`(()=>{const s=State,c=s.civilization,a=CivilCityCouncil;return {at:c.elapsed,seed:c.census.seed,world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,paused:CivilClock.paused,speed:c.speed,max:c.maxSpeed,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),council:c.cityCouncil,offices:a.data(s)?a.ids(s).map(id=>({id,active:a.activeOffice(s,id),request:a.request(s,id),health:a.local(s,id).health,stable:a.local(s,id).stable})):[]};})()`);
async function tab(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);if(await read('!!State.civilization.cityCouncil?.locals.estuary?.node'))await click('#council_go_link');else await click('#metroCity_select_link');}
async function council(){await tab();await click('#cityNet_council');}
async function pause(value){if(await read('CivilClock.paused')===value)return;await raw('#speedButton');await raw('#event #pause');if(await read('CivilClock.paused')!==value)throw Error('Pause action failed');}
async function run(){await pause(false);if(await read('State.civilization.speed<State.civilization.maxSpeed')){await raw('#speedButton');const id=await read("[...document.querySelectorAll('#event .button')].find(e=>e.innerText.startsWith(State.civilization.maxSpeed+'×'))?.id");if(id)await raw('#event #'+id);}}
async function exportSave(label){await pause(true);const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});await raw('#saveMenu');await raw('#event #download');await sleep(1500);await raw('#event #close');const snapshot=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(snapshot,null,2));const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(img.result.data,'base64'));log('export',{label,at:snapshot.at});}
async function mandate(enabled){await council();await select('#councilChoice_city','home');if(!await click('#council_toggle'))throw Error('mandate button unavailable');if(await read('State.civilization.cityCouncil.offices.home.enabled')!==enabled)throw Error('mandate did not change');}
async function propose(project,mode,accepted=true){await council();await select('#councilChoice_project',project);await select('#councilChoice_mode',mode);if(!await click('#council_propose'))throw Error('proposal button unavailable');const p=await read('State.civilization.cityCouncil.proposals.at(-1)');log('proposal',{proposal:p});if(p.kind+':'+p.target!==project||p.mode!==mode||p.accepted!==accepted)throw Error('Unexpected proposal result '+JSON.stringify(p));}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{start:s.at,seed:s.seed,stage:'form',last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));
const saveControl=()=>fs.writeFileSync(stateFile,JSON.stringify(control));const deadline=Date.now()+30*60*1000;
while(Date.now()<deadline){
 s=await observe();if(s.seed!==control.seed)throw Error('World changed');const d=s.council;
 if(s.at-control.last>=120){control.last=s.at;log('snapshot',s);console.log(JSON.stringify({at:s.at,stage:control.stage,projects:d?.projects.map(p=>({kind:p.kind,target:p.target,done:p.completedAt})),shipments:d?.shipments.length,offices:s.offices}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}saveControl();
 if(s.event){const b=['engineer','wood','medicine','later','close','public'].map(id=>s.buttons.find(b=>b.id===id)).find(Boolean)||s.buttons[0];if(b)await raw('#event #'+b.id);continue;}
 if(s.paused||s.speed<s.max){await run();continue;}
 if(control.stage==='form'){await tab();await click('#cityNet_tab_overview');if(!await click('#cityNet_formCouncil'))throw Error('Cannot fund stations');control.stage='stations';}
 else if(control.stage==='stations'){if(s.offices.length===3&&s.offices.every(o=>o.active)){await propose('housing:lake','equal');control.stage='dispatch';}}
 else if(control.stage==='dispatch'){if(d.shipments.some(p=>p.source==='ridge')){await mandate(false);control.cutAt=(await observe()).at;control.stage='hold';}}
 else if(control.stage==='hold'){if(s.at-control.cutAt>=650){const p=d.shipments.find(p=>p.source==='ridge');if(!p||p.deliveredAt!==null||p.legs.length!==1||p.legs[0].status!=='complete')throw Error('Expected held material at home hub');await council();await click('#councilFreight > summary');await exportSave('218_hub_hold');control.stage='restore';saveControl();await run();}}
 else if(control.stage==='restore'){await mandate(true);control.stage='firstComplete';}
 else if(control.stage==='firstComplete'){if(d.projects[0].completedAt!==null){await council();await exportSave('219_shared_housing');control.stage='contest';saveControl();await run();}}
 else if(control.stage==='contest'){await propose('housing:lake','equal',false);await propose('housing:home','beneficiary');await click('#council_survey');control.stage='balance';}
 else if(control.stage==='balance'){
   if(!d.locals.estuary){await council();await click('#council_survey');}
   else if(d.locals.estuary.node&&!d.offices.estuary&&d.locals.estuary.node.stable>=120){await council();if(!await click('#council_join'))throw Error('Cannot register estuary');}
   else if(d.projects.at(-1).completedAt!==null&&s.offices.find(o=>o.id==='estuary')?.active){await council();await exportSave('221_local_responsibility');control.stage='river';saveControl();await run();}
 }
 else if(control.stage==='river'){await propose('road:river','self');control.stage='riverWorks';}
 else if(control.stage==='riverWorks'){if(d.projects.at(-1).completedAt!==null){await propose('road:cross','self');control.stage='crossWorks';}}
 else if(control.stage==='crossWorks'){if(d.projects.at(-1).completedAt!==null){await council();await exportSave('222_four_city_routes');control.stage='specialist';saveControl();await run();}}
 else if(control.stage==='specialist'){await propose('housing:ridge','specialist');control.stage='delivery';}
 else if(control.stage==='delivery'){
   if(d.projects.at(-1).completedAt!==null&&d.shipments.some(p=>p.source==='estuary'&&p.deliveredAt!==null)&&s.offices.every(o=>o.health>=95&&o.stable>=120)){await council();await click('#councilFreight > summary');await exportSave('223_clinical_contribution');control.stage='done';saveControl();done=true;break;}
 }else if(control.stage==='done'){done=true;break;}
 await sleep(1200);
}
if(!done)throw Error('Unfinished: preserve this browser/native evidence and resume controller');console.log('ACCEPTED',JSON.stringify(control));ws.close();
