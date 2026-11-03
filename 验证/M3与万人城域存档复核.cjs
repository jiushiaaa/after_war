// Read-only verification of native exports. Never writes or advances the saves.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {harness}=require('../游戏/tests/helpers/metro-fixture.cjs');
const files={
  commons:'存档/自然游玩_M3公共服务路线城市204.json',
  industry:'存档/自然游玩_M3工业路线城市205.json',
  city:'存档/自然游玩_新世界万人城域206.json',
  recovery:'存档/自然游玩_万人城域水务恢复207.json'
};
const summaries={},states={};
for(const [key,file]of Object.entries(files)){
  const bytes=fs.readFileSync(path.join(__dirname,file)),raw=JSON.parse(bytes),h=harness(raw.state),{s,ctx}=h;
  ctx.CivilPlatform.validate(s);const decoded=ctx.CivilPlatform.decode(bytes.toString('utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(decoded)),raw.state,'native decode preserves every saved field');
  const c=s.civilization,city=ctx.CivilCity;states[key]=s;
  assert.equal(c.course.id,key==='industry'?'industry':'commons');
  assert.equal(c.urban.city,true);assert.ok(c.urban.economy.education&&c.urban.economy.treatment);
  if(key==='commons'){assert.ok(!c.tech.mining&&!c.tech.power);assert.equal(s.game.buildings.commonhouse,12);}
  if(key==='industry'){assert.ok(c.tech.mining&&c.tech.power);assert.ok(c.urban.economy.industrial&&c.urban.economy.productionPower>=4);}
  const report={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,elapsed:c.elapsed,year:c.society.year,home:s.game.population,route:c.course.id,ruleset:c.ruleset??'legacy',health:c.village.health};
  if(c.ruleset===2){
    assert.notEqual(c.city.cityAt,null);assert.ok(city.population(s)>=10000);ctx.CivilCensus.validate(s);city.validate(s);
    Object.assign(report,{cityPopulation:city.population(s),worldInitial:c.census.initial,worldBorn:c.census.born,worldDead:c.census.dead,worldTotal:ctx.CivilCensus.total(s),worldEntries:c.census.entries.length,
      wards:Object.fromEntries(Object.entries(c.city.wards).map(([id,n])=>[id,{population:city.count(n),joinedAt:n.joinedAt,health:n.health,stable:n.stable,buildings:n.buildings,groups:n.cohorts.length}]))});
  }else assert.equal(c.census,undefined);
  summaries[key]=report;
}
const cut=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'M3/公共服务_'+name+'.json'),'utf8')).state;
const before=cut('before-cut'),during=cut('during-cut'),after=cut('after-cut');
for(const s of [before,during,after])harness(s).ctx.CivilPlatform.validate(s);
assert.equal(during.game.workers.medic,0);assert.equal(during.civilization.urban.economy.treatment,false);assert.ok(during.civilization.village.health<before.civilization.village.health);
assert.ok(after.game.workers.medic>0&&after.civilization.urban.economy.treatment);assert.ok(after.civilization.village.health>=98);
assert.ok(states.recovery.civilization.city.wards.canal.waterEnabled);assert.ok(states.recovery.civilization.city.wards.canal.stable>=120);
assert.ok(states.recovery.civilization.city.history.some(e=>e.kind==='policy'&&e.id==='canal'));
summaries.medicalRecovery={before:before.civilization.elapsed,interrupted:during.civilization.elapsed,recovered:after.civilization.elapsed,lowestHealth:during.civilization.village.health,medicineStillInStock:during.stores.medicine};
console.log(JSON.stringify(summaries,null,2));
