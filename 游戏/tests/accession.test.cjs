const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows共同护送返城与职责恢复32.json'),'utf8')).state;
function create(saved=raw){const h=harness(saved);h.a=h.ctx.CivilAccession;h.trade=h.ctx.CivilCommerce;return h;}
function approved(){const h=create();h.s.civilization.pending='accessionCharter';h.ctx.Civilization.showPending();h.click('propose');h.s.civilization.pending='accessionCharter';h.ctx.Civilization.showPending();h.click('approve');return h;}
let readySnapshot;
function ready(){if(!readySnapshot){const h=approved();h.until(()=>h.a.ready(h.s),1800);h.roundtrip();readySnapshot=clone(h.s);}return create(readySnapshot);}
function joined(){const h=ready();assert.equal(h.a.join(h.s),true);return h;}
function departing(){const h=joined();assert.equal(h.trade.schedule(h.s),true);h.until(()=>!!h.trade.active(h.s),100);assert.equal(h.trade.cancel(h.s),true);return h;}

test('old source records remain exact; separate approvals spend only their own warehouses and reserve real adults',()=>{
  const h=create(),{s,a,trade}=h,n=trade.source(s);assert.deepEqual(clone(s),raw);h.roundtrip();
  const old=clone(n),home=clone(s.stores);assert.equal(a.propose(s),true);
  for(const [k,v]of Object.entries(h.ctx.CivilAccessionContent.signature.home))near(s.stores[k],home[k]-v);
  assert.deepEqual(clone(n),old);assert.equal(a.staff(s),0);assert.equal(a.capacityBonus(s),0);
  const knowledge=n.stores.knowledge;n.stores.knowledge=0;const failed=clone(s);assert.equal(a.approve(s),false);assert.deepEqual(clone(s),failed);n.stores.knowledge=knowledge;
  const before=clone(n.stores),adult=h.ctx.CivilPopulation.workforce(n.cohorts);assert.equal(a.approve(s),true);
  for(const [k,v]of Object.entries(h.ctx.CivilAccessionContent.signature.source))near(n.stores[k],before[k]-v);
  assert.equal(n.population,old.population);assert.deepEqual(clone(n.cohorts),old.cohorts);assert.equal(a.staff(s),2);assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)+h.ctx.CivilOrigins.sourceStaff(s,trade.sourceId(s))<=adult);h.roundtrip();
  const early=create(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows绕行完成与守备训练29.json'),'utf8')).state);
  assert.equal(early.a.available(early.s),false);assert.equal(early.a.propose(early.s),false);
});

test('actual continuous records qualify accession; membership counts existing residents and never copies people or stocks',()=>{
  const h=ready(),{s,a,trade}=h,d=a.data(s),source=clone(trade.source(s)),home=clone(s.stores),population=s.game.population,capacity=h.r.capacity(s),load=h.r.load(s),remaining=h.ctx.CivilOrigins.remaining(s,d.sourceId);
  assert.equal(d.stableSeconds,600);assert.ok(d.lastSettledAt-d.stableSince>=600);assert.equal(a.capacityBonus(s),0);
  assert.equal(a.join(s),true);assert.deepEqual(clone(trade.source(s)),source);assert.deepEqual(clone(s.stores),home);assert.equal(s.game.population,population);
  assert.equal(a.population(s),source.population);assert.equal(h.ctx.CivilNation.population(s),3192+source.population);assert.equal(h.r.capacity(s),capacity+2);assert.equal(h.r.load(s),load+1);
  assert.ok(h.ctx.CivilOrigins.remaining(s,d.sourceId)>remaining);assert.equal(h.ctx.CivilOrigins.remaining(s,d.sourceId),source.population-h.ctx.CivilOriginContent[d.sourceId].retained);
  assert.equal(d.firstPublicOrder,9);assert.equal(a.join(s),false);h.roundtrip();
});

