const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');

// Browser export 67 is copied byte-for-byte. It already includes the player's
// empty return and route reopening. All continuations below use the shipped
// adapter; no stocks, health, jobs, residents or green service facts are added.
const raw=fs.readFileSync(path.join(__dirname,'fixtures/natural-trade-return-bottleneck.json'));
const exact=JSON.parse(raw).state;
const create=()=>harness(exact);
const rail=h=>h.s.civilization.regions.nodes.rail;
const shipment=h=>h.s.civilization.regions.shipments.find(p=>p.route==='rail');
let loadingSnapshot;
function waiting(){
  if(!loadingSnapshot){const h=create();h.until(()=>shipment(h)?.purpose==='trade'&&shipment(h)?.status==='loading',600);loadingSnapshot=clone(h.s);}
  return harness(loadingSnapshot);
}

test('raw67 preserves the real zero-health crisis, completed manual return and reopened route across full-index initialization',()=>{
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),'2158c31ac3dbffe44335941eee9663659219817dc2cd8165afcb452fc667f3a3');
  const h=create(),{s}=h;assert.deepEqual(clone(s),exact);assert.equal(s.civilization.elapsed,134075);
  assert.equal(rail(h).population,114);assert.equal(rail(h).health,0);assert.equal(rail(h).stores.food,0);assert.ok(rail(h).stores.tools<1e-8);
  assert.equal(s.civilization.regions.routes.rail.enabled,true);assert.equal(shipment(h),undefined);
  assert.equal(s.civilization.municipal.nodes.rail.project.remaining,0);assert.equal(s.civilization.municipal.nodes.rail.project.buffer.wood,384);h.roundtrip();
});

test('the first ordinary trade pays real iron and parts and returns on its original cart without requiring unrelated meal stock',()=>{
  const h=waiting(),{s,r}=h,n=rail(h),p=shipment(h),before=clone(n.stores),home=clone(s.stores),id=p.id;
  assert.equal(p.id,1868);assert.equal(s.civilization.elapsed,134364);assert.ok(n.stores.food<r.foodPopulation(n)*.24);
  assert.equal(r.canPay(n.stores,{iron:3,parts:1},r.foodPopulation(n)*.24),false,'the old unconditional meal check would block this real return');
  assert.equal(r.loadReturn(s,p),true);assert.equal(shipment(h),p);assert.equal(p.id,id);assert.equal(p.remaining,90);assert.equal(p.status,'moving');
  assert.deepEqual(clone(p.cargo),{iron:3,parts:1});for(const key of Object.keys(before))near(n.stores[key],before[key]-({iron:3,parts:1}[key]||0),key);
  assert.deepEqual(clone(s.stores),home);const once=JSON.stringify(s);assert.equal(r.loadReturn(s,p),false);assert.equal(r.loadReturn(s,clone(p)),false);assert.equal(JSON.stringify(s),once);h.roundtrip();
});

test('actual iron or parts shortages still hold the cart without taking goods or granting a return',()=>{
  for(const [key,amount]of Object.entries({iron:3,parts:1})){
    const h=waiting(),{s,r}=h,p=shipment(h);
    // Declared shortage branch of the natural loading checkpoint.
    rail(h).stores[key]=amount-.01;const before=JSON.stringify(s);
    assert.equal(r.loadReturn(s,p),false);assert.equal(p.status,'loading');assert.equal(JSON.stringify(s),before);h.ctx.CivilPlatform.validate(s);
  }
});

test('paid return cargo survives reload, consumes all ninety travel seconds and credits home only once',()=>{
  const h=waiting(),{s,r}=h,p=shipment(h);assert.equal(r.loadReturn(s,p),true);const loaded=h.roundtrip();
  h.step(89);loaded.step(89);assert.deepEqual(clone(loaded.s),clone(s));assert.equal(p.remaining,1);assert.ok(s.civilization.regions.shipments.includes(p));
  const credits=[],credit=r.credit.bind(r);r.credit=(stores,cargo)=>{if(stores===s.stores)credits.push(clone(cargo));return credit(stores,cargo);};
  h.step(1);loaded.step(1);assert.deepEqual(clone(loaded.s),clone(s));assert.equal(s.civilization.regions.shipments.includes(p),false);
  assert.equal(credits.filter(x=>x.iron===3&&x.parts===1).length,1);const once=JSON.stringify(s);assert.equal(r.arrive(s,p),false);assert.equal(JSON.stringify(s),once);h.roundtrip();
});

