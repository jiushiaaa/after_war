const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function context(files,extra={}) {const ctx=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,performance,TextDecoder,_:s=>s,...extra});for(const file of ['content/zh.js','content/development.js','src/postwar/population.js',...files]) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});return ctx;}
function state() {return {game:{fire:{value:3},temperature:{value:3},builder:{level:4},buildings:{hut:2,lodge:1,granary:1},population:4,workers:{hunter:2}},stores:{wood:80,food:30,scrap:30},civilization:{elapsed:0,speed:1,maxSpeed:1,tech:{},events:{},policy:'equal',policySeen:{equal:true},trust:50,hunger:0,stableFor:0,populationClock:0,productionClock:0,randomClock:240,policyCooldown:0,residentTime:0,research:null,journey:null,pending:null,settled:false,station:false,pump:false,trade:false,visited:{}},timers:{},cooldown:{}};}
function migrateOnlyLegacyHeir(ctx,s){
 const expected=JSON.parse(JSON.stringify(s)),x=expected.civilization.society;
 assert.equal(x.heir.alive,undefined);x.heir.alive=x.heir.age<85;if(!x.heir.alive)x.training=null;
 ctx.CivilSociety.init(s);assert.deepEqual(JSON.parse(JSON.stringify(s)),expected);
}
function successionHarness(){
 const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-city.json'),'utf8')).state,notes=[];let active=null,redraws=0,closed=0,nativeClicks=0;
 const panel={find(){return {text(){}};}};
 const events={activeScene:'start',activeEvent:()=>active,startEvent(e){active=e;e.eventPanel=panel;},loadScene(){redraws++;},endEvent(){active=null;closed++;},buttonClick(){nativeClicks++;}};
 const ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout:fn=>{fn();return 0;},clearTimeout(){},Math:Object.assign(Object.create(Math),{random:()=>.9}),
   Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){},killVillagers(n){s.game.population-=n;}},Events:events,AudioEngine:{},Engine:{saveGame(){}},Notifications:{printMessage:x=>notes.push(x)},
   $SM:{get:p=>p.split('.').reduce((v,k)=>v?.[k],s),fireUpdate(){}}});
 const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
 for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 ctx.Civilization.initState();ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};ctx.Outside.updateWorkersView=()=>{};
 return {s,ctx,notes,step(n){for(let i=0;i<n;i++)ctx.Civilization.tick();},click(key){ctx.Events.buttonClick({attr:()=>key});},get active(){return active;},get redraws(){return redraws;},get closed(){return closed;},get nativeClicks(){return nativeClicks;}};
}
test('an open election refreshes exactly when its leader dies and preserves the new death history on a real event click',()=>{
 const h=successionHarness(),{s,ctx}=h,x=s.civilization.society;x.axes.selection='election';x.leader.age=84;x.leader.alive=true;x.succession='election';s.civilization.pending='succession';s.civilization.elapsed=x.year*600+599;
 ctx.Civilization.showPending();assert.match(h.active.scenes.start.text[0],/六年任期/);h.step(1);
 assert.equal(x.leader.alive,false);assert.match(h.active.scenes.start.text[0],/已经离世/);assert.equal(h.redraws,1);h.step(3);assert.equal(h.redraws,1);
 h.click('engineer');assert.equal(h.closed,1);assert.equal(s.civilization.pending,null);assert.equal(x.history.at(-1).reason,'death');assert.equal(x.leader.title,'工程代表');assert.equal(h.nativeClicks,0);ctx.CivilPlatform.validate(s);
});
test('a stale regency button neither closes the event nor reports success after the heir becomes adult',()=>{
 const h=successionHarness(),{s,ctx}=h,x=s.civilization.society;x.axes.selection='hereditary';x.leader.alive=false;x.succession='death';x.heir={age:17,trained:false,alive:true};s.civilization.pending='succession';s.civilization.elapsed=x.year*600+599;
 ctx.Civilization.showPending();const stale=h.active.scenes.start.buttons.regent.onChoose;h.step(1);assert.deepEqual(Object.keys(h.active.scenes.start.buttons),['heir']);
 const notes=h.notes.length;assert.equal(stale(),false);h.click('regent');assert.equal(h.closed,0);assert.equal(s.civilization.pending,'succession');assert.equal(h.notes.length,notes);
 h.click('heir');assert.equal(h.closed,1);assert.equal(x.leader.age,18);assert.equal(s.civilization.pending,null);ctx.CivilPlatform.validate(s);
});
test('an expired candidate refreshes to a family nomination without an automatic successor or a population grant',()=>{
 const h=successionHarness(),{s,ctx}=h,x=s.civilization.society;x.axes.selection='hereditary';x.leader.alive=false;x.succession='death';x.heir={age:84,trained:true,alive:true};s.civilization.pending='succession';s.civilization.elapsed=x.year*600+599;
 ctx.Civilization.showPending();h.step(1);assert.deepEqual(Object.keys(h.active.scenes.start.buttons),['family']);assert.equal(x.heir.alive,false);
 const before=JSON.stringify([s.game,s.stores,x.cohorts]);h.click('heir');assert.equal(h.closed,0);h.click('family');assert.equal(h.closed,1);
 assert.equal(JSON.stringify([s.game,s.stores,x.cohorts]),before);assert.equal(x.transition,180);assert.equal(x.axes.selection,'hereditary');assert.equal(x.leader.age,40);ctx.CivilPlatform.validate(s);
});
test('succession refresh never replaces a pending paid reform or charges its reservation twice',()=>{
 const h=successionHarness(),{s,ctx}=h,x=s.civilization.society;x.succession=null;x.reformCooldown=0;s.civilization.pending=null;
 assert.equal(ctx.CivilSociety.beginReform(s,'structure'),true);ctx.Civilization.showPending();const active=h.active,knowledge=s.stores.knowledge,paid=x.reformPaid;
 x.leader.alive=false;x.succession='death';assert.equal(ctx.Civilization.refreshSuccessionEvent(),false);
 assert.equal(h.active,active);assert.equal(s.civilization.pending,'constitution_structure');assert.equal(x.reformPaid,paid);assert.equal(s.stores.knowledge,knowledge);assert.equal(h.redraws,0);
 h.click('keep');assert.equal(h.nativeClicks,1,'other ADR choices still use the original native event path');
});
test('an unattended dead leader stays at the recorded death age while thirty complete years of shared simulation remain reloadable',()=>{
 const h=successionHarness(),{s,ctx}=h,x=s.civilization.society,start=x.year,generation=x.generation;
 x.leader.age=80;x.leader.alive=false;x.succession='death';s.civilization.pending='succession';for(const key of ctx.CivilCatalog.resources)s.stores[key]=1e9;
 ctx.Civilization.showPending();let checks=0;
 // Ample synthetic inputs isolate event/year/serialization behavior, not unattended economic balance.
 for(let t=0;t<18000;t++){h.step(1);if(s.civilization.elapsed%600===0){ctx.CivilPlatform.validate(s);checks++;}}
 assert.equal(checks,30);assert.equal(x.year,start+30);assert.equal(x.leader.age,80);assert.equal(x.leader.alive,false);assert.equal(x.generation,generation);assert.equal(s.civilization.pending,'succession');
 assert.equal(s.civilization.origins.nodes.river_network.year,x.year);assert.equal(s.civilization.urban.year,x.year);ctx.CivilPlatform.validate(s);
 const reloaded=JSON.parse(JSON.stringify(s));ctx.CivilPlatform.validate(reloaded);ctx.CivilSociety.init(reloaded);const before=JSON.stringify(reloaded.civilization.society);ctx.CivilSociety.tick(reloaded);assert.equal(JSON.stringify(reloaded.civilization.society),before);
});
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

