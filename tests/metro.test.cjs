const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {harness,ready,clone,near}=require('./helpers/metro-fixture.cjs');
// Positive evidence is produced by the shipped economy and real Finance trips
// from an explicitly synthetic, prebuilt three-city fixture. Negative cases below
// mutate one predicate; none is presented as natural play or historical service.
const issue=(state,code)=>state.issues.some(x=>x.code===code);

test('the unchanged natural second-city export retains earned 16x, all assets and its incomplete three-city milestone',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-second-city.json'),'utf8')).state,h=harness(raw),{s,metro}=h;
  assert.equal(raw.civilization.elapsed,88082);assert.equal(s.civilization.speed,16);assert.equal(s.civilization.maxSpeed,16);
  assert.equal(s.civilization.municipal.nodes.river.city,true);assert.equal(s.civilization.regions.nodes.river.population,408);
  const migrated=clone(s);delete migrated.civilization.metro;assert.equal(JSON.stringify(migrated),JSON.stringify(raw));
  assert.equal(s.civilization.metro.samples.length,0);assert.equal(metro.canRegister(s),false);h.roundtrip();
  assert.equal(h.ctx.CivilHistory.snapshot(s).counts.metro,0);
  h.step(30);assert.equal(s.civilization.metro.stableSeconds,0);assert.equal(s.civilization.metro.formedAt,null);
  assert.ok(issue(metro.check(s),'city'));assert.ok(issue(metro.check(s),'total'));assert.equal(s.civilization.speed,16);h.roundtrip();
});

