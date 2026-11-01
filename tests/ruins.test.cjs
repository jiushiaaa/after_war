const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync('tests/fixtures/natural-local-industry.json')).state;
function setup(){const h=harness(raw);h.ruins=h.ctx.CivilRuins;return h;}
function finish(h){h.until(()=>!h.ruins.active(h.s),900);}
test('old saves gain no cache, crew or relic; field work requires real survey knowledge and a consented town',()=>{
 const h=setup(),before=JSON.stringify(h.s);h.ruins.tick(h.s);h.ctx.CivilHistory.snapshot(h.s);h.roundtrip();assert.equal(JSON.stringify(h.s),before);
 delete h.s.civilization.tech.survey;const missing=JSON.stringify(h.s);assert.equal(h.ruins.start(h.s,'survey'),false);assert.equal(JSON.stringify(h.s),missing);
});
test('survey is paid once, uses existing spare adults and cannot advance without full staff or public care',()=>{
 const h=setup(),n=h.m.node(h.s,'river'),stores=clone(n.stores),people=JSON.stringify(n.cohorts);assert.ok(h.ruins.start(h.s,'survey'));
 for(const [k,v]of Object.entries(h.ruins.phases.survey.cost))near(n.stores[k],stores[k]-v);
 assert.equal(JSON.stringify(n.cohorts),people);assert.equal(n.workers.ruinworker,4);assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=h.ctx.CivilPopulation.workforce(n.cohorts));
 const before=JSON.stringify(h.s);assert.equal(h.ruins.start(h.s,'survey'),false);assert.equal(JSON.stringify(h.s),before);
 h.s.civilization.elapsed++;n.workers.ruinworker=0;h.ruins.tick(h.s);assert.equal(h.ruins.active(h.s).remaining,180);
 h.m.planWorkers(h.s,'river');h.step(20);assert.ok(h.ruins.active(h.s).remaining<180);h.roundtrip();
});
test('the preserved machine and archive require three paid stages and enter the finite cache only once',()=>{
 const h=setup();h.ruins.start(h.s,'survey');finish(h);assert.deepEqual(clone(h.ruins.choices(h.s)),['relocate','barrier']);
 assert.ok(h.ruins.start(h.s,'relocate'));finish(h);assert.ok(h.ruins.start(h.s,'preserve'));
 h.until(()=>h.ruins.active(h.s).remaining===1);const n=h.m.node(h.s,'river'),before=clone(n.stores);h.step(1);const d=h.ruins.data(h.s);
 assert.equal(d.reward.robot,1);assert.equal(d.completedAt,h.s.civilization.elapsed);assert.equal(n.workers.ruinworker||0,0);assert.equal(d.stages.reduce((sum,r)=>sum+h.ruins.phases[r.kind].seconds,0),720);
 // The final tick may include the ordinary economic settlement; independent cache receipt is authoritative.
 assert.deepEqual(clone(d.reward.stores),{knowledge:40,glass:12,parts:12});assert.ok(n.stores.glass>=before.glass+12);
 const saved=JSON.stringify(h.s);h.ruins.tick(h.s);assert.equal(h.ruins.start(h.s,'preserve'),false);assert.equal(JSON.stringify(h.s),saved);h.roundtrip();
});
test('isolation and recycling are mutually exclusive alternatives, not repeatable rewards or extra people',()=>{
 const h=setup();h.ruins.start(h.s,'survey');finish(h);assert.ok(h.ruins.start(h.s,'barrier'));finish(h);assert.ok(h.ruins.start(h.s,'recycle'));finish(h);
 const d=h.ruins.data(h.s);assert.equal(d.reward.robot,0);assert.deepEqual(clone(d.reward.stores),{steel:20,parts:30});assert.equal(h.ruins.start(h.s,'preserve'),false);assert.equal(h.ruins.start(h.s,'survey'),false);h.roundtrip();
});
test('pausing releases crew, preserves spent supplies and resumes the same work after a normal reload',()=>{
 const h=setup();h.ruins.start(h.s,'survey');h.step(50);assert.ok(h.ruins.setEnabled(h.s,false));const d=h.ruins.data(h.s),left=h.ruins.active(h.s).remaining;assert.equal(h.m.node(h.s,'river').workers.ruinworker||0,0);h.step(400);assert.equal(h.ruins.active(h.s).remaining,left);
 const b=h.roundtrip();assert.equal(b.ctx.CivilRuins.active(b.s).remaining,left);b.ctx.CivilRuins.setEnabled(b.s,true);b.step(left+20);assert.equal(b.ctx.CivilRuins.active(b.s),null);assert.equal(d.stages[0].paid.food,20);b.roundtrip();
});
test('insufficient resources never create progress, and health or meal shortages pause without destroying paid work',()=>{
 const h=setup(),n=h.m.node(h.s,'river');n.stores.food=h.m.foodReserve(h.s,'river');const before=JSON.stringify(h.s);assert.equal(h.ruins.start(h.s,'survey'),false);assert.equal(JSON.stringify(h.s),before);
 n.stores.food+=100;assert.ok(h.ruins.start(h.s,'survey'));n.health=20;h.s.civilization.elapsed++;h.ruins.tick(h.s);assert.equal(h.ruins.active(h.s).remaining,180);assert.match(h.ruins.reason(h.s),/健康/);
});
test('old site choices cannot pay or select a later phase; forecasts and history are read-only',()=>{
 const h=setup();h.s.civilization.pending='ruin_river';const e=h.ruins.event('ruin_river');assert.ok(e.buttons.survey.onChoose());const before=JSON.stringify(h.s);assert.equal(e.buttons.survey.onChoose(),false);h.m.forecast(h.s,'river');h.ctx.CivilHistory.snapshot(h.s);assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});
test('forged outcomes, unpaid costs, wrong phase order and impossible work times are rejected',()=>{
 const h=setup();h.ruins.start(h.s,'survey');finish(h);h.ruins.start(h.s,'relocate');finish(h);h.ruins.start(h.s,'preserve');finish(h);h.roundtrip();
 for(const edit of [d=>d.reward.robot=2,d=>d.reward.stores.knowledge+=1,d=>d.stages[0].paid.food=0,d=>d.stages[1].kind='preserve',d=>d.stages[0].lastTick=d.stages[0].startedAt,d=>d.completedAt++,d=>d.stages.push(clone(d.stages[2]))]){const s=clone(h.s);edit(s.civilization.ruins);assert.throws(()=>h.ctx.CivilPlatform.validate(s));}
});
