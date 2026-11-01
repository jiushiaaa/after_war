const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function harness(saved,finance=true){
  const s=clone(saved||JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-two-towns.json'),'utf8')).state);
  const ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){}},Events:{activeEvent:()=>null},
    $SM:{fireUpdate(){}},AudioEngine:{},Engine:{saveGame(){}},Notifications:{notify(){},printMessage(){}}});
  let files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
  if(finance){
    if(!files.includes('content/finance.js'))files.splice(files.findIndex(f=>f.startsWith('src/')),0,'content/finance.js');
    if(!files.includes('src/postwar/finance.js'))files.push('src/postwar/finance.js');
  }else files=files.filter(f=>!f.endsWith('/finance.js'));
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};if(finance)ctx.Civilization.initState();else ctx.CivilRegions.init(s);
  if(finance)ctx.CivilFinance.init(s);
  const h={s,ctx,r:ctx.CivilRegions,f:ctx.CivilFinance};
  // This transport-only driver follows actual seconds and Finance payments. It
  // intentionally does not run production; finite stocks fund the declared case.
  h.step=n=>{for(let i=0;i<n;i++){s.civilization.elapsed++;if(finance&&s.civilization.elapsed%10===0)h.f.settle(s);if(finance)h.f.tick(s);h.r.tick(s);}};
  return h;
}
let readySnapshot;
function ready(){
  if(readySnapshot)return harness(readySnapshot);
  const h=harness(),{s,ctx,r,f}=h,c=s.civilization;
  // Preserve the browser census, paid facilities, upgrades and existing cargo.
  // Funding is a declared finite test input, not a natural-play claim.
  for(const key of ctx.CivilCatalog.resources){s.stores[key]=50000;for(const n of Object.values(c.regions.nodes))n.stores[key]=50000;}
  c.urban.enabled=false;
  for(const id of Object.keys(c.regions.routes))r.setRoute(s,id,false);
  h.step(150);assert.equal(c.regions.shipments.length,0,'old paid trips really return first');
  for(const id of ['river','rail'])assert.equal(r.setRoute(s,id,true),true);
  assert.ok(f.quoteAgreement(s,['river','rail']));assert.equal(f.approve(s,['river','rail']),true);
  h.step(8);assert.equal(f.coordinationReady(s),true);r.validate(s);f.validate(s);
  readySnapshot=clone(s);return h;
}
function totals(s){const out={};const add=st=>{for(const [key,n]of Object.entries(st))out[key]=(out[key]||0)+n;};add(s.stores);for(const n of Object.values(s.civilization.regions.nodes))add(n.stores);for(const p of s.civilization.regions.shipments)add(p.cargo);return out;}
function paidTrip(h,id='river'){assert.equal(h.r.launch(h.s,id),true,h.s.civilization.regions.routes[id].status);const p=h.s.civilization.regions.shipments.find(p=>p.route===id);assert.equal(p.purpose,'common');return p;}
function stopOther(h,id){for(const key of Object.keys(h.s.civilization.regions.routes))if(key!==id)h.r.setRoute(h.s,key,false);}
function valid(h){h.r.validate(h.s);h.f.validate(h.s);}

test('legacy freight and pure commitments stay unchanged when Finance is absent',()=>{
  const h=harness(undefined,false),{s,r}=h,before=JSON.stringify(s),expected={};
  for(const [id,route]of Object.entries(s.civilization.regions.routes))if(route.enabled&&route.assigned>=2)for(const [key,n]of Object.entries(r.dispatchCost(s,id,h.ctx.CivilRegionContent[id].out)))expected[key]=(expected[key]||0)-n*10/(route.travel*2+10);
  const flow=r.committedFlow(s);for(const [key,n]of Object.entries(expected))near(flow[key],n);
  assert.equal(JSON.stringify(r.committedHomeFlow(s)),JSON.stringify(flow));r.validate(s);assert.equal(JSON.stringify(s),before);
});

