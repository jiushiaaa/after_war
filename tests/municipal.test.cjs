const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(id='river'){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8')).state,messages=[];
  const ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:x=>messages.push(x)}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/population.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/municipal.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  const r=ctx.CivilRegions,m=ctx.CivilMunicipal;r.init(s);s.civilization.regions.active=true;s.civilization.urban={city:true,chartered:true};
  Object.assign(s.civilization.tech,{logistics:true,administration:true,standards:true,urbanworks:true,survey:true,mining:true,furnace:true,mechanics:true,power:true,water:true});
  s.game.buildings.cartdepot=2;s.game.workers.transporter=6;
  const n=r.createNode(s,id),route=s.civilization.regions.routes[id];n.completedProjects.publicWorks=true;n.relation='associated';n.control='shared';n.rights='equal';r.planWorkers(s,id,n);
  Object.assign(route,{enabled:true,assigned:2,completedTrips:5,lastDeliveredAt:s.civilization.elapsed});
  for(const key of ctx.CivilCatalog.resources)s.stores[key]=100000;
  m.init(s);return {s,ctx,r,m,n,id,route,messages};
}
function activate(h){assert.equal(h.m.activate(h.s,h.id),true);return h;}
function load(h){
  const {s,m,id}=h,next=m.nextCargo(s,id,64);if(!next)return null;
  const r=s.civilization.regions;for(const [key,n]of Object.entries(next.cargo))s.stores[key]-=n;
  const shipment={id:r.nextShipment++,route:id,source:'home',target:id,purpose:'municipal',projectId:next.projectId,cargo:next.cargo,phase:'outbound',status:'moving',remaining:0};r.shipments.push(shipment);return shipment;
}
function unload(h,p){assert.equal(h.m.receiveCargo(h.s,h.id,p.cargo,p.projectId),true);p.cargo={};p.phase='empty';p.source=h.id;p.target='home';p.remaining=h.route.travel;}
function finish(h,type){
  const {s,m,id}=h;assert.equal(m.startProject(s,id,type),true,`start ${type}`);
  let p;while((p=load(h))){unload(h,p);s.civilization.regions.shipments=[];}
  const project=m.data(s,id).project;assert.equal(project.status,'building');
  for(let t=0;t<1000&&project.status!=='complete';t++){s.civilization.elapsed++;m.tick(s);}
  assert.equal(project.status,'complete',`complete ${type}`);return project;
}
function infrastructure(h){for(const type of ['farmland','clinic','school','toolworks','salvageyard','woodlot'])finish(h,type);return h;}
function fill(h,population){const {n}=h;n.cohorts=[{age:30,count:population-10,identity:'human'},{age:10,count:10,identity:'mutant'}];n.population=population;for(const key of h.ctx.CivilCatalog.resources)n.stores[key]=1000;n.health=90;h.m.planWorkers(h.s,h.id);}
function fullTown(population=400){
  const h=activate(harness()),{s,m,id}=h,local=m.data(s,id);fill(h,20);infrastructure(h);
  // This is a capacity/economy fixture; every facility still goes through paid shipments and actual construction.
  for(let i=0;i<7;i++)finish(h,'residential');fill(h,80);local.town=true;
  for(let i=0;i<3;i++)finish(h,'blockhousing');
  for(let i=0;i<7;i++)finish(h,'farmland');for(let i=0;i<7;i++)finish(h,'clinic');for(let i=0;i<2;i++)finish(h,'school');
  finish(h,'toolworks');finish(h,'salvageyard');finish(h,'woodlot');
  for(const key of ['mine','coalpit','furnace','machineworks','powerhouse','scrubber'])finish(h,key);
  fill(h,population);return h;
}
function settle(h){h.s.civilization.elapsed+=10;h.route.lastDeliveredAt=h.s.civilization.elapsed;h.m.settleNode(h.s,h.id);}
test('local engineering needs a first city, public works and consent; initialization never grants a resident or material',()=>{
  const h=harness(),{s,m,n,id}=h,before=JSON.stringify([n.cohorts,n.stores,n.workers]),home={...s.stores};
  s.civilization.urban.city=false;assert.equal(m.activate(s,id),false);s.civilization.urban.city=true;n.relation='trade';assert.equal(m.activate(s,id),false);n.relation='associated';
  assert.equal(m.activate(s,id),true);assert.equal(s.stores.knowledge,home.knowledge-20);assert.equal(JSON.stringify([n.cohorts,n.stores,n.workers]),before);assert.equal(m.capacity(s,id),24);assert.equal(m.data(s,id).baseHousing,24);assert.equal(Object.keys(m.data(s,id).buildings).length,0);
  assert.equal(m.activate(s,id),false);assert.equal(s.stores.knowledge,home.knowledge-20);const saved=JSON.stringify(s);m.init(s);assert.equal(JSON.stringify(s),saved);assert.doesNotThrow(()=>m.validate(s));
  for(const fake of ['home','__proto__','constructor','missing'])assert.equal(m.has(s,fake),false);
});
test('construction ships at most 64 actual material units per trip; quotes neither debit nor invent cargo',()=>{
  const h=activate(harness()),{s,m,id,n}=h;assert.equal(m.startProject(s,id,'residential'),false);assert.equal(m.startProject(s,id,'farmland'),true);
  const before=JSON.stringify(s),q=m.nextCargo(s,id,64);assert.equal(JSON.stringify(s),before);assert.equal(Object.values(q.cargo).reduce((a,b)=>a+b,0),64);
  const p=load(h),q2=m.nextCargo(s,id,64);assert.equal(q2.cargo.wood,56);const stores=JSON.stringify(n.stores);unload(h,p);assert.equal(JSON.stringify(n.stores),stores);assert.equal(m.data(s,id).project.buffer.wood,64);assert.equal(m.data(s,id).buildings.farmland,undefined);
  assert.equal(m.receiveCargo(s,id,q.cargo,q.projectId),false);assert.equal(m.startProject(s,id,'clinic'),false);s.civilization.regions.shipments=[];
  while(true){const next=load(h);if(!next)break;unload(h,next);s.civilization.regions.shipments=[];}
  const project=m.data(s,id).project;assert.equal(project.status,'building');assert.ok(Object.values(project.buffer).every(v=>v===0));assert.equal(m.data(s,id).buildings.farmland,undefined);assert.equal(n.workers.builder,2);assert.doesNotThrow(()=>m.validate(s));
});
test('actual local adults build, and retirement pauses the prepaid project without refund or replacement residents',()=>{
  const h=activate(harness()),{s,m,id,n}=h;m.startProject(s,id,'farmland');let p;while((p=load(h))){unload(h,p);s.civilization.regions.shipments=[];}
  const project=m.data(s,id).project;n.cohorts.forEach(c=>c.age=70);const remaining=project.remaining;m.tick(s);assert.equal(project.remaining,remaining);assert.equal(n.workers.builder,undefined);assert.equal(n.population,12);
  n.cohorts.forEach(c=>c.age=40);for(let i=0;i<remaining;i++){s.civilization.elapsed++;m.tick(s);}assert.equal(m.data(s,id).buildings.farmland,1);assert.equal(project.status,'complete');assert.equal(n.workers.builder,undefined);
  const once=JSON.stringify(m.data(s,id));m.tick(s);assert.equal(JSON.stringify(m.data(s,id)),once);assert.doesNotThrow(()=>m.validate(s));
});
test('empty returns from a completed project remain valid after the next project starts',()=>{
  const h=activate(harness()),{s,m,id}=h;finish(h,'farmland');const old=m.data(s,id).project.id;
  const empty={id:s.civilization.regions.nextShipment++,route:id,source:id,target:'home',purpose:'municipal',projectId:old,cargo:{},phase:'empty',status:'moving',remaining:30};s.civilization.regions.shipments.push(empty);
  assert.equal(m.startProject(s,id,'clinic'),true);assert.equal(m.validShipment(s,empty),true);assert.doesNotThrow(()=>m.validate(s));
  assert.equal(m.validShipment(s,{...empty,projectId:999}),false);assert.equal(m.validShipment(s,{...empty,cargo:{wood:1}}),false);
});
test('housing is paid and gradual, and local population and stores remain solely in Regions',()=>{
  const h=infrastructure(activate(harness())),{s,m,id,n}=h,before=JSON.stringify([n.cohorts,n.stores]),pop=n.population;
  finish(h,'residential');assert.equal(m.capacity(s,id),48);assert.equal(n.population,pop);assert.equal(JSON.stringify([n.cohorts,n.stores]),before);assert.equal(m.data(s,id).cohorts,undefined);assert.equal(m.data(s,id).stores,undefined);
  assert.equal(m.startProject(s,id,'blockhousing'),false);m.data(s,id).town=true;finish(h,'blockhousing');assert.equal(m.capacity(s,id),144);
});
test('local forecast is isolated and service checks include real inputs, education and the conservative trade obligation',()=>{
  const h=infrastructure(activate(harness())),{s,m,id,n}=h;finish(h,'residential');for(const key of h.ctx.CivilCatalog.resources)n.stores[key]=100;
  const sample=[{age:8,count:2,identity:'mutant'},{age:24,count:6,identity:'human'}],before=JSON.stringify(s),f=m.forecast(s,id,sample);assert.equal(JSON.stringify(s),before);assert.equal(f.copy.civilization.regions.nodes[id].population,20);assert.equal(f.copy.game.population,s.game.population);assert.equal(m.serviceCheck(s,id,sample),null);
  n.stores.food=0;assert.match(m.serviceCheck(s,id,sample),/120秒/);assert.equal(m.canAccept(s,id),true);n.stores.food=100;n.stores.scrap=0;n.workers.salvager=0;
  // Removing the actual recycling capacity, not merely its auto-assigned worker count, exposes the medicine input dependency.
  const fixture=structuredClone(s),mf=m.data(fixture,id);mf.baseWorkers.salvager=0;mf.buildings.salvageyard=0;assert.match(m.serviceCheck(fixture,id,sample),/药品/);
  assert.equal(m.admit(s,id,sample),8);assert.equal(n.population,20);assert.equal(n.cohorts.at(-2).age,8);assert.equal(s.game.population,44);
});
test('legacy production is not counted twice and new facilities require their own tools and raw materials',()=>{
  const h=activate(harness('rail')),{s,m,id,n}=h;for(const key of h.ctx.CivilCatalog.resources)n.stores[key]=100;
  const old={...n.stores};m.settleNode(s,id);assert.equal(m.data(s,id).economy.industry,false);assert.equal(m.data(s,id).power.generation,0);assert.ok(n.stores.iron>old.iron);
  n.stores.tools=0;n.stores.coal=0;n.stores.ore=0;n.stores.iron=0;n.stores.parts=0;m.settleNode(s,id);assert.equal(n.stores.iron,0);assert.equal(n.stores.parts,0);assert.equal(m.data(s,id).power.used,0);
});
test('the paid mineral and power chain produces locally, consumes local inputs and resets electrical capacity each settlement',()=>{
  const h=fullTown(),{s,m,id,n}=h,home=JSON.stringify(s.stores);settle(h);const e=m.data(s,id).economy;
  assert.equal(e.industry,true);assert.ok(e.productivePower>=4);assert.ok(m.data(s,id).power.used<=m.data(s,id).power.generation);assert.equal(JSON.stringify(s.stores),home);assert.ok(n.stores.parts>0);
  // With all maintenance tools gone and no recycling feedstock the local generator/production chain cannot mint parts.
  const fixture=structuredClone(s),local=m.data(fixture,id),node=fixture.civilization.regions.nodes[id];local.baseWorkers.salvager=0;local.buildings.salvageyard=0;node.stores.scrap=0;node.stores.coal=0;node.stores.tools=0;node.stores.parts=0;m.settleNode(fixture,id);assert.equal(local.power.generation,0);assert.equal(local.power.used,0);assert.equal(node.stores.parts,0);assert.equal(local.economy.industry,false);
});
test('80 residents require 180 seconds of real local food, medicine, teaching and a serviced route before town registration',()=>{
  const h=fullTown(80),{s,m,id}=h,local=m.data(s,id);local.town=false;local.townStable=0;
  for(let i=0;i<17;i++)settle(h);assert.equal(m.nextEvent(s),null);settle(h);assert.equal(m.nextEvent(s),'municipalTown_river');
  const before=JSON.stringify([h.n.cohorts,h.n.stores]);m.event('municipalTown_river',(msg,fn)=>()=>{if(fn)fn();}).buttons.record.onChoose();assert.equal(local.town,true);assert.equal(JSON.stringify([h.n.cohorts,h.n.stores]),before);
  h.route.condition='closed';settle(h);assert.equal(local.townStable,0);assert.equal(local.town,true);
});
test('paid building cargo keeps town registration reachable while the shared cart temporarily carries materials instead of trade',()=>{
  const h=fullTown(80),{s,r,m,id,route}=h,local=m.data(s,id);local.town=false;local.townStable=0;route.lastDeliveredAt=s.civilization.elapsed-1000;
  m.settleNode(s,id);assert.equal(m.developmentReady(s,id),false);
  assert.equal(m.startProject(s,id,'woodlot'),true);const p=load(h);assert.equal(r.arrive(s,p),true);const receipt=route.lastSupplyAt;
  // This fixture advances the supplied economy in its normal ten-second batches;
  // it does not forge another trade receipt during the 180-second stable period.
  for(let i=0;i<18;i++){s.civilization.elapsed+=10;m.settleNode(s,id);}
  assert.equal(route.lastSupplyAt,receipt);assert.equal(local.townStable,180);assert.equal(m.nextEvent(s),'municipalTown_river');
  m.event('municipalTown_river',(message,fn)=>()=>{fn?.();}).buttons.record.onChoose();assert.equal(local.town,true);assert.equal(h.n.population,80);
  route.condition='closed';assert.equal(m.developmentReady(s,id),false);
});
test('400 residents need 300 seconds, real powered industry, low pollution and held local reserves to become a city',()=>{
  const h=fullTown(),{s,m,id,n}=h,local=m.data(s,id);local.cityStable=0;
  for(let i=0;i<29;i++)settle(h);assert.equal(m.nextEvent(s),null);settle(h);assert.equal(m.nextEvent(s),'municipalCity_river');
  n.stores.tools=0;m.event('municipalCity_river',(msg,fn)=>()=>{if(fn)fn();}).buttons.record.onChoose();assert.equal(local.city,false);
  n.stores.tools=1000;settle(h);m.event('municipalCity_river',(msg,fn)=>()=>{if(fn)fn();}).buttons.record.onChoose();assert.equal(local.city,true);assert.equal(s.civilization.regions.cityCluster,undefined);assert.equal(n.population,400);
  local.pollution=60;settle(h);assert.equal(local.cityStable,0);assert.equal(local.city,true);
});
test('import validates paid build history, project buffers, actual caps and power; malformed new state is never reinitialized',()=>{
  const h=infrastructure(activate(harness())),{s,m,id}=h;assert.doesNotThrow(()=>m.validate(s));
  for(const mutate of [x=>m.data(x,id).buildings.residential=1,x=>m.data(x,id).project.buffer.wood=1,x=>m.data(x,id).nextProject++,x=>m.data(x,id).power.used=99,x=>x.civilization.regions.nodes[id].workers.miner=99]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>m.validate(bad));}
  for(const value of [null,false,0]){const bad=structuredClone(s);bad.civilization.municipal=value;m.init(bad);assert.equal(bad.civilization.municipal,value);assert.throws(()=>m.validate(bad));}
  const loaded=JSON.parse(JSON.stringify(s)),before=JSON.stringify(loaded);m.init(loaded);assert.equal(JSON.stringify(loaded),before);assert.doesNotThrow(()=>m.validate(loaded));
});
test('a legacy capacity snapshot cannot invent smiths, miners, power or excessive farm/clinic places',()=>{
  for(const id of ['river','rail','highland']){
    const h=activate(harness(id));assert.doesNotThrow(()=>h.m.validate(h.s));const limits=h.m.legacyJobLimits(id);
    for(const [job,count]of [['smith',1],['miner',1],['electrician',1],['farmer',limits.farmer+1],['medic',limits.medic+1]]){
      const bad=structuredClone(h.s);h.m.data(bad,id).baseWorkers[job]=count;assert.throws(()=>h.m.validate(bad));
    }
    const shortage=structuredClone(h.s);h.m.data(shortage,id).baseWorkers={};h.m.planWorkers(shortage,id);assert.doesNotThrow(()=>h.m.validate(shortage));
  }
});
test('a diverse 400-resident local city sustains a century of paid births, retirement, real trade and industrial upkeep without resupply cheats',t=>{
  const h=fullTown(),{s,m,r,id,n,ctx,route}=h,local=m.data(s,id);
  // The starting census is a declared test fixture. After this line only real annual births/deaths may change it.
  n.cohorts=[];for(let age=0;age<80;age++){n.cohorts.push({age,count:4,identity:'human'},{age,count:1,identity:'mutant'});}n.population=400;n.year=Math.floor(s.civilization.elapsed/600);
  const startPopulation=n.population,startYear=n.year,startTools=n.stores.tools;let minimumPopulation=n.population,minimumLabor=ctx.CivilPopulation.workforce(n.cohorts),minimumHealth=n.health,births=0;
  const stopAt=s.civilization.elapsed+100*600;
  while(s.civilization.elapsed<stopAt){
    s.civilization.elapsed++;
    if(s.civilization.elapsed%10===0)m.settleNode(s,id);
    const beforeYear=n.year;
    r.tick(s);m.tick(s);
    if(n.year>beforeYear){births+=n.cohorts.filter(c=>c.age===0).reduce((sum,c)=>sum+c.count,0);assert.ok(n.population<=m.capacity(s,id));}
    minimumPopulation=Math.min(minimumPopulation,n.population);minimumLabor=Math.min(minimumLabor,ctx.CivilPopulation.workforce(n.cohorts));minimumHealth=Math.min(minimumHealth,n.health);
    assert.ok(Object.values(n.stores).every(v=>v>=0&&Number.isFinite(v)));
  }
  assert.equal(n.year-startYear,100);assert.ok(births>startPopulation);assert.ok(n.population>=400);assert.ok(minimumLabor>=100);assert.ok(minimumHealth>=60);assert.ok(n.stores.tools>0);assert.ok(n.stores.medicine>0);assert.ok(n.stores.food>m.foodReserve(s,id));assert.ok(route.completedTrips>100);assert.ok(local.economy.industry);assert.ok(local.economy.productivePower>=4);assert.doesNotThrow(()=>m.validate(s));assert.doesNotThrow(()=>r.validate(s));
  t.diagnostic(`100 years: population ${startPopulation} → ${n.population} (min ${minimumPopulation}), births ${births}, workforce min ${minimumLabor}, health min ${minimumHealth}, tools ${startTools} → ${n.stores.tools.toFixed(2)}, food ${n.stores.food.toFixed(2)}, medicine ${n.stores.medicine.toFixed(2)}, completed trades ${route.completedTrips}`);
});
