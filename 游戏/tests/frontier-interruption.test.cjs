const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows加盟中央贡献返城与治理恢复40.json'),'utf8')).state;
function create(){const h=harness(raw);h.front=h.ctx.CivilFrontier;return h;}

test('a scout losing its staff before movement releases the real vehicle and refunds only its unspent pack',()=>{
  const h=create(),{s,front}=h;assert.equal(front.dispatch(s,'scout'),true);const m=front.active(s);
  // Synthetic staff shortage only; never imported into a natural browser.
  s.game.workers.guard=0;h.step(1);
  assert.equal(front.active(s),null);assert.equal(m.returnedAt,m.departedAt+1);
  assert.equal(m.outboundSeconds,0);assert.equal(m.inboundSeconds,0);assert.equal(m.choice,null);
  assert.deepEqual(clone(m.refunded),clone(m.paid));assert.deepEqual(clone(m.uses),[]);
  assert.equal(front.reservedTransport(s),0);assert.equal(front.node(s),undefined);h.roundtrip();
});

test('an interrupted scout can save, return its travelled distance, retrain and discover on a later paid attempt',()=>{
  const h=create(),{s,front}=h;assert.equal(front.dispatch(s,'scout'),true);const first=front.active(s);
  h.step(12);s.game.workers.guard=0;h.step(1);
  assert.equal(first.phase,'inbound');assert.equal(first.choice,null);assert.equal(first.inboundSeconds,1);h.roundtrip();
  h.step(11);assert.equal(first.returnedAt-first.departedAt,24);assert.equal(front.node(s),undefined);h.roundtrip();
  const completed=clone(first);s.game.workers.guard=2;
  h.until(()=>front.reason(s,'scout')===null,1000);assert.equal(front.dispatch(s,'scout'),true);
  const second=front.active(s);assert.equal(second.id,2);assert.deepEqual(clone(first),completed);
  h.until(()=>!front.active(s),500);assert.equal(front.node(s).population,60);
  assert.equal(front.data(s).discoveredAt,second.arrivedAt);assert.equal(first.arrivedAt,null);
  assert.ok(second.uses.length>0);h.roundtrip();
});

test('casualty removal preserves distinct source cohorts of the same age and identity',()=>{
  const {front}=create(),cohorts=[{age:30,count:1,identity:'human',originId:'source',cohortId:'first'},{age:30,count:1,identity:'human',originId:'source',cohortId:'selected'}],selected={...cohorts[1]};
  assert.deepEqual(clone(front.remove(cohorts,selected,30)),selected);
  assert.equal(cohorts[0].count,1);assert.equal(cohorts[1].count,0);
  assert.equal(front.remove(cohorts,selected,30),null);
});

test('a delayed roster requires surviving working-age members of its original cohorts without double counting',()=>{
  const {front}=create(),person={age:40,count:1,identity:'human',originId:'source',cohortId:'selected'},m={year:10,roster:[{...person},{...person}]};
  // Pure age-boundary fixture, not a playable save and not a natural continuation.
  const s={civilization:{society:{year:34,cohorts:[{...person,age:64,count:2}]}}};
  assert.equal(front.rosterReady(s,m),true);const before=clone(s);
  assert.equal(front.rosterReady(s,m),true);assert.deepEqual(s,before);
  s.civilization.society.cohorts[0].count=1;assert.equal(front.rosterReady(s,m),false);
  s.civilization.society.cohorts.push({...person,age:64,cohortId:'different'});assert.equal(front.rosterReady(s,m),false);
  s.civilization.society.cohorts[0].count=2;s.civilization.society.year=35;s.civilization.society.cohorts[0].age=65;assert.equal(front.rosterReady(s,m),false);
});
