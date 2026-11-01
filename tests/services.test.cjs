const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8')).state;
  const messages=[],ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:x=>messages.push(x)}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/population.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/municipal.js','src/postwar/services.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  const v=ctx.CivilServices,r=ctx.CivilRegions,m=ctx.CivilMunicipal;
  ctx.CivilSociety.init(s);r.init(s);m.init(s);v.init(s);
  s.civilization.urban={city:true,chartered:true};Object.assign(s.civilization.tech,{chemistry:true,steel:true,medicine:true,municipal_engineering:true,urbanworks:true});
  Object.assign(s.game.buildings,{publicclinic:1,publicschool:1});
  s.game.population=200;s.civilization.society.cohorts=[{age:30,count:200,identity:'human'}];s.game.workers={medic:2,teacher:2};s.civilization.village.health=100;
  for(const key of ctx.CivilCatalog.resources)s.stores[key]=10000;
  return {s,ctx,v,r,m,messages};
}
function local(h,id='river'){
  const {s,r,m}=h;s.civilization.regions.active=true;const n=r.createNode(s,id);n.relation='associated';n.control='shared';n.completedProjects.publicWorks=true;
  assert.equal(m.activate(s,id),true);const b=m.data(s,id).buildings;Object.assign(b,{farmland:1,clinic:1,school:1});
  n.population=200;n.cohorts=[{age:30,count:200,identity:'human'}];n.health=100;n.workers={medic:2,teacher:2};for(const key of h.ctx.CivilCatalog.resources)n.stores[key]=1000;
  return {...h,id,n};
}
function run(h,id='home',power=100,factor=1){
  const stores=h.v.stores(h.s,id),flow={};
  const paid=(job,count,cost,output)=>{
    let n=count;for(const [k,v]of Object.entries(cost))n=Math.min(n,Math.floor(((stores[k]||0)+1e-8)/v));
    const row=flow[h.ctx.CivilCatalog.jobs[job]||job]||={};
    for(const [k,v]of Object.entries(cost)){stores[k]=Math.max(0,(stores[k]||0)-n*v);row[k]=(row[k]||0)-n*v;}
    for(const [k,v]of Object.entries(output)){stores[k]=(stores[k]||0)+n*v;row[k]=(row[k]||0)+n*v;}return n;
  };
  return {...h.v.run(h.s,id,{factor,run:paid,powerAvailable:power}),flow};
}
function shipment(h,id,capacity=64){
  const q=h.v.nextCargo(h.s,id,capacity);if(!q)return null;
  const r=h.s.civilization.regions;for(const [k,n]of Object.entries(q.cargo))h.s.stores[k]-=n;
  const p={id:r.nextShipment++,route:id,purpose:'services',serviceProjectId:q.projectId,source:'home',target:id,phase:'outbound',status:'moving',remaining:0,cargo:q.cargo};r.shipments.push(p);return p;
}
function deliver(h,id,p){assert.equal(h.v.receiveCargo(h.s,id,p.cargo,p.serviceProjectId),true);p.cargo={};p.phase='empty';p.source=id;p.target='home';p.remaining=20;}
function finish(h,type,id='home'){
  assert.equal(h.v.startProject(h.s,id,type),true,'start '+type);const p=h.v.data(h.s,id).project;
  if(id!=='home'){let ship;while((ship=shipment(h,id))){deliver(h,id,ship);h.s.civilization.regions.shipments=[];}}
  h.v.workers(h.s,id)[id==='home'?'servicebuilder':'builder']=2;
  for(let i=0;i<1000&&p.status!=='complete';i++){h.s.civilization.elapsed++;if(h.v.data(h.s,id).buildings.waterworks&&i%10===0)run(h,id);h.v.tick(h.s);}
  assert.equal(p.status,'complete','finish '+type);return p;
}
test('old saves gain no facilities, people or resources; optional service state is initialized only once',()=>{
  const h=harness(),{s,v}=h;delete s.civilization.services;const before=JSON.stringify([s.stores,s.game,s.civilization.society]);v.init(s);assert.equal(JSON.stringify([s.stores,s.game,s.civilization.society]),before);assert.deepEqual(Object.keys(s.civilization.services.nodes),[]);assert.equal(v.capacityBonus(s),0);
  const once=JSON.stringify(s);v.init(s);assert.equal(JSON.stringify(s),once);assert.doesNotThrow(()=>v.validate(s));
  for(const bad of [null,false,0,[]]){const copy=structuredClone(s);copy.civilization.services=bad;assert.throws(()=>v.validate(copy));}
});

