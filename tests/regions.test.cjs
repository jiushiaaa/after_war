const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8')).state;
  const messages=[];
  const ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:x=>messages.push(x)}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','src/postwar/population.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  ctx.CivilRegions.init(s);
  const activate=()=>{s.civilization.tech.logistics=true;s.game.buildings.cartdepot=1;s.game.workers={transporter:2};ctx.CivilRegions.activate(s);return s.civilization.regions;};
  const step=(n=1,economy=false)=>{for(let i=0;i<n;i++){s.civilization.elapsed++;if(economy && s.civilization.elapsed%10===0)ctx.CivilRegions.settle(s);ctx.CivilRegions.tick(s);}};
  return {s,ctx,r:ctx.CivilRegions,messages,activate,step};
}
function totals(s){
  const out={},r=s.civilization.regions;
  const add=store=>{for(const [k,v]of Object.entries(store))out[k]=(out[k]||0)+v;};
  add(s.stores);for(const n of Object.values(r.nodes))add(n.stores);for(const p of r.shipments)add(p.cargo);for(const p of Object.values(r.projects))add(p.buffer);
  for(const m of Object.values(s.civilization.municipal?.nodes||{}))if(m.project)add(m.project.buffer);
  return out;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('legacy river stays live until logistics, a depot and two available workers exist',()=>{
  const {s,r}=harness();const before=JSON.stringify(s.stores),v=JSON.stringify(s.civilization.village);
  r.tick(s);assert.equal(s.civilization.regions.active,false);assert.equal(JSON.stringify(s.stores),before);assert.equal(JSON.stringify(s.civilization.village),v);
  s.civilization.tech.logistics=true;r.tick(s);assert.equal(s.civilization.regions.active,false);
  s.game.buildings.cartdepot=1;s.game.workers.transporter=1;r.tick(s);assert.equal(s.civilization.regions.active,false);
  s.game.workers.transporter=2;r.tick(s);assert.equal(s.civilization.regions.active,true);
});
test('activation copies existing recipient stocks and trip clock once without replaying old aid or deliveries',()=>{
  const {s,r,activate}=harness(),v=s.civilization.village;v.riverFood=123.4;v.riverTools=44;v.riverMedicine=5.25;v.convoys=17;v.convoyClock=40;
  const home=JSON.stringify(s.stores),x=activate();assert.deepEqual(JSON.parse(JSON.stringify(x.nodes.river.stores)),{food:123.4,tools:44,medicine:5.25});assert.equal(x.routes.river.completedTrips,17);assert.equal(x.routes.river.dispatchIn,20);assert.equal(x.shipments.length,0);assert.equal(JSON.stringify(s.stores),home);
  x.nodes.river.stores.food=70;r.init(s);r.activate(s);assert.equal(x.nodes.river.stores.food,70);assert.equal(x.routes.river.completedTrips,17);assert.doesNotThrow(()=>r.validate(s));
  const copy=JSON.parse(JSON.stringify(s));r.init(copy);r.activate(copy);assert.equal(copy.civilization.regions.nodes.river.stores.food,70);
});
test('preview-era aid migration runs before the new ledger and cannot be credited twice',()=>{
  const {s,r,activate}=harness(),v=s.civilization.village;delete v.schema;v.riverFood=50;v.riverTools=4;v.riverAllied=true;
  const x=activate();assert.equal(x.nodes.river.stores.food,90);assert.equal(x.nodes.river.stores.tools,16);r.activate(s);assert.equal(x.nodes.river.stores.tools,16);
});
test('source, shipment and recipient conserve cargo through a complete round trip; upkeep is spent once',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.stores={food:500,wood:100,tools:50,medicine:20};x.nodes.river.stores.food=80;
  const before=totals(s),homeFood=s.stores.food,remoteTools=x.nodes.river.stores.tools;
  assert.equal(r.launch(s,'river'),true);assert.equal(x.shipments.length,1);assert.equal(s.stores.food,homeFood-1);assert.equal(x.nodes.river.stores.tools,remoteTools);
  let t=totals(s);near(t.food,before.food-1);near(t.wood,before.wood-1);near(t.tools,before.tools);near(t.medicine,before.medicine);
  r.setRoute(s,'river',false);assert.equal(x.routes.river.assigned,2);step(60);assert.equal(x.nodes.river.stores.tools,remoteTools+1);assert.equal(s.stores.food,homeFood-1);
  step(61);assert.equal(x.shipments.length,0);assert.equal(s.stores.food,homeFood+11);assert.equal(x.routes.river.assigned,0);
  t=totals(s);near(t.food,before.food-1);near(t.wood,before.wood-1);near(t.tools,before.tools);near(t.medicine,before.medicine);
  const final=JSON.stringify(s.stores);step(120);assert.equal(JSON.stringify(s.stores),final);
});
test('a closed road holds actual cargo, and returning refunds only undelivered cargo',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.stores={food:500,wood:100,tools:50,medicine:20};
  const before=structuredClone(s.stores);assert.ok(r.launch(s,'river'));step(12);r.setRoad(s,'river',false);step(1);
  const p=x.shipments[0];assert.equal(p.status,'held');const remaining=p.remaining;step(20);assert.equal(p.remaining,remaining);
  assert.ok(r.returnShipment(s,p.id));step(12);assert.equal(x.shipments.length,0);assert.equal(s.stores.tools,before.tools);assert.equal(s.stores.medicine,before.medicine);assert.equal(s.stores.food,before.food-1);assert.equal(s.stores.wood,before.wood-1);
  assert.equal(r.returnShipment(s,p.id),false);assert.equal(x.routes.river.enabled,false);
});
test('recipient shortage never fabricates barter goods and an empty return does not refund delivered exports',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.stores={food:500,wood:100,tools:50,medicine:20};x.nodes.river.stores.food=0;
  const oldTools=s.stores.tools;assert.ok(r.launch(s,'river'));step(61);assert.equal(x.shipments[0].status,'loading');assert.equal(s.stores.food,499);step(100);assert.equal(x.shipments[0].status,'loading');
  assert.ok(r.returnShipment(s,x.shipments[0].id));step(60);assert.equal(s.stores.tools,oldTools-1);assert.equal(x.shipments.length,0);assert.equal(x.routes.river.completedTrips,s.civilization.village.convoys);
});
test('retirement pauses future dispatch; an already paid trip survives a workforce shortage',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.stores={food:500,wood:100,tools:50,medicine:20};assert.ok(r.launch(s,'river'));s.game.workers.transporter=0;
  assert.doesNotThrow(()=>r.validate(s));step(121);assert.equal(x.shipments.length,0);const before=JSON.stringify(s.stores);step(20);assert.equal(JSON.stringify(s.stores),before);assert.match(x.routes.river.status,/不足/);
  s.game.workers.transporter=2;step(10);assert.equal(x.shipments.length,1);
});
test('regional routes and urban parties share the same actual labor pool without double reservation',()=>{
  const {s,r,ctx,activate}=harness(),x=activate();r.createNode(s,'rail');r.signTrade(s,'rail');s.game.workers.transporter=4;
  ctx.CivilUrban={reservedTransport:()=>2};assert.equal(r.availableTransport(s),0);assert.equal(r.setRoute(s,'rail',true),false);
  ctx.CivilUrban.reservedTransport=()=>0;assert.equal(r.availableTransport(s),2);assert.ok(r.setRoute(s,'rail',true));assert.equal(r.availableTransport(s),0);assert.equal(r.reservedTransport(s),4);
  r.setRoute(s,'rail',false);assert.equal(r.availableTransport(s),2);assert.equal(x.routes.rail.assigned,0);
});
test('discoveries initialize independent nodes once and require actual research/travel gates',()=>{
  const {s,r,ctx}=harness();assert.equal(r.journeys.railSurvey.allowed(s),false);s.civilization.tech.survey=true;assert.equal(r.journeys.railSurvey.allowed(s),true);
  r.event('railSurvey',(text,fn)=>()=>fn()).buttons.meet.onChoose();assert.equal(s.civilization.regions.nodes.rail.population,32);assert.equal(r.journeys.railSurvey.allowed(s),false);assert.equal(r.journeys.highlandSurvey.allowed(s),true);
  const before=JSON.stringify(s.civilization.regions.nodes.rail);r.createNode(s,'rail');assert.equal(JSON.stringify(s.civilization.regions.nodes.rail),before);
  r.createNode(s,'highland');const high=s.civilization.regions.nodes.highland;assert.equal(high.cohorts.filter(c=>c.identity==='mutant').reduce((n,c)=>n+c.count,0),8);assert.equal(high.control,'independent');
  assert.ok(ctx.CivilText.research.administration.requires.includes('standards'));assert.equal(r.discoveredCount(s),3);
});
test('remote industry pays inputs and population meals; the returned flow contains home changes only',()=>{
  const {s,r,activate}=harness();activate();r.createNode(s,'rail');const n=s.civilization.regions.nodes.rail;
  n.stores={food:50,coal:0,tools:0,scrap:0,iron:0,parts:0};s.game.buildings.archive=1;s.stores.knowledge=2;const before=structuredClone(s.stores);
  const flow=r.settle(s);assert.equal(n.stores.iron,0);assert.equal(n.stores.parts,0);near(s.stores.knowledge,before.knowledge-.04);
  assert.deepEqual(JSON.parse(JSON.stringify(flow)),{'地区档案':{knowledge:-.04}});assert.ok(n.stores.food<50+5*.8);
  const snap=JSON.stringify(s),copy=structuredClone(s);r.settle(copy);assert.equal(JSON.stringify(s),snap);
});
test('public works require actual split deliveries and local construction labor before they complete',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.civilization.tech.administration=true;s.stores={food:1000,wood:300,tools:100,medicine:50,iron:20,knowledge:100};x.nodes.river.trust=70;x.routes.river.completedTrips=5;
  const start=structuredClone(s.stores);assert.ok(r.startProject(s,'river'));assert.equal(s.stores.knowledge,start.knowledge-10);assert.equal(x.nodes.river.completedProjects.publicWorks,undefined);
  assert.ok(r.launch(s,'river'));assert.equal(Object.values(x.shipments[0].cargo).reduce((a,b)=>a+b,0),64);
  step(60);assert.equal(x.projects.river.status,'supplying');assert.equal(x.projects.river.buffer.wood,64);
  step(131);assert.equal(x.projects.river.status,'building');assert.equal(x.nodes.river.workers.builder,2);assert.ok(Object.values(x.nodes.river.workers).reduce((a,b)=>a+b,0)<=r.workforce(x.nodes.river));
  r.setRoute(s,'river',false);step(240);assert.equal(x.projects.river.status,'complete');assert.equal(x.nodes.river.completedProjects.publicWorks,true);assert.equal(x.nodes.river.workers.medic,2);assert.equal(x.nodes.river.workers.builder,undefined);
  assert.equal(r.startProject(s,'river'),false);assert.doesNotThrow(()=>r.validate(s));
});
test('peaceful accession preserves local stocks, requires capacity and public rights, and survives succession',()=>{
  const {s,r,ctx,activate,step}=harness(),x=activate();s.civilization.tech.administration=true;s.stores.knowledge=500;
  const n=x.nodes.river;n.completedProjects.publicWorks=true;n.trust=80;x.routes.river.completedTrips=5;
  assert.equal(r.associate(s,'river'),false);assert.ok(r.chooseRights(s,'equal'));const before=JSON.stringify(n.stores);assert.ok(r.associate(s,'river'));assert.equal(n.control,'shared');assert.equal(n.relation,'associated');assert.equal(JSON.stringify(n.stores),before);
  s.civilization.society.succession='retirement';const regional=JSON.stringify(x);assert.ok(ctx.CivilSociety.succeed(s,'engineer'));assert.equal(JSON.stringify(x),regional);
  r.setRoute(s,'river',false);step(100);assert.equal(n.integration,0);r.setRoute(s,'river',true);n.stores.food=200;s.stores.food=1000;s.stores.tools=100;s.stores.medicine=100;s.stores.wood=100;step(780,true);assert.equal(n.relation,'integrated');assert.equal(n.integration,100);
});
test('stratified status cannot silently become equal integration; reform offers a recoverable path',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.civilization.tech.administration=true;s.stores={knowledge:500,food:1000,tools:100,medicine:100,wood:100};const n=x.nodes.river;n.completedProjects.publicWorks=true;n.trust=80;x.routes.river.completedTrips=5;
  r.chooseRights(s,'stratified');assert.ok(r.associate(s,'river'));step(610,true);assert.equal(n.relation,'associated');assert.equal(n.integration,0);
  const k=s.stores.knowledge;assert.ok(r.chooseRights(s,'equal'));assert.equal(s.stores.knowledge,k-30);step(600,true);assert.equal(n.relation,'integrated');assert.ok(n.cohorts.some(c=>c.identity==='mutant'));
});
test('administrative overload pauses integration without deleting people or in-flight shipments',()=>{
  const {s,r,activate}=harness(),x=activate();s.civilization.tech.administration=true;r.createNode(s,'rail');r.createNode(s,'highland');s.stores={food:1000,wood:100,tools:100,medicine:100,knowledge:0};
  s.civilization.society.axes={structure:'city',devolution:'central'};
  for(const n of Object.values(x.nodes)){n.relation='associated';n.control='shared';n.completedProjects.publicWorks=true;n.rights='equal';}x.rights='equal';
  assert.ok(r.launch(s,'river'));const id=x.shipments[0].id;r.settle(s);assert.equal(r.load(s),4);assert.equal(r.capacity(s),2);assert.equal(x.adminService,false);r.tick(s);assert.equal(x.shipments[0].id,id);assert.equal(x.nodes.river.integration,0);
  s.game.buildings.archive=1;s.stores.knowledge=10;r.settle(s);assert.equal(r.capacity(s),4);assert.equal(x.adminService,true);
});
test('save validation rejects forged inventory, duplicate shipments and broken population but accepts older saves',()=>{
  const {s,r,activate}=harness();activate();s.stores={food:500,wood:100,tools:50,medicine:20};r.launch(s,'river');assert.doesNotThrow(()=>r.validate(s));
  const change=fn=>{const bad=structuredClone(s);fn(bad.civilization.regions);assert.throws(()=>r.validate(bad));};
  change(x=>x.nodes.river.stores.tools=-1);change(x=>x.shipments.push(structuredClone(x.shipments[0])));change(x=>x.nodes.river.population++);change(x=>x.shipments[0].cargo.unknown=1);change(x=>x.shipments[0].target='rail');change(x=>x.nextShipment=1);change(x=>x.nodes.river.control='occupied');
  const old=structuredClone(s);delete old.civilization.regions;assert.doesNotThrow(()=>r.validate(old));
  const malformed=structuredClone(s);malformed.civilization.regions=null;assert.throws(()=>r.validate(malformed));r.init(malformed);assert.equal(malformed.civilization.regions,null);
});
test('home trade commitments are conservative and never count undelivered imports as production',()=>{
  const {s,r,activate}=harness();activate();const f=r.committedHomeFlow(s);near(f.medicine,-.5*10/130);near(f.food,-10/130);assert.equal(f.iron,undefined);r.setRoute(s,'river',false);assert.equal(Object.keys(r.committedHomeFlow(s)).length,0);
});
test('delivery callbacks cannot credit a removed shipment or a copied queue record twice',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.stores={food:500,wood:100,tools:50,medicine:20};r.launch(s,'river');const p=x.shipments[0];
  assert.equal(r.arrive(s,p),false);const copy=structuredClone(p);copy.remaining=0;assert.equal(r.arrive(s,copy),false);
  r.setRoute(s,'river',false);step(121);const before=JSON.stringify(s.stores);assert.equal(r.arrive(s,p),false);assert.equal(JSON.stringify(s.stores),before);
});
test('an incoming convoy turns back to the remote warehouse; the empty cart cannot cross a blocked road',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.stores={food:500,wood:100,tools:50,medicine:20};x.nodes.river.stores.food=80;r.launch(s,'river');step(81);
  const p=x.shipments[0];assert.equal(p.phase,'inbound');assert.equal(p.remaining,40);assert.equal(x.nodes.river.stores.food,68);
  r.setRoad(s,'river',false);step(1);assert.equal(p.status,'held');assert.ok(r.returnShipment(s,p.id));assert.equal(p.target,'river');step(20);
  assert.equal(x.nodes.river.stores.food,80);assert.equal(s.stores.food,499);assert.equal(p.phase,'empty');assert.equal(p.status,'held');assert.equal(x.routes.river.assigned,2);assert.equal(r.returnShipment(s,p.id),false);assert.doesNotThrow(()=>r.validate(s));
  const snapshot=JSON.stringify(s.stores);step(70);assert.equal(JSON.stringify(s.stores),snapshot);assert.equal(x.shipments.length,1);
  assert.ok(r.repairRoad(s,'river'));step(60);assert.equal(x.shipments.length,0);assert.equal(x.routes.river.assigned,0);assert.equal(s.stores.food,499);
});
test('stale historic trade is not treated as a presently supplied route',()=>{
  const {s,r,activate,step}=harness();activate();assert.equal(r.tradeReady(s),true);s.stores={};step(181);assert.equal(r.tradeReady(s),false);
});
test('non-food return cargo still waits for the source community to retain its meal reserve',()=>{
  for(const id of ['rail','highland']){
    const {s,r,activate,step}=harness(),x=activate();r.setRoute(s,'river',false);r.createNode(s,id);r.signTrade(s,id);r.setRoute(s,id,true);s.stores={food:1000,wood:100,tools:100,coal:100};
    assert.ok(r.launch(s,id));step(x.routes[id].travel);const p=x.shipments[0],n=x.nodes[id];n.stores.food=0;const before=JSON.stringify(n.stores);
    assert.equal(r.loadReturn(s,p),false);assert.equal(p.status,'loading');assert.equal(JSON.stringify(n.stores),before);
    n.stores.food=r.foodPopulation(n)*.24;r.setRoad(s,id,false);const closed=JSON.stringify(n.stores);assert.equal(r.loadReturn(s,p),false);assert.equal(JSON.stringify(n.stores),closed);
    r.setRoad(s,id,true);assert.equal(r.loadReturn(s,p),true);assert.equal(p.status,'moving');const loaded=JSON.stringify(n.stores);assert.equal(r.loadReturn(s,p),false);assert.equal(JSON.stringify(n.stores),loaded);
  }
});
test('residency qualification begins at that community accession, not the global policy date',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.civilization.tech.administration=true;s.stores={knowledge:1000,food:10000,tools:1000,medicine:1000,wood:1000};
  r.chooseRights(s,'resident');step(610,true);const n=x.nodes.river;n.completedProjects.publicWorks=true;n.trust=80;x.routes.river.completedTrips=5;
  assert.ok(r.associate(s,'river'));assert.equal(n.rightsSince,s.civilization.elapsed);step(599,true);assert.equal(n.integration,0);assert.equal(n.relation,'associated');step(601,true);assert.equal(n.relation,'integrated');
});
test('removing equal civil rights downgrades current integration but preserves people, stores and projects',()=>{
  const {s,r,activate}=harness(),x=activate();s.civilization.tech.administration=true;s.stores.knowledge=1000;const n=x.nodes.river;
  n.control='shared';n.relation='integrated';n.integration=100;n.stableSeconds=600;n.completedProjects.publicWorks=true;n.rights='equal';x.rights='equal';
  const before=JSON.stringify({stores:n.stores,cohorts:n.cohorts,completed:n.completedProjects});assert.ok(r.chooseRights(s,'stratified'));assert.equal(n.relation,'associated');assert.equal(n.integration,0);assert.equal(JSON.stringify({stores:n.stores,cohorts:n.cohorts,completed:n.completedProjects}),before);
  assert.doesNotThrow(()=>r.validate(s));
});
test('neighbour service projects can feed their real subsequent children while honoring all three contracts',()=>{
  const {s,r,activate,step}=harness(),x=activate();s.game.workers.transporter=6;s.stores={food:10000,wood:10000,tools:10000,coal:10000,medicine:10000,knowledge:10000};
  for(const id of ['river','rail','highland']){
    const n=r.createNode(s,id);n.completedProjects.publicWorks=true;n.stores.food=200;if(id!=='river'){r.signTrade(s,id);assert.ok(r.setRoute(s,id,true));}
  }
  step(6000,true);
  for(const id of ['river','rail','highland']){
    const n=x.nodes[id];assert.ok(x.routes[id].completedTrips>=15,id+' traded');assert.ok(n.health>=60,id+' health');assert.ok(n.stores.food>r.foodPopulation(n)*.24,id+' food');assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=r.workforce(n),id+' real labor');assert.ok(n.cohorts.some(c=>c.age<18),id+' children');
  }
  assert.doesNotThrow(()=>r.validate(s));
});

