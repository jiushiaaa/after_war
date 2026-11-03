// Read-only verification of immutable natural exports. Synthetic long runs live in a separate script.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {harness}=require('../游戏/tests/helpers/metro-fixture.cjs');
const files=['自然游玩_万人城域水务恢复207.json','自然游玩_城市分工调运阻塞208.json','自然游玩_城市机构分工与供给恢复209.json'];
const industrial='自然游玩_工业路线万人城市与专业生产210.json';files.push(industrial);
const rows=[];
for(const name of files){
 const file=path.join(__dirname,'存档',name),bytes=fs.readFileSync(file),raw=JSON.parse(bytes),h=harness(raw.state),{s,ctx}=h;
 ctx.CivilPlatform.validate(s);assert.deepEqual(JSON.parse(JSON.stringify(s)),raw.state,'loading cannot alter the raw export');
 const round=ctx.CivilPlatform.decode(JSON.stringify(raw));assert.deepEqual(JSON.parse(JSON.stringify(round)),raw.state);
 const d=s.civilization.city,i=d.institutions;
 rows.push({file:name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),elapsed:s.civilization.elapsed,course:s.civilization.course.id,world:ctx.CivilCensus.total(s),worldEquation:s.civilization.census.initial+s.civilization.census.born-s.civilization.census.dead,population:ctx.CivilCity.population(s),home:s.game.population,homeHealth:s.civilization.village.health,homeHunger:s.civilization.hunger,delegated:i?.home.enabled,officeRecords:i?.home.records.length,arrived:d.arrived,wards:Object.fromEntries(Object.entries(d.wards).map(([id,n])=>[id,{population:ctx.CivilCity.count(n),health:n.health,stable:n.stable,method:n.method,profile:i?.wards[id]?.profile,clinical:i?.wards[id]?.careMethod,school:i?.wards[id]?.schoolEnabled||false,certified:i?Object.fromEntries(['craft','care'].map(k=>[k,ctx.CivilCityInstitutions.trained(s,id,k)])):null,courses:i?.wards[id]?.courses.map(t=>({subject:t.subject,rounds:t.rounds,paid:t.paid,result:t.result})),stores:n.stores,worked:n.economy.worked,produced:n.budget.produced,received:n.budget.received,sent:n.budget.sent}]))});
}
for(const row of rows)assert.equal(row.world,row.worldEquation);
assert.equal(rows[1].wards.terraces.health,0);assert.ok(rows[2].wards.terraces.health>=98);assert.ok(rows[2].arrived>rows[1].arrived);assert.ok(rows[2].delegated);assert.equal(rows[3].course,'industry');assert.equal(rows[3].wards.yards.method,'standard');assert.ok(rows[3].wards.yards.certified.craft>=40);assert.ok(rows[3].wards.canal.certified.care>=110);for(const n of Object.values(rows[3].wards))assert.ok(n.health>=95&&n.stable>=120);
const output=process.argv[2]||path.join(__dirname,'城市机构','原始存档复核.json');fs.writeFileSync(output,JSON.stringify(rows,null,2));console.log(rows.map(r=>({file:r.file,elapsed:r.elapsed,population:r.population,health:Object.values(r.wards).map(n=>n.health),arrived:r.arrived})));
