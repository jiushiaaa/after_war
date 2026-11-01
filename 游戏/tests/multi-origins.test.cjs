const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),ids=['river_network','old_city_fringe','mountain_settlements'];
const clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)]
  .map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));

// Every population, economy, admission, transport and validator is the shipped module.
// Native display objects alone are inert. The driver follows the adapter's production
// and owner-tick order, without UI events or automatic sixty-second singleton arrivals.
function harness(fixture='natural-first-city.json',initialize=true,saved){
  const s=saved?clone(saved):JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',fixture),'utf8')).state,notes=[];let active=null;
  const ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){}},Events:{activeEvent:()=>active,startEvent:e=>{active=e;},endEvent:()=>{active=null;}},
    $SM:{fireUpdate(){}},AudioEngine:{},Engine:{saveGame(){}},Notifications:{printMessage:x=>notes.push(x)}});
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};ctx.Outside.updateVillage=()=>{};ctx.Outside.updateWorkersView=()=>{};
  if(initialize)ctx.Civilization.initState();
  const h={s,ctx,o:ctx.CivilOrigins,u:ctx.CivilUrban,r:ctx.CivilRegions,m:ctx.CivilMunicipal,notes,get active(){return active;}};
  h.step=seconds=>{for(let j=0;j<seconds;j++){
    s.civilization.elapsed++;s.civilization.productionClock++;
    if(s.civilization.productionClock>=10){s.civilization.productionClock-=10;ctx.Civilization.settleEconomy(s);}
    for(const name of ['CivilSociety','CivilIndustry','CivilRegions','CivilOrigins','CivilMunicipal','CivilServices','CivilUrban'])ctx[name].tick(s);
  }};
  return h;
}
function count(h,cohorts){return h.ctx.CivilPopulation.count(cohorts);}
function assertLedgers(h){
  const {s,o,u}=h;for(const id of ids){const n=s.civilization.origins.nodes[id];assert.equal(n.baselinePopulation+n.born,n.population+n.sourceDeaths+n.transitDeaths+n.admitted+o.inTransit(n),id);}
  const x=s.civilization.urban;assert.equal(count(h,x.source)+x.parties.filter(p=>p.source==='dispersed').reduce((sum,p)=>sum+count(h,p.cohorts),0)+x.admitted+x.deceased,x.registered?480:0);
  o.validate(s);u.validate(s);h.ctx.CivilPlatform.validate(s);
}
function finishLocal(h,type){
  const {s,m,r,ctx}=h,id='river';assert.equal(m.startProject(s,id,type),true,`start ${type}`);
  // Construction fixture fast-forwards only parcel travel; it pays every quoted
  // material, uses real arrival receipts and spends real local builder seconds.
  let q;while((q=m.nextCargo(s,id,64))){
    assert.equal(ctx.CivilRules.pay(s,q.cargo),true);const p={id:s.civilization.regions.nextShipment++,route:id,source:'home',target:id,purpose:'municipal',projectId:q.projectId,cargo:q.cargo,capacity:64,phase:'outbound',status:'moving',remaining:0};
    s.civilization.regions.routes[id].assigned=2;s.civilization.regions.shipments.push(p);assert.equal(r.arrive(s,p),true);p.remaining=0;assert.equal(r.arrive(s,p),true);
  }
  const project=m.data(s,id).project;h.step(ctx.CivilMunicipalContent.facilities[type].duration);assert.equal(project.status,'complete');
}
let readySnapshot;
function ready(){
  if(readySnapshot)return harness(undefined,true,readySnapshot);
  const h=harness(),{s,ctx,u,m}=h,c=s.civilization;
  // Declared economic fixture: legal home capacities and finite stocks. No gate,
  // source ledger, migration callback or service check is stubbed.
  Object.assign(s.game.buildings,{hut:4,longhouse:4,residential:8,blockhousing:4,publicclinic:8,publicschool:4,irrigatedfield:6,toolworks:2,farm:4,mine:4,coalpit:4,furnace:4,machineworks:2,powerhouse:2,cartdepot:2});
  s.game.workers={farmer:60,medic:36,teacher:20,smith:8,salvager:20,miner:4,collier:6,smelter:6,machinist:4,electrician:4,transporter:12};
  for(const key of ctx.CivilCatalog.resources)s.stores[key]=50000;
  c.urban.enabled=false;for(const [id,route]of Object.entries(c.regions.routes)){route.enabled=false;if(!c.regions.shipments.some(p=>p.route===id))route.assigned=0;}
  h.step(240);assert.equal(c.urban.parties.length,0);assert.equal(c.regions.shipments.length,0);
  assert.equal(m.activate(s,'river'),true);for(const key of ctx.CivilCatalog.resources)c.regions.nodes.river.stores[key]=1000;
  for(const type of ['farmland','clinic','school','residential'])finishLocal(h,type);
  for(const id of ['old_city_fringe','mountain_settlements']){
    assert.equal(h.o.beginContact(s,id),true,`contact ${id}`);h.step(ctx.CivilOriginContent[id].contactDuration);assert.equal(h.o.agree(s,id),true,`agree ${id}`);
  }
  c.urban.enabled=false;assertLedgers(h);readySnapshot=clone(s);return h;
}
function dispatch(h,source,target){
  const x=h.s.civilization.urban;x.activeSource=source;assert.equal(h.u.setTarget(h.s,target),true);x.enabled=true;
  assert.equal(h.u.dispatch(h.s),true,`${source} → ${target}: ${x.status}`);x.enabled=false;return x.parties.at(-1);
}

