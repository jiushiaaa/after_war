const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone,near,census}=require('./helpers/metro-fixture.cjs');
const natural=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-second-city.json'),'utf8')).state;
const heat=h=>h.ctx.CivilHeating;
function nextProduction(h){const at=h.s.civilization.urban.economy.at;h.until(()=>h.s.civilization.urban.economy.at>at,11);}
function build(h,id='home',kind='heatingplant'){
  const owner=kind==='residential'?h.m:h.v,def=(kind==='residential'?h.ctx.CivilMunicipalContent:h.ctx.CivilServiceContent).facilities[kind];
  const before={...h.s.stores};assert.equal(owner.startProject(h.s,id,kind),true,`start ${id} ${kind}`);
  const p=owner.data(h.s,id).project;
  if(id==='home'){for(const [key,n]of Object.entries(def.cost))near(h.s.stores[key],before[key]-n,`construction ${key}`);h.s.game.workers.servicebuilder=2;}
  h.until(()=>p.status==='complete',5000);
  if(kind==='heatingplant'){assert.equal(p.workedSeconds,300);assert.deepEqual(clone(p.paid),clone(def.cost));assert.equal(p.remaining,0);assert.ok(p.lastWorkedAt-p.startedAt>=300);}
  return p;
}

// This branch starts from the unchanged natural second-city export. New research,
// all stations and local material trips are paid through their actual owners.
// Turning the migration switch off and assigning builders are player actions.
// It is a rule-driven continuation, not a claim of browser completion.
let homeSnapshot;
function builtHome(){
  if(!homeSnapshot){const h=harness(natural),{s,ctx}=h;s.civilization.urban.enabled=false;
    assert.equal(s.civilization.heating,undefined);assert.equal(ctx.CivilCatalog.researchAvailable(s,'district_heating'),true);
    const before={...s.stores},cost=ctx.CivilText.research.district_heating.cost;ctx.Civilization.research('district_heating');
    assert.equal(s.civilization.research.id,'district_heating');for(const [key,n]of Object.entries(cost))near(s.stores[key],before[key]-n,`research ${key}`);
    h.until(()=>s.civilization.tech.district_heating,400);build(h);build(h);s.game.workers.heatingworker=4;nextProduction(h);
    assert.equal(heat(h).capacity(s),1200);h.roundtrip();homeSnapshot=clone(s);
  }return harness(homeSnapshot);
}
let localSnapshot;
function builtLocal(){
  if(!localSnapshot){const h=builtHome();build(h,'river');nextProduction(h);assert.equal(heat(h).capacity(h.s,'river'),600);
    assert.ok(h.v.data(h.s,'river').completed.at(-1).receipts.length>=3,'the actual freight route delivers multiple paid parcels');
    build(h,'river','residential');nextProduction(h);assert.ok(h.u.availableBeds(h.s,'river')>=24);h.roundtrip();localSnapshot=clone(h.s);
  }return harness(localSnapshot);
}
function handedHome(){const h=builtHome();assert.equal(heat(h).handoverReason(h.s),null);assert.equal(heat(h).handover(h.s),true);return h;}

test('old natural assets remain unchanged and no station creates a heating ledger before paid completion',()=>{
  const h=harness(natural),s=h.s;assert.equal(s.civilization.heating,undefined);assert.equal(heat(h).covered(s),true);
  for(const key of ['game','stores'])assert.deepEqual(clone(s[key]),natural[key]);
  const before=JSON.stringify(s);assert.equal(heat(h).ensure(s),null);assert.equal(heat(h).handover(s),false);assert.equal(heat(h).setManual(s,'home',true),false);assert.equal(JSON.stringify(s),before);h.roundtrip();
  const built=builtHome();assert.equal(built.v.data(built.s).buildings.heatingplant,2);assert.equal(built.s.game.workers.servicebuilder,0);
  const completed=built.v.data(built.s).completed.filter(x=>x.type==='heatingplant');assert.equal(completed.length,2);
  assert.equal(heat(built).data(built.s).introducedAt,completed[0].completedAt);assert.equal(heat(built).handed(built.s),false);
  assert.equal(built.ctx.CivilRules.rates(built.s)['工匠'].wood,2,'trial operation does not silently retire the original income');
});