test('common transport uses the existing cart and conserves all three warehouses plus actual cargo',()=>{
  const h=ready(),{s,r,f}=h,x=s.civilization.regions;stopOther(h,'river');
  const before=totals(s),adminBefore=Object.values(f.period(s).paidAdmin).reduce((a,b)=>a+b,0),home=clone(s.stores),local=clone(x.nodes.river.stores),p=paidTrip(h),cost=r.dispatchCost(s,'river',{medicine:12,tools:2}),tradeTrips=x.routes.river.completedTrips,tradeAt=x.routes.river.lastDeliveredAt;
  assert.equal(x.shipments.length,1);assert.equal(r.launch(s,'river'),false);assert.equal(x.routes.river.assigned,2);assert.equal(p.capacity,128);
  for(const [key,n]of Object.entries(cost))near(home[key]-s.stores[key],n);
  const order=f.order(s,p);assert.equal(order.shipmentId,p.id);assert.equal(f.data(s).orders.length,1);valid(h);
  r.setRoute(s,'river',false);h.step(60);assert.equal(p.status,'loading');near(x.nodes.river.stores.medicine-local.medicine,12);near(x.nodes.river.stores.tools-local.tools,2);
  assert.equal(x.routes.river.lastSupplyAt,s.civilization.elapsed);assert.equal(x.routes.river.lastDeliveredAt,tradeAt);valid(h);
  h.step(1);assert.equal(p.phase,'inbound');assert.equal(p.status,'moving');near(local.wood-x.nodes.river.stores.wood,12);valid(h);
  h.step(60);assert.equal(x.shipments.length,0);assert.equal(order.status,'complete');assert.equal(x.routes.river.assigned,0);assert.equal(x.routes.river.completedTrips,tradeTrips);
  const after=totals(s),admin=Object.values(f.period(s).paidAdmin).reduce((a,b)=>a+b,0)-adminBefore;for(const key of Object.keys(before))near(after[key],before[key]-({food:1,wood:1,parts:.05,knowledge:admin}[key]||0));
  near(s.stores.wood,home.wood-1+12);valid(h);
});

test('a due budget outranks construction; afterwards ordinary trade is mandatory and the period cannot dispatch twice',()=>{
  const h=ready(),{s,r,f}=h,x=s.civilization.regions;stopOther(h,'river');
  assert.equal(s.civilization.municipal.nodes.river.project.status,'supplying');const p=paidTrip(h);
  h.step(121);assert.equal(f.order(s,p).status,'complete');assert.equal(x.shipments.length,0);
  assert.equal(r.launch(s,'river'),true);assert.equal(x.shipments[0].purpose,'trade');h.step(121);
  assert.equal(f.nextCargo(s,'river',128),null);assert.equal(r.launch(s,'river'),true);assert.equal(x.shipments[0].purpose,'municipal');
  assert.equal(f.data(s).orders.filter(o=>o.node==='river').length,1);valid(h);
});

test('insufficient home reserves leave orders, IDs, materials and all warehouses unmodified',()=>{
  for(const key of ['food','medicine','tools']){
    const h=ready(),{s,r,f}=h;stopOther(h,'river');const reserve=f.reserve(s,'home'),cost=r.dispatchCost(s,'river',{medicine:12,tools:2});s.stores[key]=reserve[key]+(cost[key]||0)-.01;
    const before=JSON.stringify([s.stores,s.civilization.regions.nodes,f.data(s),s.civilization.regions.nextShipment,s.civilization.municipal.nodes.river.project]);
    assert.ok(f.nextCargo(s,'river',128),'the due budget remains ahead of construction');assert.equal(r.launch(s,'river'),false);assert.equal(s.civilization.regions.shipments.length,0);
    assert.equal(JSON.stringify([s.stores,s.civilization.regions.nodes,f.data(s),s.civilization.regions.nextShipment,s.civilization.municipal.nodes.river.project]),before);valid(h);
  }
});

