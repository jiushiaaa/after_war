// Full adapter + immutable original public/industrial worlds. Constructed continuation, not UI evidence.
const test=require('node:test'),assert=require('node:assert/strict');const {start}=require('./helpers/polity-fixture.cjs');
for(const save of [330,350])test('A5 exact population, public warehouse and old-world replay from '+save,()=>{
 const h=start(save),{s,ctx}=h,F=ctx.CivilFuture;ctx.CivilPlatform.validate(s);assert.equal(F.data(s),undefined);
 const world=ctx.CivilCensus.total(s),north=ctx.CivilDomain.known(s),publicStock={...s.civilization.polity.world.nodes.north.stores};assert.equal(F.reason(s,'start'),null);assert.ok(F.act(s,'start'));
 assert.equal(ctx.CivilCensus.total(s),world);assert.equal(ctx.CivilDomain.known(s),north-240);assert.equal(F.count(F.data(s)),240);assert.equal(ctx.CivilPolity.population(s),ctx.CivilDomain.known(s)+ctx.CivilRegional.known(s)+240+Object.entries(s.civilization.polity.peers).filter(([id])=>s.civilization.polity.world.nodes[id].joinedAt!==null).reduce((v,[,p])=>v+ctx.CivilDomain.count(p.local),0));
 for(const key of Object.keys(F.initialSupplies))assert.ok(Math.abs(publicStock[key]-(F.initialSupplies[key]||0)-(F.startCost[key]||0)-s.civilization.polity.world.nodes.north.stores[key])<1e-7,key);
 ctx.CivilPlatform.validate(s);h.step(600,{checkEvery:0});ctx.CivilPlatform.validate(s);assert.ok(F.data(s).cargo.some(p=>p.arrivedAt!==null));assert.ok(F.data(s).book.consumed.food>0);
 const bad=JSON.parse(JSON.stringify(s));bad.civilization.polity.future.cohorts[0].count++;assert.throws(()=>ctx.CivilPlatform.validate(bad),/名册|账|身份/);
 const stock=JSON.parse(JSON.stringify(s));stock.civilization.polity.future.stock.parts++;assert.throws(()=>ctx.CivilPlatform.validate(stock),/公共仓|账/);
 const forged=JSON.parse(JSON.stringify(s));forged.civilization.census.created=1;assert.throws(()=>ctx.CivilPlatform.validate(forged),/人口底账/);
 const orphan=JSON.parse(JSON.stringify(s));orphan.civilization.polity.future.cargo[0].goods.food++;assert.throws(()=>ctx.CivilPlatform.validate(orphan),/公共仓|账/);
 h.roundtrip();
});