test('construction needs two actual adults and exactly 300 paid work seconds, without replaying duplicate ticks',()=>{
  const h=builtHome(),s=h.s;assert.equal(h.v.startProject(s,'home','heatingplant'),true);const p=h.v.data(s).project;
  s.game.workers.servicebuilder=1;h.step(17);assert.equal(p.workedSeconds,0);assert.equal(p.remaining,300);assert.equal(h.v.data(s).buildings.heatingplant,2);
  s.game.workers.servicebuilder=2;h.step(299);assert.equal(p.workedSeconds,299);assert.equal(p.remaining,1);const before=JSON.stringify(s);h.v.tick(s);assert.equal(JSON.stringify(s),before);
  const loaded=h.roundtrip();loaded.step(1);const done=loaded.v.data(loaded.s).project;assert.equal(done.workedSeconds,300);assert.equal(done.status,'complete');assert.equal(loaded.v.data(loaded.s).buildings.heatingplant,3);loaded.roundtrip();
});

test('a station completed after production in the same second preserves the legitimate earlier receipt through save and reload',()=>{
  const h=builtHome(),s=h.s;nextProduction(h);const start=s.civilization.elapsed;assert.equal(s.civilization.productionClock,0);
  assert.equal(h.v.startProject(s,'home','heatingplant'),true);s.game.workers.servicebuilder=2;h.step(300);
  const d=heat(h).data(s),completed=h.v.data(s).completed.at(-1);assert.equal(completed.completedAt,start+300);assert.equal(d.economy.at,completed.completedAt);
  assert.equal(d.economy.stations,2,'the production owner ran before the third station completed');assert.equal(h.v.data(s).buildings.heatingplant,3);
  const loaded=h.roundtrip();nextProduction(loaded);assert.equal(heat(loaded).data(loaded.s).economy.stations,3);loaded.roundtrip();
});

test('two real electric stations pay one coal and parts ledger and share the existing instantaneous power pool',()=>{
  const h=builtHome(),s=h.s;nextProduction(h);const e=heat(h).data(s).economy,last=h.settlements.at(-1);
  assert.equal(e.capacity,1200);assert.equal(e.workers,4);assert.equal(e.used,2);assert.equal(e.demand,2);near(e.cost.coal,1.6);near(e.cost.parts,.04);
  near(last.flow['供热工'].coal,-1.6);near(last.flow['供热工'].parts,-.04);assert.equal(Object.keys(last.flow['供热工']).length,2);
  assert.ok(s.civilization.industry.used<=s.civilization.industry.generation);assert.ok(h.v.data(s).economy.used>=e.used);
  assert.equal(s.stores.heat,undefined);assert.equal(heat(h).data(s).stores,undefined);assert.equal(heat(h).data(s).population,undefined);
  const before=JSON.stringify(s),preview=heat(h).forecast(s,'home');heat(h).forecast(s,'home');assert.equal(JSON.stringify(s),before);assert.equal(heat(h).capacity(preview.copy),1200);
  assert.deepEqual(clone(heat(h).run(s,'home',{run(){throw Error('duplicate service payment');},powerAvailable:100})),{used:0,demand:0,capacity:0});assert.equal(JSON.stringify(s),before);
  h.roundtrip();
});

test('explicit handover requires current and next paid coverage, retires only fixed artisan wood and survives exact reload',()=>{
  const h=builtHome(),s=h.s;const gatherers=h.ctx.CivilRules.rates(s)['采木工'].wood,at=s.civilization.elapsed;
  assert.equal(heat(h).handoverReason(s),null);assert.equal(heat(h).handover(s),true);assert.equal(heat(h).data(s).handedOverAt,at);assert.equal(heat(h).data(s).handover.population,s.game.population);
  assert.equal(h.ctx.CivilRules.rates(s)['工匠'].wood,0);near(h.ctx.CivilRules.rates(s)['采木工'].wood,gatherers);
  const before=JSON.stringify(s);assert.equal(heat(h).handover(s),false);assert.equal(JSON.stringify(s),before);h.roundtrip();
  const stopped=builtHome();stopped.s.game.workers.heatingworker=0;assert.match(heat(stopped).handoverReason(stopped.s),/下一轮/);assert.equal(heat(stopped).handover(stopped.s),false);
  const short=builtHome();short.s.stores.coal=.1;short.s.game.workers.collier=0;assert.notEqual(heat(short).handoverReason(short.s),null);assert.equal(heat(short).handed(short.s),false);
});