test('outbound road failure refunds only the real undelivered common cargo, once and along the travelled leg',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const home=clone(s.stores),local=clone(s.civilization.regions.nodes.river.stores),p=paidTrip(h);h.step(12);r.setRoad(s,'river',false);h.step(1);
  assert.equal(p.status,'held');assert.equal(r.returnShipment(s,p.id),true);assert.equal(p.phase,'returning');assert.equal(p.legDuration,12);valid(h);
  h.step(11);assert.ok(s.civilization.regions.shipments.includes(p));h.step(1);assert.equal(s.civilization.regions.shipments.length,0);
  near(s.stores.medicine,home.medicine);near(s.stores.tools,home.tools);near(s.stores.wood,home.wood-1);near(s.stores.parts,home.parts-.05);near(s.stores.food,home.food-1);
  for(const key of Object.keys(local))if(key!=='knowledge')near(s.civilization.regions.nodes.river.stores[key],local[key]);assert.equal(f.order(s,p).status,'cancelled');
  const after=JSON.stringify(s);assert.equal(f.recordReturn(s,p),false);assert.equal(r.arrive(s,p),false);assert.equal(JSON.stringify(s),after);valid(h);
});

test('local contribution waits for local reserves; an empty return cannot refund delivered medicine',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h),n=s.civilization.regions.nodes.river;h.step(60);n.stores.wood=0;
  const delivered=n.stores.medicine,home=s.stores.medicine;h.step(20);assert.equal(p.status,'loading');assert.equal(f.data(s).receipts.length,1);
  assert.equal(r.returnShipment(s,p.id),true);assert.equal(p.phase,'empty');assert.equal(p.legDuration,60);valid(h);h.step(60);
  near(n.stores.medicine,delivered);near(s.stores.medicine,home);assert.equal(f.order(s,p).status,'cancelled');assert.equal(s.civilization.regions.shipments.length,0);valid(h);
});

test('loaded return cargo turns back to its local warehouse and the empty cart still waits for the road',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h),n=s.civilization.regions.nodes.river,wood=n.stores.wood,home=s.stores.wood;
  h.step(81);assert.equal(p.phase,'inbound');near(n.stores.wood,wood-12);r.setRoad(s,'river',false);h.step(1);assert.equal(r.returnShipment(s,p.id),true);assert.equal(p.target,'river');assert.equal(p.legDuration,20);valid(h);
  h.step(20);near(n.stores.wood,wood);near(s.stores.wood,home);assert.equal(p.phase,'empty');assert.equal(p.status,'held');assert.equal(f.order(s,p).status,'backReturned');valid(h);
  h.step(30);assert.equal(p.remaining,60);assert.equal(r.returnShipment(s,p.id),false);r.setRoad(s,'river',true);h.step(60);
  assert.equal(s.civilization.regions.shipments.length,0);assert.equal(f.order(s,p).status,'cancelled');near(n.stores.wood,wood);near(s.stores.wood,home);valid(h);
});

test('copies, premature clocks and repeated arrival callbacks never create common goods',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h),before=JSON.stringify(s);
  const fake=clone(p);fake.remaining=0;assert.equal(r.arrive(s,fake),false);assert.equal(f.receive(s,fake),false);assert.equal(JSON.stringify(s),before);
  p.remaining=0;const early=JSON.stringify(s);assert.equal(r.arrive(s,p),false);assert.equal(JSON.stringify(s),early);assert.throws(()=>r.validate(s));p.remaining=60;
  h.step(60);const received=JSON.stringify(s);assert.equal(r.arrive(s,p),false);assert.equal(f.receive(s,p),false);assert.equal(JSON.stringify(s),received);
  h.step(61);const complete=JSON.stringify(s);assert.equal(r.arrive(s,p),false);assert.equal(f.receive(s,p),false);assert.equal(JSON.stringify(s),complete);valid(h);
});

test('common save evidence cannot lose Finance, change orders, duplicate a cart or masquerade as ordinary trade',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');paidTrip(h);valid(h);
  const edits=[x=>delete x.civilization.finance,x=>x.civilization.finance=null,x=>x.civilization.regions.shipments[0].commonOrderId='wrong',x=>x.civilization.regions.shipments[0].periodIndex++,x=>x.civilization.regions.shipments[0].agreementId++,x=>x.civilization.regions.shipments[0].purpose='trade',x=>x.civilization.regions.shipments.push(clone(x.civilization.regions.shipments[0])),x=>x.civilization.regions.shipments[0].legStartedAt++,x=>x.civilization.finance.orders=[]];
  for(const edit of edits){const bad=clone(s);edit(bad);assert.throws(()=>r.validate(bad));}
  const restored=harness(s);valid(restored);assert.equal(JSON.stringify(restored.s),JSON.stringify(s));
  const noModule=harness(s,false);assert.throws(()=>noModule.r.validate(noModule.s));
  h.step(121);r.setRoute(s,'river',false);const old=clone(s);delete old.civilization.finance;assert.throws(()=>r.validate(old),'lastPurpose common is still a retained financial trace');
});

