const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const natural=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-second-city.json'),'utf8')).state;
const incident=h=>h.ctx.CivilIncidents;
function drive(h,seconds){for(let i=0;i<seconds;i++){h.step(1,{choose:false});if(h.active&&h.s.civilization.pending!=='roadIncident')h.chooseRoutine();}}
function until(h,predicate,limit=6000){for(let i=0;i<limit&&!predicate();i++)drive(h,1);assert.ok(predicate(),`natural incident condition not reached: ${incident(h).status(h.s)}`);}
function open(h){if(h.active)return;h.s.civilization.pending='roadIncident';h.ctx.Civilization.showPending();}
function choose(h,key){open(h);h.click(key);}
let first;
function warning(){
  if(!first){const h=harness(natural);until(h,()=>!!incident(h).active(h.s));first=clone(h.s);}
  const h=harness(first);open(h);return h;
}
let second;
function nextWarning(){
  if(!second){const h=warning();choose(h,'repair');until(h,()=>incident(h).data(h.s).records.length===2);second=clone(h.s);}
  const h=harness(second);open(h);return h;
}
let beds;
function localBeds(){
  if(!beds){const h=warning(),id=incident(h).active(h.s).route;assert.equal(h.m.startProject(h.s,id,'residential'),true);
    until(h,()=>h.m.data(h.s,id).project.status==='complete');beds=clone(h.s);}
  const h=harness(beds);open(h);return h;
}

test('the unchanged natural road-closure export reloads exactly, retains the completed drain and supports one native paid repair',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-road-closure.json'),'utf8')).state,h=harness(raw),d=incident(h).data(h.s),r=incident(h).active(h.s);
  assert.equal(raw.civilization.elapsed,103093);assert.deepEqual(clone(h.s),raw);assert.equal(r.route,'highland');assert.equal(r.createdAt,102608);assert.equal(r.choice,'hold');assert.equal(r.chosenAt,102927);assert.equal(r.closedAt,102999);assert.equal(r.phase,'closed');
  assert.equal(h.s.civilization.regions.routes.highland.lastDeliveredAt,102998);assert.equal(incident(h).busy(h.s,'highland'),false);assert.equal(h.s.civilization.regions.routes.highland.condition,'closed');h.roundtrip();
  const before={...h.s.stores},otherShips=JSON.stringify(h.s.civilization.regions.shipments);choose(h,'repair');near(h.s.stores.wood,before.wood-20);near(h.s.stores.tools,before.tools-4);assert.equal(r.phase,'resolved');assert.equal(r.outcome,'repaired');assert.equal(r.payment.at,103093);assert.equal(d.activeId,null);assert.equal(JSON.stringify(h.s.civilization.regions.shipments),otherShips);
  const history=h.ctx.CivilHistory.snapshot(h.s),keys=history.entries.filter(e=>e.category==='incidents').map(e=>e.key).sort();assert.deepEqual(clone(keys),['road_choice_1','road_closed_1','road_repair_1','road_warning_1']);const paid=JSON.stringify(h.s);h.ctx.CivilHistory.snapshot(h.s);assert.equal(JSON.stringify(h.s),paid);h.roundtrip();
});

test('legacy saves initialize an empty incident ledger without clearing old closures or changing existing assets',()=>{
  const old=clone(natural);old.civilization.regions.routes.river.condition='closed';const h=harness(old),d=incident(h).data(h.s);
  assert.equal(d.records.length,0);assert.equal(d.rolls,0);assert.equal(d.autoRoads,false);assert.equal(d.nextRollAt,old.civilization.elapsed+600);
  for(const key of ['game','stores'])assert.deepEqual(clone(h.s[key]),old[key]);
  for(const key of ['regions','urban','services','origins','finance'])assert.deepEqual(clone(h.s.civilization[key]),old.civilization[key]);
  const unauthorized=JSON.stringify(h.s);assert.equal(h.r.repairRoad(h.s,'river',{mode:'auto'}),false);assert.equal(JSON.stringify(h.s),unauthorized);
  const before={...h.s.stores};assert.equal(h.r.repairRoad(h.s,'river'),true);near(h.s.stores.wood,before.wood-20);near(h.s.stores.tools,before.tools-4);
  assert.equal(h.r.repairRoad(h.s,'river'),false);assert.equal(d.records.length,0);assert.equal(d.rolls,0);h.roundtrip();
});