test('Metro migrates missing history to an empty observation without touching any old asset or retroactively recording service',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-common-freight.json'),'utf8')).state,h=harness(raw),{s,metro}=h;
  assert.equal(s.civilization.metro.introducedAt,raw.civilization.elapsed);assert.equal(s.civilization.metro.samples.length,0);assert.equal(s.civilization.metro.stableSeconds,0);assert.equal(s.civilization.metro.formedAt,null);
  const m=s.civilization.metro;delete s.civilization.metro;assert.equal(JSON.stringify(s),JSON.stringify(raw));s.civilization.metro=m;const before=JSON.stringify(s);metro.init(s);assert.equal(JSON.stringify(s),before);assert.ok(metro.validate(s));
  for(const bad of [null,false,0,{},[]]){const copy=clone(s);copy.civilization.metro=bad;metro.init(copy);assert.throws(()=>metro.validate(copy));}
  for(const pending of metro.pendingIds){const copy=clone(s);delete copy.civilization.metro;copy.civilization.pending=pending;assert.throws(()=>metro.init(copy));assert.throws(()=>metro.validate(copy));}
});
test('check, next-event and status text are pure even though all three forecasts include actual future payments',()=>{
  const {s,metro}=ready(),before=JSON.stringify(s);for(let i=0;i<3;i++){const check=metro.check(s);assert.equal(check.ok,true);assert.equal(check.members.length,3);assert.ok(check.total>=3000);assert.equal(metro.nextEvent(s),null);metro.event('metroStatus',()=>()=>true);}assert.equal(JSON.stringify(s),before);assert.ok(metro.validate(s));
});
test('current populations, actual city registrations and reserved destination beds cannot be replaced by lifetime arrivals or source residents',()=>{
  const {s,metro}=ready();
  const total=clone(s),sum=metro.check(total).total;total.game.population-=sum-2999;total.civilization.urban.admitted+=100000;assert.ok(issue(metro.check(total),'total'));
  const tiny=clone(s);tiny.civilization.regions.nodes.river.population=399;assert.ok(issue(metro.check(tiny),'population'));
  const old=clone(s);old.civilization.municipal.nodes.rail.city=false;assert.ok(issue(metro.check(old),'city'));
  const beds=clone(s);beds.civilization.urban.parties.push({state:'outbound',target:'river',cohorts:[{age:30,count:10000}]});assert.ok(issue(metro.check(beds),'housing'));
  const rights=clone(s);rights.civilization.regions.nodes.river.rights='stratified';assert.ok(issue(metro.check(rights),'rights'));
});
test('the current settlement must use consumed local water and its own power, while future certificates never stand in for delivery',()=>{
  const {s,metro}=ready();
  for(const id of ['home','river','rail']){
    const water=clone(s);water.civilization.services.nodes[id].irrigation.waterCapacity=0;water.civilization.services.nodes[id].water.capacity=100000;assert.ok(issue(metro.check(water),'water'),id);
    const stale=clone(s);stale.civilization.services.nodes[id].irrigation.at-=10;assert.ok(issue(metro.check(stale),'water'),id);
    const power=clone(s),p=id==='home'?power.civilization.industry:power.civilization.municipal.nodes[id].power;p.generation=0;power.civilization.industry.generation=id==='home'?0:9999;assert.ok(issue(metro.check(power),'power'),id);
  }
  const machines=clone(s);machines.civilization.municipal.nodes.rail.economy.productivePower=2;assert.ok(issue(metro.check(machines),'supply'));
});
test('same-second census changes wait for the next real service without mutating or prematurely clearing accumulated stability',()=>{
  const h=ready();h.step(50);const {s,metro}=h,stable=s.civilization.metro.stableSeconds;assert.equal(stable,50);
  // A negative admission-race fixture: new residents have not yet received the
  // already-recorded treatment. This deliberately does not manufacture a source receipt.
  const changed=clone(s);changed.game.population++;changed.civilization.society.cohorts.push({age:24,count:1,identity:'mutant'});const before=JSON.stringify(changed);
  assert.ok(issue(metro.check(changed),'census'));assert.equal(metro.register(changed),false);assert.equal(changed.civilization.metro.stableSeconds,stable);assert.equal(JSON.stringify(changed),before);
});
test('300-second maintenance reserves use the largest of three gross inputs and next production, plus obligations only once',()=>{
  const {s,metro}=ready(),check=metro.check(s),copy=clone(s);copy.civilization.metro.samples[0].nodes.river.resources.tools=100;copy.civilization.regions.nodes.river.stores.tools=2000;
  const stressed=metro.check(copy);assert.ok(issue(stressed,'reserve'));assert.ok(stressed.reserves.river.tools>=3000);
  const normal=check.reserves.river.tools;assert.ok(normal>=40);assert.ok(check.reserves.home.medicine>metro.population(s,'home')*.01*30,'home exports keep medicine outside the treatment reserve');
  const old=clone(s);old.civilization.metro.samples.pop();assert.ok(issue(metro.check(old),'samples'));
  const next=clone(s);next.stores.coal=0;next.game.workers.collier=0;assert.ok(issue(metro.check(next),'forecast'));
});
test('the exact offset sixty-payment period and current record chain are required independently of fulfilled cargo',()=>{
  const {s,metro,f}=ready(),current=f.period(s),previous=s.civilization.finance.periods.find(p=>p.index===current.index-1&&p.agreementId===current.agreementId);assert.equal(previous.adminPayments.length,60);assert.equal(metro.coordinated(s,previous,previous.endsAt-1,true),true);
  const gap=clone(s),p=gap.civilization.finance.periods.find(p=>p.id===previous.id);p.adminPayments.splice(10,1);assert.ok(issue(metro.check(gap),'budget'));
  const short=clone(s);short.civilization.finance.periods.find(p=>p.id===previous.id).closedAt--;assert.ok(issue(metro.check(short),'budget'));
  const missing=clone(s);missing.civilization.finance.periods.find(p=>p.id===current.id).adminPayments.pop();assert.ok(issue(metro.check(missing),'budget'));
  const late=clone(s),order=late.civilization.finance.orders.find(o=>o.id===previous.routeOrders.river);order.returnedAt=previous.endsAt+1;assert.ok(issue(metro.check(late),'budget'));
});
test('repeated observation cannot add time and a real skipped observation cannot backfill its missing interval',()=>{
  const h=ready(),{s,metro}=h;h.step(40);const before=JSON.stringify(s.civilization.metro);assert.equal(metro.observe(s),false);assert.equal(metro.observe(s),false);assert.equal(JSON.stringify(s.civilization.metro),before);
  const original=metro.observe;metro.observe=()=>false;h.step(20);metro.observe=original;assert.equal(metro.observe(s),false);assert.equal(s.civilization.metro.stableSeconds,0);assert.equal(s.civilization.metro.samples.length,1);assert.ok(metro.validate(s));
  h.step(20);assert.equal(s.civilization.metro.stableSeconds,0);h.step(10);assert.equal(s.civilization.metro.stableSeconds,10);
});
test('native registration rechecks live conditions, later suppresses repeated automatic prompts, and successful registration grants nothing',()=>{
  const h=ready(),{s,metro}=h;h.until(()=>s.civilization.metro.stableSeconds===590,650);h.step(9);assert.equal(metro.canRegister(s),false);h.step(1);assert.equal(s.civilization.metro.stableSeconds,600);assert.equal(metro.canRegister(s),true);assert.equal(s.civilization.pending,'metroCharter');
  h.click('later');assert.equal(s.civilization.metro.offered,true);assert.equal(metro.nextEvent(s),null);h.step(1);assert.equal(h.active,null);
  const paused=clone(s);paused.civilization.finance.agreements[0].paused=true;assert.equal(metro.register(paused),false);assert.equal(paused.civilization.metro.formedAt,null);
  const assets=JSON.stringify([s.game,s.stores,s.civilization.regions,s.civilization.services,s.civilization.society.cohorts]);s.civilization.pending='metroCharter';h.ctx.Civilization.showPending();h.click('register');assert.equal(s.civilization.metro.formedAt,s.civilization.elapsed);assert.equal(JSON.stringify([s.game,s.stores,s.civilization.regions,s.civilization.services,s.civilization.society.cohorts]),assets);assert.equal(metro.register(s),false);h.roundtrip();
});
test('historical registration retains its original members after later economic failure and contract exit',()=>{
  const h=ready(),{s,metro,f}=h;h.until(()=>metro.canRegister(s),650);if(h.active)h.click('register');else assert.ok(metro.register(s));const history=clone({at:s.civilization.metro.formedAt,members:s.civilization.metro.formedMembers,agreement:s.civilization.metro.formedAgreementId});
  h.ledger('exit');h.step(60);assert.equal(f.agreement(s),null);assert.equal(s.civilization.metro.stableSeconds,0);assert.equal(metro.check(s).ok,false);assert.ok(metro.check(s).total>=3000);assert.deepEqual(clone({at:s.civilization.metro.formedAt,members:s.civilization.metro.formedMembers,agreement:s.civilization.metro.formedAgreementId}),history);h.roundtrip();
  const before=JSON.stringify(s),entry=h.ctx.CivilHistory.snapshot(s).entries.filter(e=>e.category==='metro');
  assert.equal(entry.length,1);assert.equal(entry[0].at,history.at);for(const id of history.members)assert.ok(entry[0].detail.includes(metro.name(id)));
  assert.equal(JSON.stringify(s),before,'history reads the original registration after exit without creating another ledger');
});
test('saved samples and stable/formed fields reject impossible timestamps, ledger references and invented elapsed stability',()=>{
  const {s,metro}=ready();for(const mutate of [
    m=>m.offered=null,m=>m.lastObservedAt++,m=>m.samples[0].at--,m=>m.samples[0].nodes.river.census.children=-1,
    m=>m.samples[2].nodes.home.resources.tools=100000,m=>m.stableSeconds=600,m=>m.stableSince=m.introducedAt,
    m=>m.formedAt=s.civilization.elapsed,m=>m.agreementId=999,m=>m.members=['home','river','__proto__']
  ]){const bad=clone(s);mutate(bad.civilization.metro);assert.throws(()=>metro.validate(bad));}
  const once=JSON.stringify(s);metro.init(s);metro.validate(s);assert.equal(JSON.stringify(s),once);
});
