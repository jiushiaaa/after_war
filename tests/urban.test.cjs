const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8')).state,messages=[];
  const ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:t=>messages.push(t)}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/population.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  ctx.CivilSociety.init(s);ctx.CivilRegions.init(s);ctx.CivilUrban.init(s);ctx.CivilMunicipal.init(s);return {s,ctx,u:ctx.CivilUrban,r:ctx.CivilRegions,messages};
}
function prepare(h){
  const {s,u,r}=h;
  Object.assign(s.civilization.tech,{standards:true,logistics:true,administration:true});
  Object.assign(s.game.buildings,{cartdepot:1,publicclinic:1,publicschool:1,irrigatedfield:1,residential:2});
  s.game.workers={farmer:6,medic:8,teacher:4,smith:2,salvager:5,miner:1,collier:2,smelter:1,machinist:2,electrician:2,transporter:6};
  for(const key of h.ctx.CivilCatalog.resources)s.stores[key]=1000;
  r.activate(s);r.createNode(s,'rail');u.register(s);s.civilization.urban.enabled=true;
  return h;
}
function settle(h){
  const {s,ctx,u}=h,before={...s.stores},flow=ctx.CivilRules.settle(s).flow;
  const care=ctx.CivilVillage.treatment(s);ctx.CivilVillage.settle(s);flow['诊所治疗']={medicine:-care};
  Object.assign(flow,ctx.CivilSociety.settle(s),ctx.CivilIndustry.settle(s),ctx.CivilRegions.settle(s));
  const deltas={};for(const key of ctx.CivilCatalog.resources)deltas[key]=(s.stores[key]||0)-(before[key]||0);
  u.settle(s,{flow,deltas});return {flow,deltas};
}
function tick(h,seconds){for(let i=0;i<seconds;i++){h.s.civilization.elapsed++;h.u.tick(h.s);}}
test('first-power saves gain no people or grants; new capacities use paid facilities and one industrial limit',()=>{
  const {s,ctx,u}=harness(),before=JSON.stringify(s.stores),population=s.game.population;
  u.init(s);assert.equal(s.game.population,population);assert.equal(JSON.stringify(s.stores),before);assert.equal(u.nextEvent(s),null);
  assert.equal(ctx.CivilCatalog.researchAvailable(s,'standards'),true);assert.ok(!u.buildings.residential.gate());
  s.civilization.tech.standards=true;assert.ok(u.buildings.publicclinic.gate());
  Object.assign(s.game.buildings,{hut:4,longhouse:4,residential:8,blockhousing:4,publicclinic:8,publicschool:4,irrigatedfield:6,toolworks:2,farm:4});
  assert.equal(ctx.CivilCatalog.capacity(s),624);assert.equal(ctx.CivilCatalog.jobCapacity(s,'medic'),36);assert.equal(ctx.CivilCatalog.jobCapacity(s,'teacher'),20);assert.equal(ctx.CivilCatalog.jobCapacity(s,'farmer'),64);assert.equal(ctx.CivilCatalog.jobCapacity(s,'smith'),12);
  assert.equal(ctx.CivilCatalog.buildingLimit(s,'mine'),2);s.civilization.tech.urbanworks=true;assert.equal(ctx.CivilCatalog.buildingLimit(s,'mine'),4);
  s.game.workers.farmer=32;assert.equal(ctx.CivilRules.rates(s)['农夫'].food,64);s.civilization.outpostSupplied=false;assert.equal(ctx.CivilRules.rates(s)['农夫'].food,44.8);
});
test('the discovered family source is initialized once and each paid batch keeps ages and identities',()=>{
  const h=prepare(harness()),{s,u}=h,x=s.civilization.urban;
  assert.equal(u.count(x.source),480);assert.equal(u.register(s),false);assert.equal(u.count(x.source),480);
  const stores={...s.stores},population=s.game.population;
  assert.equal(u.dispatch(s),true);assert.equal(u.count(x.source),472);assert.equal(s.game.population,population);assert.equal(u.reservedBeds(s),8);assert.equal(u.reservedTransport(s),2);
  assert.equal(u.children(x.parties[0].cohorts),2);assert.ok(x.parties[0].cohorts.some(c=>c.age>=60));assert.ok(x.parties[0].cohorts.some(c=>c.identity==='mutant'));
  assert.equal(stores.food-s.stores.food,48);assert.ok(Math.abs(stores.medicine-s.stores.medicine-1.6)<1e-8);assert.ok(Math.abs(stores.tools-s.stores.tools-1.6)<1e-8);
  x.enabled=false;tick(h,120);assert.equal(s.game.population,population+8);assert.equal(u.reservedBeds(s),0);assert.equal(u.reservedTransport(s),2);assert.equal(h.ctx.CivilSociety.total(s.civilization.society),s.game.population);
  const once=s.game.population;tick(h,120);assert.equal(s.game.population,once);assert.equal(u.reservedTransport(s),0);assert.equal(x.admitted,8);assert.doesNotThrow(()=>u.validate(s));
});
test('route and passenger crews share one pool, including empty returns and retirement shortages',()=>{
  const h=prepare(harness()),{s,u,r}=h;
  s.game.workers.transporter=4;assert.equal(r.availableTransport(s),2);assert.equal(u.dispatch(s),true);assert.equal(r.availableTransport(s),0);assert.equal(u.dispatch(s),false);
  s.civilization.urban.enabled=false;s.game.workers.transporter=0;tick(h,120);assert.equal(s.game.population,44);assert.equal(s.civilization.urban.parties[0].remaining,120);assert.equal(u.reservedTransport(s),2);assert.equal(r.availableTransport(s),0);s.game.workers.transporter=4;tick(h,120);assert.equal(s.game.population,52);assert.equal(u.reservedTransport(s),2);tick(h,120);assert.equal(u.reservedTransport(s),0);
});
test('reserved beds stop annual births and singleton arrivals; the legacy arrival entry is always handled after registration',()=>{
  const h=prepare(harness()),{s,u,ctx}=h;s.game.buildings.residential=0;s.game.buildings.hut=4;
  // Natural 44 residents, 48 beds: reserve every remaining bed for four travelers.
  assert.equal(u.dispatch(s),true);assert.equal(u.reservedBeds(s),4);assert.equal(u.availableBeds(s),0);
  const before=s.game.population,source=u.count(s.civilization.urban.source);assert.equal(u.handleArrival(s),true);assert.equal(s.game.population,before);assert.equal(u.count(s.civilization.urban.source),source);
  ctx.CivilSociety.annual(s,()=>1);assert.equal(s.game.population,before);assert.equal(u.availableBeds(s),0);
  const fresh=harness();assert.equal(fresh.u.handleArrival(fresh.s),false);
});
test('paused batch plans retain a paid low-speed family-list arrival without inventing adult cohorts',()=>{
  const h=prepare(harness()),{s,u}=h,x=s.civilization.urban;x.enabled=false;
  // Put the existing child cohort first without adding a source resident.
  x.source.unshift(x.source.splice(2,1)[0]);s.stores.tools=0;s.stores.medicine=0;s.stores.food=6;
  const before=s.game.population;assert.equal(u.handleArrival(s),true);assert.equal(s.stores.food,0);assert.equal(s.game.population,before+1);assert.equal(s.civilization.society.cohorts.at(-1).age,5);assert.equal(x.admitted,1);assert.equal(u.count(x.source),479);
  assert.equal(u.handleArrival(s),true);assert.equal(s.game.population,before+1);
});
test('a batch cannot spend its post-arrival reserve or bypass medical and education supply',()=>{
  const h=prepare(harness()),{s,u}=h,x=s.civilization.urban;
  s.stores.food=48;assert.equal(u.dispatch(s),false);assert.equal(s.stores.food,48);assert.match(x.status,/120/);
  s.stores.food=1000;s.game.workers.medic=3;assert.equal(u.dispatch(s),false);assert.match(x.status,/药品|医护/);
  s.game.workers.medic=8;s.game.workers.teacher=0;assert.equal(u.dispatch(s),false);assert.equal(u.count(x.source),480);
  s.game.workers.teacher=4;assert.equal(u.dispatch(s),true);
});
test('housing loss holds passengers with prepaid provisions, then returns the same residents without refund or duplication',()=>{
  const h=prepare(harness()),{s,u}=h,x=s.civilization.urban;assert.equal(u.dispatch(s),true);x.enabled=false;
  const paid={...s.stores};s.game.buildings.residential=0;tick(h,120);assert.equal(x.parties[0].state,'held');assert.equal(s.game.population,44);assert.equal(u.reservedBeds(s),8);
  tick(h,120);assert.equal(x.parties[0].state,'returning_people');assert.equal(u.reservedBeds(s),0);tick(h,120);
  assert.equal(u.count(x.source),480);assert.equal(s.game.population,44);assert.equal(x.parties.length,0);assert.equal(JSON.stringify(s.stores),JSON.stringify(paid));assert.doesNotThrow(()=>u.validate(s));
});
test('mid-journey serialization resumes once; corrupt source ledgers and stale/future state are rejected',()=>{
  const h=prepare(harness()),{s,u}=h;u.dispatch(s);s.civilization.urban.enabled=false;tick(h,50);
  const loaded=JSON.parse(JSON.stringify(s)),before=JSON.stringify(loaded);u.init(loaded);assert.equal(JSON.stringify(loaded),before);assert.doesNotThrow(()=>u.validate(loaded));
  const clone={...h,s:loaded};tick(clone,190);assert.equal(loaded.game.population,52);assert.equal(loaded.civilization.urban.parties.length,0);assert.doesNotThrow(()=>u.validate(loaded));
  for(const mutate of [x=>x.source[0].count++,x=>x.year++,x=>x.parties.push(null),x=>x.economy={at:-1},x=>x.nextParty=0]){const bad=structuredClone(s);mutate(bad.civilization.urban);assert.throws(()=>u.validate(bad));}
  for(const value of [null,false,0]){const bad=structuredClone(s);bad.civilization.urban=value;u.init(bad);assert.equal(bad.civilization.urban,value);assert.throws(()=>u.validate(bad));}
});
test('source and in-transit residents age once at the year boundary with recorded deaths and no replacement population',()=>{
  const h=prepare(harness()),{s,u}=h,x=s.civilization.urban;
  x.source[0].age=79;assert.equal(u.dispatch(s),true);x.enabled=false;
  s.civilization.elapsed=(x.year+1)*600-1;tick(h,1);
  assert.equal(x.deceased,4);assert.equal(u.reservedBeds(s),4);assert.equal(u.count(x.source)+x.parties.reduce((n,p)=>n+u.count(p.cohorts),0)+x.admitted+x.deceased,480);
  const saved=JSON.parse(JSON.stringify(s));u.init(saved);u.tick(saved);assert.equal(saved.civilization.urban.deceased,4);assert.doesNotThrow(()=>u.validate(saved));
});
test('forecast consumes real inputs and contracts only on a clone, including the proposed nonworking dependents',()=>{
  const h=prepare(harness()),{s,u}=h,before=JSON.stringify(s),result=u.forecast(s,[{age:8,count:2,identity:'mutant'},{age:70,count:1,identity:'human'}]);
  assert.equal(JSON.stringify(s),before);assert.equal(result.copy.game.population,47);assert.ok(result.deltas.medicine<.76);assert.equal(h.ctx.CivilSociety.workforce(result.copy),h.ctx.CivilSociety.workforce(s));
  assert.ok(u.commitments(s).medicine<0);assert.ok(u.commitments(s).food<0);
});
function citySetup(h,population){
  prepare(h);const {s}=h;s.civilization.urban.enabled=false;
  s.game.population=population;s.civilization.society.cohorts=[{age:30,count:population-20},{age:8,count:20}];
  Object.assign(s.game.buildings,{hut:4,longhouse:4,residential:8,blockhousing:4,publicclinic:8,publicschool:4,irrigatedfield:6,toolworks:2,farm:4,mine:2,coalpit:2,furnace:2,machineworks:2,powerhouse:2});
  s.game.workers={farmer:32,medic:32,teacher:6,smith:8,salvager:14,miner:4,collier:4,smelter:4,machinist:4,electrician:4,transporter:6};
  s.civilization.tech.urbanworks=true;s.civilization.regions.nodes.river.completedProjects.publicWorks=true;return h;
}
test('town status requires 80 local residents and 180 seconds of actual service; no population reward is issued',()=>{
  const h=citySetup(harness(),80),{s,u}=h;s.game.workers={farmer:12,medic:8,teacher:3,smith:2,salvager:8,miner:2,collier:2,smelter:2,machinist:2,electrician:2,transporter:6};
  for(let i=0;i<17;i++){s.civilization.elapsed+=10;settle(h);}assert.equal(u.nextEvent(s),null);s.civilization.elapsed+=10;settle(h);assert.equal(u.nextEvent(s),'urban_charter');
  const before={...s.stores};u.event('urban_charter',(msg,fn)=>()=>fn()).buttons.charter.onChoose();assert.equal(s.civilization.urban.chartered,true);assert.equal(s.game.population,80);assert.deepEqual(s.stores,before);
  s.game.population=79;s.civilization.society.cohorts[0].count--;s.civilization.elapsed+=10;settle(h);assert.equal(s.civilization.urban.townStable,0);assert.equal(s.civilization.urban.chartered,true);
});
test('the first city needs 400 local people, productive power, fulfilled services and 300 actual seconds; lost conditions can recover',()=>{
  const h=citySetup(harness(),399),{s,u}=h;s.civilization.urban.chartered=true;
  for(let i=0;i<30;i++){s.civilization.elapsed+=10;settle(h);}assert.equal(s.civilization.urban.cityStable,0);
  s.game.population++;s.civilization.society.cohorts[0].count++;
  for(let i=0;i<29;i++){s.civilization.elapsed+=10;settle(h);}assert.equal(u.nextEvent(s),null);s.civilization.elapsed+=10;settle(h);assert.equal(u.nextEvent(s),'urban_city');
  const event=u.event('urban_city',(msg,fn)=>()=>{h.messages.push(msg);fn();});s.stores.tools=0;event.buttons.city.onChoose();assert.equal(s.civilization.urban.city,false);assert.match(h.messages.at(-1),/已有变化/);
  s.civilization.elapsed+=10;settle(h);assert.equal(s.civilization.urban.cityStable,0);
  s.stores.tools=1000;for(let i=0;i<30;i++){s.civilization.elapsed+=10;settle(h);}assert.equal(u.nextEvent(s),'urban_city');u.event('urban_city',(msg,fn)=>()=>fn()).buttons.city.onChoose();assert.equal(s.civilization.urban.city,true);assert.equal(u.nextEvent(s),null);
  s.game.workers.electrician=0;s.civilization.elapsed+=10;settle(h);assert.equal(s.civilization.urban.cityStable,0);assert.equal(s.civilization.urban.city,true);assert.equal(s.civilization.regions.cityCluster,undefined);
});
test('paid treatment is recognized even when it leaves no second treatment reserve',()=>{
  const h=citySetup(harness(),80),{s,u}=h;s.game.workers.medic=6;s.game.workers.teacher=2;s.stores.medicine=0;
  const result=settle(h);assert.ok(s.stores.medicine<.8);assert.equal(result.flow['诊所治疗'].medicine,-.8);assert.equal(s.civilization.urban.economy.treatment,true);
});