test('file import validates before confirmation and never replaces live progress on failure or cancellation',async()=>{
 const live=state(),before=JSON.stringify(live),notes=[],event={};let active=event,input,scene='import';
 const events={activeEvent:()=>active,get activeScene(){return scene;},loadScene:next=>{scene=next;}};
 const {CivilPlatform:p}=context(['src/postwar/platform.js'],{State:live,Events:events,setTimeout:fn=>fn(),Notifications:{notify:(_who,text)=>notes.push(text)},document:{createElement(){return input={click(){},files:[]};}}});
 const raw=JSON.stringify({format:'postwar-civilization',version:1,state:state()});
 p.chooseImportFile();input.files=[{text:async()=>raw}];await input.onchange();assert.equal(scene,'confirm');assert.equal(JSON.stringify(live),before);assert.deepEqual(JSON.parse(JSON.stringify(p.pending)),state());
 scene='import';p.inspectImport('{broken');assert.equal(scene,'import');assert.equal(p.pending,null);assert.match(notes.at(-1),/导入未执行/);
 p.chooseImportFile();input.files=[{text:async()=>{throw Error('read failed');}}];await input.onchange();assert.match(notes.at(-1),/文件读取失败/);assert.equal(scene,'import');
 let resolve;p.chooseImportFile();input.files=[{text:()=>new Promise(r=>resolve=r)}];const loading=input.onchange();active=null;resolve(raw);await loading;assert.equal(scene,'import');assert.equal(p.pending,null);assert.equal(JSON.stringify(live),before);
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
 const {CivilPlatform:p,CivilSociety:society}=context(['content/industry.js','src/postwar/rules.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/platform.js']);
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
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8'));
 const population=s.game.population,stores=JSON.stringify(s.stores);
 for(const name of ['CivilVillage','CivilSociety','CivilIndustry','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal','CivilAdvanced','CivilServices'])ctx[name].init(s);
 assert.equal(s.game.population,population);assert.equal(JSON.stringify(s.stores),stores);
 ctx.CivilPlatform.validate(s);ctx.State=s;
 const resumed=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());
 assert.equal(JSON.stringify(resumed.civilization.regions),JSON.stringify(s.civilization.regions));
 assert.equal(JSON.stringify(resumed.civilization.urban),JSON.stringify(s.civilization.urban));
 for(const field of ['society','industry','regions','urban','origins','municipal','advanced','services'])for(const value of [null,false,0,[]]){
  const bad=structuredClone(s);bad.civilization[field]=value;assert.throws(()=>ctx.CivilPlatform.validate(bad),field+' must reject '+JSON.stringify(value));
 }
});

