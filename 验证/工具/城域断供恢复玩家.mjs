// Natural continuation after the real 10k-city export. Real UI input only.
// node 城域断供恢复玩家.mjs <CDP port> <evidence directory>
// Does not inject State, resources, progress, time, or direct game actions.
import fs from 'node:fs';
import path from 'node:path';
const [port='9336',dir='/tmp/postwar-city-recovery']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')fs.appendFileSync(path.join(dir,'errors.ndjson'),JSON.stringify(m)+'\n');};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=(kind,data={})=>fs.appendFileSync(path.join(dir,'actions.ndjson'),JSON.stringify({wall:new Date().toISOString(),kind,...data})+'\n');
async function tap(css){
  await read(`document.querySelector(${JSON.stringify(css)})?.scrollIntoView({block:'center',inline:'nearest'})`);await sleep(180);
  const b=await read(`(()=>{const e=document.querySelector(${JSON.stringify(css)});if(!e||!e.getClientRects().length||e.classList.contains('disabled'))return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText}:null;})()`);
  if(!b)throw Error('unavailable or covered '+css);
  for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1});log('click',{css,text:b.text});await sleep(350);
  for(let i=0;i<40&&await read("$('#locationSlider').is(':animated')");i++)await sleep(100);
}
async function eventChoice(){
  const e=await read("(()=>{const e=Events.activeEvent();if(!e)return null;return {title:e.title,buttons:[...document.querySelectorAll('#event .button:not(.disabled)')].map(b=>({id:b.id,text:b.innerText}))};})()");
  if(!e)return false;
  const choice=e.buttons.find(b=>b.id==='engineer')||e.buttons[0];if(!choice)throw Error('event without choice');log('event',e);await tap('#event #'+choice.id);return true;
}
async function speed(pause){
  const paused=await read('!!CivilClock.paused');if(pause&&paused)return;
  if(!pause&&paused){await tap('#speedButton');await tap('#event #pause');}
  await tap('#speedButton');
  const id=await read(`([...document.querySelectorAll('#event .button')].find(e=>${pause?"e.innerText.includes('暂停')":"e.innerText.startsWith(State.civilization.maxSpeed+'×')"})||{}).id`);
  if(!id)throw Error('speed menu choice missing');await tap('#event #'+id);
}
const snapshot=()=>read(`(()=>{const s=State,c=s.civilization,n=c.city.wards.canal;CivilCensus.validate(s);CivilCity.validate(s);return {at:c.elapsed,home:s.game.population,total:CivilCity.population(s),world:CivilCensus.total(s),born:c.census.born,dead:c.census.dead,health:n.health,stable:n.stable,waterEnabled:n.waterEnabled,stores:{...n.stores},economy:n.economy,arrived:c.city.arrived,shipments:c.city.shipments};})()`);
async function exportSave(name){
  const folder=path.resolve(dir,name);fs.mkdirSync(folder,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder});
  await tap('#saveMenu');await tap('#event #download');await sleep(1200);await tap('#event #close');
  const nameOnDisk=fs.readdirSync(folder).find(n=>n.endsWith('.json'));if(!nameOnDisk)throw Error('native export missing');return path.join(folder,nameOnDisk);
}
async function until(predicate,limit=240000){const end=Date.now()+limit;while(Date.now()<end){if(await eventChoice())continue;const s=await snapshot();if(predicate(s))return s;await sleep(1500);}throw Error('natural recovery timed out');}
await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
if(!await read('State.civilization.ruleset===2 && State.civilization.city.cityAt!==null'))throw Error('requires the naturally reached city');
while(await eventChoice()){}
await speed(true);await tap('#location_city');await tap('#cityWard_canal');await tap('#cityView_works');
const before=await snapshot();if(!before.waterEnabled)throw Error('water must start operating');
await tap('#cityWater');await speed(false);
const cut=await until(s=>s.at>=before.at+180&&s.economy.water===0&&s.health<=before.health-3&&s.stable===0);
await speed(true);const cutFile=await exportSave('cut');
await tap('#cityView_works');await tap('#cityWater');await tap('#cityView_production');await tap('#cityPriority_care');
await tap('#cityView_transport');await tap('#cityAid');await speed(false);
const recovered=await until(s=>s.waterEnabled&&s.economy.water>=s.economy.population&&s.economy.ate&&s.economy.treated&&s.health>=99&&s.stable>=120&&s.arrived>before.arrived&&!s.shipments.some(p=>p.source==='home'));
await speed(true);const file=await exportSave('recovered');await tap('#cityView_overview');
const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'recovered.png'),Buffer.from(shot.result.data,'base64'));
const result={natural:true,before,cut,recovered,cutFile,file};fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));log('complete',{at:recovered.at,file});console.log(JSON.stringify({file,from:before.at,to:recovered.at,health:[before.health,cut.health,recovered.health],population:recovered.total}));ws.close();
