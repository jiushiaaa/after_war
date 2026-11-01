const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

// A browser-exported town save supplies the actual residents, facilities, inputs
// and service certificates. Only native UI objects are inert in this harness.
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-two-towns.json'),'utf8')).state;
  const ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){}},Events:{activeEvent:()=>null},
    $SM:{fireUpdate(){}},AudioEngine:{},Engine:{saveGame(){}},Notifications:{notify(){},printMessage(){}}});
  const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
  for(const file of ['content/finance.js','src/postwar/finance.js'])if(!files.includes(file))files.push(file);
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};ctx.Civilization.initState();ctx.CivilFinance.init(s);
  return {s,ctx,u:ctx.CivilUrban,m:ctx.CivilMunicipal,r:ctx.CivilRegions};
}
function settle(h){h.s.civilization.elapsed=h.ctx.CivilServices.nextSettlementAt(h.s,'home');h.s.civilization.productionClock=0;return h.ctx.Civilization.settleEconomy(h.s);}

test('home paid maintenance and treatment survive simultaneous positive tool and medicine production',()=>{
  const h=harness(),{s,u,ctx}=h,before={...s.stores},population=s.game.population;
  const {flow}=settle(h),e=s.civilization.urban.economy;
  assert.ok(s.stores.tools>before.tools,'the natural smiths really cover maintenance');
  assert.ok(s.stores.medicine>before.medicine,'the natural medical chain really covers treatment');
  assert.ok(e.paidInputs.resources.tools>0);
  near(before.tools+(flow['制器工']?.tools||0)-s.stores.tools,e.paidInputs.resources.tools);
  near(e.treatmentInputs.resources.medicine,population*.01);
  near(before.medicine+(flow['医护']?.medicine||0)+(flow['药剂师']?.medicine||0)-s.stores.medicine,e.treatmentInputs.resources.medicine);
  assert.equal(e.paidInputs.resources.medicine,undefined,'treatment is a separate paid category');
  assert.equal(e.paidInputs.resources.knowledge,undefined,'administration is not production maintenance');
  assert.equal(e.paidInputs.at,e.at);assert.equal(e.treatmentInputs.at,e.at);
  assert.doesNotThrow(()=>u.validate(s));assert.doesNotThrow(()=>ctx.CivilMunicipal.validate(s));
});

test('local paid inputs record gross actual costs while food, tool and medicine production continue',()=>{
  const h=harness(),{s,m,ctx}=h,id='river',n=m.node(s,id),before={...n.stores},home=JSON.stringify(s.stores);
  s.civilization.elapsed=ctx.CivilServices.nextSettlementAt(s,id);m.settleNode(s,id);
  const e=m.data(s,id).economy;
  assert.ok(e.deltas.tools>0);assert.ok(e.paidInputs.resources.tools>0);
  near(before.tools+(n.workers.smith||0)*.25-n.stores.tools,e.paidInputs.resources.tools);
  near(e.treatmentInputs.resources.medicine,n.population*.01);
  near(e.mealInputs.resources.food,ctx.CivilPopulation.foodPopulation(n.cohorts)*.12);
  near(before.medicine+(n.workers.medic||0)*.15-n.stores.medicine,e.treatmentInputs.resources.medicine);
  assert.equal(e.paidInputs.resources.medicine,undefined);assert.equal(JSON.stringify(s.stores),home);
  assert.doesNotThrow(()=>m.validate(s));
});

test('unpaid production and missing meals cannot become paid input evidence',()=>{
  const h=harness(),{s,u,m,ctx}=h;
  s.game.workers={};for(const key of ctx.CivilCatalog.resources)s.stores[key]=0;
  const {flow}=settle(h),e=s.civilization.urban.economy;
  assert.ok(flow['口粮'].food<0);assert.equal(e.treatmentInputs.resources.medicine,0);
  assert.equal(e.paidInputs.resources.food||0,0);assert.equal(e.paidInputs.resources.tools||0,0);
  assert.equal(e.treatment,false);assert.equal(e.industrial,false);
  // Declared shortage case: the same residents are all retired, so no automatic
  // worker planner can silently replenish this quarter-unit meal before payment.
  const n=m.node(s,'river');for(const c of n.cohorts)c.age=75;
  for(const key of ctx.CivilCatalog.resources)n.stores[key]=0;n.stores.food=.25;
  m.settleNode(s,'river');const local=m.data(s,'river').economy;
  near(local.mealInputs.resources.food,.25);assert.equal(n.stores.food,0);
  assert.equal(local.treatmentInputs.resources.medicine,0);assert.equal(local.treatment,false);
  assert.ok(Object.values(local.paidInputs.resources).every(n=>n===0));
  assert.doesNotThrow(()=>u.validate(s));assert.doesNotThrow(()=>m.validate(s));
});