test('schema-one natural sources gain two new models once without replaying old residents, stores, receipts or the 480 ledger',()=>{
  for(const fixture of ['natural-origin-migration.json','natural-municipal-construction.json']){
    const h=harness(fixture,false),{s,o,ctx}=h,c=s.civilization,old=clone(c.origins),home=JSON.stringify([s.game,s.stores,c.urban,c.society,c.regions,c.municipal]);
    assert.equal(old.schema,1);ctx.CivilPlatform.validate(s);o.init(s);
    assert.equal(c.origins.schema,2);assert.deepEqual(Object.keys(c.origins.nodes).sort(),[...ids].sort());
    assert.equal(JSON.stringify([s.game,s.stores,c.urban,c.society,c.regions,c.municipal]),home);
    const river=c.origins.nodes.river_network;
    for(const [key,value]of Object.entries(old.nodes.river_network)){
      if(key==='departures'){for(const [receipt,d]of Object.entries(value))for(const [field,v]of Object.entries(d))assert.deepEqual(clone(river.departures[receipt][field]),v);}
      else assert.deepEqual(clone(river[key]),value,key);
    }
    assert.equal(river.introducedAt,old.introducedAt);
    for(const [id,population]of [['old_city_fringe',2000],['mountain_settlements',1600]]){
      const n=c.origins.nodes[id];assert.equal(n.introducedAt,c.elapsed);assert.equal(n.year,Math.floor(c.elapsed/600));assert.equal(n.population,population);assert.equal(n.born,0);assert.equal(n.sourceDeaths,0);assert.equal(n.admitted,0);assert.equal(n.status,'unknown');
    }
    const once=JSON.stringify(s);o.init(s);assert.equal(JSON.stringify(s),once);ctx.CivilPlatform.validate(s);
    const loaded=clone(s);o.init(loaded);assert.equal(JSON.stringify(loaded),once);ctx.CivilPlatform.validate(loaded);
  }
});

test('schema-two corruption cannot silently reseed a missing or malformed source',()=>{
  const h=harness(),{s,o,ctx}=h;assert.equal(s.civilization.origins.schema,2);
  for(const mutate of [x=>delete x.nodes.old_city_fringe,x=>x.nodes.mountain_settlements=null,x=>x.nodes.extra=clone(x.nodes.river_network),x=>delete x.nodes.old_city_fringe.introducedAt,x=>x.nodes.old_city_fringe.baselinePopulation++]){
    const bad=clone(s);mutate(bad.civilization.origins);const before=JSON.stringify(bad.civilization.origins);o.init(bad);assert.equal(JSON.stringify(bad.civilization.origins),before);assert.throws(()=>ctx.CivilPlatform.validate(bad));
  }
});

