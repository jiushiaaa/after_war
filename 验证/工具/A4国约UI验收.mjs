// Natural A4 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9372',dir='/tmp/postwar-a4-complete-20261105/public']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 if(info.panel){const id=info.panel.replace(/Panel$/,'');if(!await read(`${q('#location_'+id)}?.classList.contains('selected')`))await raw('#location_'+id);for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);}
 for(const id of info.folds){for(let n=0;n<3&&!await read(`${q('#'+id)}.open`);n++){await raw('#'+id+' > summary');await sleep(300);}if(!await read(`${q('#'+id)}.open`))throw Error('Could not unfold '+id);}return raw(css);
}
async function select(css,value){
 for(let n=0;n<6;n++){if(await click(css))break;if(n===5)throw Error('Cannot reach selection '+css);await sleep(300);}
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}



// This controller only reads state. Every game action is a real UI mouse/key input.
const route=port==='9372'?'public':'industrial';
const observe=()=>read(`(()=>{const d=CivilPolity.data(State),f=d?.world.foreign;return {at:State.civilization.elapsed,paused:!!CivilClock.paused,maxSpeed:State.civilization.maxSpeed,speed:State.civilization.speed,event:Events.activeEvent()?.title,pending:State.civilization.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),cofund:!!CivilRegional.data(State)?.cofunding,founded:d?.foundedAt,common:d?CivilPolity.population(State):0,stable:d?.stable,service:d?.lastService,contacts:d?.contacts,peers:d?Object.keys(d.peers):[],nodes:d?.world.nodes,foreign:f?{round:f.round,actors:f.actors,pairs:f.pairs,shipments:f.shipments,leagues:f.leagues,network:!!f.network,markets:!!f.markets,congress:!!f.congress,defenseAt:f.congress?.defenseAt,aftermath:f.aftermath,settlement:f.settlement,publicOrders:f.publicOrders,reputation:f.leagues?.reputation,reviews:f.network?.reviews,credits:f.network?.cash,votes:Object.fromEntries(Object.keys(d.world.nodes).map(id=>[id,CivilAftermath.vote(d.world,id)]))}:null,cities:CivilCityCouncil.ids(State).map(id=>{const n=CivilCityCouncil.local(State,id);return {id,health:n.health,stable:n.stable};})};})()`);
async function handle(){const s=await observe();if(!s.event)return false;const key=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!key||!s.buttons.includes(key))throw Error('Unknown event '+JSON.stringify({event:s.event,pending:s.pending,buttons:s.buttons}));log('decision',{at:s.at,pending:s.pending,key});await raw('#event #'+key);return true;}
async function pause(value){for(let i=0;i<8;i++){if(await read('!!CivilClock.paused')===value)return;if(await handle())continue;await raw('#speedButton');await raw('#event #pause');}throw Error('Pause failed');}
async function region(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);if(!await click('#domainEntry'))throw Error('Regional entry unavailable');}
async function desk(){await region();if(!await read("document.querySelector('#polityDesk')?.open"))await click('#polityDesk > summary');}
async function task(section,key,actor='west'){await pause(true);await desk();await select('#politySection',section);if(section!=='institutions')await select('#polityActor',actor);await select('#polityTask',key);if(!await click('#polity_commit'))throw Error('UI action unavailable '+key+': '+await read("document.querySelector('#polityTerms').innerText"));}
const reason=(action,args={})=>read(`CivilPolity.reason(State,${JSON.stringify(action)},${JSON.stringify(args)})`);
async function exportSave(label){await pause(true);await desk();const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('Export unavailable');await sleep(1300);await raw('#event #close');const state=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(state,null,2));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(shot.result.data,'base64'));log('export',{label,at:state.at});}

const report={views:[],errors:[]};
await pause(true);
const importPath=process.argv[4];
if(importPath){
 await raw('#saveMenu');await raw('#event #import');await raw('#event textarea');await send('Input.insertText',{text:fs.readFileSync(importPath,'utf8')});await raw('#event #inspect');
 for(let n=0;n<100&&!await read("!!document.querySelector('#event #replace')");n++)await sleep(100);
 if(!await raw('#event #replace'))throw Error('Native import rejected');await pause(true);report.nativeImport=importPath;report.importedAt=await read('State.civilization.elapsed');
}
if(process.argv.includes('--early')){
 report.earlyHidden=!await read("!!document.querySelector('#polityDesk')?.checkVisibility()");
 if(!report.earlyHidden)throw Error('Nation desk visible before unlock');
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(report);done=true;ws.close();process.exit(0);
}
await region();const baseline=await read('JSON.stringify(State)');
for(const width of [1280,853,390]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await sleep(250);await region();
 const folds=['domainMap','domainTreaty','domainEconomy','domainTransport','domainAccounts','regionalDesk','polityDesk'];
 async function shot(name,fold){
  for(const id of folds){const present=await read(`!!${q('#'+id)}`);if(!present)continue;const open=await read(`${q('#'+id)}.open`);if(open!==(id===fold))await click('#'+id+' > summary');}
  await read(`${q(fold?'#'+fold:'#domainBody')}.scrollIntoView({block:'start'})`);await sleep(200);
  const info=await read(`(()=>{const e=document.querySelector('#domainBody'),r=e.getBoundingClientRect();return {visible:e.checkVisibility(),overflow:e.scrollWidth>e.clientWidth+1,rect:r.toJSON(),at:State.civilization.elapsed,paused:!!CivilClock.paused,section:CivilPolityView.section,actor:CivilPolityView.actor,visibleActionButtons:[...document.querySelectorAll('#polityDesk .button')].filter(e=>e.checkVisibility()).length};})()`);
  if(!info.visible||info.overflow||!info.paused||info.visibleActionButtons>1)throw Error(JSON.stringify(info));
  const im=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,`${width}_${name}.png`),Buffer.from(im.result.data,'base64'));report.views.push({width,name,...info});
 }
 await shot('overview',null);await shot('map','domainMap');
 if(!await click('#domainMap_desert .polity-map-link'))throw Error('Map country link unreachable');
 if(await read('CivilPolityView.actor')!=='desert')throw Error('Map target not selected');
 report.views.push({width,name:'map-target',actor:'desert'});
 for(const section of ['institutions','contact','relations','trade','conflict']){await desk();await select('#politySection',section);await shot(section,'polityDesk');}
 await desk();await select('#politySection','institutions');await select('#polityLaw_devolution','central');await select('#polityLaw_rights','custom');await select('#polityTask','law');
 if(!await read("document.querySelector('#polity_commit').classList.contains('disabled') && document.querySelector('#polityTerms').textContent.includes('东原拒绝')"))throw Error('Local veto missing');
 await shot('local-veto','polityDesk');
 await select('#polityLaw_devolution',await read('State.civilization.polity.laws.devolution'));await select('#polityLaw_rights',await read('State.civilization.polity.laws.rights'));
 await click('#metroCity_select_home');if(await read("document.querySelector('#domainBody').checkVisibility()"))throw Error('Nation desk leaked into city');report.views.push({width,name:'return-city',hidden:true});await region();
}
if(await read('JSON.stringify(State)')!==baseline)throw Error('Paused UI mutated world');report.stateUnchanged=true;
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({views:report.views.length,stateUnchanged:true,importedAt:report.importedAt}));done=true;ws.close();
