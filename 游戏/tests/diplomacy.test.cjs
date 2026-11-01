const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows地方自治与换届恢复08.json'),'utf8')).state;
const source='mountain_settlements';
// These are isolated rule replays of an unmodified export, never natural progress.
function create(){const h=harness(raw);h.d=h.ctx.CivilDiplomacy;h.o=h.ctx.CivilOrigins;return h;}
function signed(){const h=create();h.s.civilization.pending='residencePact';h.ctx.Civilization.showPending();h.click('sign_'+source);assert.ok(h.d.data(h.s));return h;}
let grantedSnapshot;
function granted(){if(!grantedSnapshot){const h=signed();h.until(()=>h.d.data(h.s).granted===24,6000);grantedSnapshot=clone(h.s);}const h=harness(grantedSnapshot);h.d=h.ctx.CivilDiplomacy;h.o=h.ctx.CivilOrigins;return h;}

test('legacy nation export stays unchanged and early societies cannot open or sign a pact',()=>{
  const h=create();assert.deepEqual(clone(h.s),raw);assert.equal(h.d.data(h.s),undefined);h.roundtrip();
  const early=harness(),before=clone(early.s),d=early.ctx.CivilDiplomacy;assert.equal(d.sign(early.s,source),false);assert.deepEqual(clone(early.s),before);
  early.s.civilization.pending='residencePact';assert.throws(()=>early.ctx.CivilPlatform.validate(early.s),/公约/);
});

test('signatures consume each office inventory atomically and cannot be duplicated or switch partners',()=>{
  const h=create(),{s,d}=h,n=d.source(s,source),original=clone(s);n.stores.knowledge=0;const failed=clone(s);
  assert.equal(d.sign(s,source),false);assert.deepEqual(clone(s),failed);n.stores.knowledge=original.civilization.origins.nodes[source].stores.knowledge;
  assert.equal(d.sign(s,source),true);for(const [k,v]of Object.entries(d.signature.home))near(s.stores[k],original.stores[k]-v);
  for(const [k,v]of Object.entries(d.signature.source))near(n.stores[k],original.civilization.origins.nodes[source].stores[k]-v);
  const once=clone(s);assert.equal(d.sign(s,source),false);assert.equal(d.sign(s,'river_network'),false);assert.deepEqual(clone(s),once);h.roundtrip();
});

test('each paid round has two real debits, retains supply reserves and is idempotent',()=>{
  const h=signed(),{s,d}=h,n=d.source(s,source),home=clone(s.stores),local=clone(n.stores);
  d.settle(s);for(const [k,v]of Object.entries(d.fees.home))near(s.stores[k],home[k]-v);for(const [k,v]of Object.entries(d.fees.source))near(n.stores[k],local[k]-v);
  const once=clone(s);d.settle(s);assert.deepEqual(clone(s),once);d.observe(s);h.roundtrip();
  // Declared shortage fixture: fail at the actual payment boundary, restore only
  // the test input afterwards so it cannot masquerade as a natural recovery.
  const settle=d.settle;let hit=false;
  d.settle=function(state){if(state!==s||hit||s.civilization.elapsed-this.data(s).lastSettledAt<10)return settle.call(this,state);const saved=n.stores.knowledge;n.stores.knowledge=0;const before=clone([s.stores,n.stores]);const result=settle.call(this,state);assert.deepEqual(clone([s.stores,n.stores]),before);assert.equal(d.operational(s),false);n.stores.knowledge=saved;hit=true;return result;};
  h.step(20);d.settle=settle;assert.ok(hit);assert.ok(d.data(s).records.some(r=>!r.paid&&!r.service));h.roundtrip();
});

test('a paid continuous period grants bounded eligibility, never population or a refreshed base quota',()=>{
  const h=signed(),{s,d,o}=h,n=d.source(s,source),start=s.civilization.elapsed,base=n.permit.limit;
  assert.equal(o.remaining(s,source),0);assert.equal(d.data(s).granted,0);
  const observe=d.observe;d.observe=function(state){const people=clone([state.game.population,this.source(state,source).cohorts]);const result=observe.call(this,state);assert.deepEqual(clone([state.game.population,this.source(state,source).cohorts]),people);return result;};
  h.until(()=>d.data(s).granted===24,6000);d.observe=observe;
  assert.ok(s.civilization.elapsed-start>=600);assert.equal(n.permit.limit,base);assert.equal(o.remaining(s,source),24);assert.ok(d.data(s).records.filter(r=>r.service).length>=61);
  assert.ok(h.ctx.CivilHistory.snapshot(s).entries.some(e=>e.key.startsWith('residence_grant_')));h.roundtrip();
});

