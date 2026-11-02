const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../../验证/存档/自然游玩_Mac旧城共同法接纳与河网商约113.json'))).data,'base64'))).state;
let prepared;
// Synthetic rule fixture only. Never loaded into the natural-play browser.
function ready(){
  if(!prepared){
    const h=harness(raw),s=h.s,p=h.ctx.CivilPartnership;
    h.until(()=>p.operational(s,'river_network'),5000);assert.equal(p.schedule(s,'river_network'),true);
    h.until(()=>p.completed(s,'river_network')===3,5000);h.until(()=>p.operational(s,'river_network')&&p.partners(s).river_network.stableSeconds===600,5000);
    assert.equal(p.join(s,'river_network'),true);assert.equal(h.ctx.CivilWorld.available(s),true);
    Object.assign(s.civilization.tech,{computing:true,national_logistics:true,automation:true});
    assert.equal(h.v.startProject(s,'home','expeditiondepot'),true);s.game.workers.servicebuilder=2;h.step(600);s.game.workers.expeditionworker=6;h.roundtrip();prepared=clone(s);
  }
  const h=harness(prepared);h.w=h.ctx.CivilWorld;return h;
}
function mission(h,id,kind){assert.equal(h.w.start(h.s,id,kind),true,h.w.reason(h.s,id,kind));h.until(()=>!h.w.active(h.s),2200);}

