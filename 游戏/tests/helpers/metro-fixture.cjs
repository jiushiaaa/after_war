const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..'),clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,label='quantity')=>assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);

function census(population){
  const cohorts=[];for(let age=0;age<80;age++){const count=Math.floor((age+1)*population/80)-Math.floor(age*population/80);if(count)cohorts.push({age,count,identity:age%4===0?'mutant':'human'});}return cohorts;
}

function harness(saved){
  const s=clone(saved||JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/natural-first-city.json'),'utf8')).state),messages=[],events=[],settlements=[];let active=null,ctx;
  const get=key=>key.split('.').reduce((v,k)=>v?.[k],s),set=(key,value)=>{const keys=key.split('.'),last=keys.pop();let node=s;for(const k of keys)node=node[k]||(node[k]={});node[last]=value;};
  const native={activeEvent:()=>active,activeScene:'start',loadScene(){},startEvent(e){active=e;events.push({at:s.civilization.elapsed,pending:s.civilization.pending,title:e.title});},endEvent(){active=null;},buttonClick(button){const b=active?.scenes.start.buttons[button.attr('id')];if(!b)return;if(b.cost&&!ctx.CivilRules.pay(s,b.cost))return;if(b.onChoose)b.onChoose();if(b.nextScene==='end')native.endEvent();}};
  ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout:fn=>{fn();return 0;},clearTimeout(){},Math:Object.assign(Object.create(Math),{random:()=>.9}),
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){},killVillagers(n){s.game.population-=n;}},Events:native,
    $SM:{get:(key,zero)=>get(key)??(zero?0:undefined),set,add:(key,n)=>set(key,(get(key)||0)+n),fireUpdate(){}},AudioEngine:{},Engine:{saveGame(){}},Notifications:{notify:(_who,text)=>messages.push(text),printMessage:text=>messages.push(text)}});
  const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Outside.updateWorkersView=()=>{};ctx.Civilization.initState();
  if(ctx.CivilMetro)ctx.CivilMetro.init(s);
  const settle=ctx.Civilization.settleEconomy.bind(ctx.Civilization);
  ctx.Civilization.settleEconomy=state=>{const result=settle(state);if(state===s)settlements.push({at:s.civilization.elapsed,flow:clone(result.flow),home:clone(s.civilization.urban.economy),nodes:Object.fromEntries(Object.entries(s.civilization.municipal.nodes).map(([id,m])=>[id,clone(m.economy)]))});return result;};
  const h={s,ctx,r:ctx.CivilRegions,m:ctx.CivilMunicipal,u:ctx.CivilUrban,v:ctx.CivilServices,f:ctx.CivilFinance,metro:ctx.CivilMetro,messages,events,settlements,get active(){return active;},
    click(key){assert.ok(active?.scenes.start.buttons[key],`native event button ${key}`);ctx.Events.buttonClick({attr:()=>key});},
    chooseRoutine(){if(!active)return;const pending=s.civilization.pending,buttons=active.scenes.start.buttons;if(pending==='metroCharter'||pending==='metroStatus')return;
      if(pending==='succession'){this.click(Object.hasOwn(buttons,'engineer')?'engineer':Object.keys(buttons)[0]);return;}
      if(pending==='generation_head'){this.click('keep');return;}
      if(pending==='story_stage'){this.click('continue');return;}
      if(pending==='modern_era'){this.click('continue');return;}
      if(pending==='civic_issue'){this.click('later');return;}
      if(pending==='civic_pressure'){this.click('read');return;}
      if(pending==='cold'){this.click('wood');return;}
      // The test operator pays each real warning through its native choice;
      // no random incidents, costs or automatic-maintenance decisions are skipped.
      if(pending==='roadIncident'){
        const record=ctx.CivilIncidents.active(s),before={wood:s.stores.wood,tools:s.stores.tools};
        assert.ok(ctx.CivilRules.canPay(s,ctx.CivilIncidents.cost),'fixture cannot afford the real road repair');
        this.click('repair');assert.equal(record.phase,'resolved');
        near(s.stores.wood,before.wood-20,'paid road wood');near(s.stores.tools,before.tools-4,'paid road tools');return;
      }
      if(pending==='financeOffer'){this.click('later');return;}
      if(pending==='roadDefense'){this.click('detour');return;}
      if(pending?.startsWith('municipalTown_')||pending?.startsWith('municipalCity_')){this.click('record');return;}
      throw Error('unexpected fixture event '+pending);
    },
    step(seconds,{choose=true,checkEvery=60}={}){for(let i=0;i<seconds;i++){ctx.Civilization.tick();if(choose)this.chooseRoutine();if(checkEvery&&s.civilization.elapsed%checkEvery===0)ctx.CivilPlatform.validate(s);}},
    until(predicate,limit=2400){for(let i=0;i<limit&&!predicate();i++)this.step(1);assert.ok(predicate(),`fixture condition not reached in ${limit}s: ${this.metro?JSON.stringify(this.metro.check(s)):'no Metro'}`);},
    approve(){assert.equal(active,null);s.civilization.pending='financeOffer';ctx.Civilization.showPending();const key=Object.keys(active.scenes.start.buttons).find(k=>k==='agree_river_rail'||k==='agree_rail_river');assert.ok(key);this.click(key);assert.ok(this.f.agreement(s));return this;},
    ledger(action){assert.equal(active,null);s.civilization.pending='financeLedger';ctx.Civilization.showPending();this.click(action);},
    roundtrip(){ctx.CivilPlatform.validate(s);const decoded=ctx.CivilPlatform.decode(JSON.stringify({format:'postwar-civilization',version:1,state:s}));assert.deepEqual(clone(decoded),clone(s));const loaded=harness(decoded);assert.deepEqual(clone(loaded.s),clone(s));return loaded;}
  };return h;
}

