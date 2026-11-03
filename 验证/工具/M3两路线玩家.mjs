// MPL-2.0. Developer-driven natural play: read-only observation and real DOM mouse input.
// node M3两路线玩家.mjs commons|industry <CDP port> <output directory>
// No state assignment, injected resources, virtual time, or direct game-function actions.
import fs from 'node:fs';
import path from 'node:path';
const [route,port='9334',dir='/tmp/postwar-m3-commons']=process.argv.slice(2);
if(!['commons','industry'].includes(route))throw Error('route');
fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
await fetch(`http://127.0.0.1:${port}/json/activate/${page.id}`);
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0,done=false;
ws.onclose=()=>{if(!done){console.error('CDP disconnected; continue from the existing browser save, never restart the game.');process.exit(2);}};
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),q=s=>`document.querySelector(${JSON.stringify(s)})`;
const log=(kind,data)=>{fs.appendFileSync(path.join(dir,'actions.ndjson'),JSON.stringify({wall:new Date().toISOString(),kind,...data})+'\n');};
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
async function rawClick(expr){
  await read(`(()=>{const e=${expr};if(e?.getClientRects().length)e.scrollIntoView({block:'nearest',inline:'nearest'});})()`);await sleep(80);
  const b=await read(`(()=>{const e=${expr};if(!e||e.classList.contains('disabled')||e.disabled||!e.getClientRects().length)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(!hit||!e.contains(hit))return null;return {x,y,text:e.innerText?.slice(0,100)};})()`);
  if(!b)return false;
  for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1});
  log('click',{expr,text:b.text});await sleep(130);return true;
}
async function click(css){
  const info=await read(`(()=>{const e=${q(css)};if(!e||e.classList.contains('disabled'))return null;return {panel:e.closest('.location')?.id,fold:[...document.querySelectorAll('details:not([open])')].find(d=>d.contains(e))?.id};})()`);
  if(!info)return false;
  if(info.panel){const id=info.panel==='civilResearchPanel'?'research':info.panel.replace(/Panel$/,'');if(await read(`!${q('#location_'+id)}?.classList.contains('selected')`))await rawClick(q('#location_'+id));
    for(let i=0;i<35&&await read(`$('#locationSlider').is(':animated')`);i++)await sleep(100);
  }
  if(info.panel==='urbanPanel'){
    const category=css.startsWith('#build_')?await read(`CivilInterface.kinds[${JSON.stringify(css.slice(7))}]||'care'`):css.startsWith('#urban')?'migration':null;
    if(category)await rawClick(q('#civilTab_urban_'+category));
  }
  if(info.panel==='industryPanel'&&css.startsWith('#build_')){
    const category=await read(`CivilInterface.kinds[${JSON.stringify(css.slice(7))}]||'industry'`);
    await rawClick(q('#civilTab_industry_'+category));
  }
  if(info.panel==='cityPanel'){
    const view=css.startsWith('#cityBuild_')||css==='#cityWater'?'works':css.startsWith('#cityPriority_')||css.startsWith('#cityMethod_')?'production':css==='#cityAid'||css==='#cityFreight'?'transport':'overview';
    await rawClick(q('#cityView_'+view));
  }
  if(info.fold)await rawClick(q('#'+info.fold+' > summary'));
  return rawClick(q(css));
}
const observe=()=>read(`(()=>{const s=State,c=s.civilization;return {ruleset:c.ruleset,city:c.city,sim:c.elapsed,pop:s.game.population,b:s.game.buildings,w:s.game.workers,st:s.stores,tech:c.tech,course:c.course,fire:s.game.fire.value,research:c.research,journey:c.journey,pending:c.pending,capacity:CivilCatalog.capacity(s),free:Outside.getNumGatherers(),workforce:CivilSociety.workforce(s),caps:Object.fromEntries(Object.keys(CivilCatalog.jobs).map(j=>[j,CivilCatalog.jobCapacity(s,j)])),town:c.village.town,station:c.station,pump:c.pump,health:c.village.health,river:c.village.riverKnown,allied:c.village.riverAllied,exp:c.expedition,urban:c.urban,regions:c.regions,speed:c.speed,max:c.maxSpeed,paused:!!CivilClock.paused,guide:CivilGuide.steps(s),event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll('#event .button')].filter(e=>!e.classList.contains('disabled')).map(e=>({id:e.id,text:e.innerText})),hunger:c.hunger,supplied:c.outpostSupplied};})()`);
async function exportSave(name){
  const out=path.resolve(dir,name);fs.mkdirSync(out,{recursive:true});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});
  await click('#saveMenu');await click('#event #download');await sleep(1200);await click('#event #close');
  const file=fs.readdirSync(out).find(n=>n.endsWith('.json'));if(!file)throw Error('native download missing');
  log('export',{name,file});return path.join(out,file);
}
async function reloadSave(file){
  await send('Page.reload');await sleep(2000);
  await click('#saveMenu');await click('#event #import');await click('#event textarea');await send('Input.insertText',{text:fs.readFileSync(file,'utf8')});
  await click('#event #inspect');await sleep(1000);await click('#event #replace');await sleep(1500);
}
// The baseline driver exits at the first workshop; this runner takes over after its output exists.
const baseline=process.env.BASELINE||`/tmp/postwar-m3-${route}-start.json`;
while(!fs.existsSync(baseline))await sleep(2000);
while((await observe()).event){await rawClick(`[...document.querySelectorAll('#event .button')].find(e=>!e.classList.contains('disabled'))`);}
if(!fs.existsSync(path.join(dir,'ready'))){await reloadSave(await exportSave('workshop'));fs.writeFileSync(path.join(dir,'ready'),'UI reload complete');}
else if(process.env.RELOAD_UI)await reloadSave(await exportSave('checkpoint-'+Date.now()));
const controller=fs.existsSync(path.join(dir,'controller.json'))?JSON.parse(fs.readFileSync(path.join(dir,'controller.json'),'utf8')):{};
let lastReport=-100,lastEvent='',crisis=controller.crisis||null,expPlan=controller.expPlan||null;
const checkpoint=new Set();
async function outfit(members,food,water,kit){
  await click('#location_road');await sleep(450);
  for(const [label,n]of [['队员',members],['口粮',food],['饮水',water]])for(let i=0;i<80;i++){
    const cur=await read(`Number([...document.querySelectorAll('.civil-outfit')].find(e=>e.querySelector('.civil-outfit-name')?.textContent===${JSON.stringify(label)})?.querySelector('.civil-outfit-val')?.textContent)`);
    if(cur===n||!Number.isFinite(cur))break;
    if(!await rawClick(q('.civil-step[aria-label="'+(cur<n?'增加':'减少')+label+'"]')))break;
  }
  const has=await read(`${q('.civil-step[aria-label="切换是否携带泵站维修件"]')}?.getAttribute('aria-pressed')==='true'`);
  if(has!==kit)await rawClick(q('.civil-step[aria-label="切换是否携带泵站维修件"]'));
  return click('#expeditionDepart');
}
const research=['water','metal','agronomy','handtools','preservation','records','sanitation','school','trails','irrigation',...(route==='industry'?['mining','furnace','mechanics','power']:[]),'standards','logistics','survey','administration','urbanworks'];
const end=Date.now()+5*3600*1000;
while(Date.now()<end&&!done){
  let s=await observe();fs.writeFileSync(path.join(dir,'controller.json'),JSON.stringify({crisis,expPlan}));
  if(s.sim-lastReport>=120){lastReport=s.sim;const brief={sim:s.sim,pop:s.pop,capacity:s.capacity,food:Math.floor(s.st.food||0),medicine:Math.floor(s.st.medicine||0),health:s.health,guide:s.guide,course:s.course?.id,urbanStatus:s.urban?.status,workers:s.w,tech:Object.keys(s.tech),crisis};log('snapshot',brief);console.log(JSON.stringify(brief));fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify(s,null,1));}
  if(s.event){
    if(s.event!==lastEvent){lastEvent=s.event;log('event',{sim:s.sim,title:s.event,buttons:s.buttons});}
    const preferences=['course_'+route,'equal','federation','election','constitution','local','engineer','school','medicine','public','apprentice','ex_recover','ex_repair','ex_observe','meet','register','charter','city','ex_leave'];
    let choice=preferences.map(id=>s.buttons.find(b=>b.id===id)).find(Boolean);
    if(!choice)choice=s.buttons.find(b=>!['reform','route','associate','project','upgrade'].includes(b.id))||s.buttons[0];
    if(choice)await click('#event #'+choice.id);else await sleep(1000);continue;
  }
  lastEvent='';
  if(s.speed<s.max){await click('#speedButton');await rawClick(`[...document.querySelectorAll('#event .button')].find(e=>e.innerText.startsWith('${s.max}×'))`);continue;}
  if(s.ruleset===2?s.city?.cityAt!==null&&s.city?.cityAt!==undefined:s.urban?.city){
    await click('#speedButton');await rawClick(`[...document.querySelectorAll('#event .button')].find(e=>e.innerText.includes('暂停'))`);
    const file=await exportSave('city');log('accepted_city',{sim:s.sim,pop:s.pop,route,crisis,file});fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({route,final:s,crisis,file},null,1));done=true;break;
  }
  if(s.exp?.party){
    const p=s.exp.party;
    if(s.station&&expPlan==='station'||s.pump&&expPlan==='pump'){await click('#expeditionReturn');continue;}
    const points=expPlan==='station'?[[17,12],[17,4],[23,4]]:[[12,23],[4,23],[4,19]];
    const idx=Number(fs.existsSync(path.join(dir,'waypoint'))?fs.readFileSync(path.join(dir,'waypoint'),'utf8'):0);
    if(idx>=points.length){await click('#expeditionLook');continue;}
    const [x,y]=points[idx];if(p.pos[0]===x&&p.pos[1]===y){fs.writeFileSync(path.join(dir,'waypoint'),String(idx+1));continue;}
    const label=p.pos[0]!==x?(p.pos[0]<x?'向东':'向西'):(p.pos[1]<y?'向南':'向北');
    await click('#location_road');await rawClick(`[...document.querySelectorAll('.civil-step')].find(e=>e.getAttribute('aria-label')?.startsWith('${label}走一格'))`);continue;
  }
  if(!s.station&&s.free>=1&&(s.st.food||0)>=14&&(s.st.wood||0)>=20){expPlan='station';fs.writeFileSync(path.join(dir,'waypoint'),'0');if(await outfit(1,6,9,false))continue;}
  if(s.station&&!s.pump&&s.tech.water&&s.free>=3&&(s.st.food||0)>=28&&(s.st.scrap||0)>=10&&(s.st.wood||0)>=40){expPlan='pump';fs.writeFileSync(path.join(dir,'waypoint'),'0');if(await outfit(3,18,27,true))continue;}
  if(s.fire<3)await click('#stokeButton');
  const builds=['lodge','cart','cistern','outpost','toolshop','schoolhouse','road'];
  if(s.capacity-s.pop<12)builds.unshift('hut','longhouse');
  if((s.b.farm||0)<Math.min(4,Math.ceil(s.pop/12)))builds.push('farm');
  if((s.b.clinic||0)<2)builds.push('clinic');
  if(route==='industry')for(const id of ['mine','coalpit','furnace','machineworks','powerhouse','scrubber'])if(!s.b[id])builds.push(id);
  if(route==='industry'&&s.pop>=100&&(s.b.furnace||0)<2)builds.push('furnace');
  if((s.b.publicclinic||0)<Math.min(8,Math.max(2,Math.ceil((s.pop+24)/55))))builds.push('publicclinic');
  if((s.b.publicschool||0)<2)builds.push('publicschool');
  if((s.b.irrigatedfield||0)<Math.min(6,Math.max(2,Math.ceil(s.pop/90))))builds.push('irrigatedfield');
  if(!s.b.cartdepot)builds.push('cartdepot');
  if(s.capacity-s.pop<45)builds.push(route==='commons'?'commonhouse':'residential',...(route==='industry'?['blockhousing']:[]));
  for(const id of builds)if(await click('#build_'+id))break;
  if(!s.research)for(const id of research)if(!s.tech[id]&&await click('#research_'+id))break;
  // Capacity-based staffing. Each change still goes through the visible +/- buttons.
  const medic=Math.min(s.caps.medic,Math.ceil((s.pop*.01+.18)/.15)+1),farmer=Math.min(s.caps.farmer,Math.ceil((s.pop*.12+medic*.2+6)/(s.tech.irrigation?2:1.4))),smith=s.b.toolshop?4:0;
  const desired={medic,farmer,teacher:Math.min(s.caps.teacher,s.tech.urbanworks?Math.max(2,Math.ceil(s.pop*.30/20)+1):s.caps.teacher),smith,salvager:Math.ceil((medic*.1+smith*.6)/.8)+2,transporter:s.b.cartdepot?6:0,hunter:farmer?0:Math.ceil(s.pop*.12/.8)+2};
  if(route==='industry')Object.assign(desired,{miner:s.b.mine?(s.pop>=100?4:3):0,collier:s.b.coalpit?(s.pop>=100?4:3):0,smelter:Math.min(s.caps.smelter,s.pop>=100?4:3),machinist:s.b.machineworks?2:0,electrician:s.b.powerhouse?2:0});
  const otherLabor=Object.entries(desired).filter(([job])=>job!=='teacher').reduce((n,[,v])=>n+v,0);
  desired.teacher=Math.min(desired.teacher,Math.max(2,s.workforce-2-otherLabor));
  // Deliberately stop medicine production once services are operating; restore via the same UI.
  if(route==='commons'&&s.urban?.chartered&&!crisis){crisis={started:s.sim,medicineBefore:s.st.medicine,phase:'cut'};await exportSave('before-cut');log('supply_cut',crisis);}
  if(crisis?.phase==='cut'){
    desired.medic=0;
    if(!s.urban.economy?.treatment&&s.health<94){crisis={...crisis,failedAt:s.sim,healthLow:s.health,phase:'restore'};log('supply_failed',crisis);await exportSave('during-cut');}
  }
  if(crisis?.phase==='restore'&&s.urban.economy?.treatment&&s.health>=98&&(s.urban.economy.medicine||0)>=0){crisis={...crisis,restoredAt:s.sim,phase:'recovered'};log('supply_recovered',crisis);await exportSave('after-cut');}
  for(const [job,n]of Object.entries(desired))if((s.w[job]||0)>n){await click('#workers_row_'+job+' .dnBtn');break;}
  s=await observe();
  let free=s.free-(s.pump?2:3);
  for(const [job,n]of Object.entries(desired))if(free>0&&(s.w[job]||0)<n){for(let k=0;k<Math.min(4,n-(s.w[job]||0),free);k++)await click('#workers_row_'+job+' .upBtn');break;}
  if(!s.journey){for(const id of ['riverButton','riverPact',...(route==='industry'?['geologyButton']:[]),'railSurveyButton'])if(await click('#'+id))break;}
  if(s.regions?.active&&s.tech.administration&&!s.regions.projects.river&&s.regions.nodes.river){
    await click('button[data-region="river"]');if(await read(`!!${q('#event #project')}`))await click('#event #project');
  }
  if(s.ruleset===2&&s.tech.survey){
    if(!s.city.contact)for(const [id,n]of Object.entries(s.city.wards))if(n.contactedAt===null&&await click('#citySurvey_'+id))break;
    for(const [id,n]of Object.entries(s.city.wards))if(n.contactedAt!==null&&!n.project&&(!n.buildings.road||!n.buildings.water||n.joinedAt===null)){
      await click('#cityWard_'+id);
      if(!n.project){if(!n.buildings.road)await click('#cityBuild_road');else if(!n.buildings.water)await click('#cityBuild_water');}
      if(n.joinedAt===null)await click('#cityJoin');
    }
  }
  if(s.urban?.registered&&!s.urban.enabled)await click('#urbanPlan');
  if(!s.town){for(const id of ['gatherButton','trapsButton','forageButton','scrapButton'])await click('#'+id);}
  await sleep(700);
}
if(!done)throw Error('Natural route exceeded wall time; evidence retained');
ws.close();
