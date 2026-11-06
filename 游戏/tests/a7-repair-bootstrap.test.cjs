// Constructed cases on an immutable natural shortage; no simulated test time is natural evidence.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),{harness}=require('./helpers/metro-fixture.cjs');
const file=path.resolve(__dirname,'../../验证/A7收口/industry/repair-bootstrap-candidate/战后文明-存档.json');
function sample(){const e=JSON.parse(fs.readFileSync(file));return harness((e.encoding?JSON.parse(z.gunzipSync(Buffer.from(e.data,'base64'))):e).state);}
function period(h,version=1){const p=h.ctx.CivilPolity,d=p.copy(h.s.civilization.polity),e={at:(Math.floor(d.at/60)+d.periods+1)*60,action:'period',args:{},sources:p.sources(h.s),equipmentVersion:1,repairProductionVersion:version};if(version===undefined)delete e.repairProductionVersion;return{d,e};}
test('a funded partial restart makes its first repair parts from existing iron, tools and public posts',()=>{
 const h=sample(),p=h.ctx.CivilPolity,{d,e}=period(h);for(const pair of Object.values(d.world.foreign.pairs))pair.phase='truce';d.world.nodes.north.infrastructure=75;d.world.nodes.north.stores.parts=0;d.world.nodes.north.stores.coal=0;
 const old=p.copy(d),base={...e};delete base.repairProductionVersion;const legacy=p.reduce(old,base),next=p.reduce(d,e),n=next.d.world.nodes.north,prior=legacy.d.world.nodes.north;
 const spent=key=>(next.d.public.consumed[key]||0)-(legacy.d.public.consumed[key]||0);assert.ok(Math.abs(n.stores.parts-prior.stores.parts+spent('parts')-2)<1e-9,'the new parts also fund existing real equipment upkeep');assert.equal(spent('iron'),12);assert.ok(spent('tools')>=4);assert.ok(spent('knowledge')>=4);assert.equal(n.stores.coal,prior.stores.coal);
 assert.equal(next.d.public.produced.parts-legacy.d.public.produced.parts,2);assert.equal(next.d.industry.north.used,8);assert.deepEqual({...next.effects.north},{...legacy.effects.north});assert.equal(n.population,prior.population);assert.equal(n.casualties,prior.casualties);
});
test('emergency repair output is bounded and needs actual materials, while war, ruined facilities and revoked institutions stop it',()=>{
 const h=sample(),p=h.ctx.CivilPolity;
 for(const change of [d=>d.enabled=false,d=>d.world.nodes.north.infrastructure=59,d=>d.world.foreign.pairs['north-west'].phase='war',d=>d.world.foreign.aftermath.plans.north.mode='services',d=>d.world.nodes.north.stores.parts=24,d=>{d.world.nodes.north.stores.iron=0;d.cargo=[];}]){
  const {d,e}=period(h);for(const pair of Object.values(d.world.foreign.pairs))pair.phase='truce';d.world.nodes.north.infrastructure=75;change(d);const before=d.public.produced.parts||0;p.reduce(d,e);assert.equal(d.public.produced.parts||0,before);
 }
});
test('new periodic receipts opt into repair production, legacy versions and non-period forged flags are rejected',()=>{
 const h=sample(),p=h.ctx.CivilPolity;h.roundtrip();const elapsed=h.s.civilization.elapsed;h.step(120,{checkEvery:0});const rows=h.s.civilization.polity.records.filter(r=>r.at>elapsed&&r.action==='period');assert.ok(rows.length>=2);assert.ok(rows.every(r=>r.repairProductionVersion===1));h.roundtrip();
 const copy=JSON.parse(JSON.stringify(h.s));copy.civilization.pacingVersion=1;assert.throws(()=>p.validate(copy),/维修生产版本/);
 const {d,e}=period(h,2);assert.throws(()=>p.reduce(d,e),/版本/);e.repairProductionVersion=1;e.action='pause';e.args={enabled:false};assert.throws(()=>p.reduce(d,e),/版本/);
});
