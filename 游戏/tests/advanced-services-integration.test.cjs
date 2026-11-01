const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const clone=x=>JSON.parse(JSON.stringify(x));
const near=(actual,expected,label='quantity')=>assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} != ${expected}`);

// Full, shipped content/runtime, in the entry point's order. Only native presentation
// objects are inert: no production, service, population, construction or power stub.
const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)]
  .map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
function harness(saved){
  const s=saved?clone(saved):JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-city.json'),'utf8')).state;
  const messages=[],ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    Room:{buttons:{}},Outside:{},Events:{},$SM:{},AudioEngine:{},Engine:{saveGame(){}},Notifications:{printMessage:x=>messages.push(x)}});
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.Civilization.initState();
  return {s,ctx,m:ctx.CivilMunicipal,r:ctx.CivilRegions,v:ctx.CivilServices,a:ctx.CivilAdvanced,i:ctx.CivilIndustry,id:'river',messages};
}
function census(h,population){
  const n=h.s.civilization.regions.nodes[h.id];
  n.cohorts=[];for(let age=0;age<80;age++){
    const count=Math.floor((age+1)*population/80)-Math.floor(age*population/80);
    if(count)n.cohorts.push({age,count,identity:age%4===0?'mutant':'human'});
  }
  n.population=population;n.year=Math.floor(h.s.civilization.elapsed/600);h.m.planWorkers(h.s,h.id);return n;
}
function local(h){return h.s.civilization.regions.nodes[h.id];}
function settle(h){h.s.civilization.elapsed+=10;h.s.civilization.productionClock=0;h.m.settleNode(h.s,h.id);}

// This is a paid construction fixture, not a natural playthrough. Parcel travel
// is fast-forwarded at the arrival boundary; all cargo is debited, receipted by
// Regions and consumed by the owning project, and two real adults do every second
// of construction. Demographics are introduced explicitly after setup.
function finish(h,type,service=false){
  const {s,id,r,m,v,ctx}=h,owner=service?v:m,definition=(service?ctx.CivilServiceContent:ctx.CivilMunicipalContent).facilities[type];
  const before={...s.stores},cost=definition.cost;
  assert.equal(owner.startProject(s,id,type),true,`start paid ${type}`);
  let q;while((q=owner.nextCargo(s,id,64))){
    assert.ok(Object.values(q.cargo).reduce((a,b)=>a+b,0)<=64);
    assert.equal(ctx.CivilRules.pay(s,q.cargo),true);
    const p={id:s.civilization.regions.nextShipment++,route:id,source:'home',target:id,purpose:service?'services':'municipal',
      [service?'serviceProjectId':'projectId']:q.projectId,cargo:q.cargo,capacity:64,phase:'outbound',status:'moving',remaining:0};
    s.civilization.regions.shipments.push(p);
    assert.equal(r.arrive(s,p),true);assert.equal(p.phase,'empty');assert.equal(Object.keys(p.cargo).length,0);
    p.remaining=0;assert.equal(r.arrive(s,p),true);
  }
  for(const [key,quantity]of Object.entries(cost))near(before[key]-s.stores[key],quantity,`${type} paid ${key}`);
  const project=owner.data(s,id).project;assert.equal(project.status,'building');
  for(let t=0;t<definition.duration;t++){
    s.civilization.elapsed++;
    // Dense housing's actual operating water prerequisite must remain paid.
    if(service&&type==='densehousing'&&s.civilization.elapsed%10===0)m.settleNode(s,id);
    m.tick(s);v.tick(s);
  }
  assert.equal(project.status,'complete',`two adults finished ${type}`);
  assert.ok(Object.values(project.buffer).every(n=>n===0));
  return project;
}
let localSnapshot;
function paidLocal(){
  if(localSnapshot)return harness(localSnapshot);
  const h=harness(),{s,ctx,m,r,v,id}=h,c=s.civilization;
  // Synthetic prerequisites and finite construction budget, never natural-play evidence.
  Object.assign(c.tech,{chemistry:true,steel:true,medicine:true,municipal_engineering:true,urbanworks:true});
  c.regions.shipments=[];c.regions.nodes={};c.regions.routes={};c.regions.projects={};c.regions.active=true;c.regions.rights='equal';c.regions.adminService=true;
  c.municipal={schema:1,nodes:{}};c.services={schema:1,nodes:{}};c.urban.parties=[];
  for(const key of ctx.CivilCatalog.resources)s.stores[key]=100000;
  const n=r.createNode(s,id),route=c.regions.routes[id];n.completedProjects.publicWorks=true;n.relation='associated';n.control='shared';n.rights='equal';n.rightsSince=c.elapsed;
  n.health=100;r.planWorkers(s,id,n);assert.equal(m.activate(s,id),true);
  route.enabled=false;route.assigned=0;
  for(const key of ctx.CivilCatalog.resources)n.stores[key]=10000;
  census(h,20);for(const type of ['farmland','clinic','school','toolworks','salvageyard','woodlot'])finish(h,type);
  for(let j=0;j<8;j++)finish(h,'residential');census(h,200);m.data(s,id).town=true;
  for(let j=0;j<4;j++)finish(h,'blockhousing');census(h,400);
  // All local base and advanced facilities, including prerequisites, are paid.
  for(const type of ['farmland','clinic','school','toolworks','salvageyard','woodlot','mine','coalpit','furnace','machineworks','powerhouse','scrubber','mineralquarry'])
    while((m.data(s,id).buildings[type]||0)<ctx.CivilMunicipalContent.facilities[type].max)finish(h,type);
  settle(h);assert.equal(c.advanced.made.minerals,true);
  finish(h,'chemicalworks');settle(h);assert.equal(c.advanced.made.chemicals,true);
  for(const type of ['chemicalworks','steelworks','glassworks','utilitypower','mineexpansion','coalexpansion','filterplant'])
    while((m.data(s,id).buildings[type]||0)<ctx.CivilMunicipalContent.facilities[type].max)finish(h,type);
  for(const type of ['pharmacy','waterworks','waterfield','irrigationworks'])
    while((v.data(s,id)?.buildings[type]||0)<ctx.CivilServiceContent.facilities[type].max)finish(h,type,true);
  for(let j=0;j<2;j++)finish(h,'districtschool',true);
  settle(h);for(let j=0;j<6;j++)finish(h,'densehousing',true);
  census(h,1000);n.health=100;m.data(s,id).pollution=0;
  // Discard setup production and install one declared finite starting inventory.
  for(const key of ctx.CivilCatalog.resources)n.stores[key]=500;
  n.stores.food=2000;v.data(s,id).economy=null;v.data(s,id).water=null;v.data(s,id).irrigation=null;
  assert.equal(m.capacity(s,id),1560);
  assert.doesNotThrow(()=>m.validate(s));assert.doesNotThrow(()=>v.validate(s));
  localSnapshot=clone(s);return h;
}

test('real Municipal/Services/Advanced settlement owns one warehouse and applies a non-unit factor once',()=>{
  const h=paidLocal(),{s,m,v,ctx,id}=h,n=local(h),b=m.data(s,id).buildings,base=m.data(s,id).baseWorkers;
  n.health=29;const before={...n.stores},homeBefore=clone(s.stores);settle(h);
  const w=n.workers,power=m.data(s,id).power,e=v.data(s,id).economy,f=.75;
  const old=job=>Math.min(w[job]||0,base[job]||0),added=job=>(w[job]||0)-old(job);
  near(power.generation,(added('electrician')*4+w.utilityworker*10)*f,'single factored generation');
  assert.ok(power.used<=power.generation);assert.ok(power.used<=power.demand);
  near(n.stores.minerals-before.minerals,w.mineralworker*1.2*f-w.chemist*.4-w.glassworker*.6,'mineral output once and all inputs once');
  const pumpRuns=e.waterCapacity/600;
  let remaining=power.generation-e.used-(b.scrubber?1:0);
  const filters=Math.min(b.filterplant,Math.floor((remaining+1e-8)/2));remaining-=filters*2;
  const chemPowered=Math.min(w.chemist,Math.floor((remaining+1e-8)/2));remaining-=chemPowered*2;
  const steelPowered=Math.min(w.steelworker,Math.floor((remaining+1e-8)/2));remaining-=steelPowered*2;
  const glassPowered=Math.min(w.glassworker,Math.floor(remaining+1e-8));remaining-=glassPowered;
  const machinePowered=Math.min(added('machinist'),Math.floor((remaining+1e-8)/2));
  near(n.stores.chemicals-before.chemicals,(chemPowered*.4+(w.chemist-chemPowered)*.12)*f-pumpRuns*.2-w.pharmacist*.15-filters*.03-w.steelworker*.05,'chemicals shared by public services and industry');
  near(n.stores.steel-before.steel,(steelPowered*.6+(w.steelworker-steelPowered)*.3)*f,'steel once');
  near(n.stores.glass-before.glass,(glassPowered*.5+(w.glassworker-glassPowered)*.2)*f,'glass once');
  near(n.stores.medicine-before.medicine,w.medic*.15*f+w.pharmacist*.4*f-n.population*.01,'paid medicine, one factor and actual treatment');
  near(n.stores.parts-before.parts,(old('machinist')*.3+machinePowered*.5+(added('machinist')-machinePowered)*.3)*f-added('electrician')*.02-w.utilityworker*.03-pumpRuns*.02-(b.scrubber?.01:0)-filters*.02,'one parts upkeep');
  near(n.stores.coal-before.coal,added('collier')*f-old('smelter')*.2-added('smelter')*.6-added('electrician')*.6-w.utilityworker*.9-chemPowered*.2-(w.chemist-chemPowered)*.3-steelPowered*.5-(w.steelworker-steelPowered)*.7-glassPowered*.25-(w.glassworker-glassPowered)*.4,'coal paid once across all industries');
  near(n.stores.iron-before.iron,w.smelter*.6*f-w.machinist*.5-w.steelworker*1.2,'iron shared by steel and machinery');
  near(n.stores.tools-before.tools,w.smith*.25*f-added('farmer')*.01-(added('miner')+added('collier')+w.mineralworker)*.03-(w.smelter+w.machinist+w.chemist+w.steelworker)*.01,'one tool maintenance budget');
  near(power.used,e.used+(b.scrubber?1:0)+filters*2+chemPowered*2+steelPowered*2+glassPowered+machinePowered*2,'one shared power budget');
  assert.deepEqual(s.stores,homeBefore);assert.equal(m.data(s,id).stores,undefined);assert.equal(v.data(s,id).stores,undefined);
  assert.doesNotThrow(()=>m.validate(s));assert.doesNotThrow(()=>v.validate(s));
});

test('mid-tick local forecasts use the next paid water certificate once and never revive an expired one',()=>{
  const h=paidLocal(),{s,m,v,id}=h;settle(h);const issued=s.civilization.elapsed;
  assert.equal(v.data(s,id).water.usableAt,issued+10);
  s.civilization.elapsed+=3;s.civilization.productionClock=3;
  const before=JSON.stringify(s),first=m.forecast(s,id),second=m.forecast(s,id);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(first.deltas,second.deltas);
  assert.equal(first.copy.civilization.elapsed,issued+10);assert.equal(v.farmRate(first.copy,id),2);
  s.civilization.elapsed=issued+10;s.civilization.productionClock=0;m.settleNode(s,id);
  assert.deepEqual(clone(m.data(s,id).economy.deltas),clone(first.deltas));
  s.civilization.elapsed+=11;s.civilization.productionClock=1;
  const stale=m.forecast(s,id);assert.equal(v.farmRate(stale.copy,id),1.4);
  assert.equal(v.data(stale.copy,id).irrigation.waterCapacity,0);
  assert.equal(v.data(s,id).water.consumed,false);
});

test('repeated local workforce planning budgets future paid births without spending or advancing the real birth ledger',()=>{
  const h=paidLocal(),{s,m,id}=h,n=local(h);n.births.credit=.4;n.births.mutantCredit=.7;
  const before=JSON.stringify({cohorts:n.cohorts,population:n.population,births:n.births,stores:n.stores});
  for(let j=0;j<30;j++)m.planWorkers(s,id);
  assert.equal(JSON.stringify({cohorts:n.cohorts,population:n.population,births:n.births,stores:n.stores}),before);
  assert.ok(Object.values(n.workers).reduce((sum,count)=>sum+count,0)<=h.ctx.CivilPopulation.workforce(n.cohorts));
});

function paidHome(){
  const h=harness(),{s,ctx,a,i,v}=h;Object.assign(s.civilization.tech,{chemistry:true,steel:true,medicine:true,municipal_engineering:true});
  for(const key of ctx.CivilCatalog.resources)s.stores[key]=10000;
  s.game.workers={medic:1,teacher:1};
  for(const type of ['mineralquarry','chemicalworks','steelworks','glassworks','utilitypower']){
    assert.equal(a.gate(s,type),true);assert.equal(ctx.CivilRules.pay(s,ctx.CivilAdvancedContent.facilities[type].cost),true);s.game.buildings[type]=1;
    if(type==='mineralquarry')s.game.workers.mineralworker=1;
    if(type==='chemicalworks')s.game.workers.chemist=1;
    s.civilization.elapsed+=10;i.settle(s);
  }
  for(const type of ['pharmacy','waterworks','districtschool']){
    assert.equal(v.startProject(s,'home',type),true);s.game.workers.servicebuilder=2;
    for(let j=0;j<ctx.CivilServiceContent.facilities[type].duration;j++){s.civilization.elapsed++;v.tick(s);}
    assert.equal(v.data(s).project.status,'complete');
  }
  while(s.civilization.society.year<Math.floor(s.civilization.elapsed/600))ctx.CivilSociety.annual(s,()=>1);
  ctx.CivilUrban.tick(s);ctx.CivilOrigins.tick(s);
  for(const n of Object.values(s.civilization.regions.nodes))ctx.CivilRegions.annual(s,n);
  return h;
}

test('the full adapter shares paid home service power and records only actual machine power toward the city gate',()=>{
  const h=paidHome(),{s,ctx,i,v}=h;
  s.civilization.policy='ration';s.civilization.hunger=0;s.civilization.village.health=100;
  Object.assign(s.game.workers,{medic:1,teacher:1,miner:1,collier:1,smelter:1,machinist:2,electrician:0,utilityworker:1,mineralworker:1,chemist:2,steelworker:1,glassworker:1,waterworker:4,pharmacist:8});
  s.civilization.elapsed+=10;const before={...s.stores},result=ctx.Civilization.settleEconomy(s),f=i.factor(s),power=s.civilization.industry;
  assert.notEqual(f,1);near(power.generation,10*f,'single home generator factor');
  near(v.data(s).economy.used,8,'four pump power plus four pharmacist power');
  assert.ok(power.used>=8);assert.equal(power.productionPower,0);assert.equal(s.civilization.urban.economy.productionPower,0);
  assert.equal(s.civilization.urban.economy.industrial,true,'manual mechanics still has actual material output');
  assert.equal(ctx.CivilUrban.developmentReady(s,true),false);
  near(result.flow['药剂师'].medicine,8*.4*f,'pharmacy factor once');
  near(result.flow['化工工'].chemicals,2*.12*f,'remaining-power thermal recipe factor once');
  for(const key of ctx.CivilCatalog.resources){
    const accounted=Object.values(result.flow).reduce((sum,job)=>sum+(job[key]||0),0);
    near((s.stores[key]||0)-(before[key]||0),accounted,`adapter ledger ${key}`);
  }
  assert.doesNotThrow(()=>i.validate(s));assert.doesNotThrow(()=>ctx.CivilUrban.validate(s));assert.doesNotThrow(()=>v.validate(s));
  // A later settlement may earn the evidence only when its machinery actually runs electrically.
  s.game.workers.utilityworker=4;s.civilization.elapsed+=10;ctx.Civilization.settleEconomy(s);
  assert.equal(s.civilization.industry.productionPower,4);assert.equal(s.civilization.urban.economy.productionPower,4);
  assert.doesNotThrow(()=>i.validate(s));assert.doesNotThrow(()=>ctx.CivilUrban.validate(s));
  assert.doesNotThrow(()=>ctx.CivilPlatform.validate(s));
});

test('a paid thousand-resident local city exercises real aging, trade, materials and public services for 100 years',t=>{
  const h=paidLocal(),{s,m,r,v,ctx,id}=h,n=local(h),route=s.civilization.regions.routes[id],startYear=n.year;
  // Local demography is the subject of this synthetic experiment. Home is a fixed
  // external trade endpoint with a finite prepaid inventory and transport staff;
  // this does not claim a whole-world or browser-play century was completed.
  route.enabled=true;route.assigned=2;route.condition='open';s.civilization.outpostSupplied=true;
  let minHealth=n.health,minPopulation=n.population,minLabor=ctx.CivilPopulation.workforce(n.cohorts),births=0,maxChildren=0;
  const shortages={};
  const start=clone(n.stores),stop=s.civilization.elapsed+60000;
  while(s.civilization.elapsed<stop){
    s.civilization.elapsed++;
    if(s.civilization.elapsed%10===0){
      r.settle(s);const e=m.data(s,id).economy;
      assert.ok(e.food>=-1e-8&&e.medicine>=-1e-8,'actual food and medicine production cover recurring demand');
      assert.equal(e.treatment,true);assert.equal(e.industry,true);assert.ok(e.productivePower>=4);
      assert.ok(m.data(s,id).pollution<40);assert.ok(v.data(s,id).economy.waterCapacity>=n.population);
    }
    const year=n.year;r.tick(s);m.tick(s);v.tick(s);
    if(year!==n.year)births+=n.cohorts.filter(c=>c.age===0).reduce((sum,c)=>sum+c.count,0);
    maxChildren=Math.max(maxChildren,ctx.CivilPopulation.children(n.cohorts));
    for(const key of ['food','tools','coal','iron','medicine','chemicals','wood'])if(n.stores[key]<1&&!shortages[key])shortages[key]={year:n.year-startYear,at:s.civilization.elapsed,population:n.population,health:n.health,economy:clone(m.data(s,id).economy),workers:clone(n.workers)};
    minHealth=Math.min(minHealth,n.health);minPopulation=Math.min(minPopulation,n.population);minLabor=Math.min(minLabor,ctx.CivilPopulation.workforce(n.cohorts));
    assert.ok(Object.values(n.stores).every(value=>Number.isFinite(value)&&value>=0));assert.ok(n.population<=m.capacity(s,id));
    assert.ok(n.stores.food+1e-8>=m.foodReserve(s,id),'120-second local food reserve survives annual births');
    assert.ok(m.data(s,id).power.used<=m.data(s,id).power.generation+1e-8);
    assert.equal(m.data(s,id).economy.education,true,`paid schools cover children in year ${n.year-startYear}`);
  }
  t.diagnostic(JSON.stringify({population:n.population,minPopulation,minHealth,minLabor,maxChildren,schoolSeats:m.jobCapacity(s,id).teacher*20,births,years:n.year-startYear,completedTrades:route.completedTrips,start,end:n.stores,pollution:m.data(s,id).pollution,shortages}));
  assert.equal(n.year-startYear,100);assert.ok(minHealth>=60);assert.ok(n.population>=1000);assert.ok(n.stores.food>=m.foodReserve(s,id));
  assert.ok(n.stores.tools>0);assert.ok(n.stores.medicine>0);assert.ok(n.stores.chemicals>0);
  assert.ok(route.completedTrips>400);assert.ok(s.stores.food>0);
  assert.doesNotThrow(()=>m.validate(s));assert.doesNotThrow(()=>v.validate(s));assert.doesNotThrow(()=>r.validate(s));
});