test('a 480-second messenger is source-funded, paused by source shortage, and is a valid serializable in-flight task',()=>{
  const h=harness(),{s,o,ctx}=h,id='old_city_fringe',n=s.civilization.origins.nodes[id];
  // Finish the fixture's existing paid passengers before isolating messenger
  // labor; no later admission may silently supply the deliberately empty home.
  s.civilization.urban.enabled=false;h.step(240);assert.equal(s.civilization.urban.parties.length,0);
  s.game.population=0;s.game.workers={};s.civilization.society.cohorts=[];s.civilization.urban.enabled=false;
  const home=JSON.stringify(s.stores),other=JSON.stringify(s.civilization.origins.nodes.mountain_settlements),food=n.stores.food,tools=n.stores.tools;
  assert.equal(o.discoverable(s,id),true);assert.equal(o.beginContact(s,id),true);near(food-n.stores.food,12);near(tools-n.stores.tools,1);assert.equal(JSON.stringify(s.stores),home);assert.equal(JSON.stringify(s.civilization.origins.nodes.mountain_settlements),other);
  assert.equal(s.civilization.origins.contactTrip.remaining,480);assert.equal(o.reservedLabor(s),0);assert.equal(o.sourceStaff(s,id),2);ctx.CivilPlatform.validate(s);
  assert.equal(o.beginContact(s,'mountain_settlements'),false);n.health=0;h.step(5);assert.equal(s.civilization.origins.contactTrip.remaining,480);n.health=80;
  h.step(1);assert.equal(s.civilization.origins.contactTrip.remaining,479);o.tick(s);assert.equal(s.civilization.origins.contactTrip.remaining,479,'a repeated callback at the same second cannot advance contact');
  const resumed=harness(undefined,true,s);resumed.step(478);assert.equal(resumed.s.civilization.origins.nodes[id].status,'contacting');resumed.step(1);
  assert.equal(resumed.s.civilization.origins.nodes[id].status,'contacted');assert.equal(resumed.s.game.population,0);assert.equal(resumed.s.civilization.origins.contactTrip,null);assertLedgers(resumed);
});

test('two real Urban crews keep different sources and destinations while sharing one global crew and fare budget',()=>{
  const h=ready(),{s,o,u}=h,x=s.civilization.urban;
  // Keep this fare/arrival check inside one demographic year; annual behavior has
  // its own real two-source test below. Waiting still runs every owning controller.
  if(s.civilization.elapsed%600+360>=600)h.step(600-s.civilization.elapsed%600+1);
  const home=s.game.population,local=s.civilization.regions.nodes.river.population,legacy=x.admitted,stores={...s.stores};
  const a=dispatch(h,'old_city_fringe','home'),originalA=clone(a);
  near(stores.food-s.stores.food,48);near(stores.medicine-s.stores.medicine,1.6);near(stores.tools-s.stores.tools,1.6);
  x.activeSource='mountain_settlements';u.setTarget(s,'river');x.enabled=true;
  const waiting=JSON.stringify([s.stores,x.parties,x.nextParty,s.civilization.origins.nodes,s.civilization.passenger]);assert.equal(u.dispatch(s),false);assert.equal(JSON.stringify([s.stores,x.parties,x.nextParty,s.civilization.origins.nodes,s.civilization.passenger]),waiting,'changing either selector cannot bypass the global departure interval');x.enabled=false;
  h.step(120);assert.equal(a.state,'returning');assert.equal(s.game.population,home+8);
  const secondStores={...s.stores},b=dispatch(h,'mountain_settlements','river'),originalB=clone(b);
  assert.equal(b.transport.departedAt-a.transport.departedAt,120);assert.notEqual(a.id,b.id);assert.equal(count(h,a.cohorts),0);assert.equal(count(h,b.cohorts),8);assert.equal(u.reservedTransport(s),4);assert.equal(u.reservedBeds(s,'home'),0);assert.equal(u.reservedBeds(s,'river'),8);
  near(secondStores.food-s.stores.food,48);near(secondStores.medicine-s.stores.medicine,1.6);near(secondStores.tools-s.stores.tools,1.6);
  x.enabled=true;
  const assets=()=>JSON.stringify([s.stores,x.parties,x.nextParty,s.civilization.origins.nodes]);
  const before=assets();assert.equal(u.dispatch(s),false);assert.equal(assets(),before,'the enabled plan cannot pay or reserve a third crew');
  assert.match(x.status,/等待/);x.enabled=false;
  x.activeSource='old_city_fringe';u.setTarget(s,'home');assert.equal(b.source,'mountain_settlements');assert.equal(b.target,'river');
  h.step(120);
  assert.equal(s.game.population,home+8);assert.equal(s.civilization.regions.nodes.river.population,local+8);assert.equal(x.admitted,legacy);
  assert.equal(s.civilization.origins.nodes.old_city_fringe.admitted,8);assert.equal(s.civilization.origins.nodes.mountain_settlements.admitted,8);
  const once=JSON.stringify([s.game,s.civilization.regions.nodes.river.population]);assert.equal(o.recordArrival(s,originalA),false);assert.equal(o.recordArrival(s,originalB),false);assert.equal(JSON.stringify([s.game,s.civilization.regions.nodes.river.population]),once);
  h.step(120);assert.equal(x.parties.length,0);assert.equal(u.reservedTransport(s),0);assertLedgers(h);
});