test('unaltered natural town charter retains finite families, separate neighbours, fulfilled public works and cargo in transit',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
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
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
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
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-city.json'),'utf8')),c=s.civilization,u=c.urban;
 assert.equal(s.game.population,450);assert.equal(ctx.CivilSociety.workforce(s),305);assert.equal(c.society.generation,6);assert.equal(c.society.history.length,5);
 assert.equal(u.city,true);assert.equal(u.chartered,true);assert.equal(u.cityStable,300);assert.equal(ctx.CivilUrban.developmentReady(s,true),true);
 assert.equal(u.admitted,337);assert.equal(ctx.CivilUrban.count(u.source),135);assert.equal(ctx.CivilUrban.reservedBeds(s),8);assert.equal(u.deceased,0);
 assert.equal(c.regions.nodes.river.relation,'integrated');assert.equal(c.regions.nodes.river.completedProjects.publicWorks,true);
 assert.equal(u.economy.productionPower,4);assert.ok(u.economy.food>0);assert.ok(u.economy.medicine>0);assert.equal(c.industry.pollution,0);
 ctx.CivilRegions.init(s);
 migrateOnlyLegacyHeir(ctx,s);
 const before=JSON.stringify([s.game,s.stores,c.society,c.regions,u]);
 for(const name of ['CivilSociety','CivilRegions','CivilUrban'])ctx[name].init(s);
 assert.equal(JSON.stringify([s.game,s.stores,c.society,c.regions,u]),before);assert.equal(ctx.CivilUrban.nextEvent(s),null);
 ctx.State=s;const resumed=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(resumed.civilization.urban),JSON.stringify(u));
});

test('natural river-network migration reloads the same source, paid permit and two distinct passenger receipts',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-origin-migration.json'),'utf8')),c=s.civilization,u=c.urban,n=c.origins.nodes.river_network;
 assert.equal(s.game.population,508);assert.equal(ctx.CivilSociety.workforce(s),373);assert.equal(c.society.generation,6);assert.equal(u.city,true);assert.equal(ctx.CivilUrban.sourceId(s),'river_network');
 assert.equal(n.population,1816);assert.equal(n.born,58);assert.equal(n.sourceDeaths,22);assert.equal(n.transitDeaths,0);assert.equal(n.admitted,12);assert.equal(n.permit.paid,true);
 assert.equal(ctx.CivilOrigins.inTransit(n),8);assert.equal(ctx.CivilOrigins.remaining(s,'river_network'),1060);assert.equal(ctx.CivilUrban.reservedTransport(s),4);
 assert.equal(u.admitted,369);assert.equal(u.deceased,5);assert.equal(ctx.CivilUrban.count(u.source),106);
 assert.equal(u.parties[0].id,39);assert.equal(u.parties[0].state,'returning');assert.equal(u.parties[1].id,42);assert.equal(u.parties[1].remaining,110);
 ctx.CivilOrigins.init(s);assert.ok(Object.values(n.departures).every(p=>p.target==='home'));
 migrateOnlyLegacyHeir(ctx,s);
 const before=JSON.stringify(s);for(const module of ['CivilSociety','CivilRegions','CivilUrban','CivilOrigins'])ctx[module].init(s);assert.equal(JSON.stringify(s),before);
 ctx.State=s;const restored=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(restored.civilization.origins),JSON.stringify(c.origins));
 const broken=structuredClone(s);broken.civilization.urban.parties.pop();assert.throws(()=>ctx.CivilPlatform.validate(broken),'a source receipt cannot silently lose its real passengers');
});

