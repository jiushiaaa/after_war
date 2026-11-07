const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const envelope=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows战后镇制居民到达62.json'),'utf8'));
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(envelope.data,'base64'))).state;
function create(){const h=harness(raw);h.ic=h.ctx.CivilIntercity;
  // Synthetic prebuilt archive extension, with its actual construction debit.
  // Natural acceptance separately builds this through the original Room UI.
  assert.equal(h.ic.sign(h.s),false);assert.match(h.ic.reason(h.s),/行政档案馆/);
  assert.equal(h.ctx.CivilRules.pay(h.s,h.r.buildings.archive.cost()),true);h.s.game.buildings.archive++;
  h.step(10);return h;
}
function start(h){assert.equal(h.ic.sign(h.s),true);assert.equal(h.ic.schedule(h.s),true);h.step(1);assert.ok(h.ic.active(h.s));return h.ic.active(h.s);}
function audit(h){
  const ic=h.ctx.CivilIntercity,tick=ic.tick.bind(ic),totals=()=>{
    const out={};for(const stores of [h.s.stores,...['rail','river'].map(id=>h.s.civilization.regions.nodes[id].stores),ic.active(h.s)?.cargo||{}])for(const [k,n]of Object.entries(stores))out[k]=(out[k]||0)+n;return out;
  };
  // Observe only the transport operation; the normal economy still runs first.
  ic.tick=s=>{const before=totals(),count=ic.data(s)?.orders.length||0;tick(s);const after=totals(),paid=(ic.data(s)?.orders.length||0)>count?ic.data(s).orders.at(-1).paid:{};for(const k of new Set([...Object.keys(before),...Object.keys(after)]))near(after[k]||0,(before[k]||0)-(paid[k]||0),'conserved '+k);};
  return h;
}

test('legacy state remains unchanged; three treasuries sign atomically and consume one real coordination duty',()=>{
  const h=create(),{s,ic}=h;assert.equal(ic.data(s),undefined);h.roundtrip();
  const before=clone(s),load=h.r.load(s);s.civilization.regions.nodes.river.stores.knowledge=0;
  const failed=clone(s);assert.equal(ic.sign(s),false);assert.deepEqual(clone(s),failed);
  s.civilization.regions.nodes.river.stores.knowledge=before.civilization.regions.nodes.river.stores.knowledge;
  assert.equal(ic.sign(s),true);near(s.stores.knowledge,before.stores.knowledge-60);
  for(const id of ['rail','river'])near(s.civilization.regions.nodes[id].stores.knowledge,before.civilization.regions.nodes[id].stores.knowledge-30);
  assert.equal(h.r.load(s),load+1);assert.equal(ic.sign(s),false);h.roundtrip();
});

test('one shared caravan carries real city goods through save/reload and releases only after physical return',()=>{
  let h=audit(create()),o=start(h);const asset=h.ctx.CivilCommerce.asset(h.s).id;
  assert.equal(o.assetId,asset);assert.equal(h.ctx.CivilCommerce.reservedTransport(h.s),2);
  assert.match(h.ctx.CivilFrontier.reason(h.s,'scout'),/原商车/);
  assert.equal(h.ic.cancel(h.s),true);h=audit(h.roundtrip());h.ic=h.ctx.CivilIntercity;o=h.ic.active(h.s);
  h.until(()=>o.phase==='pickup',100);const rail=h.s.civilization.regions.nodes.rail,river=h.s.civilization.regions.nodes.river,parts=rail.stores.parts;
  h.step(1);assert.equal(o.phase,'market');near(rail.stores.parts,parts-24);assert.deepEqual(clone(o.cargo),{parts:24});
  h=audit(h.roundtrip());h.ic=h.ctx.CivilIntercity;o=h.ic.active(h.s);h.until(()=>o.phase==='source',160);
  assert.deepEqual(clone(o.cargo),{food:120});assert.equal(h.ic.withdraw(h.s),false);h.roundtrip();
  h.until(()=>o.phase==='home',160);assert.deepEqual(clone(o.cargo),{});assert.equal(o.deliveredAt-o.exchangedAt,150);
  assert.equal(h.ctx.CivilCommerce.reservedTransport(h.s),2);h.until(()=>!h.ic.active(h.s),100);
  assert.equal(o.returnedAt-o.departedAt,482);assert.equal(h.ctx.CivilCommerce.reservedTransport(h.s),0);
  h.step(20);assert.equal(h.ic.data(h.s).orders.length,1);h.roundtrip();
});