test('fresh forecasts use the next actual production boundary and never change live inputs, water or ledgers',()=>{
  const h=harness(),{s,u,m,ctx}=h;
  s.civilization.elapsed+=3;s.civilization.productionClock=3;
  const before=JSON.stringify(s),next=ctx.CivilServices.nextSettlementAt(s,'home'),home=u.forecast(s),local=m.forecast(s,'river');
  assert.equal(home.paidInputs.at,next);assert.equal(home.treatmentInputs.at,next);
  assert.equal(home.copy.civilization.services.nodes.home.irrigation.at,next);
  assert.equal(home.copy.civilization.services.nodes.home.irrigation.waterCapacity,1200);
  assert.equal(local.paidInputs.at,next);assert.equal(local.mealInputs.at,next);
  assert.ok(home.paidInputs.resources.tools>0);assert.ok(local.paidInputs.resources.tools>0);
  assert.equal(JSON.stringify(s),before);
});

test('old evidence may be absent but explicit paid evidence must match the settlement and resource kind',()=>{
  const h=harness(),{s,u,m}=h,before=JSON.stringify([s.civilization.urban.economy,s.civilization.municipal.nodes]);
  assert.equal(s.civilization.urban.economy.paidInputs,undefined);
  assert.doesNotThrow(()=>u.validate(s));assert.doesNotThrow(()=>m.validate(s));u.init(s);m.init(s);
  assert.equal(JSON.stringify([s.civilization.urban.economy,s.civilization.municipal.nodes]),before);
  settle(h);
  for(const target of ['home','river'])for(const mutate of [
    e=>{e.paidInputs=null;},e=>{e.paidInputs.at++;},e=>{e.paidInputs.resources.tools=-1;},
    e=>{e.paidInputs.resources.unlisted=1;},e=>{e.paidInputs.resources=[];},
    e=>{e.treatmentInputs.resources.food=1;},e=>{e.treatmentInputs.at--;}
  ]){
    const bad=clone(s),e=target==='home'?bad.civilization.urban.economy:bad.civilization.municipal.nodes[target].economy;mutate(e);
    assert.throws(()=>target==='home'?u.validate(bad):m.validate(bad),target);
  }
});

test('a real three-warehouse agreement replaces trade slots once and never forecasts incoming gifts as production',()=>{
  const h=harness(),{s,u,m,r,ctx}=h,finance=ctx.CivilFinance;
  const old=r.committedFlow(s),riverOld=m.tradeExports(s,'river'),railOld=m.tradeExports(s,'rail');
  assert.equal(finance.quoteAgreement(s,['river','rail']).payable,true);
  assert.equal(finance.approve(s,['river','rail']),true);
  const before=JSON.stringify(s),current=u.commitments(s),river=m.tradeExports(s,'river'),rail=m.tradeExports(s,'rail');
  // Both 128-capacity routes reuse their old physical cart. Replacing one trip
  // per 600 seconds changes cargo, not the total dispatch-maintenance rate.
  near(current.wood,old.wood);near(current.parts,old.parts);
  near(current.medicine-old.medicine,-(24-.5)/60);
  near(current.tools-old.tools,-2/60);near(current.food-old.food,12/60);
  near(river.wood,.2);near(rail.wood,.2);
  near(river.food,riverOld.food-12/60);near(rail.iron,railOld.iron-3/60);near(rail.parts,railOld.parts-1/60);
  assert.equal(river.medicine,undefined);assert.equal(river.tools,undefined);
  const local=m.forecast(s,'river'),home=u.forecast(s);
  near(local.food,local.deltas.food-river.food);near(local.medicine,local.deltas.medicine);
  assert.ok(home.deltas.medicine>0,'the natural home chain still produces its own medicine');
  assert.ok(home.deltas.medicine+current.medicine<home.deltas.medicine,'committed medicine is an expense');
  assert.equal(JSON.stringify(s),before,'forecasting cannot dispatch or pay from the authoritative warehouses');
});