function contactSource(h){
 const {s,ctx,u}=h,o=ctx.CivilOrigins;u.init(s);o.init(s);s.civilization.urban.enabled=false;
 assert.equal(o.beginContact(s),true);
 for(let i=0;i<240;i++){s.civilization.elapsed++;if(i%10===9)o.settle(s);o.tick(s);u.tick(s);}
 assert.equal(s.civilization.origins.nodes.river_network.status,'contacted');return o;
}
function sourceTicks(h,seconds){for(let i=0;i<seconds;i++){h.s.civilization.elapsed++;if(i%10===9)h.ctx.CivilOrigins.settle(h.s);h.ctx.CivilOrigins.tick(h.s);h.u.tick(h.s);}}
test('an exhausted old register and zero home workers can receive a real source adult with six gathered food',()=>{
 const h=prepare(harness()),{s,ctx,u}=h,x=s.civilization.urban;
 x.source=[];x.admitted=480;s.game.population=0;s.game.workers={};s.civilization.society.cohorts=[];s.civilization.trust=0;s.stores={food:6};
 const before=JSON.stringify(s.stores),o=contactSource(h),n=s.civilization.origins.nodes.river_network;
 assert.equal(JSON.stringify(s.stores),before);assert.equal(s.game.population,0);assert.equal(n.permit.paid,false);
 x.activeSource='river_network';assert.equal(u.handleArrival(s),true);
 assert.equal(s.game.population,1);assert.equal(ctx.CivilSociety.workforce(s),1);assert.equal(s.stores.food,0);
 assert.equal(x.admitted,480);assert.equal(u.count(x.source),0);assert.equal(n.admitted,1);assert.equal(s.civilization.society.cohorts[0].originId,'river_network');
 const once=JSON.stringify([n,s.game,s.stores]);o.init(s);u.handleArrival(s);assert.equal(JSON.stringify([n,s.game,s.stores]),once);
 assert.doesNotThrow(()=>u.validate(s));assert.doesNotThrow(()=>o.validate(s));
});
test('legacy and new-source passengers share two crews while each population ledger stays separate',()=>{
 const h=prepare(harness()),{s,ctx,u,r}=h,o=contactSource(h),x=s.civilization.urban,n=s.civilization.origins.nodes.river_network;
 assert.equal(o.agree(s),true);x.enabled=true;const before=s.game.population,stores={...s.stores};
 x.activeSource='dispersed';assert.equal(u.dispatch(s),true);x.activeSource='river_network';assert.equal(u.dispatch(s),true);
 assert.equal(x.parties.length,2);assert.equal(u.reservedTransport(s),4);assert.equal(r.availableTransport(s),0);assert.equal(u.dispatch(s),false);
 assert.equal(stores.food-s.stores.food,96);assert.ok(Math.abs(stores.medicine-s.stores.medicine-3.2)<1e-7);assert.equal(u.count(x.source),472);
 assert.equal(o.inTransit(n),8);assert.equal(n.admitted,0);x.enabled=false;sourceTicks(h,120);
 assert.equal(s.game.population,before+16);assert.equal(x.admitted,8);assert.equal(n.admitted,8);assert.equal(o.inTransit(n),0);
 assert.equal(u.count(x.source)+x.admitted+x.deceased,480);assert.equal(n.baselinePopulation+n.born,n.population+n.sourceDeaths+n.transitDeaths+n.admitted);
 assert.doesNotThrow(()=>u.validate(s));assert.doesNotThrow(()=>o.validate(s));
 const resumed=JSON.parse(JSON.stringify(s));o.init(resumed);u.init(resumed);const pop=resumed.game.population;
 for(let i=0;i<120;i++){resumed.civilization.elapsed++;o.tick(resumed);u.tick(resumed);}assert.equal(resumed.game.population,pop);assert.equal(resumed.civilization.urban.parties.length,0);
});
test('new-source passengers denied housing return to their own ageing census without refunding fares',()=>{
 const h=prepare(harness()),{s,u}=h,o=contactSource(h),x=s.civilization.urban,n=s.civilization.origins.nodes.river_network;
 o.agree(s);x.activeSource='river_network';x.enabled=true;assert.equal(u.dispatch(s),true);x.enabled=false;
 const paid=s.stores.food,legacy=JSON.stringify(x.source);s.game.buildings.residential=0;
 sourceTicks(h,120);assert.equal(x.parties[0].state,'held');sourceTicks(h,120);assert.equal(x.parties[0].state,'returning_people');sourceTicks(h,120);
 assert.equal(x.parties.length,0);assert.equal(n.admitted,0);assert.equal(o.inTransit(n),0);assert.equal(o.remaining(s,'river_network'),1080);assert.equal(s.stores.food,paid);
 assert.equal(u.count(x.source),480);assert.notEqual(JSON.stringify(x.source),legacy,'legacy census also ages, without receiving returned origin people');
 assert.equal(n.baselinePopulation+n.born,n.population+n.sourceDeaths+n.transitDeaths);assert.doesNotThrow(()=>o.validate(s));
});
test('a real older source passenger dies once at the year boundary and the surviving party can still arrive',()=>{
 const h=prepare(harness()),{s,u}=h,o=contactSource(h),x=s.civilization.urban,n=s.civilization.origins.nodes.river_network;
 o.agree(s);n.cohorts.sort((a,b)=>(b.age===79)-(a.age===79));s.civilization.elapsed=Math.floor(s.civilization.elapsed/600)*600+599;
 x.activeSource='river_network';x.enabled=true;assert.equal(u.dispatch(s),true);x.enabled=false;const before=s.game.population;
 assert.equal(x.parties[0].cohorts.filter(c=>c.age===79).reduce((a,c)=>a+c.count,0),1);
 sourceTicks(h,120);assert.equal(s.game.population,before+7);assert.equal(x.parties[0].state,'returning');assert.equal(n.transitDeaths,1);assert.equal(n.admitted,7);assert.equal(x.deceased,0);
 assert.equal(n.baselinePopulation+n.born,n.population+n.sourceDeaths+n.transitDeaths+n.admitted);assert.doesNotThrow(()=>o.validate(s));
});