test('unaltered natural municipal construction retains paid local facilities, in-flight materials and actual builder time',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-municipal-construction.json'),'utf8')),c=s.civilization,m=c.municipal.nodes;
 assert.equal(c.elapsed,28508);assert.equal(s.game.population,524);assert.equal(c.society.generation,7);
 assert.equal(c.regions.nodes.river.population,24);assert.equal(c.regions.nodes.rail.population,44);assert.equal(c.regions.nodes.highland.population,28);
 assert.equal(m.river.buildings.farmland,1);assert.equal(m.river.buildings.clinic,1);assert.equal(m.river.completed.length,2);
 assert.equal(m.rail.buildings.farmland,1);assert.equal(m.rail.project.id,2);assert.equal(m.rail.project.status,'supplying');assert.equal(Object.keys(m.rail.project.buffer).length,0);
 assert.equal(m.highland.project.status,'building');assert.equal(m.highland.project.remaining,60);assert.equal(c.regions.nodes.highland.workers.builder,2);
 const materials=c.regions.shipments.find(p=>p.route==='rail');assert.equal(materials.purpose,'municipal');assert.equal(materials.projectId,2);assert.equal(materials.cargo.wood,64);assert.equal(materials.remaining,66);
 const returning=c.regions.shipments.find(p=>p.route==='highland');assert.equal(returning.phase,'empty');assert.equal(returning.remaining,1);
 assert.equal(Object.values(m).some(n=>n.town||n.city),false);assert.equal(c.origins.nodes.river_network.admitted,28);
 const origin=c.origins.nodes.river_network,legacyPeople=JSON.stringify([origin.cohorts,origin.stores,origin.births,origin.born,origin.sourceDeaths]);
 ctx.CivilOrigins.init(s);assert.equal(ctx.CivilOrigins.schoolCapacity(s,'river_network'),40);assert.equal(JSON.stringify([origin.cohorts,origin.stores,origin.births,origin.born,origin.sourceDeaths]),legacyPeople);
 migrateOnlyLegacyHeir(ctx,s);
 const before=JSON.stringify(s);for(const name of ['CivilSociety','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal'])ctx[name].init(s);assert.equal(JSON.stringify(s),before);
 ctx.State=s;const loaded=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(loaded.civilization.municipal),JSON.stringify(c.municipal));
 const bad=structuredClone(s);bad.civilization.municipal.nodes.river.buildings.residential=1;assert.throws(()=>ctx.CivilPlatform.validate(bad),'unpaid facilities cannot be added on import');
});

