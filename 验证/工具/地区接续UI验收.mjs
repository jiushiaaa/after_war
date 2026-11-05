// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9369',dir='/tmp/postwar-a4-20261104/industrial']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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


const route=port==='9370'?'public':'industrial';
const observe=()=>read(`(()=>{const s=State,f=CivilDomain,d=f.data(s),n=d?.node;return {at:s.civilization.elapsed,paused:!!CivilClock.paused,event:Events.activeEvent()?.title,pending:s.civilization.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),world:CivilCensus.total(s),census:s.civilization.census,domain:d,known:f.known(s),governed:f.governed(s),reason:f.tradeReason(s),agree:f.agreementReason(s,'shared'),cities:CivilCityCouncil.ids(s).map(id=>{const n=CivilCityCouncil.local(s,id);return {id,population:id==='home'?CivilCity.population(s):CivilCity.count(n),health:n.health,stable:n.stable,stores:n.stores,workers:n.workers};}),tech:s.civilization.tech};})()`);
async function pause(value){for(let i=0;i<6;i++){if(await read('!!CivilClock.paused')===value)return;const s=await observe();if(s.event&&s.pending){const k=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!k||!s.buttons.includes(k))throw Error('Unknown decision '+s.pending);await raw('#event #'+k);continue;}await raw('#speedButton');await raw('#event #pause');}throw Error('Pause failed');}
async function region(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);if(!await click('#domainEntry'))throw Error('Regional entry unavailable');}
async function exportSave(label){await pause(true);await region();const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('Export unavailable');await sleep(1500);await raw('#event #close');const state=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(state,null,2));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(shot.result.data,'base64'));log('export',{label,at:state.at});}

const compact=process.argv.includes('--compact'),report={views:[],errors:[]};
await pause(true);await region();const baseline=await read('JSON.stringify(State)');
for(const width of [1280,853,390]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await sleep(250);await region();
 const folds=['domainMap','domainTreaty','domainEconomy','domainTransport','domainAccounts'];
 async function shot(name,fold){for(const id of folds){const open=await read(`${q('#'+id)}.open`);if(open!==(id===fold))await click('#'+id+' > summary');}if(fold)await read(`${q('#'+fold)}.scrollIntoView({block:'start'})`);else await read(`${q('#domainBody')}?.scrollIntoView({block:'start'})`);await sleep(250);const info=await read(`(()=>{const e=document.querySelector('#domainBody'),r=e.getBoundingClientRect();return {selected:CivilConurbationView.selected,visible:e.checkVisibility(),overflow:e.scrollWidth>e.clientWidth+1,rect:r.toJSON(),at:State.civilization.elapsed,paused:!!CivilClock.paused,focus:document.activeElement?.id};})()`);if(!info.visible||info.overflow||!info.paused)throw Error(JSON.stringify(info));const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,width+'_'+name+'.png'),Buffer.from(image.result.data,'base64'));report.views.push({width,name,...info});}
 await shot('overview',null);if(!compact)await shot('map','domainMap');await shot('terms','domainTreaty');await select('#domainChoice_mode','trade');if(!await read("document.querySelector('#domainChoice_mode').value==='trade'"))throw Error('Keyboard draft lost');await shot('production','domainEconomy');if(!compact){await shot('transport','domainTransport');await shot('accounts','domainAccounts');}
 await click('#metroCity_select_home');const visible=await read("document.querySelector('#domainBody').checkVisibility()");if(visible)throw Error('Regional panel leaked into home view');report.views.push({width,name:'return-home',regionalHidden:!visible});await region();
}
if(await read('JSON.stringify(State)')!==baseline)throw Error('Paused UI changed the world');report.stateUnchanged=true;fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({views:report.views.length,stateUnchanged:report.stateUnchanged}));done=true;ws.close();
