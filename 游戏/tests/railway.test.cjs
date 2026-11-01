const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows国家居留公约治理恢复13.json'))).state;
function create(saved=raw){const h=harness(saved);h.rail=h.ctx.CivilRailway;return h;}
let builtSnapshot,activeSnapshot;
function built(){if(!builtSnapshot){const h=create(),{s,ctx,v}=h,before=clone(s.stores),cost=ctx.CivilText.research.railway_engineering.cost;
  ctx.Civilization.research('railway_engineering');for(const [k,n]of Object.entries(cost))near(s.stores[k],before[k]-n);
  h.until(()=>s.civilization.tech.railway_engineering,610);h.until(()=>ctx.CivilNation.operational(s),6000);
  assert.equal(v.startProject(s,'rail','railfreight'),true);h.until(()=>v.data(s,'rail').project.status==='complete',12000);
  h.roundtrip();builtSnapshot=clone(s);
}return create(builtSnapshot);}
function active(){if(!activeSnapshot){const h=built();assert.equal(h.rail.request(h.s,'rail'),true);h.until(()=>h.rail.modeAt(h.s,'rail')==='rail',6000);h.roundtrip();activeSnapshot=clone(h.s);}return create(activeSnapshot);}

test('national rail stays absent from an unchanged old export and requires actual research and construction',()=>{
  const h=create();assert.deepEqual(clone(h.s),raw);assert.equal(h.rail.data(h.s),undefined);assert.equal(h.rail.request(h.s,'rail'),false);assert.equal(h.v.startProject(h.s,'rail','railfreight'),false);h.roundtrip();
  const early=harness();assert.equal(early.ctx.CivilCatalog.researchAvailable(early.s,'railway_engineering'),false);
  const b=built(),asset=b.rail.asset(b.s);assert.equal(asset.workedSeconds,600);assert.ok(asset.completedAt-asset.startedAt>=600);assert.deepEqual(clone(asset.paid),clone(b.ctx.CivilServiceContent.facilities.railfreight.cost));assert.ok(asset.receipts.length>=6);
  assert.equal(b.v.startProject(b.s,'home','railfreight'),false);assert.equal(b.v.startProject(b.s,'river','railfreight'),false);assert.equal(b.s.civilization.regions.routes.rail.travel,90);assert.equal(b.rail.modeAt(b.s,'rail'),'road');
});

test('a requested rail switch waits for the original vehicle, then reserves four existing workers without changing cargo',()=>{
  const h=built(),{s,r,rail}=h;h.until(()=>r.routeBusy(s,'rail'),300);const ship=s.civilization.regions.shipments.find(x=>x.route==='rail'),before=clone(ship);
  assert.equal(rail.request(s,'rail'),true);assert.deepEqual(clone(ship),before);assert.equal(rail.modeAt(s,'rail'),'road');h.roundtrip();
  h.until(()=>rail.modeAt(s,'rail')==='rail',6000);assert.equal(s.civilization.regions.routes.rail.assigned,4);assert.equal(s.civilization.regions.routes.rail.travel,45);assert.equal(s.civilization.regions.routes.rail.capacity,128);assert.equal(r.routeBusy(s,'rail'),false);h.roundtrip();
});

test('rail dispatch really consumes additional fuel and maintenance; ordinary cargo only arrives after 45 seconds',()=>{
  const h=active(),{s,r,rail}=h,launch=r.launch;let paid;
  r.launch=function(state,id){const before=clone(state.stores),ok=launch.call(this,state,id);if(ok&&state===s&&id==='rail'){
    const ship=state.civilization.regions.shipments.find(x=>x.route===id);for(const [k,n]of Object.entries(this.dispatchCost(state,id,ship.cargo)))near(state.stores[k],before[k]-n);
    if(ship.purpose==='trade')paid=ship;
  }return ok;};
  h.until(()=>!!paid,1200);r.launch=launch;assert.equal(paid.remaining,45);const initial=clone(paid.cargo),at=s.civilization.elapsed;
  h.step(44);assert.equal(paid.phase,'outbound');assert.equal(paid.remaining,1);h.step(1);assert.notEqual(paid.phase,'outbound');assert.equal(s.civilization.elapsed-at,45);assert.ok(Object.values(initial).some(n=>n>0));h.roundtrip();
});

test('rail activation waits for spare staff and a queued switch can be cancelled without changing either mode or assets',()=>{
  const h=built(),{s,r,rail}=h;h.until(()=>!r.routeBusy(s,'rail'),600);
  const workers=s.game.workers.transporter;s.game.workers.transporter=6;
  const stores=clone(s.stores);assert.equal(rail.request(s,'rail'),true);assert.equal(rail.modeAt(s,'rail'),'road');assert.match(rail.status(s),/4名运输工/);assert.equal(s.civilization.regions.routes.rail.assigned,2);h.roundtrip();
  assert.equal(rail.cancel(s),true);assert.equal(rail.data(s).request,null);assert.deepEqual(clone(s.stores),stores);s.game.workers.transporter=workers;h.roundtrip();
});