test('real fuel, maintenance, power and labor shortages remove heat; manual operation pays more fuel for half capacity',()=>{
  // Each negative changes only real staff or inventory, never the heat receipt.
  for(const shortage of ['coal','parts','power','workers']){
    const h=handedHome(),s=h.s;
    if(shortage==='coal'){s.stores.coal=0;s.game.workers.collier=0;}
    if(shortage==='parts')s.stores.parts=0;
    if(shortage==='power'){s.game.workers.electrician=0;s.game.workers.utilityworker=0;}
    if(shortage==='workers')s.game.workers.heatingworker=1;
    nextProduction(h);assert.equal(heat(h).capacity(s),0,shortage);assert.equal(heat(h).covered(s),false);assert.match(heat(h).growthReason(s),/供暖/);assert.equal(heat(h).data(s).economy.cost.coal,0);assert.equal(heat(h).data(s).economy.cost.parts,0);
  }
  const h=handedHome(),s=h.s;assert.equal(heat(h).setManual(s,'home',true),true);s.game.workers.heatingworker=8;s.game.workers.electrician=0;s.game.workers.utilityworker=0;nextProduction(h);
  const e=heat(h).data(s).economy;assert.equal(e.mode,'manual');assert.equal(e.workers,8);assert.equal(e.capacity,600);assert.equal(e.used,0);assert.equal(e.demand,0);near(e.cost.coal,2.4);near(e.cost.parts,.04);assert.equal(heat(h).covered(s),false);h.roundtrip();
});

test('paid emergency work lasts 120 seconds, cannot be stacked and never covers a city or a convoy',()=>{
  const h=handedHome(),s=h.s;s.game.workers.heatingworker=0;nextProduction(h);const wood=s.stores.wood,at=s.civilization.elapsed;
  assert.equal(heat(h).emergency(s),true);near(s.stores.wood,wood-5);assert.equal(heat(h).workshopReady(s),true);assert.equal(heat(h).covered(s),false);assert.equal(heat(h).recoveryReady(s),false);
  const before=JSON.stringify(s);assert.equal(heat(h).emergency(s),false);assert.equal(JSON.stringify(s),before);
  // An explicitly synthetic depopulation tests the recovery ceiling, not an earned death event.
  s.game.population=19;s.civilization.society.cohorts=census(19);s.game.workers={};assert.equal(heat(h).recoveryReady(s,1),true);assert.equal(heat(h).recoveryReady(s,2),false);assert.notEqual(heat(h).growthReason(s,'home',24),null);
  s.game.population=20;s.civilization.society.cohorts=census(20);assert.equal(heat(h).recoveryReady(s,1),false);
  s.civilization.elapsed=at+119;assert.equal(heat(h).emergencyActive(s),true);s.civilization.elapsed=at+120;assert.equal(heat(h).emergencyActive(s),false);assert.equal(heat(h).workshopReady(s),false);
});

