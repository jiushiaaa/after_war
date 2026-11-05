// Constructed finite-world checks, not natural evidence.
const test=require('node:test'),assert=require('node:assert/strict');
const {equipped}=require('./helpers/future-fixture.cjs');
test('an unchanged old native save retains version 1, and a paid upgrade replays with the same sources',()=>{
 const h=require('./helpers/polity-fixture.cjs').start(408),F=h.ctx.CivilFuture;
 h.roundtrip();assert.equal(F.data(h.s).careMandate.version,1);assert.equal(F.reason(h.s,'commission',{version:2}),null);
 assert.ok(F.act(h.s,'commission',{version:2}));assert.equal(F.data(h.s).careMandate.version,2);h.roundtrip();
});
test('clinical expansion is separately paid and leaves old mandates and existing assets unchanged',()=>{
 const h=equipped(),f=h.f,assets=JSON.stringify(f.assets),before={...f.stock};
 assert.equal(h.F.facilityLimit(f,'clinic'),2);assert.equal(f.careMandate.version,1);
 h.act('commission',{version:2});assert.equal(h.F.facilityLimit(f,'clinic'),4);assert.equal(JSON.stringify(f.assets),assets);
 for(const [k,n]of Object.entries({parts:24,knowledge:60,tools:12}))assert.equal(f.stock[k],before[k]-n);
 const paid=JSON.stringify(f);assert.throws(()=>h.act('commission',{version:2}),/已完成/);assert.equal(JSON.stringify(f),paid);
 assert.throws(()=>h.act('commission',{version:3}),/未知/);
});
test('expanded clinical jobs actually produce and ship surplus medicine, with finite inputs and conserved stock',()=>{
 const h=equipped();h.ready('restoration');h.build('garden');h.build('workshop');h.build('solar');h.act('commission',{version:2});h.build('clinic');h.build('clinic');h.build('clinic');
 assert.equal(h.f.assets.clinic,4);assert.throws(()=>h.act('build',{id:'clinic'}),/上限/);
 h.act('policy',{key:'method',value:'clinical'});h.act('policy',{key:'exportPolicy',value:'contribute'});h.step(180);
 assert.ok(h.f.cargo.some(p=>p.direction==='out'&&p.goods.medicine>0&&p.arrivedAt!==null));
 assert.ok(h.f.careMandate.produced>0&&h.f.book.consumed.culture>0);assert.ok(h.f.last.fed&&h.f.last.treated);
 assert.ok(h.f.last.workers.care<=Math.ceil(h.P.counts(h.f).total/40)+32);
 for(const k of Object.keys(h.f.stock)){const b=h.f.book;assert.ok(Math.abs(h.f.stock[k]-(b.received[k]||0)-(b.produced[k]||0)+(b.consumed[k]||0)+(b.sent[k]||0))<1e-6,k);}
 const produced=h.f.careMandate.produced;h.act('policy',{key:'power',value:'off'});h.step(90);assert.equal(h.f.last.powered,false);const off=h.f.careMandate.produced;h.step(5);assert.equal(h.f.careMandate.produced,off);assert.ok(off>=produced);
});
