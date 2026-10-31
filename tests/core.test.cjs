const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function context(files,extra={}) {const ctx=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,performance,TextDecoder,_:s=>s,...extra});for(const file of ['content/zh.js','content/development.js','src/postwar/population.js',...files]) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});return ctx;}
function state() {return {game:{fire:{value:3},temperature:{value:3},builder:{level:4},buildings:{hut:2,lodge:1,granary:1},population:4,workers:{hunter:2}},stores:{wood:80,food:30,scrap:30},civilization:{elapsed:0,speed:1,maxSpeed:1,tech:{},events:{},policy:'equal',policySeen:{equal:true},trust:50,hunger:0,stableFor:0,populationClock:0,productionClock:0,randomClock:240,policyCooldown:0,residentTime:0,research:null,journey:null,pending:null,settled:false,station:false,pump:false,trade:false,visited:{}},timers:{},cooldown:{}};}
test('one simulation clock keeps in-flight fire, gathering, production, event and journey deadlines aligned across rate changes',()=>{
 const {SimulationClock}=context(['src/postwar/clock.js']);const clock=new SimulationClock();const calls=[];
 clock.add(()=>calls.push(['fire',clock.time]),300000,0,'fire');
 clock.add(()=>calls.push(['gather',clock.time]),60000);
 clock.add(()=>calls.push(['production',clock.time]),10000,10000);
 clock.add(()=>calls.push(['event',clock.time]),180000);
 clock.add(()=>calls.push(['journey',clock.time]),120000);
 clock.advance(20000);clock.rate=2;clock.advance(10000*clock.rate);clock.rate=4;clock.advance(65000*clock.rate);
 assert.equal(clock.time,300000);assert.equal(calls.filter(c=>c[0]==='production').length,30);
 for(const [key,at] of [['fire',300000],['gather',60000],['event',180000],['journey',120000]]) assert.deepEqual(calls.find(c=>c[0]===key),[key,at]);
});
test('cancelled fire timer never fires; persisted remaining timer does not reset at load',()=>{
 const {SimulationClock}=context(['src/postwar/clock.js']);const clock=new SimulationClock();let hits=0;
 const timer=clock.add(()=>hits++,300000,0,'fire');clock.advance(100000);const snapshot=clock.snapshot();clock.clear(timer);clock.advance(300000);assert.equal(hits,0);
 const resumed=new SimulationClock();resumed.restored=snapshot;resumed.add(()=>hits++,300000,0,'fire');resumed.advance(199999);assert.equal(hits,0);resumed.advance(1);assert.equal(hits,1);
});
test('balanced jobs sustain food, produce wood, and can meet the first-settlement predicate',()=>{
 const {CivilRules}=context(['src/postwar/rules.js']);const s=state();
 for(let i=0;i<60;i++) CivilRules.settle(s);
 assert.ok(s.stores.food>30);assert.ok(s.stores.wood>80);assert.equal(s.civilization.hunger,0);assert.ok(CivilRules.stable(s));
 s.stores.food=19;assert.equal(CivilRules.stable(s),false);
});
test('policies impose both consumption and output changes, and hunger recovers without negative inventory',()=>{
 const {CivilRules}=context(['src/postwar/rules.js']);const s=state();const equal=CivilRules.rates(s);
 s.civilization.policy='ration';const ration=CivilRules.rates(s);assert.ok(ration['猎人'].food<equal['猎人'].food);assert.ok(ration['口粮'].food>equal['口粮'].food);
 s.game.workers={};s.stores.food=0;for(let i=0;i<18;i++)CivilRules.settle(s);assert.equal(s.stores.food,0);assert.equal(s.civilization.hunger,180);
 s.stores.food=100;for(let i=0;i<9;i++)CivilRules.settle(s);assert.equal(s.civilization.hunger,0);
});
test('failed payments are atomic and never partially consume other resources',()=>{
 const {CivilRules}=context(['src/postwar/rules.js']);const s=state(),before=JSON.stringify(s.stores);
 assert.equal(CivilRules.pay(s,{wood:20,scrap:100}),false);assert.equal(JSON.stringify(s.stores),before);
 assert.equal(CivilRules.pay(s,{wood:20,scrap:10}),true);assert.equal(s.stores.wood,60);
});
test('save codec rejects foreign saves, nonfinite inventory, unsafe keys and overassigned population',()=>{
 const {CivilPlatform:p}=context(['src/postwar/platform.js']);const valid=state();assert.doesNotThrow(()=>p.validate(valid));
 assert.throws(()=>p.decode(JSON.stringify({format:'adarkroom',version:1,state:valid})));
 const bad=state();bad.stores.wood=NaN;assert.throws(()=>p.validate(bad));
 const jobs=state();jobs.game.workers.hunter=5;assert.throws(()=>p.validate(jobs));
 const injected=JSON.parse(JSON.stringify(valid).replace('"tech":{}','"tech":{"__proto__":{}}'));assert.throws(()=>p.validate(injected));
});
test('only successful null cloud read permits a new game; a failed read cannot enable writes',async()=>{
 let writes=0;const {CivilPlatform:p}=context(['src/postwar/platform.js'],{LumiMakerSdk:{ready:async()=>({ready:true}),readSave:async()=>{throw Error('network');},writeSave:async()=>writes++}});
 await assert.rejects(p.load());assert.equal(p.loaded,false);p.dirty=true;await p.flush();assert.equal(writes,0);
 p.sdk.readSave=async()=>null;const blank=await p.load();assert.equal(Object.keys(blank).length,0);assert.equal(p.loaded,true);
});
test('cloud writes serialize requests and retain changes made during an in-flight write',async()=>{
 const requests=[];let resolve;const s=state();
 const {CivilPlatform:p}=context(['src/postwar/platform.js'],{State:s,LumiMakerSdk:{ready:async()=>({ready:true}),readSave:async()=>null,writeSave:payload=>{requests.push(JSON.parse(payload));return new Promise(r=>resolve=r);}}});
 p.status=()=>{};await p.load();p.dirty=true;const first=p.flush();s.stores.wood=123;p.changed();await p.flush();assert.equal(requests.length,1);
 resolve();await first;clearTimeout(p.timer);p.timer=null;const second=p.flush();assert.equal(requests.length,2);assert.equal(requests[1].state.stores.wood,123);resolve();await second;
});
test('optional undefined ADR income fields serialize without poisoning a valid save',()=>{
 const s=state();s.income={builder:{delay:10,stores:{wood:2},timeLeft:undefined}};
 const {CivilPlatform:p}=context(['src/postwar/platform.js'],{State:s});const encoded=p.serialize();assert.ok(p.decode(encoded));assert.equal(JSON.parse(encoded).state.income.builder.timeLeft,undefined);
});
test('live entry contains no third-party scripts, tracking tags or browser-storage persistence',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/<script[^>]+src=["']https?:/);assert.doesNotMatch(html,/gtag|googletagmanager|localStorage/);
 for(const f of ['script/engine.js','src/postwar/platform.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,f),'utf8'),/localStorage/);
});

test('save rejects dangerous dynamic path keys and invalid fire before live state is replaced',()=>{
 const {CivilPlatform:p}=context(['src/postwar/platform.js']);
 const malformed=state();malformed.game.fire.value=99;assert.throws(()=>p.validate(malformed));
 const key=state();key.stores['x\"].constructor']=1;assert.throws(()=>p.validate(key));
 const unsupported=state();unsupported.stores.compass=1;assert.throws(()=>p.validate(unsupported));
});
test('saved natural-game checkpoint passes current validation and retains food/cooldowns',()=>{
 const {CivilPlatform:p}=context(['src/postwar/platform.js']);
 const file=path.join(root,'tests/fixtures/natural-first-residents.json');
 const s=p.decode(fs.readFileSync(file,'utf8'));assert.equal(s.game.population,3);assert.equal(s.cooldown.gatherButton,30.1);assert.ok(s.stores.food>18);
});
test('outpost upkeep consumes real supplies, suspends without negative stores, then resumes',()=>{
 const {CivilRules}=context(['src/postwar/rules.js']);const s=state();s.game.buildings.outpost=1;
 const flow=CivilRules.rates(s);assert.equal(flow['外站维护'].wood,-.5);
 CivilRules.settle(s);assert.equal(s.civilization.outpostSupplied,true);
 s.game.population=0;s.game.workers={};s.game.builder.level=0;s.stores={wood:0,food:0};CivilRules.settle(s);assert.equal(s.civilization.outpostSupplied,false);assert.equal(s.stores.wood,0);assert.equal(s.stores.food,0);
 s.stores={wood:1,food:1};CivilRules.settle(s);assert.equal(s.civilization.outpostSupplied,true);assert.equal(s.stores.wood,.5);assert.equal(s.stores.food,.8);
});
test('resident food takes precedence over outpost maintenance',()=>{
 const {CivilRules}=context(['src/postwar/rules.js']);const s=state();s.game.workers={};s.game.buildings.outpost=1;s.stores.food=.48;
 CivilRules.settle(s);assert.equal(s.civilization.hunger,0);assert.equal(s.civilization.outpostSupplied,false);assert.equal(s.stores.food,0);
});
test('natural outpost checkpoint preserves both technologies and permanent 4x entitlement',()=>{
 const {CivilPlatform:p}=context(['src/postwar/platform.js']);const s=p.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-outpost.json'),'utf8'));
 assert.equal(s.civilization.maxSpeed,4);assert.equal(s.civilization.tech.water,true);assert.equal(s.civilization.tech.metal,true);assert.equal(s.game.population,8);assert.equal(s.game.buildings.outpost,1);
});
test('village save resumes new jobs, industrial stock, health and exact in-flight research time',()=>{
 const {CivilPlatform:p}=context(['src/postwar/platform.js']);const s=p.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-village-research.json'),'utf8'));
 assert.equal(s.game.population,12);assert.equal(s.game.workers.farmer,2);assert.equal(s.game.workers.smith,2);assert.equal(s.civilization.research.id,'sanitation');assert.equal(s.civilization.research.remaining,166);assert.equal(s.stores.tools,8.5);assert.ok(s.civilization.village.health<80);
 const malformed=structuredClone(s);malformed.game.workers.farmer=5;malformed.game.workers.hunter=0;assert.throws(()=>p.validate(malformed));
 malformed.game.workers.farmer=2;malformed.civilization.village.health=101;assert.throws(()=>p.validate(malformed));
});
test('natural town checkpoint retains the separate neighbour and does not replay the aid migration',()=>{
 const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-river-town.json'),'utf8')).state;
 const {CivilPlatform:p,CivilVillage:v}=context(['src/postwar/rules.js','src/postwar/village.js','src/postwar/platform.js']);
 assert.doesNotThrow(()=>p.validate(s));assert.equal(s.game.population,20);assert.equal(s.civilization.village.town,true);assert.equal(s.civilization.village.schema,1);
 assert.equal(s.civilization.village.riverTools,s.civilization.village.convoys+12);
 const received=s.civilization.village.riverTools;v.init(s);assert.equal(s.civilization.village.riverTools,received);
});

test('natural second-leader save preserves the child, constitution, completed handover and mineral research',()=>{
 const {CivilPlatform:p,CivilSociety:society}=context(['content/industry.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/platform.js']);
 const s=p.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-second-leader-mining.json'),'utf8'));
 assert.equal(s.game.population,28);assert.equal(society.workforce(s),27);assert.equal(s.civilization.society.cohorts.filter(c=>c.age<18).reduce((n,c)=>n+c.count,0),1);
 assert.equal(s.civilization.society.generation,2);assert.equal(s.civilization.society.leader.title,'工程代表');assert.equal(s.civilization.society.history[0].reason,'retirement');
 assert.equal(s.civilization.society.axes.structure,'federation');assert.equal(s.civilization.society.axes.selection,'election');assert.equal(s.civilization.society.governed,true);
 assert.equal(s.civilization.industry.mineKnown,true);assert.equal(s.civilization.research.id,'mining');assert.equal(s.civilization.research.remaining,91);assert.equal(s.civilization.village.convoys,38);
 society.init(s);assert.equal(s.civilization.society.history[0].from,0);assert.equal(s.civilization.society.leader.termStarted,12);
 const before=JSON.stringify(s.civilization.society);society.init(s);society.tick(s);assert.equal(JSON.stringify(s.civilization.society),before);
});

test('natural powered town reloads the third leader, expanded services and a sustainable seven-unit load',()=>{
 const ctx=context(['content/industry.js','src/postwar/society.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/industry.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8'));
 assert.equal(s.game.population,44);assert.equal(ctx.CivilSociety.workforce(s),42);assert.equal(s.civilization.society.generation,3);assert.equal(s.civilization.society.history[1].reason,'election');
 assert.equal(s.game.buildings.clinic,2);assert.equal(s.game.buildings.schoolhouse,2);assert.equal(s.game.workers.medic,4);assert.equal(s.game.workers.teacher,4);assert.equal(s.civilization.tech.power,true);
 assert.equal(s.civilization.industry.generation,8);assert.equal(s.civilization.industry.used,7);assert.equal(s.civilization.industry.announcedPower,true);
 const pollution=s.civilization.industry.pollution,convoys=s.civilization.village.convoys,parts=s.stores.parts;
 for(let i=0;i<12;i++){ctx.CivilRules.settle(s);ctx.CivilVillage.settle(s);ctx.CivilSociety.settle(s);ctx.CivilIndustry.settle(s);}
 assert.equal(s.civilization.hunger,0);assert.equal(s.civilization.industry.used,7);assert.ok(s.civilization.industry.pollution<pollution);assert.ok(s.stores.parts>parts);assert.equal(s.civilization.village.convoys,convoys+2);ctx.CivilPlatform.validate(s);
});

test('regional and urban modules upgrade a natural powered save without gifts and reject explicitly malformed optional state',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8'));
 const population=s.game.population,stores=JSON.stringify(s.stores);
 for(const name of ['CivilVillage','CivilSociety','CivilIndustry','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal'])ctx[name].init(s);
 assert.equal(s.game.population,population);assert.equal(JSON.stringify(s.stores),stores);
 ctx.CivilPlatform.validate(s);ctx.State=s;
 const resumed=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());
 assert.equal(JSON.stringify(resumed.civilization.regions),JSON.stringify(s.civilization.regions));
 assert.equal(JSON.stringify(resumed.civilization.urban),JSON.stringify(s.civilization.urban));
 for(const field of ['society','industry','regions','urban','origins','municipal'])for(const value of [null,false,0,[]]){
  const bad=structuredClone(s);bad.civilization[field]=value;assert.throws(()=>ctx.CivilPlatform.validate(bad),field+' must reject '+JSON.stringify(value));
 }
});

