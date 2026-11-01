// Independent rule replay, never connected to the natural browser or save writer.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {harness,clone}=require('../游戏/tests/helpers/metro-fixture.cjs');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'存档/自然游玩_Windows加盟道路竣工新商路往返73.json')));
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(p.data,'base64'))).state;
for(const structure of ['federation','empire'])for(const charter of ['constitution','custom'])for(const devolution of ['central','local']){
  const h=harness(raw),{s,ctx}=h,start=s.civilization.elapsed,materials=clone(s.civilization.corridor.consumed),orders=clone(s.civilization.commerce.orders),founding=s.civilization.nation.foundedAt;let spent=0;
  for(const [axis,value]of Object.entries({structure,charter,devolution}))if(s.civilization.society.axes[axis]!==value){
    h.until(()=>s.civilization.society.reformCooldown===0&&!s.civilization.pending,2400);
    const before=s.stores.knowledge,cost=s.civilization.society.axes.charter==='constitution'?60:30;
    assert.equal(ctx.CivilSociety.beginReform(s,axis),true);assert.equal(before-s.stores.knowledge,cost);spent+=cost;
    ctx.Civilization.showPending();h.click(value);
  }
  h.until(()=>ctx.CivilNation.operational(s)&&ctx.CivilAccession.operational(s),7200);h.step(30);
  assert.ok(ctx.CivilNation.operational(s));assert.ok(ctx.CivilAccession.operational(s));assert.ok(ctx.CivilCorridor.profile(s));
  assert.equal(s.civilization.nation.foundedAt,founding);assert.deepEqual(clone(s.civilization.commerce.orders),orders);assert.deepEqual(clone(s.civilization.corridor.consumed),materials);h.roundtrip();
  console.log(JSON.stringify({structure,charter,devolution,spent,actualSeconds:s.civilization.elapsed-start,legitimacy:s.civilization.nation.legitimacy,load:h.r.load(s),capacity:h.r.capacity(s),roadDuration:ctx.CivilCorridor.profile(s).baseDuration,maintenances:s.civilization.corridor.maintenance.length-raw.civilization.corridor.maintenance.length}));
}