test('common and barter commitments share one frequency and previews never pay or create orders',()=>{
  const h=ready(),{s,r,f,ctx}=h;stopOther(h,'river');const snap=JSON.stringify(s),flow=r.committedFlow(s),local=r.committedFlow(s,'river'),total=10/130,common=10/600;
  near(flow.medicine,-(.5*(total-common)+12*common));near(flow.tools,-(1*(total-common)+2*common));near(flow.wood,-total);near(flow.food,-total);near(flow.parts,-.05*total);
  near(local.food,-12*(total-common));near(local.wood,-12*common);assert.equal(local.medicine,undefined);assert.equal(JSON.stringify(s),snap);
  f.agreement(s).paused=true;const trade=r.committedFlow(s);near(trade.medicine,-.5*total);near(trade.wood,-total);assert.equal(r.committedFlow(s,'river').wood,undefined);
});

test('local food, medicine and tool reserves block contribution without charging or fabricating a return receipt',()=>{
  for(const key of ['food','medicine','tools']){
    const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h),n=s.civilization.regions.nodes.river;h.step(60);
    const previous=n.stores[key];n.stores[key]=f.reserve(s,'river')[key]-.01;
    const before=JSON.stringify([n.stores,p,f.data(s)]);assert.equal(r.loadReturn(s,p),false);assert.equal(JSON.stringify([n.stores,p,f.data(s)]),before);
    n.stores[key]=previous;const wood=n.stores.wood;assert.equal(r.loadReturn(s,p),true);near(n.stores.wood,wood-12);assert.equal(f.data(s).receipts.length,2);assert.equal(r.loadReturn(s,p),false);near(n.stores.wood,wood-12);valid(h);
  }
});

test('a public pause stops new budget orders while preserving the old cargo, receipt and paid round trip',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h),id=p.commonOrderId;
  assert.equal(f.pause(s),true);assert.equal(f.agreement(s).paused,false,'the existing constitution requires its real notice time');h.step(60);
  assert.equal(f.agreement(s).paused,true);assert.equal(f.transportPlan(s,'river'),null);assert.equal(f.nextCargo(s,'rail',128),null);assert.equal(p.commonOrderId,id);assert.equal(p.status,'loading');valid(h);
  r.setRoute(s,'river',false);h.step(61);assert.equal(f.order(s,p).status,'complete');assert.equal(s.civilization.regions.shipments.length,0);valid(h);
  const restored=harness(s);valid(restored);assert.equal(restored.f.order(restored.s,p).status,'complete');
});

test('crossing a budget period never frees a held physical cart or emits catch-up orders',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h),orderId=p.commonOrderId;h.step(5);r.setRoad(s,'river',false);h.step(605);
  assert.equal(p.status,'held');assert.equal(p.remaining,55);assert.equal(p.commonOrderId,orderId);assert.equal(f.data(s).orders.length,1);assert.equal(f.data(s).periods.length,2);assert.equal(r.launch(s,'river'),false);valid(h);
  const loaded=harness(s);valid(loaded);assert.equal(loaded.s.civilization.regions.shipments[0].commonOrderId,orderId);
  r.setRoad(s,'river',true);h.step(55);h.step(61);assert.equal(f.order(s,p).status,'complete');assert.equal(s.civilization.regions.shipments.length,0);
  assert.equal(r.launch(s,'river'),true);assert.equal(s.civilization.regions.shipments[0].purpose,'trade','the previous budget still owes an ordinary trade turn');h.step(121);
  // The coordinator must pay at a fresh real boundary; no old period is replayed.
  const wait=(10-s.civilization.elapsed%10)%10;h.step(wait);assert.equal(r.launch(s,'river'),true);
  const next=s.civilization.regions.shipments.find(x=>x.route==='river');assert.equal(next.purpose,'common');assert.notEqual(next.commonOrderId,orderId);assert.equal(next.periodIndex,1);assert.equal(f.data(s).orders.length,2);assert.ok(f.order(s,next).dispatchedAt-f.order(s,p).dispatchedAt>=600);valid(h);
});

