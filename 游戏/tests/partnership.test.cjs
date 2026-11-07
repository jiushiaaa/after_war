const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const envelope=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows第四城换届后治理恢复交接81.json')));
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(envelope.data,'base64'))).state;
const id='old_city_fringe',other='river_network';
function create(){const h=harness(raw);h.p=h.ctx.CivilPartnership;return h;}
function signed(){const h=create();assert.equal(h.p.sign(h.s,id),true);h.step(20);return h;}
function departing(){const h=signed();assert.equal(h.p.schedule(h.s,id),true);h.step(1);assert.ok(h.p.active(h.s));return h;}

test('new regional agreements leave old saves untouched and cannot appear in early play',()=>{
  const h=create();assert.deepEqual(clone(h.s),raw);h.roundtrip();
  const early=harness(),before=clone(early.s);assert.equal(early.ctx.CivilPartnership.sign(early.s,id),false);assert.deepEqual(clone(early.s),before);
  early.s.civilization.pending='regionalPartners';assert.throws(()=>early.ctx.CivilPlatform.validate(early.s),/地区商约/);
});

test('two partners sign separately, use actual workers, and debit only their own warehouses atomically',()=>{
  const h=create(),{s,p}=h,n=p.source(s,id),before=clone(s),load=h.r.load(s),saved=n.stores.knowledge;
  n.stores.knowledge=0;const missing=clone(s);assert.equal(p.sign(s,id),false);assert.deepEqual(clone(s),missing);n.stores.knowledge=saved;
  assert.equal(p.sign(s,id),true);near(s.stores.knowledge,before.stores.knowledge-80);near(n.stores.knowledge,saved-40);
  assert.deepEqual(clone(p.source(s,other)),before.civilization.origins.nodes[other]);assert.equal(h.r.load(s),load+1);assert.equal(p.staff(s,id),2);
  assert.equal(p.sign(s,other),true);assert.equal(p.sign(s,h.ctx.CivilCommerce.sourceId(s)),false);assert.equal(h.r.load(s),load+2);
  const once=clone(s);assert.equal(p.sign(s,id),false);assert.deepEqual(clone(s),once);h.step(20);h.roundtrip();
  for(const source of [id,other])assert.ok(Object.values(p.source(s,source).workers).reduce((a,b)=>a+b,0)+h.ctx.CivilOrigins.sourceStaff(s,source)<=h.ctx.CivilPopulation.workforce(p.source(s,source).cohorts));
});

test('one original caravan cannot concurrently enter foreign trade, frontier missions or city freight',()=>{
  const h=departing(),{s,p}=h,o=p.active(s);assert.equal(o.assetId,h.ctx.CivilCommerce.asset(s).id);
  assert.equal(h.ctx.CivilCommerce.reservedTransport(s),2);assert.match(h.ctx.CivilIntercity.dispatchReason(s),/暂无待发委托/);
  assert.match(h.ctx.CivilFrontier.reason(s,'scout'),/原商车/);
  assert.equal(h.ctx.CivilIntercity.schedule(s),true);assert.match(h.ctx.CivilIntercity.dispatchReason(s),/地区商约/);
  assert.equal(h.ctx.CivilIntercity.dispatch(s),false);h.ctx.CivilIntercity.cancel(s);
  h.until(()=>h.ctx.CivilAccession.operational(s),2000);assert.equal(h.ctx.CivilCommerce.schedule(s),true);assert.equal(h.ctx.CivilCommerce.dispatch(s),false);h.ctx.CivilCommerce.cancel(s);
  h.roundtrip();
});

test('physical trade conserves source inventories and cargo; home receives scrap only at return',()=>{
  const h=departing(),{s,p}=h,o=p.active(s);p.cancel(s);const tick=p.tick.bind(p);let exchanged=false,returned=false;
  p.tick=state=>{const before=clone([s.stores,p.source(s,id).stores]),arrival=o.arrivedAt,returnAt=o.returnedAt;tick(state);
    if(arrival===null&&o.arrivedAt!==null){exchanged=true;near(p.source(s,id).stores.scrap,before[1].scrap-96);near(p.source(s,id).stores.tools,before[1].tools+12);assert.deepEqual(clone(s.stores),before[0]);assert.deepEqual(clone(o.cargo),{scrap:96});}
    if(returnAt===null&&o.returnedAt!==null){returned=true;near(s.stores.scrap,before[0].scrap+96);assert.deepEqual(clone(p.source(s,id).stores),before[1]);}
  };
  h.until(()=>o.arrivedAt!==null,1000);const loaded=h.roundtrip();h.until(()=>o.returnedAt!==null,1000);
  loaded.until(()=>!loaded.ctx.CivilPartnership.active(loaded.s),1000);assert.deepEqual(clone(loaded.s),clone(s));
  assert.ok(exchanged&&returned);assert.equal(o.returnedAt-o.departedAt,720);assert.equal(p.completed(s,id),1);h.roundtrip();
});

