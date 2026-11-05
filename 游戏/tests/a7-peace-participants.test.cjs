// Constructed integration cases; never counted as natural play.
const test=require('node:test'),assert=require('node:assert/strict');const{start}=require('./helpers/polity-fixture.cjs');
function sample(){const h=start(409),d=h.s.civilization.polity,w=d.world;delete w.foreign.aftermath;for(const n of Object.values(w.nodes))n.casualties=0;for(const p of Object.values(w.foreign.pairs))p.phase='calm';w.foreign.network.fronts=[{pair:'desert-north',status:'ceasefire',history:[{at:h.s.civilization.elapsed-600}]}];return{...h,d,w};}
test('new funded peace protocol includes actual zero-casualty belligerents, never untouched neighbors',()=>{
 const h=sample(),{ctx,d,w,s}=h;ctx.CivilEquipment.open(d,{equipmentVersion:1});const at=s.civilization.elapsed;d.enabled=true;d.lastService={paid:true,at};const before=JSON.stringify(w.foreign.network.fronts),stock=w.nodes.north.stores.knowledge;
 ctx.CivilPolityForeign.action(d,{action:'protocol',args:{mode:'aftermath'},equipmentVersion:1,participationVersion:1,at},{});
 assert.equal(w.foreign.aftermath.participationVersion,1);assert.deepEqual(Array.from(ctx.CivilAftermath.actors(w)),['desert','north']);assert.equal(w.nodes.north.stores.knowledge,stock-ctx.CivilAftermathContent.costs.open.knowledge);assert.equal(JSON.stringify(w.foreign.network.fronts),before);assert.ok(Object.values(w.nodes).every(n=>n.casualties===0));assert.equal(ctx.CivilAftermath.localReason(w,'conference',{},at),null);
});
test('legacy paid protocols retain their original participant rule and reject forged versions',()=>{
 const {ctx,d,w,s}=sample(),at=s.civilization.elapsed;d.enabled=true;d.lastService={paid:true,at};ctx.CivilPolityForeign.action(d,{action:'protocol',args:{mode:'aftermath'},equipmentVersion:1,at},{});assert.equal(w.foreign.aftermath.participationVersion,undefined);assert.deepEqual(Array.from(ctx.CivilAftermath.actors(w)),[]);
 delete w.foreign.aftermath;assert.throws(()=>ctx.CivilAftermath.validateRecord(w,{action:'open',at,participationVersion:1,cost:ctx.CivilAftermathContent.costs.open}),/版本/);
});
test('alliance UI reports the actual cooldown while a rejected proposal spends nothing',()=>{
 const {ctx,d,w,s}=sample(),at=s.civilization.elapsed,key='desert-north';w.foreign.leagues.pacts=w.foreign.leagues.pacts.filter(p=>p.pair!==key);w.foreign.leagues.pacts.push({pair:key,status:'ended',endedAt:at-20});const before=JSON.stringify(d);assert.throws(()=>ctx.CivilPolityForeign.invoke(d,'leagues','offer',{pair:key,type:'commerce'},at),/冷静1800秒/);assert.equal(JSON.stringify(d),before);
});
test('a new request records its participation version explicitly; the unchanged natural source replays before and after',()=>{
 const fs=require('node:fs'),z=require('node:zlib'),{harness}=require('./helpers/metro-fixture.cjs');const r=JSON.parse(fs.readFileSync('../验证/A7/7-全流程/industry/nation/341_industrial_actual_losses/战后文明-存档.json')),s=(r.encoding?JSON.parse(z.gunzipSync(Buffer.from(r.data,'base64'))):r).state,h=harness(s);h.roundtrip();const c=h.s.civilization,p=h.ctx.CivilPolity;assert.equal(p.reason(h.s,'protocol',{mode:'aftermath'}),null);assert.ok(p.act(h.s,'protocol',{mode:'aftermath'}));assert.equal(c.polity.records.at(-1).participationVersion,1);assert.equal(c.polity.world.foreign.aftermath.participationVersion,1);h.roundtrip();
});