test('a paid emergency restores at most twenty actual source singletons and never admits one beyond that ceiling',()=>{
  const h=handedHome(),s=h.s;s.game.workers.heatingworker=0;nextProduction(h);
  // Explicit boundary fixture: loss of the local population, with the source
  // ledger and every subsequent arrival left to their real owners.
  s.game.population=0;s.civilization.society.cohorts=[];s.game.workers=Object.fromEntries(Object.keys(s.game.workers).map(job=>[job,0]));s.game.temperature.value=0;
  assert.equal(heat(h).emergency(s),true);const source=s.civilization.origins.nodes[h.u.sourceId(s)],admitted=source.admitted,food=s.stores.food;
  for(let n=1;n<=20;n++){assert.equal(h.u.handleArrival(s),true);assert.equal(s.game.population,n);assert.equal(source.admitted,admitted+n);}
  near(s.stores.food,food-120);assert.equal(heat(h).covered(s),false);assert.equal(heat(h).recoveryReady(s),false);
  const full=JSON.stringify(s);assert.equal(h.u.handleArrival(s),true);assert.equal(JSON.stringify(s),full);h.roundtrip();
  Object.assign(s.game.workers,{farmer:4,medic:2,teacher:1,transporter:10});s.civilization.urban.enabled=true;h.u.setTarget(s,'home');
  const beforeQuote=JSON.stringify(s),plan=h.ctx.CivilPassenger.quote(s);assert.match(plan.reason,/供暖/);assert.equal(JSON.stringify(s),beforeQuote);
  const stock=clone(s.stores),next=s.civilization.urban.nextParty;assert.equal(h.u.dispatch(s),false);assert.deepEqual(clone(s.stores),stock);assert.equal(s.civilization.urban.nextParty,next,'emergency singletons do not grant a batch transport exemption');
});

test('normal singleton arrivals respect heat already reserved by a real outgoing passenger group',()=>{
  const h=builtHome(),s=h.s;
  // Declared population boundary: one active station supplies exactly 600;
  // all travel, source identities and paid heat below are generated normally.
  s.game.population=592;s.civilization.society.cohorts=census(592);s.game.workers.heatingworker=2;nextProduction(h);
  assert.equal(heat(h).capacity(s),600);assert.equal(heat(h).handover(s),true);
  s.civilization.urban.enabled=true;s.civilization.passenger.preference='small';h.u.setTarget(s,'home');assert.equal(h.u.dispatch(s),true,s.civilization.urban.status);
  const party=s.civilization.urban.parties.find(p=>p.target==='home');assert.equal(h.u.count(party.cohorts),8);assert.equal(h.u.reservedBeds(s),8);
  const before=JSON.stringify(s);assert.equal(h.u.handleArrival(s),true);assert.equal(JSON.stringify(s),before,'a singleton cannot spend the eight passengers’ paid heat allocation');
  s.civilization.urban.enabled=false;h.until(()=>party.state==='returning',125);assert.equal(s.game.population,600);assert.equal(party.cohorts.length,0,'actual arrival does not count this same party twice');h.roundtrip();
});

test('local heat uses real parcel construction, local labor, local coal and local power rather than the home station',()=>{
  const h=builtLocal(),s=h.s,id='river',local=h.m.node(s,id),d=heat(h).data(s,id);
  assert.equal(d.economy.capacity,600);assert.equal(d.economy.workers,2);assert.equal(heat(h).handover(s,id),true);assert.equal(heat(h).handed(s),false);
  const home=clone(heat(h).data(s));assert.equal(heat(h).setManual(s,id,true),true);nextProduction(h);
  assert.equal(local.workers.heatingworker,4);assert.equal(heat(h).capacity(s,id),300);assert.equal(heat(h).covered(s,id),false);assert.equal(heat(h).capacity(s),1200);
  assert.equal(heat(h).data(s).manual,home.manual);assert.match(h.m.serviceCheck(s,id,[]),/供暖/);assert.equal(h.ctx.CivilRules.rates(s)['工匠'].wood,2,'local handover never retires the home room');h.roundtrip();
});

test('local admission forecasts the actual children and older people instead of staffing the next heater with invented adults',()=>{
  const h=builtLocal(),s=h.s,id='river',n=h.m.node(s,id);assert.equal(heat(h).handover(s,id),true);
  // Explicit age boundary on paid assets: the current heat receipt remains real,
  // while the next production must use these residents and these exact arrivals.
  n.population=400;n.cohorts=[{age:30,count:95,identity:'human'},{age:70,count:305,identity:'human'}];h.m.planWorkers(s,id);
  const incoming=[{age:25,count:5,identity:'human'},{age:5,count:2,identity:'human'},{age:65,count:1,identity:'human'}],before=JSON.stringify(s);
  const actual=h.m.forecast(s,id,incoming),invented=h.m.forecast(s,id,[{age:25,count:8,identity:'human'}]);
  assert.equal(heat(h).capacity(s,id),600);assert.equal(heat(h).capacity(actual.copy,id),0);assert.equal(heat(h).capacity(invented.copy,id),600);
  assert.equal(actual.education,true);assert.equal(actual.treatment,true);assert.ok(actual.food>=0);assert.ok(actual.medicine>=0);
  assert.match(h.m.serviceCheck(s,id,incoming),/下一轮供暖/);assert.equal(JSON.stringify(s),before);assert.doesNotThrow(()=>h.ctx.CivilPlatform.validate(s));
});

