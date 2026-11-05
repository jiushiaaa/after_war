// Natural A6 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9372',dir='/tmp/postwar-a6-20261105/public']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 if(!box){log('unreachable',{css,info:await read(`(()=>{const e=${q(css)};if(!e)return null;const r=e.getBoundingClientRect();return {rect:r.toJSON(),visible:e.checkVisibility(),disabled:e.disabled,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500)};})()`)});return false;}for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});log('click',{css,...box});await sleep(250);return true;
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



const route=port==='9372'?'public':'industrial';
const observe=()=>read(`(()=>{const d=State.civilization.polity,g=d?.earth,f=d?.future;return {at:State.civilization.elapsed,speed:State.civilization.speed,max:State.civilization.maxSpeed,paused:!!CivilClock.paused,pending:State.civilization.pending,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),g:g?{tech:g.tech,work:g.work,research:g.research,build:g.build,survey:g.survey,ground:g.ground,unity:g.unity,ending:g.ending,last:g.last,paid:g.paid,missed:g.missed,flights:g.flights,regions:Object.fromEntries(Object.entries(g.regions).map(([id,r])=>[id,{mode:r.mode,project:r.project,stable:r.stable,paid:r.paid,missed:r.missed,last:r.last}]))}:null,f:f?{health:f.health,condition:f.condition,assets:f.assets,stock:f.stock,counts:CivilFuturePeople.counts(f),away:CivilFuturePeople.away(f),last:f.last,proposal:f.proposal}:null};})()`);
async function handle(){const s=await observe();if(!s.event)return false;const key={succession:'engineer',cold:'wood',roadIncident:'repair',financeOffer:'later',roadDefense:'detour'}[s.pending];if(!key||!s.buttons.includes(key))throw Error('Unknown event '+JSON.stringify({event:s.event,pending:s.pending,buttons:s.buttons}));log('decision',{at:s.at,pending:s.pending,key});await raw('#event #'+key);return true;}
async function pause(value){for(let i=0;i<8;i++){if(await read('!!CivilClock.paused')===value)return;if(await handle())continue;await raw('#speedButton');await raw('#event #pause');}throw Error('Pause failed');}
async function desk(){if(!await click('#location_research'))throw Error('Research location unavailable');for(let i=0;i<25&&await read("$('#locationSlider').is(':animated')");i++)await sleep(100);}
async function action(step){await pause(true);await desk();const prefix=step.module==='future'?'future':'earth';if(step.key==='start'){if(!await click('#'+prefix+'_begin'))throw Error('Cannot start '+prefix);}else{await select('#'+prefix+'Section',step.section);if(step.region)await select('#earthRegion',step.region);await select('#'+prefix+'Task',step.key);if(!await click('#'+prefix+'_commit'))throw Error('Cannot act '+step.key+' '+await read(`document.querySelector('#${prefix}Terms')?.innerText`));}await pause(false);}
async function exportSave(label){await pause(true);await desk();let dest=path.resolve(dir,label);if(fs.existsSync(path.join(dest,'战后文明-存档.json')))dest+='_'+(await observe()).at;fs.mkdirSync(dest,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dest});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('Export unavailable');await sleep(1800);await raw('#event #close');const s=await observe();fs.writeFileSync(path.join(dest,'observation.json'),JSON.stringify(s,null,2));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dest,'screen.png'),Buffer.from(shot.result.data,'base64'));log('export',{label,at:s.at});}
const report={kind:'native UI, existing read-only export; theme changes only presentation config',views:[]},input=process.argv[4];
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await pause(true);
if(input){await raw('#saveMenu');await raw('#event #import');await raw('#event textarea');await send('Input.insertText',{text:fs.readFileSync(input,'utf8')});await raw('#event #inspect');for(let i=0;i<300&&!await read('!!document.querySelector("#event #replace")');i++)await sleep(100);if(!await raw('#event #replace'))throw Error('Native import failed');await pause(true);}
const baseline=await read('JSON.stringify(State.civilization)'),global=await read('CivilCensus.total(State)');
for(const width of [1280,853,390]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
 await read("document.querySelector('#header').scrollIntoView({block:'start'})");await sleep(200);const header=await read(`([...document.querySelectorAll('#header .headerButton')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,reachable:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}))`);if(header.some(x=>!x.reachable))throw Error('Header obstructed '+JSON.stringify(header));
 for(const page of ['earthAccounts','earthCargo','futureLife','futureLedger','polityBook','domainAccounts']){
  if(['polityBook','domainAccounts'].includes(page)){await click('#location_city');await click('#domainEntry');if(page==='polityBook'&&!await read('document.querySelector("#polityDesk").open'))await click('#polityDesk > summary');}
  else {await desk();const parent=page.startsWith('earth')?'earthDesk':'futureDesk';if(!await read(`document.querySelector('#${parent}').open`))await click('#'+parent+' > summary');}
  if(!await read(`document.querySelector('#${page}').open`))await click('#'+page+' > summary');await sleep(500);await read(`document.querySelector('#${page}').scrollIntoView({block:'start'})`);
  const state=await read(`(()=>{const e=document.querySelector('#${page}');return {width:${width},page:'${page}',open:e.open,visible:e.checkVisibility(),rows:e.querySelectorAll('.civil-kv > dt').length,overflow:e.scrollWidth>e.clientWidth+1,color:e.querySelector('dt')?getComputedStyle(e.querySelector('dt')).color:null};})()`);
  if(!state.open||!state.visible||state.overflow||!state.rows||state.color!=='rgb(34, 34, 34)')throw Error(JSON.stringify(state));
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,`${width}_${page}.png`),Buffer.from(shot.result.data,'base64'));report.views.push(state);
  const source='#'+page+' .civil-source > summary';if(await read(`!!document.querySelector(${JSON.stringify(source)})`)){await click(source);if(!await read(`document.querySelector(${JSON.stringify(source)}).parentElement.open`))throw Error('Numeric source did not open');await click(source);}
  await click('#'+page+' > summary');
 }
}
await raw('#saveMenu');await raw('#event #theme');await sleep(1000);await desk();if(!await read('document.querySelector("#earthDesk").open'))await click('#earthDesk > summary');await click('#earthAccounts > summary');await read("document.querySelector('#earthAccounts').scrollIntoView({block:'start'})");
report.dark=await read("({body:getComputedStyle(document.body).color,label:getComputedStyle(document.querySelector('#earthAccounts dt')).color})");if(report.dark.label!=='rgb(221, 221, 221)')throw Error(JSON.stringify(report.dark));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'390_dark.png'),Buffer.from(shot.result.data,'base64'));await raw('#saveMenu');await raw('#event #theme');
report.civilizationUnchanged=await read('JSON.stringify(State.civilization)')===baseline;report.populationUnchanged=await read('CivilCensus.total(State)')===global;if(!report.civilizationUnchanged||!report.populationUnchanged)throw Error('UI changed the world');
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({views:report.views.length,...report.dark,unchanged:true}));done=true;ws.close();
