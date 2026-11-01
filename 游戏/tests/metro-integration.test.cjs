const {test}=require('node:test');
const assert=require('node:assert/strict');
const {synthetic,prepared,ready,harness,census,clone,near}=require('./helpers/metro-fixture.cjs');
const issues=(h,code,id)=>h.metro.check(h.s).issues.some(x=>x.code===code&&(!id||x.nodeId===id));
function population(h,id,count){
  if(id==='home'){h.s.game.population=count;h.s.civilization.society.cohorts=census(count);h.ctx.CivilSociety.trimJobs(h.s);}
  else {const n=h.m.node(h.s,id);n.population=count;n.cohorts=census(count);h.m.planWorkers(h.s,id);}
}

test('the declared prebuilt foundation earns real routes, local city registration and current paid services before Metro',()=>{
  const raw=synthetic();assert.equal(raw.s.game.population+raw.m.node(raw.s,'river').population+raw.m.node(raw.s,'rail').population,3000);
  for(const id of ['river','rail']){assert.equal(raw.m.data(raw.s,id).city,false);assert.equal(raw.m.data(raw.s,id).economy,null);assert.equal(raw.s.civilization.regions.routes[id].completedTrips,0);}
  assert.equal(raw.s.civilization.services.nodes.home.water,null);assert.equal(raw.s.civilization.finance.orders.length,0);
  const h=prepared();
  for(const id of ['river','rail']){const m=h.m.data(h.s,id),route=h.s.civilization.regions.routes[id];assert.equal(m.city,true);assert.ok(route.completedTrips>0);assert.ok(m.economy.treatmentInputs.resources.medicine>0);assert.ok(m.economy.paidInputs.resources.tools>0);assert.ok(m.power.used<=m.power.generation);assert.ok(m.economy.productivePower>=4);}
  assert.ok(h.f.agreement(h.s));assert.equal(h.s.civilization.metro.formedAt,null);h.ctx.CivilPlatform.validate(h.s);
});

test('the two legacy rail mechanics cannot displace the two new genuinely powered mechanical jobs',()=>{
  const h=synthetic();h.step(20);const m=h.m.data(h.s,'rail'),n=h.m.node(h.s,'rail');
  assert.equal(m.baseWorkers.machinist,2);assert.ok(n.workers.machinist>=4);assert.ok(m.economy.productivePower>=4);assert.equal(m.economy.industry,true);
  assert.ok(m.economy.paidInputs.resources.iron>=n.workers.machinist*.5);assert.ok(m.power.used<=m.power.generation);assert.ok(m.economy.deltas.parts>0);
});

test('three independently supplied cities need sixty full ten-second intervals after the first qualifying boundary',t=>{
  const h=ready(),{s,metro}=h,start=s.civilization.elapsed,initial=clone(s.civilization.metro);
  assert.equal(metro.check(s).ok,true);assert.equal(initial.stableSeconds,0);assert.equal(initial.samples.length,3);
  assert.ok(metro.check(s).total>=3000);const history=s.civilization.finance.periods.filter(p=>p.closedAt!==null);
  assert.ok(history.some(p=>p.adminPayments.length===60&&p.missed.length===0));
  h.step(599);assert.equal(s.civilization.metro.stableSeconds,590);assert.equal(metro.canRegister(s),false);assert.notEqual(s.civilization.pending,'metroCharter');
  h.step(1);assert.equal(s.civilization.elapsed-start,600);assert.equal(s.civilization.metro.stableSeconds,600);assert.equal(s.civilization.pending,'metroCharter');
  const assets=JSON.stringify([s.stores,s.game,s.civilization.society,s.civilization.regions,s.civilization.services,s.civilization.finance]);
  h.click('register');assert.equal(s.civilization.metro.formedAt,s.civilization.elapsed);assert.deepEqual(clone(s.civilization.metro.formedMembers),['home','river','rail']);
  assert.equal(JSON.stringify([s.stores,s.game,s.civilization.society,s.civilization.regions,s.civilization.services,s.civilization.finance]),assets,'registration is a record, never a population or stock reward');
  h.roundtrip();t.diagnostic(`Synthetic prebuilt cities; all qualifications real: stable ${start} → ${s.civilization.elapsed}, total ${metro.check(s).total}, completed common orders ${s.civilization.finance.orders.filter(o=>o.status==='complete').length}.`);
});

