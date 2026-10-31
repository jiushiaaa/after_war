const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function context(files,extra={}) {const ctx=vm.createContext({setTimeout,clearTimeout,setInterval,clearInterval,performance,TextDecoder,...extra});for(const file of files) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});return ctx;}
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