test('a public pause freezes unused eligibility and payments; resume preserves every earlier grant',()=>{
  const h=granted(),{s,d,o}=h;assert.equal(d.revise(s,'pause'),true);h.roundtrip();h.step(60);assert.equal(d.data(s).active,false);assert.equal(o.remaining(s,source),0);
  const count=d.data(s).records.length,total=d.data(s).granted;h.step(120);assert.equal(d.data(s).records.length,count);assert.equal(d.data(s).granted,total);
  assert.equal(d.revise(s,'resume'),true);assert.match(d.status(s),/公示尚余 60 秒/);h.roundtrip();h.step(60);h.until(()=>d.operational(s),6000);assert.equal(d.data(s).granted,total);assert.equal(o.remaining(s,source),24);h.roundtrip();
});

test('additional residents use paid construction and the original vehicle; a pause cannot erase passengers or the source ledger',()=>{
  const h=granted(),{s,d,o,m,u,v}=h,n=d.source(s,source),c=s.civilization;
  // Test operator chooses an existing source/target and pauses automatic dispatch.
  // All new beds below come from real shipments and construction, not fixture assets.
  c.urban.enabled=false;c.urban.activeSource=source;c.urban.activeTarget='rail';
  assert.equal(v.startProject(s,'rail','densehousing'),true);h.until(()=>v.data(s,'rail').project.status==='complete',6000);
  h.until(()=>d.operational(s)&&u.availableBeds(s,'rail')>=24,6000);
  let departure;const dispatch=u.dispatch.bind(u);
  u.dispatch=state=>{const sourceBefore=n.population,targetBefore=c.regions.nodes.rail.population,homeBefore=clone(s.stores),ok=dispatch(state);if(ok){
    const party=c.urban.parties.find(p=>p.source===source);departure=party;assert.equal(n.population,sourceBefore-party.transport.initial);assert.equal(c.regions.nodes.rail.population,targetBefore);
    for(const [k,v]of Object.entries(party.transport.paid))near(s.stores[k],homeBefore[k]-v);
  }return ok;};
  // Explicit timing fixture: automatic dispatch expires on the production
  // boundary, while this round's public-service observation is still pending.
  c.urban.enabled=true;c.urban.dispatchClock=10-c.productionClock;h.until(()=>!!departure,20);c.urban.enabled=false;u.dispatch=dispatch;
  const party=departure,id=party.id,count=party.transport.initial;assert.equal(count,24);
  assert.equal(d.revise(s,'pause'),true);h.step(60);assert.equal(d.data(s).active,false);assert.ok(c.urban.parties.some(p=>p.id===id));h.roundtrip();
  h.until(()=>n.departures['p'+id].status==='arrived',600);assert.equal(n.departures['p'+id].alive,count);assert.equal(n.admitted+n.transitDeaths,960+count);assert.equal(o.remaining(s,source),0);
  assert.equal(n.baselinePopulation+n.born,n.population+n.sourceDeaths+n.transitDeaths+n.admitted+o.inTransit(n));h.roundtrip();
});

test('forged eligibility, signatures, skipped continuous service and malformed revisions are rejected',()=>{
  const h=granted(),good=clone(h.s);
  for(const mutate of [s=>s.civilization.diplomacy.granted=480,s=>s.civilization.diplomacy.records.at(-1).grant=0,s=>s.civilization.diplomacy.signature.home.knowledge=0,s=>s.civilization.diplomacy.records[0].paid=false,s=>s.civilization.diplomacy.active=false,s=>s.civilization.diplomacy.revision={action:'pause',requestedAt:s.civilization.elapsed,effectiveAt:s.civilization.elapsed+1}]){
    const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
  }
  h.ctx.CivilPlatform.validate(good);
});

test('the isolated pact owner caps total grants at 480 through many further paid rounds',()=>{
  const h=signed(),{s,d}=h,reason=d.reason,people=clone([s.game.population,d.source(s,source).cohorts]);
  // Explicit module-level stress fixture: hold service eligibility true and
  // advance only its clock. This is not an adapter or natural-play scenario.
  d.reason=()=>null;
  for(let i=0;i<1300;i++){s.civilization.elapsed+=10;d.settle(s);d.observe(s);}
  d.reason=reason;assert.equal(d.data(s).granted,480);assert.equal(d.data(s).records.filter(r=>r.grant).length,20);
  assert.ok(d.data(s).records.slice(-90).every(r=>r.paid&&r.grant===0));assert.deepEqual(clone([s.game.population,d.source(s,source).cohorts]),people);
  d.validate(s);
});