test('actual dispatch scheduling advances the persisted PRNG; previews, save-load and an undecided warning never draw again',()=>{
  const h=warning(),d=incident(h).data(h.s),r=incident(h).active(h.s);assert.equal(r.createdAt,natural.civilization.elapsed+4800);assert.equal(d.rolls,8);
  let rng=incident(h).seed(natural.civilization.elapsed);for(let n=0;n<d.rolls;n++)rng=(Math.imul(rng,1664525)+1013904223)>>>0;assert.equal(d.rng,rng);
  assert.ok(r.cause.completedTrips>natural.civilization.regions.routes[r.route].completedTrips,'the warning follows real subsequent freight');
  const before=JSON.stringify(h.s);for(let i=0;i<10;i++){incident(h).eligible(h.s);incident(h).status(h.s);incident(h).nextEvent(h.s);incident(h).event('roadIncident',()=>()=>{});h.ctx.CivilPlatform.validate(h.s);}
  assert.equal(JSON.stringify(h.s),before);const loaded=h.roundtrip();open(loaded);drive(h,300);drive(loaded,300);assert.deepEqual(clone(loaded.s),clone(h.s));
  assert.equal(d.rng,rng);assert.equal(d.rolls,8);assert.equal(r.phase,'warning');assert.equal(r.dueAt,null);assert.equal(incident(h).route(h.s,r.route).condition,'open');
});

test('a native watch choice starts exactly 180 seconds at the click, including a reload one second before closure',()=>{
  const h=warning(),r=incident(h).active(h.s);drive(h,90);const at=h.s.civilization.elapsed;choose(h,'watch');assert.equal(r.chosenAt,at);assert.equal(r.dueAt,at+180);
  drive(h,179);assert.equal(r.phase,'watch');assert.equal(incident(h).route(h.s,r.route).condition,'open');const loaded=h.roundtrip();drive(loaded,1);
  const closed=incident(loaded).active(loaded.s);assert.equal(closed.phase,'closed');assert.equal(closed.closedAt,at+180);assert.equal(incident(loaded).route(loaded.s,r.route).condition,'closed');
  const snapshot=JSON.stringify(loaded.s);incident(loaded).tick(loaded.s);assert.equal(JSON.stringify(loaded.s),snapshot);loaded.roundtrip();
});

test('native and old regional repair entries pay wood20 tools4 once, and insufficient resources leave the transaction unchanged',()=>{
  const h=warning(),r=incident(h).active(h.s),before={...h.s.stores};const unauthorized=JSON.stringify(h.s);assert.equal(h.r.repairRoad(h.s,r.route,{incidentId:r.id,mode:'auto'}),false);assert.equal(JSON.stringify(h.s),unauthorized);assert.equal(h.active.scenes.start.buttons.repair.cost,undefined);choose(h,'repair');
  near(h.s.stores.wood,before.wood-20);near(h.s.stores.tools,before.tools-4);assert.equal(r.phase,'resolved');assert.equal(r.outcome,'prevented');assert.deepEqual(clone(r.payment.cost),{wood:20,tools:4});
  const done=JSON.stringify(h.s);assert.equal(incident(h).choose(h.s,r.id,'repair'),false);assert.equal(h.r.repairRoad(h.s,r.route,{incidentId:r.id}),false);assert.equal(JSON.stringify(h.s),done);
  // Explicit negative fixture: only inventory is reduced, never a fake payment.
  const poor=warning();poor.s.stores.tools=3;const unpaid=JSON.stringify(poor.s);assert.equal(incident(poor).choose(poor.s,incident(poor).active(poor.s).id,'automatic'),false);assert.equal(JSON.stringify(poor.s),unpaid);assert.equal(incident(poor).data(poor.s).autoRoads,false);
  const regional=warning(),row=incident(regional).active(regional.s),st={...regional.s.stores};regional.ctx.Events.endEvent();regional.s.civilization.pending={river:'regionRiver',rail:'regionRail',highland:'regionHighland'}[row.route];regional.ctx.Civilization.showPending();regional.click('repair');
  assert.equal(row.phase,'resolved');near(regional.s.stores.wood,st.wood-20);near(regional.s.stores.tools,st.tools-4);regional.roundtrip();
});