function advanceNodeYear(s,r,n){s.civilization.elapsed=(n.year+1)*600;r.annual(s,n);}
test('existing regional saves initialize zero birth credit without replaying ages, people or supplies',()=>{
  const {s,r,activate}=harness(),x=activate(),n=x.nodes.river;n.completedProjects.publicWorks=true;delete n.births;
  const before=JSON.stringify({home:s.stores,stores:n.stores,cohorts:n.cohorts,population:n.population,year:n.year});
  assert.doesNotThrow(()=>r.validate(s));r.init(s);
  assert.equal(JSON.stringify({home:s.stores,stores:n.stores,cohorts:n.cohorts,population:n.population,year:n.year}),before);
  assert.deepEqual(JSON.parse(JSON.stringify(n.births)),{scaled:true,credit:0,mutantCredit:0});
  const initialized=JSON.stringify(x);r.init(s);assert.equal(JSON.stringify(x),initialized);
  for(const value of [null,false,0,[],{}, {scaled:true,credit:1,mutantCredit:0},{scaled:true,credit:0,mutantCredit:-.1}]){
    const copy=structuredClone(s);copy.civilization.regions.nodes.river.births=value;assert.throws(()=>r.validate(copy));
  }
});
test('local newborns pay both food and medicine from their own warehouse before entering the cohort ledger',()=>{
  const {s,r,activate}=harness(),n=activate().nodes.river;n.population=10;n.cohorts=[{age:25,count:10,identity:'human'}];n.stores={food:6,medicine:0};
  const home=JSON.stringify(s.stores);advanceNodeYear(s,r,n);assert.equal(n.population,10);assert.equal(n.stores.food,6);
  n.stores.medicine=.2;advanceNodeYear(s,r,n);assert.equal(n.population,11);assert.equal(n.stores.food,0);assert.equal(n.stores.medicine,0);
  assert.equal(n.cohorts.at(-1).age,0);assert.equal(n.cohorts.at(-1).identity,'human');assert.equal(r.workforce(n),10);assert.equal(JSON.stringify(s.stores),home);
  const paid=JSON.stringify(n);r.annual(s,n);assert.equal(JSON.stringify(n),paid,'same-year refresh cannot pay or deliver another child');r.validate(s);
});
test('regional identity inheritance uses reproductive parents rather than a calendar-based mutant quota',()=>{
  for(const [parent,elder]of [['mutant','human'],['human','mutant']]){
    const {s,r,activate}=harness(),n=activate().nodes.river;
    n.population=10;n.cohorts=[{age:25,count:6,identity:parent},{age:65,count:4,identity:elder}];n.stores={food:100,medicine:10};n.year=19;
    advanceNodeYear(s,r,n);assert.equal(n.year,20);assert.equal(n.cohorts.at(-1).age,0);assert.equal(n.cohorts.at(-1).identity,parent);assert.equal(n.population,11);
  }
  const {s,r,activate}=harness(),n=activate().nodes.river;n.population=10;n.cohorts=[{age:50,count:10,identity:'mutant'}];n.stores={food:100,medicine:10};
  const stores=JSON.stringify(n.stores);advanceNodeYear(s,r,n);assert.equal(n.population,10);assert.equal(JSON.stringify(n.stores),stores,'working residents past reproductive age do not produce children');
});
test('the shared age transition makes children adults, retires workers and removes elders exactly once after reload',()=>{
  const {s,r,activate}=harness(),n=activate().nodes.river;
  n.population=9;n.cohorts=[{age:17,count:4,identity:'human'},{age:64,count:4,identity:'mutant'},{age:79,count:1,identity:'human'}];n.stores={food:100,medicine:10};
  const original=n.cohorts,snapshot=JSON.stringify(original);s.civilization.elapsed=n.year*600+599;r.annual(s,n);assert.equal(JSON.stringify(n.cohorts),snapshot);
  s.civilization.elapsed++;r.annual(s,n);assert.notEqual(n.cohorts,original);assert.equal(JSON.stringify(original),snapshot);assert.equal(n.population,8);assert.equal(r.workforce(n),4);assert.equal(r.foodPopulation(n),8);
  assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=4);
  const copy=structuredClone(s),loaded=copy.civilization.regions.nodes.river,before=JSON.stringify(loaded);r.init(copy);r.annual(copy,loaded);assert.equal(JSON.stringify(loaded),before);r.validate(copy);
});
test('paid local public works enable fractional births with real capacity, and shortages never bank missed children',()=>{
  const {s,r,activate}=harness();activate();const n=r.createNode(s,'rail');n.completedProjects.publicWorks=true;n.stores={food:1000,medicine:100};
  r.init(s);assert.equal(n.births.scaled,true);advanceNodeYear(s,r,n);assert.equal(n.population,34);near(n.stores.food,988);near(n.stores.medicine,99.6);near(n.births.credit,.56);
  const reloaded=structuredClone(s),other=reloaded.civilization.regions.nodes.rail;r.init(reloaded);
  for(let i=0;i<3;i++){advanceNodeYear(s,r,n);advanceNodeYear(reloaded,r,other);}assert.equal(JSON.stringify(other),JSON.stringify(n),'fractional local births survive serialization');
  n.births.credit=.9;n.stores.medicine=0;const population=n.population;advanceNodeYear(s,r,n);assert.equal(n.population,population);assert.equal(n.births.credit,0);
  n.stores.medicine=100;advanceNodeYear(s,r,n);assert.ok(n.population-population<=Math.ceil(population*.04));
  for(let i=0;i<10;i++)advanceNodeYear(s,r,n);assert.ok(n.population<=44,'the original local housing limit remains authoritative');assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=r.workforce(n));r.validate(s);
});

