const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
// Rule harness on the real adapter and content; DOM is stubbed. State changes only via game functions.
function harness(fixture){
 const state=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','验证','存档',fixture),'utf8')).state;let active=null;const notes=[];
 const parts=s=>s.split(/[.\[\]"']+/).filter(Boolean);
 const SM={get(p,z){let v=state;for(const k of parts(p))v=v?.[k];return v===undefined&&z?0:v;},set(p,v){const ks=parts(p);let o=state;for(const k of ks.slice(0,-1))o=o[k]??={};o[ks.at(-1)]=v;},add(p,v){this.set(p,this.get(p,true)+v);},addM(p,o){for(const [k,v]of Object.entries(o))this.add(p+'.'+k,v);},fireUpdate(){}};
 const ctx=vm.createContext({State:state,Room:{build(){},updateBuildButtons(){},updateIncomeView(){},buttons:{}},Outside:{getMaxPopulation:()=>0,setTitle(){},updateVillage(){},updateWorkersView(){},killVillagers(n){state.game.population-=n;}},
  Events:{startEvent(e){active=e;},activeEvent:()=>active,buttonClick(){}},$SM:SM,AudioEngine:{},Notifications:{printMessage(){}},CivilClock:{rate:1},Engine:{saveGame(){}},Math:Object.assign(Object.create(Math),{random:()=>.42}),_:s=>s,setTimeout:fn=>{fn();return 0;},clearTimeout(){},TextEncoder,TextDecoder,console});
 const files=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
 for(const f of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f});
 ctx.Outside.updateWorkersView=()=>{};ctx.Civilization.initState();ctx.Civilization.notify=t=>notes.push(t);ctx.Civilization.refresh=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Civilization.updateIncome=()=>{};
 return {ctx,state,c:state.civilization,K:ctx.CivilCourse,notes,step(n){for(let i=0;i<n;i++)ctx.Civilization.tick();},get active(){return active;},choose(key){const b=active.scenes.start.buttons[key];assert.ok(b,'choice '+key);b.onChoose();active=null;}};
}
const town='自然游玩_河谷小镇.json';

test('old saves are never asked to choose a course and keep the original tech table',()=>{
 const h=harness(town);assert.equal(h.c.courseRule,undefined);assert.equal(h.K.needsChoice(h.state),false);
 assert.deepEqual([...h.K.requires(h.state,'standards')],['school','mechanics']);
 const before=JSON.stringify(h.state.civilization.tech);h.ctx.CivilPlatform.validate(h.state);assert.equal(JSON.stringify(h.state.civilization.tech),before);
});

test('a town under the new rule is asked once; the commons route reaches city research without mining or power',()=>{
 const h=harness(town),{state,c,K}=h;c.courseRule=1;
 assert.equal(K.nextEvent(state),'course_choice');c.pending='course_choice';h.ctx.Civilization.showPending();
 assert.equal(h.active.title,'小镇往哪里去');h.choose('course_commons');assert.equal(c.course.id,'commons');assert.equal(K.needsChoice(state),false);
 const need=new Set(),walk=k=>{if(need.has(k))return;need.add(k);for(const r of K.requires(state,k))walk(r);};walk('urbanworks');
 for(const t of ['mining','furnace','mechanics','power'])assert.equal(need.has(t),false,t+' is not on the commons path');
 assert.equal(K.researchCost(state,'standards').iron,undefined);assert.equal(h.ctx.Room.Craftables.publicclinic.cost().iron,undefined,'commons public clinic uses no iron');
 h.ctx.CivilPlatform.validate(state);
});

test('the industry route keeps the original iron/parts costs and the mine chain',()=>{
 const h=harness(town),{state,c,K}=h;c.courseRule=1;K.choose(state,'industry');
 assert.deepEqual([...K.requires(state,'standards')],['school','mechanics']);assert.ok(h.ctx.Room.Craftables.publicclinic.cost().iron>0);
 assert.equal(h.ctx.Room.Craftables.commonhouse.button,null);
 assert.equal(Boolean(h.ctx.CivilUrban.buildings.commonhouse.gate()),false,'commons housing is not offered to industry');
});

test('course bonuses act on the real settlement rates',()=>{
 const a=harness(town),b=harness(town);a.c.courseRule=b.c.courseRule=1;a.K.choose(a.state,'commons');b.K.choose(b.state,'industry');
 const fa=a.ctx.CivilRules.rates(a.state),fb=b.ctx.CivilRules.rates(b.state);
 const base=harness(town),f0=base.ctx.CivilRules.rates(base.state);
 assert.ok(Math.abs(fa['农夫'].food-f0['农夫'].food*1.15)<1e-9);assert.ok(Math.abs(fb['回收工'].scrap-f0['回收工'].scrap*1.25)<1e-9);
});

test('commons city conditions are explicit and require real fields, care and food surplus',()=>{
 const h=harness('自然游玩_正式镇制与河谷加盟.json'),{state,c,K}=h;c.courseRule=1;c.course={schema:1,id:'commons',chosenAt:0,generation:1,issue:null,craftsman:null};
 const rows=K.cityChecks(state);assert.ok(rows.length>=8);assert.equal(rows.find(r=>r[0].startsWith('居民'))[1],false);
 assert.equal(h.ctx.CivilUrban.developmentReady(state,true),false);
 h.ctx.CivilPlatform.validate(state);
});

test('the social issue fires on real conditions, moves real workers once and is recorded',()=>{
 const h=harness('自然游玩_正式镇制与河谷加盟.json'),{state,c,K}=h;c.courseRule=1;c.course={schema:1,id:'industry',chosenAt:0,generation:1,issue:null,craftsman:null};
 c.industry.pollution=25;assert.equal(K.issueReady(state),true);
 const smelters=state.game.workers.smelter;assert.equal(K.resolveIssue(state,'shift'),true);assert.equal(state.game.workers.smelter,smelters-2);
 assert.equal(K.resolveIssue(state,'shift'),false,'decided once');assert.equal(K.issueReady(state),false);h.ctx.CivilPlatform.validate(state);
});

test('the tool-bench cooperative keeps its own ledger; tools are neither created nor lost',()=>{
 const h=harness(town),{state,c,K}=h;c.courseRule=1;K.choose(state,'commons');
 assert.equal(K.coopReady(state),true);assert.equal(K.arrange(state,'coop'),true);assert.equal(K.arrange(state,'public'),false);
 state.stores.tools=10;const food0=state.stores.food;
 const flow={'制器工':{tools:1}};state.stores.tools+=1;const out=K.settleCoop(state,flow);
 const k=c.course.coop;assert.ok(Math.abs(k.kept-.25)<1e-9);
 assert.ok(Math.abs(state.stores.tools+k.stock-11)<1e-9,'public + cooperative tools equal what was made');
 assert.ok(Math.abs(food0-state.stores.food-k.paidFood)<1e-9,'buy-back paid in real food');
 h.ctx.CivilPlatform.validate(state);
});

test('the founding craftsman retires once; the apprentice needs a working smith',()=>{
 const h=harness('自然游玩_正式镇制与河谷加盟.json'),{state,c,K}=h;c.courseRule=1;c.course={schema:1,id:'commons',chosenAt:0,generation:1,issue:null,craftsman:null};
 assert.equal(K.craftsmanReady(state),true);assert.equal(K.retireCraftsman(state,'apprentice'),true);assert.equal(K.craftsmanReady(state),false);
 assert.equal(K.craftsmanWood(state),(state.game.workers.smith||0)>0?2:0);state.game.workers.smith=0;assert.equal(K.craftsmanWood(state),0);
 assert.equal(K.craftsmanTitle(state),'工坊学徒');h.ctx.CivilPlatform.validate(state);
});

test('survivors who joined from the cellar shorten the commons survey research',()=>{
 const h=harness(town),{state,c,K}=h;c.courseRule=1;K.choose(state,'commons');
 const full=K.researchCost(state,'survey').knowledge;c.expedition={sites:{cellar:{state:'joined'}}};
 assert.equal(K.researchCost(state,'survey').knowledge,full-15);
});
