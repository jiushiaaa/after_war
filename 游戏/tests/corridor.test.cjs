const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const envelope=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows第79任国家加盟恢复68.json'),'utf8'));
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(envelope.data,'base64'))).state;
function bind(h){h.road=h.ctx.CivilCorridor;h.trade=h.ctx.CivilCommerce;return h;}
function create(){return bind(harness(raw));}
function begin(h){assert.equal(h.road.start(h.s),true);assert.equal(h.trade.schedule(h.s),true);return h.road.data(h.s);}
let buildingSnapshot,finishedSnapshot;
function building(){if(!buildingSnapshot){const h=create(),d=begin(h);h.until(()=>d.startedAt!==null,6000);h.roundtrip();buildingSnapshot=clone(h.s);}return bind(harness(buildingSnapshot));}
function finished(){if(!finishedSnapshot){const h=building(),d=h.road.data(h.s);h.step(599);assert.equal(d.worked,599);assert.equal(d.completedAt,null);h.step(1);assert.equal(d.completedAt-d.startedAt,600);h.step(10);assert.ok(h.road.profile(h.s));h.roundtrip();finishedSnapshot=clone(h.s);}return bind(harness(finishedSnapshot));}
function audit(h){
  const c=h.trade,tick=c.tick.bind(c),totals=()=>{const sum={};for(const st of [h.s.stores,c.source(h.s).stores,c.active(h.s)?.cargo||{},h.road.data(h.s)?.buffer||{},h.road.data(h.s)?.consumed||{}])for(const [k,n]of Object.entries(st))sum[k]=(sum[k]||0)+n;return sum;};
  c.tick=s=>{const before=totals(),count=c.data(s).orders.length;tick(s);const after=totals(),o=c.data(s).orders.at(-1),cost={};
    if(c.data(s).orders.length>count){for(const extra of [h.ctx.CivilCommerceContent.travelCost,h.ctx.CivilSecurityContent.modes[o.security.mode].homeCost,o.security.sourcePaid])for(const [k,n]of Object.entries(extra))cost[k]=(cost[k]||0)+n;}
    for(const k of new Set([...Object.keys(before),...Object.keys(after)]))near(after[k]||0,(before[k]||0)-(cost[k]||0),'conserved '+k);
  };return h;
}

test('old save has no automatic works; signatures are atomic and debit the two original warehouses',()=>{
  const h=create(),{s,road}=h;assert.deepEqual(clone(s),raw);assert.equal(road.data(s),undefined);h.roundtrip();
  const source=h.trade.source(s),knowledge=source.stores.knowledge;source.stores.knowledge=0;const failure=clone(s);assert.equal(road.start(s),false);assert.deepEqual(clone(s),failure);source.stores.knowledge=knowledge;
  const before=clone(s);assert.equal(road.start(s),true);near(s.stores.knowledge,before.stores.knowledge-100);
  for(const [k,n]of Object.entries(h.ctx.CivilCorridorContent.signature.source))near(source.stores[k],before.civilization.origins.nodes[h.trade.sourceId(s)].stores[k]-n);
  assert.equal(road.start(s),false);assert.deepEqual(clone(road.data(s).buffer),{});h.roundtrip();
});

test('two empty withdrawals do not count as completed intercity exchanges for road works',()=>{
  const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows战后镇制居民到达62.json'),'utf8')),h=bind(harness(JSON.parse(zlib.gunzipSync(Buffer.from(p.data,'base64'))).state)),ic=h.ctx.CivilIntercity;
  // Explicit synthetic archive prerequisite, paid from the original warehouse.
  assert.equal(h.ctx.CivilRules.pay(h.s,h.r.buildings.archive.cost()),true);h.s.game.buildings.archive++;h.step(10);assert.equal(ic.sign(h.s),true);
  for(let i=0;i<2;i++){assert.equal(ic.schedule(h.s),true);h.step(1);assert.ok(ic.active(h.s));ic.cancel(h.s);assert.equal(ic.withdraw(h.s),true);h.step(1);assert.equal(ic.active(h.s),null);}
  assert.equal(ic.data(h.s).orders.length,2);assert.equal(h.road.available(h.s),false);assert.equal(h.road.start(h.s),false);h.roundtrip();
});

test('original caravan pays materials on departure and delivers only to the construction account, with exact cargo conservation',()=>{
  const h=audit(create()),d=begin(h),{s,trade}=h;h.until(()=>trade.active(s),600);const o=trade.active(s);
  assert.deepEqual(clone(o.works.cargo),{wood:32});assert.equal(o.assetId,trade.asset(s).id);assert.deepEqual(clone(d.buffer),{});h.roundtrip();
  h.until(()=>o.arrivedAt!==null,600);assert.deepEqual(clone(d.buffer),{wood:32});assert.equal(o.cargo.wood,undefined);assert.equal(d.receipts[0].orderId,o.id);
  assert.equal(d.startedAt,null);assert.equal(h.road.staff(s),0);h.roundtrip();
  trade.cancel(s);h.until(()=>o.returnedAt!==null,600);assert.deepEqual(clone(d.buffer),{wood:32});assert.equal(h.road.data(s).receipts.length,1);h.roundtrip();
});

