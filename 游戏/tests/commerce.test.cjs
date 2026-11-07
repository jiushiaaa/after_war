const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows宪制往返与撤议退款21.json'),'utf8')).state;
function create(saved=raw){const h=harness(saved);h.trade=h.ctx.CivilCommerce;return h;}
function signed(){const h=create();h.s.civilization.pending='foreignCommerce';h.ctx.Civilization.showPending();h.click('sign');assert.ok(h.trade.data(h.s));return h;}
let builtSnapshot;
function built(){
  if(!builtSnapshot){
    const h=signed(),{s,trade}=h,before=clone(s.stores);assert.equal(h.v.startProject(s,'home','foreigncaravan'),true);
    for(const [k,v]of Object.entries(h.ctx.CivilServiceContent.facilities.foreigncaravan.cost))near(s.stores[k],before[k]-v);
    // Isolated rule operator assigns existing free adults; no construction asset is prebuilt.
    s.game.workers.servicebuilder=2;h.until(()=>!!trade.asset(s),1800);h.roundtrip();builtSnapshot=clone(s);
  }
  return create(builtSnapshot);
}
function departing(){const h=built();assert.equal(h.trade.schedule(h.s),true);h.until(()=>!!h.trade.active(h.s),600);return h;}

test('old saves remain untouched and trade assets cannot be built before a paid agreement',()=>{
  const h=create();assert.deepEqual(clone(h.s),raw);h.roundtrip();assert.equal(h.v.startProject(h.s,'home','foreigncaravan'),false);
  const early=create(harness().s),before=clone(early.s);assert.equal(early.trade.sign(early.s),false);assert.equal(early.trade.schedule(early.s),false);assert.deepEqual(clone(early.s),before);
  early.s.civilization.pending='foreignCommerce';assert.throws(()=>early.ctx.CivilPlatform.validate(early.s));
});

test('trade signatures charge both original warehouses atomically and add one real coordination obligation',()=>{
  const h=create(),{s,trade}=h,n=trade.source(s),before=clone([s.stores,n.stores]),load=h.r.load(s),saved=n.stores.knowledge;
  n.stores.knowledge=0;const failed=clone(s);assert.equal(trade.sign(s),false);assert.deepEqual(clone(s),failed);n.stores.knowledge=saved;
  assert.equal(trade.sign(s),true);near(s.stores.knowledge,before[0].knowledge-60);near(n.stores.knowledge,before[1].knowledge-30);assert.equal(h.r.load(s),load+1);
  const once=clone(s);assert.equal(trade.sign(s),false);assert.deepEqual(clone(s),once);h.roundtrip();
});

test('equipment takes paid materials and real construction, and dispatch holds a unique crew and cargo',()=>{
  const h=built(),{s,trade}=h,asset=trade.asset(s);assert.equal(asset.workedSeconds,360);assert.ok(asset.completedAt>=asset.startedAt+360);
  const before=clone(s.stores),source=clone(trade.source(s).stores),free=h.ctx.CivilPassenger.availableWorkers(s);
  assert.equal(trade.schedule(s),true);h.step(1);const o=trade.active(s);assert.ok(o);
  for(const [k,v]of Object.entries(trade.paid()))near(s.stores[k],before[k]-v);
  assert.deepEqual(clone(trade.source(s).stores),source);assert.equal(h.ctx.CivilPassenger.availableWorkers(s),free-2);
  assert.equal(h.r.availableTransport(s),free-2);assert.equal(o.outboundSeconds,0);assert.deepEqual(clone(o.cargo),{tools:12});
  const once=clone(s);trade.tick(s);assert.deepEqual(clone(s),once);h.roundtrip();
});

test('successful trade exchanges only on arrival and credits home only after a paid physical return, once',()=>{
  const h=departing(),{s,trade}=h,o=trade.active(s),tick=trade.tick;let exchanged=false,returned=false;
  trade.tick=function(state){
    const oldArrival=o.arrivedAt,oldReturn=o.returnedAt,home=clone(s.stores),source=clone(this.source(s).stores);tick.call(this,state);
    if(oldArrival===null&&o.arrivedAt!==null){exchanged=true;assert.equal(o.exchange,true);near(this.source(s).stores.food,source.food-120);near(this.source(s).stores.tools,source.tools+12);assert.deepEqual(clone(s.stores),home);assert.equal(o.outboundSeconds,240);}
    if(oldReturn===null&&o.returnedAt!==null){returned=true;near(s.stores.food,home.food+120);assert.deepEqual(clone(this.source(s).stores),source);assert.deepEqual(clone(o.cargo),{});assert.equal(o.inboundSeconds,240);}
  };
  h.until(()=>o.arrivedAt!==null,600);h.roundtrip();assert.equal(trade.cancel(s),true);
  const reload=h.roundtrip();assert.ok(reload.ctx.CivilCommerce.active(reload.s));
  h.until(()=>o.returnedAt!==null,600);trade.tick=tick;assert.ok(exchanged&&returned);
  reload.until(()=>reload.s.civilization.commerce.orders[0].returnedAt!==null,600);assert.deepEqual(clone(reload.s),clone(s));
  const count=trade.data(s).orders.length;
  h.step(15);assert.equal(trade.data(s).orders.length,count);h.roundtrip();
  assert.ok(h.ctx.CivilHistory.snapshot(s).entries.some(e=>e.key==='commerce_return_1'));
});