test('passenger crew commitments delay a new budget departure without granting another cart or transporter',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const workers=s.game.workers.transporter,passengerCrew=h.ctx.CivilUrban.reservedTransport(s);assert.ok(passengerCrew>0);s.game.workers.transporter=passengerCrew;
  const before=JSON.stringify([s.stores,f.data(s)]);assert.equal(r.launch(s,'river'),false);assert.equal(s.civilization.regions.shipments.length,0);assert.equal(JSON.stringify([s.stores,f.data(s)]),before);
  s.game.workers.transporter=workers;const p=paidTrip(h);assert.equal(r.launch(s,'river'),false);assert.equal(r.reservedTransport(s),2);assert.equal(p.purpose,'common');valid(h);
});

test('the same contract also travels in an unreinforced 64 cart and never charges the optional parts upkeep',()=>{
  const h=ready(),{s,r,f}=h,x=s.civilization.regions;
  // Declared alternate transport fixture: neither optional cart reinforcement
  // exists. This is a capacity test, not another claim about the browser save.
  x.upgrades={nextId:1,projects:{}};for(const route of Object.values(x.routes))route.capacity=64;
  stopOther(h,'river');valid(h);const parts=s.stores.parts,wood=s.stores.wood,p=paidTrip(h);
  assert.equal(p.capacity,64);assert.equal(Object.values(p.cargo).reduce((a,b)=>a+b,0),14);assert.equal(f.order(s,p).paid.parts,undefined);near(s.stores.parts,parts);
  r.setRoute(s,'river',false);h.step(121);assert.equal(f.order(s,p).status,'complete');near(s.stores.parts,parts);near(s.stores.wood,wood+11);valid(h);
});

test('two member routes have distinct real vehicles and receipts, with no extra route or labor pool',()=>{
  const h=ready(),{s,r,f}=h,x=s.civilization.regions,before=totals(s),adminBefore=Object.values(f.period(s).paidAdmin).reduce((a,b)=>a+b,0);
  const first=paidTrip(h,'river'),second=paidTrip(h,'rail');assert.notEqual(first.id,second.id);assert.notEqual(first.commonOrderId,second.commonOrderId);
  assert.equal(x.shipments.length,2);assert.equal(r.reservedTransport(s),4);assert.equal(r.launch(s,'river'),false);assert.equal(r.launch(s,'rail'),false);valid(h);
  for(const id of ['river','rail'])r.setRoute(s,id,false);h.step(181);
  assert.equal(x.shipments.length,0);assert.equal(f.order(s,first).status,'complete');assert.equal(f.order(s,second).status,'complete');assert.equal(f.data(s).receipts.length,4);
  const after=totals(s),admin=Object.values(f.period(s).paidAdmin).reduce((a,b)=>a+b,0)-adminBefore;
  for(const key of Object.keys(before))near(after[key],before[key]-({food:2,wood:2,parts:.1,knowledge:admin}[key]||0));valid(h);
});

test('shortening a clock cannot deliver either paid common leg before its recorded actual travel time',()=>{
  const h=ready(),{s,r,f}=h;stopOther(h,'river');const p=paidTrip(h);h.step(1);
  const original={remaining:p.remaining,legDuration:p.legDuration};p.remaining=0;p.legDuration=1;
  let before=JSON.stringify([s.stores,s.civilization.regions.nodes,f.data(s)]);assert.equal(r.arrive(s,p),false);assert.equal(JSON.stringify([s.stores,s.civilization.regions.nodes,f.data(s)]),before);assert.throws(()=>r.validate(s));
  Object.assign(p,original);h.step(60);assert.equal(p.phase,'inbound');assert.equal(p.status,'moving');h.step(1);
  const back={remaining:p.remaining,legDuration:p.legDuration};p.remaining=0;p.legDuration=1;
  before=JSON.stringify([s.stores,s.civilization.regions.nodes,f.data(s)]);assert.equal(r.arrive(s,p),false);assert.equal(JSON.stringify([s.stores,s.civilization.regions.nodes,f.data(s)]),before);assert.throws(()=>r.validate(s));Object.assign(p,back);valid(h);
});
