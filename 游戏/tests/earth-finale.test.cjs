const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Mac北陆国家接纳与机器人量产115.json'))).data,'base64'))).state;
// An isolated full-adapter operator replay from checkpoint 115. Test actions and
// worker assignments are never imported into the natural-play browser.
const log=[];
function mark(h,text){console.log('Earth route:',text,h.s.civilization.elapsed);log.push({at:h.s.civilization.elapsed,text});}
function advance(h,n){h.step(n,{checkEvery:300});}
function until(h,p,max=6000){for(let i=0;i<max&&!p();i++)h.step(1,{checkEvery:300});assert.ok(p(),'progress blocked: '+h.ctx.CivilSpace.unityReason(h.s));}
function research(h,id){until(h,()=>h.ctx.CivilCatalog.researchAvailable(h.s,id));h.ctx.Civilization.research(id);assert.equal(h.s.civilization.research?.id,id);until(h,()=>h.s.civilization.tech[id],2000);mark(h,id);}
function build(h,id){assert.equal(h.v.startProject(h.s,'home',id),true,id);h.s.game.workers.servicebuilder=2;until(h,()=>!h.v.active(h.s),1600);mark(h,id);}
function mission(h,id,kind){const w=h.ctx.CivilWorld;until(h,()=>!w.reason(h.s,id,kind));assert.equal(w.start(h.s,id,kind),true,w.reason(h.s,id,kind));until(h,()=>!w.active(h.s),2600);}
let finalState;
test('Earth finale full adapter: eight independent networks, real technology, construction, production and launch',()=>{
  const h=harness(raw),s=h.s,w=h.ctx.CivilWorld,space=h.ctx.CivilSpace;
  assert.equal(space.available(s),false);assert.equal(space.start(s,'departure'),false);assert.equal(space.data(s),undefined);
  assert.equal(w.visible(s,'islands'),false);assert.equal(w.start(s,'islands','contact'),false);
  assert.equal(h.ctx.CivilRegions.chooseRights(s,'equal'),true);
  for(const id of ['east','west']){mission(h,id,'contact');while(w.data(s).nodes[id].trust<60)mission(h,id,'negotiate');until(h,()=>!w.joinReason(s,id));assert.equal(w.join(s,id),true);mark(h,id+' accession');}
  const old=clone(w.data(s).missions);research(h,'orbital_survey');assert.equal(w.duration(s,'east'),288);assert.deepEqual(clone(w.data(s).missions),old);assert.equal(w.visible(s,'islands'),true);
  for(const id of ['ocean_navigation','ecological_recovery','space_manufacturing','closed_ecology'])research(h,id);
  assert.match(w.reason(s,'islands','contact'),/船队/);build(h,'globalfleet');
  for(const id of ['rainforest','desert','plateau','islands','polar']){mission(h,id,'contact');while(w.data(s).nodes[id].trust<60)mission(h,id,'negotiate');until(h,()=>!w.joinReason(s,id));assert.equal(w.join(s,id),true);mark(h,id+' accession');}
  until(h,()=>!space.unityReason(s));assert.equal(w.members(s).length,8);assert.equal(w.population(s),283000);
  const home=s.game.population,local=clone(w.data(s).nodes);assert.equal(space.ratify(s),true);assert.equal(space.ratify(s),false);assert.equal(s.game.population,home);assert.deepEqual(clone(w.data(s).nodes),local);h.roundtrip();
  for(const id of ['spaceworks','bioworks','spaceport'])build(h,id);
  s.game.workers.utilityworker=8;s.game.workers.roboticist=0;s.game.workers.aerospaceworker=2;s.game.workers.biosystemworker=2;s.game.workers.missionworker=4;
  until(h,()=>(s.stores.spaceparts||0)>=44&&(s.stores.lifesupport||0)>=22,6000);mark(h,'manufactured components');
  s.game.workers.aerospaceworker=0;s.game.workers.biosystemworker=0;until(h,()=>!space.reason(s,'habitat'));assert.equal(space.start(s,'habitat'),true);
  advance(h,100);assert.ok(space.active(s).progress>0);s.game.workers.missionworker=3;advance(h,10);assert.equal(space.active(s).progress,0);assert.equal(space.active(s).receipts.at(-1).paid,false);s.game.workers.missionworker=4;
  advance(h,30);const generation=Object.fromEntries(['utilityworker','electrician','windworker'].map(k=>[k,s.game.workers[k]]));for(const k of Object.keys(generation))s.game.workers[k]=0;
  advance(h,10);assert.equal(space.active(s).progress,0);assert.equal(space.active(s).receipts.at(-1).power,0);Object.assign(s.game.workers,generation);
  // Mid-test serialization preserves work, payments and regional evidence.
  const saved=clone(s),loaded=h.roundtrip();advance(h,10);advance(loaded,10);assert.deepEqual(clone(loaded.s),clone(s));assert.ok(saved.civilization.space.missions.length);
  until(h,()=>space.complete(s,'habitat'),2000);until(h,()=>!space.reason(s,'orbital'));assert.equal(space.start(s,'orbital'),true);until(h,()=>space.complete(s,'orbital'),3000);
  until(h,()=>!space.reason(s,'departure'));assert.equal(space.start(s,'departure'),true);assert.equal(space.start(s,'departure'),false);until(h,()=>space.complete(s,'departure'),3000);
  assert.ok(space.data(s).missions.every(m=>m.receipts.filter(r=>r.paid).length>=h.ctx.CivilSpaceContent.phases[m.kind].duration/10));assert.equal(space.start(s,'departure'),false);h.roundtrip();assert.equal(s.civilization.maxSpeed,64);mark(h,'Earth ending');finalState=clone(s);
  fs.writeFileSync('/tmp/postwar-earth-rule-evidence.json',JSON.stringify({kind:'isolated adapter test; not natural play',log,ending:space.data(s),members:w.members(s)},null,2));
});
test('finale save validation rejects fabricated victories, free components, skipped time and transport assets',()=>{
  assert.ok(finalState);const h=harness(finalState);h.roundtrip();
  for(const mutate of [s=>s.civilization.space.unification.worldLedgerLength=1,s=>s.civilization.space.missions[0].paid.spaceparts=0,s=>s.civilization.space.missions[0].receipts[0].at=s.civilization.space.missions[0].startedAt,s=>s.civilization.space.missions.at(-1).completedAt--,s=>s.civilization.space.missions.at(-1).progress=0,s=>s.civilization.worldstage.missions.find(m=>m.region==='islands').transportAssetId++]){const bad=clone(finalState);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
test('space recipes neither create components without power nor bypass real input debits',()=>{
  const h=harness(finalState),s=h.s;for(const job of Object.keys(h.ctx.CivilPrecisionContent.recipes))s.game.workers[job]=0;s.game.workers.aerospaceworker=2;s.game.workers.biosystemworker=2;
  const before=clone(s.stores);let calls=0;const run=(job,n,cost,output)=>{calls++;for(let i=0;i<n;i++){assert.equal(h.v.pay(s.stores,cost),true);h.r.credit(s.stores,output);}return n;};
  assert.equal(h.ctx.CivilPrecision.run(s,'home',{run,powerAvailable:0}).used,0);assert.equal(calls,0);assert.deepEqual(clone(s.stores),before);
  assert.equal(h.ctx.CivilPrecision.run(s,'home',{run,powerAvailable:20}).used,20);near(s.stores.spaceparts,before.spaceparts+.2);near(s.stores.lifesupport,before.lifesupport+.2);near(s.stores.steel,before.steel-2);near(s.stores.chemicals,before.chemicals-1);
});

test('late economic previews keep live histories untouched and do not announce a future ending',()=>{
  const h=harness(finalState),before=clone(h.s),copy=h.ctx.CivilForecast.copy(h.s);assert.ok(copy.civilization.worldstage.ledger.length<=2);assert.deepEqual(clone(h.s),before);
  const mission=copy.civilization.space.missions.at(-1);mission.completedAt=null;mission.progress=590;copy.civilization.elapsed=mission.receipts.at(-1).at+10;const notes=h.messages.length;h.ctx.Civilization.settleEconomy(copy);assert.equal(h.messages.length,notes);assert.deepEqual(clone(h.s),before);
});
