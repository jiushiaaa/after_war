// A7 closure: independent normal UI lineage. Earlier deliberate-crisis evidence remains separate.
// A7 adaptation of 验证/工具/A4国约玩家.mjs. Same UI-only controls, continuous fresh lineage.
import {handlePolish} from '../a7-decisions.mjs';
// Natural A4 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9372',dir='/tmp/postwar-a4-complete-20261105/public']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 await read(`(()=>{const e=${q(css)};if(e?.checkVisibility())e.scrollIntoView({block:'center',inline:'nearest'});})()`);await sleep(120);
 const box=await read(`(()=>{const e=${q(css)};if(!e||!e.checkVisibility()||e.classList.contains('disabled')||e.disabled)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText.slice(0,90)}:null;})()`);
 if(!box){log('unreachable',{css,info:await read(`(()=>{const e=${q(css)};if(!e)return null;const r=e.getBoundingClientRect();return {rect:r.toJSON(),visible:e.checkVisibility(),disabled:e.disabled,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500)};})()`)});return false;}for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});log('click',{css,...box,at:await read('State.civilization.elapsed')});await sleep(250);return true;
}
async function click(css){
 const info=await read(`(()=>{const e=${q(css)};return e?{panel:e.closest('.location')?.id,folds:[...document.querySelectorAll('details:not([open])')].filter(d=>d.contains(e)&&e!==d.querySelector(':scope > summary')).map(d=>d.id)}:null;})()`);if(!info)return false;
 if(info.panel){const id=info.panel==='civilResearchPanel'?'research':info.panel.replace(/Panel$/,'');if(!await read(`${q('#location_'+id)}?.classList.contains('selected')`))await raw('#location_'+id);for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);}
 for(const id of info.folds){for(let n=0;n<3&&!await read(`${q('#'+id)}.open`);n++){await raw('#'+id+' > summary');await sleep(300);}if(!await read(`${q('#'+id)}.open`))throw Error('Could not unfold '+id);}return raw(css);
}
async function select(css,value){
 for(let n=0;n<6;n++){if(await click(css))break;if(n===5)throw Error('Cannot reach selection '+css);await sleep(300);}
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}