test('arrival shortages return original tools without refunding travel and do not count toward admission',()=>{
  const h=departing(),{s,p}=h,o=p.active(s);p.cancel(s);h.until(()=>o.outboundSeconds===359,1000);
  // Explicit isolated shortage; no edited state is used in browser acceptance.
  const n=p.source(s,id),saved=n.stores.scrap;n.stores.scrap=0;p.tick(s);h.step(1);n.stores.scrap=saved;
  assert.equal(o.exchange,false);assert.deepEqual(clone(o.cargo),{tools:12});h.until(()=>o.returnedAt!==null,1000);
  assert.equal(p.completed(s,id),0);assert.equal(p.join(s,id),false);assert.deepEqual(clone(o.paid),{tools:12.2,food:12,wood:3,parts:.1});h.roundtrip();
});

test('closed corridors and missing drivers hold existing cargo and resume original travel',()=>{
  const h=departing(),{s,p}=h,o=p.active(s);p.cancel(s);const route=s.civilization.regions.routes.rail,workers=s.game.workers.transporter;
  route.condition='closed';h.step(12);assert.equal(o.outboundSeconds,0);assert.equal(h.ctx.CivilIncidents.busy(s,'rail'),true);
  route.condition='open';s.game.workers.transporter=h.r.reservedTransport(s);h.step(12);assert.equal(o.outboundSeconds,0);assert.deepEqual(clone(o.cargo),{tools:12});
  s.game.workers.transporter=workers;h.step(1);assert.equal(o.outboundSeconds,1);h.roundtrip();
});

test('three paid exchanges and continuous service precede admission; existing people are counted only once',()=>{
  const h=departing(),{s,p}=h,before=h.ctx.CivilNation.population(s);assert.equal(p.join(s,id),false);
  h.until(()=>p.completed(s,id)===3,3000);assert.equal(p.plan(s),null);h.until(()=>p.operational(s,id)&&p.partners(s)[id].stableSeconds===600,1500);
  const cohorts=clone(p.source(s,id).cohorts),home=s.game.population,cost=s.stores.knowledge,local=p.source(s,id).stores.knowledge;
  assert.equal(p.join(s,id),true);near(s.stores.knowledge,cost-150);near(p.source(s,id).stores.knowledge,local-100);
  assert.equal(h.ctx.CivilNation.population(s),before+p.source(s,id).population);assert.deepEqual(clone(p.source(s,id).cohorts),cohorts);assert.equal(s.game.population,home);
  const once=clone(s);assert.equal(p.join(s,id),false);assert.deepEqual(clone(s),once);h.roundtrip();
  assert.ok(h.ctx.CivilHistory.snapshot(s).entries.some(e=>e.key==='partner_join_'+id));
});

test('failed bilateral fees do not debit the other party or preserve continuous service',()=>{
  const h=signed(),{s,p}=h,n=p.source(s,id);h.step(40);const saved=n.stores.knowledge;n.stores.knowledge=0;
  // Call one production boundary in isolation to observe exactly the public payment.
  s.civilization.elapsed+=10;const before=clone(s.stores);p.settle(s);p.observe(s);assert.deepEqual(clone(s.stores),before);
  assert.equal(p.partners(s)[id].records.at(-1).paid,false);assert.equal(p.partners(s)[id].stableSeconds,0);assert.equal(p.schedule(s,id),false);n.stores.knowledge=saved;
});

test('export offers preserve local medical and toolmaking inputs even when the cargo itself is in stock',()=>{
  const h=signed(),{s,p}=h,n=p.source(s,id),before=clone(s);
  n.stores.scrap=96;assert.equal(p.sourceReserve(s,id,{scrap:96}),false);
  n.stores.scrap=10000;assert.equal(p.sourceReserve(s,id,{scrap:96}),true);
  n.stores.wood=10;assert.equal(p.sourceReserve(s,id,{wood:10}),false);
  assert.deepEqual(clone(s.stores),before.stores);
});

test('strict import rejects invented partner identities, early admission, duplicated vehicles and forged cargo',()=>{
  const h=departing(),{s}=h;
  for(const mutate of [b=>b.civilization.partnership.orders[0].cargo.tools++,b=>b.civilization.partnership.orders[0].outboundSeconds=360,b=>b.civilization.partnership.orders[0].assetId++,b=>b.civilization.partnership.plans[0].sourceId=other,b=>b.civilization.partnership.partners[id].joinedAt=b.civilization.elapsed,b=>b.civilization.partnership.partners[id].records.at(-1).costs.home.knowledge++]){
    const bad=clone(s);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad),/地区商约/);
  }
  const bad=clone(s),o=bad.civilization.partnership.orders[0];bad.civilization.commerce.orders.push({departedAt:o.departedAt,returnedAt:null});assert.throws(()=>h.p.validate(bad),/地区商约/);
  const before=clone(s),preview=h.ctx.CivilForecast.copy(s);preview.civilization.partnership.partners[id].records.at(-1).paid=false;assert.deepEqual(clone(s),before);
});
