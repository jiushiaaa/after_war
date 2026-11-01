const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows贸易五趟完成与治理恢复26.json'),'utf8')).state;
function create(saved=raw){const h=harness(saved);h.security=h.ctx.CivilSecurity;h.trade=h.ctx.CivilCommerce;return h;}
function introduced(){const h=create();h.s.civilization.pending='roadDefense';h.ctx.Civilization.showPending();h.click('detour');return h;}
let trainedSnapshot;
function trained(){
  if(!trainedSnapshot){
    const h=introduced(),{s,security}=h,before=clone(s.stores),population=s.game.population;
    assert.equal(h.v.startProject(s,'home','guardpost'),true);
    for(const [k,v]of Object.entries(h.ctx.CivilServiceContent.facilities.guardpost.cost))near(s.stores[k],before[k]-v);
    assert.equal(s.game.population,population);
    // Isolated rule operator assigns existing free adults; no time or asset is granted.
    s.game.workers.servicebuilder=2;h.until(()=>!!security.asset(s),1000);
    assert.equal(security.asset(s).workedSeconds,360);assert.equal(security.guards(s),0);
    s.game.workers.guard=4;h.until(()=>security.data(s).readiness===300,500);
    h.roundtrip();trainedSnapshot=clone(s);
  }
  return create(trainedSnapshot);
}
function depart(mode='self'){
  const h=trained(),{s,security,trade}=h;
  if(mode==='joint'){assert.equal(security.sign(s),true);s.game.workers.guard=2;}
  assert.equal(security.choose(s,mode),true);assert.equal(trade.schedule(s),true);
  h.until(()=>!!trade.active(s),300);assert.equal(trade.cancel(s),true);return h;
}

