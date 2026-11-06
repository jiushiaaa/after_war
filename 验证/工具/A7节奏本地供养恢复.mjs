// Same natural public world after observed over-specialisation; only native UI input.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {connect} from './a7-cdp.mjs';import {handlePolish} from './a7-decisions.mjs';
const dir='验证/A7节奏/public/local-recovery',b=await connect(9380,dir);
const obs=()=>b.read(`(()=>{const c=State.civilization;return {at:c.elapsed,paused:CivilClock.paused,global:CivilCensus.total(State),born:c.census.born,dead:c.census.dead,guide:CivilGuide.steps(State),wards:Object.fromEntries(CivilCity.members(State).map(([id,n])=>[id,{population:CivilCity.count(n),health:n.health,stable:n.stable,stores:n.stores,workers:n.workers,flow:n.economy?.flow,profile:CivilCityInstitutions.local(State,id).profile,changes:CivilCityInstitutions.local(State,id).changes}])),shipments:c.city.shipments,cluster:c.conurbation.clusterAt,suspended:c.conurbation.suspended,tripCount:c.conurbation.trips.length}})()`);
async function routine(){return handlePolish({...b,route:'public'});}
async function pause(value){for(let i=0;i<8;i++){if(await b.read('!!CivilClock.paused')===value)return;await routine();await b.click('#speedButton');await b.raw('#event #pause');}throw Error('pause failed');}
async function save(label){await pause(true);const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await b.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});assert.ok(await b.raw('#saveMenu'));assert.ok(await b.raw('#event #download'));await b.sleep(1200);assert.ok(await b.raw('#event #close'));assert.ok(fs.existsSync(destination+'/战后文明-存档.json'));fs.writeFileSync(destination+'/observation.json',JSON.stringify(await obs(),null,2));await b.shot(label);return destination+'/战后文明-存档.json';}
async function home(id,view){assert.ok(await b.click('#location_city'));assert.ok(await b.click('#metroCity_select_home'));assert.ok(await b.click('#cityWard_'+id));assert.ok(await b.click('#cityView_'+view));}
async function link(){assert.ok(await b.click('#location_city'));assert.ok(await b.click('#metroCity_select_link'));}
async function waitUntil(expression,timeout=600000){const end=Date.now()+timeout;while(Date.now()<end){await routine();if(await b.read(expression))return;await b.sleep(180);}throw Error('Recovery wait expired: '+expression);}
const file=dir+'/controller.json',control=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{stage:'start',done:[]};const record=()=>fs.writeFileSync(file,JSON.stringify(control,null,2));
try{
 if(control.stage==='start'){
  if(!control.source){control.before=await obs();const original=await save('before');control.source=original;record();
   await b.send('Page.reload');await b.sleep(1000);await routine();await b.click('#saveMenu');await b.raw('#event #import');await b.raw('#event textarea');await b.send('Input.insertText',{text:fs.readFileSync(original,'utf8')});assert.ok(await b.raw('#event #inspect'));await b.sleep(700);assert.ok(await b.raw('#event #replace'));await pause(true);
  }else if(await b.read('!!document.querySelector("#event #close")'))await b.raw('#event #close');
  const g=await b.read('CivilGuide.steps(State)');assert.equal(g.visit.ward,'terraces');assert.equal(g.visit.target,'cityAid');
  control.ui=[];
  for(const width of [1280,853,390]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await b.click('#location_city');assert.ok(await b.click('#civilGuideGo'));assert.equal(await b.read('document.activeElement.id'),'cityAid');assert.equal(await b.read('CivilCityView.selected'),'terraces');assert.ok(await b.read('document.documentElement.scrollWidth<=innerWidth'));await b.shot(width+'-tool-alert');control.ui.push({width,target:'cityAid',ward:'terraces',overflow:false});}
  await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await link();if(!await b.read('State.civilization.conurbation.suspended'))assert.ok(await b.click('#metroCity_pause'));
  await b.click('#speedButton');assert.ok(await b.raw('#event #speed_'+await b.read('State.civilization.maxSpeed')));control.stage='balance';record();
 }
 for(const id of ['terraces','canal'])if(!control.done.includes(id)){
  await pause(false);await waitUntil(`CivilCity.aidReason(State,${JSON.stringify(id)})===null`);await pause(true);await home(id,'transport');assert.ok(await b.click('#cityAid'));b.log('governance',{action:'paid_home_aid',ward:id,at:await b.read('State.civilization.elapsed')});
  await pause(false);await waitUntil(`State.civilization.city.wards.${id}.stores.tools>=1`);await pause(true);await home(id,'production');await b.select('#cityProfile','balanced');assert.ok(await b.click('#cityApplyProfile'));assert.equal(await b.read(`CivilCityInstitutions.local(State,${JSON.stringify(id)}).profile`),'balanced');b.log('governance',{action:'restore_local_tool_work',ward:id,at:await b.read('State.civilization.elapsed')});control.done.push(id);record();
 }
 await pause(false);await waitUntil(`['terraces','canal'].every(id=>State.civilization.city.wards[id].stores.tools>=12&&State.civilization.city.wards[id].economy.flow.tools>0)`);await pause(true);await link();if(await b.read('State.civilization.conurbation.suspended'))assert.ok(await b.click('#metroCity_pause'));control.resumed=await obs();record();await save('production-restored');
 await pause(false);await waitUntil(`CivilCity.members(State).every(([id,n])=>n.health>=95&&n.stable>=120)&&State.civilization.conurbation.clusterAt!==null`);await save('recovered');control.after=await obs();control.stage='done';control.errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');record();assert.equal(control.errors.length,0);console.log('RECOVERED',JSON.stringify({at:control.after.at,wards:control.after.wards,source:control.source}));
}finally{await pause(true);b.close();}
