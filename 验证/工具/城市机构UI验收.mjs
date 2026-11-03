// Synthetic UI scenario only. Use 城市机构基线.cjs via native import first.
// All interaction below uses browser input; evaluation observes state/DOM or scrolls the viewport.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const [port='9343',dir='/tmp/postwar-city-skills-20261103/ui-evidence']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),q=css=>`document.querySelector(${JSON.stringify(css)})`;
async function tap(css){
 await read(`${q(css)}?.scrollIntoView({block:'center',inline:'nearest'})`);await sleep(150);
 const b=await read(`(()=>{const e=${q(css)};if(!e||!e.getClientRects().length||e.disabled||e.classList.contains('disabled'))return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y}:null;})()`);
 assert.ok(b,'reachable '+css);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...b,button:'left',clickCount:1});await sleep(250);
 for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);
}
async function shot(file){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,file),Buffer.from(r.result.data,'base64'));}
async function open(css){if(!await read(`${q(css)}.open`))await tap(css+' > summary');}
async function fold(css){if(await read(`${q(css)}.open`))await tap(css+' > summary');}
for(let j=0;j<3&&await read('!!Events.activeEvent()');j++){const button=await read("document.querySelector('#event #engineer')?.id||document.querySelector('#event #close')?.id");assert.ok(button,'routine event');await tap('#event #'+button);}
if(!await read('CivilClock.paused')){await tap('#speedButton');await tap('#event #pause');}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await tap('#location_city');await tap('#cityView_production');await tap('#cityWard_yards');
await shot('desktop-folded.png');
await open('#cityProductionChoices');await tap('#cityProfile option[value="balanced"]');
assert.equal(await read('document.querySelector("#cityProfile").value'),'balanced');
await sleep(600);assert.equal(await read('document.querySelector("#cityProfile").value'),'balanced','refresh cannot replace an uncommitted choice');
const prior=await read('State.civilization.city.wards.yards.stores.tools');await tap('#cityApplyProfile');
assert.equal(await read('CivilCityInstitutions.local(State,"yards").profile'),'balanced');
assert.ok(Math.abs(prior-await read('State.civilization.city.wards.yards.stores.tools')-1)<1e-6,'paid while paused');
assert.equal(await read('CivilCityInstitutions.local(State,"terraces").profile'),'provisioning','only selected ward changed');
// Native listbox arrow input must retain focus and work despite ADR global map keys.
await tap('#cityProfile option[value="balanced"]');
for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
assert.equal(await read('document.querySelector("#cityProfile").value'),'provisioning');await tap('#cityApplyProfile');
await tap('#cityProfile option[value="workshop"]');await tap('#cityApplyProfile');
await shot('desktop-production.png');await fold('#cityProductionChoices');await open('#citySkillDetails');await tap('#cityDelegateSchool');assert.equal(await read('CivilCityInstitutions.local(State,"yards").schoolEnabled'),true);await shot('desktop-skills.png');await fold('#citySkillDetails');
await open('#cityHomeDelegation');assert.ok((await read('document.querySelector("#cityHomeScope").innerText')).includes('手动调岗'));await shot('desktop-delegation.png');await fold('#cityHomeDelegation');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(500);
await tap('#cityView_production');await open('#citySkillDetails');await shot('mobile-skills.png');
const mobile=await read('({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,buttons:[...document.querySelectorAll("#cityPanel .button")].filter(e=>e.getClientRects().length).map(e=>({id:e.id,height:e.getBoundingClientRect().height}))})');
assert.ok(mobile.document<=390&&mobile.body<=390,'no page horizontal overflow');assert.ok(mobile.buttons.every(b=>b.height>=44),'touch targets');
await fold('#citySkillDetails');await tap('#location_outside');assert.equal(await read('document.querySelector("#civilDelegatedJobs").open'),false,'delegated jobs initially folded');await shot('mobile-home-folded.png');
await open('#civilDelegatedJobs');await tap('#workers_row_teacher .dnBtn');assert.equal(await read('CivilCityInstitutions.data(State).home.enabled'),false,'manual intervention revokes delegation');await shot('mobile-home-manual.png');
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await sleep(300);const layout=await read('({jobs:document.querySelector("#civilDelegatedJobs").getBoundingClientRect().bottom,manual:document.querySelector("#civilManualGather").getBoundingClientRect().top})');assert.ok(layout.manual>=layout.jobs,'expanded jobs cannot overlap emergency gathering after resize');await shot('desktop-home-manual.png');
await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(dir,'native')});fs.mkdirSync(path.join(dir,'native'),{recursive:true});await tap('#saveMenu');await tap('#event #download');await sleep(1000);await tap('#event #close');
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({scenario:'explicit synthetic fixture; not natural play',passed:['paused choices apply and pay','keyboard listbox','uncommitted value retained','only selected ward changes','folds','390px overflow and touch size','manual revokes delegation'],mobile},null,2));console.log('UI PASS',dir);ws.close();