test('contact before the old family register keeps the new source separate and remains a valid save shape',()=>{
 const h=harness(),{s,u}=h;s.game.buildings.hut=4;const o=contactSource(h),x=s.civilization.urban;
 assert.equal(x.registered,false);assert.equal(u.sourceId(s),'dispersed');x.activeSource='river_network';const before=s.game.population;
 assert.equal(u.handleArrival(s),true);assert.equal(s.game.population,before+1);assert.equal(x.admitted,0);assert.equal(u.count(x.source),0);
 assert.doesNotThrow(()=>u.validate(s));assert.doesNotThrow(()=>o.validate(s));
});

function municipalTarget(h=prepare(harness()),id='rail'){
  const {s,u,r,ctx}=h,m=ctx.CivilMunicipal,n=s.civilization.regions.nodes[id]||r.createNode(s,id);
  s.civilization.urban.city=true;s.civilization.urban.chartered=true;s.civilization.tech.urbanworks=true;
  n.completedProjects.publicWorks=true;n.relation='associated';n.control='shared';n.rights='equal';r.planWorkers(s,id,n);
  assert.equal(m.activate(s,id),true);
  // Economic destination fixture: paid municipal construction is covered in municipal.test.cjs.
  Object.assign(m.data(s,id).buildings,{farmland:2,clinic:2,school:1,toolworks:1,salvageyard:2,woodlot:1,residential:2});
  for(const key of ctx.CivilCatalog.resources)n.stores[key]=1000;
  n.health=100;m.planWorkers(s,id);assert.equal(u.setTarget(s,id),true);
  return {...h,m,n,id,local:m.data(s,id),route:s.civilization.regions.routes[id]};
}
function municipalTicks(h,seconds){
  for(let i=0;i<seconds;i++){
    h.s.civilization.elapsed++;
    for(const n of Object.values(h.s.civilization.regions.nodes))h.r.annual(h.s,n);
    if(h.s.civilization.origins)h.ctx.CivilOrigins.tick(h.s);
    if(i%10===9)h.u.settle(h.s);
    h.u.tick(h.s);
  }
}
test('508-person natural saves preserve home as the default target without a migration grant or rewritten party',()=>{
  const {u}=harness(),s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-origin-migration.json'),'utf8')).state;
  const before=JSON.stringify(s);assert.equal(s.game.population,508);assert.equal(s.civilization.urban.activeTarget,undefined);
  assert.doesNotThrow(()=>u.validate(s));u.init(s);assert.equal(u.targetId(s),'home');assert.equal(JSON.stringify(s),before);
  assert.equal(u.reservedBeds(s),u.reservedBeds(s,'home'));
});
test('choosing a consented destination isolates reserved beds, fixes existing party targets and keeps singleton arrivals at home',()=>{
  const h=municipalTarget(),{s,u,m,n,id}=h,x=s.civilization.urban;
  assert.deepEqual(Array.from(u.targetIds(s)),['home','rail']);assert.equal(u.setTarget(s,'highland'),false);
  const local=n.population,home=s.game.population,homeBeds=u.availableBeds(s),localBeds=u.availableBeds(s,id),localStores=JSON.stringify(n.stores),homeFood=s.stores.food;
  assert.equal(u.dispatch(s),true);assert.equal(s.stores.food,homeFood-48);assert.equal(JSON.stringify(n.stores),localStores);
  assert.equal(u.reservedBeds(s),0);assert.equal(u.reservedBeds(s,id),8);assert.equal(u.availableBeds(s),homeBeds);assert.equal(u.availableBeds(s,id),localBeds-8);
  assert.equal(u.waiting(s).length,0);assert.equal(u.count(u.waiting(s,id)),8);
  assert.equal(u.handleArrival(s),true);assert.equal(s.game.population,home+1);assert.equal(n.population,local,'singleton ignores the selected remote target');
  assert.equal(u.setTarget(s,'home'),true);assert.equal(x.parties[0].target,id);assert.equal(u.dispatch(s),true);assert.equal(x.parties.length,2);assert.equal(u.reservedBeds(s),8);assert.equal(u.dispatch(s),false);
  x.enabled=false;municipalTicks(h,120);assert.equal(n.population,local+8);assert.equal(s.game.population,home+9);assert.equal(x.admitted,17);
  assert.equal(u.reservedBeds(s,id),0);assert.equal(u.reservedBeds(s),0);assert.equal(u.reservedTransport(s),4);assert.equal(m.data(s,id).city,false);assert.doesNotThrow(()=>u.validate(s));
});
test('remote admission requires its own food and working services while home retains its own post-fare reserve',()=>{
  for(const shortage of ['localFood','homeFood','medicine','teaching','foodProduction']){
    const h=municipalTarget(),{s,u,n,local}=h;
    if(shortage==='localFood'){n.stores.food=0;s.stores.food=1e6;}
    if(shortage==='homeFood')s.stores.food=48+u.foodReserve(s)-1;
    if(shortage==='medicine'||shortage==='foodProduction'){
      n.cohorts=[{age:25,count:120,identity:'human'}];n.population=120;local.buildings.residential=4;
      if(shortage==='medicine')local.buildings.clinic=1;else {local.buildings.clinic=4;local.buildings.farmland=1;}
    }
    if(shortage==='teaching'){n.cohorts=[{age:8,count:70,identity:'human'},{age:25,count:10,identity:'human'}];n.population=80;local.buildings.residential=4;}
    const before=JSON.stringify([s.stores,n.stores,s.civilization.urban.source,s.civilization.urban.nextParty]);
    assert.equal(u.dispatch(s),false,shortage);assert.equal(JSON.stringify([s.stores,n.stores,s.civilization.urban.source,s.civilization.urban.nextParty]),before);assert.equal(s.civilization.urban.parties.length,0);
  }
});
test('local road closure blocks payment, river maintenance matters, and pausing trade alone does not block a separate passenger crew',()=>{
  const h=municipalTarget(),{s,u,route}=h;route.enabled=false;route.assigned=0;route.condition='closed';const before=JSON.stringify([s.stores,s.civilization.urban.source]);
  assert.equal(u.dispatch(s),false);assert.equal(JSON.stringify([s.stores,s.civilization.urban.source]),before);
  route.condition='open';s.civilization.outpostSupplied=false;assert.equal(u.dispatch(s),true,'the rail destination does not borrow the home pump');
  const river=municipalTarget(prepare(harness()),'river');river.s.civilization.outpostSupplied=false;assert.equal(river.u.dispatch(river.s),false);
  river.s.civilization.outpostSupplied=true;river.s.game.buildings.road=0;assert.equal(river.u.dispatch(river.s),false);
});
test('a blocked outbound party consumes prepaid provisions, saves its position, and retreats only over its travelled section',()=>{
  const h=municipalTarget(),{s,u,n,route}=h,x=s.civilization.urban,local=n.population,home=s.game.population;
  assert.equal(u.dispatch(s),true);x.enabled=false;municipalTicks(h,30);route.condition='closed';const p=x.parties[0];assert.equal(p.remaining,90);
  const rations=p.rations;municipalTicks(h,20);assert.equal(p.state,'held');assert.equal(p.holdReason,'road');assert.equal(p.remaining,90);assert.ok(p.rations<rations);assert.equal(n.population,local);assert.equal(s.game.population,home);
  const saved=JSON.parse(JSON.stringify(s));assert.doesNotThrow(()=>u.validate(saved));assert.equal(u.returnParty(saved,p.id),true);
  const back=saved.civilization.urban.parties[0];assert.equal(back.remaining,30);assert.equal(back.returnNeedsRoad,false);assert.equal(u.reservedBeds(saved,'rail'),0);
  const restored={...h,s:saved};municipalTicks(restored,29);assert.equal(saved.civilization.urban.parties.length,1);municipalTicks(restored,1);
  assert.equal(saved.civilization.urban.parties.length,0);assert.equal(u.count(saved.civilization.urban.source),480);assert.equal(saved.civilization.regions.nodes.rail.population,local);assert.equal(saved.game.population,home);assert.equal(saved.stores.food,s.stores.food);
});
test('an empty crew and a passenger return started at the destination cannot cross a road that closes behind them',()=>{
  const h=municipalTarget(),{s,u,n,route}=h,x=s.civilization.urban;assert.equal(u.dispatch(s),true);x.enabled=false;municipalTicks(h,120);
  const admitted=n.population;n.stores.medicine=0;route.condition='closed';municipalTicks(h,150);assert.equal(x.parties[0].state,'returning');assert.equal(x.parties[0].remaining,120);assert.equal(u.reservedTransport(s),2);assert.equal(n.population,admitted);
  route.condition='open';municipalTicks(h,120);assert.equal(x.parties.length,0);assert.equal(n.population,admitted);
  const held=municipalTarget(),y=held.s.civilization.urban;assert.equal(held.u.dispatch(held.s),true);y.enabled=false;held.n.stores.food=0;municipalTicks(held,120);
  assert.equal(y.parties[0].state,'held');assert.equal(y.parties[0].holdReason,'services');assert.equal(y.parties[0].remaining,0);
  held.route.condition='closed';assert.equal(held.u.returnParty(held.s,y.parties[0].id),true);assert.equal(y.parties[0].returnNeedsRoad,true);municipalTicks(held,150);assert.equal(y.parties[0].remaining,120);assert.equal(held.n.population,32);
  held.route.condition='open';municipalTicks(held,120);assert.equal(y.parties.length,0);assert.equal(held.u.count(y.source),480);assert.equal(y.admitted,0);
});
test('year-boundary delivery ages a traveller only once, while a local death releases only that destinations bed',()=>{
  const h=municipalTarget(),{s,u,r,n,id}=h,x=s.civilization.urban;
  x.source[0].age=17;n.cohorts[0].age=79;n.stores.medicine=0;s.civilization.elapsed=(x.year+1)*600-120;
  const local=n.population;assert.equal(u.dispatch(s),true);x.enabled=false;const beds=u.availableBeds(s,id);
  municipalTicks(h,120);assert.equal(n.population,local-1+8);assert.equal(n.cohorts.find(c=>c.age===18 && c.count===4)?.identity,'human');assert.equal(u.availableBeds(s,id),beds+1);
  const before=JSON.stringify(n.cohorts);r.annual(s,n);u.tick(s);assert.equal(JSON.stringify(n.cohorts),before);assert.doesNotThrow(()=>u.validate(s));
});
test('new-source remote arrivals close their own ledger once and preserve the chosen destination through reload',()=>{
  const h=municipalTarget(),{s,u,n,id}=h,o=contactSource(h),x=s.civilization.urban,source=s.civilization.origins.nodes.river_network;
  assert.equal(o.agree(s),true);x.activeSource='river_network';x.enabled=true;const oldLegacy=x.admitted,local=n.population,home=s.game.population;
  assert.equal(u.dispatch(s),true);x.enabled=false;n.stores.medicine=0;assert.equal(source.departures['p'+x.parties[0].id].target,id);
  municipalTicks(h,60);const loaded=JSON.parse(JSON.stringify(s)),resumed={...h,s:loaded};assert.doesNotThrow(()=>u.validate(loaded));assert.doesNotThrow(()=>o.validate(loaded));
  municipalTicks(resumed,180);const next=loaded.civilization.origins.nodes.river_network;
  assert.equal(loaded.civilization.regions.nodes[id].population,local+8);assert.equal(loaded.game.population,home);assert.equal(next.admitted,8);assert.equal(loaded.civilization.urban.admitted,oldLegacy);assert.equal(loaded.civilization.urban.parties.length,0);
  assert.equal(next.baselinePopulation+next.born,next.population+next.sourceDeaths+next.transitDeaths+next.admitted);assert.doesNotThrow(()=>o.validate(loaded));
});
test('source passengers dying in transit are recorded at their source, never as residents of the selected destination',()=>{
  const h=municipalTarget(),{s,u,n}=h,o=contactSource(h),x=s.civilization.urban,source=s.civilization.origins.nodes.river_network;
  o.agree(s);source.cohorts.sort((a,b)=>(b.age===79)-(a.age===79));s.civilization.elapsed=Math.floor(s.civilization.elapsed/600)*600+599;
  x.activeSource='river_network';x.enabled=true;n.stores.medicine=0;assert.equal(u.dispatch(s),true);x.enabled=false;const local=n.population;
  municipalTicks(h,120);assert.equal(n.population,local+7);assert.equal(source.transitDeaths,1);assert.equal(source.admitted,7);assert.equal(x.deceased,0);assert.equal(x.admitted,0);assert.doesNotThrow(()=>o.validate(s));
});
test('a destinations population and in-transit families cannot satisfy the home first-city threshold',()=>{
  const h=municipalTarget(citySetup(harness(),399)),{s,u,n}=h;s.civilization.urban.chartered=true;s.civilization.urban.enabled=true;
  assert.equal(u.dispatch(s),true);s.civilization.urban.enabled=false;municipalTicks(h,120);settle(h);
  assert.equal(s.game.population,399);assert.ok(n.population+s.game.population>=400);assert.equal(u.developmentReady(s,true),false);assert.equal(s.civilization.urban.cityStable,0);
  assert.equal(h.m.developmentReady(s,h.id,true),false,'a small remote settlement is not a city because home owns industry');
});
test('invalid targets and forged return positions are rejected, while temporary service loss does not corrupt a real travelling save',()=>{
  const h=municipalTarget(),{s,u,n}=h;assert.equal(u.dispatch(s),true);s.civilization.urban.enabled=false;
  n.relation='trade';assert.doesNotThrow(()=>u.validate(s));n.relation='associated';
  for(const mutate of [x=>x.activeTarget='unknown',x=>x.parties[0].target='highland',x=>{x.parties[0].state='held';x.parties[0].holdReason='housing';},x=>{x.parties[0].state='returning_people';x.parties[0].returnNeedsRoad=false;x.parties[0].remaining=120;}]){
    const bad=JSON.parse(JSON.stringify(s));mutate(bad.civilization.urban);assert.throws(()=>u.validate(bad));
  }
});