// Declared synthetic prebuilt foundation, NOT a natural save or a construction
// playthrough. Exactly 3,000 residents, their age distribution, existing assets,
// technologies and finite initial inventories are test inputs. Completion rows
// describe those prebuilt assets. No current production, water, electrical load,
// route delivery, city qualification or Finance fulfillment is supplied here.
// Those facts are earned by the shipped adapter and physical transport below.
function synthetic(){
  const h=harness(),{s,ctx,r,m,u,v}=h,c=s.civilization,at=c.elapsed,year=Math.floor(at/600);
  c.pending=null;c.research=null;c.journey=null;c.productionClock=0;c.populationClock=0;c.randomClock=240;c.hunger=0;c.policy='equal';c.trust=100;c.outpostSupplied=true;
  for(const id of Object.keys(ctx.CivilText.research))if(id!=='passenger_transport')c.tech[id]=true;
  delete c.tech.passenger_transport;
  for(const key of ctx.CivilCatalog.resources)s.stores[key]=10000;
  for(const id of Object.keys(ctx.CivilCatalog.limits))s.game.buildings[id]=ctx.CivilCatalog.buildingLimit(s,id);
  s.game.builder.level=4;s.game.temperature.value=4;
  s.game.population=1000;c.society.cohorts=census(1000);c.society.year=year;c.society.births={scaled:true,credit:0,mutantCredit:0};c.society.transition=0;c.society.succession=null;
  c.society.axes={structure:'federation',selection:'election',charter:'constitution',devolution:'local'};c.society.governed=true;
  c.village.health=100;c.village.town=true;c.village.riverKnown=true;c.village.riverAllied=true;c.village.convoys=0;
  for(const key of ['regions','municipal','urban','services','origins','passenger','finance','metro'])delete c[key];
  r.init(s);m.init(s);u.init(s);v.init(s);c.regions.active=true;c.regions.rights='equal';c.regions.rightsSince=at;c.regions.announced=true;
  c.urban.chartered=true;c.urban.city=true;
  for(const id of ['river','rail']){
    const n=r.createNode(s,id);n.completedProjects.publicWorks=true;n.relation='associated';n.control='shared';n.rights='equal';n.rightsSince=at;n.health=100;r.planWorkers(s,id,n);
    assert.equal(m.activate(s,id),true);const local=m.data(s,id);local.town=true;local.city=false;
    local.buildings=Object.fromEntries(Object.entries(ctx.CivilMunicipalContent.facilities).map(([key,d])=>[key,d.max]));
    local.completed=[];for(const [type,count]of Object.entries(local.buildings))for(let i=0;i<count;i++)local.completed.push({id:local.completed.length+1,type,completedAt:at});
    local.nextProject=local.completed.length+1;const last=local.completed.at(-1),cost=ctx.CivilMunicipalContent.facilities[last.type].cost;
    local.project={id:last.id,type:last.type,status:'complete',required:{...cost},buffer:{},receipts:[],remaining:0};
    n.cohorts=census(1000);n.population=1000;n.year=year;n.births={scaled:true,credit:0,mutantCredit:0};
    for(const key of ctx.CivilCatalog.resources)n.stores[key]=10000;
    Object.assign(c.regions.routes[id],{enabled:true,assigned:2,completedTrips:0,lastDeliveredAt:null,dispatchIn:10});
  }
  for(const id of ['home','river','rail']){
    const buildings={pharmacy:4,waterworks:3,waterfield:10,irrigationworks:1,districtschool:2,densehousing:6},completed=[];
    for(const [type,count]of Object.entries(buildings))for(let i=0;i<count;i++)completed.push({id:completed.length+1,type,completedAt:at});
    c.services.nodes[id]={buildings,completed,nextProject:completed.length+1,project:null,manualWater:false,economy:null,water:null,irrigation:null};
  }
  s.game.workers={farmer:90,medic:36,pharmacist:24,teacher:20,smith:12,salvager:30,miner:12,collier:35,smelter:8,machinist:4,electrician:2,utilityworker:10,mineralworker:12,chemist:18,steelworker:2,glassworker:2,waterworker:12,transporter:6,servicebuilder:0};
  for(const id of ['river','rail'])m.planWorkers(s,id);
  c.industry.pollution=0;c.industry.generation=0;c.industry.used=0;c.industry.demand=0;c.industry.productionPower=0;c.industry.online=false;
  c.urban.economy=null;assert.equal(u.register(s),true);c.urban.enabled=false;
  ctx.CivilOrigins.init(s);ctx.CivilPassenger.init(s);ctx.CivilFinance.init(s);if(ctx.CivilMetro)ctx.CivilMetro.init(s);
  h.declared={population:3000,home:1000,river:1000,rail:1000,inventoryPerResource:10000,assets:'synthetic prebuilt',at};
  return h;
}

let preparedSnapshot;
function prepared(){
  if(preparedSnapshot)return harness(preparedSnapshot);
  const h=synthetic();h.until(()=>h.s.civilization.municipal.nodes.river.city&&h.s.civilization.municipal.nodes.rail.city,1800);
  assert.ok(h.u.developmentReady(h.s,true));assert.ok(h.m.developmentReady(h.s,'river',true));assert.ok(h.m.developmentReady(h.s,'rail',true));
  h.approve();h.ctx.CivilPlatform.validate(h.s);preparedSnapshot=clone(h.s);return h;
}

let readySnapshot;
function ready(){
  if(readySnapshot)return harness(readySnapshot);
  const h=prepared();assert.ok(h.metro,'Metro module is loaded');h.until(()=>h.metro.check(h.s).ok,1800);readySnapshot=clone(h.s);return h;
}

module.exports={harness,synthetic,prepared,ready,census,clone,near};
