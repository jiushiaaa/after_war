const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function harness() {
 const observed=[];let active=null;
 const state={stores:{wood:100,food:30,scrap:60},game:{fire:{value:3},temperature:{value:3},builder:{level:4},population:4,workers:{hunter:1},buildings:{hut:2,lodge:1,granary:1}},timers:{},cooldown:{}};
 const parts=s=>s.split(/[.\[\]"']+/).filter(Boolean);
 const SM={get(p,z){let v=state;for(const k of parts(p))v=v?.[k];return v===undefined && z?0:v;},set(p,v){const ks=parts(p);let o=state;for(const k of ks.slice(0,-1))o=o[k]??=( {} );o[ks.at(-1)]=v;},add(p,v){this.set(p,this.get(p,true)+v);},addM(p,values){for(const [k,v]of Object.entries(values))this.add(p+'.'+k,v);},fireUpdate(){}};
 const Room={build(){},updateBuildButtons(){},updateIncomeView(){},buttons:{}};
 const Outside={getMaxPopulation:()=>state.game.buildings.hut*4,setTitle(){},updateVillage(){},updateWorkersView(){},killVillagers(n){state.game.population-=n;}};
 const Events={startEvent(e){active=e;},activeEvent:()=>active,buttonClick(){}};
 const ctx=vm.createContext({State:state,Room,Outside,Events,$SM:SM,AudioEngine:{},Notifications:{},CivilClock:{rate:1},CivilPlatform:{},Engine:{saveGame(){}},Math:Object.assign(Object.create(Math),{random:()=>.9}),_:s=>s,setTimeout,clearTimeout,console});
 for(const file of ['src/postwar/rules.js','content/zh.js','src/postwar/adapter.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
 ctx.Civilization.initState();ctx.Civilization.notify=t=>observed.push(t);ctx.Civilization.refresh=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Civilization.updateIncome=()=>{};
 function step(n){for(let i=0;i<n;i++)ctx.Civilization.tick();}
 function choose(key){const b=active.scenes.start.buttons[key];assert.ok(b,'choice exists: '+key);b.onChoose?.();active=null;}
 return {ctx,state,step,choose,observed,get active(){return active;}};
}
test('condition-driven policy, stable settlement, research and mandatory discoveries form a reachable sequence',()=>{
 const h=harness(),c=h.state.civilization;h.state.stores.food=12;
 h.step(1);assert.equal(h.active.title,'同一口锅');h.choose('policy_equal');assert.equal(c.policy,'equal');
 h.state.stores.food=30;h.step(59);assert.equal(c.settled,false);h.step(1);assert.equal(c.settled,true);assert.equal(c.maxSpeed,2);assert.equal(c.speed,1);
 h.state.game.buildings.workshop=1;h.ctx.Civilization.research('water');assert.equal(c.research.remaining,120);h.step(119);assert.equal(c.tech.water,undefined);h.step(1);assert.equal(c.tech.water,true);
 h.ctx.Civilization.depart('station');assert.equal(c.journey.remaining,120);h.step(120);assert.equal(c.pending,'station');h.choose('recover');assert.equal(c.station,true);
 h.step(1);assert.equal(c.pending,'merchant');h.choose('decline');assert.equal(c.trade,false);assert.equal(c.events.merchant,true);
 h.ctx.Civilization.depart('pump');assert.equal(c.journey.remaining,180);h.step(180);assert.equal(c.pending,'pump');h.choose('repair');assert.equal(c.pump,true);
});
test('adequate food still prompts a rule after 60 resident seconds; no deliberate famine required',()=>{
 const h=harness();h.state.stores.food=100;h.step(59);assert.equal(h.active,null);h.step(1);assert.equal(h.active.title,'同一口锅');
});
test('low-trust empty settlement can recover population with warmth, beds and food',()=>{
 const h=harness();h.state.game.population=0;h.state.game.workers={};h.state.civilization.trust=0;
 h.ctx.Civilization.arrivals();assert.equal(h.state.game.population,2);
});
test('ongoing research and journey cannot be double-started or charged twice',()=>{
 const h=harness();h.state.game.buildings.workshop=1;
 h.ctx.Civilization.research('water');const after=h.state.stores.scrap;h.ctx.Civilization.research('metal');assert.equal(h.state.stores.scrap,after);assert.equal(h.state.civilization.research.id,'water');
 h.ctx.Civilization.depart('station');const food=h.state.stores.food;h.ctx.Civilization.depart('station');assert.equal(h.state.stores.food,food);
});
test('no-resident event wait stays serializable, and policy switching cannot repeatedly farm trust',()=>{
 const h=harness();h.state.game.population=0;h.state.game.workers={};h.state.civilization.randomClock=0;h.step(10);assert.equal(h.state.civilization.randomClock,0);
 h.ctx.Civilization.policyEvent();h.choose('policy_equal');const trust=h.state.civilization.trust;
 h.ctx.Civilization.policyEvent();h.choose('policy_equal');assert.equal(h.state.civilization.trust,trust);
});

test('an unresolved incidental event cannot erase an arriving mainline discovery',()=>{
 const h=harness(),c=h.state.civilization;h.state.game.buildings.workshop=1;c.policy='equal';
 h.ctx.Civilization.depart('station');c.pending='cold';h.ctx.Civilization.showPending();
 h.step(120);assert.equal(c.pending,'cold');assert.equal(c.journey.remaining,0);
 h.choose('hands');h.step(1);assert.equal(c.pending,'station');assert.equal(h.active.title,'旧交通站');
});