test('world stage is absent before all three real origin accessions and costs no legacy state',()=>{
  const h=harness(raw),before=clone(h.s);assert.equal(h.ctx.CivilWorld.available(h.s),false);assert.equal(h.ctx.CivilWorld.start(h.s,'north','contact'),false);assert.deepEqual(clone(h.s),before);h.roundtrip();
});
test('river accession unlocks national research; paid depot has six jobs, no new people',()=>{
  const h=ready();assert.equal(h.w.available(h.s),true);assert.equal(h.ctx.CivilCatalog.jobCapacity(h.s,'expeditionworker'),6);assert.ok(h.w.asset(h.s).workedSeconds===600);assert.equal(h.w.data(h.s),undefined);h.roundtrip();
});
test('peaceful national missions transfer actual cargo, preserve local stores and require a returned crew',()=>{
  const h=ready(),s=h.s,oldPopulation=s.game.population;
  mission(h,'north','contact');let n=h.w.data(s).nodes.north;assert.equal(n.population,26000);assert.equal(h.w.population(s),0);
  for(let i=0;i<2;i++)mission(h,'north','negotiate');
  h.until(()=>!h.w.joinReason(s,'north'),5000);const before=clone([s.stores,n.stores]),population=h.ctx.CivilNation.population(s);assert.equal(h.w.join(s,'north'),true);
  near(s.stores.knowledge,before[0].knowledge-300);near(n.stores.knowledge,before[1].knowledge-120);assert.equal(h.ctx.CivilNation.population(s),population+26000);assert.equal(h.w.join(s,'north'),false);assert.ok(s.game.population<=oldPopulation);h.roundtrip();
});
test('recall returns only undelivered aid and actual return travel is preserved across reload',()=>{
  const h=ready();mission(h,'east','contact');const s=h.s;h.until(()=>!h.w.reason(s,'east','negotiate'),5000);assert.equal(h.w.start(s,'east','negotiate'),true);h.step(30);
  assert.equal(h.w.recall(s),true);const m=h.w.active(s);assert.equal(m.returnDistance,30);const loaded=h.roundtrip();h.step(30);loaded.step(30);assert.deepEqual(clone(loaded.s),clone(s));assert.equal(m.returnedAt,m.cancelledAt+30);assert.deepEqual(clone(m.cargo),{});assert.equal(h.w.data(s).nodes.east.trust,40);h.roundtrip();
});
test('missing real workers pauses the same national asset without duplicating or completing a mission',()=>{
  const h=ready(),s=h.s;assert.equal(h.w.start(s,'north','contact'),true);h.step(30);s.game.workers.expeditionworker=5;h.step(50);assert.equal(h.w.active(s).progress,30);assert.equal(h.w.start(s,'west','contact'),false);s.game.workers.expeditionworker=6;h.step(1);assert.equal(h.w.active(s).progress,31);h.roundtrip();
});
test('mechanical warfare consumes produced equipment and records casualties, damage and reconstruction',()=>{
  const h=ready(),s=h.s;mission(h,'west','contact');assert.equal(h.w.start(s,'west','campaign'),false);s.stores.robots=4;const before=s.game.population;mission(h,'west','campaign');
  let n=h.w.data(s).nodes.west;assert.equal(s.stores.robots,0);assert.equal(n.population,30940);assert.equal(n.casualties,60);assert.equal(n.infrastructure,40);assert.equal(h.w.population(s),0);assert.match(h.w.joinReason(s,'west'),/设施/);
  for(let i=0;i<3;i++)mission(h,'west','rebuild');assert.equal(n.infrastructure,100);assert.equal(n.control,'independent');assert.equal(n.trust,60);assert.ok(s.game.population<=before);h.roundtrip();
});
test('import rejects fabricated public treasury, mission cargo and paid construction identity',()=>{
  const h=ready();mission(h,'north','contact');const saved=clone(h.s);
  for(const change of [s=>s.civilization.worldstage.nodes.north.stores.food++,s=>s.civilization.worldstage.missions[0].cargo.food=50,s=>s.civilization.worldstage.missions[0].assetId++,s=>s.civilization.worldstage.nodes.north.population++]){const bad=clone(saved);change(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad),/国家远域/);}
  h.roundtrip();
});
test('robot assembly consumes inputs and shared power; no fuel or robots appear on a blackout',()=>{
  const h=ready(),s=h.s;assert.equal(h.v.startProject(s,'home','roboticsworks'),true);s.game.workers.servicebuilder=2;h.step(600);s.game.workers.roboticist=2;
  const before=clone(s.stores),run=(job,count,cost,output)=>{for(let i=0;i<count;i++){assert.equal(h.v.pay(s.stores,cost),true);h.ctx.CivilRegions.credit(s.stores,output);}return count;};
  const zero=h.ctx.CivilPrecision.run(s,'home',{run,powerAvailable:0});assert.equal(zero.used,0);assert.deepEqual(clone(s.stores),before);
  // Disable other recipe jobs in this isolated recipe check so all 12 remaining
  // units of existing power can be audited against robot inputs and output.
  s.game.workers.precisionworker=0;s.game.workers.electronicsworker=0;const result=h.ctx.CivilPrecision.run(s,'home',{run,powerAvailable:12});assert.equal(result.used,12);near(s.stores.robots||0,(before.robots||0)+.1);near(s.stores.electronics,before.electronics-1);h.roundtrip();
});
test('three distinct countries can accede peacefully, and earned orbital research changes only new departures',()=>{
  const h=ready(),s=h.s;h.ctx.CivilRegions.chooseRights(s,'equal');
  for(const id of ['north','east','west']){
    h.until(()=>!h.w.reason(s,id,'contact'),5000);mission(h,id,'contact');
    while(h.w.data(s).nodes[id].trust<60){h.until(()=>!h.w.reason(s,id,'negotiate'),5000);mission(h,id,'negotiate');}
    h.until(()=>!h.w.joinReason(s,id),5000);assert.equal(h.w.join(s,id),true);
  }
  assert.equal(h.w.members(s).length,3);assert.equal(h.w.population(s),99000);assert.equal(h.ctx.CivilCatalog.researchAvailable(s,'orbital_survey'),true);
  s.stores.robots=6;h.ctx.Civilization.research('orbital_survey');assert.equal(s.civilization.research.id,'orbital_survey');h.step(900);assert.equal(s.civilization.tech.orbital_survey,true);assert.equal(h.w.duration(s,'north'),240);assert.ok(h.w.data(s).missions.every(m=>m.orbital===false));h.roundtrip();
});
