const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-city.json'),'utf8')).state,messages=[];
  const ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:x=>messages.push(x)},CivilSociety:{outputFactor:()=>1,workforce:s=>s.game.population,foodPopulation:s=>s.game.population}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/advanced.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/industry.js','src/postwar/advanced.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  ctx.CivilAdvanced.init(s);return {s,ctx,a:ctx.CivilAdvanced,i:ctx.CivilIndustry,messages};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function unlocked(h){const {s}=h;s.civilization.tech.chemistry=true;s.civilization.tech.steel=true;Object.assign(s.civilization.advanced.made,{minerals:true,chemicals:true});return h;}
function inputs(s){s.stores={wood:100,tools:100,minerals:100,chemicals:100,iron:100,coal:100,parts:100,scrap:100};}
function machines(s){Object.assign(s.game.buildings,{mineralquarry:1,chemicalworks:1,steelworks:1,glassworks:1,utilitypower:1});}
test('first-city knowledge unlocks chemistry without requiring a still-young 400-person population; production evidence reveals the next step',()=>{
  const {s,ctx,a}=harness();s.civilization.urban.city=false;assert.equal(ctx.CivilCatalog.researchAvailable(s,'chemistry'),false);s.civilization.urban.city=true;s.game.population=0;
  assert.equal(ctx.CivilCatalog.researchAvailable(s,'chemistry'),true);assert.equal(a.buildings.mineralquarry.gate(),false);s.civilization.tech.chemistry=true;assert.equal(a.buildings.mineralquarry.gate(),true);assert.equal(a.buildings.chemicalworks.gate(),false);assert.equal(ctx.CivilCatalog.researchAvailable(s,'steel'),false);
  s.civilization.advanced.made.minerals=true;assert.equal(a.buildings.chemicalworks.gate(),true);assert.equal(a.buildings.glassworks.gate(),false);s.civilization.advanced.made.chemicals=true;assert.equal(ctx.CivilCatalog.researchAvailable(s,'steel'),true);assert.equal(a.buildings.glassworks.gate(),true);
  for(const facility of Object.values(ctx.CivilAdvancedContent.facilities))assert.ok(Object.keys(facility.cost).every(k=>['wood','iron','parts','tools'].includes(k)));
});
test('the optional advanced state initializes once without material or made-marker gifts and rejects explicit malformed states',()=>{
  const {s,a}=harness(),before=JSON.stringify(s),stores=JSON.stringify(s.stores);a.init(s);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(s.stores),stores);assert.ok(Object.values(s.civilization.advanced.made).every(v=>v===false));assert.doesNotThrow(()=>a.validate(s));
  for(const value of [null,false,0]){const bad=structuredClone(s);bad.civilization.advanced=value;a.init(bad);assert.equal(bad.civilization.advanced,value);assert.throws(()=>a.validate(bad));}
  for(const mutate of [x=>x.made.chemicals=1,x=>x.made.extra=true,x=>delete x.made.glass,x=>x.made.steel=true]){const bad=structuredClone(s);mutate(bad.civilization.advanced);assert.throws(()=>a.validate(bad));}
  const legacy=structuredClone(s);delete legacy.civilization.advanced;assert.doesNotThrow(()=>a.validate(legacy));a.init(legacy);assert.equal(JSON.stringify(legacy.stores),stores);
});
test('all four materials can be bootstrapped without electricity and the actual made flags survive spending the output',()=>{
  const h=unlocked(harness()),{s,i,a}=h;machines(s);s.game.buildings.powerhouse=0;s.game.buildings.scrubber=0;s.game.buildings.utilitypower=0;s.game.workers={mineralworker:2,chemist:1,steelworker:1,glassworker:1};s.stores={tools:10,coal:10,iron:10};Object.assign(s.civilization.advanced.made,{minerals:false,chemicals:false,steel:false,glass:false});
  i.settle(s);near(s.stores.minerals,1.4);near(s.stores.chemicals,.07);near(s.stores.steel,.3);near(s.stores.glass,.2);near(s.stores.coal,8.6);assert.equal(s.civilization.industry.generation,0);assert.equal(s.civilization.industry.used,0);assert.ok(Object.values(s.civilization.advanced.made).every(Boolean));
  s.stores.chemicals=0;s.stores.steel=0;const reload=JSON.parse(JSON.stringify(s));a.init(reload);assert.ok(reload.civilization.advanced.made.chemicals);assert.ok(reload.civilization.advanced.made.steel);assert.doesNotThrow(()=>a.validate(reload));
});
test('shortages stop whole paid batches; neither machinery nor an unavailable powered run can mint material',()=>{
  const {s,i}=unlocked(harness());machines(s);s.game.buildings.scrubber=0;s.game.workers={chemist:2,steelworker:2,glassworker:2};s.stores={tools:10,minerals:.3,coal:.1,iron:10,chemicals:0};const before=JSON.stringify(s.stores);
  i.settle(s);assert.equal(JSON.stringify(s.stores),before);assert.equal(s.stores.steel,undefined);assert.equal(s.stores.glass,undefined);
  s.stores.minerals=.4;s.stores.coal=.3;i.settle(s);near(s.stores.chemicals,.12);assert.equal(s.stores.coal,0);assert.ok(Object.values(s.stores).every(v=>v>=0));
});
test('legacy and utility generators pay once and all consumers share one remainder including coal-heat fallback',()=>{
  const {s,i}=unlocked(harness());machines(s);inputs(s);s.game.buildings.scrubber=1;s.game.buildings.filterplant=1;
  s.game.workers={electrician:1,utilityworker:1,chemist:3,steelworker:3,glassworker:3,machinist:3};
  const f=i.settle(s),state=s.civilization.industry;assert.equal(state.generation,14);assert.equal(state.demand,24);assert.equal(state.used,14);near(-f['电工'].coal,.6);near(-f['公用电站值守'].coal,.9);near(-f['公用电站值守'].parts,.03);
  near(f['化工工'].chemicals,1.2);near(f['炼钢工'].steel,1.5);near(f['玻璃工'].glass,.9);near(f['机械工'].parts,.9);assert.equal(state.productionPower,0);assert.equal(s.stores.power,undefined);assert.ok(state.used<=state.generation);assert.doesNotThrow(()=>i.validate(s));
});
test('public services consume their budget before materials and workshop consumers, without refiring generators',()=>{
  const h=unlocked(harness()),{s,i,ctx}=h;machines(s);inputs(s);s.game.buildings.powerhouse=0;s.game.buildings.scrubber=0;s.game.workers={utilityworker:1,chemist:4,steelworker:1,machinist:1};let calls=0;
  ctx.CivilServices={demandCapacity:()=>6,run:(state,id,{run,powerAvailable})=>{calls++;assert.equal(id,'home');assert.equal(powerAvailable,10);const paid=run('medic',1,{chemicals:.2},{medicine:.4});return {used:paid*6,demand:6};}};
  const f=i.settle(s);assert.equal(calls,1);assert.equal(s.civilization.industry.generation,10);assert.equal(s.civilization.industry.used,10);assert.equal(s.civilization.industry.productionPower,0);near(f['化工工'].chemicals,1.04);near(f['炼钢工'].steel,.3);near(f['机械工'].parts,.3);near(-f['公用电站值守'].coal,.9);assert.doesNotThrow(()=>i.validate(s));
});
test('capacity validation supports a real grid over 100 power while rejecting power unsupported by built facilities',()=>{
  const {s,i,a}=unlocked(harness());machines(s);inputs(s);s.game.buildings.utilitypower=4;s.game.workers={utilityworker:16};s.game.buildings.scrubber=0;i.settle(s);assert.equal(s.civilization.industry.generation,160);assert.doesNotThrow(()=>i.validate(s));
  s.game.workers.utilityworker=0;assert.doesNotThrow(()=>i.validate(s),'last tick survives a normal reassignment');i.settle(s);assert.equal(s.civilization.industry.generation,0);
  const bad=structuredClone(s);bad.civilization.industry.generation=999;bad.civilization.industry.online=true;assert.throws(()=>i.validate(bad));
  const noFacility=structuredClone(s);noFacility.civilization.industry.demand=999;assert.throws(()=>i.validate(noFacility));const tooMany=structuredClone(s);tooMany.game.buildings.utilitypower=7;assert.throws(()=>a.validate(tooMany));
});
test('paid mine and coal expansions add operator capacity rather than multiplying the same workers outputs',()=>{
  const {s,ctx,i}=unlocked(harness());s.game.buildings.mine=1;s.game.buildings.coalpit=1;s.game.workers={miner:12,collier:12};s.stores={tools:10};i.settle(s);near(s.stores.ore,4.8);near(s.stores.coal,4);
  s.game.buildings.mineexpansion=1;s.game.buildings.coalexpansion=1;s.stores={tools:10};i.settle(s);assert.equal(ctx.CivilCatalog.jobCapacity(s,'miner'),12);assert.equal(ctx.CivilCatalog.jobCapacity(s,'collier'),12);near(s.stores.ore,14.4);near(s.stores.coal,12);near(s.stores.tools,9.28);
});
test('advanced production on a clone has identical actual flows without mutating authoritative flags or supplies',()=>{
  const {s,i}=unlocked(harness());machines(s);inputs(s);s.game.workers={mineralworker:2,chemist:2,steelworker:2,glassworker:2,utilityworker:1};const before=JSON.stringify(s),copy=structuredClone(s),prediction=i.settle(copy);assert.equal(JSON.stringify(s),before);
  const actual=i.settle(s);assert.equal(JSON.stringify(actual),JSON.stringify(prediction));assert.equal(JSON.stringify(s),JSON.stringify(copy));
});
test('remote material hooks use their node warehouse, slots and power and mark a shared discovery only after real production',()=>{
  const {s,ctx,a}=unlocked(harness());s.civilization.advanced.made.glass=false;const node={stores:{minerals:5,coal:5,tools:5,parts:5},workers:{glassworker:2,utilityworker:1}};
  s.civilization.regions.nodes.rail=node;s.civilization.municipal={nodes:{rail:{buildings:{glassworks:1,utilitypower:1}}}};ctx.CivilMunicipal={jobCapacity:()=>({glassworker:4,utilityworker:4})};
  const before=JSON.stringify(s.stores),run=(job,count,cost,out)=>{let n=count;for(const [key,x]of Object.entries(cost))n=Math.min(n,Math.floor((node.stores[key]||0)/x));for(const [key,x]of Object.entries(cost))node.stores[key]=(node.stores[key]||0)-x*n;for(const [key,x]of Object.entries(out))node.stores[key]=(node.stores[key]||0)+x*n;return n;};
  const prep=a.prepare(s,{factor:.8,run},'rail'),result=a.run(s,{factor:.8,run,powerAvailable:prep.generation},'rail');near(prep.generation,8);assert.equal(result.used,2);near(node.stores.glass,.8);near(node.stores.coal,3.6);assert.equal(JSON.stringify(s.stores),before);assert.equal(s.civilization.advanced.made.glass,true);
});
test('the natural first-city checkpoint can pay and produce the chemistry-to-steel-and-glass chain from old supplies alone',()=>{
  const {s,i,a,ctx}=harness();assert.equal(s.stores.chemicals,undefined);assert.equal(s.stores.steel,undefined);assert.equal(s.stores.glass,undefined);
  const step=()=>{s.civilization.elapsed+=10;ctx.CivilRules.settle(s);ctx.CivilVillage.settle(s);i.settle(s);};
  const afford=cost=>{let loops=0;while(!ctx.CivilRules.canPay(s,cost)&&loops++<3600)step();assert.ok(ctx.CivilRules.pay(s,cost),JSON.stringify(cost));};
  const research=id=>{const r=ctx.CivilText.research[id];assert.equal(ctx.CivilCatalog.researchAvailable(s,id),true);afford(r.cost);for(let n=0;n<r.duration/10;n++)step();s.civilization.tech[id]=true;};
  const build=id=>{assert.equal(a.buildings[id].gate(),true);afford(a.buildings[id].cost());s.game.buildings[id]=(s.game.buildings[id]||0)+1;};
  research('chemistry');build('mineralquarry');s.game.workers.mineralworker=2;step();build('chemicalworks');s.game.workers.chemist=2;step();
  build('utilitypower');s.game.workers.utilityworker=1;build('filterplant');build('glassworks');s.game.workers.glassworker=2;research('steel');build('steelworks');s.game.workers.steelworker=2;step();
  assert.ok(s.stores.steel>0&&s.stores.glass>0&&s.stores.chemicals>0);assert.ok(Object.values(s.civilization.advanced.made).every(Boolean));assert.equal(s.civilization.hunger,0);assert.ok(Object.values(s.game.workers).reduce((a,b)=>a+b,0)<s.game.population);assert.doesNotThrow(()=>a.validate(s));assert.doesNotThrow(()=>i.validate(s));
  // A total electrical outage still makes repair materials and all three downstream products from paid fuel.
  s.game.workers.electrician=0;s.game.workers.utilityworker=0;const before={...s.stores};step();assert.equal(s.civilization.industry.generation,0);assert.ok(s.stores.steel>before.steel);assert.ok(s.stores.glass>before.glass);assert.ok(s.stores.parts>before.parts);
});
