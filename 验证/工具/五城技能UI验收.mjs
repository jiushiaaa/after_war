// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9357',dir='/tmp/postwar-a3-skills-20261104/ui']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
await location('council');await select('#laborChoice_city','home');await select('#laborChoice_source','home');await select('#laborChoice_task','tools');
for(const width of [1280,390,853]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await sleep(400);await location('council');
 for(const view of ['council','laborCities','laborOffer','laborCosts','laborLedger']){
  await folded();if(view!=='council'){await click('#cityLaborDesk > summary');if(view!=='laborCities')await click('#'+view+' > summary');await read('document.querySelector("#'+view+'").scrollIntoView({block:"start"})');}
  const metrics=await read(`(()=>{const body=document.querySelector('#cityBody'),r=body.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,right:r.right,visibleButtons:[...body.querySelectorAll('.button')].filter(b=>b.checkVisibility()).map(b=>({id:b.id,height:b.getBoundingClientRect().height})),taskVisible:document.querySelector('#laborChoice_task').checkVisibility(),costsVisible:document.querySelector('#laborCostDetails').checkVisibility(),text:body.innerText,rows:document.querySelectorAll('#laborCities tbody tr').length};})()`);
  assert(metrics.scrollWidth<=width,'page overflow '+width+' '+view);assert(metrics.right<=width+1,'body overflow');if(width===390)assert(metrics.visibleButtons.every(x=>x.height>=44),'small touch target');assert(metrics.rows===5,'five real cities');if(view==='council'||view==='laborCities')assert(!metrics.taskVisible&&!metrics.costsVisible,'advanced controls leaked');if(view==='laborOffer')assert(!metrics.costsVisible,'cost details should start folded');evidence.push({view,...metrics});const png=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,`${view}-${width}.png`),Buffer.from(png.result.data,'base64'));
 }
}
await select('#laborChoice_task','supply');for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});assert(await read('CivilCityLaborView.task==="food"'),'keyboard method');
assert(await read('document.querySelector("#laborCityStatus").innerText.includes("工具 0.015")'),'fractional food input');await select('#laborChoice_task','tools');await location('bridge');await location('council');
assert(await read('CivilCityLaborView.city==="home"&&CivilCityLaborView.source==="home"&&CivilCityLaborView.task==="tools"&&document.querySelector("#laborChoice_task").value==="tools"'),'draft preservation');assert(await read('JSON.stringify(State)')===before,'navigation changed paused world');assert(await read('State.civilization.elapsed')===at,'pause failed');
await select('#laborChoice_city','bridge');await click('#laborCosts > summary');assert(await read('document.querySelector("#laborCostDetails").innerText.includes("1140秒")'),'real distant occupation');await select('#laborChoice_source','lake');assert(await read('document.querySelector("#laborCostDetails").innerText.includes("来源尚无接续工坊")'),'unqualified source must not claim a real cooperative output loss');await select('#laborChoice_source','home');await select('#laborChoice_city','home');
assert(await click('#labor_order'),'actual qualified order');assert(await read('CivilCityLabor.contract(State,"home")?.task==="tools"&&CivilCityLabor.contract(State,"home")?.version===2'),'handler used stale task');assert(await click('#labor_toggle'),'actual pause');assert(await read('CivilCityLabor.office(State,"home").enabled===false'),'paused wrong city');assert(await click('#labor_toggle'),'actual resume');assert(await click('#labor_cancel'),'actual cancellation');
assert(await read('(()=>{try{CivilPlatform.validate(State);return true;}catch(e){return e.message;}})()')===true,'native validation');
fs.writeFileSync(path.join(dir,'ui-evidence.json'),JSON.stringify({kind:'isolated native 244 UI branch; no state/time injection',at,keyboard:true,draftsPreserved:true,pausedWorldUnchangedBeforeSubmissions:true,actualRecognitionOrderPauseResumeCancel:true,evidence},null,2));done=true;console.log('UI VERIFIED',JSON.stringify({at,views:evidence.length}));ws.close();
