// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9350',dir='/tmp/postwar-a3-homes-20261104/evidence',route='industry']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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

const observe=()=>read(`(()=>{const s=State,c=s.civilization,a=CivilCityCouncil,h=CivilCityHomes;return {at:c.elapsed,seed:c.census.seed,world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,paused:!!CivilClock.paused,speed:c.speed,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),homes:c.cityHomes,projects:c.cityCouncil.projects.map(p=>({id:p.id,kind:p.kind,target:p.target,done:p.completedAt,sites:p.sites})),offices:a.ids(s).map(id=>({id,active:a.activeOffice(s,id),population:CivilCity.count(a.local(s,id)),beds:CivilCity.housing(s,a.physical(s,id)),stores:a.local(s,id).stores,health:a.local(s,id).health,stable:a.local(s,id).stable,workers:a.local(s,id).workers,worked:a.local(s,id).economy?.worked,quota:a.allowance(s,id)})),departure:h.data(s)?h.departureReason(s,'lake','home'):null};})()`);
async function pause(value){if(await read('!!CivilClock.paused')===value)return;await raw('#speedButton');await raw('#event #pause');if(await read('!!CivilClock.paused')!==value)throw Error('Pause action failed');}
async function council(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_link');await click('#cityNet_council');}
async function quota(city){await council();await select('#councilChoice_city',city);await select('#councilChoice_quota','active');if(await read(`State.civilization.cityCouncil.offices[${JSON.stringify(city)}].quota!=='active'`))if(!await click('#council_quota'))throw Error('quota unavailable');}
async function maintenance(value){await council();await select('#homesChoice_city','home');if(await read('CivilCityHomes.estate(State,"home").enabled')!==value)if(!await click('#homes_maintain'))throw Error('maintenance unavailable');}
async function exportSave(label){await pause(true);const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('export not available');await sleep(1500);await raw('#event #close');const snapshot=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(snapshot,null,2));const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(img.result.data,'base64'));log('export',{label,at:snapshot.at});}
async function order(total){await council();await select('#homesChoice_from','lake');await select('#homesChoice_to','home');await select('#homesChoice_total',String(total));return click('#homes_order');}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
let s=await observe();const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{start:s.at,seed:s.seed,stage:'build',last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));
const saveControl=()=>fs.writeFileSync(stateFile,JSON.stringify(control));const deadline=Date.now()+25*60*1000;
while(Date.now()<deadline){
 s=await observe();if(s.seed!==control.seed)throw Error('World changed');
 if(s.at-control.last>=120){control.last=s.at;log('snapshot',s);console.log(JSON.stringify({at:s.at,stage:control.stage,homes:s.homes&&Object.fromEntries(Object.entries(s.homes.estates).map(([id,e])=>[id,{condition:e.condition,enabled:e.enabled,lastPaid:e.lastPaidAt}])),trips:s.homes?.trips.map(p=>({id:p.id,phase:p.phase,outcome:p.outcome,remaining:p.remaining})),departure:s.departure}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}saveControl();
 if(s.event){const b=['engineer','wood','medicine','later','close'].map(id=>s.buttons.find(b=>b.id===id)).find(Boolean);if(!b)throw Error('Unrecognized decision '+s.event);await raw('#event #'+b.id);continue;}
 if(control.stage==='build'){await pause(true);await quota('home');await quota('lake');await council();await select('#councilChoice_project','housing:home');await select('#councilChoice_scale','neighborhood');await select('#councilChoice_mode','self');if(!await click('#council_propose'))throw Error('build unavailable');if(!await read('State.civilization.cityCouncil.proposals.at(-1).accepted'))throw Error('build refused');control.stage='building';saveControl();await pause(false);}
 else if(control.stage==='building'){if(s.homes&&s.homes.estates.home.lastPaidAt!==null&&s.homes.estates.home.condition===100&&!s.departure){await council();await click('#cityHomesDesk > summary');await exportSave('224_scaled_housing');control.stage='fault';saveControl();await pause(false);}}
 else if(control.stage==='fault'){if(!s.departure){await pause(true);if(await order(120))control.stage='depart';saveControl();await pause(false);}}
 else if(control.stage==='depart'){if(s.homes.trips.length){await pause(true);await maintenance(false);control.stage='waiting';saveControl();await pause(false);}}
 else if(control.stage==='waiting'){if(s.homes.trips[0].phase==='waiting'){await council();await click('#homesTransit > summary');await exportSave('225_reception_hold');control.stage='returning';saveControl();await pause(false);}}
 else if(control.stage==='returning'){if(s.homes.trips[0].finishedAt!==null){if(s.homes.trips[0].outcome!=='returned')throw Error('Expected original-home return');await council();await exportSave('226_returned_families');await maintenance(true);control.stage='repair';saveControl();await pause(false);}}
 else if(control.stage==='repair'){if(s.homes.estates.home.condition===100&&!s.departure){await pause(true);if(await order(480))control.stage='resettle';saveControl();await pause(false);}}
 else if(control.stage==='resettle'){if(s.homes.trips.length===5&&s.homes.trips.at(-1).finishedAt!==null){if(!s.homes.trips.slice(1).every(p=>p.outcome==='arrived'))throw Error('Recovery contract had a failed reception; retain evidence for review');await pause(true);await council();await select('#homesChoice_city','home');await select('#homesChoice_mode','tools');if(!await click('#homes_mode'))throw Error('work method unavailable');control.stage='work';saveControl();await pause(false);}}
 else if(control.stage==='work'){if(s.offices.find(o=>o.id==='home').worked?.settler>0&&s.homes.estates.home.condition===100&&s.offices.every(o=>o.health>=95&&o.stable>=120)){await council();await exportSave('227_settled_work_and_upkeep');control.stage='done';saveControl();done=true;break;}}
 else if(control.stage==='done'){done=true;break;}
 await sleep(900);
}
if(!done)throw Error('Unfinished: retain browser and controller');console.log('ACCEPTED',JSON.stringify(control));ws.close();
