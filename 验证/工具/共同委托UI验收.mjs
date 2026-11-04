// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9349',dir='/tmp/postwar-a3-council-20261104/ui',route='industry']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
const assert=(ok,label)=>{if(!ok)throw Error(label);};
assert(await read('CivilClock.paused===true'),'Use a paused native four-city save');
const before=await read('JSON.stringify(State)'),at=await read('State.civilization.elapsed');
await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);
async function location(id){await click('#council_go_'+(id==='council'?'link':id));if(id==='council')await click('#cityNet_council');}
const evidence=[];
for(const width of [1280,390,853]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await sleep(600);
 for(const section of ['council','estuary','ridge','lake','home','link']){
  await location(section);await sleep(250);
  const metrics=await read(`(()=>{const id=CivilConurbationView.selected,b=document.querySelector(['council','estuary'].includes(id)?'#cityCouncilBody':['ridge','link'].includes(id)?'#cityNetworkBody':id==='lake'?'#metroCityBody':'#cityOverview'),r=b.getBoundingClientRect();return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:{left:r.left,right:r.right,width:r.width},buttons:[...b.querySelectorAll('.button')].filter(x=>x.getClientRects().length).map(x=>({id:x.id,height:x.getBoundingClientRect().height})),text:b.innerText,folded:[...document.querySelectorAll('#cityCouncilBody > details')].every(d=>!d.open),cityButtons:[...document.querySelectorAll('#metroCitySwitch > .button')].filter(e=>e.getClientRects().length).length};})()`);
  assert(metrics.scrollWidth<=width,'horizontal overflow '+width);assert(metrics.body.right<=width,'body overflow');assert(metrics.body.width>0,'hidden destination '+section);if(width===390)assert(metrics.buttons.every(b=>b.height>=44),'touch target below 44px');assert(metrics.folded,'advanced settings should start folded');assert(metrics.cityButtons===0,'compact selector should replace old city buttons');
  evidence.push({width,section,...metrics});if(['council','estuary'].includes(section)){const png=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,`${section}-${width}.png`),Buffer.from(png.result.data,'base64'));}
 }
}
await location('council');await click('#councilChoice_project');await select('#councilChoice_project','housing:home');await select('#councilChoice_mode','beneficiary');
assert(await read('CivilCityCouncilView.project==="housing:home"&&CivilCityCouncilView.mode==="beneficiary"'),'proposal draft mismatched');
await location('estuary');await location('council');assert(await read('document.querySelector("#councilChoice_project").value==="housing:home"&&document.querySelector("#councilChoice_mode").value==="beneficiary"'),'unsubmitted proposal reset');
await click('#councilChoice_quota');await select('#councilChoice_quota','normal');
for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
assert(await read('document.querySelector("#councilChoice_quota").value==="active"'),'keyboard quota selection failed');
await location('home');assert(await read('!document.querySelector("#cityCouncilBody").getClientRects().length'),'home leaked council body');await location('council');assert(await read('document.querySelector("#councilChoice_quota").value==="active"'),'quota draft reset');
await location('link');await click('#cityNet_tab_transport');await click('#cityNet_lakeTerms');assert(await read('document.querySelector("#metroCityTitle").innerText==="湖滨协约"'),'legacy pact lost');
await location('council');assert(await read('JSON.stringify(State)')===before,'navigation/draft changed world while paused');assert(await read('State.civilization.elapsed')===at,'paused time moved');
assert(await read('(()=>{try{CivilPlatform.validate(State);return true;}catch(e){return e.message;}})()')===true,'native re-import failed validation');
fs.writeFileSync(path.join(dir,'ui-evidence.json'),JSON.stringify({kind:'real UI on paused native four-city save',at,evidence,keyboard:true,unsubmittedChoicePreserved:true,pausedWorldUnchanged:true,legacyPactAccessible:true},null,2));
console.log('UI VERIFIED');done=true;ws.close();