test('global party identities cannot be reused across sources, including already-closed historical receipts',()=>{
  const h=ready(),{s,o}=h,a=dispatch(h,'old_city_fringe','home');
  const q=o.quoteParty(s,'mountain_settlements',8,{mode:'convoy'}),before=JSON.stringify(s);assert.equal(o.commitDeparture(s,q,a.id,'river'),false);assert.equal(JSON.stringify(s),before);
  h.step(120);const b=dispatch(h,'mountain_settlements','river');h.step(240);assertLedgers(h);
  const bad=clone(s),node=bad.civilization.origins.nodes.mountain_settlements,d=node.departures['p'+b.id];delete node.departures['p'+b.id];d.partyId=a.id;node.departures['p'+a.id]=d;
  assert.throws(()=>o.validate(bad),'even two closed, individually balanced source receipts may not share an Urban party ID');
});

test('Urban alone ages passengers from two sources and a reversed party returns to its recorded source after selection changes',()=>{
  const h=ready(),{s,o,u,ctx}=h,x=s.civilization.urban;
  h.step((600-s.civilization.elapsed%600-121+600)%600);
  for(const id of ['old_city_fringe','mountain_settlements'])s.civilization.origins.nodes[id].cohorts.sort((a,b)=>(b.age===79)-(a.age===79));
  const a=dispatch(h,'old_city_fringe','river'),originalA=clone(a);h.step(30);
  s.civilization.regions.routes.river.condition='closed';h.step(90);assert.equal(a.state,'held');assert.equal(a.remaining,90);assert.equal(a.heldFor,90);
  const b=dispatch(h,'mountain_settlements','home'),original=[originalA,clone(b)];assert.equal(b.transport.departedAt-a.transport.departedAt,120);h.step(1);
  for(const [index,p]of [a,b].entries()){
    const expected=ctx.CivilPopulation.age(original[index].cohorts);assert.equal(expected.deceased,1);assert.deepEqual(clone(p.cohorts),clone(expected.cohorts));assert.equal(s.civilization.origins.nodes[p.source].transitDeaths,1);
  }
  const ages=JSON.stringify(x.parties.map(p=>p.cohorts));for(const id of ids)o.annual(s,id);u.tick(s);assert.equal(JSON.stringify(x.parties.map(p=>p.cohorts)),ages);
  const target=b.target,source=b.source,identity=clone(b.cohorts),beforeReturn=s.civilization.origins.nodes[source].population;
  x.activeSource='old_city_fringe';u.setTarget(s,'river');assert.equal(u.returnParty(s,b.id),true);assert.equal(b.target,target);assert.equal(b.source,source);assert.equal(u.reservedBeds(s,'home'),0);assert.equal(u.reservedBeds(s,'river'),7);
  h.step(b.remaining);assert.equal(s.civilization.origins.nodes[source].population,beforeReturn+7);
  for(const c of identity){const returned=s.civilization.origins.nodes[source].cohorts.find(v=>v.cohortId===c.cohortId);assert.ok(returned);assert.equal(returned.age,c.age);assert.equal(returned.identity,c.identity);}
  assert.equal(s.civilization.origins.nodes[source].departures['p'+b.id].status,'returned');assert.equal(o.returnPeople(s,b),false);assertLedgers(h);
});