test('unaltered natural town charter retains finite families, separate neighbours, fulfilled public works and cargo in transit',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-chartered-town.json'),'utf8')),c=s.civilization;
 assert.equal(s.game.population,92);assert.equal(c.urban.chartered,true);assert.equal(c.urban.city,false);
 assert.equal(c.urban.admitted,46);assert.equal(ctx.CivilUrban.count(c.urban.source),434);assert.equal(c.urban.parties.length,0);
 assert.equal(c.urban.economy.treatment,true);assert.equal(c.urban.economy.education,true);assert.ok(c.urban.economy.food>0);assert.ok(c.urban.economy.medicine>0);
 assert.equal(c.regions.nodes.river.relation,'associated');assert.equal(c.regions.nodes.river.completedProjects.publicWorks,true);
 assert.equal(c.regions.nodes.rail.population,32);assert.equal(c.regions.nodes.highland.population,18);
 assert.equal(c.regions.shipments[0].remaining,31);assert.equal(c.regions.shipments[0].cargo.medicine,.5);
 assert.equal(ctx.CivilRegions.load(s),2);assert.equal(ctx.CivilRegions.availableTransport(s),4);
 const oldStocks=JSON.stringify(s.stores),oldPopulation=s.game.population;ctx.CivilRegions.init(s);assert.equal(JSON.stringify(s.stores),oldStocks);assert.equal(s.game.population,oldPopulation);
 for(const n of Object.values(c.regions.nodes))assert.equal(n.births.credit,0);
 const before=JSON.stringify({stores:s.stores,regions:c.regions,urban:c.urban});ctx.CivilRegions.init(s);ctx.CivilUrban.init(s);
 assert.equal(JSON.stringify({stores:s.stores,regions:c.regions,urban:c.urban}),before);ctx.State=s;ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());
});

