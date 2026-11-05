const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {harness}=require('./helpers/metro-fixture.cjs');
const source=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/A7/7-全流程/public/rail-before/战后文明-存档.json')));
const original=(source.encoding?JSON.parse(z.gunzipSync(Buffer.from(source.data,'base64'))):source).state,copy=x=>JSON.parse(JSON.stringify(x));
// These are constructed continuations of an actual observed shortage, not natural-play evidence.
function start(){const h=harness(original);h.c=h.ctx.CivilConurbation;h.d=h.c.data(h.s);return h;}
function specialize(h){assert.ok(h.ctx.CivilCityInstitutions.set(h.s,'canal','profile','workshop'));}
test('new electrified departures preserve all old trip timings and need real complementary production',()=>{
 const h=start(),before=copy(h.d.trips);h.ctx.CivilPlatform.validate(h.s);assert.match(h.c.dispatchReason(h.s),/互补/);
 specialize(h);h.until(()=>h.c.reliefReason(h.s)===null,6000);assert.ok(h.c.relief(h.s));const p=h.d.trips.at(-1);
 assert.equal(h.c.crew(h.s,'canal'),6);assert.equal(h.c.crew(h.s,'lake'),0);assert.deepEqual(copy(p.back),{});
 assert.equal(p.railVersion,1);assert.equal(p.remaining,45);assert.equal(p.fees.home.food,6*.12*90/10);assert.deepEqual(copy(h.d.trips.slice(0,before.length)),before);
 h.step(20);const loaded=h.roundtrip();loaded.step(25);const q=loaded.s.civilization.conurbation.trips.at(-1);assert.equal(q.deliveredAt,q.startedAt+45);assert.equal(q.remaining,45);
 loaded.step(45);assert.equal(q.finishedAt,q.startedAt+90);assert.equal(q.status,'complete');loaded.roundtrip();
});
test('a recalled relief shipment returns only its real cargo after the travelled leg, with fees retained',()=>{
 const h=start();specialize(h);h.until(()=>h.c.reliefReason(h.s)===null,6000);assert.ok(h.c.relief(h.s));const p=h.d.trips.at(-1),fees=copy(p.fees),home=h.c.local(h.s,'canal'),received=copy(home.budget.received);
 assert.equal(h.c.relief(h.s),false);h.step(20);assert.ok(h.c.suspend(h.s,true));assert.equal(p.remaining,20);assert.equal(p.status,'recalled');h.roundtrip();h.step(19);assert.equal(p.status,'recalled');h.step(1);assert.equal(p.status,'returned');
 for(const [k,n]of Object.entries(p.out))assert.ok(Math.abs((home.budget.received[k]||0)-(received[k]||0)-n)<1e-6);assert.deepEqual(copy(p.fees),fees);assert.equal(h.c.crew(h.s,'canal'),0);h.roundtrip();
});
test('a funded tools delivery can enter a short workshop without exporting its survival reserves',()=>{
 const h=start(),c=h.c,n=h.d.node;assert.ok(n.stores.tools<32&&n.stores.tools>=2);
 assert.ok(c.safe(h.s,'lake',{tools:2},6));assert.equal(c.safe(h.s,'lake',{tools:2},6,true),null);
 assert.ok(c.safe(h.s,'lake',{tools:n.stores.tools+1},6,true));assert.ok(c.safe(h.s,'lake',{food:n.stores.food},6,true));
 const legacy=copy(h.s);delete legacy.civilization.polishVersion;assert.ok(c.safe(legacy,'lake',{tools:2},6,true));
 const off=copy(h.s);off.civilization.modern.last.traction=false;assert.match(c.dispatchReason(off),/停运/);assert.equal(c.travelTime(off),180);
});
test('actual specialization, bounded electric freight and paid expansion recover the observed city',()=>{
 const h=start(),oldTrips=h.d.trips.length;specialize(h);for(let i=0;i<6000&&h.c.workshopReason(h.s,'timber')!==null;i++){if(h.c.reliefReason(h.s)===null)assert.ok(h.c.relief(h.s));h.step(1);}assert.equal(h.c.workshopReason(h.s,'timber'),null);
 const before=copy(h.d.node.stores);assert.ok(h.c.workshop(h.s,'timber'));for(const [k,v]of Object.entries(h.c.workshopCosts.timber))assert.ok(Math.abs(h.d.node.stores[k]-(before[k]-v))<1e-6);
 h.until(()=>h.d.workshop.completedAt!==null,1200);h.step(1800,{checkEvery:600});assert.equal(h.d.node.health,100);assert.equal(h.d.node.stable,600);assert.ok(h.d.trips.length>oldTrips);h.roundtrip();
 for(const change of [s=>{s.civilization.conurbation.trips.at(-1).railVersion=2;},s=>{s.civilization.conurbation.trips.at(-1).railAt++;},s=>{s.civilization.conurbation.trips.at(-1).fees.home.food++;}]){const bad=copy(h.s);change(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
test('an industrial repair load pays real steel and recovers without a food barter surplus',()=>{
 const envelope=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/A7/7-全流程/industry/steel-update/战后文明-存档.json'))),s=(envelope.encoding?JSON.parse(z.gunzipSync(Buffer.from(envelope.data,'base64'))):envelope).state;
 const h=harness(s),c=h.ctx.CivilConurbation,d=c.data(h.s),before=copy(d.trips);h.ctx.CivilPlatform.validate(h.s);assert.equal(d.node.stores.iron,0);assert.ok(c.dispatchReason(h.s));
 assert.ok(h.ctx.CivilCityInstitutions.set(h.s,'yards','profile','provisioning'));h.until(()=>c.reliefReason(h.s)===null,6000);
 const source=c.local(h.s,'yards'),stock=copy(source.stores);assert.ok(c.relief(h.s));const trip=d.trips.at(-1);assert.equal(trip.reliefVersion,2);assert.equal(trip.out.iron,48);assert.ok(Math.abs(source.stores.iron-stock.iron+48)<1e-6);assert.deepEqual(copy(d.trips.slice(0,before.length)),before);
 h.step(45);assert.equal(trip.deliveredAt,trip.startedAt+45);assert.equal(c.workshopReason(h.s,'iron'),null);const received=copy(d.node.stores);assert.ok(c.workshop(h.s,'iron'));for(const[k,v]of Object.entries(c.workshopCosts.iron))assert.ok(Math.abs(d.node.stores[k]-received[k]+v)<1e-6);
 h.until(()=>d.workshop.completedAt!==null,1200);h.step(1800,{checkEvery:600});assert.equal(d.node.health,100);assert.equal(d.node.stable,600);h.roundtrip();
 const bad=copy(h.s);bad.civilization.conurbation.trips.find(p=>p.reliefVersion===2).out.iron=49;assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
});