test('a source shortage refuses the exchange, returns all cargo and never refunds spent travel supplies',()=>{
  const h=departing(),{s,trade}=h,o=trade.active(s);trade.cancel(s);
  h.until(()=>o.outboundSeconds===239,600);const original=trade.tick;let rejected=false;
  // Deliberate one-boundary shortage fixture, isolated from natural UI progress.
  trade.tick=function(state){const n=this.source(s),saved=n.stores.food;n.stores.food=0;const tools=n.stores.tools;original.call(this,state);n.stores.food=saved;near(n.stores.tools,tools);rejected=true;};
  h.step(1);trade.tick=original;assert.ok(rejected);assert.equal(o.exchange,false);assert.deepEqual(clone(o.cargo),{tools:12});h.roundtrip();
  trade.tick=function(state){const before=clone(s.stores),old=o.returnedAt;original.call(this,state);if(old===null&&o.returnedAt!==null){near(s.stores.tools,before.tools+12);near(s.stores.food,before.food);near(s.stores.wood,before.wood);near(s.stores.parts,before.parts);}};
  h.until(()=>o.returnedAt!==null,600);trade.tick=original;h.roundtrip();
});

test('lost workers and closed roads pause actual movement without deleting cargo; recovery resumes the same journey',()=>{
  const h=departing(),{s,trade}=h,o=trade.active(s),workers=s.game.workers.transporter;
  s.game.workers.transporter=h.r.reservedTransport(s);const cargo=clone(o.cargo);h.step(12);assert.equal(o.outboundSeconds,0);assert.deepEqual(clone(o.cargo),cargo);h.roundtrip();
  s.game.workers.transporter=workers;h.step(2);assert.equal(o.outboundSeconds,2);
  const corridor=trade.route(s).corridor,route=s.civilization.regions.routes[corridor];route.condition='closed';h.step(12);assert.equal(o.outboundSeconds,2);assert.equal(h.ctx.CivilIncidents.busy(s,corridor),true);
  route.condition='open';h.step(1);assert.equal(o.outboundSeconds,3);h.roundtrip();
});

test('one instruction sends at most six trips and a paused pact stops new departures without swallowing existing cargo',()=>{
  const h=departing(),{s,trade}=h,o=trade.active(s);assert.equal(h.ctx.CivilDiplomacy.revise(s,'pause'),true);
  h.until(()=>o.returnedAt!==null,1200);h.step(100);assert.equal(trade.data(s).orders.length,1);assert.ok(trade.plan(s));assert.match(trade.status(s),/累计归城1趟.*尚余5趟未发车/);
  assert.equal(h.ctx.CivilDiplomacy.revise(s,'resume'),true);
  h.until(()=>trade.data(s).orders.length===6&&trade.data(s).orders.at(-1).returnedAt!==null,6000);
  assert.equal(trade.plan(s),null);h.step(50);assert.equal(trade.data(s).orders.length,6);h.roundtrip();
});

test('forged cargo, travel time, duplicate equipment use and unpaid agreement or construction are rejected',()=>{
  const h=departing(),good=clone(h.s);
  for(const mutate of [s=>s.civilization.commerce=null,s=>s.civilization.commerce.signature.home.knowledge=0,s=>s.civilization.commerce.orders[0].cargo.tools=13,s=>s.civilization.commerce.orders[0].paid.tools=12,s=>s.civilization.commerce.orders[0].outboundSeconds=240,s=>s.civilization.commerce.orders[0].assetId=999,s=>s.civilization.commerce.plans[0].limit=100,s=>s.civilization.commerce.orders.push(clone(s.civilization.commerce.orders[0])),s=>delete s.civilization.commerce]){
    const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
  }
  h.roundtrip();
});