test('home waterfield production pays tools for actual workers and stops only new fields when maintenance is short',()=>{
  const h=harness(),{s,v,ctx}=h;finish(h,'waterfield');finish(h,'irrigationworks');finish(h,'waterworks');
  s.civilization.society.governed=false;s.civilization.hunger=0;s.civilization.outpostSupplied=true;s.civilization.tech.irrigation=true;
  const legacy=ctx.CivilCatalog.jobCapacity(s,'farmer')-8;s.game.workers={farmer:legacy+8,waterworker:4};
  s.stores.tools=.025;const before=JSON.stringify(s),quote=ctx.CivilRules.rates(s);
  assert.equal(JSON.stringify(s),before,'income preview does not pay maintenance');
  assert.ok(Math.abs(quote['农夫'].food-(legacy*2+2*1.4))<1e-8);assert.equal(quote['农夫'].tools,-.02);
  const dry=ctx.CivilRules.settle(s);assert.ok(Math.abs(s.stores.tools-.005)<1e-8);assert.equal(dry.flow['农夫'].food,quote['农夫'].food);
  assert.equal(ctx.CivilRules.rates(s)['农夫'].food,legacy*2,'legacy farms keep their original recipe');
  s.stores.tools=.03;s.civilization.elapsed++;run(h);s.civilization.elapsed+=10;
  const wet=ctx.CivilRules.settle(s);assert.equal(v.farmRate(s),2);assert.equal(wet.flow['农夫'].food,legacy*2+6);assert.equal(wet.flow['农夫'].tools,-.03);assert.equal(s.stores.tools,0);
  s.stores.tools=.08;s.civilization.elapsed+=10;
  const expired=ctx.CivilRules.settle(s);assert.equal(v.farmRate(s),1.4);assert.ok(Math.abs(expired.flow['农夫'].food-(legacy*2+8*1.4))<1e-8);assert.equal(s.stores.tools,0);
});
test('home service projects pay once and need two real adult builders; completed jobs are progressively exposed',()=>{
  const h=harness(),{s,v,ctx}=h,food=s.stores.food,before={...s.stores};assert.equal(ctx.CivilCatalog.jobCapacity(s,'pharmacist'),0);
  assert.equal(v.startProject(s,'home','pharmacy'),true);assert.equal(s.stores.wood,before.wood-180);assert.equal(s.stores.glass,before.glass-10);assert.equal(s.game.workers.servicebuilder,0);assert.equal(s.game.workers.pharmacist,undefined);
  assert.equal(v.startProject(s,'home','waterworks'),false);assert.equal(s.stores.wood,before.wood-180);
  const p=v.data(s).project;s.civilization.elapsed++;v.tick(s);assert.equal(p.remaining,240);s.game.workers.servicebuilder=2;s.civilization.society.cohorts[0].age=70;s.civilization.elapsed++;v.tick(s);assert.equal(p.remaining,240);
  s.civilization.society.cohorts[0].age=30;for(let i=0;i<240;i++){s.civilization.elapsed++;v.tick(s);v.tick(s);}
  assert.equal(p.status,'complete');assert.equal(s.game.workers.servicebuilder,0);assert.equal(s.game.workers.pharmacist,0);assert.equal(ctx.CivilCatalog.jobCapacity(s,'pharmacist'),8);assert.equal(s.stores.food,food);assert.equal(s.game.population,200);assert.doesNotThrow(()=>v.validate(s));
});
test('an unaffordable home project and unconsented targets fail without starting or debiting anything',()=>{
  const h=harness(),{s,v}=h;s.stores.glass=0;const before=JSON.stringify(s);assert.equal(v.startProject(s,'home','pharmacy'),false);assert.equal(JSON.stringify(s),before);
  for(const id of ['unknown','__proto__','constructor'])assert.equal(v.startProject(s,id,'waterworks'),false);
});
test('remote construction receives bounded real cargo once, while home and destination warehouses remain separate',()=>{
  const h=local(harness()),{s,v,n,id}=h,home={...s.stores},own=JSON.stringify(n.stores);assert.equal(v.startProject(s,id,'waterworks'),true);assert.deepEqual(s.stores,home);assert.equal(v.data(s,id).project.status,'supplying');
  const before=JSON.stringify(s),q=v.nextCargo(s,id,999);assert.equal(Object.values(q.cargo).reduce((a,b)=>a+b,0),64);assert.equal(JSON.stringify(s),before);
  const ship=shipment(h,id);deliver(h,id,ship);assert.equal(v.receiveCargo(s,id,q.cargo,q.projectId),false);assert.equal(v.validShipment(s,ship),true);s.civilization.regions.shipments=[];
  let next;while((next=shipment(h,id))){deliver(h,id,next);s.civilization.regions.shipments=[];}
  const p=v.data(s,id).project;assert.equal(p.status,'building');assert.equal(JSON.stringify(n.stores),own);assert.equal(s.stores.steel,home.steel-40);assert.equal(v.data(s,id).buildings.waterworks,undefined);
  n.workers.builder=2;for(let i=0;i<300;i++){s.civilization.elapsed++;v.tick(s);}assert.equal(v.data(s,id).buildings.waterworks,1);assert.equal(v.data(s,id).stores,undefined);assert.equal(v.data(s,id).cohorts,undefined);assert.doesNotThrow(()=>v.validate(s));
});
test('undelivered services cargo can return along the Regions home-to-home receipt without satisfying a project',()=>{
  const h=local(harness()),{s,v,id}=h;v.startProject(s,id,'waterworks');const p=shipment(h,id);p.phase='returning';p.target='home';p.remaining=25;
  assert.equal(v.validShipment(s,p),true);assert.equal(v.receiveCargo(s,id,p.cargo,p.serviceProjectId),false);assert.equal(v.data(s,id).project.status,'supplying');assert.equal(v.validShipment(s,{...p,source:id}),false);
  assert.equal(v.validShipment(s,{...p,serviceProjectId:999}),false);
});
test('an old empty services cart remains valid after a subsequent project starts; simultaneous municipal work is refused',()=>{
  const h=local(harness()),{s,v,m,id}=h;finish(h,'waterworks',id);const p={route:id,purpose:'services',serviceProjectId:1,source:id,target:'home',phase:'empty',cargo:{}};
  assert.equal(v.startProject(s,id,'waterfield'),true);assert.equal(v.validShipment(s,p),true);assert.equal(v.validShipment(s,{...p,cargo:{steel:1}}),false);
  const other=local(harness());other.m.data(other.s,other.id).project={status:'building'};assert.equal(other.v.projectAvailable(other.s,other.id),false);assert.equal(other.v.startProject(other.s,other.id,'waterworks'),false);
});
test('water and pharmacy consume one shared power budget and exact local inputs; repeat settlements cannot charge twice',()=>{
  const h=harness(),{s,v}=h;finish(h,'pharmacy');finish(h,'waterworks');s.game.workers.waterworker=4;s.game.workers.pharmacist=8;s.civilization.elapsed++;
  const before={...s.stores},result=run(h,'home',5);assert.equal(result.used,5);assert.equal(result.demand,8);assert.equal(result.waterCapacity,600);assert.equal(result.medicine,.8);
  assert.ok(Math.abs(before.chemicals-s.stores.chemicals-.5)<1e-8);assert.ok(Math.abs(before.food-s.stores.food-.4)<1e-8);assert.ok(Math.abs(before.parts-s.stores.parts-.02)<1e-8);assert.equal(result.flow['药剂师'].medicine,.8);
  const once=JSON.stringify(s);assert.equal(run(h,'home',100).used,0);assert.equal(JSON.stringify(s),once);assert.doesNotThrow(()=>v.validate(s));
});
test('lack of inputs or adults never fabricates water, medicine or electrical demand fulfillment',()=>{
  const h=harness(),{s,v}=h;finish(h,'pharmacy');finish(h,'waterworks');s.game.workers.waterworker=4;s.game.workers.pharmacist=8;s.stores.chemicals=0;s.civilization.elapsed++;
  assert.equal(run(h).used,0);assert.equal(v.waterCapacity(s),0);s.stores.chemicals=100;s.civilization.society.cohorts[0].age=70;s.civilization.elapsed++;
  const before=s.stores.medicine;assert.equal(run(h).used,0);assert.equal(s.stores.medicine,before);
});
test('manual water requires eight actual workers, half capacity and the same paid chemicals and maintenance',()=>{
  const h=harness(),{s,v}=h;finish(h,'waterworks');assert.equal(v.setManualWater(s,'home',true),true);s.game.workers.waterworker=4;s.civilization.elapsed++;assert.equal(run(h,'home',0).waterCapacity,0);
  s.game.workers.waterworker=8;s.civilization.elapsed++;const before={...s.stores},r=run(h,'home',0);assert.equal(r.waterCapacity,300);assert.equal(r.used,0);assert.equal(r.demand,0);assert.ok(Math.abs(before.chemicals-s.stores.chemicals-.2)<1e-8);assert.ok(Math.abs(before.parts-s.stores.parts-.02)<1e-8);
});
test('paid irrigation uses the next exact settlement once, survives pure rate reads, and expires without stored electricity',()=>{
  const h=harness(),{s,v,ctx}=h;finish(h,'waterfield');finish(h,'irrigationworks');finish(h,'waterworks');s.game.workers.waterworker=4;s.civilization.elapsed++;run(h);
  const at=s.civilization.elapsed;assert.equal(v.farmRate(s),1.4);assert.equal(v.begin(s).waterCapacity,0);assert.equal(v.nextSettlementAt(s),at+10);
  s.civilization.elapsed+=3;assert.equal(v.nextSettlementAt(s),at+10);s.civilization.elapsed=at+10;assert.equal(v.begin(s).waterCapacity,600);assert.equal(v.farmRate(s),2);assert.equal(v.begin(s).waterCapacity,0);assert.equal(v.farmRate(s),2);
  s.stores.chemicals=0;run(h);assert.equal(v.farmRate(s),2,'new certificate cannot erase already consumed water');const copy=JSON.stringify(s);assert.equal(v.farmRate(s),2);assert.equal(JSON.stringify(s),copy);
  s.civilization.elapsed+=10;assert.equal(v.begin(s).waterCapacity,0);assert.equal(v.farmRate(s),1.4);assert.equal(v.waterCapacity(s),0);assert.equal(ctx.CivilCatalog.jobCapacity(s,'farmer'),8+(s.game.buildings.farm||0)*4+(s.game.buildings.irrigatedfield||0)*8);
  s.civilization.productionClock=3;assert.equal(v.nextSettlementAt(s),s.civilization.elapsed+7);assert.doesNotThrow(()=>v.validate(s));
});
test('water certificates missed during a pause or copied to a different settlement cannot supply new agriculture',()=>{
  const h=local(harness()),{s,v,id}=h;finish(h,'waterworks');s.game.workers.waterworker=4;s.civilization.elapsed++;run(h);s.civilization.elapsed+=11;assert.equal(v.begin(s).waterCapacity,0);assert.equal(v.begin(s,id).waterCapacity,0);assert.equal(v.farmRate(s,id),1.4);
});
test('dense housing needs paid steel and glass, actual water throughout construction, and grants beds only when finished',()=>{
  const h=harness(),{s,v,ctx}=h;finish(h,'waterworks');s.game.workers.waterworker=4;const base=ctx.CivilCatalog.capacity(s);assert.equal(v.startProject(s,'home','densehousing'),false);
  s.civilization.elapsed++;run(h);const before={...s.stores};assert.equal(v.startProject(s,'home','densehousing'),true);assert.equal(s.stores.steel,before.steel-90);assert.equal(s.stores.glass,before.glass-40);assert.equal(ctx.CivilCatalog.capacity(s),base);
  s.game.workers.servicebuilder=2;s.civilization.elapsed+=11;v.tick(s);assert.equal(v.data(s).project.remaining,360,'expired supply pauses construction');
  for(let i=0;i<360;i++){s.civilization.elapsed++;if(i%10===0)run(h);v.tick(s);}assert.equal(ctx.CivilCatalog.capacity(s),base+160);assert.equal(s.game.population,200);assert.equal(s.game.workers.servicebuilder,0);assert.doesNotThrow(()=>v.validate(s));
});
test('save and reload preserve partial project progress and consumed water without granting a work second',()=>{
  const h=harness(),{s,v}=h;finish(h,'waterworks');s.game.workers.waterworker=4;s.civilization.elapsed++;run(h);s.civilization.elapsed+=10;v.begin(s);v.startProject(s,'home','waterfield');s.game.workers.servicebuilder=2;
  s.civilization.elapsed++;v.tick(s);const loaded=JSON.parse(JSON.stringify(s)),before=JSON.stringify(loaded);v.init(loaded);v.tick(loaded);assert.equal(JSON.stringify(loaded),before);assert.doesNotThrow(()=>v.validate(loaded));
});
test('imports reject invented facilities, forged construction costs, duplicate receipts and future service evidence',()=>{
  const h=harness(),{s,v}=h;finish(h,'waterworks');s.game.workers.waterworker=4;s.civilization.elapsed++;run(h);v.startProject(s,'home','waterfield');
  const mutations=[m=>m.buildings.waterworks++,m=>m.project.required.wood++,m=>m.project.receipts=[1,1],m=>m.economy.at++,m=>m.water.usableAt++,m=>m.water.capacity=1200,m=>m.irrigation={at:s.civilization.elapsed+1,waterCapacity:1},m=>m.completed.push({...m.completed[0]})];
  for(const mutate of mutations){const bad=structuredClone(s);mutate(bad.civilization.services.nodes.home);assert.throws(()=>v.validate(bad));}
});
test('project occupancy is independent of a municipal agreement, while simultaneous builders are rejected on import',()=>{
  const h=harness(),{s,v,r,m}=h;r.createNode(s,'river');assert.equal(v.projectAvailable(s,'river'),true);assert.equal(v.startProject(s,'river','waterworks'),false);
  const target=local(h,'river');assert.equal(v.startProject(s,'river','waterworks'),true);m.data(s,'river').project={status:'building'};assert.throws(()=>v.validate(s));
});
test('local service operations consume only local raw materials and cannot borrow an abundant home warehouse',()=>{
  const h=local(harness()),{s,v,n,id}=h;finish(h,'pharmacy',id);finish(h,'waterworks',id);n.workers={medic:2,teacher:2,pharmacist:8,waterworker:4};
  const home=JSON.stringify(s.stores);n.stores.chemicals=0;s.civilization.elapsed++;assert.equal(run(h,id).used,0);assert.equal(JSON.stringify(s.stores),home);
  n.stores.chemicals=10;s.civilization.elapsed++;const before=n.stores.medicine;assert.equal(run(h,id,8).used,8);assert.ok(Math.abs(n.stores.medicine-before-3.2)<1e-8);assert.equal(JSON.stringify(s.stores),home);
});
test('research follows actual chemistry and steel evidence but never requires a thousand or three thousand surviving residents',()=>{
  const h=harness(),{s,ctx}=h;s.game.population=4;s.civilization.society.cohorts=[{age:30,count:4}];s.game.workers={};
  assert.equal(ctx.CivilCatalog.researchAvailable(s,'medicine'),true);assert.equal(ctx.CivilCatalog.researchAvailable(s,'municipal_engineering'),true);
  s.stores.chemicals=0;assert.equal(ctx.CivilCatalog.researchAvailable(s,'medicine'),false);s.stores.steel=0;assert.equal(ctx.CivilCatalog.researchAvailable(s,'municipal_engineering'),false);
});
test('a home district school pays steel and glass, needs actual construction and adds teacher slots without granting residents or teachers',()=>{
  const h=harness(),{s,v,ctx}=h,base=ctx.CivilCatalog.jobCapacity(s,'teacher'),population=s.game.population,cohorts=JSON.stringify(s.civilization.society.cohorts),initialTeachers=s.game.workers.teacher;
  s.civilization.tech.municipal_engineering=false;assert.equal(v.startProject(s,'home','districtschool'),false);s.civilization.tech.municipal_engineering=true;
  const before={...s.stores};assert.equal(v.startProject(s,'home','districtschool'),true);
  for(const [key,cost]of Object.entries(ctx.CivilServiceContent.facilities.districtschool.cost))assert.equal(s.stores[key],before[key]-cost);
  assert.equal(ctx.CivilCatalog.jobCapacity(s,'teacher'),base);const project=v.data(s).project;s.civilization.elapsed++;v.tick(s);assert.equal(project.remaining,240);
  s.game.workers.servicebuilder=2;for(let i=0;i<240;i++){s.civilization.elapsed++;v.tick(s);}
  assert.equal(ctx.CivilCatalog.jobCapacity(s,'teacher'),base+12);assert.equal(s.game.workers.teacher,initialTeachers);assert.equal(s.game.population,population);assert.equal(JSON.stringify(s.civilization.society.cohorts),cohorts);assert.equal(s.game.workers.servicebuilder,0);assert.doesNotThrow(()=>v.validate(s));
  // Teaching retains the existing paid recipe; new places are not automatic knowledge output.
  s.game.workers={teacher:12};const stock={...s.stores},factor=ctx.CivilIndustry.factor(s);ctx.CivilRules.settleIndustry(s,true);
  assert.ok(Math.abs(stock.wood-s.stores.wood-1.2)<1e-8);assert.ok(Math.abs(s.stores.knowledge-stock.knowledge-2.4*factor)<1e-8);
});
test('a remote district school receives real cargo and expands only that destination teacher capacity when local builders finish',()=>{
  const h=local(harness()),{s,v,m,n,id}=h,base=m.jobCapacity(s,id).teacher,cohorts=JSON.stringify(n.cohorts),stock=JSON.stringify(n.stores),home={...s.stores},pop=n.population;
  assert.equal(v.startProject(s,id,'districtschool'),true);assert.deepEqual(s.stores,home);let trips=0,p;
  while((p=shipment(h,id))){assert.ok(Object.values(p.cargo).reduce((sum,x)=>sum+x,0)<=64);deliver(h,id,p);s.civilization.regions.shipments=[];trips++;}
  assert.ok(trips>=4);assert.equal(m.jobCapacity(s,id).teacher,base);assert.equal(s.stores.steel,home.steel-16);assert.equal(s.stores.glass,home.glass-12);
  n.workers.builder=2;for(let i=0;i<240;i++){s.civilization.elapsed++;v.tick(s);}
  assert.equal(m.jobCapacity(s,id).teacher,base+12);assert.equal(v.jobs(s,'home').teacher,undefined);assert.equal(n.population,pop);assert.equal(JSON.stringify(n.cohorts),cohorts);assert.equal(JSON.stringify(n.stores),stock);assert.doesNotThrow(()=>v.validate(s));
});
test('four paid district schools are the exact new cap and completed-history validation derives the full facilities total',()=>{
  const h=harness(),{s,v,ctx}=h,base=ctx.CivilCatalog.jobCapacity(s,'teacher');for(let i=0;i<4;i++)finish(h,'districtschool');
  assert.equal(ctx.CivilCatalog.jobCapacity(s,'teacher'),base+48);const before=JSON.stringify(s);assert.equal(v.startProject(s,'home','districtschool'),false);assert.equal(JSON.stringify(s),before);assert.equal(s.game.population,200);assert.doesNotThrow(()=>v.validate(s));
  const full=structuredClone(s),node=v.data(full);node.buildings={};node.completed=[];let nextId=1;
  for(const [type,facility]of Object.entries(ctx.CivilServiceContent.facilities)){node.buildings[type]=facility.max;for(let i=0;i<facility.max;i++)node.completed.push({id:nextId++,type,completedAt:full.civilization.elapsed});}
  node.nextProject=nextId;node.project=null;assert.equal(node.completed.length,33);assert.doesNotThrow(()=>v.validate(full));
  const excessive=structuredClone(full);v.data(excessive).buildings.districtschool=5;assert.throws(()=>v.validate(excessive));
  const extraHistory=structuredClone(full);v.data(extraHistory).completed.push({id:nextId,type:'districtschool',completedAt:s.civilization.elapsed});v.data(extraHistory).nextProject++;assert.throws(()=>v.validate(extraHistory));
});
