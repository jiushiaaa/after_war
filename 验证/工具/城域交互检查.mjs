// Explicit synthetic-fixture UI check; not a natural playthrough. Real mouse/keyboard input only.
import fs from 'node:fs';
const port=process.env.CDP_PORT||9337,dir=process.argv[2]||'/tmp/postwar-city-ui';fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')fs.appendFileSync(dir+'/errors.ndjson',JSON.stringify(m)+'\n');};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tap(css){await read(`document.querySelector(${JSON.stringify(css)})?.scrollIntoView({block:'center',inline:'nearest'})`);await sleep(150);const p=await read(`(()=>{const e=document.querySelector(${JSON.stringify(css)});if(!e||!e.getClientRects().length||e.classList.contains('disabled'))return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return e.contains(hit)?{x,y}:null;})()`);if(!p)throw Error('unavailable or covered '+css);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});await sleep(500);for(let i=0;i<40&&await read("$('#locationSlider').is(':animated')");i++)await sleep(100);}
const assert=async expr=>{if(!await read(expr))throw Error('failed '+expr);};
await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
for(let i=0;i<25;i++){if(await read('!!Events.activeEvent()'))await tap('#event .button:not(.disabled)');else {await sleep(1100);if(!await read('!!Events.activeEvent()'))break;}}
await tap('#speedButton');const pause=await read("[...document.querySelectorAll('#event .button')].find(e=>e.innerText.includes('暂停'))?.id");await tap('#event #'+pause);
await tap('#location_city');await assert("CivilCity.population(State)>=10000 && State.civilization.city.cityAt!==null");
await tap('#cityMapNode_terraces');await assert("CivilCityView.selected==='terraces' && document.querySelectorAll('#cityTerrain .city-ground-road').length>0");await tap('#cityView_works');await tap('#cityWater');await assert("!State.civilization.city.wards.terraces.waterEnabled&&State.civilization.city.wards.yards.waterEnabled");await tap('#cityWater');
await tap('#cityMapNode_yards');await assert("CivilCityView.selected==='yards' && CivilCityView.view==='works'");await tap('#cityWater');await assert("State.civilization.city.wards.terraces.waterEnabled&&!State.civilization.city.wards.yards.waterEnabled");await tap('#cityWater');
await tap('#cityView_production');await tap('#cityPriority_building');await assert("State.civilization.city.wards.yards.priority==='building'&&State.civilization.city.wards.terraces.priority==='balanced'");
await tap('#cityView_census');await tap('#cityWorldBook summary');
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(dir+'/'+name,Buffer.from(r.result.data,'base64'));};
await tap('#cityView_overview');await shot('city-desktop.png');await tap('#cityView_census');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(700);
await shot('city-390.png');
const metrics=await read("({width:innerWidth,body:document.documentElement.scrollWidth,panel:document.querySelector('#cityPanel').getBoundingClientRect().toJSON(),population:CivilCity.population(State),preciseUnknownLeaked:document.querySelector('#cityWorldBook').innerText.includes(String(CivilCensus.total(State))),paused:CivilClock.paused})");
if(metrics.body>metrics.width+1)throw Error('page overflows '+JSON.stringify(metrics));if(metrics.preciseUnknownLeaked)throw Error('unknown population leaked');
await tap('#cityView_overview');await tap('#cityMapNode_canal');await assert("CivilCityView.selected==='canal' && document.documentElement.scrollWidth<=innerWidth+1");await shot('city-map-390.png');
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await sleep(500);await tap('#location_outside');
await assert("document.querySelectorAll('#village').length===1 && !!document.querySelector('#civilVillageBuildings') && !document.querySelector('#civilVillageBuildings').open");await tap('#civilVillageBuildings summary');
await assert("document.querySelector('#civilVillageBuildings').open && document.querySelector('#storesContainer').getBoundingClientRect().top>=document.querySelector('#village').getBoundingClientRect().bottom");await shot('village-fold-expanded.png');await tap('#civilVillageBuildings summary');await shot('village-fold-closed.png');
await tap('#location_city');await tap('#cityView_overview');await shot('city-desktop.png');
fs.writeFileSync(dir+'/result.json',JSON.stringify({synthetic:true,metrics,checks:['native import of explicit synthetic city','terrain map nodes select the actual ward and retain the current category','selected ward buttons target current ward','repeated water toggle reverses','public priority changes only selected ward','unknown global total not exposed','390px page and map have no horizontal overflow','native village building list folds and never overlaps stores']},null,2));console.log(JSON.stringify(metrics));ws.close();
