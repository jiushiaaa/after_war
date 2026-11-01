const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync('tests/fixtures/natural-local-industry.json')).state;
function research(h,id){const before=clone(h.s.stores),d=h.ctx.CivilText.research[id];h.ctx.Civilization.research(id);assert.equal(h.s.civilization.research.id,id);for(const [k,n]of Object.entries(d.cost))near(h.s.stores[k],before[k]-n);h.until(()=>h.s.civilization.tech[id],d.duration+10);}
let saved;
function built(){if(!saved){const h=harness(raw);research(h,'machine_tools');assert.ok(h.v.startProject(h.s,'home','precisionworks'));h.s.game.workers.servicebuilder=2;h.until(()=>h.v.data(h.s).project.status==='complete',500);h.s.game.workers.precisionworker=2;h.roundtrip();saved=clone(h.s);}return harness(saved);}
function paidRun(st){return (job,n,cost,out)=>{for(const [k,v]of Object.entries(cost))n=Math.min(n,Math.floor(((st[k]||0)+1e-8)/v));for(const [k,v]of Object.entries(cost))st[k]=Math.max(0,(st[k]||0)-v*n);for(const [k,v]of Object.entries(out))if(n)st[k]=(st[k]||0)+v*n;return n;};}
test('old saves remain unchanged and research requires the real steel, standards and city chain',()=>{
 const h=harness(raw),before=JSON.stringify(h.s);assert.equal(h.v.startProject(h.s,'home','precisionworks'),false);assert.equal(h.ctx.CivilCatalog.researchAvailable(h.s,'electronics'),false);h.roundtrip();assert.equal(JSON.stringify(h.s),before);
 assert.ok(h.ctx.CivilCatalog.researchAvailable(h.s,'machine_tools'));delete h.s.civilization.tech.standards;assert.equal(h.ctx.CivilCatalog.researchAvailable(h.s,'machine_tools'),false);
});
test('paid construction requires two actual builders and records only worked seconds',()=>{
 const h=harness(raw);research(h,'machine_tools');const before=clone(h.s.stores),d=h.ctx.CivilServiceContent.facilities.precisionworks;assert.ok(h.v.startProject(h.s,'home','precisionworks'));for(const [k,n]of Object.entries(d.cost))near(h.s.stores[k],before[k]-n);
 const p=h.v.data(h.s).project;h.step(20);assert.equal(p.remaining,420);h.s.game.workers.servicebuilder=2;h.step(20);assert.equal(p.workedSeconds,20);const b=h.roundtrip();b.until(()=>b.v.data(b.s).project.status==='complete',450);assert.equal(b.v.data(b.s).completed.at(-1).workedSeconds,420);assert.equal(b.s.game.workers.servicebuilder,0);b.roundtrip();
});
test('precision production pays exact inputs, respects partial electricity and has no manual fallback',()=>{
 const h=built(),st=h.s.stores,p=h.ctx.CivilPrecision,before=clone(st);let r=p.run(h.s,'home',{factor:1,run:paidRun(st),powerAvailable:3});near(r.used,3);assert.equal(r.demand,6);near(st.precisionparts-(before.precisionparts||0),.25);near(before.steel-st.steel,.4);near(before.parts-st.parts,.2);near(before.tools-st.tools,.02);
 const unchanged=JSON.stringify(st);r=p.run(h.s,'home',{factor:1,run:paidRun(st),powerAvailable:2.99});assert.equal(r.used,0);assert.equal(JSON.stringify(st),unchanged);
 st.steel=0;r=p.run(h.s,'home',{factor:1,run:paidRun(st),powerAvailable:99});assert.equal(r.used,0);h.s.game.workers.precisionworker=0;assert.equal(p.run(h.s,'home',{factor:1,run:paidRun(st),powerAvailable:99}).demand,0);
});
test('electronics unlocks from real output, needs paid construction and consumes both material stages',()=>{
 const h=built();h.until(()=>(h.s.stores.precisionparts||0)>=32,2400);research(h,'electronics');assert.ok(h.v.startProject(h.s,'home','electronicsworks'));h.s.game.workers.servicebuilder=2;h.until(()=>h.v.data(h.s).project.status==='complete',500);h.s.game.workers.precisionworker=0;h.s.game.workers.electronicsworker=2;
 const before=clone(h.s.stores),r=h.ctx.CivilPrecision.run(h.s,'home',{factor:1,run:paidRun(h.s.stores),powerAvailable:4});assert.equal(r.used,4);assert.equal(r.demand,8);near(h.s.stores.electronics-(before.electronics||0),.2);near(before.precisionparts-h.s.stores.precisionparts,.1);near(before.glass-h.s.stores.glass,.3);near(before.chemicals-h.s.stores.chemicals,.2);near(before.parts-h.s.stores.parts,.1);h.step(10);h.roundtrip();
});
test('unified settlement spends only the electricity left after public services and ordinary machinery',()=>{
 const h=built(),p=h.ctx.CivilPrecision;h.step(10);const i=h.s.civilization.industry;assert.ok(i.used<=i.generation+1e-8);assert.ok(i.used<=i.demand);h.s.game.workers.electrician=0;h.s.game.workers.utilityworker=0;h.s.game.workers.windworker=0;const before=h.s.stores.precisionparts||0;h.step(10);near(h.s.stores.precisionparts||0,before);assert.equal(h.s.civilization.industry.generation,0);assert.match(h.s.civilization.industry.blocked.precisionworker,/电力/);h.roundtrip();
});
test('local factories receive real freight, reserve actual adults and cannot use home electricity',()=>{
 const h=built();assert.ok(h.v.startProject(h.s,'river','precisionworks'));const p=h.v.data(h.s,'river').project;assert.equal(p.paid,null);h.until(()=>p.status==='complete',6000);assert.ok(p.receipts.length>=2);assert.equal(p.workedSeconds,420);h.step(10);const n=h.m.node(h.s,'river');assert.equal(n.workers.precisionworker,2);assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=h.ctx.CivilPopulation.workforce(n.cohorts));
 const before=JSON.stringify(n.stores);assert.equal(h.ctx.CivilPrecision.run(h.s,'river',{factor:1,run:paidRun(n.stores),powerAvailable:0}).used,0);assert.equal(JSON.stringify(n.stores),before);h.roundtrip();
});
test('production forecasts and history are read-only and save restoration does not invent output',()=>{
 const h=built();h.step(10);const before=JSON.stringify(h.s);h.ctx.Civilization.settleEconomy(clone(h.s));h.ctx.CivilHistory.snapshot(h.s);h.ctx.CivilPrecision.describe(h.s);h.m.forecast(h.s,'river');assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});
test('forged factory counts, costs, missing prerequisites and impossible work are rejected',()=>{
 const h=built();for(const edit of [s=>s.civilization.services.nodes.home.buildings.precisionworks++,s=>s.civilization.services.nodes.home.completed.at(-1).paid.steel=0,s=>s.civilization.services.nodes.home.completed.at(-1).workedSeconds=419,s=>delete s.civilization.tech.machine_tools,s=>s.civilization.services.nodes.home.completed.at(-1).receipts=[1]]){const s=clone(h.s);edit(s);assert.throws(()=>h.ctx.CivilPlatform.validate(s));}
});
