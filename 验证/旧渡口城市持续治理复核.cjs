// Independent rule replay. Never connects to the browser or writes natural saves.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {harness,clone}=require('../游戏/tests/helpers/metro-fixture.cjs');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'存档/自然游玩_Windows旧渡口工业城市正式登记80.json')));
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(p.data,'base64'))).state;
const h=harness(raw),s=h.s,c=s.civilization,start=c.elapsed;
let previous=c.society.leader.started;
for(let i=0;i<7200;i++){
  h.step(1,{checkEvery:600});
  if(c.society.leader.started!==previous){
    console.log(JSON.stringify({succession:c.society.leader.started,at:c.elapsed,city:c.municipal.nodes.ford.city,pop:c.regions.nodes.ford.population}));
    previous=c.society.leader.started;
  }
  if(i%1200===0)console.log(JSON.stringify({at:c.elapsed,pop:c.regions.nodes.ford.population,health:c.regions.nodes.ford.health,failed:h.m.developmentChecks(s,'ford',true).filter(r=>!r.ready).map(r=>r.id)}));
}
assert.ok(c.municipal.nodes.ford.city);
assert.ok(h.m.developmentReady(s,'ford',true));
assert.ok(h.ctx.CivilNation.operational(s));
assert.deepEqual(clone(c.commerce.orders),clone(raw.civilization.commerce.orders));
assert.deepEqual(clone(c.municipal.nodes.ford.completed),clone(raw.civilization.municipal.nodes.ford.completed));
h.roundtrip();
console.log(JSON.stringify({done:true,seconds:c.elapsed-start,at:c.elapsed,year:c.society.year,pop:c.regions.nodes.ford.population,health:c.regions.nodes.ford.health,economy:c.municipal.nodes.ford.economy,legitimacy:c.nation.legitimacy,pollution:c.municipal.nodes.ford.pollution}));