test('handover includes a genuinely dispatched family age roster and cannot borrow working adults from its children or elder',()=>{
  const h=builtLocal(),s=h.s,id='river',n=h.m.node(s,id);
  n.population=400;n.cohorts=[{age:30,count:95,identity:'human'},{age:70,count:305,identity:'human'}];h.m.planWorkers(s,id);
  s.civilization.passenger.preference='small';s.civilization.urban.enabled=true;h.u.setTarget(s,id);
  assert.equal(h.u.dispatch(s),true,s.civilization.urban.status);const p=s.civilization.urban.parties.find(p=>p.target===id);
  assert.equal(h.u.count(p.cohorts),8);assert.equal(h.ctx.CivilPopulation.workforce(p.cohorts),5);assert.equal(heat(h).capacity(s,id),600);
  const real=h.m.forecast(s,id,p.cohorts);assert.equal(heat(h).capacity(real.copy,id),0);const before=JSON.stringify(s);
  assert.match(heat(h).handoverReason(s,id),/下一轮/);assert.equal(heat(h).handover(s,id),false);assert.equal(JSON.stringify(s),before);h.roundtrip();
});

test('a genuinely dispatched party is held after destination heat fails and returns to its original source without admission',()=>{
  const h=builtLocal(),s=h.s,id='river';assert.equal(heat(h).handover(s,id),true);s.civilization.urban.enabled=true;h.u.setTarget(s,id);
  assert.equal(h.u.dispatch(s),true,s.civilization.urban.status);const p=s.civilization.urban.parties.find(x=>x.target===id),source=s.civilization.origins.nodes[p.source],receipt=source.departures['p'+p.id],admitted=source.admitted;
  assert.ok(p.cohorts.length>0);s.civilization.urban.enabled=false;assert.equal(heat(h).setManual(s,id,true),true);
  h.until(()=>p.state==='held',125);assert.equal(p.holdReason,'services');assert.equal(source.admitted,admitted);assert.equal(receipt.status,'travel');h.roundtrip();
  h.until(()=>p.state==='returning_people',121);assert.ok(h.u.count(p.cohorts)>0);h.until(()=>!s.civilization.urban.parties.some(x=>x.id===p.id),125);
  assert.equal(source.admitted,admitted);assert.equal(receipt.status,'returned');assert.ok(receipt.alive>0);h.roundtrip();
});

test('strict heating and construction validation rejects counterfeit coverage, costs, work or lost ledgers',()=>{
  const h=handedHome(),base=clone(h.s),reject=mutate=>{const s=clone(base);mutate(s);assert.throws(()=>h.ctx.CivilPlatform.validate(s));};
  reject(s=>{delete s.civilization.heating;});reject(s=>{s.civilization.heating=null;});reject(s=>{s.civilization.heating.nodes.home.economy.capacity++;});
  reject(s=>{s.civilization.heating.nodes.home.economy.cost.coal=0;});reject(s=>{s.civilization.heating.nodes.home.handover.proof.capacity=99999;});
  reject(s=>{s.civilization.heating.nodes.home.introducedAt--;});reject(s=>{s.civilization.services.nodes.home.completed.find(x=>x.type==='heatingplant').workedSeconds=299;});
  reject(s=>{s.civilization.services.nodes.home.completed.find(x=>x.type==='heatingplant').paid.steel=0;});
  const local=builtLocal(),bad=clone(local.s);bad.civilization.services.nodes.river.completed.find(x=>x.type==='heatingplant').receipts=[];assert.throws(()=>local.ctx.CivilPlatform.validate(bad));
});
