const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {fresh}=require('./helpers/census-fixture.cjs');
function oldWorld(){const envelope=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/存档/自然游玩_工业路线恢复后十年稳定278.json'),'utf8'));return JSON.parse(zlib.gunzipSync(Buffer.from(envelope.data,'base64')).toString()).state;}

test('city geography does not reveal uncontacted populations or create zones before discovery',()=>{
 const {s,ctx}=fresh(),map=ctx.CivilCityMap,before=JSON.stringify(s);
 for(const id of ['lake','ridge','estuary','bridge'])assert.equal(map.model(s,id),null);
 const grid=Array.from({length:31*19},()=>({glyph:'·',kind:'plain'}));map.valley(s,grid);
 assert.ok(grid.every(c=>c.kind==='plain'));assert.equal(JSON.stringify(s),before);
});

test('four local maps use the real local housing, people and production ledgers without mutating a legacy save',()=>{
 const {ctx}=fresh(),s=oldWorld(),before=JSON.stringify(s);
 for(const id of ['lake','ridge','estuary','bridge']){
   const m=ctx.CivilCityMap.model(s,id),n=ctx.CivilCity.node(s,id);assert.ok(m,id);
   assert.equal(m.population,ctx.CivilCity.count(n));
   assert.equal(m.zones.find(z=>z.id==='housing').rows[1][1],ctx.CivilCity.housing(s,id));
   assert.equal(m.zones.find(z=>z.id==='fields').rows[1][1],n.stores.food);
   const terrain=ctx.CivilCityMap.terrain(m);assert.equal(terrain.grid.length,terrain.width*terrain.height);
   for(const z of m.zones)assert.ok(z.position[0]>3&&z.position[0]<27&&z.position[1]>1&&z.position[1]<17);
 }
 assert.equal(JSON.stringify(s),before);
});

test('city map distinguishes proposed construction and blocked services from completed assets',()=>{
 // Constructed presentation case; no claim of natural play or paid construction.
 const {ctx}=fresh(),s=oldWorld(),n=s.civilization.conurbation.node;
 const beds=ctx.CivilCity.housing(s,'lake');
 s.civilization.cityCouncil.projects.push({kind:'housing',target:'lake',completedAt:null,sites:{lake:{completedAt:null}}});
 n.economy.water=0;n.economy.treated=false;
 let m=ctx.CivilCityMap.model(s,'lake');
 assert.equal(m.zones.find(z=>z.id==='housing').rows[1][1],beds);
 assert.ok(m.zones.find(z=>z.id==='housing').projects.includes('安居扩容'));
 assert.ok(m.zones.find(z=>z.id==='services').alert);
 s.civilization.conurbation.route.condition=0;
 m=ctx.CivilCityMap.model(s,'lake');assert.equal(m.road,'道路待检修');assert.ok(m.zones.find(z=>z.id==='transport').alert);
 assert.ok(!ctx.CivilCityMap.terrain(m).grid.some(c=>c.kind==='road'));
});

test('surveyed valley uses appear only where known and show unfinished works separately',()=>{
 const {s,ctx}=fresh(),n=s.civilization.city.wards.terraces;
 n.contactedAt=0;n.project={type:'water'};
 const grid=Array.from({length:31*19},()=>({glyph:'·',kind:'plain'}));ctx.CivilCityMap.valley(s,grid);
 assert.ok(grid.some(c=>c.kind==='housing'));assert.ok(grid.some(c=>c.kind==='field'));assert.ok(grid.some(c=>c.kind==='building'));
 assert.equal(grid[5*31+25].kind,'plain');
});
