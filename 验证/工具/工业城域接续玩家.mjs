// Natural industrial new-game city continuation, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9341',dir='/tmp/postwar-city-skills-20261103/industrial-city-evidence']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 if(info.panel==='cityPanel'&&!css.startsWith('#cityView_'))await raw(css==='#cityAid'||css==='#cityFreight'?'#cityView_transport':'#cityView_production');
 for(const id of info.folds)await raw('#'+id+' > summary');return raw(css);
}
async function select(css,value){
 if(!await click(css))return false;
 if(await read(`${q(css)}.size>1`)){await raw(css+' option[value="'+value+'"]');const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native list selection did not change: '+css);return true;}
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}
const observe=()=>read(`(()=>{const s=State,c=s.civilization;return {at:c.elapsed,total:CivilCity.population(s),home:s.game.population,health:c.village.health,hunger:c.hunger,workers:s.game.workers,stores:s.stores,speed:c.speed,max:c.maxSpeed,paused:CivilClock.paused,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),city:c.city};})()`);
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
let s=await observe();if(!s.city?.cityAt||s.total<10000||!await read('CivilCourse.is(State,"industry")'))throw Error('Import the naturally reached industrial city first');
const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)): {start:s.at,base:JSON.parse(JSON.stringify(s.city.wards)),last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));
const end=Date.now()+30*60*1000;
while(Date.now()<end){
 s=await observe();const d=s.city.institutions;
 if(s.at-control.last>=300){control.last=s.at;log('snapshot',{at:s.at,total:s.total,wards:Object.fromEntries(Object.entries(s.city.wards).map(([id,n])=>[id,{health:n.health,stable:n.stable,stores:n.stores,worked:n.economy.worked}]))});console.log(JSON.stringify({at:s.at,total:s.total,arrived:s.city.arrived,school:d?.wards.yards.courses.length}));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}
 fs.writeFileSync(stateFile,JSON.stringify(control));
 if(s.event){const choice=['engineer','wood','medicine','later','close','public'].map(id=>s.buttons.find(b=>b.id===id)).find(Boolean)||s.buttons[0];if(choice)await raw('#event #'+choice.id);continue;}
 if(s.paused||s.speed<s.max){await raw('#speedButton');const speed=await read(`[...document.querySelectorAll('#event .button')].find(e=>e.innerText.startsWith('${s.max}×'))?.id`);if(speed)await raw('#event #'+speed);continue;}
 if(!d){await click('#cityFoundInstitution');continue;}
 if(!d.home.enabled){await click('#cityDelegate');continue;}
 let changed=false;
 for(const [id,profile]of [['terraces','provisioning'],['yards','workshop']])if(d.wards[id].profile!==profile){await click('#cityWard_'+id);await select('#cityProfile',profile);await click('#cityApplyProfile');changed=true;break;}if(changed)continue;
 if(s.city.wards.yards.method!=='standard'){await click('#cityWard_yards');await click('#cityMethod_standard');continue;}
 if(d.wards.canal.careMethod!=='clinical'){await click('#cityWard_canal');await select('#cityCareMethod','clinical');await click('#cityApplyCare');continue;}
 for(const id of ['yards','canal'])if(!d.wards[id].schoolEnabled){await click('#cityWard_'+id);await click('#cityDelegateSchool');changed=true;break;}if(changed)continue;
 const yards=s.city.wards.yards,tools=yards.budget.produced.tools-control.base.yards.budget.produced.tools,iron=(yards.budget.produced.iron||0)-(control.base.yards.budget.produced.iron||0);
 if(s.at-control.start>=2400&&iron>20&&tools>200&&d.wards.yards.courses.length>=2&&d.wards.canal.courses.length>=5&&s.city.arrived>=4&&Object.values(s.city.wards).every(n=>n.health>=95&&n.stable>=120)){
   await raw('#speedButton');await raw('#event #pause');fs.mkdirSync(path.join(dir,'native'),{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(dir,'native')});await raw('#saveMenu');await raw('#event #download');await sleep(1200);await raw('#event #close');
   const final=await observe();fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({start:control.start,tools,iron,final},null,2));await click('#cityWard_yards');await raw('#cityView_production');const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'industrial-city.png'),Buffer.from(shot.result.data,'base64'));console.log('ACCEPTED',JSON.stringify({at:final.at,pop:final.total,tools,iron}));done=true;break;
 }
 await sleep(1800);
}
if(!done)throw Error('Industrial continuation incomplete; preserve native state and logs');ws.close();
