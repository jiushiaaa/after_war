const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fresh}=require('./helpers/census-fixture.cjs');
test('A7 new-world setup freezes until confirmed and chooses a conserved, reproducible world seed',()=>{
 const {s,ctx}=fresh(),a=ctx.CivilSetup; a.opening(s);const before=JSON.stringify(s.stores);
 assert.equal(s.civilization.pending,'game_setup');ctx.Civilization.tick();assert.equal(s.civilization.elapsed,0);
 assert.equal(a.confirm(s,{seed:-1,fast:true,logistics:false,autonomy:false}),false);
 assert.equal(a.confirm(s,{seed:7417,fast:true,logistics:true,autonomy:false}),true);
 a.validate(s);ctx.CivilCensus.validate(s);assert.equal(JSON.stringify(s.stores),before);
 assert.equal(s.game.population,0);assert.equal(s.civilization.census.initial,ctx.CivilCensus.initial(7417).total);
 assert.equal(a.confirm(s,{seed:12,fast:false,logistics:false,autonomy:false}),false);
});
test('A7 extra logistics stops only new departures and remains opt-in; old saves are untouched',()=>{
 const {s,ctx}=fresh(),a=ctx.CivilSetup;a.opening(s);a.confirm(s,{seed:1,fast:false,logistics:true,autonomy:true});
 assert.match(a.freightReason(s),/300秒/);s.civilization.elapsed=300;assert.equal(a.freightReason(s),null);
 const e={action:'start',equipmentVersion:1,at:300},d={world:{}};a.attach(s,e);a.open(d,e);assert.equal(d.world.scenario.autonomy,true);
 delete s.civilization.polishVersion;delete s.civilization.setup;const exact=JSON.stringify(s);a.opening(s);a.validate(s);assert.equal(a.freightReason(s),null);assert.equal(JSON.stringify(s),exact);
});
test('A7 fast-start river guidance reflects the actual alternative contact prerequisites',()=>{
 const {s,ctx}=fresh();ctx.CivilSetup.opening(s);ctx.CivilSetup.confirm(s,{seed:1,fast:true,logistics:false,autonomy:false});
 Object.assign(s.civilization,{settled:true,station:true,pump:true});Object.assign(s.game.buildings,{workshop:1,outpost:1});
 const guide=ctx.CivilGuide.steps(s);assert.equal(guide.goal,'寻找河谷');assert.ok(guide.need.includes('研究'+ctx.CivilText.research.records.name));assert.ok(!guide.need.includes('研究道路维护'));
 s.civilization.tech.water=true;s.civilization.tech.records=true;assert.deepEqual(Array.from(ctx.CivilGuide.steps(s).need),['旧公路 → 沿河勘察']);
});
test('A7 archives have eight original chains with three gated nodes; awards never change assets',()=>{
 const {s,ctx}=fresh(),a=ctx.CivilArchives,nodes=a.nodes(s);assert.equal(nodes.length,24);
 for(const chain of Object.keys(a.chains))assert.equal(nodes.filter(n=>n.chain===chain).length,3);
 assert.equal(a.milestones(s).length,12);const before=JSON.stringify([s.stores,s.game.population,s.civilization.census]);
 a.tick(s);a.tick(s);a.validate(s);assert.equal(JSON.stringify([s.stores,s.game.population,s.civilization.census]),before);
 assert.equal(s.civilization.archives.records.facility_station,undefined);s.civilization.station=true;s.civilization.elapsed=90;a.tick(s);
 assert.equal(s.civilization.archives.records.facility_station,90);s.civilization.elapsed=91;a.tick(s);assert.equal(s.civilization.archives.records.facility_station,90);
 assert.ok(a.history(s).some(e=>e.category==='archives'));assert.equal(a.nextEvent(s),null);
 s.civilization.settled=true;assert.equal(a.nextEvent(s),'story_stage');
});
test('A7 archival imports reject unknown or future records; legacy history remains read-only',()=>{
 const {s,ctx}=fresh(),a=ctx.CivilArchives;s.civilization.archives.records.fabricated=0;assert.throws(()=>a.validate(s));delete s.civilization.archives.records.fabricated;
 s.civilization.archives.records.facility_station=1;assert.throws(()=>a.validate(s));
 delete s.civilization.archives;delete s.civilization.polishVersion;s.civilization.station=true;const exact=JSON.stringify(s);a.init(s);a.tick(s);a.history(s);a.validate(s);assert.equal(JSON.stringify(s),exact);
});
function local(){const notices=[],s={civilization:{elapsed:600,course:{id:'commons'}}},ctx=vm.createContext({State:s,Date,Promise,clearTimeout(){},CivilPlatform:{loaded:true,decodeSave:async text=>{if(text==='bad')throw Error('corrupt');return JSON.parse(text);},encode:async()=>JSON.stringify(s),status:m=>notices.push(m)}});vm.runInContext(fs.readFileSync('src/postwar/local-saves.js','utf8'),ctx);return {a:ctx.CivilLocalSaves,ctx,s,notices};}
test('A7 failed local read prevents automatic saves; valid data never silently becomes a new game',async()=>{
 const {a}=local();a.readRaw=async key=>key==='active'?1:{text:'bad'};await assert.rejects(a.load());assert.equal(a.blocked,true);
 let writes=0;a.write=async()=>writes++;assert.equal(await a.save(),false);assert.equal(writes,0);
 a.readRaw=async()=>null;await assert.rejects(a.load(),/只读/);assert.equal(writes,0);
});
test('A7 queued local snapshots cannot overwrite a different world after asynchronous encoding',async()=>{
 const {a,ctx}=local();let release,writes=0;ctx.CivilPlatform.encode=()=>new Promise(r=>release=r);a.write=async()=>writes++;
 const pending=a.save();await Promise.resolve();ctx.State={civilization:{elapsed:0}};release('{}');assert.equal(await pending,false);assert.equal(writes,0);
});
test('A7 local write errors preserve dirty status and explicit saves surface the error',async()=>{
 const {a}=local();a.write=async()=>{throw Error('quota');};assert.equal(await a.save(),false);assert.equal(a.dirty,true);await assert.rejects(a.save(2,true),/quota/);
});