test('autonomous coordination is paid once at the next boundary in both forecasts without changing live ledgers',()=>{
  const h=harness(),{s,u,m,ctx}=h,finance=ctx.CivilFinance;
  assert.equal(s.civilization.society.axes.devolution,'local');assert.equal(finance.approve(s,['river','rail']),true);
  finance.settle(s);const livePeriod=finance.period(s),before=JSON.stringify(s),paid=clone(livePeriod.paidAdmin);
  const home=u.forecast(s),local=m.forecast(s,'river');
  for(const preview of [home,local]){
    const p=finance.period(preview.copy);
    for(const id of ['home','river','rail'])near(p.paidAdmin[id]-paid[id],.02);
    const sameBoundary=JSON.stringify(preview.copy);assert.deepEqual(clone(finance.settle(preview.copy)),{});assert.equal(JSON.stringify(preview.copy),sameBoundary);
    assert.equal(preview.paidInputs.resources.knowledge,undefined);
  }
  near(home.flow['共同记录'].knowledge,-.02);
  near(local.deltas.knowledge,local.copy.civilization.municipal.nodes.river.economy.deltas.knowledge-.02);
  assert.equal(local.paidInputs.at,s.civilization.elapsed+10,'a local node without Services also advances to a new boundary');
  assert.equal(JSON.stringify(s),before);
});

test('local lumber staffing includes the approved real wooden contribution and stays within actual adult capacity',()=>{
  const h=harness(),{s,m,ctx}=h,n=m.node(s,'river'),finance=ctx.CivilFinance;
  assert.equal(finance.approve(s,['river','rail']),true);
  // Keep this town's actual number and identities; make all existing children
  // adults to isolate a one-teacher staffing boundary, without adding anybody.
  for(const c of n.cohorts)if(c.age<18)c.age=25;
  m.planWorkers(s,'river');const workers={...n.workers},exports=m.tradeExports(s,'river');
  const local=m.data(s,'river'),needed=(workers.teacher||0)*.1+(workers.smith||0)*.2+(local.buildings.scrubber?.2:0)+(local.buildings.filterplant||0)*.2+exports.wood;
  const available=ctx.CivilPopulation.workforce(n.cohorts);
  assert.ok((workers.gatherer||0)*.5>=needed+.5-1e-8,'paid contribution is in the lumber plan, with the normal half-unit buffer');
  assert.ok(Object.values(workers).reduce((sum,n)=>sum+n,0)<=available);
  const before=n.stores.wood;m.settleNode(s,'river');
  assert.ok(n.stores.wood-before+1e-8>=exports.wood,'actual local production covers its own export, before that later physical dispatch');
});

test('Finance reserve uses the paid tool input even when production hides it in a positive net delta',()=>{
  const h=harness(),{s,ctx,u,m}=h,finance=ctx.CivilFinance;
  settle(h);const e=s.civilization.urban.economy;
  assert.ok(e.paidInputs.resources.tools*12>4);assert.ok(s.stores.tools>0);
  near(finance.reserve(s,'home').tools,e.paidInputs.resources.tools*12);
  const old=clone(s);delete old.civilization.urban.economy.paidInputs;delete old.civilization.municipal.nodes.river.economy.paidInputs;
  const before=JSON.stringify(old),home=u.forecast(old),local=m.forecast(old,'river');
  near(finance.reserve(old,'home').tools,Math.max(4,home.paidInputs.resources.tools*12));
  near(finance.reserve(old,'river').tools,Math.max(4,local.paidInputs.resources.tools*12));
  assert.equal(JSON.stringify(old),before,'legacy reserve fallback must not settle or migrate the live state');
});
