const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const natural=JSON.parse(fs.readFileSync('tests/fixtures/natural-local-industry.json','utf8')).state;
function research(h){
 const before={...h.s.stores},cost=h.ctx.CivilText.research.wind_power.cost;
 h.ctx.Civilization.research('wind_power');assert.equal(h.s.civilization.research.id,'wind_power');
 for(const [k,n]of Object.entries(cost))near(h.s.stores[k],before[k]-n);
 h.until(()=>h.s.civilization.tech.wind_power,400);
}
let home;
function built(){
 if(!home){const h=harness(natural);research(h);const before={...h.s.stores};assert.ok(h.v.startProject(h.s,'home','windstation'));
  for(const [k,n]of Object.entries(h.ctx.CivilServiceContent.facilities.windstation.cost))near(h.s.stores[k],before[k]-n);
  h.s.game.workers.servicebuilder=2;h.until(()=>h.v.data(h.s).project.status==='complete',500);
  const p=h.v.data(h.s).project;assert.equal(p.workedSeconds,480);assert.ok(p.lastWorkedAt-p.startedAt>=480);assert.equal(h.s.game.workers.servicebuilder,0);
  h.s.game.workers.windworker=2;h.roundtrip();home=clone(h.s);
 }return harness(home);
}
function next(h){const at=h.v.data(h.s).wind?.at;h.until(()=>h.v.data(h.s).wind?.at!==at,11);return h.v.data(h.s).wind;}
test('wind stays absent in unchanged old saves and needs real city research before construction',()=>{
 const h=harness(natural),before=JSON.stringify(h.s);h.roundtrip();assert.equal(JSON.stringify(h.s),before);
 assert.equal(h.v.startProject(h.s,'home','windstation'),false);assert.equal(h.ctx.CivilWind.capacity(h.s),0);assert.equal(JSON.stringify(h.s),before);
 const low=harness(natural);low.s.civilization.urban.city=false;assert.equal(low.ctx.CivilCatalog.researchAvailable(low.s,'wind_power'),false);
});
test('research and 480 actual staffed construction seconds buy an asset without granting free workers or generation',()=>{
 const h=built(),p=h.v.data(h.s).project;assert.equal(h.v.data(h.s).buildings.windstation,1);assert.deepEqual(clone(p.paid),clone(h.ctx.CivilServiceContent.facilities.windstation.cost));
 assert.equal(h.ctx.CivilWind.capacity(h.s),12);assert.equal(h.v.data(h.s).wind,undefined);assert.equal(h.ctx.CivilServices.labor(h.s,'home','windworker'),2);h.roundtrip();
});
test('all six wind phases pay only actual local maintenance, calm pays nothing and generation is never stored',()=>{
 const h=built(),seen=new Set();
 for(let i=0;i<75;i++){const w=next(h);seen.add(w.rate);near(w.parts,w.workers*.04);near(w.generation,w.workers*6*w.rate*w.factor);
  assert.ok(h.s.civilization.industry.used<=h.s.civilization.industry.generation+1e-8);assert.equal(h.s.stores.electricity,undefined);
  if(!w.rate){assert.equal(w.parts,0);assert.equal(w.generation,0);}else assert.equal(w.workers,2);
 }
 assert.deepEqual([...seen].sort(),[0,.25,.5,1]);h.roundtrip();
});
test('missing parts or staff stops wind and repeated same-second prepare cannot double-pay or generate twice',()=>{
 const h=built();h.until(()=>h.ctx.CivilWind.weather(h.s.civilization.elapsed).rate>0,130);const wind=h.ctx.CivilWind,st=h.s.stores;
 // Isolated generation callback spends the actual warehouse, without other industries replenishing it.
 const run=(job,n,cost)=>{assert.equal(job,'windworker');const count=Math.min(n,Math.floor(((st.parts||0)+1e-8)/cost.parts));st.parts-=count*cost.parts;return count;};
 h.s.civilization.elapsed++;delete h.v.data(h.s).wind;st.parts=0;assert.equal(wind.prepare(h.s,'home',{factor:1,run}),0);
 st.parts=.04;h.s.civilization.elapsed++;assert.ok(wind.prepare(h.s,'home',{factor:1,run})>0);assert.equal(h.v.data(h.s).wind.workers,1);near(st.parts,0);
 const before=JSON.stringify(h.s);assert.equal(wind.prepare(h.s,'home',{factor:1,run}),0);assert.equal(JSON.stringify(h.s),before);
 h.s.game.workers.windworker=0;st.parts=1;h.s.civilization.elapsed++;assert.equal(wind.prepare(h.s,'home',{factor:1,run}),0);assert.equal(st.parts,1);h.roundtrip();
});
test('wind and coal feed one power pool; using wind never imports another settlement electricity',()=>{
 const h=built();h.s.game.workers.electrician=0;h.s.game.workers.utilityworker=0;
 const w=next(h),i=h.s.civilization.industry;near(i.generation,w.generation);assert.ok(i.used<=w.generation+1e-8);
 assert.equal(h.ctx.CivilWind.capacity(h.s,'river'),0);assert.equal(h.v.data(h.s,'river')?.wind,undefined);h.roundtrip();
});
test('a local wind station uses existing cargo receipts, real builders and local labor then survives original-state reload',()=>{
 const h=built();assert.ok(h.v.startProject(h.s,'river','windstation'));const p=h.v.data(h.s,'river').project;assert.equal(p.status,'supplying');assert.equal(p.paid,null);
 h.until(()=>p.status==='complete',6000);assert.equal(p.workedSeconds,480);assert.ok(p.receipts.length>=2);assert.equal(h.v.data(h.s,'river').buildings.windstation,1);
 h.step(10);const n=h.m.node(h.s,'river'),w=h.v.data(h.s,'river').wind;assert.equal(n.workers.windworker,2);assert.ok(w);assert.ok(h.m.data(h.s,'river').power.used<=h.m.data(h.s,'river').power.generation+1e-8);
 const before=JSON.stringify(h.s);h.m.forecast(h.s,'river');assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});
test('normal save reload does not reroll wind or repeat material spending across a full wind cycle',()=>{
 const a=built();a.step(10);const b=a.roundtrip();a.step(730);b.step(730);assert.deepEqual(clone(a.s),clone(b.s));a.roundtrip();
});
test('forged generation, future weather, extra operators and unpaid construction assets are rejected',()=>{
 const h=built();next(h);h.roundtrip();
 for(const edit of [s=>s.civilization.services.nodes.home.wind.at=s.civilization.elapsed+1,s=>s.civilization.services.nodes.home.wind.generation+=1,s=>s.civilization.services.nodes.home.wind.workers=3,s=>s.civilization.services.nodes.home.wind.parts+=.04,s=>delete s.civilization.services.nodes.home.completed.at(-1).paid,s=>s.civilization.services.nodes.home.project.workedSeconds--]){const bad=clone(h.s);edit(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
