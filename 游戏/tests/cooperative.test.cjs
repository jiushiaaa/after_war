const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const original=JSON.parse(fs.readFileSync('tests/fixtures/natural-local-industry.json','utf8')).state;
function create(){const h=harness(original);h.coop=h.ctx.CivilCooperative;return h;}
function found(){const h=create();assert.ok(h.coop.found(h.s,'river'));return h;}
test('old saves stay public and unchanged, and only an actual registered local city can establish the pilot',()=>{
 const h=create(),before=JSON.stringify(h.s);h.coop.settle(h.s,'river',1);h.ctx.CivilHistory.snapshot(h.s);h.roundtrip();assert.equal(JSON.stringify(h.s),before);
 for(const id of ['home','missing','rail','highland'])assert.equal(h.coop.found(h.s,id),false);assert.equal(JSON.stringify(h.s),before);
});
test('one existing paid workshop and initial goods transfer ownership once with no duplicated buildings or people',()=>{
 const h=create(),n=h.m.node(h.s,'river'),m=h.m.data(h.s,'river'),before=clone(n.stores),assets=JSON.stringify(m.buildings),people=JSON.stringify(n.cohorts),cap=h.m.jobCapacity(h.s,'river').smith;
 assert.ok(h.coop.found(h.s,'river'));const d=h.coop.data(h.s,'river');
 for(const [k,v]of Object.entries(h.coop.grant))near(n.stores[k]+d.stores[k],before[k]);near(n.stores.knowledge,before.knowledge-20);
 assert.equal(JSON.stringify(m.buildings),assets);assert.equal(JSON.stringify(n.cohorts),people);assert.equal(h.m.jobCapacity(h.s,'river').smith,cap-4);assert.equal(h.m.jobCapacity(h.s,'river').coopsmith,4);
 const after=JSON.stringify(h.s);assert.equal(h.coop.found(h.s,'river'),false);assert.equal(JSON.stringify(h.s),after);h.roundtrip();
});
test('in-kind wages replace the same public meal amount, while tools are made only in the cooperative warehouse',()=>{
 const on=found(),off=harness(on.s);off.ctx.CivilCooperative.setEnabled(off.s,'river',false);
 on.s.civilization.elapsed+=10;off.s.civilization.elapsed+=10;const before=clone(on.coop.data(on.s,'river').stores);
 on.m.settleNode(on.s,'river');off.m.settleNode(off.s,'river');const d=on.coop.data(on.s,'river'),n=on.m.node(on.s,'river'),other=off.m.node(off.s,'river');
 assert.equal(d.last.workers,4);near(d.stores.tools-before.tools,1);near(before.food-d.stores.food,.4);near(n.stores.food-other.stores.food,.4);near(n.stores.tools,other.stores.tools);
 near(on.m.data(on.s,'river').economy.mealInputs.resources.food,on.ctx.CivilPopulation.foodPopulation(n.cohorts)*.12);
 assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=on.ctx.CivilPopulation.workforce(n.cohorts));on.roundtrip();
});
test('each local contract conserves both warehouses and insufficient inventory cannot mint payment or goods',()=>{
 const h=found();h.step(30);const d=h.coop.data(h.s,'river'),n=h.m.node(h.s,'river');
 for(const kind of ['tools','materials']){const before=Object.fromEntries(Object.keys(d.stores).map(k=>[k,d.stores[k]+n.stores[k]]));assert.ok(h.coop.trade(h.s,'river',kind));for(const k of Object.keys(before))near(before[k],d.stores[k]+n.stores[k]);}
 const bad=create();bad.m.node(bad.s,'river').stores.food=1;const before=JSON.stringify(bad.s);assert.equal(bad.coop.found(bad.s,'river'),false);assert.equal(JSON.stringify(bad.s),before);h.roundtrip();
});
test('public procurement protects actual resident food reserves and private stock cannot pay public construction directly',()=>{
 const h=found();h.step(30);const d=h.coop.data(h.s,'river'),n=h.m.node(h.s,'river');n.stores.food=h.m.foodReserve(h.s,'river');
 const before=JSON.stringify(h.s);assert.equal(h.coop.trade(h.s,'river','tools'),false);assert.equal(JSON.stringify(h.s),before);
 assert.ok(d.stores.tools>=2);assert.notEqual(d.stores,n.stores);assert.notEqual(d.stores,h.s.stores);
});
test('depleted raw materials stop production; actual two-way exchange restores it without new capital or residents',()=>{
 const h=found();h.step(330);const d=h.coop.data(h.s,'river');assert.equal(h.coop.productionReady(h.s,'river'),false);const before=clone(d.stores);h.step(30);assert.deepEqual(clone(d.stores),before);
 assert.ok(h.coop.trade(h.s,'river','tools'));assert.ok(h.coop.trade(h.s,'river','materials'));const tools=d.stores.tools;h.step(20);assert.ok(d.stores.tools>tools);h.roundtrip();
});
test('pausing returns existing workers to local planning but preserves ownership, balances and completed sales',()=>{
 const h=found();h.step(30);assert.ok(h.coop.trade(h.s,'river','tools'));assert.ok(h.coop.setEnabled(h.s,'river',false));const d=h.coop.data(h.s,'river'),before=clone(d.stores),cap=h.m.jobCapacity(h.s,'river').smith;
 assert.equal(h.m.node(h.s,'river').workers.coopsmith||0,0);h.step(50);assert.deepEqual(clone(d.stores),before);assert.equal(h.m.jobCapacity(h.s,'river').smith,cap);
 assert.ok(h.coop.setEnabled(h.s,'river',true));h.step(10);assert.ok(d.stores.tools>before.tools);h.roundtrip();
});
test('production cannot spend twice in one settlement and forecasts never alter the authoritative private ledger',()=>{
 const h=found();h.step(10);h.coop.settle(h.s,'river',1);const before=JSON.stringify(h.s);assert.equal(h.coop.settle(h.s,'river',1).meal,0);assert.equal(JSON.stringify(h.s),before);
 h.m.forecast(h.s,'river');const summary=h.coop.summary(h.s,'river');assert.equal(summary.cards.length,6);assert.ok(summary.details.some(row=>row[0]==='公库采购'));assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});
