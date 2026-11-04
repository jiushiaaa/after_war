/* Read native exports; never rewrite the original files. Rule continuation is a separate test. */
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');
const {harness,clone}=require('../游戏/tests/helpers/metro-fixture.cjs'),dir=path.join(__dirname,'存档');
const files=[
 ['自然游玩_原镇职责交接与接续工坊228.json',true],
 ['自然游玩_岗位课程停办229.json',true],
 ['自然游玩_跨城招工与复课恢复230.json',true],
 ['自然游玩_年界接班复核分支231.json',false],
 ['自然游玩_原镇代际接任232.json',true],
 ['自然游玩_五城网络与岗位接续233.json',true]
];
const rows=[];
for(const [name,accepted]of files){let raw=JSON.parse(fs.readFileSync(path.join(dir,name)));if(raw.encoding)raw=JSON.parse(z.gunzipSync(Buffer.from(raw.data,'base64')));const h=harness(raw.state),s=h.s,x=h.ctx,a=x.CivilCityContinuity,c=x.CivilCityCouncil,d=a.data(s);h.roundtrip();assert.deepEqual(clone(s),raw.state);const cities=c.ids(s).map(id=>({id,population:id==='home'?x.CivilCity.population(s):x.CivilCity.count(c.local(s,id)),health:c.local(s,id).health,stable:c.local(s,id).stable}));
 rows.push({name,accepted,at:s.civilization.elapsed,year:Math.floor(s.civilization.elapsed/600),world:x.CivilCensus.total(s),cities,total:cities.reduce((sum,n)=>sum+n.population,0),town:{population:s.game.population,health:s.civilization.village.health,hunger:s.civilization.hunger,terms:d.town.terms,courses:d.town.courses,staff:a.townStaff(s),last:d.town.records.at(-1)},workshop:{capacity:a.capacity(s,'home'),qualified:a.count(a.qualified(s,'home')),workers:c.local(s,'home').workers.settler||0,waiting:a.count(a.waiting(s,'home')),completed:d.offices.home.courses.filter(t=>t.status==='completed').length,training:d.offices.home.training,services:d.offices.home.services.length},invites:d.invites,trips:s.civilization.cityHomes.trips.slice(5).map(p=>({id:p.id,initial:p.initial.reduce((n,c)=>n+c.count,0),dead:p.dead,outcome:p.outcome,finishedAt:p.finishedAt,pack:p.pack,consumed:p.consumed,received:p.received})),estate:s.civilization.cityHomes.estates.home,registry:s.civilization.cityRegistry,bridge:s.civilization.cityCouncil.locals.bridge?.origin,bridgePath:c.ids(s).includes('bridge')?c.path(s,'home','bridge'):null});
}
console.log(JSON.stringify({kind:'read-only native saves; 231 is retained but not accepted',rows},null,2));
