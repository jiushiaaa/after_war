// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9361',dir='/tmp/postwar-a3-housing-20261104/reimport']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 for(const id of info.folds)await raw('#'+id+' > summary');return raw(css);
}
async function select(css,value){
 if(!await click(css))return false;
 if(await read(`${q(css)}.size>1`)){await raw(css+' option[value="'+value+'"]');const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native list selection did not change: '+css);return true;}
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}

const assert=(ok,label)=>{if(!ok)throw Error(label);};
for(let i=0;i<5&&!await read('!!CivilClock.paused');i++){
 const pending=await read('State.civilization.pending');if(await read('!!Events.activeEvent()')&&pending){const key=pending==='succession'?'engineer':pending==='cold'?'wood':pending==='roadIncident'?'repair':null;assert(key,'known actual event');await raw('#event #'+key);continue;}await raw('#speedButton');await raw('#event #pause');
}
assert(await read('CivilClock.paused===true'),'pause');const result=await read(`(()=>{CivilPlatform.validate(State);const c=CivilCityCouncil,h=CivilCityHomes,x=CivilCityContinuity;return {at:State.civilization.elapsed,paused:CivilClock.paused,projects:c.data(State).projects.length,project:c.data(State).projects.at(-1),proposals:c.data(State).proposals.length,estates:Object.keys(h.data(State).estates),trips:h.data(State).trips,familyOrders:h.data(State).orders.length,lakeSupply:h.estate(State,'lake').supply,qualified:x.count(x.qualified(State,'lake')),courses:x.local(State,'lake').courses.length,world:CivilCensus.total(State)};})()`);
assert(result.projects===10&&result.proposals===12&&result.estates.length===5,'duplicate or lost assets on native import');assert(result.trips.length===11&&result.trips.slice(7).every(p=>p.outcome==='arrived'&&p.finishedAt!==null),'changed migration history');assert(result.project.agreementVersion===2&&result.project.completedAt===87670,'changed mutual project');assert(result.lakeSupply===true&&result.qualified>=120,'supply delegation or qualification lost');
await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_link');await click('#cityNet_council');await click('#cityHomesDesk > summary');await read("document.querySelector('#homesStatus').scrollIntoView({block:'start'})");
const png=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'native-reimport.png'),Buffer.from(png.result.data,'base64'));fs.writeFileSync(path.join(dir,'native-reimport.json'),JSON.stringify({kind:'native 259 imported using the real save UI; inspected after the resumed clock was paused through UI',...result},null,2));done=true;console.log('NATIVE REIMPORT VERIFIED',JSON.stringify({at:result.at,projects:result.projects,communities:result.estates.length}));ws.close();