test('unaltered natural advanced-service save preserves actual water, medicine, refitted freight and paid work through reload',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-advanced-services.json'),'utf8')),c=s.civilization,home=c.services.nodes.home;
 assert.equal(c.elapsed,36765);assert.equal(s.game.population,524);assert.equal(c.society.generation,9);assert.equal(Object.keys(c.tech).length,23);
 for(const key of ['minerals','chemicals','steel','glass']){assert.equal(c.advanced.made[key],true);assert.ok(s.stores[key]>0);}
 assert.equal(home.buildings.pharmacy,1);assert.equal(home.buildings.waterworks,1);assert.equal(home.project.id,3);assert.equal(home.project.type,'waterworks');assert.equal(home.project.remaining,277);assert.equal(home.project.lastWorkedAt,c.elapsed);
 assert.equal(s.game.workers.pharmacist,4);assert.equal(s.game.workers.waterworker,4);assert.equal(s.game.workers.servicebuilder,2);
 assert.equal(home.economy.waterCapacity,600);assert.ok(Math.abs(home.economy.medicine-1.68)<1e-8);assert.equal(home.economy.used,6);assert.equal(c.industry.used,25);assert.equal(c.industry.productionPower,4);
 assert.equal(home.water.usableAt,36772);assert.equal(home.water.consumed,false);assert.equal(c.regions.routes.river.capacity,128);assert.equal(c.regions.upgrades.projects.river.status,'complete');
 assert.equal(c.regions.nodes.river.population,72);assert.equal(c.municipal.nodes.river.buildings.clinic,2);assert.equal(c.municipal.nodes.river.project.buffer.tools,2);assert.equal(c.municipal.nodes.river.project.required.tools,12);
 const returning=c.regions.shipments.find(x=>x.route==='river');assert.equal(returning.phase,'empty');assert.equal(returning.capacity,128);assert.equal(returning.remaining,19);
 assert.equal(c.origins.nodes.river_network.admitted,51);assert.equal(c.origins.nodes.river_network.schooling.completed.length,1);assert.equal(ctx.CivilOrigins.schoolCapacity(s,'river_network'),50);
 const riverMigration=JSON.parse(JSON.stringify(c.origins.nodes.river_network));riverMigration.legacyHousingOverflow=0;riverMigration.introducedAt=c.origins.introducedAt;
 ctx.CivilOrigins.init(s);assert.equal(c.origins.schema,2);assert.equal(JSON.stringify(c.origins.nodes.river_network),JSON.stringify(riverMigration),'multi-source migration preserves the original river census, stores, births and departure receipts');
 for(const [id,population] of [['old_city_fringe',2000],['mountain_settlements',1600]]){
  const origin=c.origins.nodes[id];assert.equal(origin.introducedAt,c.elapsed);assert.equal(origin.year,61);assert.equal(origin.population,population);assert.equal(origin.born,0);assert.equal(origin.sourceDeaths,0);assert.equal(origin.admitted,0);assert.equal(origin.status,'unknown');
 }
 const assets=JSON.stringify([s.game,s.stores,c.services,c.advanced,c.regions,c.origins,c.municipal]);
 for(const name of ['CivilSociety','CivilIndustry','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal','CivilAdvanced','CivilServices'])ctx[name].init(s);
 assert.equal(c.society.heir.alive,true);assert.equal(JSON.stringify([s.game,s.stores,c.services,c.advanced,c.regions,c.origins,c.municipal]),assets);
 const once=JSON.stringify(s);ctx.CivilServices.tick(s);assert.equal(JSON.stringify(s),once,'same saved second cannot grant construction work');
 ctx.State=s;const restored=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(restored),JSON.stringify(s));
 restored.civilization.elapsed=36772;assert.equal(ctx.CivilServices.begin(restored).waterCapacity,600);assert.equal(ctx.CivilServices.begin(restored).waterCapacity,0);assert.equal(restored.stores.steel,s.stores.steel);assert.equal(restored.game.population,524);
});

test('unaltered natural three-source save resumes the same messenger and independent censuses without replaying model introduction',()=>{
 const ctx=context(['content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/platform.js']);
 const s=ctx.CivilPlatform.decode(fs.readFileSync(path.join(__dirname,'fixtures/natural-multi-origin-contact.json'),'utf8')),c=s.civilization,r=c.origins;
 assert.equal(c.elapsed,44488);assert.equal(s.game.population,899);assert.equal(c.society.generation,11);assert.equal(ctx.CivilCatalog.capacity(s),1004);assert.equal(r.schema,2);
 assert.equal(r.contactTrip.source,'old_city_fringe');assert.equal(r.contactTrip.remaining,327);assert.equal(r.contactTrip.lastWorkedAt,c.elapsed);
 for(const [id,population,born,deaths,status] of [['old_city_fringe',2039,64,25,'contacting'],['mountain_settlements',1631,51,20,'unknown']]){
  const n=r.nodes[id];assert.equal(n.introducedAt,44306);assert.equal(n.year,74);assert.equal(n.population,population);assert.equal(n.born,born);assert.equal(n.sourceDeaths,deaths);assert.equal(n.admitted,0);assert.equal(n.status,status);assert.equal(n.agreement,null);assert.equal(n.legacyHousingOverflow,0);
  assert.equal(c.society.cohorts.some(cohort=>cohort.originId===id),false,'source contact never grants home residents');
 }
 assert.equal(r.nodes.river_network.introducedAt,24051);assert.equal(r.nodes.river_network.admitted,414);
 const before=JSON.stringify(s);ctx.CivilOrigins.init(s);ctx.CivilOrigins.tick(s);assert.equal(JSON.stringify(s),before,'reload and repeated callback do not move the messenger or replay a birthday');
 ctx.State=s;const restored=ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize());assert.equal(JSON.stringify(restored),before);
});