test('ordinary trade failure still delivers the paid project material and returns only the original trade goods',()=>{
  const h=audit(create()),d=begin(h),{s,trade}=h;h.until(()=>trade.active(s),600);const o=trade.active(s);trade.cancel(s);
  h.until(()=>o.outboundSeconds===trade.duration(s,o)-1,600);
  // Independent synthetic supply failure; never imported into the natural browser.
  trade.source(s).stores.food=0;h.step(1);assert.equal(o.exchange,false);assert.deepEqual(clone(d.buffer),{wood:32});assert.equal(o.cargo.wood,undefined);
  assert.deepEqual(clone(o.cargo),clone(trade.cargo(o.publicDuties)));h.roundtrip();h.until(()=>o.returnedAt!==null,600);assert.equal(d.receipts.length,1);h.roundtrip();
});

test('six physical consignments precede 600 actual local work seconds and a real maintenance payment',()=>{
  const h=building(),d=h.road.data(h.s),n=h.trade.source(h.s);assert.equal(d.receipts.length,6);assert.equal(d.worked,0);assert.equal(d.completedAt,null);
  assert.deepEqual(clone(d.buffer),clone(h.ctx.CivilCorridorContent.materials));assert.equal(h.road.staff(h.s),2);
  assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)+h.ctx.CivilOrigins.sourceStaff(h.s,d.sourceId)<=h.ctx.CivilPopulation.workforce(n.cohorts));
  const done=finished(),built=done.road.data(done.s);assert.equal(built.worked,600);assert.deepEqual(clone(built.buffer),{});assert.deepEqual(clone(built.consumed),clone(done.ctx.CivilCorridorContent.materials));
  assert.equal(done.road.staff(done.s),1);assert.equal(done.road.profile(done.s).baseDuration,180);assert.equal(built.maintenance.at(-1).paid,true);done.roundtrip();
});

test('local shortages pause paid construction without replacing residents or inventing work seconds',()=>{
  const h=building(),d=h.road.data(h.s),n=h.trade.source(h.s),cohorts=clone(n.cohorts),health=n.health;
  n.health=50;h.step(7);assert.equal(d.worked,0);assert.equal(h.road.staff(h.s),0);assert.deepEqual(clone(n.cohorts),cohorts);h.roundtrip();
  n.health=health;h.step(1);assert.equal(d.worked,1);assert.equal(d.work[0].from,d.startedAt+8);h.roundtrip();
});

test('completion never shortens an existing order; only the next paid departure uses its recorded maintenance receipt',()=>{
  const h=building(),{s,trade,road}=h,d=road.data(s);h.until(()=>!trade.active(s),600);assert.equal(trade.schedule(s),true);h.until(()=>trade.active(s),600);const old=trade.active(s);trade.cancel(s);
  assert.equal(old.corridor,undefined);assert.equal(trade.duration(s,old),240);h.until(()=>d.completedAt!==null,600);
  assert.equal(trade.duration(s,old),240);assert.equal(old.returnedAt,null);h.roundtrip();h.until(()=>old.returnedAt!==null,600);
  assert.equal(trade.schedule(s),true);h.until(()=>trade.active(s),600);const next=trade.active(s);trade.cancel(s);
  assert.equal(next.corridor.completedAt,d.completedAt);assert.equal(next.corridor.baseDuration,180);assert.equal(trade.duration(s,next),180);h.roundtrip();
  h.until(()=>next.returnedAt!==null,600);assert.ok(next.returnedAt-next.departedAt>=390);h.roundtrip();
});

test('missing partner maintenance spends nothing at home and recovery affects future quotes only',()=>{
  const h=finished(),{s,road,trade}=h,settle=road.settle.bind(road);let injected=false;
  road.settle=state=>{if(state!==s||injected)return settle(state);injected=true;const source=trade.source(s),tools=source.stores.tools;source.stores.tools=0;const before=clone([s.stores,source.stores]);const flow=settle(state);assert.deepEqual(clone([s.stores,source.stores]),before);source.stores.tools=tools;return flow;};
  h.step(10);road.settle=settle;assert.equal(injected,true);assert.equal(road.data(s).maintenance.at(-1).paid,false);assert.equal(trade.departureDuration(s),240);h.roundtrip();
  h.step(10);assert.equal(trade.departureDuration(s),180);h.roundtrip();
});

test('forged cargo, construction receipts, unworked completion and unsupported faster orders are rejected',()=>{
  const h=finished(),{s,road}=h;for(const mutate of [d=>d.buffer.wood=1,d=>d.receipts[0].cargo.wood++,d=>d.worked--,d=>d.work[0].from--,d=>d.completedAt--,d=>d.maintenance.at(-1).costs.home.parts=0]){const bad=clone(s);mutate(bad.civilization.corridor);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
  const bad=clone(s),o=bad.civilization.commerce.orders.at(-1);o.corridor={completedAt:road.data(s).completedAt,maintainedAt:road.data(s).maintenance.at(-1).at,baseDuration:180};assert.throws(()=>road.validate(bad),/道路/);
  const legacy=clone(raw);legacy.civilization.commerce.orders.at(-1).works={agreedAt:legacy.civilization.elapsed,cargo:{wood:32}};assert.throws(()=>road.validate(legacy),/道路/);
});