test('an unpaid native repair acknowledges the warning without charging, reopening every tick or starting a hidden deadline',()=>{
  const h=warning(),r=incident(h).active(h.s);h.s.stores.tools=0;const before=clone(h.s),record=clone(r);choose(h,'repair');
  assert.deepEqual(clone(h.s.stores),before.stores);assert.deepEqual(clone(r),{...record,offered:true});assert.equal(h.s.civilization.pending,null);assert.equal(h.active,null);assert.equal(incident(h).nextEvent(h.s),null);
  const offers=h.events.filter(e=>e.pending==='roadIncident').length;drive(h,20);assert.equal(h.events.filter(e=>e.pending==='roadIncident').length,offers);assert.equal(r.phase,'warning');assert.equal(r.dueAt,null);
  open(h);assert.ok(h.active.scenes.start.buttons.later);const stock=JSON.stringify(h.s.stores);h.click('later');assert.equal(JSON.stringify(h.s.stores),stock);const offersAfter=h.events.filter(e=>e.pending==='roadIncident').length;
  drive(h,240);assert.equal(h.events.filter(e=>e.pending==='roadIncident').length,offersAfter);assert.equal(r.phase,'warning');assert.equal(r.chosenAt,null);assert.equal(r.dueAt,null);h.roundtrip();
});

test('an old event id and its captured native button cannot charge or resolve a newer warning',()=>{
  const old=warning(),id=incident(old).active(old.s).id,callback=old.active.scenes.start.buttons.repair.onChoose;choose(old,'repair');until(old,()=>incident(old).data(old.s).records.length===2);
  const current=incident(old).active(old.s),before=JSON.stringify([old.s.stores,incident(old).data(old.s)]);assert.notEqual(current.id,id);
  assert.equal(incident(old).choose(old.s,id,'repair'),false);assert.equal(old.r.repairRoad(old.s,current.route,{incidentId:id}),false);callback();
  assert.equal(JSON.stringify([old.s.stores,incident(old).data(old.s)]),before);assert.equal(current.phase,'warning');assert.ok(old.messages.some(m=>m.includes('本次未扣料')));old.ctx.CivilPlatform.validate(old.s);
});

test('hold gates new freight and passengers while actual previously paid travellers and cargo finish and return',()=>{
  const h=localBeds(),r=incident(h).active(h.s),route=incident(h).route(h.s,r.route);assert.equal(h.u.setTarget(h.s,r.route),true);assert.equal(h.u.dispatch(h.s),true,h.s.civilization.urban.status);
  const party=h.s.civilization.urban.parties.find(p=>p.target===r.route),id=party.id,enabled=route.enabled,assigned=route.assigned,people=h.u.count(party.cohorts),population=h.m.node(h.s,r.route).population;
  assert.ok(h.s.civilization.regions.shipments.some(p=>p.route===r.route));choose(h,'hold');assert.equal(route.enabled,enabled);assert.equal(route.assigned,assigned);assert.equal(route.condition,'open');
  const stock=JSON.stringify(h.s.stores),number=h.s.civilization.regions.nextShipment;assert.equal(h.r.launch(h.s,r.route),false);assert.ok(h.ctx.CivilPassenger.quote(h.s,{target:r.route}).reason);assert.equal(JSON.stringify(h.s.stores),stock);assert.equal(h.s.civilization.regions.nextShipment,number);
  drive(h,119);const residents=h.m.node(h.s,r.route).population,survivors=h.u.count(party.cohorts);assert.ok(survivors<=people);drive(h,1);
  assert.equal(party.state,'returning');assert.equal(party.cohorts.length,0);assert.equal(h.m.node(h.s,r.route).population,residents+survivors);assert.equal(r.phase,'holding');assert.equal(route.condition,'open');assert.match(h.ctx.CivilPassenger.quote(h.s,{target:r.route}).reason,/暂停新迁居/);
  const loaded=h.roundtrip();drive(loaded,120);assert.equal(loaded.s.civilization.urban.parties.some(p=>p.id===id),false);until(loaded,()=>!incident(loaded).busy(loaded.s,r.route),300);drive(loaded,1);
  assert.equal(incident(loaded).active(loaded.s).phase,'closed');assert.equal(incident(loaded).route(loaded.s,r.route).condition,'closed');assert.equal(incident(loaded).route(loaded.s,r.route).enabled,enabled);loaded.roundtrip();
});