test('the existing manual empty-return and reopen actions preserve delivered goods and resume the same finite route',()=>{
  const h=waiting(),{s,r}=h,p=shipment(h),before=clone(rail(h).stores),trips=s.civilization.regions.routes.rail.completedTrips;
  assert.equal(r.returnShipment(s,p.id),true);assert.equal(p.phase,'empty');assert.deepEqual(clone(p.cargo),{});assert.equal(p.remaining,90);
  assert.equal(s.civilization.regions.routes.rail.enabled,false);assert.deepEqual(clone(rail(h).stores),before);
  h.step(90);assert.equal(s.civilization.regions.shipments.includes(p),false);assert.equal(s.civilization.regions.routes.rail.completedTrips,trips);
  assert.equal(s.civilization.regions.routes.rail.assigned,0);assert.equal(r.setRoute(s,'rail',true),true);h.until(()=>!!shipment(h),120);
  assert.equal(s.civilization.regions.routes.rail.assigned,2);assert.ok(shipment(h).id>p.id);assert.equal(s.civilization.regions.shipments.filter(p=>p.route==='rail').length,1);h.roundtrip();
});

test('raw67 transport recovers and delivers the remaining construction goods, while its independent zero-health construction barrier is reported without gifts',t=>{
  const h=create(),{s,r,m}=h,c=s.civilization,n=rail(h),departures=[],deliveries=[];let beganAt=null,maxHealth=0;
  const launch=r.launch.bind(r);r.launch=(state,id)=>{const before=clone(state.stores),ok=launch(state,id);if(ok&&id==='rail'){
    const p=shipment(h);departures.push({id:p.id,purpose:p.purpose,cargo:clone(p.cargo),paid:Object.fromEntries(Object.keys(before).map(key=>[key,before[key]-(state.stores[key]||0)]))});
  }return ok;};
  const credit=r.credit.bind(r);r.credit=(stores,cargo)=>{if(stores===n.stores)deliveries.push({at:c.elapsed,cargo:clone(cargo)});return credit(stores,cargo);};
  for(let i=0;i<3600;i++){h.step(1);maxHealth=Math.max(maxHealth,n.health);if(beganAt===null&&c.municipal.nodes.rail.project.status==='building')beganAt=c.elapsed;}
  const project=c.municipal.nodes.rail.project;assert.equal(beganAt,135313);assert.equal(c.elapsed,137675);
  assert.ok(deliveries.filter(p=>p.cargo.coal===2&&p.cargo.tools===1&&p.cargo.food===12).length>=8,'actual supply carts keep arriving');
  const cargo={};for(const id of [1871,1884]){assert.ok(project.receipts.includes(id));const trip=departures.find(p=>p.id===id);assert.equal(trip.purpose,'municipal');for(const [key,n]of Object.entries(trip.cargo)){cargo[key]=(cargo[key]||0)+n;assert.ok(trip.paid[key]+1e-7>=n);}}
  assert.deepEqual(cargo,{wood:116,iron:60,parts:20,tools:20});assert.equal(project.status,'building');assert.equal(project.remaining,360);
  assert.equal(n.workers.builder,2);assert.ok(maxHealth<30);assert.equal(n.health,0);assert.equal(n.stores.food,0);assert.equal(n.population,108,'ordinary annual aging continues during the crisis');
  const before=JSON.stringify(s);assert.equal(m.startProject(s,'rail','toolworks'),false);assert.equal(m.startProject(s,'rail','salvageyard'),false);assert.equal(JSON.stringify(s),before);
  for(const stores of [s.stores,...Object.values(c.regions.nodes).map(n=>n.stores)])assert.ok(Object.values(stores).every(value=>Number.isFinite(value)&&value>=0));h.roundtrip();
  t.diagnostic('Headless raw67: 3600 real adapter seconds, ongoing paid trade and all housing materials delivered at 135313; health remains below 30, so the 360 work seconds are correctly not granted. Toolworks/salvageyard remain blocked by the unfinished housing project; recovery of health requires a separate supported intervention.');
});