// This controller only reads state. Every game action is a real UI mouse/key input.
const route=process.env.A7_ROUTE==='public'?'public':'industrial';
const observe=()=>read(`(()=>{const d=CivilPolity.data(State),f=d?.world.foreign;return {at:State.civilization.elapsed,paused:!!CivilClock.paused,maxSpeed:State.civilization.maxSpeed,speed:State.civilization.speed,event:Events.activeEvent()?.title,pending:State.civilization.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),cofund:!!CivilRegional.data(State)?.cofunding,founded:d?.foundedAt,common:d?CivilPolity.population(State):0,stable:d?.stable,service:d?.lastService,contacts:d?.contacts,peers:d?Object.keys(d.peers):[],nodes:d?.world.nodes,foreign:f?{round:f.round,actors:f.actors,pairs:f.pairs,shipments:f.shipments,leagues:f.leagues,network:!!f.network,markets:!!f.markets,congress:!!f.congress,defenseAt:f.congress?.defenseAt,aftermath:f.aftermath,settlement:f.settlement,publicOrders:f.publicOrders,reputation:f.leagues?.reputation,reviews:f.network?.reviews,credits:f.network?.cash,votes:f.network?Object.fromEntries(Object.keys(d.world.nodes).map(id=>[id,CivilAftermath.vote(d.world,id)])):{}}:null,cities:CivilCityCouncil.ids(State).map(id=>{const n=CivilCityCouncil.local(State,id);return {id,health:n.health,stable:n.stable};})};})()`);
async function handle(){if(await handlePolish({read,raw,log,route:process.env.A7_ROUTE==='public'?'public':'industrial'}))return true;const s=await observe();if(!s.event)return false;const key=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!key||!s.buttons.includes(key))throw Error('Unknown event '+JSON.stringify({event:s.event,pending:s.pending,buttons:s.buttons}));log('decision',{at:s.at,pending:s.pending,key});await raw('#event #'+key);return true;}
async function pause(value){for(let i=0;i<8;i++){if(await read('!!CivilClock.paused')===value)return;if(await handle())continue;await raw('#speedButton');await raw('#event #pause');}throw Error('Pause failed');}
async function region(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);if(!await click('#domainEntry'))throw Error('Regional entry unavailable');}
async function desk(){await region();if(!await read("document.querySelector('#polityDesk')?.open"))await click('#polityDesk > summary');}
async function task(section,key,actor='west'){await pause(true);await desk();await select('#politySection',section);if(!['institutions','equipment'].includes(section))await select('#polityActor',actor);await select('#polityTask',key);if(!await click('#polity_commit'))throw Error('UI action unavailable '+key+': '+await read("document.querySelector('#polityTerms').innerText"));}
const reason=(action,args={})=>read(`CivilPolity.reason(State,${JSON.stringify(action)},${JSON.stringify(args)})`);
async function exportSave(label){await pause(true);await desk();let destination=path.resolve(dir,label);if(fs.existsSync(path.join(destination,'战后文明-存档.json')))destination=path.resolve(dir,label+'_'+(await observe()).at);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('Export unavailable');await sleep(1300);await raw('#event #close');const state=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(state,null,2));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(shot.result.data,'base64'));log('export',{label,at:state.at});}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await pause(true);await region();
const file=path.join(dir,'controller.json'),control=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{stage:'cofund',start:(await observe()).at,last:0};const save=()=>fs.writeFileSync(file,JSON.stringify(control));
const advance=async(stage,label)=>{if(label)await exportSave(label);control.stage=stage;control.after=(await observe()).at;save();await pause(false);};
let stopRequested=false;process.on('SIGTERM',()=>{stopRequested=true;});
if(control.stage!=='cofund')await pause(false);const deadline=Date.now()+60*60*1000;
while(Date.now()<deadline){if(stopRequested){await pause(true);save();log('operator_pause',{at:(await observe()).at,stage:control.stage});done=true;ws.close();process.exit(75);}const s=await observe();if(s.at-control.last>=600){control.last=s.at;log('snapshot',{stage:control.stage,...s});console.log(JSON.stringify({at:s.at,stage:control.stage,common:s.common,stable:s.stable,round:s.foreign?.round}));}save();if(await handle())continue;
 if(s.founded&&s.maxSpeed>=32&&s.speed!==32){await raw('#speedButton');await raw('#event #speed_32');continue;}
 const ready=async(action,args={})=>(await reason(action,args))===null;
 if(s.founded){const q=await read('State.civilization.polity.world.equipment?.north');if(q&&!q.training&&!q.patrol){const type=['infantry','mobile','support'].find(k=>q.levels[k]<2);if(type&&await ready('equipment',{op:'train',type})){await task('equipment','train_'+type);await pause(false);log('real_equipment_training',{at:s.at,type,level:q.levels[type]+1});continue;}}}

 if(control.stage==='clearing'&&s.foreign){await advance('shipping');continue;}
 if(control.stage==='shipping'&&s.foreign?.markets){await advance('congress');continue;}
 if(control.stage==='congress'&&s.foreign?.congress){await advance('trade');continue;}
 if(control.stage==='cofund'){if(!s.cofund){if(!await click('#regional_cofund'))throw Error('Cofunding unavailable');}if(await ready('start')){await desk();if(!await click('#polity_begin'))throw Error('Founding unavailable');await advance('found',route==='public'?'322_public_institutions':'334_industrial_institutions');}else await pause(false);
 }else if(control.stage==='found'&&s.founded){await advance('west',route==='public'?'323_public_charter':'335_industrial_charter');
 }else if(control.stage==='west'&&await ready('contact',{actor:'west'})){await task('contact','contact','west');await advance('desert');
 }else if(control.stage==='desert'&&await ready('contact',{actor:'desert'})){await task('contact','contact','desert');await advance('clearing');
 }else if(control.stage==='clearing'&&await ready('protocol',{mode:'clearing'})){await task('relations','clearing');await advance('shipping',route==='public'?'324_public_contacts':'336_industrial_contacts');
 }else if(control.stage==='shipping'&&await ready('protocol',{mode:'shipping'})){await task('relations','shipping');await advance('congress');
 }else if(control.stage==='congress'&&await ready('protocol',{mode:'congress'})){await task('relations','congress');await advance('trade');
 }else if(control.stage==='trade'&&s.foreign?.shipments.filter(x=>x.arrivedAt!==null&&!x.returned).length>=6&&s.stable===600){await advance(route==='public'?'join':'steel',route==='public'?'325_public_trade':'337_industrial_trade');
 }else if(control.stage==='join'&&await ready('join',{actor:'west'})){await task('relations','join','west');await advance('cut', '326_public_joined');
 }else if(control.stage==='cut'&&s.at-control.after>=1200&&await ready('pause',{enabled:false})){await task('institutions','pause');await advance('resume','327_public_pause');
 }else if(control.stage==='resume'&&s.at-control.after>=1200&&await ready('pause',{enabled:true})){await task('institutions','pause');await advance('recover','328_public_resume');
 }else if(control.stage==='recover'&&s.stable===600&&s.at-control.after>=1200){await advance('sustain','329_public_recovered');
 }else if(control.stage==='steel'){if((s.nodes?.north.stores.steel||0)>=48){await advance('ally','338_industrial_equipped');}else if(await ready('purchase',{actor:'west',item:'steel',quantity:12})){await task('trade','buy_steel','west');await pause(false);}
 }else if(control.stage==='recoveryPrep'){
  const f=s.foreign,a=f.aftermath,dip=async(group,action,detail,section,key,actor='desert')=>{if(!await ready('diplomacy',{group,action,detail}))return false;await task(section,key,actor);await pause(false);return true;};
  const peaceLaws={devolution:'local',rights:'equal',priority:'care'};if(await ready('law',{laws:peaceLaws})){await pause(true);await desk();await select('#politySection','institutions');for(const[key,value]of Object.entries(peaceLaws))await select('#polityLaw_'+key,value);await select('#polityTask','law');if(!await click('#polity_commit'))throw Error('Peace law proposal unavailable');await pause(false);log('governance_choice',{at:s.at,reason:'local guarantees and essential services to support an actual peace agreement',laws:peaceLaws});continue;}
  if(!a&&await ready('protocol',{mode:'aftermath'})){await task('conflict','aftermath','desert');await advance('recoveryPrep','340_industrial_recovery_governance');continue;}
  if(a?.mandates?.north?.mode!=='rebuild'&&await dip('aftermath','mandate',{actor:'north',mode:'rebuild'},'conflict','mandate'))continue;
  if(a&&!a.industries.north&&await dip('aftermath','industry',{actor:'north'},'conflict','industry'))continue;
  const pact=f.leagues.pacts.find(x=>x.pair==='north-west'&&x.status==='active');
  if(pact&&!pact.notice&&await dip('leagues','notice',{pair:'north-west',actor:'north'},'relations','notice','west'))continue;
  if(f.actors.north.balance<0&&await dip('network','settle',{actor:'north'},'trade','settle'))continue;
  if((f.votes?.north||0)<50&&(f.reputation?.north||0)>0&&!f.reviews?.some(x=>x.completedAt===null)&&await dip('network','review',{actor:'north'},'trade','review'))continue;
  if(s.nodes.desert.stores.parts<40&&await ready('relief',{actor:'desert',quantity:24})){await task('trade','relief','desert');await pause(false);continue;}
  if(a&&Object.values(f.votes).every(v=>v>=50)&&s.nodes.desert.stores.parts>=8&&await ready('diplomacy',{group:'aftermath',action:'conference',detail:{}})){await advance('conference','341_industrial_credit_repair');continue;}
 }else if(control.stage==='ally'){
  const key='desert-north',pact=s.foreign.leagues.pacts.find(x=>x.pair===key&&x.status==='active');
  if(s.foreign.defenseAt===undefined&&await ready('diplomacy',{group:'congress',action:'defense',detail:{}})){await task('relations','defense_clause','desert');await pause(false);}
  else if(pact?.type==='defense'){await advance('leave','339_industrial_defense');}
  else {const action=pact?'upgrade':'offer',detail=pact?{pair:key}:{pair:key,type:'defense'};if(await ready('diplomacy',{group:'leagues',action,detail})){await task('relations','defense','desert');await pause(false);}}
 }else if(control.stage==='leave'){
  const pact=s.foreign.leagues.pacts.find(x=>x.pair==='north-west'&&x.status==='active');if(!pact){await advance('embargo');}else if(!pact.notice&&await ready('diplomacy',{group:'leagues',action:'notice',detail:{pair:'north-west',actor:'north'}})){await task('relations','notice','west');await pause(false);}
 }else if(control.stage==='embargo'&&await ready('embargo',{actor:'west'})){await task('conflict','embargo','west');await advance('war');
 }else if(control.stage==='war'&&await ready('mobilize',{actor:'west'})){await task('conflict','mobilize','west');await advance('damage','340_industrial_mobilized');
 }else if(control.stage==='damage'&&s.nodes.north.casualties>0&&s.nodes.west.casualties>0&&s.at-control.after>=1200){await advance('aftermath','341_industrial_actual_losses');
 }else if(control.stage==='aftermath'&&await ready('protocol',{mode:'aftermath'})){await task('conflict','aftermath');await advance('conference');
 }else if(control.stage==='conference'&&await ready('diplomacy',{group:'aftermath',action:'conference',detail:{}})){await task('conflict','conference');await advance('consent');
 }else if(control.stage==='consent'){
  const conf=s.foreign.aftermath.conferences.at(-1);if(conf.status==='active'){await advance('repair','342_industrial_ceasefire');}else if(['refused','expired','failed'].includes(conf.status)){await advance('recoveryPrep');}
 }else if(control.stage==='repair'&&s.foreign.aftermath.plans.north?.mode==='services'){await advance('neighbor_repair');
 }else if(control.stage==='repair'&&await ready('diplomacy',{group:'aftermath',action:'plan',detail:{actor:'north',mode:'services'}})){await task('conflict','repair');await advance('neighbor_repair');
 }else if(control.stage==='neighbor_repair'){
  const id=['desert','west'].find(id=>s.nodes[id].infrastructure<100&&s.foreign.aftermath.plans[id]?.mode!=='services');
  if(!id)await advance('industry');else if(await ready('diplomacy',{group:'aftermath',action:'plan',detail:{actor:id,mode:'services'}})){await task('conflict','foreign_repair',id);await pause(false);}
 }else if(control.stage==='industry'&&s.foreign.aftermath.industries.north){await advance('reconstruction','343_industrial_paid_reconstruction');
 }else if(control.stage==='industry'&&await ready('diplomacy',{group:'aftermath',action:'industry',detail:{actor:'north'}})){await task('conflict','industry');await advance('reconstruction','343_industrial_paid_reconstruction');
 }else if(control.stage==='reconstruction'){
  if(s.foreign.aftermath.conferences.some(x=>x.status==='completed'))await advance('settlement','348_industrial_rebuilt_trade');
  else if(['expired','failed','refused'].includes(s.foreign.aftermath.conferences.at(-1).status))await advance('recoveryPrep');
  else if(s.nodes.desert.stores.parts<60&&await ready('relief',{actor:'desert',quantity:48})){await task('trade','relief48','desert');await pause(false);}
  else if(s.foreign.credits?.north&&await ready('diplomacy',{group:'network',action:'credit',detail:{actor:'north'}})){await task('trade','credit');await pause(false);}
 }else if(control.stage==='settlement'&&await ready('protocol',{mode:'settlement'})){await task('conflict','settlement');await advance('treaty');
 }else if(control.stage==='treaty'&&await ready('diplomacy',{group:'settlement',action:'treaty',detail:{pair:'desert-north',mode:'memory',actor:'north'}})){await task('conflict','treaty_memory','desert');await advance('treaty_active');
 }else if(control.stage==='treaty_active'&&s.foreign.settlement.treaties.at(-1).status==='active'){await advance('sustain','349_industrial_peace_obligations');
 }else if(control.stage==='sustain'&&s.at-control.after>=60){await exportSave(route==='public'?'public_institutions_active':'industrial_peace_active');control.end=(await observe()).at;control.stage='done';save();done=true;break;
 }else if(control.stage==='done'){done=true;break;}await sleep(900);
}if(!done)throw Error('Not complete; preserve browser and controller');console.log('ACCEPTED',JSON.stringify(control));ws.close();