test('local shortage preserves cargo; withdrawal returns original parts to their source after actual distance',()=>{
  const h=create(),{s,ic}=h,o=start(h);ic.cancel(s);h.until(()=>o.phase==='exchange',250);
  // Deliberate shortage fixture is separate from natural play; keep production running.
  s.civilization.regions.nodes.river.stores.food=0;h.step(1);assert.equal(o.phase,'exchange');assert.equal(o.exchangedAt,null);
  assert.deepEqual(clone(o.cargo),{parts:24});assert.equal(ic.withdraw(s),true);h.roundtrip();
  const at=s.civilization.elapsed;h.step(149);assert.equal(o.refundedAt,null);assert.deepEqual(clone(o.cargo),{parts:24});
  h.step(1);assert.equal(o.refundedAt,at+150);assert.deepEqual(clone(o.cargo),{});assert.equal(o.exchangedAt,null);
  h.until(()=>!ic.active(s),100);assert.equal(o.homeSeconds,90);h.roundtrip();
});

test('zero-distance withdrawal ends without staff; a moving contract waits for staff and retains cargo',()=>{
  const h=create(),{s,ic}=h,o=start(h);ic.cancel(s);assert.equal(ic.withdraw(s),true);
  s.game.workers.transporter=0;h.step(1);assert.equal(o.returnedAt,o.departedAt+1);assert.equal(ic.reservedTransport(s),0);h.roundtrip();
  const a=create(),p=start(a);a.ic.cancel(a.s);a.step(100);const before=clone(p);a.s.game.workers.transporter=10;a.step(12);
  assert.equal(p.marketSeconds,before.marketSeconds);assert.deepEqual(clone(p.cargo),before.cargo);
  a.s.game.workers.transporter=12;a.step(1);assert.equal(p.marketSeconds,before.marketSeconds+1);a.roundtrip();
});

test('a plan has exactly three departures and cannot reserve a second caravan through foreign trade',()=>{
  const h=create(),{s,ic}=h;start(h);assert.equal(h.ctx.CivilCommerce.schedule(s),true);
  assert.match(h.ctx.CivilCommerce.dispatchReason(s),/城际/);assert.equal(h.ctx.CivilCommerce.dispatch(s),false);
  assert.equal(h.ctx.CivilCommerce.cancel(s),true);h.until(()=>ic.data(s).orders.length===3&&!ic.active(s),1600);
  h.step(20);assert.equal(ic.plan(s),null);assert.equal(ic.data(s).orders.length,3);h.roundtrip();
});

test('strict import rejects invented cargo, early arrival, duplicate use and impossible progress',()=>{
  const h=create(),o=start(h);h.ic.cancel(h.s);h.step(100);h.roundtrip();
  for(const mutate of [o=>o.cargo.parts++,o=>o.inboundSeconds=1,o=>o.pickedAt=o.departedAt+89,o=>o.assetId++,o=>o.phase='home',o=>o.exchangedAt=o.pickedAt]){
    const bad=clone(h.s);mutate(bad.civilization.intercity.orders[0]);assert.throws(()=>h.ctx.CivilPlatform.validate(bad),/城际/);
  }
  const bad=clone(h.s);bad.civilization.commerce.orders.at(-1).returnedAt=bad.civilization.elapsed;
  assert.throws(()=>h.ctx.CivilIntercity.validate(bad),/城际/);
});

test('closed road holds the paid cargo and reopens without resetting its progress',()=>{
  const h=audit(create()),o=start(h);h.ic.cancel(h.s);h.step(100);const before=clone(o),route=h.s.civilization.regions.routes.river;
  // Synthetic closure, restored before full-save validation; never a natural save.
  route.condition='closed';h.step(12,{checkEvery:0});assert.equal(o.marketSeconds,before.marketSeconds);assert.deepEqual(clone(o.cargo),before.cargo);
  route.condition='open';h.step(1);assert.equal(o.marketSeconds,before.marketSeconds+1);h.roundtrip();
});
