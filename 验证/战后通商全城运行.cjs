// Independent full-adapter replay from raw 136. Not a browser/natural export.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');
const {harness,clone}=require('../游戏/tests/helpers/metro-fixture.cjs');
const dir=path.join(__dirname,'存档'),file=fs.readdirSync(dir).find(x=>x.endsWith('136.json'));
const raw=JSON.parse(z.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(dir,file))).data,'base64'))).state;
const h=harness(raw),c=h.ctx,d=c.CivilWorld.data(h.s),p=c.CivilSettlement,start=h.s.civilization.elapsed,first=d.foreign.shipments.length,stats={},pay=c.CivilServices.pay.bind(c.CivilServices);
for(const id of Object.keys(d.nodes))stats[id]={produced:0,minFood:d.nodes[id].stores.food};
c.CivilServices.pay=(stores,cost)=>{const result=pay(stores,cost);if(result)for(const[id,n]of Object.entries(d.nodes)){if(stores===n.stores){stats[id].minFood=Math.min(stats[id].minFood,n.stores.food);if(JSON.stringify(cost)===JSON.stringify(p.primary(id)))stats[id].produced++;}}return result;};
assert.ok(p.act(h.s,'open'));
for(const actor of Object.keys(d.nodes)){for(const mode of ['granary','depot'])assert.ok(p.act(h.s,'project',{actor,mode}));assert.ok(p.act(h.s,'orientation',{actor,mode:'commerce'}));}
assert.ok(p.act(h.s,'treaty',{pair:'east-north',mode:'trade'}));
const milestones=[];
for(let i=0;i<40;i++){h.step(300,{checkEvery:0});if(i%10===9)milestones.push({elapsed:h.s.civilization.elapsed,year:h.s.civilization.society.year,generation:h.s.civilization.society.generation,population:h.s.game.population,legitimacy:h.s.civilization.nation.legitimacy,food:Object.fromEntries(Object.entries(d.nodes).map(([id,n])=>[id,n.stores.food]))});}
h.roundtrip();assert.ok(Object.values(stats).every(s=>s.produced===40));assert.ok(Object.values(d.nodes).every(n=>n.infrastructure===100&&n.stableSeconds===600));assert.ok(Object.values(d.foreign.actors).every(a=>a.overdueAt===null));assert.ok(d.foreign.settlement.treaties.every(t=>t.status==='expired'));assert.equal(Object.values(d.foreign.actors).reduce((v,a)=>v+a.balance,0),0);
console.log(JSON.stringify({scope:'136原始档的独立完整适配器12000秒；原有年龄、出生死亡、实际经济和正常选举选择均执行。不是浏览器自然存档，未注入物资或改时钟。',start,elapsed:h.s.civilization.elapsed,milestones,stats,accounts:clone(d.foreign.actors),projects:clone(d.foreign.settlement.projects),treaties:clone(d.foreign.settlement.treaties),newShipments:d.foreign.shipments.length-first,strictRoundtrip:true},null,2));
