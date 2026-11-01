const {test}=require('node:test');const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync('tests/fixtures/natural-trade-return-bottleneck.json','utf8')).state;
const create=()=>{const h=harness(raw);h.a=h.ctx.CivilRelief;return h;};
function dispatched(){const h=create();assert.equal(h.a.request(h.s,'rail'),true);h.until(()=>h.a.active(h.s,'rail')?.status==='outbound',1500);return h;}
test('relief is optional for old saves and requests are unpaid, finite and independently cancellable',()=>{
 const h=create(),before=JSON.stringify(h.s);assert.equal(h.a.data(h.s),undefined);h.roundtrip();assert.equal(JSON.stringify(h.s),before);
 const stores=JSON.stringify(h.s.stores);assert.ok(h.a.request(h.s,'rail'));assert.equal(h.a.request(h.s,'rail'),false);assert.equal(JSON.stringify(h.s.stores),stores);h.roundtrip();assert.ok(h.a.cancel(h.s,1));assert.equal(h.a.cancel(h.s,1),false);assert.equal(JSON.stringify(h.s.stores),stores);h.roundtrip();
});
test('a real original cart delivers paid relief once, without a local reserve, then returns empty over the full route',()=>{
 const h=dispatched(),{s,a}=h,o=a.active(s,'rail'),p=s.civilization.regions.shipments.find(p=>p.purpose==='relief');
 assert.deepEqual(clone(o.cargo),{food:112,tools:12,coal:4});assert.deepEqual(clone(o.paid),{food:113,tools:12,coal:4,wood:1,parts:.05});assert.equal(p.remaining,90);
 assert.equal(h.r.launch(s,'rail'),false);assert.equal(a.arrive(s,p),false);h.roundtrip();
 h.step(89);assert.equal(o.deliveredAt,null);const n=s.civilization.regions.nodes.rail,before={...n.stores};h.step(1);assert.equal(o.status,'empty');
 for(const[k,v]of Object.entries(o.cargo))near(n.stores[k],before[k]+v);assert.equal(p.remaining,90);const saved=JSON.stringify(s);assert.equal(a.arrive(s,{...p}),false);assert.equal(JSON.stringify(s),saved);h.roundtrip();
 h.step(89);assert.equal(o.status,'empty');h.step(1);assert.equal(o.status,'complete');assert.equal(s.civilization.regions.shipments.includes(p),false);h.roundtrip();
});
test('unpaid relief cannot launch, and early or copied arrival cannot generate a delivery',()=>{
 const h=create(),{s,a}=h;assert.ok(a.request(s,'rail'));s.stores.food=0;const before=JSON.stringify(s);assert.equal(a.launch(s,'rail'),false);assert.equal(s.stores.food,0);assert.equal(a.active(s,'rail').paid,null);
 const x=dispatched(),p=x.s.civilization.regions.shipments.find(p=>p.purpose==='relief');p.remaining=0;assert.equal(x.a.arrive(x.s,p),false);assert.throws(()=>x.ctx.CivilPlatform.validate(x.s));
});
test('active relief can return only its actual cargo, retaining journey fees and its original travel time',()=>{
 const h=dispatched(),{s,a}=h,o=a.active(s,'rail');h.step(23);const p=s.civilization.regions.shipments.find(p=>p.purpose==='relief');assert.ok(a.requestReturn(s,o.id));assert.equal(p.remaining,23);assert.equal(a.requestReturn(s,o.id),false);h.roundtrip();h.step(22);assert.equal(o.refundAt,null);
 const credits=[],credit=h.r.credit.bind(h.r);h.r.credit=(stores,cargo)=>{if(stores===s.stores)credits.push(clone(cargo));return credit(stores,cargo);};h.step(1);assert.equal(o.status,'cancelled');assert.deepEqual(credits,[{food:112,tools:12,coal:4}]);assert.equal(a.arrive(s,p),false);h.roundtrip();
});
test('closed roads and missing actual transport workers hold the same relief cart and preserve its cargo',()=>{
 const h=dispatched(),{s,a}=h,p=s.civilization.regions.shipments.find(p=>p.purpose==='relief');h.r.setRoad(s,'rail',false);h.step(11);assert.equal(p.remaining,90);assert.ok(a.requestReturn(s,p.reliefOrderId));h.step(5);assert.equal(p.remaining,1);assert.equal(a.order(s,p).refundAt,null);h.r.setRoad(s,'rail',true);s.game.workers.transporter=0;h.step(5);assert.equal(p.remaining,1);h.roundtrip();
});
test('relief save validation rejects orphan, counterfeit and duplicate bookkeeping',()=>{
 const h=dispatched();for(const change of [s=>delete s.civilization.relief,s=>s.civilization.relief.orders[0].paid.food++,s=>s.civilization.relief.orders[0].cargo.food++,s=>s.civilization.relief.orders[0].status='complete',s=>s.civilization.regions.shipments.find(p=>p.purpose==='relief').reliefOrderId++]){const bad=clone(h.s);change(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
test('the original zero-health crisis recovers through at most six real relief carts, actual housing work and paid local tool production',()=>{
 const original=JSON.parse(fs.readFileSync('tests/fixtures/natural-relief-crisis.json','utf8')).state,h=harness(original),{s}=h,a=h.ctx.CivilRelief,n=s.civilization.regions.nodes.rail;
 assert.deepEqual(clone(s),original);const payments=[];const launch=a.launch.bind(a);a.launch=(state,id)=>{const before={...state.stores},ok=launch(state,id);if(ok){const o=a.active(state,id);for(const[k,v]of Object.entries(o.paid))near(before[k]-state.stores[k],v);payments.push(clone(o.paid));}return ok;};
 let requests=0,stage=0,finished=false;const initialCensus=n.population;
 for(let i=0;i<7000;i++){
  if(requests<6&&!a.active(s,'rail')&&(n.health<60||(n.stores.tools||0)<5)){assert.ok(a.request(s,'rail'));requests++;}
  const m=h.m.data(s,'rail');if(m.project.status==='complete'&&stage<2){assert.ok(h.m.startProject(s,'rail',['toolworks','salvageyard'][stage]));stage++;}
  h.step(1);
  if(stage===2&&m.project.status==='complete'&&!a.active(s,'rail')){finished=true;break;}
 }
 assert.ok(finished,'finite real deliveries must unlock the original construction and paid recovery industry');assert.equal(requests,6);assert.equal(payments.length,6);
 for(const key of ['food','tools','coal'])near(payments.reduce((n,p)=>n+p[key],0),{food:678,tools:72,coal:24}[key]);
 const m=h.m.data(s,'rail');assert.equal(m.buildings.toolworks,1);assert.equal(m.buildings.salvageyard,1);assert.equal(m.completed.find(p=>p.id===12).type,'blockhousing');assert.equal(n.health,100);assert.ok(n.population>initialCensus,'births resume through the existing paid population owner');
 h.roundtrip();
 const stable={food:n.stores.food,tools:n.stores.tools};for(let i=0;i<1200;i++){h.step(1);assert.ok(n.health>=99);assert.ok(n.stores.food>0);assert.ok(n.stores.tools>0);}
 assert.equal(a.data(s).orders.length,6);assert.ok(n.stores.food>=stable.food);assert.ok(n.stores.tools>=stable.tools);h.roundtrip();
});
test('a real existing 64-load uses its smaller finite pack and invalid target requests do nothing',()=>{
 const h=create(),{s,a}=h;const before=JSON.stringify(s);assert.equal(a.request(s,'unknown'),false);assert.equal(JSON.stringify(s),before);
 assert.ok(a.request(s,'highland'));assert.deepEqual(clone(a.active(s,'highland').cargo),{food:56,tools:6,coal:2});h.roundtrip();
});

test('relief history distinguishes unpaid requests, actual dispatch, delivery and refunds without changing accounts',()=>{
 const h=dispatched(),o=h.a.active(h.s,'rail'),history=h.ctx.CivilHistory;let before=JSON.stringify(h.s),entries=history.snapshot(h.s).entries.filter(e=>e.category==='relief');assert.equal(entries.length,2);assert.equal(JSON.stringify(h.s),before);
 assert.equal(entries.find(e=>e.key==='relief_1_dispatch').at,o.dispatchedAt);assert.ok(h.a.requestReturn(h.s,o.id));h.step(1);before=JSON.stringify(h.s);entries=history.snapshot(h.s).entries.filter(e=>e.category==='relief');assert.equal(entries.length,4);assert.ok(!entries.some(e=>e.key.endsWith('_delivery')));assert.equal(JSON.stringify(h.s),before);
});

test('a queued relief request remains cancellable from the native regional event after reception permission changes',()=>{
 const h=create();assert.ok(h.a.request(h.s,'rail'));h.s.civilization.regions.nodes.rail.relation='trade';
 const event=h.r.event('regionRail',(text,fn)=>()=>fn?.());assert.ok(event.buttons.cancelRelief);assert.equal(h.a.launch(h.s,'rail'),false);event.buttons.cancelRelief.onChoose();assert.equal(h.a.data(h.s).orders[0].status,'cancelled');
});