test('missing rail fuel cannot debit other stocks or create a shipment, and a short crew holds the paid train',()=>{
  const h=active(),{s,r}=h,c=s.civilization;h.until(()=>!r.routeBusy(s,'rail'),600);const coal=s.stores.coal;s.stores.coal=0;const before=clone(s.stores),next=c.regions.nextShipment;
  assert.equal(r.launch(s,'rail'),false);assert.deepEqual(clone(s.stores),before);assert.equal(c.regions.nextShipment,next);assert.equal(r.routeBusy(s,'rail'),false);s.stores.coal=coal;
  h.until(()=>r.routeBusy(s,'rail'),300);const ship=c.regions.shipments.find(x=>x.route==='rail'),remaining=ship.remaining,workers=s.game.workers.transporter;
  // Explicit labor-shortage fixture, not natural progress. Restore only test input.
  s.game.workers.transporter=3;h.step(5);assert.equal(ship.remaining,remaining);s.game.workers.transporter=workers;h.step(1);assert.equal(ship.remaining,remaining-1);h.roundtrip();
});

test('common obligations use the original rail vehicle, preserve paid invoices, and remain valid after returning to road mode',()=>{
  const h=active(),{s,rail}=h;let order;
  h.until(()=>!!(order=s.civilization.finance.orders.find(o=>o.node==='rail'&&o.travel===45&&o.status==='complete')),1800);
  near(order.paid.coal,2);near(order.paid.parts,.15);near(order.paid.tools,h.ctx.CivilFinanceContent.out.tools+.05);assert.ok(order.closedAt>=order.dispatchedAt+90);
  const original=clone(order);assert.equal(rail.request(s,'road'),true);h.until(()=>rail.modeAt(s,'rail')==='road',600);assert.equal(s.civilization.regions.routes.rail.assigned,2);assert.equal(s.civilization.regions.routes.rail.travel,90);assert.deepEqual(clone(order),original);h.roundtrip();
});

test('rail relief can return its undelivered cargo, retaining spent fuel and old road receipts',()=>{
  const h=active(),{s,rail}=h,relief=h.ctx.CivilRelief;assert.equal(relief.request(s,'rail'),true);const o=relief.active(s,'rail');h.until(()=>o.status==='outbound',1200);
  near(o.paid.coal,o.cargo.coal+2);near(o.paid.parts,.15);assert.equal(o.travel,45);h.step(10);assert.equal(relief.requestReturn(s,o.id),true);const before=clone(s.stores),arrive=relief.arrive;let refunded=false;
  relief.arrive=function(state,p){const stock=clone(state.stores),copy=clone(p.cargo),ok=arrive.call(this,state,p);if(ok&&state===s&&o.status==='cancelled'){for(const [k,n]of Object.entries(copy))near(state.stores[k],stock[k]+n);refunded=true;}return ok;};
  h.until(()=>o.status==='cancelled',100);relief.arrive=arrive;assert.ok(refunded);assert.ok(o.returnedAt>=o.cancelledAt+10);assert.ok(before.food>0);
  assert.equal(rail.request(s,'road'),true);h.until(()=>rail.modeAt(s,'rail')==='road',100);h.roundtrip();
});

test('rail mode rejects fabricated assets, short crews, altered times, and a historical switch across a paid voyage',()=>{
  const h=active(),good=clone(h.s);
  for(const mutate of [s=>s.civilization.regions.routes.rail.assigned=2,s=>s.civilization.regions.routes.rail.travel=1,s=>s.civilization.railway.changes[0].assetId=999,s=>s.civilization.services.nodes.rail.completed.find(x=>x.type==='railfreight').paid.steel=0,s=>s.civilization.railway.request={mode:'rail',requestedAt:s.civilization.elapsed}]){
    const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
  }
  h.ctx.CivilPlatform.validate(good);
  let order;h.until(()=>!!(order=h.s.civilization.finance.orders.find(o=>o.node==='rail'&&o.travel===45&&o.status==='outbound')),1200);h.step(10);
  const crossing=clone(h.s),c=crossing.civilization;c.railway.changes.push({mode:'road',requestedAt:c.elapsed,at:c.elapsed,assetId:h.rail.asset(h.s).id});c.regions.routes.rail.travel=90;c.regions.routes.rail.assigned=2;
  assert.throws(()=>h.ctx.CivilPlatform.validate(crossing),/铁路/);
});
