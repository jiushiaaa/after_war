const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');

// Exact browser export 62, copied without changing any bytes. These tests run
// the real index/adapter headlessly; their continuation is not browser play.
// No production, transport, demographic or service owner is stubbed.
const raw=fs.readFileSync(path.join(__dirname,'fixtures/natural-return-bottleneck.json'));
const exact=JSON.parse(raw).state;
const create=()=>harness(exact);
const cart=h=>h.s.civilization.regions.shipments.find(p=>p.id===1638);
const oldOrder=h=>h.f.data(h.s).orders.find(o=>o.id==='1:70:rail');
const oldPeriod=h=>h.f.data(h.s).periods.find(p=>p.id==='1:70');

test('the original return-bottleneck checkpoint decodes and initializes without changing any saved asset or record',()=>{
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),'127330f3224cf979409352841b10d9b9af14f0231d46cac1f549fa7361844e92');
  const h=create();assert.equal(h.s.civilization.elapsed,118430);assert.deepEqual(clone(h.s),exact);
  const decoded=h.ctx.CivilPlatform.decode(raw.toString('utf8'));assert.deepEqual(clone(decoded),exact);h.roundtrip();
  assert.equal(cart(h).status,'loading');assert.equal(cart(h).legStartedAt,115248);
  assert.equal(oldOrder(h).loadedAt,null);assert.equal(h.s.civilization.regions.routes.rail.assigned,2);
});

test('the first real tick loads twelve paid wood on the existing cart despite the depleted tool stock',()=>{
  const h=create(),{s,f,r}=h,n=s.civilization.regions.nodes.rail,p=cart(h),before=clone(n.stores),home=clone(s.stores);
  assert.ok(n.stores.tools<1e-8);assert.ok(n.stores.coal<1e-8);
  assert.equal(f.reserveCheck(s,'rail',{wood:12}),false,'the full outbound guard still protects all local essentials');
  assert.equal(f.contributionCheck(s,'rail',{wood:12}),true);
  const receipts=f.data(s).receipts.length;h.step(1);
  assert.equal(cart(h),p);assert.equal(p.status,'moving');assert.equal(p.remaining,90);assert.equal(p.legStartedAt,118431);
  assert.equal(p.legDuration,90);assert.deepEqual(clone(p.cargo),{wood:12});assert.equal(oldOrder(h).status,'inbound');
  assert.equal(oldOrder(h).shipmentId,1638);assert.equal(oldOrder(h).loadedAt,118431);
  assert.equal(f.data(s).receipts.length,receipts+1);
  for(const key of Object.keys(before))near(n.stores[key],before[key]-(key==='wood'?12:0),key);
  assert.deepEqual(clone(s.stores),home,'return loading does not charge home again');
  const once=JSON.stringify(s);assert.equal(r.loadReturn(s,p),false);assert.equal(f.loadReturn(s,p),false);assert.equal(f.loadReturn(s,clone(p)),false);assert.equal(JSON.stringify(s),once);h.roundtrip();
});

test('a mid-return reload preserves the paid cargo, exact ninety-second trip and one actual home receipt',()=>{
  const original=create();original.step(1);const loaded=original.roundtrip();original.step(89);loaded.step(89);
  assert.deepEqual(clone(loaded.s),clone(original.s));assert.equal(cart(original).remaining,1);assert.equal(oldOrder(original).status,'inbound');
  const home=original.s.stores.wood,p=cart(original);original.step(1);loaded.step(1);
  assert.deepEqual(clone(loaded.s),clone(original.s));assert.equal(cart(original),undefined);
  assert.equal(oldOrder(original).returnedAt,118521);assert.equal(oldOrder(original).status,'complete');near(original.s.stores.wood,home+12);
  const receipt=original.f.legReceipt(original.s,oldOrder(original),'back');assert.equal(receipt.paidAt,118431);assert.equal(receipt.deliveredAt,118521);
  const once=JSON.stringify(original.s);assert.equal(original.f.receive(original.s,p),false);assert.equal(original.r.arrive(original.s,p),false);assert.equal(JSON.stringify(original.s),once);original.roundtrip();
});

test('a late physical return completes its old order while retaining the original missed budget history',()=>{
  const h=create(),period=clone(oldPeriod(h)),orders=h.f.data(h.s).orders.filter(o=>o.node==='rail').length;
  assert.ok(period.missed.includes('rail'));assert.equal(period.closedAt,period.endsAt);assert.ok(period.endsAt<h.s.civilization.elapsed);
  h.step(91);assert.equal(oldOrder(h).status,'complete');assert.ok(oldOrder(h).returnedAt>period.endsAt);
  assert.deepEqual(clone(oldPeriod(h)),period);assert.equal(h.f.data(h.s).orders.filter(o=>o.node==='rail').length,orders,'returning an old cart does not issue a replacement order on that route');h.roundtrip();
});