test('2999 settled people, a 399-person member and real people still travelling cannot satisfy three-city population',()=>{
  const low=ready();population(low,'home',1000);population(low,'river',1000);population(low,'rail',999);assert.equal(low.metro.check(low.s).total,2999);assert.equal(issues(low,'total'),true);
  const small=ready();population(small,'home',1301);population(small,'river',1300);population(small,'rail',399);assert.equal(small.metro.check(small.s).total,3000);assert.equal(issues(small,'population','rail'),true);
  const travel=ready();population(travel,'home',1000);population(travel,'river',1000);population(travel,'rail',999);travel.s.civilization.urban.enabled=true;
  assert.equal(travel.u.dispatch(travel.s),true,travel.s.civilization.urban.status);const people=travel.s.civilization.urban.parties.reduce((n,p)=>n+travel.u.count(p.cohorts),0);
  assert.ok(people>0);assert.ok(2999+people>=3000);assert.equal(travel.metro.check(travel.s).total,2999);assert.equal(issues(travel,'total'),true);
});

test('historical city flags do not replace actual meals, teaching or powered machinery, and interruptions reset observation',()=>{
  for(const change of [h=>{h.s.game.workers.farmer=0;h.s.game.workers.hunter=0;h.s.stores.food=0;},h=>{h.s.game.workers.teacher=0;},h=>{h.s.game.workers.machinist=0;}]){
    const h=ready();h.step(20);assert.ok(h.s.civilization.metro.stableSeconds>0);change(h);h.step(10);
    assert.equal(h.s.civilization.urban.city,true);assert.equal(h.metro.check(h.s).ok,false);assert.equal(h.s.civilization.metro.stableSeconds,0);assert.equal(h.s.civilization.metro.formedAt,null);
  }
});

test('paid current water and current local electricity are required even with installed stations and full warehouses',()=>{
  const stale=ready(),service=stale.v.data(stale.s,'river');service.irrigation.at-=10;
  assert.equal(issues(stale,'water','river'),true);assert.ok(service.buildings.waterworks>0);assert.ok(service.water.capacity>0,'the next certificate does not replace this expired consumed service');
  const noPower=ready();noPower.s.game.workers.electrician=0;noPower.s.game.workers.utilityworker=0;noPower.step(20);
  assert.equal(noPower.s.civilization.industry.generation,0);assert.equal(noPower.s.civilization.services.nodes.home.economy.waterCapacity,0);assert.equal(noPower.metro.check(noPower.s).ok,false);assert.equal(noPower.s.civilization.metro.stableSeconds,0);
});

test('every warehouse retains its own 300-second food, medicine and real maintenance reserve',()=>{
  for(const id of ['home','river','rail'])for(const resource of ['food','medicine','tools','coal','parts','chemicals']){
    const h=ready(),need=h.metro.check(h.s).reserves[id][resource],store=id==='home'?h.s.stores:h.m.node(h.s,id).stores;
    assert.ok(need>0);store[resource]=need-.01;
    const result=h.metro.check(h.s);assert.equal(result.ok,false,`${id} ${resource}`);
    // The existing city gate protects its 20 parts first. A stock of 19.99 is
    // correctly refused there before Metro reaches its equal reserve floor.
    const codes=resource==='parts'&&need===20?['reserve','supply']:['reserve'];
    assert.ok(result.issues.some(x=>x.nodeId===id&&codes.includes(x.code)),`${id} ${resource}: ${result.reason}`);
  }
});

test('an unfinished budget, a real public pause and missing coordination fees cannot advance stability',()=>{
  const early=prepared();early.step(30);assert.equal(issues(early,'budget'),true);assert.equal(early.s.civilization.metro.stableSeconds,0);
  const paused=ready();paused.ledger('pause');paused.step(60);assert.equal(paused.f.agreement(paused.s).paused,true);assert.equal(paused.metro.check(paused.s).ok,false);assert.equal(paused.s.civilization.metro.stableSeconds,0);
  const unpaid=ready();unpaid.s.game.workers.teacher=0;unpaid.s.stores.knowledge=0;unpaid.step(10);
  assert.equal(issues(unpaid,'budget'),true);assert.equal(unpaid.s.civilization.metro.stableSeconds,0);assert.ok(!unpaid.f.period(unpaid.s).adminPayments.some(p=>p.at===unpaid.s.civilization.elapsed));
});