test('natural regional growth preserves paid births, three freight routes and two independently reserved passenger crews',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-regional-growth.json'),'utf8')),c=s.civilization;
 assert.equal(s.game.population,246);assert.equal(ctx.CivilSociety.workforce(s),162);assert.equal(c.society.generation,5);assert.equal(c.society.births.scaled,true);assert.ok(c.society.births.credit>0);
 assert.equal(ctx.CivilUrban.count(c.urban.source),295);assert.equal(c.urban.admitted,177);assert.equal(ctx.CivilUrban.reservedBeds(s),8);
 assert.equal(ctx.CivilUrban.reservedTransport(s),4);assert.equal(ctx.CivilRegions.reservedTransport(s),6);assert.equal(ctx.CivilRegions.availableTransport(s),0);
 assert.equal(c.regions.nodes.river.relation,'integrated');assert.equal(c.regions.nodes.rail.relation,'trade');assert.equal(c.regions.nodes.highland.relation,'trade');
 assert.ok(c.urban.economy.food>0);assert.ok(c.urban.economy.medicine>0);assert.equal(c.urban.economy.education,true);assert.equal(c.urban.city,false);
 ctx.CivilRegions.init(s);
 const before=JSON.stringify([s.stores,s.game,c.regions,c.urban,c.society.births]);ctx.CivilSociety.init(s);ctx.CivilRegions.init(s);ctx.CivilUrban.init(s);
 assert.equal(JSON.stringify([s.stores,s.game,c.regions,c.urban,c.society.births]),before);ctx.State=s;ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());
});