test('a hold selected after admission still waits for the genuinely empty passenger crew to get back',()=>{
  const h=localBeds(),r=incident(h).active(h.s);h.u.setTarget(h.s,r.route);assert.equal(h.u.dispatch(h.s),true,h.s.civilization.urban.status);const p=h.s.civilization.urban.parties.find(p=>p.target===r.route);drive(h,120);
  assert.equal(p.state,'returning');assert.equal(p.cohorts.length,0);choose(h,'hold');assert.equal(incident(h).busy(h.s,r.route),true);drive(h,119);assert.equal(p.remaining,1);assert.equal(r.phase,'holding');assert.equal(incident(h).route(h.s,r.route).condition,'open');
  drive(h,2);assert.equal(h.s.civilization.urban.parties.some(x=>x.id===p.id),false);
  // A second party may have legitimately left at the first party's arrival,
  // before the user chose hold. It too must finish, rather than disappear.
  until(h,()=>!incident(h).busy(h.s,r.route),300);drive(h,1);assert.equal(r.phase,'closed');h.roundtrip();
});

test('an actual closed member road keeps the shared agreement and coordination bills but records unfulfilled physical freight',()=>{
  const h=nextWarning(),r=incident(h).active(h.s),a=h.f.agreement(h.s);assert.ok(a.members.includes(r.route));choose(h,'watch');drive(h,180);assert.equal(r.phase,'closed');
  const at=h.s.civilization.elapsed,paid=h.s.civilization.finance.periods.reduce((n,p)=>n+(p.paidAdmin.home||0),0),orders=h.s.civilization.finance.orders.length;
  drive(h,1200);assert.equal(h.f.agreement(h.s).id,a.id);assert.equal(a.paused,false);assert.ok(h.s.civilization.finance.periods.some(p=>p.closedAt!==null&&p.startedAt>=at&&p.missed.includes(r.route)));
  assert.ok(h.s.civilization.finance.periods.reduce((n,p)=>n+(p.paidAdmin.home||0),0)>paid);assert.ok(h.s.civilization.finance.orders.length>=orders);assert.ok(h.s.civilization.regions.shipments.some(p=>p.route===r.route&&p.status==='held'));h.roundtrip();
});

test('automatic maintenance requires an explicit paid authorization and every later successful repair pays again',()=>{
  const h=warning(),first=incident(h).active(h.s),stock={...h.s.stores};choose(h,'automatic');assert.equal(incident(h).data(h.s).autoRoads,true);assert.equal(first.payment.mode,'manual');near(h.s.stores.wood,stock.wood-20);near(h.s.stores.tools,stock.tools-4);
  const payments=[],repair=h.r.repairRoad.bind(h.r);h.r.repairRoad=(s,id,options)=>{const before={...s.stores},ok=repair(s,id,options);if(options?.mode==='auto')payments.push({ok,before,after:{...s.stores}});return ok;};
  until(h,()=>incident(h).data(h.s).records.length===2);const auto=incident(h).data(h.s).records[1];assert.equal(auto.phase,'resolved');assert.equal(auto.payment.mode,'auto');assert.equal(payments.length,1);assert.equal(payments[0].ok,true);near(payments[0].after.wood,payments[0].before.wood-20);near(payments[0].after.tools,payments[0].before.tools-4);
  const before=JSON.stringify(h.s);incident(h).tick(h.s);assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});