test('actual return wood is still required and a shortage leaves every warehouse and receipt unchanged',()=>{
  for(const amount of [0,11.99]){
    const h=create(),{s,f,r}=h,n=s.civilization.regions.nodes.rail,p=cart(h);
    // Explicit shortage branch of the raw checkpoint, not a natural-play claim.
    n.stores.wood=amount;const before=JSON.stringify(s);
    assert.equal(r.loadReturn(s,p),false);assert.equal(f.loadReturn(s,p),false);assert.equal(p.status,'loading');assert.equal(JSON.stringify(s),before);h.ctx.CivilPlatform.validate(s);
  }
});

test('zero unrelated local reserves never waive the actual wood price or allow a repeated return payment',()=>{
  const h=create(),{s,r}=h,n=s.civilization.regions.nodes.rail,p=cart(h);
  // Explicit boundary inputs: the contribution removes wood only. A temporary
  // lack of food, medicine, tools or fuel must not seize its sole supply cart.
  for(const key of ['food','medicine','tools','coal'])n.stores[key]=0;n.stores.wood=12;
  const before=clone(n.stores);assert.equal(r.loadReturn(s,p),true);near(n.stores.wood,0);
  for(const key of Object.keys(before))if(key!=='wood')near(n.stores[key],before[key]);
  const once=JSON.stringify(s);assert.equal(r.loadReturn(s,p),false);assert.equal(JSON.stringify(s),once);h.roundtrip();
});

test('the untouched checkpoint resumes paid trade, tool and coal deliveries, and completes its existing housing project through actual transport and work',t=>{
  const h=create(),{s,r,m}=h,c=s.civilization,n=c.regions.nodes.rail,initialPopulation=n.population,initialBeds=m.capacity(s,'rail');
  const initialReceipts=[...c.municipal.nodes.rail.project.receipts],deliveries=[],departures=[];
  const credit=r.credit.bind(r);r.credit=(stores,cargo)=>{if(stores===n.stores)deliveries.push({at:c.elapsed,cargo:clone(cargo)});return credit(stores,cargo);};
  const launch=r.launch.bind(r);r.launch=(state,id)=>{const before=clone(state.stores),ok=launch(state,id);if(ok&&id==='rail'){
    const p=state.civilization.regions.shipments.find(p=>p.route==='rail');
    departures.push({at:c.elapsed,id:p.id,purpose:p.purpose,cargo:clone(p.cargo),paid:Object.fromEntries(Object.keys(before).map(key=>[key,before[key]-(state.stores[key]||0)]))});
  }return ok;};
  h.until(()=>c.municipal.nodes.rail.completed.some(p=>p.id===12),3000);
  const trade=departures.find(p=>p.purpose==='trade');assert.ok(trade);assert.equal(trade.at,118530);assert.deepEqual(trade.cargo,{food:12,coal:2,tools:1});
  near(trade.paid.coal,2);near(trade.paid.tools,1);assert.ok(trade.paid.food>12,'the cart also pays its real journey food');
  assert.ok(deliveries.some(p=>p.at===118620&&p.cargo.coal===2&&p.cargo.tools===1));
  const project=c.municipal.nodes.rail.project,newReceipts=project.receipts.filter(id=>!initialReceipts.includes(id));
  assert.equal(project.id,12);assert.equal(project.status,'complete');assert.equal(newReceipts.length,3);
  const materials={};for(const id of newReceipts){const trip=departures.find(p=>p.id===id);assert.ok(trip);assert.equal(trip.purpose,'municipal');for(const [key,n]of Object.entries(trip.cargo)){materials[key]=(materials[key]||0)+n;assert.ok(trip.paid[key]+1e-7>=n,'construction cargo came out of home');}}
  assert.deepEqual(materials,{wood:244,iron:60,parts:20,tools:20});
  assert.equal(c.municipal.nodes.rail.completed.find(p=>p.id===12).completedAt,121067);assert.equal(c.elapsed,121067);
  assert.equal(m.capacity(s,'rail'),initialBeds+96);assert.equal(n.population,initialPopulation);assert.equal(n.population,116);
  assert.equal(oldOrder(h).status,'complete');assert.ok(oldPeriod(h).missed.includes('rail'));
  for(const stores of [s.stores,...Object.values(c.regions.nodes).map(n=>n.stores)])assert.ok(Object.values(stores).every(value=>Number.isFinite(value)&&value>=0));h.roundtrip();
  t.diagnostic('Headless raw62 continuation: original cart paid wood at 118431 and returned 118521; trade delivered coal/tools 118620; three real construction loads completed project 12 at 121067; rail 116 residents, 212 beds.');
});
