const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function harness(){
  // Recorded two-town starting state. Tests below alter shortages/policies explicitly;
  // the fast transport helper does not claim a naturally grown three-city outcome.
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-two-towns.json'),'utf8')).state;
  const messages=[],ctx=vm.createContext({State:s,_:x=>x,Civilization:{notify:x=>messages.push(x)}});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','content/passenger.js','content/finance.js','src/postwar/population.js','src/postwar/society.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/origins.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/passenger.js','src/postwar/finance.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  const f=ctx.CivilFinance,r=ctx.CivilRegions;f.init(s);
  const step=n=>{for(let i=0;i<n;i++){s.civilization.elapsed++;f.tick(s);r.tick(s);}};
  return {s,ctx,f,r,step,messages};
}
function approved(){const h=harness();assert.ok(h.f.approve(h.s,['river','rail']));return h;}
function idle(){const h=approved(),{s,r,step,f}=h;for(const id of Object.keys(s.civilization.regions.routes))r.setRoute(s,id,false);step(140);assert.equal(s.civilization.regions.shipments.length,0);r.setRoute(s,'river',true);f.settle(s);return h;}
function launch(h,id='river'){assert.equal(h.r.launch(h.s,id),true);const p=h.s.civilization.regions.shipments.find(x=>x.route===id);assert.equal(p.purpose,'common');return p;}
function arrival(h,p){h.s.civilization.elapsed+=p.remaining;p.remaining=0;assert.equal(h.r.arrive(h.s,p),true);}
function total(s){const out={};for(const st of [s.stores,...Object.values(s.civilization.regions.nodes).map(n=>n.stores),...s.civilization.regions.shipments.map(p=>p.cargo)])for(const [k,v]of Object.entries(st))out[k]=(out[k]||0)+v;return out;}
test('legacy migration adds only an empty ledger once and explicit malformed finance never becomes a new gift',()=>{
  const h=harness(),{s,f}=h;delete s.civilization.finance;const before=JSON.stringify(s);assert.equal(f.validate(s),true);f.init(s);const ledger=s.civilization.finance;delete s.civilization.finance;assert.equal(JSON.stringify(s),before);s.civilization.finance=ledger;const once=JSON.stringify(s);f.init(s);assert.equal(JSON.stringify(s),once);assert.ok(f.validate(s));
  for(const bad of [null,false,0,{},[]]){const t=clone(s);t.civilization.finance=bad;f.init(t);assert.deepEqual(t.civilization.finance,bad);assert.throws(()=>f.validate(t));}
  const t=clone(s);delete t.civilization.finance;t.civilization.regions.routes.river.lastPurpose='common';assert.throws(()=>f.init(t));assert.throws(()=>f.validate(t));
});
test('three signatures debit knowledge 30/10/10 atomically and never prepay the annual cargo',()=>{
  const {s,f}=harness();for(const id of ['home','river','rail']){const t=clone(s);f.stores(t,id).knowledge=id==='home'?29:9;const before=JSON.stringify(t);assert.equal(f.approve(t,['river','rail']),false);assert.equal(JSON.stringify(t),before);}
  const before=clone([s.stores,s.civilization.regions.nodes.river.stores,s.civilization.regions.nodes.rail.stores]);const preview=JSON.stringify(s),q=f.quoteAgreement(s,['river','rail']);assert.equal(q.payable,true);assert.equal(JSON.stringify(s),preview);assert.ok(f.approve(s,['river','rail']));
  for(const [i,id]of ['home','river','rail'].entries()){const st=f.stores(s,id);near(st.knowledge,before[i].knowledge-[30,10,10][i]);for(const key of Object.keys(st))if(key!=='knowledge')near(st[key],before[i][key]);}
  assert.equal(f.approve(s,['river','rail']),false);assert.ok(f.validate(s));
  for(const change of [t=>t.civilization.society.succession='retirement',t=>t.civilization.municipal.nodes.rail.town=false,t=>t.civilization.regions.nodes.rail.population=79,t=>t.civilization.regions.routes.rail.condition='closed',t=>t.civilization.society.service=false]){const t=harness();change(t.s);assert.equal(t.f.approve(t.s,['river','rail']),false);}
});
test('coordination is an actual single ten-second payment; distributed shortages cannot partly charge other warehouses',()=>{
  const {s,f}=approved(),a=f.agreement(s),before=a.members.map(id=>f.stores(s,id).knowledge);const flow=f.settle(s);near(flow.knowledge,-.02);a.members.forEach((id,i)=>near(f.stores(s,id).knowledge,before[i]-.02));const once=JSON.stringify(s);f.settle(s);assert.equal(JSON.stringify(s),once);s.civilization.elapsed++;f.settle(s);a.members.forEach((id,i)=>near(f.stores(s,id).knowledge,before[i]-.02));
  s.civilization.elapsed+=9;f.stores(s,'rail').knowledge=0;const stocks=JSON.stringify(a.members.map(id=>f.stores(s,id)));f.settle(s);assert.equal(JSON.stringify(a.members.map(id=>f.stores(s,id))),stocks);assert.equal(f.nextCargo(s,'river',128),null);
  s.civilization.elapsed+=10;s.civilization.society.axes.devolution='central';s.civilization.society.succession='retirement';const home=s.stores.knowledge;f.settle(s);near(s.stores.knowledge,home-.04);assert.ok(f.nextCargo(s,'river',128));assert.ok(f.validate(s));
});
test('same real cart conserves both contributions and consumes dispatch upkeep just once',()=>{
  const h=idle(),{s,f,r}=h,before=total(s),home=clone(s.stores),local=clone(f.stores(s,'river'));const p=launch(h),cost=clone(f.order(s,p).paid);
  assert.equal(p.capacity,128);assert.equal(s.civilization.regions.routes.river.assigned,2);assert.equal(f.dispatch(s,p,cost),false);assert.equal(f.receive(s,{...p}),false);assert.ok(f.validate(s));
  let sum=total(s);for(const key of ['medicine','tools','wood','food','parts'])near(sum[key],before[key]-(cost[key]||0)+(p.cargo[key]||0));
  arrival(h,p);near(f.stores(s,'river').medicine,local.medicine+12);near(s.stores.medicine,home.medicine-12);assert.equal(f.receive(s,p),false);assert.ok(f.validate(s));
  assert.ok(r.loadReturn(s,p));assert.equal(r.loadReturn(s,p),false);near(f.stores(s,'river').wood,local.wood-12);assert.ok(f.validate(s));arrival(h,p);near(s.stores.wood,home.wood-1+12);assert.equal(f.receive(s,p),false);assert.equal(f.order(s,p).status,'complete');assert.ok(f.validate(s));
  sum=total(s);for(const key of ['medicine','tools','wood','food','parts'])near(sum[key],before[key]-(key==='wood'?1:key==='food'?cost.food:key==='parts'?.05:0));
});
test('home reserves stop the due budget cart atomically, and missing local wood holds its actual return cargo',()=>{
  const h=idle(),{s,f,r}=h;for(const key of ['food','medicine','tools']){const t=clone(s),reserve=f.reserve(t),cost=r.dispatchCost(t,'river',{medicine:12,tools:2});t.stores[key]=(reserve[key]||0)+(cost[key]||0)-.01;const stock=JSON.stringify(t.stores),id=t.civilization.regions.nextShipment;assert.equal(r.launch(t,'river'),false,key);assert.equal(JSON.stringify(t.stores),stock);assert.equal(t.civilization.regions.nextShipment,id);assert.equal(t.civilization.finance.orders.length,0);}
  const p=launch(h);arrival(h,p);const n=f.stores(s,'river');n.wood=11.99;const before=JSON.stringify([n,p,f.data(s)]);assert.equal(r.loadReturn(s,p),false);assert.equal(JSON.stringify([n,p,f.data(s)]),before);assert.equal(p.status,'loading');n.wood=12;assert.ok(r.loadReturn(s,p));near(n.wood,0);assert.ok(f.validate(s));
});
test('undelivered exports return only to home even while the contract exits',()=>{
  const h=idle(),{s,f,r,step}=h;s.civilization.society.axes.charter='custom';const before=clone(s.stores),p=launch(h);step(10);r.setRoad(s,'river',false);step(1);assert.equal(p.status,'held');assert.ok(f.exit(s));assert.equal(f.transportPlan(s,'river'),null);assert.ok(r.returnShipment(s,p.id));arrival(h,p);near(s.stores.medicine,before.medicine);near(s.stores.tools,before.tools);near(s.stores.wood,before.wood-1);assert.equal(f.order(s,p).status,'cancelled');assert.ok(f.validate(s));
});
test('return-side blockage returns wood to its remote payer, then keeps the original empty cart occupied until home',()=>{
  const h=idle(),{s,f,r,step}=h,p=launch(h);arrival(h,p);const node=f.stores(s,'river'),home=s.stores.wood,wood=node.wood;assert.ok(r.loadReturn(s,p));step(10);r.setRoad(s,'river',false);step(1);assert.ok(r.returnShipment(s,p.id));arrival(h,p);near(node.wood,wood);near(s.stores.wood,home);assert.equal(p.phase,'empty');assert.equal(p.status,'held');assert.equal(f.order(s,p).status,'backReturned');assert.ok(f.validate(s));r.setRoad(s,'river',true);p.status='moving';arrival(h,p);assert.equal(f.order(s,p).status,'cancelled');assert.ok(f.validate(s));
});
test('insufficient contribution can send the same cart home empty without undoing received medicine',()=>{
  const h=idle(),{s,f,r}=h,p=launch(h);arrival(h,p);f.stores(s,'river').wood=0;const medicine=f.stores(s,'river').medicine;assert.equal(r.loadReturn(s,p),false);assert.ok(r.returnShipment(s,p.id));arrival(h,p);near(f.stores(s,'river').medicine,medicine);assert.equal(f.order(s,p).status,'cancelled');assert.ok(f.validate(s));
});
test('public revisions wait sixty seconds while already authorized trips continue, and succession preserves the ledger',()=>{
  const h=idle(),{s,f}=h,a=f.agreement(s);assert.equal(s.civilization.society.axes.charter,'constitution');assert.ok(f.pause(s));assert.equal(a.paused,false);const contracts=JSON.stringify(f.data(s).agreements);s.civilization.society.succession='retirement';s.civilization.elapsed+=60;f.tick(s);assert.equal(JSON.stringify(f.data(s).agreements),contracts);assert.ok(f.validate(s));s.civilization.society.succession=null;f.tick(s);assert.equal(a.paused,true);assert.equal(f.nextCargo(s,'river',128),null);assert.ok(f.resume(s));s.civilization.elapsed+=60;f.tick(s);assert.equal(a.paused,false);assert.ok(f.validate(s));
});
test('a newly confirmed successor can immediately save an overdue public revision before the next finance tick',()=>{
  const {s,f,ctx}=approved();assert.ok(f.pause(s));s.civilization.society.succession='retirement';s.civilization.elapsed+=61;f.tick(s);assert.ok(f.data(s).revision);assert.ok(ctx.CivilSociety.succeed(s,'engineer'));assert.ok(f.validate(s));const saved=clone(s);f.init(saved);assert.ok(f.validate(saved));f.tick(saved);assert.equal(f.agreement(saved).paused,true);assert.equal(f.data(saved).revision,null);assert.ok(f.validate(saved));
});
test('elapsed periods close without issuing missed years or resetting old route orders on reapproval',()=>{
  const h=idle(),{s,f}=h,p=launch(h);arrival(h,p);assert.ok(h.r.loadReturn(s,p));arrival(h,p);const count=f.data(s).orders.length;s.civilization.elapsed+=1800;f.tick(s);assert.equal(f.data(s).orders.length,count);assert.equal(f.data(s).periods.length,2);assert.equal(f.period(s).index,3);assert.equal(f.nextCargo(s,'river',128),null);f.settle(s);assert.ok(f.nextCargo(s,'river',128));assert.ok(f.validate(s));
});
test('a dispatched but late contribution remains a missed closed-period duty after its eventual arrival',()=>{
  const h=idle(),{s,f,r}=h,p=launch(h),period=f.period(s);s.civilization.elapsed=period.endsAt;f.tick(s);assert.deepEqual(clone(period.missed),['river','rail']);assert.equal(period.closedAt,period.endsAt);arrival(h,p);assert.ok(r.loadReturn(s,p));arrival(h,p);assert.equal(f.order(s,p).status,'complete');assert.deepEqual(clone(period.missed),['river','rail']);assert.ok(f.validate(s));const bad=clone(s);bad.civilization.finance.periods[0].missed=['rail'];assert.throws(()=>f.validate(bad));
});
test('exiting and paying a new agreement cannot reset the same route into an extra six-hundred-second grant',()=>{
  const h=idle(),{s,f,r}=h,p=launch(h);arrival(h,p);assert.ok(r.loadReturn(s,p));arrival(h,p);r.setRoute(s,'rail',true);s.civilization.society.axes.charter='custom';assert.ok(f.exit(s));assert.ok(f.approve(s,['river','rail']));s.civilization.elapsed+=10;f.settle(s);assert.equal(f.nextCargo(s,'river',128),null);assert.equal(f.data(s).agreements.length,2);assert.equal(f.data(s).orders.length,1);assert.ok(f.validate(s));
});
test('save validation rejects detached identities, altered receipts and orphaned common cargo but accepts shortages',()=>{
  const h=idle(),{s,f}=h,p=launch(h);s.stores.medicine=0;assert.ok(f.validate(s));const mutate=[
    t=>delete t.civilization.finance,
    t=>t.civilization.finance.receipts[0].source='rail',
    t=>t.civilization.finance.receipts.push(clone(t.civilization.finance.receipts[0])),
    t=>t.civilization.finance.orders[0].periodIndex++,
    t=>t.civilization.finance.orders[0].paid.wood=0,
    t=>t.civilization.regions.shipments=[],
    t=>t.civilization.regions.shipments[0].commonOrderId+='x',
    t=>t.civilization.regions.shipments[0].cargo.medicine++,
    t=>t.civilization.regions.shipments[0].legStartedAt=t.civilization.elapsed+1
  ];for(const change of mutate){const t=clone(s);change(t);assert.throws(()=>f.validate(t));}
  const copy=clone(s),before=JSON.stringify(copy);f.init(copy);assert.equal(JSON.stringify(copy),before);assert.ok(f.validate(copy));assert.equal(f.receive(copy,p),false);
});
test('forecast and service observation never dispatch, duplicate evidence, or charge actual services twice',()=>{
  const h=idle(),{s,f,ctx}=h,at=s.civilization.elapsed;
  const before=JSON.stringify(s);const reserve=f.reserve(s),forecast=ctx.CivilUrban.forecast(s);assert.ok(reserve.tools>=4);assert.ok(forecast.paidInputs.resources.tools>0);assert.equal(JSON.stringify(s),before);
  const evidence={nodeId:'river',at,paidInputs:{at,resources:{tools:.2}},treatmentInputs:{at,resources:{medicine:1}},treatment:true,education:true};const stocks=JSON.stringify(f.stores(s,'river'));f.observe(s,evidence);f.observe(s,evidence);assert.equal(JSON.stringify(f.stores(s,'river')),stocks);const t=f.period(s).serviceTotals.river;assert.equal(t.observations,1);near(t.paidInputs.tools,.2);near(t.treatmentInputs.medicine,1);assert.equal(f.data(s).orders.length,0);assert.ok(f.validate(s));
});
test('native event uses fixed real-member pairs and a declined proposal remains reachable without repeated interruptions',()=>{
  const {s,f}=harness(),done=()=>()=>true;assert.equal(f.nextEvent(s),'financeOffer');const event=f.event('financeOffer',done);assert.equal(event.buttons.agree_river_rail!==undefined||event.buttons.agree_rail_river!==undefined,true);assert.equal(Object.keys(event.buttons).some(k=>k.includes('highland')),false);event.buttons.later.onChoose();assert.equal(f.nextEvent(s),null);assert.ok(f.event('financeOffer',done));assert.equal(f.data(s).agreements.length,0);assert.equal(f.event('unknown',done),null);
});
test('the one persistent council button updates its title and reads the current agreement at click time',()=>{
  const h=harness(),{s,f,ctx}=h,nodes={};
  function node(id){return nodes[id]||(nodes[id]={length:id==='#councilPanel'?1:0,label:'',hide(){return this;},show(){return this;},css(){return this;},text(value){this.label=value;return this;},attr(k,v){if(k==='id'){nodes['#'+v]=this;this.length=1;}return this;},appendTo(){return this;},contents(){return {filter:()=>({first:()=>({replaceWith:value=>{this.label=value;}})})};}});}
  ctx.$=id=>id==='<div>'?{...node('fresh'+Object.keys(nodes).length)}:node(id);ctx.document={createTextNode:text=>text};ctx.Events={activeEvent:()=>false};ctx.Civilization.showPending=()=>{};ctx.Civilization.button=(id,text,target,callback)=>{const n=node('#'+id);if(!n.callback){n.callback=callback;n.label=text;n.length=1;}return n;};
  f.refresh();const button=nodes['#financeButton'];assert.equal(button.label,'商议三仓互助');assert.ok(f.approve(s,['river','rail']));f.refresh();assert.equal(button.label,'查看共同约定');button.callback();assert.equal(s.civilization.pending,'financeLedger');s.civilization.pending=null;s.civilization.society.axes.charter='custom';assert.ok(f.exit(s));f.refresh();assert.equal(button.label,'商议三仓互助');button.callback();assert.equal(s.civilization.pending,'financeOffer');
});