test('the unaltered natural first city retains its sixth leader, earned charter and finite population ledger after reload',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-city.json'),'utf8')),c=s.civilization,u=c.urban;
 assert.equal(s.game.population,450);assert.equal(ctx.CivilSociety.workforce(s),305);assert.equal(c.society.generation,6);assert.equal(c.society.history.length,5);
 assert.equal(u.city,true);assert.equal(u.chartered,true);assert.equal(u.cityStable,300);assert.equal(ctx.CivilUrban.developmentReady(s,true),true);
 assert.equal(u.admitted,337);assert.equal(ctx.CivilUrban.count(u.source),135);assert.equal(ctx.CivilUrban.reservedBeds(s),8);assert.equal(u.deceased,0);
 assert.equal(c.regions.nodes.river.relation,'integrated');assert.equal(c.regions.nodes.river.completedProjects.publicWorks,true);
 assert.equal(u.economy.productionPower,4);assert.ok(u.economy.food>0);assert.ok(u.economy.medicine>0);assert.equal(c.industry.pollution,0);
 ctx.CivilRegions.init(s);
 const before=JSON.stringify([s.game,s.stores,c.society,c.regions,u]);
 for(const name of ['CivilSociety','CivilRegions','CivilUrban'])ctx[name].init(s);
 assert.equal(JSON.stringify([s.game,s.stores,c.society,c.regions,u]),before);assert.equal(ctx.CivilUrban.nextEvent(s),null);
 ctx.State=s;const resumed=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(resumed.civilization.urban),JSON.stringify(u));
});