function municipalHarness(){
  const h=harness(),{s,ctx,r}=h,x=h.activate(),n=x.nodes.river;
  for(const file of ['content/municipal.js','src/postwar/municipal.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  s.civilization.urban={city:true,parties:[]};s.civilization.tech.urbanworks=true;s.civilization.tech.administration=true;
  n.completedProjects.publicWorks=true;n.relation='associated';n.control='shared';n.cohorts.forEach(c=>c.age=50);r.planWorkers(s,'river',n);
  s.stores={food:5000,wood:5000,tools:5000,medicine:5000,iron:5000,parts:5000,knowledge:5000};n.stores.food=1000;
  const m=ctx.CivilMunicipal;assert.equal(m.activate(s,'river'),true);
  const step=seconds=>{for(let i=0;i<seconds;i++){s.civilization.elapsed++;r.tick(s);m.tick(s);}};
  return {...h,x,n,m,step,municipal:s.civilization.municipal.nodes.river};
}
test('municipal materials occupy real freight capacity and reach a project buffer exactly once before the cart returns empty',()=>{
  const {s,r,x,n,m,step,municipal}=municipalHarness();assert.equal(m.startProject(s,'river','farmland'),true);
  const before=totals(s),remote=JSON.stringify(n.stores);assert.equal(r.launch(s,'river'),true);const p=x.shipments[0];
  assert.equal(p.purpose,'municipal');assert.equal(p.projectId,1);assert.equal(p.cargo.wood,64);assert.equal(municipal.project.buffer.wood,undefined);assert.equal(JSON.stringify(n.stores),remote);
  let after=totals(s);near(after.wood,before.wood-1);near(after.food,before.food-1);assert.equal(r.arrive(s,{...p,remaining:0}),false);
  r.setRoute(s,'river',false);step(60);assert.equal(municipal.project.buffer.wood,64);assert.equal(p.phase,'empty');assert.equal(Object.keys(p.cargo).length,0);assert.equal(JSON.stringify(n.stores),remote);
  const received=JSON.stringify(municipal.project);assert.equal(r.arrive(s,p),false);assert.equal(m.receiveCargo(s,'river',{wood:64},1),false);assert.equal(JSON.stringify(municipal.project),received);
  r.validate(s);m.validate(s);step(60);assert.equal(x.shipments.length,0);assert.equal(x.routes.river.assigned,0);assert.equal(r.arrive(s,p),false);
  after=totals(s);near(after.wood,before.wood-1);near(after.food,before.food-1);assert.equal(municipal.buildings.farmland,undefined);
});
test('blocked municipal materials return to the home warehouse once without building, crediting the destination or refunding upkeep',()=>{
  const {s,r,x,n,m,step,municipal}=municipalHarness();m.startProject(s,'river','farmland');const home={...s.stores},remote=JSON.stringify(n.stores);
  r.launch(s,'river');const p=x.shipments[0];step(20);r.setRoad(s,'river',false);step(1);assert.equal(p.status,'held');assert.equal(r.returnShipment(s,p.id),true);assert.equal(p.phase,'returning');assert.equal(p.target,'home');assert.equal(p.source,'home');r.validate(s);m.validate(s);
  step(20);assert.equal(x.shipments.length,0);assert.equal(s.stores.wood,home.wood-1);assert.equal(s.stores.food,home.food-1);assert.equal(JSON.stringify(n.stores),remote);assert.equal(Object.keys(municipal.project.buffer).length,0);assert.equal(municipal.project.status,'supplying');assert.equal(r.arrive(s,p),false);assert.equal(x.routes.river.assigned,0);
  r.validate(s);m.validate(s);
});
test('municipal construction alternates with ordinary trade and an old empty cart remains valid after the next project starts',()=>{
  const {s,r,x,n,m,step,municipal}=municipalHarness();m.startProject(s,'river','woodlot');
  assert.equal(r.launch(s,'river'),true);const first=x.shipments[0];assert.equal(first.purpose,'municipal');r.setRoute(s,'river',false);step(120);assert.equal(municipal.project.buffer.wood,64);
  r.setRoute(s,'river',true);assert.equal(r.launch(s,'river'),true);assert.equal(x.shipments[0].purpose,'trade');r.setRoute(s,'river',false);step(121);assert.equal(x.shipments.length,0);assert.equal(x.routes.river.lastPurpose,'trade');
  r.setRoute(s,'river',true);assert.equal(r.launch(s,'river'),true);const last=x.shipments[0];assert.equal(last.purpose,'municipal');assert.equal(last.cargo.wood,16);assert.equal(last.cargo.tools,8);r.setRoute(s,'river',false);step(60);assert.equal(municipal.project.status,'building');assert.equal(Object.values(municipal.project.buffer).some(Boolean),false);
  r.setRoad(s,'river',false);step(120);assert.equal(last.phase,'empty');assert.equal(last.status,'held');assert.equal(municipal.buildings.woodlot,1);assert.equal(municipal.project.status,'complete');assert.equal(m.startProject(s,'river','farmland'),true);assert.equal(municipal.project.id,2);
  r.validate(s);m.validate(s);const local=JSON.stringify(n.stores),home=JSON.stringify(s.stores);assert.equal(r.arrive(s,last),false);r.setRoad(s,'river',true);step(60);
  assert.equal(x.shipments.length,0);assert.equal(JSON.stringify(n.stores),local);assert.equal(JSON.stringify(s.stores),home);assert.equal(municipal.project.status,'supplying');r.validate(s);m.validate(s);
});
test('municipal freight import rejects wrong endpoints, project identities and fabricated nonempty return cargo',()=>{
  const {s,r,x,m}=municipalHarness();m.startProject(s,'river','farmland');r.launch(s,'river');r.validate(s);m.validate(s);
  for(const mutate of [p=>p.target='home',p=>p.source='river',p=>p.projectId=99,p=>p.cargo={iron:7},p=>{p.phase='empty';p.source='river';p.target='home';}]){
    const bad=structuredClone(s);mutate(bad.civilization.regions.shipments[0]);assert.throws(()=>r.validate(bad));
  }
  const p=x.shipments[0];p.remaining=0;r.arrive(s,p);const bad=structuredClone(s);bad.civilization.regions.shipments[0].cargo={wood:1};assert.throws(()=>r.validate(bad));
  const jobs=structuredClone(s);jobs.civilization.regions.nodes.river.workers.miner=1;assert.throws(()=>r.validate(jobs),'new occupations require paid municipal capacity');
});
test('regional births reserve beds only for that destination and release them when its living passengers turn back',()=>{
  const {s,ctx,r,n,m}=municipalHarness();
  for(const file of ['content/urban.js','src/postwar/urban.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  const u=ctx.CivilUrban;n.population=20;n.cohorts=[{age:25,count:20,identity:'human'}];n.stores={food:1000,medicine:100};n.births={scaled:true,credit:.9,mutantCredit:0};r.planWorkers(s,'river',n);
  s.civilization.urban.parties=[{id:1,target:'river',state:'held',cohorts:[{age:24,count:4,identity:'human'}]},{id:2,target:'home',state:'outbound',cohorts:[{age:24,count:8,identity:'human'}]}];
  assert.equal(m.capacity(s,'river'),24);assert.equal(u.reservedBeds(s,'river'),4);assert.equal(u.reservedBeds(s),8);const before={...n.stores};advanceNodeYear(s,r,n);
  assert.equal(n.population,20);assert.equal(n.stores.food,before.food);assert.equal(n.stores.medicine,before.medicine);assert.equal(u.availableBeds(s,'river'),0);
  s.civilization.urban.parties[0].state='returning_people';assert.equal(u.reservedBeds(s,'river'),0);advanceNodeYear(s,r,n);assert.equal(n.population,21);assert.equal(n.cohorts.at(-1).age,0);assert.equal(n.stores.food,before.food-6);near(n.stores.medicine,before.medicine-.2);assert.equal(u.reservedBeds(s),8);r.validate(s);m.validate(s);
});
test('Regions delegates municipal production once and its forecast does not mutate either real warehouse',()=>{
  const {s,r,n,m,municipal}=municipalHarness(),copy=structuredClone(s),home={...s.stores},before=JSON.stringify(s);
  m.forecast(s,'river',[{age:26,count:4,identity:'human'}]);assert.equal(JSON.stringify(s),before);
  m.settleNode(copy,'river');const expected=copy.civilization.regions.nodes.river;
  r.settle(s);assert.equal(JSON.stringify(n.stores),JSON.stringify(expected.stores));assert.equal(n.health,expected.health);assert.equal(JSON.stringify(municipal.economy),JSON.stringify(copy.civilization.municipal.nodes.river.economy));
  for(const key of ['food','wood','tools','medicine','iron','parts'])assert.equal(s.stores[key],home[key]);
});
