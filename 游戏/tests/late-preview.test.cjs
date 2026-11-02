const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Mac轨道测绘与国家文案恢复118.json'))).data,'base64'))).state;
test('late preview preserves current economic results across a budget boundary without copying old payment histories',()=>{
 const h=harness(raw),before=JSON.stringify(h.s),full=clone(h.s),short=h.ctx.CivilForecast.copy(h.s);
 assert.equal(short.civilization.finance.orders.length,full.civilization.finance.orders.length);
 assert.ok(short.civilization.finance.periods.every(p=>p.endsAt>=h.s.civilization.elapsed-1200||p.adminPayments.length<=2));
 for(let n=0;n<70;n++){
  for(const s of [full,short]){s.civilization.elapsed+=10;h.ctx.Civilization.settleEconomy(s);}
  assert.deepEqual(clone(short.stores),clone(full.stores));
  assert.deepEqual(clone(short.civilization.urban.economy),clone(full.civilization.urban.economy));
  assert.deepEqual(clone(short.civilization.metro),clone(full.civilization.metro));
  assert.deepEqual(clone(short.civilization.regions.nodes),clone(full.civilization.regions.nodes));
  assert.equal(h.ctx.CivilCorridor.profile(short)?.baseDuration,h.ctx.CivilCorridor.profile(full)?.baseDuration);
 }
 assert.equal(JSON.stringify(h.s),before);
});
