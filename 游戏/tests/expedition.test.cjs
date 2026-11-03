const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
// Pure-rule harness: no DOM. State changes only through CivilExpedition actions and the shared tick.
function harness(over={}){
 const state={stores:{wood:200,food:80,scrap:60},game:{fire:{value:3},temperature:{value:3},builder:{level:4},population:6,workers:{hunter:1},buildings:{hut:2,lodge:1,granary:1,workshop:1,cart:1}},timers:{},cooldown:{},...over};
 let active=null;const notes=[];
 const parts=s=>s.split(/[.\[\]"']+/).filter(Boolean);
 const SM={get(p,z){let v=state;for(const k of parts(p))v=v?.[k];return v===undefined&&z?0:v;},set(p,v){const ks=parts(p);let o=state;for(const k of ks.slice(0,-1))o=o[k]??={};o[ks.at(-1)]=v;},add(p,v){this.set(p,this.get(p,true)+v);},addM(p,o){for(const [k,v]of Object.entries(o))this.add(p+'.'+k,v);},fireUpdate(){}};
 const ctx=vm.createContext({State:state,Room:{build(){},updateBuildButtons(){},updateIncomeView(){},buttons:{}},Outside:{getMaxPopulation:()=>8,setTitle(){},updateVillage(){},updateWorkersView(){},killVillagers(n){state.game.population-=n;}},
  Events:{startEvent(e){active=e;},activeEvent:()=>active,buttonClick(){}},$SM:SM,AudioEngine:{},Notifications:{},CivilClock:{rate:1},Engine:{saveGame(){}},Math:Object.assign(Object.create(Math),{random:()=>.42}),_:s=>s,setTimeout,clearTimeout,console});
 for(const f of ['src/postwar/rules.js','content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','content/expedition.js','src/postwar/population.js','src/postwar/society.js','src/postwar/industry.js','src/postwar/village.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/expedition.js','src/postwar/adapter.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f});
 vm.runInContext('Outside.getNumGatherers=()=>(typeof CivilSociety!=="undefined"&&State.civilization.society?CivilSociety.workforce(State):Math.max(0,State.game.population-CivilExpedition.unavailable(State)))-Object.values(State.game.workers).reduce((a,b)=>a+b,0)',ctx);
 ctx.Outside.updateWorkersView=()=>{};ctx.Civilization.initState();ctx.Civilization.notify=t=>notes.push(t);ctx.Civilization.refresh=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Civilization.updateIncome=()=>{};
 const c=state.civilization;c.policy='equal';c.policySeen={equal:true};c.residentTime=0;c.randomClock=99999;
 const E=ctx.CivilExpedition;
 return {ctx,state,c,E,notes,step(n){for(let i=0;i<n;i++)ctx.Civilization.tick();},get active(){return active;},clear(){active=null;}};
}
const walk=(h,moves)=>{const out=[];for(const m of moves){const d={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]}[m[0]];for(let i=0;i<Number(m.slice(1));i++){const r=h.E.move(h.state,...d);out.push(r);if(!['moved','cache','short'].includes(r))return out;}}return out;};
const total=(h,k)=>(h.state.stores[k]||0)+(h.E.data(h.state)?.party?.pack[k]||0);

test('pause blocks departure, walking and automatic return without consuming supplies',()=>{
 const h=harness(),{state,E,ctx}=h;E.prep={members:1,food:4,water:6,kit:false};
 ctx.CivilClock.paused=true;assert.equal(E.depart(state),false);ctx.CivilClock.paused=false;
 assert.equal(E.depart(state),true);assert.equal(E.move(state,1,0),'moved');
 const before=JSON.stringify(state);ctx.CivilClock.paused=true;
 assert.equal(E.move(state,1,0),false);assert.equal(E.walkHome(state),false);assert.equal(JSON.stringify(state),before);
 ctx.CivilClock.paused=false;assert.equal(E.walkHome(state),'home');
});

test('a party takes real residents and paid supplies out once and returns its load once',()=>{
 const h=harness(),{state,c,E}=h;
 assert.equal(E.data(state),null,'opening the view of an old save writes nothing');
 const free=h.ctx.Outside.getNumGatherers(),food=state.stores.food,wood=state.stores.wood;
 E.prep={members:2,food:6,water:8,kit:false};
 assert.equal(E.depart(state,E.prep),true);
 assert.equal(state.stores.food,food-6);assert.equal(Math.round((wood-state.stores.wood)*100)/100,4,'boiling 8 water costs 0.5 wood each without a cistern');
 assert.equal(h.ctx.Outside.getNumGatherers(),free-2,'party members are not home gatherers');
 assert.equal(E.depart(state,E.prep),false,'cannot depart twice');assert.equal(state.stores.food,food-6);
 // Party eats from the pack; home rations count only residents at home.
 assert.equal(h.ctx.CivilSociety.foodPopulation(state)+2,state.game.population);
 const r=walk(h,['E4','W4']);assert.equal(r.at(-1),'home');
 assert.equal(E.data(state).party,null);assert.equal(h.ctx.Outside.getNumGatherers(),free);
 assert.ok(Math.abs(state.stores.food-(food-6+6-8*2*.1))<1e-6,'unused rations return; 8 steps x 2 people eaten');
 h.ctx.CivilPlatform?.validate?.(state);E.validate(state);
});

test('the transit station reward is granted once, survives reload, and the backpack limit leaves the rest on site',()=>{
 const h=harness(),{state,c,E}=h;
 E.prep={members:1,food:4,water:6,kit:false};assert.ok(E.depart(state,E.prep));
 assert.deepEqual(walk(h,['E5']).at(-1),'moved');
 // follow the old road: E to x=17 then N to y=4 then E to x=23
 let r=walk(h,['N8','E6']);assert.equal(r.at(-1),'site');
 const info=E.choices(state);assert.equal(info.site,'station');
 const msg=E.choose(state,'recover');assert.match(msg,/废料/);assert.equal(c.station,true);
 const carried=E.data(state).party.pack.scrap,left=E.data(state).sites.station.stock;
 assert.ok(carried>0&&carried<24,'12+6 capacity minus pack limits the first haul');assert.equal(Math.round((carried+left)*100)/100,64);
 assert.equal(E.choose(state,'recover'),false,'recover is not offered twice');
 const saved=JSON.parse(JSON.stringify(state));E.validate(saved);
 assert.equal(E.choices(saved)?.options.some(o=>o.id==='recover'),false,'reload keeps the site state');
});

test('the pump needs real repair parts carried from home and the old timed path stays closed',()=>{
 const h=harness(),{state,c,E}=h;c.station=true;c.tech.water=true;
 h.ctx.Civilization.depart('pump');assert.equal(c.journey,null,'timed pump trip is replaced by the map');
 E.prep={members:2,food:10,water:14,kit:true};const scrap=state.stores.scrap;assert.ok(E.depart(state,E.prep));assert.equal(state.stores.scrap,scrap-10);
 // Short route: west along row 12, down through beetle hollow (6..10, 13..17 has % but row13 '^' blocks except x=9,10)
 const path=E.route(state,[12,12],[4,19]);assert.equal(path,null,'unknown tiles have no route yet');
 let r=walk(h,['W3','S1']);assert.equal(r.at(-1),'encounter','the hollow stops the party');
 assert.equal(E.move(state,0,1),false,'cannot walk on while deciding');
 assert.ok(E.choose(state,'observe'));assert.equal(E.data(state).beetles,'observed');
 r=walk(h,['S4','W4','S2','W1']);
 assert.equal(r.at(-1),'site');assert.equal(E.choices(state).site,'pump');
 assert.ok(E.choose(state,'repair'));assert.equal(c.pump,true);assert.equal(E.data(state).party.pack.scrap||0,0);
 assert.ok(E.choose(state,'refill'));
});

test('running out of supplies ends in a paid rescue, loses the pack and rests the party; nobody is deleted',()=>{
 const h=harness(),{state,c,E}=h;
 E.prep={members:1,food:1,water:1.5,kit:false};assert.ok(E.depart(state,E.prep));
 const pop=state.game.population,wood=state.stores.wood;
 let r=walk(h,['E5','N5','E3']);assert.equal(r.at(-1),'collapse');
 assert.equal(E.data(state).party,null);assert.equal(state.game.population,pop);
 assert.equal(E.data(state).resting.count,1);assert.equal(Math.round(wood-state.stores.wood),10);
 assert.equal(h.ctx.Outside.getNumGatherers()<pop,true);
 h.step(180);assert.equal(E.data(state).resting,null,'rested residents return to work');
 assert.match(E.data(state).records.at(-1).title,/救援/);
});

test('archives or metal: the weather station choice is exclusive and archives only count once they reach home',()=>{
 const h=harness(),{state,E}=h;
 E.prep={members:2,food:12,water:16,kit:false};assert.ok(E.depart(state,E.prep));
 let r=walk(h,['N1','W7','N6']);
 assert.equal(r.at(-1),'site');assert.equal(E.choices(state).site,'ruin');
 assert.ok(E.choose(state,'preserve'));assert.equal(E.data(state).sites.ruin.state,'carried');
 assert.equal(E.choices(state).options.some(o=>o.id==='dismantle'),false);
 E.validate(state);
 r=E.walkHome(state);assert.equal(r,'home');assert.equal(E.data(state).sites.ruin.state,'preserved');
 assert.equal(state.stores.archive,undefined,'archives are not a store resource');
});

test('invited survivors move in only when beds and food really exist',()=>{
 const h=harness(),{state,E}=h;state.game.population=8;
 E.prep={members:1,food:6,water:9,kit:false};assert.ok(E.depart(state,E.prep));
 let r=walk(h,['S6','E1']);assert.equal(r.at(-1),'site');
 assert.ok(E.choose(state,'share'));assert.ok(E.choose(state,'invite'));
 E.walkHome(state);
 h.step(5);assert.equal(state.game.population,8,'no free beds, nobody appears');
 state.game.buildings.hut=3;h.ctx.Outside.getMaxPopulation=()=>12;
 h.step(1);assert.equal(state.game.population,11);assert.equal(E.data(state).sites.cellar.state,'joined');
 h.step(5);assert.equal(state.game.population,11,'joining happens once');
});

test('legacy saves with a finished station are mapped as known places without re-granting rewards',()=>{
 const h=harness(),{state,c,E}=h;c.station=true;c.pump=true;
 const v=E.view(state);assert.equal(v.sites.station.state,'recovered');assert.equal(v.sites.pump.state,'repaired');
 assert.ok(E.isKnown(v,23,4)&&E.isKnown(v,4,19));assert.equal(E.data(state),null);
 E.prep={members:1,food:4,water:6,kit:false};E.depart(state,E.prep);
 assert.equal(E.data(state).sites.station.state,'recovered');assert.ok(E.route(state,[12,12],[23,4]));
});

test('a preserved archive opens cold-warning research; dismantling gives metal but no research',()=>{
 const a=harness();a.state.game.buildings.workshop=1;
 assert.equal(a.ctx.CivilCatalog.researchAvailable(a.state,'weather'),false);
 a.E.prep={members:2,food:12,water:16,kit:false};a.E.depart(a.state,a.E.prep);walk(a,['N1','W7','N6']);a.E.choose(a.state,'preserve');a.E.walkHome(a.state);
 assert.equal(a.ctx.CivilCatalog.researchAvailable(a.state,'weather'),true);
 a.ctx.Civilization.research('weather');a.step(150);assert.equal(a.c.tech.weather,true);
 const wood=a.state.stores.wood;a.c.randomClock=0;a.state.game.population=6;a.step(1);
 assert.notEqual(a.c.pending,'cold','warned settlements are not interrupted by the cold-wind event');
 const b=harness();b.E.prep={members:2,food:12,water:16,kit:false};b.E.depart(b.state,b.E.prep);walk(b,['N1','W7','N6']);
 const before=b.E.data(b.state).party.pack.scrap||0;b.E.choose(b.state,'dismantle');assert.ok((b.E.data(b.state).party.pack.scrap||0)>before);
 b.E.walkHome(b.state);assert.equal(b.ctx.CivilCatalog.researchAvailable(b.state,'weather'),false);
});

test('the next-step guide reads real conditions and names the town-charter blocker',()=>{
 const h=harness(),{state,c}=h;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src/postwar/guide.js'),'utf8'),h.ctx);
 c.settled=true;state.game.buildings.workshop=0;assert.match(h.ctx.CivilGuide.text(state),/工坊/);
 state.game.buildings.workshop=1;assert.match(h.ctx.CivilGuide.text(state),/交通站/);
 c.station=true;c.pump=true;Object.assign(state.game.buildings,{outpost:1,road:1,clinic:1,schoolhouse:1});c.village.riverKnown=true;c.village.riverAllied=true;
 state.game.population=30;c.village.health=90;c.village.convoys=5;c.village.routeStatus='待发：工具 1、药品 0.5、木料 1、食物 1';state.stores.tools=20;
 assert.match(h.ctx.CivilGuide.text(state),/车队：待发/);
 const before=JSON.stringify(state);h.ctx.CivilGuide.text(state);assert.equal(JSON.stringify(state),before,'guide is read-only');
});