test('an actual common vehicle arriving exactly at period end preserves the same paid production observation, while one second late does not',()=>{
  for(const late of [0,1]){
    const h=ready(),start=h.s.civilization.elapsed,period=h.f.period(h.s),stableSince=h.s.civilization.metro.stableSince;
    // Explicit synthetic approval delay keeps the first two rotations as real
    // ordinary trade, then permits the paid common trip at the tested boundary.
    // No stock or clock is advanced; the single cart continues normal service.
    const nextCargo=h.f.nextCargo.bind(h.f);
    h.f.nextCargo=(s,id,capacity)=>id==='rail'&&s.civilization.elapsed<start+400?null:nextCargo(s,id,capacity);
    h.step(21);assert.equal(h.r.routeBusy(h.s,'rail'),false);
    const route=h.s.civilization.regions.routes.rail;assert.equal(route.dispatchIn,9);route.dispatchIn+=9+late;
    h.step(578);assert.equal(h.s.civilization.elapsed,start+599);assert.equal(h.s.civilization.metro.stableSeconds,590);
    const ship=h.s.civilization.regions.shipments.find(p=>p.route==='rail');
    assert.equal(ship.purpose,'common');assert.equal(ship.phase,'inbound');assert.equal(ship.remaining,late+1);
    const observe=h.metro.observe.bind(h.metro);let boundary;
    h.metro.observe=s=>{const result=observe(s);boundary={at:s.civilization.elapsed,result,issues:clone(h.metro.check(s).issues),sample:clone(s.civilization.metro.samples.at(-1)),stableSeconds:s.civilization.metro.stableSeconds};return result;};
    h.step(1);assert.equal(boundary.at,period.endsAt);assert.equal(boundary.result,false);assert.equal(boundary.stableSeconds,0);
    assert.ok(boundary.issues.length&&boundary.issues.every(x=>x.code==='budget'));
    assert.deepEqual(clone(h.s.civilization.metro.samples.at(-1)),boundary.sample,'finalization cannot rewrite the actual pre-arrival production census');
    const order=h.s.civilization.finance.orders.find(o=>o.id===ship.commonOrderId);
    if(late===0){
      assert.equal(order.returnedAt,period.endsAt);assert.equal(order.status,'complete');assert.deepEqual(clone(period.missed),[]);
      assert.equal(h.s.civilization.metro.stableSince,stableSince);assert.equal(h.s.civilization.metro.stableSeconds,600);assert.equal(h.metro.canRegister(h.s),true);
      h.roundtrip();
    }else{
      assert.equal(order.status,'inbound');assert.equal(h.s.civilization.metro.stableSeconds,0);assert.deepEqual(clone(period.missed),['rail']);
      h.step(1);assert.equal(order.returnedAt,period.endsAt+1);assert.deepEqual(clone(period.missed),['rail']);assert.equal(h.s.civilization.metro.stableSeconds,0);assert.equal(h.metro.canRegister(h.s),false);h.roundtrip();
    }
  }
});

test('repeated observation and previews are pure at the same boundary; reload resumes the exact next paid production',()=>{
  const h=ready();h.step(100);const before=JSON.stringify(h.s);
  for(let i=0;i<10;i++){h.metro.check(h.s);assert.equal(h.metro.observe(h.s),false);}
  assert.equal(JSON.stringify(h.s),before);const loaded=h.roundtrip();h.step(80);loaded.step(80);assert.deepEqual(clone(loaded.s),clone(h.s));
  const skipped=harness(h.s);skipped.s.civilization.elapsed+=600;skipped.metro.observe(skipped.s);
  assert.equal(skipped.s.civilization.metro.stableSeconds,0);assert.equal(skipped.s.civilization.metro.samples.length,0);assert.equal(skipped.metro.canRegister(skipped.s),false);
});

test('a stale native registration button rechecks changed supplies without a false success or reward',()=>{
  const h=ready();h.step(600);assert.equal(h.s.civilization.pending,'metroCharter');h.s.stores.medicine=0;const assets=JSON.stringify([h.s.stores,h.s.game,h.s.civilization.finance]);
  h.click('register');assert.equal(h.s.civilization.metro.formedAt,null);assert.equal(JSON.stringify([h.s.stores,h.s.game,h.s.civilization.finance]),assets);
  assert.ok(h.messages.some(x=>x.includes('供养或议事条件已有变化')));
});

test('actual births, retirement and a later election preserve the registered cities, common contracts and stored history',t=>{
  const h=ready();h.step(600);h.click('register');const m=clone(h.s.civilization.metro),generation=h.s.civilization.society.generation,populationStart=h.s.game.population,year=h.s.civilization.society.year;
  h.until(()=>h.s.civilization.society.generation>generation,4200);
  assert.ok(h.s.civilization.society.year>year);assert.ok(h.s.game.population!==populationStart);assert.equal(h.s.civilization.society.history.at(-1).reason,'election');
  for(const key of ['formedAt','formedAgreementId','formedStableSince'])assert.equal(h.s.civilization.metro[key],m[key]);
  assert.deepEqual(clone(h.s.civilization.metro.formedMembers),m.formedMembers);assert.equal(h.s.civilization.finance.agreements.length,1);assert.ok(h.s.civilization.finance.orders.some(o=>o.status==='complete'));h.roundtrip();
  t.diagnostic(`Real simulation after synthetic setup: year ${year} → ${h.s.civilization.society.year}; leader ${generation} → ${h.s.civilization.society.generation}; home ${populationStart} → ${h.s.game.population}.`);
});
