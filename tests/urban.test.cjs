const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8')).state,messages=[];
  const ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:t=>messages.push(t)}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  ctx.CivilSociety.init(s);ctx.CivilRegions.init(s);ctx.CivilUrban.init(s);return {s,ctx,u:ctx.CivilUrban,r:ctx.CivilRegions,messages};
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
  s.civilization.urban.enabled=false;s.game.workers.transporter=0;tick(h,120);assert.equal(s.game.population,52);assert.equal(u.reservedTransport(s),2);assert.equal(r.availableTransport(s),0);tick(h,120);assert.equal(u.reservedTransport(s),0);
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