test('either treasury shortage leaves both fee accounts unchanged and resets continuous qualification',()=>{
  for(const owner of ['home','source']){
    const h=ready(),{s,a}=h,settle=a.settle;
    // Isolated synthetic treasury shortages, never edits to natural play.
    a.settle=function(state){const stores=owner==='home'?s.stores:this.source(s).stores,knowledge=stores.knowledge;stores.knowledge=0;const before=clone([s.stores,this.source(s).stores]);const flow=settle.call(this,state);assert.deepEqual(clone([s.stores,this.source(s).stores]),before);assert.deepEqual(clone(flow),{});stores.knowledge=knowledge;return flow;};
    h.step(10);a.settle=settle;assert.equal(a.data(s).records.at(-1).paid,false);assert.equal(a.data(s).stableSeconds,0);assert.equal(a.ready(s),false);h.roundtrip();
    h.step(10);assert.equal(a.data(s).records.at(-1).paid,true);assert.equal(a.data(s).stableSeconds,0);h.until(()=>a.ready(s),600);h.roundtrip();
  }
});

test('public grants and contributions travel with the original caravan; source receives nothing before arrival and home waits for return',()=>{
  const h=joined(),{s,a,trade}=h,home=clone(s.stores),source=clone(trade.source(s).stores);assert.equal(trade.schedule(s),true);assert.equal(trade.dispatch(s),true);trade.cancel(s);const o=trade.active(s);
  for(const [k,v]of Object.entries(o.paid))near(s.stores[k],home[k]-v);assert.deepEqual(clone(o.cargo),{tools:14,medicine:4});
  near(trade.source(s).stores.food,source.food-6);near(trade.source(s).stores.tools,source.tools-.2);near(trade.source(s).stores.medicine,source.medicine);
  assert.equal(h.ctx.CivilOrigins.sourceStaff(s,a.data(s).sourceId),4);
  const tick=trade.tick;let arrived=false,returned=false;
  trade.tick=function(state){const before=clone([s.stores,this.source(s).stores]),arrival=o.arrivedAt,back=o.returnedAt;tick.call(this,state);
    if(arrival===null&&o.arrivedAt!==null){arrived=true;near(this.source(s).stores.food,before[1].food-132);near(this.source(s).stores.tools,before[1].tools+14);near(this.source(s).stores.medicine,before[1].medicine+4);assert.deepEqual(clone(s.stores),before[0]);}
    if(back===null&&o.returnedAt!==null){returned=true;near(s.stores.food,before[0].food+132);assert.deepEqual(clone(this.source(s).stores),before[1]);}
  };
  h.until(()=>o.arrivedAt!==null,700);assert.deepEqual(clone(o.cargo),{food:132});const reload=h.roundtrip();
  h.until(()=>o.returnedAt!==null,500);trade.tick=tick;reload.until(()=>reload.ctx.CivilCommerce.active(reload.s)===null,500);assert.deepEqual(clone(reload.s),clone(s));
  assert.ok(arrived&&returned);assert.equal(h.ctx.CivilOrigins.sourceStaff(s,a.data(s).sourceId),2);assert.deepEqual(clone(trade.data(s).orders.slice(0,8)),raw.civilization.commerce.orders);h.roundtrip();
});

test('a caravan already traveling prevents registration and keeps its original barter terms',()=>{
  const h=ready(),{s,a,trade}=h;assert.equal(trade.schedule(s),true);assert.equal(trade.dispatch(s),true);trade.cancel(s);const o=trade.active(s);
  assert.equal(a.join(s),false);assert.equal(o.publicDuties,undefined);assert.deepEqual(clone(o.cargo),{tools:12});
  h.until(()=>o.returnedAt!==null,800);assert.equal(a.join(s),true);assert.equal(a.data(s).firstPublicOrder,10);assert.equal(o.publicDuties,undefined);h.roundtrip();
});

test('a source shortage rejects the whole exchange and returns original trade goods and public grants without refunding consumed supplies',()=>{
  const h=departing(),{s,trade}=h,o=trade.active(s);h.until(()=>o.outboundSeconds===239,600);const tick=trade.tick;
  // Deliberate shortage in an isolated rule fixture, never a natural save edit.
  trade.tick=function(state){const n=this.source(s),food=n.stores.food,tools=n.stores.tools,medicine=n.stores.medicine;n.stores.food=0;tick.call(this,state);n.stores.food=food;near(n.stores.tools,tools);near(n.stores.medicine,medicine);};
  h.step(1);trade.tick=tick;assert.equal(o.exchange,false);assert.deepEqual(clone(o.cargo),{tools:14,medicine:4});h.roundtrip();
  let refunded=false;trade.tick=function(state){const before=clone(s.stores),back=o.returnedAt;tick.call(this,state);if(back===null&&o.returnedAt!==null){refunded=true;near(s.stores.tools,before.tools+14);near(s.stores.medicine,before.medicine+4);near(s.stores.food,before.food);near(s.stores.wood,before.wood);}};
  h.until(()=>o.returnedAt!==null,500);trade.tick=tick;assert.ok(refunded);h.roundtrip();
});