test('native contracts reject repeated stale clicks and history reads never replay ownership or transfers',()=>{
 const h=found();h.step(30);h.s.civilization.pending='cooperative_river';const event=h.coop.event('cooperative_river');assert.ok(event.buttons.trade.onChoose());const after=JSON.stringify(h.s);assert.equal(event.buttons.trade.onChoose(),false);assert.equal(JSON.stringify(h.s),after);
 h.ctx.CivilHistory.snapshot(h.s);assert.equal(JSON.stringify(h.s),after);h.roundtrip();
});
test('original-state reload retains the same private inventories, contracts and aging residents over several years',()=>{
 const a=found();a.step(30);a.coop.trade(a.s,'river','tools');const b=a.roundtrip();a.step(1800);b.step(1800);assert.deepEqual(clone(a.s),clone(b.s));a.roundtrip();
});
test('forged owner references, private balances, output, wages and future transactions are rejected',()=>{
 const h=found();h.step(30);h.coop.trade(h.s,'river','tools');h.roundtrip();
 for(const edit of [d=>d.assetProjectId=999,d=>d.stores.tools+=1,d=>d.totals.tools+=100,d=>d.last.meal+=1,d=>d.last.workers=5,d=>d.trades[0].at=h.s.civilization.elapsed+1,d=>d.controls.push({at:d.foundedAt,enabled:true})]){const bad=clone(h.s);edit(bad.civilization.cooperative.nodes.river);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});

test('standing contracts are opt-in, bounded and use actual bilateral inventory over several generations',()=>{
 const h=found();h.step(300);const d=h.coop.data(h.s,'river');assert.equal(d.standing,undefined);assert.equal(d.trades.length,0);
 const before=JSON.stringify(d.stores);assert.ok(h.coop.setContract(h.s,'river',true));assert.equal(JSON.stringify(d.stores),before);
 h.step(3600);assert.ok(d.trades.some(t=>t.standing&&t.kind==='tools'));assert.ok(d.trades.some(t=>t.standing&&t.kind==='materials'));assert.ok(d.totals.tools>25);
 for(const kind of ['tools','materials']){const rows=d.trades.filter(t=>t.kind===kind&&t.standing);for(let i=1;i<rows.length;i++)assert.ok(rows[i].at-rows[i-1].at>=30);}
 assert.ok(d.trades.length<=240);h.roundtrip();
});
test('contract pause and production pause stop automatic payment; resuming never drains a backlog',()=>{
 const h=found();h.coop.setContract(h.s,'river',true);h.step(180);const d=h.coop.data(h.s,'river');
 h.coop.setContract(h.s,'river',false);const count=d.trades.length;h.step(300);assert.equal(d.trades.length,count);
 h.coop.setContract(h.s,'river',true);h.step(29);assert.equal(d.trades.length,count);h.step(11);assert.ok(d.trades.length-count<=2);
 h.coop.setEnabled(h.s,'river',false);const stopped=d.trades.length,balance=clone(d.stores);h.step(300);assert.equal(d.trades.length,stopped);assert.deepEqual(clone(d.stores),balance);
 h.coop.setEnabled(h.s,'river',true);h.step(10);assert.ok(d.trades.length-stopped<=2);h.roundtrip();
});
test('standing sales protect public meals and raw material deliveries protect real production reserves',()=>{
 const h=found();h.step(270);h.coop.setContract(h.s,'river',true);const d=h.coop.data(h.s,'river'),n=h.m.node(h.s,'river');
 h.s.civilization.elapsed+=30;n.stores.food=h.m.foodReserve(h.s,'river');n.stores.wood=4;n.stores.scrap=12;
 const before=JSON.stringify(h.s);h.coop.standingTrade(h.s,'river');assert.equal(d.trades.length,0);assert.equal(n.stores.wood,4);assert.equal(n.stores.scrap,12);assert.equal(d.standing.lastAt,h.s.civilization.elapsed);
 const checked=JSON.stringify(h.s);h.coop.standingTrade(h.s,'river');assert.equal(JSON.stringify(h.s),checked);assert.notEqual(checked,before);
 h.s.civilization.elapsed+=30;n.stores.food+=100;n.stores.wood=1000;n.stores.scrap=1000;
 const combined=Object.fromEntries(Object.keys(d.stores).map(k=>[k,n.stores[k]+d.stores[k]]));h.coop.standingTrade(h.s,'river');assert.ok(d.trades.length>0);
 for(const k of Object.keys(combined))near(combined[k],n.stores[k]+d.stores[k]);h.roundtrip();
});
test('standing orders preserve receipts through same-second cancellation and reject forged authorizations or burst trades',()=>{
 const h=found();h.coop.setContract(h.s,'river',true);h.step(600);const d=h.coop.data(h.s,'river');assert.ok(d.trades.length);
 h.s.civilization.elapsed=Math.max(h.s.civilization.elapsed,d.standing.lastAt);h.coop.setContract(h.s,'river',false);h.roundtrip();
 for(const edit of [x=>x.standing.controls[0].enabled=false,x=>x.standing.lastAt=h.s.civilization.elapsed+1,x=>x.trades.find(t=>t.standing).standing=99,x=>x.trades.find(t=>t.standing).at=x.standing.controls[0].at]){const bad=clone(h.s);edit(bad.civilization.cooperative.nodes.river);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
test('standing order forecasts and reloads preserve money-free conservation and future decisions',()=>{
 const a=found();a.coop.setContract(a.s,'river',true);a.step(400);const before=JSON.stringify(a.s);a.m.forecast(a.s,'river');a.ctx.CivilHistory.snapshot(a.s);assert.equal(JSON.stringify(a.s),before);
 const b=a.roundtrip();a.step(1200);b.step(1200);assert.deepEqual(clone(a.s),clone(b.s));a.roundtrip();
});
test('automatic trades do not invalidate an open manual choice but an old policy window cannot resume a new contract',()=>{
 const h=found();h.coop.setContract(h.s,'river',true);h.step(300);h.s.civilization.pending='cooperative_river';const event=h.coop.event('cooperative_river');
 h.s.civilization.elapsed+=30;h.coop.standingTrade(h.s,'river');assert.ok(event.buttons.contract.onChoose());assert.equal(h.coop.contracted(h.s,'river'),false);
 h.s.civilization.pending='cooperative_river';assert.equal(event.buttons.contract.onChoose(),false);assert.equal(h.coop.contracted(h.s,'river'),false);h.s.civilization.pending=null;h.roundtrip();
});

test('city-region reserves cover standing public obligations without counting promised private deliveries as public stock',()=>{
 const h=found(),f=h.m.forecast(h.s,'river'),before=h.metro.reserve(h.s,'river',f);h.coop.setContract(h.s,'river',true);
 const active=h.metro.reserve(h.s,'river',f);near(active.food,before.food+60);near(active.wood,(before.wood||0)+40);near(active.scrap,(before.scrap||0)+120);
 h.coop.setContract(h.s,'river',false);assert.deepEqual(clone(h.metro.reserve(h.s,'river',f)),clone(before));h.roundtrip();
});
