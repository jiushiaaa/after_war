// A7 closure: independent normal UI lineage. Earlier deliberate-crisis evidence remains separate.
// A7 adaptation of 验证/工具/城市机构玩家.mjs. Same UI-only controls, continuous fresh lineage.
import {handlePolish} from '../a7-decisions.mjs';
// Native 207 continuation: observation is read-only; every action is a real mouse/keyboard event.
// node 城市机构玩家.mjs <CDP port> <evidence directory>
import fs from 'node:fs';import path from 'node:path';
const [port='9342',dir='/tmp/postwar-city-skills-20261103/governance-evidence']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0,done=false;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
ws.onclose=()=>{if(!done){console.error('Disconnected; retain browser and resume this existing save.');process.exit(2);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{if(method==='Input.dispatchKeyEvent'&&params.type==='rawKeyDown')log('key',{key:params.key});const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),q=css=>`document.querySelector(${JSON.stringify(css)})`;
const log=(kind,data)=>fs.appendFileSync(path.join(dir,'actions.ndjson'),JSON.stringify({wall:new Date().toISOString(),kind,...data})+'\n');
async function raw(css){
 await read(`(()=>{const e=${q(css)};if(e?.getClientRects().length)e.scrollIntoView({block:'center',inline:'nearest'});})()`);await sleep(120);
 const box=await read(`(()=>{const e=${q(css)};if(!e||!e.getClientRects().length||e.classList.contains('disabled')||e.disabled)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText.slice(0,90)}:null;})()`);
 if(!box)return false;for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});log('click',{css,...box,at:await read('State.civilization.elapsed')});await sleep(250);return true;
}
async function click(css){
 const info=await read(`(()=>{const e=${q(css)};return e?{panel:e.closest('.location')?.id,folds:[...document.querySelectorAll('details:not([open])')].filter(d=>d.contains(e)).map(d=>d.id)}:null;})()`);if(!info)return false;
 if(info.panel){const id=info.panel==='civilResearchPanel'?'research':info.panel.replace(/Panel$/,'');if(!await read(`${q('#location_'+id)}?.classList.contains('selected')`))await raw('#location_'+id);for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);}
 if(info.panel==='cityPanel'&&!css.startsWith('#cityView_')){const view=css.startsWith('#cityBuild_')?'works':css.startsWith('#cityWard_')||css.startsWith('#citySurvey_')||css==='#cityJoin'?'overview':css==='#cityAid'||css==='#cityFreight'?'transport':'production';if(!await read(`document.querySelector('#cityView_${view}')?.classList.contains('selected')`))await raw('#cityView_'+view);}
 for(const id of info.folds)await raw('#'+id+' > summary');return raw(css);
}
async function select(css,value){
 if(!await click(css))return false;
 if(await read(`${q(css)}.size>1`)){await raw(css+' option[value="'+value+'"]');const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native list selection did not change: '+css);return true;}
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}
const observe=()=>read(`(()=>{const s=State,c=s.civilization;return {at:c.elapsed,total:CivilCity.population(s),home:s.game.population,health:c.village.health,hunger:c.hunger,workers:s.game.workers,stores:s.stores,speed:c.speed,max:c.maxSpeed,paused:CivilClock.paused,event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>({id:b.id,text:b.innerText})),city:c.city};})()`);
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
let s=await observe();if(!s.city?.cityAt||s.total<10000)throw Error('Import native 207 first');
const stateFile=path.join(dir,'controller.json'),control=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)): {start:s.at,manual:false,base:JSON.parse(JSON.stringify(s.city.wards)),last:0};
if(!fs.existsSync(path.join(dir,'start.json')))fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify(s,null,2));
const clinicId=process.env.A7_ROUTE==='public'?'terraces':'canal';
const profiles=process.env.A7_ROUTE==='public'?[['yards','workshop'],['canal','balanced']]:[['yards','balanced'],['canal','provisioning']];
const end=Date.now()+120*60*1000;
while(Date.now()<end){
 s=await observe();const d=s.city.institutions;
 if(s.at-control.last>=300){control.last=s.at;const line={at:s.at,total:s.total,home:s.home,health:s.health,hunger:s.hunger,arrived:s.city.arrived,delegations:d?.home.records.length,training:d&&Object.fromEntries(Object.entries(d.wards).map(([id,x])=>[id,{courses:x.courses.length,training:x.training?.rounds,method:x.careMethod,profile:x.profile}]))};console.log(JSON.stringify(line));log('snapshot',line);fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,2));}
 fs.writeFileSync(stateFile,JSON.stringify(control));
 if(s.event){if(await handlePolish({read,raw,log,route:process.env.A7_ROUTE==='public'?'public':'industrial'}))continue;const options=['engineer','wood','medicine','later','close','school','public','equal'];const chosen=options.map(id=>s.buttons.find(b=>b.id===id)).find(Boolean)||s.buttons[0];if(chosen)await raw('#event #'+chosen.id);await sleep(300);continue;}
 if(s.paused){await raw('#speedButton');await raw('#event #pause');continue;}
 if(s.speed<s.max){await raw('#speedButton');const speed=await read(`[...document.querySelectorAll('#event .button')].find(e=>e.innerText.startsWith('${s.max}×'))?.id`);if(speed)await raw('#event #'+speed);continue;}
 // The city can form with one external ward. Complete the other real local works
 // before this clinical-service sample uses all three; never substitute a later save.
 let wardWork=false;
 for(const [id,n]of Object.entries(s.city.wards))if(n.joinedAt===null){
   if(n.contactedAt===null){if(!s.city.contact)await click('#citySurvey_'+id);}
   else if(!n.project){await click('#cityWard_'+id);if(!n.buildings.road)await click('#cityBuild_road');else if(!n.buildings.water)await click('#cityBuild_water');else await click('#cityJoin');}
   wardWork=true;break;
 }
 if(wardWork){await sleep(800);continue;}
 if(!d){if(!await click('#cityFoundInstitution')){await raw('#location_city');await raw('#cityView_production');}await sleep(500);continue;}
 if(!d.home.enabled){await click('#cityDelegate');continue;}
 let acted=false;
 for(const [id,profile]of profiles)if(d.wards[id].profile!==profile){await click('#cityWard_'+id);await select('#cityProfile',profile);await click('#cityApplyProfile');acted=true;break;}
 if(acted)continue;
 const yards=d.wards.yards,canal=d.wards[clinicId];
 if(!yards.training&&yards.courses.filter(t=>t.result==='completed'&&t.subject==='craft').length<1){await click('#cityWard_yards');await select('#cityTrainingSubject','craft');if(await click('#cityTrain'))continue;}
 if(!canal.schoolEnabled){await click('#cityWard_'+clinicId);await click('#cityDelegateSchool');continue;}
 const trained=await read(`CivilCityInstitutions.trained(State,'${clinicId}','care')>=Math.ceil(CivilCity.count(CivilCity.node(State,'${clinicId}'))*.01/.3)`);
 const deliveredFood=Object.entries(s.city.wards).reduce((n,[id,w])=>n+(w.budget.received.food||0)-(control.base[id].budget.received.food||0),0);
 if(trained&&canal.careMethod!=='clinical'){await click('#cityWard_'+clinicId);await select('#cityCareMethod','clinical');await click('#cityApplyCare');continue;}
 if(trained&&!canal.schoolEnabled){await click('#cityWard_'+clinicId);await click('#cityDelegateSchool');continue;}
 const yard=s.city.wards.yards;
 if((yard.economy?.food||0)>=0&&yard.health>=95&&yard.stable>=120){control.selfFoodStart??={at:s.at,made:yard.budget.produced.food||0,used:yard.budget.consumed.food||0};}else control.selfFoodStart=null;
 const selfFed=control.selfFoodStart&&s.at-control.selfFoodStart.at>=600&&(yard.budget.produced.food||0)-control.selfFoodStart.made>=(yard.budget.consumed.food||0)-control.selfFoodStart.used-1e-6;
 const food=(s.city.wards.yards.budget.received.food||0)-(control.base.yards.budget.received.food||0),tools=(s.city.wards.terraces.budget.received.tools||0)-(control.base.terraces.budget.received.tools||0);
 if(trained&&canal.careMethod==='clinical'&&Object.values(s.city.wards).every(n=>n.health>=95&&n.stable>=120)){
   await raw('#speedButton');const pause=await read("[...document.querySelectorAll('#event .button')].find(e=>e.innerText.includes('暂停'))?.id");await raw('#event #'+pause);
   await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(dir,'native')});fs.mkdirSync(path.join(dir,'native'),{recursive:true});
   await raw('#saveMenu');await raw('#event #download');await sleep(1200);await raw('#event #close');
   const final=await observe();fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({start:control.start,manualRevoked:control.manual,recovery:{crisisAt:control.crisisAt,lowestHealth:control.lowestHealth,reliefSent:control.reliefSent,recoveredAt:control.recoveredAt},received:{foodIntoYards:food,foodAcrossWards:deliveredFood,tools},selfFoodEvidence:selfFed?{...control.selfFoodStart,end:s.at,made:yard.budget.produced.food-control.selfFoodStart.made,used:yard.budget.consumed.food-control.selfFoodStart.used}:null,final},null,2));
   await click('#cityWard_'+clinicId);await raw('#cityView_production');const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'governance.png'),Buffer.from(shot.result.data,'base64'));
   console.log('ACCEPTED',JSON.stringify({at:final.at,total:final.total,food,tools}));done=true;break;
 }
 await sleep(1800);
}
if(!done)throw Error('Bounded natural run unfinished; keep evidence and browser state');ws.close();