test('five completed trades unlock a real decision without modifying old saves or old trips',()=>{
  const h=create(),{s,security,trade}=h;assert.deepEqual(clone(s),raw);h.roundtrip();
  assert.equal(security.nextEvent(s),'roadDefense');assert.equal(h.v.startProject(s,'home','guardpost'),false);
  assert.equal(trade.schedule(s),true);assert.match(trade.dispatchReason(s),/先在议事屋/);
  const before=clone(s);s.civilization.pending='roadDefense';h.ctx.Civilization.showPending();h.click('hold');
  assert.equal(trade.plan(s),null);assert.equal(security.data(s).mode,'detour');
  assert.deepEqual(clone(s.stores),before.stores);assert.deepEqual(clone(trade.data(s).orders),before.civilization.commerce.orders);h.roundtrip();
  const early=create(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows宪制往返与撤议退款21.json'),'utf8')).state);
  assert.equal(early.security.available(early.s),false);assert.equal(early.security.choose(early.s,'detour'),false);assert.equal(early.v.facilityGate(early.s,'home','guardpost'),false);
});

test('civilian detours pay extra travel supplies and actually spend 360 seconds each way without guards',()=>{
  const h=introduced(),{s,trade}=h,before=clone(s.stores),old=clone(trade.data(s).orders);
  assert.equal(trade.schedule(s),true);assert.equal(trade.dispatch(s),true);const o=trade.active(s);trade.cancel(s);
  assert.deepEqual(clone(o.paid),{tools:12.2,food:12,wood:3,parts:.1});
  for(const [k,v]of Object.entries(o.paid))near(s.stores[k],before[k]-v);
  assert.equal(o.security.duration,360);assert.equal(o.security.homeGuard,0);
  h.until(()=>o.returnedAt!==null,1000);assert.equal(o.arrivedAt-o.departedAt,360);assert.equal(o.returnedAt-o.arrivedAt,360);
  assert.equal(o.security.encounterSeconds,0);assert.deepEqual(clone(trade.data(s).orders.slice(0,5)),old);h.roundtrip();
});

test('paid construction and actual training charge all guards and shortages decay readiness atomically',()=>{
  const h=trained(),{s,security}=h,d=security.data(s),asset=security.asset(s);
  assert.ok(asset.completedAt>=asset.startedAt+360);assert.equal(d.readiness,300);
  const rows=d.records.filter(r=>r.staff===4);assert.equal(rows[0].readiness,0);assert.ok(rows.at(-1).at-rows[0].at>=300);
  for(const row of rows)assert.deepEqual(clone(row.costs),{food:2,tools:.2,medicine:.04});
  // Deliberate fixture shortage at the real settlement boundary, not natural progress.
  const settle=security.settle;let charged=false;
  security.settle=function(state){const saved=state.stores.medicine;state.stores.medicine=0;const before=clone(state.stores),result=settle.call(this,state);assert.deepEqual(clone(state.stores),before);state.stores.medicine=saved;charged=true;return result;};
  h.step(10);security.settle=settle;assert.ok(charged);assert.equal(d.readiness,290);assert.equal(d.records.at(-1).paid,false);h.roundtrip();
  s.game.workers.guard=1;h.step(10);assert.equal(d.readiness,280);assert.equal(security.choose(s,'self'),false);
  s.game.workers.guard=4;h.until(()=>d.readiness===300,100);h.roundtrip();
});

test('four actual guards hold the midpoint for thirty real seconds; shortage and reload preserve the same cargo',()=>{
  const h=depart(),{s,security,trade}=h,o=trade.active(s);
  assert.equal(o.security.mode,'self');assert.equal(o.security.homeGuard,4);assert.equal(security.choose(s,'detour'),false);
  h.until(()=>o.outboundSeconds===120,300);h.step(7);assert.equal(o.outboundSeconds,120);assert.equal(o.security.encounterSeconds,7);
  const cargo=clone(o.cargo);s.game.workers.guard=3;h.step(20);assert.equal(o.security.encounterSeconds,7);assert.deepEqual(clone(o.cargo),cargo);h.roundtrip();
  s.game.workers.guard=4;const reloaded=h.roundtrip();
  h.until(()=>o.returnedAt!==null,600);reloaded.until(()=>reloaded.ctx.CivilCommerce.active(reloaded.s)===null,600);
  assert.deepEqual(clone(reloaded.s),clone(s));assert.equal(o.security.encounterSeconds,30);assert.equal(o.arrivedAt-o.departedAt,290);assert.equal(o.returnedAt-o.arrivedAt,240);
  assert.ok(h.ctx.CivilHistory.snapshot(s).entries.some(e=>e.key==='commerce_guarded_6'));h.roundtrip();
});

test('joint signatures and each dispatch pay both independent stores atomically and reserve existing source adults',()=>{
  const h=trained(),{s,security,trade}=h,n=trade.source(s),before=clone([s.stores,n.stores]),load=h.r.load(s),knowledge=n.stores.knowledge;
  n.stores.knowledge=0;const failed=clone(s);assert.equal(security.sign(s),false);assert.deepEqual(clone(s),failed);n.stores.knowledge=knowledge;
  assert.equal(security.sign(s),true);near(s.stores.knowledge,before[0].knowledge-120);near(n.stores.knowledge,before[1].knowledge-60);assert.equal(h.r.load(s),load+1);
  s.game.workers.guard=2;assert.equal(security.choose(s,'joint'),true);assert.equal(trade.schedule(s),true);
  const food=n.stores.food;n.stores.food=0;const shortage=clone(s);assert.equal(trade.dispatch(s),false);assert.deepEqual(clone(s),shortage);n.stores.food=food;
  const costs=clone([s.stores,n.stores]),population=n.population,staff=h.ctx.CivilOrigins.sourceStaff(s,trade.sourceId(s));
  assert.equal(trade.dispatch(s),true);const o=trade.active(s);trade.cancel(s);
  for(const [k,v]of Object.entries(o.paid))near(s.stores[k],costs[0][k]-v);
  near(n.stores.food,costs[1].food-6);near(n.stores.tools,costs[1].tools-.2);assert.equal(n.population,population);
  assert.equal(h.ctx.CivilOrigins.sourceStaff(s,trade.sourceId(s)),staff+2);
  assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)+h.ctx.CivilOrigins.sourceStaff(s,trade.sourceId(s))<=h.ctx.CivilPopulation.workforce(n.cohorts));
  h.step(10);h.roundtrip();s.game.workers.guard=1;h.step(10);const readiness=security.data(s).readiness;assert.equal(readiness,290);
  s.game.workers.guard=2;h.step(10);assert.equal(security.data(s).readiness,readiness);assert.equal(security.data(s).records.at(-1).away,true);
  h.until(()=>o.returnedAt!==null,900);assert.equal(security.sourceStaff(s,trade.sourceId(s)),0);assert.equal(trade.data(s).orders.length,6);h.roundtrip();
});

test('unpaid guards, edited durations, missing profiles and fabricated encounter or training progress are rejected',()=>{
  const h=depart(),good=clone(h.s);
  for(const mutate of [
    s=>s.civilization.commerce.orders.at(-1).security.duration=1,
    s=>s.civilization.commerce.orders.at(-1).security.homeGuard=0,
    s=>s.civilization.commerce.orders.at(-1).security.sourcePaid.food=0,
    s=>s.civilization.commerce.orders.at(-1).security.encounterSeconds=30,
    s=>delete s.civilization.commerce.orders.at(-1).security,
    s=>delete s.civilization.security,
    s=>{s.civilization.security.legacyBeforeOrder++;delete s.civilization.commerce.orders.at(-1).security;},
    s=>s.civilization.security.records.at(-1).costs.tools=0,
    s=>s.civilization.security.records[0].readiness=300,
    s=>s.civilization.security.pact={at:s.civilization.elapsed,costs:{home:{knowledge:0},source:{knowledge:0}}}
  ]){const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
  h.roundtrip();
});