test('natural river-network migration reloads the same source, paid permit and two distinct passenger receipts',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-origin-migration.json'),'utf8')),c=s.civilization,u=c.urban,n=c.origins.nodes.river_network;
 assert.equal(s.game.population,508);assert.equal(ctx.CivilSociety.workforce(s),373);assert.equal(c.society.generation,6);assert.equal(u.city,true);assert.equal(ctx.CivilUrban.sourceId(s),'river_network');
 assert.equal(n.population,1816);assert.equal(n.born,58);assert.equal(n.sourceDeaths,22);assert.equal(n.transitDeaths,0);assert.equal(n.admitted,12);assert.equal(n.permit.paid,true);
 assert.equal(ctx.CivilOrigins.inTransit(n),8);assert.equal(ctx.CivilOrigins.remaining(s,'river_network'),1060);assert.equal(ctx.CivilUrban.reservedTransport(s),4);
 assert.equal(u.admitted,369);assert.equal(u.deceased,5);assert.equal(ctx.CivilUrban.count(u.source),106);
 assert.equal(u.parties[0].id,39);assert.equal(u.parties[0].state,'returning');assert.equal(u.parties[1].id,42);assert.equal(u.parties[1].remaining,110);
 ctx.CivilOrigins.init(s);assert.ok(Object.values(n.departures).every(p=>p.target==='home'));
 const before=JSON.stringify(s);for(const module of ['CivilSociety','CivilRegions','CivilUrban','CivilOrigins'])ctx[module].init(s);assert.equal(JSON.stringify(s),before);
 ctx.State=s;const restored=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(restored.civilization.origins),JSON.stringify(c.origins));
 const broken=structuredClone(s);broken.civilization.urban.parties.pop();assert.throws(()=>ctx.CivilPlatform.validate(broken),'a source receipt cannot silently lose its real passengers');
});

