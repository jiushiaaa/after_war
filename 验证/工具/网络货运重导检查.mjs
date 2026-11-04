// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9363',dir='/tmp/postwar-a3-dispatch-20261104/reimport']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 for(const id of info.folds){for(let n=0;n<3&&!await read(`${q('#'+id)}.open`);n++){await raw('#'+id+' > summary');await sleep(300);}if(!await read(`${q('#'+id)}.open`))throw Error('Could not unfold '+id);}return raw(css);
}
async function select(css,value){
 for(let n=0;n<3;n++){if(await click(css))break;if(n===2)throw Error('Cannot reach selection '+css);await sleep(300);}
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}

const assert=(ok,label)=>{if(!ok)throw Error(label);};
for(let i=0;i<5&&!await read('!!CivilClock.paused');i++){
 const pending=await read('State.civilization.pending');if(await read('!!Events.activeEvent()')&&pending){const key=pending==='succession'?'engineer':pending==='cold'?'wood':pending==='roadIncident'?'repair':null;assert(key,'known actual event');await raw('#event #'+key);continue;}await raw('#speedButton');await raw('#event #pause');
}
assert(await read('CivilClock.paused===true'),'pause');const before=await read('JSON.stringify(State)'),at=await read('State.civilization.elapsed');
async function location(id){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_'+(id==='council'?'link':id));if(id==='council')await click('#cityNet_council');}
async function folded(){const ids=await read("[...document.querySelectorAll('#cityCouncilBody details[open]')].map(d=>d.id).filter(Boolean).reverse()");for(const id of ids)await click('#'+id+' > summary');}

const envelope=JSON.parse(fs.readFileSync(path.resolve('验证/存档/自然游玩_网络货运与持续维护结清266.json')));
const z=await import('node:zlib'),source=(envelope.encoding?JSON.parse(z.gunzipSync(Buffer.from(envelope.data,'base64'))):envelope).state;
const actual=await read('({dispatch:State.civilization.cityDispatch,projects:State.civilization.cityCouncil.projects,shipments:State.civilization.cityCouncil.shipments,capital:State.civilization.cityCouncil.receipts.filter(r=>r.kind==="dispatchBuild")})');
assert(JSON.stringify(actual.projects)===JSON.stringify(source.civilization.cityCouncil.projects),'project history duplicated or changed');assert(JSON.stringify(actual.shipments)===JSON.stringify(source.civilization.cityCouncil.shipments),'shipment history changed');assert(actual.capital.length===1,'duplicate asset payment');assert(JSON.stringify(Object.keys(actual.dispatch.depots))===JSON.stringify(Object.keys(source.civilization.cityDispatch.depots)),'extra depot after import');
for(const [id,old]of Object.entries(source.civilization.cityDispatch.depots)){const now=actual.dispatch.depots[id];for(const key of ['at','order','paid','worked','remaining','completedAt','enabled','changes'])assert(JSON.stringify(now[key])===JSON.stringify(old[key]),'depot import '+key);assert(JSON.stringify(now.services.slice(0,old.services.length))===JSON.stringify(old.services),'maintenance history');}
await location('council');await folded();await select('#dispatchChoice_city','lake');assert(!await read('document.querySelector("#dispatchTerms").innerText.includes("免费人口")'),'latest view code');
for(const width of [1280,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await sleep(300);await read('document.querySelector("#dispatchManage").scrollIntoView({block:"start"})');const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'final-'+width+'.png'),Buffer.from(img.result.data,'base64'));}
assert(await read('JSON.stringify(State)')===before,'paused final inspection mutated world');assert(await read('(()=>{try{CivilPlatform.validate(State);return true;}catch(e){return e.message;}})()')===true,'strict validation');
const record={source:266,sourceAt:source.civilization.elapsed,observedAt:at,strictValidation:true,projectsUnchanged:true,shipmentsUnchanged:true,singlePaidDepot:true,oldMaintenanceUnchanged:true,pausedInspectionUnchanged:true,latestView:true};fs.writeFileSync(path.join(dir,'final-reimport.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record));done=true;ws.close();
