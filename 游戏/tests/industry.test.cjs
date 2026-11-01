const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
 const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-river-town.json'),'utf8')).state;
 const messages=[];
 const ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:t=>messages.push(t)},CivilSociety:{outputFactor:()=>1,workforce:s=>s.game.population,foodPopulation:s=>s.game.population}});
 for(const file of ['content/zh.js','content/development.js','content/industry.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/industry.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
 ctx.CivilIndustry.init(s);return {s,ctx,i:ctx.CivilIndustry,messages};
}
test('industrial research remains hidden until the physical mineral discovery, then respects dependencies',()=>{
 const h=harness(),s=h.s,c=s.civilization;
 assert.equal(h.ctx.CivilCatalog.researchAvailable(s,'mining'),false);
 assert.equal(h.i.journeys.geology.allowed(s),true);
 const before=JSON.stringify(s.stores);
 const e=h.i.event('geology',(message,fn)=>()=>fn());e.buttons.survey.onChoose();
 assert.equal(c.industry.mineKnown,true);assert.equal(JSON.stringify(s.stores),before);
 assert.equal(h.ctx.CivilCatalog.researchAvailable(s,'mining'),true);
 assert.equal(h.ctx.CivilCatalog.researchAvailable(s,'furnace'),false);c.tech.mining=true;
 assert.equal(h.ctx.CivilCatalog.researchAvailable(s,'furnace'),true);assert.equal(h.ctx.CivilCatalog.researchAvailable(s,'power'),false);
});
test('a real mine and workers consume tools and produce ore; excess workers cannot exceed its capacity',()=>{
 const {s,i}=harness();s.game.workers={miner:8};s.game.buildings.mine=1;s.stores={tools:10};
 const f=i.settle(s);assert.equal(f['采矿工'].tools,-.12);assert.equal(s.stores.ore,4.8);assert.equal(s.stores.tools,9.88);
 delete s.game.buildings.mine;const before=JSON.stringify(s.stores);i.settle(s);assert.equal(JSON.stringify(s.stores),before);
});
test('industrial shortages stop whole worker batches atomically and recover with supplies',()=>{
 const {s,i}=harness();s.game.workers={smelter:2};s.game.buildings.furnace=1;s.stores={ore:20,coal:.3,tools:10};
 const before=JSON.stringify(s.stores);i.settle(s);assert.equal(JSON.stringify(s.stores),before);
 s.stores.coal=.6;i.settle(s);assert.equal(s.stores.iron,.6);assert.ok(s.stores.coal>=0);assert.equal(s.stores.ore,18.8);assert.ok(s.civilization.industry.blocked.smelter);
});
test('manual mechanical production can bootstrap a generator and recover from total blackout',()=>{
 const {s,i}=harness();s.game.workers={machinist:2};s.game.buildings.machineworks=1;s.stores={iron:10,scrap:10,tools:10,parts:0,coal:0};
 i.settle(s);assert.equal(s.stores.parts,.6);assert.equal(s.civilization.industry.generation,0);assert.equal(s.civilization.industry.used,0);assert.match(s.civilization.industry.blocked.machinist,/手动/);
 s.game.buildings.powerhouse=1;s.game.workers.electrician=1;s.stores.coal=1;
 i.settle(s);assert.equal(s.civilization.industry.generation,4);assert.equal(s.civilization.industry.used,4);assert.equal(s.civilization.industry.productionPower,4);assert.ok(Math.abs(s.stores.parts-1.58)<1e-8);
});
test('power is a per-settlement capacity with paid fuel and maintenance, never an accumulating resource',()=>{
 const {s,i}=harness();s.game.workers={electrician:1};s.game.buildings.powerhouse=1;s.stores={coal:.6,parts:.02};
 i.settle(s);assert.equal(s.civilization.industry.generation,4);assert.equal(s.civilization.industry.used,0);assert.equal(s.stores.coal,0);assert.equal(s.stores.parts,0);assert.equal(s.stores.power,undefined);
 i.settle(s);assert.equal(s.civilization.industry.generation,0);assert.equal(s.civilization.industry.online,false);assert.equal(s.civilization.industry.used,0);assert.equal(s.stores.electricity,undefined);
});
test('a preview on a deep clone produces exact resource deltas without touching the authoritative state',()=>{
 const {s,i}=harness();s.game.buildings.mine=1;s.game.buildings.coalpit=1;s.game.buildings.furnace=1;s.game.workers={miner:2,collier:2,smelter:2};s.stores={tools:10};
 const before=JSON.stringify(s),copy=structuredClone(s);const flow=i.settle(copy);
 assert.equal(JSON.stringify(s),before);const live=i.settle(s);assert.equal(JSON.stringify(live),JSON.stringify(flow));assert.equal(JSON.stringify(s.stores),JSON.stringify(copy.stores));
 assert.equal(s.stores.iron,1.2);assert.ok(Math.abs(s.stores.coal-.8)<1e-8);
});
test('cleaning competes for power, consumes actual maintenance and lowers accumulated pollution',()=>{
 const {s,i}=harness();s.game.buildings.powerhouse=1;s.game.buildings.machineworks=1;s.game.buildings.scrubber=1;s.game.workers={electrician:1,machinist:2};s.stores={coal:10,parts:10,wood:10,iron:10,scrap:10,tools:10};s.civilization.industry.pollution=60;
 const f=i.settle(s);assert.equal(s.civilization.industry.demand,5);assert.equal(s.civilization.industry.used,3);assert.equal(f['烟尘处理'].wood,-.2);assert.ok(s.civilization.industry.pollution<60);
 // One powered operator and one manual operator: 0.5 + 0.3 parts, less real maintenance.
 assert.ok(Math.abs(s.stores.parts-10.77)<1e-8);assert.ok(s.civilization.village.health<100);
});
test('industrial output honors the shared society multiplier and its state survives serialization',()=>{
 const {s,i,ctx}=harness();s.game.buildings.mine=1;s.game.workers={miner:1};s.stores={tools:10};ctx.CivilSociety.outputFactor=()=>.8;
 i.settle(s);assert.equal(s.stores.ore,.96);assert.doesNotThrow(()=>i.validate(JSON.parse(JSON.stringify(s))));
 const invalid=structuredClone(s);invalid.civilization.industry.used=5;invalid.civilization.industry.generation=4;assert.throws(()=>i.validate(invalid));
 delete invalid.civilization.industry;assert.doesNotThrow(()=>i.validate(invalid));i.init(invalid);assert.equal(invalid.civilization.industry.mineKnown,false);
});
test('the first sustained-power announcement occurs once and does not replay after loading',()=>{
 const {s,i,messages}=harness();s.civilization.industry.online=true;i.tick(s);i.tick(s);assert.equal(messages.length,1);
 const reloaded=JSON.parse(JSON.stringify(s));i.init(reloaded);i.tick(reloaded);assert.equal(messages.length,1);
});

test('the full mine-to-powered-workshop chain is affordable from the natural town without gifted industrial inputs',()=>{
 const {s,i,ctx}=harness();s.game.workers={farmer:3,smith:2,medic:2,teacher:2,salvager:2};
 const step=()=>{ctx.CivilRules.settle(s);ctx.CivilVillage.settle(s);i.settle(s);};
 const afford=cost=>{for(let n=0;n<3600 && !ctx.CivilRules.canPay(s,cost);n++)step();assert.equal(ctx.CivilRules.pay(s,cost),true,'affordable: '+JSON.stringify(cost));};
 const research=id=>{const r=ctx.CivilText.research[id];assert.equal(ctx.CivilCatalog.researchAvailable(s,id),true,id+' is discovered');afford(r.cost);for(let n=0;n<r.duration/10;n++)step();s.civilization.tech[id]=true;};
 const build=id=>{assert.ok(i.buildings[id].gate(),id+' gate');afford(i.buildings[id].cost());s.game.buildings[id]=(s.game.buildings[id]||0)+1;};
 afford(i.journeys.geology.cost);for(let n=0;n<24;n++)step();i.event('geology',(msg,fn)=>()=>fn()).buttons.survey.onChoose();
 research('mining');build('mine');build('coalpit');s.game.workers.miner=2;s.game.workers.collier=2;
 research('furnace');build('furnace');s.game.workers.smelter=2;
 research('mechanics');build('machineworks');s.game.workers.machinist=2;
 research('power');build('powerhouse');s.game.workers.electrician=1;step();
 assert.equal(s.civilization.industry.online,true);assert.equal(s.civilization.industry.used,4);
 assert.ok(s.stores.ore>=0 && s.stores.coal>=0 && s.stores.iron>=0 && s.stores.parts>=0);
 assert.equal(Object.values(s.game.workers).reduce((a,b)=>a+b,0),20);assert.equal(s.civilization.hunger,0);
});
test('null industrial state is rejected rather than reset and power evidence remains bounded by actual installed plant',()=>{
 const {s,i}=harness();for(const value of [null,false,0]){const bad=structuredClone(s);bad.civilization.industry=value;i.init(bad);assert.equal(bad.civilization.industry,value);assert.throws(()=>i.validate(bad));}
 s.civilization.industry.generation=10;s.civilization.industry.online=true;s.game.buildings.powerhouse=0;assert.throws(()=>i.validate(s));
});
test('mechanical power is actual powered output only and old missing evidence is neither fabricated nor required',()=>{
 const {s,i}=harness();s.game.buildings.powerhouse=1;s.game.buildings.machineworks=1;s.game.buildings.scrubber=1;s.game.workers={electrician:2,machinist:2};s.stores={coal:10,parts:10,wood:10,iron:.5,scrap:10,tools:10};
 i.settle(s);assert.equal(s.civilization.industry.used,3);assert.equal(s.civilization.industry.productionPower,2);assert.doesNotThrow(()=>i.validate(s));
 const legacy=structuredClone(s);delete legacy.civilization.industry.productionPower;const before=JSON.stringify(legacy);i.init(legacy);assert.equal(JSON.stringify(legacy),before);assert.doesNotThrow(()=>i.validate(legacy));
 for(const value of [-1,4,7,NaN,null]){const bad=structuredClone(s);bad.civilization.industry.productionPower=value;assert.throws(()=>i.validate(bad));}
 s.game.workers.electrician=0;i.settle(s);assert.equal(s.civilization.industry.productionPower,0);
});