test('budget suspension releases clerks, preserves membership and in-flight commitments, then requires fresh continuous records',()=>{
  const h=departing(),{s,a,trade}=h,o=trade.active(s),population=a.population(s),joinedAt=a.data(s).joinedAt;
  assert.equal(a.toggle(s,false),true);assert.equal(a.staff(s),0);assert.equal(a.capacityBonus(s),0);assert.equal(a.population(s),population);assert.equal(trade.schedule(s),false);h.roundtrip();
  h.until(()=>o.returnedAt!==null,800);assert.equal(a.data(s).joinedAt,joinedAt);assert.equal(h.ctx.CivilOrigins.sourceStaff(s,a.data(s).sourceId),0);
  assert.equal(a.toggle(s,true),true);assert.equal(a.data(s).stableSeconds,0);assert.equal(trade.schedule(s),false);
  h.until(()=>a.operational(s),1800);assert.equal(a.data(s).stableSeconds,600);assert.equal(trade.schedule(s),true);trade.cancel(s);h.roundtrip();
});

test('legal central and customary reforms reset readiness while existing public cargo keeps its original terms',()=>{
  const h=departing(),{s,a,trade}=h,o=trade.active(s),publicDuties=clone(o.publicDuties),society=h.ctx.CivilSociety;
  assert.equal(society.beginReform(s,'devolution'),true);h.ctx.Civilization.showPending();h.click('central');h.step(10);
  assert.equal(a.data(s).stableSeconds,0);assert.equal(a.capacityBonus(s),0);h.until(()=>o.returnedAt!==null,800);assert.deepEqual(clone(o.publicDuties),publicDuties);
  h.until(()=>a.operational(s),1800);assert.equal(a.capacityBonus(s),1);assert.deepEqual(clone(a.profile(s).grant),{medicine:2,tools:1});
  assert.equal(society.beginReform(s,'charter'),true);h.ctx.Civilization.showPending();h.click('custom');h.step(10);assert.equal(a.data(s).stableSeconds,0);
  h.until(()=>a.operational(s),2400);assert.equal(a.data(s).stableSeconds,900);assert.deepEqual(clone(a.data(s).records.at(-1).costs),{home:{knowledge:.15,wood:.4,tools:.04},source:{knowledge:.025,wood:.2}});h.roundtrip();
  const source=trade.source(s),id=a.data(s).sourceId;
  assert.match(h.ctx.CivilOrigins.sustainabilityReason(s,id,source.cohorts),/岁的居民至少须留守/);assert.equal(h.ctx.CivilOrigins.supplyReason(s,id,source.cohorts),null);
  assert.equal(h.ctx.CivilOrigins.quoteParty(s,id,24,{mode:'convoy',capacity:24}),null);assert.equal(a.operational(s),true);
});

test('corrupted approvals, invented qualification, unpaid public duties and duplicated grants are rejected',()=>{
  const h=departing(),good=clone(h.s);
  for(const mutate of [s=>s.civilization.accession.approvals.source.cost.knowledge=0,s=>s.civilization.accession.joiningStableSince++,s=>s.civilization.accession.records[0].stableSeconds=600,s=>s.civilization.accession.records.at(-1).staff=0,s=>s.civilization.accession.firstPublicOrder++,s=>delete s.civilization.commerce.orders.at(-1).publicDuties,s=>s.civilization.commerce.orders.at(-1).publicDuties.grant.tools=200,s=>s.civilization.commerce.orders.at(-1).publicDuties.contribution.food=999,s=>s.civilization.commerce.orders.at(-1).cargo.medicine=8,s=>delete s.civilization.accession]){const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
  h.roundtrip();
});
