const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
const original=JSON.parse(fs.readFileSync('tests/fixtures/natural-local-industry.json','utf8')).state;
function create(){const h=harness(original);h.p=h.ctx.CivilPlanning;return h;}
test('old local-industry saves stay unchanged and construction planning remains unavailable before local town consent',()=>{
 const h=create(),before=JSON.stringify(h.s);h.p.tick(h.s);h.roundtrip();assert.equal(JSON.stringify(h.s),before);assert.equal(h.s.civilization.planning,undefined);
 assert.equal(h.p.enqueue(h.s,'home','services','waterworks'),false);assert.equal(h.p.enqueue(h.s,'missing','municipal','farmland'),false);assert.equal(h.p.enqueue(h.s,'highland','municipal','farmland'),false);assert.equal(h.p.enqueue(h.s,'rail','services','passengerfleet'),false);assert.equal(JSON.stringify(h.s),before);
});
test('six explicit pending orders neither prepay materials nor add people or capacity, and commitments respect facility limits',()=>{
 const h=create(),n=h.s.civilization.regions.nodes.rail,before=JSON.stringify([h.s.stores,n.stores,n.cohorts,h.m.data(h.s,'rail')]);
 for(const type of ['farmland','farmland','clinic','clinic','clinic','clinic'])assert.ok(h.p.enqueue(h.s,'rail','municipal',type));
 assert.equal(h.p.enqueue(h.s,'rail','municipal','school'),false);assert.equal(JSON.stringify([h.s.stores,n.stores,n.cohorts,h.m.data(h.s,'rail')]),before);h.roundtrip();
 const g=create();assert.ok(g.p.enqueue(g.s,'rail','municipal','meetinghall')===false,'already capped real hall cannot be queued');
 assert.ok(g.p.enqueue(g.s,'rail','municipal','scrubber'));assert.equal(g.p.enqueue(g.s,'rail','municipal','scrubber'),false,'one active and one queued reaches the real two-unit cap');
});
test('pause and cancellation affect only pending intentions and never refund or stop the existing paid project',()=>{
 const h=create();assert.ok(h.p.enqueue(h.s,'rail','municipal','farmland'));assert.ok(h.p.enqueue(h.s,'rail','municipal','clinic'));
 const originalProject=JSON.stringify(h.m.data(h.s,'rail').project),stores=JSON.stringify(h.s.stores);
 assert.ok(h.p.setEnabled(h.s,'rail',false));assert.ok(h.p.cancel(h.s,'rail',1));assert.equal(h.p.cancel(h.s,'rail',1),false);h.p.tick(h.s);
 assert.equal(JSON.stringify(h.m.data(h.s,'rail').project),originalProject);assert.equal(JSON.stringify(h.s.stores),stores);assert.equal(h.p.queued(h.s,'rail')[0].type,'clinic');h.roundtrip();
});
test('the existing cart and builders execute a mixed municipal and public-service plan in FIFO order across reload without duplicate starts',()=>{
 const h=create();assert.ok(h.p.enqueue(h.s,'rail','municipal','farmland'));assert.ok(h.p.enqueue(h.s,'rail','services','districtschool'));h.roundtrip();
 h.until(()=>h.p.data(h.s,'rail').orders[0].status==='started',4000);
 const first=h.p.data(h.s,'rail').orders[0],oldScrubber=h.m.data(h.s,'rail').completed.find(p=>p.type==='scrubber');
 assert.ok(first.startedAt>=oldScrubber.completedAt);assert.equal(h.m.data(h.s,'rail').project.id,first.projectId);assert.equal(h.p.data(h.s,'rail').orders[1].status,'queued');
 const reload=h.roundtrip(),p=reload.ctx.CivilPlanning,before=JSON.stringify(reload.s);p.tick(reload.s);assert.equal(JSON.stringify(reload.s),before);
 reload.until(()=>p.data(reload.s,'rail').orders[1].status==='started',4000);
 const second=p.data(reload.s,'rail').orders[1],farm=reload.m.data(reload.s,'rail').completed.find(x=>x.id===first.projectId);
 assert.ok(second.startedAt>=farm.completedAt);assert.equal(reload.v.data(reload.s,'rail').project.type,'districtschool');assert.equal(reload.v.data(reload.s,'rail').project.id,second.projectId);
 reload.until(()=>reload.v.data(reload.s,'rail').project.status==='complete',5000);
 assert.equal(reload.m.data(reload.s,'rail').buildings.farmland,original.civilization.municipal.nodes.rail.buildings.farmland+1);assert.equal(reload.v.data(reload.s,'rail').buildings.districtschool,1);
 assert.ok(reload.v.data(reload.s,'rail').project.receipts.length>0);assert.equal(p.cancel(reload.s,'rail',second.id),false);reload.roundtrip();
});
test('a stopped queue survives current construction finishing and resumes one real project rather than backfilling several',()=>{
 const h=create();h.p.enqueue(h.s,'rail','municipal','farmland');h.p.enqueue(h.s,'rail','municipal','clinic');h.p.setEnabled(h.s,'rail',false);
 h.until(()=>h.m.data(h.s,'rail').project.status==='complete',4000);h.step(120);assert.equal(h.p.queued(h.s,'rail').length,2);
 h.p.setEnabled(h.s,'rail',true);h.p.tick(h.s);assert.equal(h.p.queued(h.s,'rail').length,1);const before=JSON.stringify(h.s);h.p.tick(h.s);assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});
test('loss of local consent blocks the first item and a temporary unavailable prerequisite never silently skips to a later order',()=>{
 const h=create();h.p.enqueue(h.s,'rail','municipal','farmland');h.p.enqueue(h.s,'rail','municipal','clinic');const n=h.s.civilization.regions.nodes.rail,relation=n.relation;n.relation='trade';
 const before=JSON.stringify(h.s);h.p.tick(h.s);assert.equal(JSON.stringify(h.s),before);assert.match(h.p.reason(h.s,'rail'),/共同营建/);n.relation=relation;
 // Isolated prerequisite case: a paused service gate cannot be bypassed by a subsequent municipal order.
 const owner=h.p.owner('municipal'),gate=owner.facilityGate.bind(owner);owner.facilityGate=(s,id,type)=>type==='farmland'?false:gate(s,id,type);
 h.until(()=>h.m.data(h.s,'rail').project.status==='complete',4000);assert.equal(h.p.queued(h.s,'rail').length,2);assert.match(h.p.reason(h.s,'rail'),/首项条件/);
 owner.facilityGate=gate;h.p.cancel(h.s,'rail',1);h.p.tick(h.s);assert.equal(h.m.data(h.s,'rail').project.type,'clinic');h.roundtrip();
});
test('invalid plan order references, future dates, excess queued rows and duplicate IDs are rejected instead of replayed',()=>{
 const h=create();h.p.enqueue(h.s,'rail','municipal','farmland');h.p.enqueue(h.s,'rail','municipal','clinic');h.roundtrip();
 for(const change of [d=>d.orders[0].id=9,d=>d.orders[0].queuedAt=h.s.civilization.elapsed+1,d=>d.orders[0].owner='home',d=>d.orders[0].type='madeup',d=>d.orders[0].projectId=4,d=>d.orders[0].cancelledAt=h.s.civilization.elapsed,d=>d.enabled='yes',d=>{d.orders[0].status='started';d.orders[0].startedAt=h.s.civilization.elapsed;d.orders[0].projectId=999;},d=>{for(let i=3;i<=7;i++)d.orders.push({...d.orders[0],id:i});d.nextId=8;}]){const bad=clone(h.s);change(bad.civilization.planning.nodes.rail);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
