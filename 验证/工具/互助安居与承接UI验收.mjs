// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9361',dir='/tmp/postwar-a3-housing-20261104/ui']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
assert(await read('CivilClock.paused===true'),'pause');const before=await read('JSON.stringify(State)'),at=await read('State.civilization.elapsed');
async function location(id){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);await click('#council_go_'+(id==='council'?'link':id));if(id==='council')await click('#cityNet_council');}
async function folded(){const ids=await read("[...document.querySelectorAll('#cityCouncilBody details[open]')].map(d=>d.id).filter(Boolean).reverse()");for(const id of ids)await click('#'+id+' > summary');}
const evidence=[];
await location('council');
for(const width of [1280,390,853]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await sleep(400);await location('council');
 for(const view of ['folded','mutual','intake','supply']){
  await folded();let host='#councilSummary';
  if(view==='mutual'){await select('#councilChoice_project','housing:ridge+estuary');await select('#councilChoice_mode','specialist');host='#councilProposal';}
  if(view==='intake'){await select('#homesChoice_from','ridge');await select('#homesChoice_to','lake');await select('#homesChoice_total','480');host='#homesMove';}
  if(view==='supply'){await select('#homesChoice_city','lake');host='#homesManage';}
  await read(`document.querySelector(${JSON.stringify(host)}).scrollIntoView({block:'start'})`);
  const metrics=await read(`(()=>{const body=document.querySelector('#cityBody'),r=body.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,right:r.right,visibleButtons:[...body.querySelectorAll('.button')].filter(b=>b.checkVisibility()).map(b=>({id:b.id,height:b.getBoundingClientRect().height})),projectVisible:document.querySelector('#councilChoice_project').checkVisibility(),scaleVisible:document.querySelector('#councilChoice_scale').checkVisibility(),intakeVisible:document.querySelector('#homesChoice_to').checkVisibility(),supplyVisible:document.querySelector('#homes_supply').checkVisibility(),text:document.querySelector(${JSON.stringify(host)}).innerText};})()`);
  assert(metrics.scrollWidth<=width,'page overflow '+width+' '+view);assert(metrics.right<=width+1,'body overflow');if(width===390)assert(metrics.visibleButtons.every(x=>x.height>=44),'small touch target');
  if(view==='folded')assert(!metrics.projectVisible&&!metrics.intakeVisible&&!metrics.supplyVisible,'controls leaked');
  if(view==='mutual')assert(!metrics.scaleVisible&&metrics.text.includes('两城各建3200床')&&metrics.text.includes('两端均完工'),'mutual terms');
  if(view==='intake')assert(metrics.text.includes('60名成人')&&metrics.text.includes('36名儿童')&&metrics.text.includes('24名老人')&&metrics.text.includes('至多3班')&&metrics.text.includes('至少跨2期'),'real receiving burden');
  if(view==='supply')assert(metrics.supplyVisible&&metrics.text.includes('合格合作岗位承担日常供给'),'paid supply delegation');
  evidence.push({view,...metrics});const png=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,`${view}-${width}.png`),Buffer.from(png.result.data,'base64'));
 }
}
await select('#homesChoice_mode','food');for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});assert(await read('CivilCityHomesView.mode==="tools"'),'keyboard mode');await location('bridge');assert(!await read('document.querySelector("#cityHomesDesk").checkVisibility()'),'local page hides shared controls');await location('council');assert(await read('CivilCityHomesView.city==="lake"&&CivilCityHomesView.mode==="tools"&&document.querySelector("#homesChoice_mode").value==="tools"'),'draft preserved');assert(await read('JSON.stringify(State)')===before,'navigation changed paused world');assert(await read('State.civilization.elapsed')===at,'pause failed');
const lakeBefore=await read('CivilCityCouncil.local(State,"lake").stores.knowledge');assert(await click('#homes_mode'),'apply lake tools');assert(await read('CivilCityHomes.estate(State,"lake").mode==="tools"&&CivilCityHomes.estate(State,"home").mode==="food"'),'stale mode or city handler');
assert(await click('#homes_supply'),'release supply delegation');assert(await read('CivilCityHomes.estate(State,"lake").supply===false'),'release did not take');assert(await click('#homes_supply'),'resume supply delegation');assert(await read('CivilCityHomes.estate(State,"lake").supply===true'),'resume did not take');assert(Math.abs(await read('CivilCityCouncil.local(State,"lake").stores.knowledge')-lakeBefore+6)<1e-6,'three actual policy fees');
await select('#homesChoice_city','home');assert(await click('#homes_mode'),'apply home tools');assert(await read('CivilCityHomes.estate(State,"home").mode==="tools"&&CivilCityHomes.estate(State,"lake").mode==="tools"'),'fresh city binding');assert(await read('(()=>{try{CivilPlatform.validate(State);return true;}catch(e){return e.message;}})()')===true,'native validation');
fs.writeFileSync(path.join(dir,'ui-evidence.json'),JSON.stringify({kind:'isolated native 256 UI branch; real input, no state/time injection',at,keyboard:true,draftsPreserved:true,pausedWorldUnchangedBeforeSubmissions:true,actualScopedPaymentsAndReversal:true,evidence},null,2));done=true;console.log('UI VERIFIED',JSON.stringify({at,views:evidence.length}));ws.close();
