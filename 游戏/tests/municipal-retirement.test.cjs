const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
function natural(name='自然游玩_Windows旧渡口市政诊疗在途57.json'){const file=path.join(__dirname,'../../验证/存档/'+name),e=JSON.parse(fs.readFileSync(file,'utf8'));return JSON.parse(zlib.gunzipSync(Buffer.from(e.data,'base64'))).state;}

test('retiring residents can staff the actual classroom without keeping obsolete farm headcounts',()=>{
  const h=harness(natural()),{s,m,ctx}=h,n=s.civilization.regions.nodes.ford,stores=JSON.stringify(n.stores),cohorts=JSON.stringify(n.cohorts),adults=ctx.CivilPopulation.workforce(n.cohorts);
  assert.equal(adults,23);assert.equal(m.data(s,'ford').baseWorkers.farmer,16);
  m.planWorkers(s,'ford');assert.equal(n.workers.teacher,1);assert.ok(n.workers.farmer<16);
  assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=adults);
  assert.equal(JSON.stringify(n.stores),stores);assert.equal(JSON.stringify(n.cohorts),cohorts);
  const f=m.forecast(s,'ford');assert.ok(f.food>=0);assert.ok(f.medicine>=0);assert.equal(f.education,true);assert.equal(f.treatment,true);
  h.roundtrip();
});

test('the original in-flight clinic completes with paid cargo and existing workers after retirement',()=>{
  const h=harness(natural()),{s,m,ctx}=h,n=s.civilization.regions.nodes.ford,before=clone(m.data(s,'ford').project),people=ctx.CivilPopulation.count(n.cohorts);
  // Headless continuation is a separate rule test, never an exported natural save.
  h.until(()=>m.data(s,'ford').project.status==='complete',1800);
  assert.equal(m.data(s,'ford').buildings.clinic,1);assert.equal(m.data(s,'ford').project.id,before.id);
  assert.ok(m.data(s,'ford').project.receipts.length>before.receipts.length);
  assert.ok(n.population<=people+4,'only normal small local births are possible here');
  assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=ctx.CivilPopulation.workforce(n.cohorts));
  assert.equal(m.data(s,'ford').economy.education,true);assert.ok(m.data(s,'ford').economy.food>=0);h.roundtrip();
});

test('optional food and medicine surplus does not strand a fully delivered home with one builder',()=>{
  const h=harness(natural('自然游玩_Windows旧渡口退休缺员住房59.json')),{s,m,ctx}=h,n=s.civilization.regions.nodes.ford,before=clone(m.data(s,'ford').project),stores=JSON.stringify(n.stores),cohorts=JSON.stringify(n.cohorts);
  assert.equal(ctx.CivilPopulation.workforce(n.cohorts),21);assert.equal(n.workers.builder,1);assert.equal(before.remaining,240);
  m.planWorkers(s,'ford');assert.equal(n.workers.builder,2);assert.equal(n.workers.teacher,1);
  assert.equal(JSON.stringify(n.stores),stores);assert.equal(JSON.stringify(n.cohorts),cohorts);
  assert.equal(Object.values(n.workers).reduce((a,b)=>a+b,0),21);
  const f=m.forecast(s,'ford');assert.ok(f.food>=0);assert.ok(f.medicine>=0);assert.equal(f.education,true);assert.equal(f.treatment,true);
  h.until(()=>m.data(s,'ford').project.status==='complete',300);
  assert.equal(m.data(s,'ford').buildings.residential,1);assert.equal(m.capacity(s,'ford'),96);
  assert.deepEqual(clone(m.data(s,'ford').project.receipts),before.receipts);h.roundtrip();
});