test('dynamic contact and agreement events validate only for their named source and survive reload',()=>{
  const h=harness(),{s,o,ctx}=h,id='old_city_fringe';s.civilization.urban.enabled=false;
  assert.equal(o.beginContact(s,id),true);h.step(480);const eventId='originContact_'+id;assert.equal(o.nextEvent(s),eventId);
  s.civilization.pending=eventId;ctx.CivilPlatform.validate(s);const loaded=clone(s);o.init(loaded);ctx.CivilPlatform.validate(loaded);
  ctx.Civilization.showPending();assert.match(h.active.title,/旧城/);assert.ok(h.active.scenes.start.text.join('').includes('旧城'));
  const invalid=clone(s);invalid.civilization.pending='originContact_unknown';assert.throws(()=>ctx.CivilPlatform.validate(invalid));
  const food=s.stores.food,sourceStock={...s.civilization.origins.nodes[id].stores},homeKnowledge=s.stores.knowledge;
  assert.equal(o.agree(s,id),true);near(homeKnowledge-s.stores.knowledge,20);near(sourceStock.wood-s.civilization.origins.nodes[id].stores.wood,10);near(sourceStock.knowledge-s.civilization.origins.nodes[id].stores.knowledge,10);assert.equal(s.stores.food,food);
  const paid=JSON.stringify(s);assert.equal(o.agree(s,id),false);assert.equal(JSON.stringify(s),paid);
});

test('real native agreement callbacks recheck both independent warehouses before charging either source',()=>{
  const h=harness(),{s,o,ctx}=h;s.civilization.urban.enabled=false;
  for(const id of ['old_city_fringe','mountain_settlements']){
    assert.equal(o.beginContact(s,id),true);h.step(480);const n=s.civilization.origins.nodes[id],other=ids.filter(x=>x!==id);
    const show=()=>{s.civilization.pending='originAgreement_'+id;ctx.CivilPlatform.validate(s);ctx.Civilization.showPending();assert.equal(h.active.title,ctx.CivilOriginContent[id].name+'迁居登记');return h.active.scenes.start.buttons.agree.onChoose;};
    for(const [stock,key]of [[s.stores,'knowledge'],[n.stores,'wood'],[n.stores,'knowledge']]){
      const choose=show(),available=stock[key];stock[key]=0;
      const before=JSON.stringify([s.stores,s.civilization.origins.nodes]);choose();ctx.Events.endEvent(); // Native nextScene:'end' closes this inert display.
      assert.equal(JSON.stringify([s.stores,s.civilization.origins.nodes]),before,'a stale button cannot partly charge either warehouse');
      assert.equal(s.civilization.pending,null);assert.match(h.notes.at(-1),/本次未扣款/);assert.equal(n.status,'contacted');stock[key]=available;
    }
    const otherBefore=JSON.stringify(other.map(x=>s.civilization.origins.nodes[x])),knowledge=s.stores.knowledge,wood=n.stores.wood,sourceKnowledge=n.stores.knowledge;
    show()();ctx.Events.endEvent();near(knowledge-s.stores.knowledge,20);near(wood-n.stores.wood,10);near(sourceKnowledge-n.stores.knowledge,10);
    assert.equal(JSON.stringify(other.map(x=>s.civilization.origins.nodes[x])),otherBefore);assert.equal(n.status,'agreed');assert.equal(s.civilization.pending,null);assertLedgers(h);
  }
});