test('unaltered natural municipal construction retains paid local facilities, in-flight materials and actual builder time',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-municipal-construction.json'),'utf8')),c=s.civilization,m=c.municipal.nodes;
 assert.equal(c.elapsed,28508);assert.equal(s.game.population,524);assert.equal(c.society.generation,7);
 assert.equal(c.regions.nodes.river.population,24);assert.equal(c.regions.nodes.rail.population,44);assert.equal(c.regions.nodes.highland.population,28);
 assert.equal(m.river.buildings.farmland,1);assert.equal(m.river.buildings.clinic,1);assert.equal(m.river.completed.length,2);
 assert.equal(m.rail.buildings.farmland,1);assert.equal(m.rail.project.id,2);assert.equal(m.rail.project.status,'supplying');assert.equal(Object.keys(m.rail.project.buffer).length,0);
 assert.equal(m.highland.project.status,'building');assert.equal(m.highland.project.remaining,60);assert.equal(c.regions.nodes.highland.workers.builder,2);
 const materials=c.regions.shipments.find(p=>p.route==='rail');assert.equal(materials.purpose,'municipal');assert.equal(materials.projectId,2);assert.equal(materials.cargo.wood,64);assert.equal(materials.remaining,66);
 const returning=c.regions.shipments.find(p=>p.route==='highland');assert.equal(returning.phase,'empty');assert.equal(returning.remaining,1);
 assert.equal(Object.values(m).some(n=>n.town||n.city),false);assert.equal(c.origins.nodes.river_network.admitted,28);
 const before=JSON.stringify(s);for(const name of ['CivilSociety','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal'])ctx[name].init(s);assert.equal(JSON.stringify(s),before);
 ctx.State=s;const loaded=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(loaded.civilization.municipal),JSON.stringify(c.municipal));
 const bad=structuredClone(s);bad.civilization.municipal.nodes.river.buildings.residential=1;assert.throws(()=>ctx.CivilPlatform.validate(bad),'unpaid facilities cannot be added on import');
});
