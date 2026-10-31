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
 for(const file of ['src/postwar/rules.js','content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/village.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/adapter.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
 ctx.Outside.updateWorkersView=()=>{};ctx.Civilization.initState();ctx.Civilization.notify=t=>observed.push(t);ctx.Civilization.refresh=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Civilization.updateIncome=()=>{};
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

test('village technologies respect prerequisites and old saves gain defaults without losing progress',()=>{
 const h=harness(),s=h.state,c=s.civilization;s.game.buildings.workshop=1;s.stores={wood:1000,food:1000,scrap:1000,tools:100};
 assert.equal(c.village.health,80);h.ctx.Civilization.research('agronomy');assert.equal(c.research,null);
 c.tech.water=true;c.pump=true;h.ctx.Civilization.research('agronomy');assert.equal(c.research.id,'agronomy');h.step(180);assert.equal(c.tech.agronomy,true);
 h.ctx.Civilization.research('school');assert.equal(c.research,null);c.tech.records=true;c.tech.preservation=true;h.ctx.Civilization.research('school');assert.equal(c.research.id,'school');
});
test('industry stops atomically on missing inputs and resident meals precede medical manufacture',()=>{
 const h=harness(),s=h.state;s.game.workers={smith:2,medic:1};s.stores={wood:10,scrap:.6,food:.48};
 h.ctx.CivilRules.settle(s);assert.equal(s.civilization.hunger,0);assert.equal(s.stores.tools,.25);assert.equal(s.stores.medicine,undefined);assert.ok(s.stores.scrap>=0);assert.equal(s.stores.food,0);
 s.stores={wood:0,scrap:10,food:10};s.game.builder.level=0;s.game.workers={smith:4};h.ctx.CivilRules.settle(s);assert.equal(s.stores.scrap,10);assert.equal(s.stores.tools,undefined);
});
test('irrigation depends on maintained supply and farm capacity limits output',()=>{
 const h=harness(),s=h.state;s.game.buildings.farm=1;s.game.workers={farmer:8};s.game.population=8;s.civilization.tech.irrigation=true;s.civilization.outpostSupplied=true;
 assert.equal(h.ctx.CivilRules.rates(s)['农夫'].food,8);s.civilization.outpostSupplied=false;assert.equal(h.ctx.CivilRules.rates(s)['农夫'].food,5.6);
});
test('convoys conserve remote food and delivered goods, suspend without payment, and resume',()=>{
 const h=harness(),s=h.state,c=s.civilization,v=c.village;c.outpostSupplied=true;v.riverAllied=true;s.game.buildings.road=1;s.stores={wood:20,food:20,tools:0,medicine:2};
 const before=JSON.stringify(s.stores);assert.equal(h.ctx.CivilVillage.convoy(s),false);assert.equal(JSON.stringify(s.stores),before);assert.equal(v.riverFood,80);
 s.stores.tools=2;assert.equal(h.ctx.CivilVillage.convoy(s),true);assert.equal(s.stores.tools,1);assert.equal(s.stores.medicine,1.5);assert.equal(s.stores.food,30);assert.equal(v.riverFood,68);assert.equal(v.riverTools,1);assert.equal(v.convoys,1);
 c.outpostSupplied=false;assert.equal(h.ctx.CivilVillage.convoy(s),false);assert.equal(v.convoys,1);
 c.outpostSupplied=true;v.riverFood=20;assert.equal(h.ctx.CivilVillage.convoy(s),false);assert.equal(v.riverFood,20);
});
test('river aid remains a separate polity and deferring pact does not require a second paid expedition',()=>{
 const h=harness(),s=h.state,c=s.civilization;s.game.buildings.workshop=1;s.game.buildings.outpost=1;c.tech.trails=true;c.policy='equal';s.stores={wood:100,food:200,tools:30,scrap:100};
 h.ctx.Civilization.depart('river');h.step(180);h.choose('meet');assert.equal(c.village.riverKnown,true);assert.equal(s.game.population,7);
 h.ctx.Civilization.depart('riverAid');h.step(180);h.choose('defer');assert.equal(c.village.riverFood,120);assert.equal(c.village.riverTools,12);const paid=s.stores.tools;h.ctx.Civilization.depart('riverAid');assert.equal(c.journey,null);assert.equal(s.stores.tools,paid);
 c.pending='riverAid';h.ctx.Civilization.showPending();h.choose('agree');assert.equal(c.village.riverAllied,true);assert.equal(c.village.riverTools,12);assert.equal(s.game.population,8);
});
test('town unlock requires sustained services and transported supplies, not merely a large population',()=>{
 const h=harness(),s=h.state,c=s.civilization,v=c.village;s.game.population=20;s.game.buildings.clinic=1;s.game.buildings.schoolhouse=1;s.stores={food:100,tools:20};
 for(let i=0;i<120;i++)h.ctx.CivilVillage.tick(s);assert.equal(v.town,false);
 v.convoys=3;v.riverAllied=true;c.outpostSupplied=true;v.routeStatus='往返正常';for(let i=0;i<119;i++)h.ctx.CivilVillage.tick(s);assert.equal(v.town,false);h.ctx.CivilVillage.tick(s);assert.equal(v.town,true);
});
test('medical care spends medicine, restores health, and consumes nothing when unavailable',()=>{
 const h=harness(),s=h.state;s.game.population=20;s.game.buildings.clinic=1;s.game.workers={medic:2};s.stores.medicine=1;
 h.ctx.CivilVillage.settle(s);assert.equal(s.stores.medicine,.8);assert.equal(s.civilization.village.health,80.5);
 s.stores.medicine=.1;h.ctx.CivilVillage.settle(s);assert.equal(s.stores.medicine,.1);assert.ok(s.civilization.village.health<80.5);
});
test('an open event does not exhaust the gap to the next random event while research continues',()=>{
 const h=harness(),s=h.state,c=s.civilization;s.game.buildings.workshop=1;c.policy='equal';c.randomClock=120;
 h.ctx.Civilization.research('water');c.pending='cold';h.ctx.Civilization.showPending();h.step(60);
 assert.equal(c.randomClock,120);assert.equal(c.research.remaining,60);h.choose('hands');h.step(1);assert.equal(c.randomClock,119);
});
test('the early aid-accounting migration credits the recipient exactly once',()=>{
 const h=harness(),s=h.state,v=s.civilization.village;delete v.schema;v.riverAllied=true;
 h.ctx.CivilVillage.init(s);assert.equal(v.riverFood,120);assert.equal(v.riverTools,12);assert.equal(v.aidDelivered,true);
 h.ctx.CivilVillage.init(s);assert.equal(v.riverFood,120);assert.equal(v.riverTools,12);
});
test('live adapter queues four constitutional decisions then the mineral discovery without losing voyages',()=>{
 const h=harness(),s=h.state,c=s.civilization;c.village.town=true;c.policy='equal';s.game.buildings.workshop=1;s.stores={wood:500,food:500,tools:50,knowledge:100,scrap:100};
 for(const [axis,choice]of [['structure','federation'],['selection','election'],['charter','constitution'],['devolution','local']]){h.step(1);assert.equal(c.pending,'constitution_'+axis);h.choose(choice);}
 assert.equal(c.society.governed,true);c.tech.records=true;c.tech.handtools=true;
 h.ctx.Civilization.depart('geology');assert.equal(c.journey.remaining,240);h.step(240);assert.equal(c.pending,'geology');h.choose('survey');assert.equal(c.industry.mineKnown,true);
 h.ctx.Civilization.research('mining');assert.equal(c.research.id,'mining');h.step(240);assert.equal(c.tech.mining,true);
});
test('annual births and resident deaths publish the reconciled population to the native village view',()=>{
 for(const [cohorts,before,after]of [[[{age:30,count:6}],6,7],[[{age:79,count:1},{age:30,count:3}],4,3]]){
  const h=harness(),s=h.state,c=s.civilization,updates=[];c.elapsed=599;c.policy='equal';s.stores.medicine=1;s.game.population=before;c.society.cohorts=cohorts;
  h.ctx.Outside.updateVillage=()=>updates.push({population:s.game.population,total:h.ctx.CivilSociety.total(c.society),assigned:Object.values(s.game.workers).reduce((n,v)=>n+v,0),workforce:h.ctx.CivilSociety.workforce(s)});
  h.step(1);assert.equal(s.game.population,after);assert.equal(updates.length,1);assert.equal(updates[0].population,after);assert.equal(updates[0].total,after);assert.ok(updates[0].assigned<=updates[0].workforce);
 }
});
test('mechanical service expansion restores real medical exports at thirty-six residents',()=>{
 const h=harness(),s=h.state,c=s.civilization,v=c.village;
 s.game.population=36;s.game.workers={medic:2,teacher:2};s.game.buildings={hut:2,longhouse:4,clinic:1,schoolhouse:1,road:1,outpost:1};h.ctx.CivilSociety.sync(s);
 s.stores={wood:2000,food:2000,scrap:2000,tools:100,medicine:0,knowledge:0};c.policy='equal';c.tech.sanitation=true;c.tech.school=true;c.tech.preservation=true;v.riverAllied=true;v.riverFood=240;
 const clinic=h.ctx.CivilVillage.buildings.clinic,school=h.ctx.CivilVillage.buildings.schoolhouse;
 assert.equal(Boolean(clinic.gate()),false);assert.equal(Boolean(school.gate()),false);assert.equal(h.ctx.CivilCatalog.jobCapacity(s,'medic'),2);
 for(let i=0;i<60;i++){h.ctx.CivilRules.settle(s);h.ctx.CivilVillage.settle(s);}assert.equal(v.convoys,0);
 c.tech.mechanics=true;assert.equal(clinic.gate(),true);assert.equal(school.gate(),true);
 assert.ok(clinic.cost().parts>0);assert.ok(school.cost().iron>0);assert.equal(h.ctx.CivilRules.pay(s,clinic.cost()),false);
 s.stores.iron=30;s.stores.parts=12;assert.equal(h.ctx.CivilRules.pay(s,clinic.cost()),true);s.game.buildings.clinic++;
 assert.equal(h.ctx.CivilRules.pay(s,school.cost()),true);s.game.buildings.schoolhouse++;s.game.workers.medic=4;s.game.workers.teacher=4;
 assert.equal(h.ctx.CivilCatalog.jobCapacity(s,'medic'),4);assert.equal(h.ctx.CivilCatalog.jobCapacity(s,'teacher'),4);
 const knowledge=s.stores.knowledge;for(let i=0;i<60;i++){h.ctx.CivilRules.settle(s);h.ctx.CivilVillage.settle(s);}
 assert.equal(v.convoys,10);assert.ok(s.stores.medicine>8);assert.ok(s.stores.knowledge-knowledge>47);assert.equal(s.game.population,36);
});

function poweredHarness(){const h=harness();Object.assign(h.state,JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-first-power.json'),'utf8')).state);h.ctx.Civilization.initState();return h;}
test('one shared settlement accounts for every home delta before and after regional activation',()=>{
 const h=poweredHarness(),s=h.state,c=s.civilization;
 for(const active of [false,true]){
  if(active){c.tech.logistics=true;s.game.buildings.cartdepot=1;s.game.workers.transporter=2;assert.equal(h.ctx.CivilRegions.activate(s),true);}
  c.village.convoyClock=50;const before={...s.stores},flow=h.ctx.Civilization.settleEconomy(s).flow,total={};
  for(const deltas of Object.values(flow))for(const [key,n]of Object.entries(deltas))total[key]=(total[key]||0)+n;
  for(const key of h.ctx.CivilCatalog.resources)assert.ok(Math.abs((s.stores[key]||0)-(before[key]||0)-(total[key]||0))<1e-7,key+' matches actual home inventory');
  assert.equal(c.urban.economy.treatment,true);
 }
 const oldRiver=c.village.riverFood;h.ctx.Civilization.settleEconomy(s);assert.equal(c.village.riverFood,oldRiver,'legacy river cannot produce again after migration');
});
test('urban farm capacity changes actual base production without creating a second production loop',()=>{
 const h=poweredHarness(),s=h.state;s.game.buildings.irrigatedfield=1;s.game.workers.farmer=10;
 assert.equal(h.ctx.CivilCatalog.jobCapacity(s,'farmer'),12);assert.equal(h.ctx.CivilRules.rates(s)['农夫'].food,20);
 s.civilization.outpostSupplied=false;assert.equal(h.ctx.CivilRules.rates(s)['农夫'].food,14);
});
test('the live adapter reaches a second neighbour and queues its population register after the journey',()=>{
 const h=poweredHarness(),s=h.state,c=s.civilization;h.ctx.Civilization.research('survey');assert.equal(c.research.id,'survey');
 h.step(209);assert.equal(c.tech.survey,true);h.ctx.Civilization.depart('railSurvey');assert.equal(c.journey.id,'railSurvey');
 h.step(240);assert.equal(c.pending,'railSurvey');h.choose('meet');assert.equal(c.regions.nodes.rail.population,32);assert.equal(c.regions.active,false,'legacy trade continues until staffed logistics');
 h.step(1);assert.equal(c.pending,'urban_register');h.choose('register');assert.equal(c.urban.registered,true);assert.equal(h.ctx.CivilUrban.count(c.urban.source),480);assert.equal(s.game.population,44,'registration does not grant residents');
});

test('a chartered town pays staffed routine repairs while shortages and early settlements retain a recovery choice',()=>{
 const h=poweredHarness(),s=h.state,c=s.civilization;h.ctx.Math.random=()=>.1;s.stores.wood=100;s.stores.tools=10;
 c.urban.chartered=true;h.ctx.Civilization.randomEvent();assert.equal(h.active,null);assert.equal(s.stores.wood,90);assert.equal(s.stores.tools,9.5);
 s.stores.wood=0;h.ctx.Civilization.randomEvent();assert.equal(c.pending,'cold');assert.equal(s.stores.tools,9.5);h.choose('hands');
 s.stores.wood=100;c.urban.chartered=false;h.ctx.Civilization.randomEvent();assert.equal(c.pending,'cold');assert.equal(s.stores.wood,100);
});