test('authorized automatic maintenance with insufficient tools opens an unpaid warning and does not silently retry it',()=>{
  const h=warning();choose(h,'automatic');drive(h,2399);const d=incident(h).data(h.s);assert.equal(d.rolls,9);assert.equal(d.nextRollAt,h.s.civilization.elapsed+1);
  // Explicit shortage scenario: stop real tool production and exhaust stock.
  h.s.game.workers.smith=0;h.s.stores.tools=0;drive(h,1);const r=incident(h).active(h.s);
  assert.equal(r.phase,'warning');assert.equal(r.payment,null);assert.equal(d.autoRoads,true);assert.equal(h.s.stores.tools,0);assert.equal(h.s.civilization.pending,'roadIncident');assert.equal(h.active.title,'旧路的预警');
  drive(h,20);assert.equal(r.phase,'warning');assert.equal(r.payment,null);assert.equal(d.records.length,2);assert.equal(d.rolls,10);h.roundtrip();
  choose(h,'watch');const before=JSON.stringify(h.s);assert.equal(h.r.repairRoad(h.s,r.route,{incidentId:r.id,mode:'auto'}),false);assert.equal(JSON.stringify(h.s),before,'standing authority cannot override an already chosen watch phase');
});

test('a restored random stream and cooldown cannot be rewound by a malformed incident save',()=>{
  const h=warning();choose(h,'repair');const base=clone(h.s),d=base.civilization.incidents,r=d.records[0];assert.ok(r.resolvedAt!==null);
  for(const mutate of [x=>x.rng=(x.rng+1)>>>0,x=>x.lastTickAt=null,x=>x.nextRollAt=x.introducedAt+600,x=>x.nextRollAt=r.resolvedAt+1799,x=>x.records[0].offered=1]){
    const bad=clone(base);mutate(bad.civilization.incidents);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
  }
  const loaded=h.roundtrip();assert.equal(incident(loaded).data(loaded.s).rng,d.rng);assert.equal(incident(loaded).data(loaded.s).nextRollAt,d.nextRollAt);
});

test('fast random-state verification matches actual bounded draws and can validate long-lived worlds without replaying their ticks',()=>{
  const h=harness(natural),I=incident(h),seed=I.seed(natural.civilization.elapsed);let expected=seed;
  for(let rolls=0;rolls<=1024;rolls++){
    if([0,1,2,7,256,1024].includes(rolls))assert.equal(I.expectedRng(seed,rolls),expected);
    expected=(Math.imul(expected,1664525)+1013904223)>>>0;
  }
  const a=10000000,b=12345;assert.equal(I.expectedRng(seed,a+b),I.expectedRng(I.expectedRng(seed,a),b));
});

test('bad incident records are rejected while old absent ledgers remain migratable',()=>{
  const h=warning(),base=clone(h.s),reject=mutate=>{const bad=clone(base);mutate(bad.civilization.incidents,bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));};
  for(const value of [null,false,{},[],{schema:2}])assert.throws(()=>h.ctx.CivilPlatform.validate({...clone(base),civilization:{...clone(base.civilization),incidents:value}}));
  for(const mutate of [d=>d.rng=-1,d=>d.rng=4294967296,d=>d.rolls=999999,d=>d.nextId++,d=>d.activeId=null,d=>d.records[0].route='missing',d=>d.records[0].createdAt++,d=>d.records[0].payment={at:base.civilization.elapsed,cost:{wood:20,tools:4},mode:'manual'},d=>d.records[0].phase='closed',d=>d.autoRoads=true])reject(mutate);
  const missing=clone(base);delete missing.civilization.incidents;assert.throws(()=>h.ctx.CivilPlatform.validate(missing),'pending incident cannot survive deletion of its record');
  const old=clone(natural);assert.doesNotThrow(()=>h.ctx.CivilPlatform.validate(old));
});
