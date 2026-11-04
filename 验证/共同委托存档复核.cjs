// Read-only audit of native UI exports. Gzip envelopes are decoded in memory only.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{harness}=require('../游戏/tests/helpers/metro-fixture.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(__dirname,'存档'),names=fs.readdirSync(dir),copy=x=>JSON.parse(JSON.stringify(x));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),records=[],states={};
for(const id of [217,218,219,220,221,222,223]){
 const name=names.find(f=>f.endsWith(id+'.json')),bytes=fs.readFileSync(path.join(dir,name));let raw=JSON.parse(bytes);
 if(raw.encoding==='gzip-base64'){const inflated=zlib.gunzipSync(Buffer.from(raw.data,'base64'));assert.equal(inflated.length,raw.bytes);raw=JSON.parse(inflated);}
 const h=harness(raw.state),s=h.s,c=s.civilization,a=h.ctx.CivilCityCouncil,d=a.data(s);assert.deepEqual(copy(s),raw.state);h.roundtrip();states[id]=copy(s);
 const count=n=>h.ctx.CivilCity.count(n),pop={home:h.ctx.CivilCity.population(s),lake:count(c.conurbation.node),ridge:count(c.cityNetwork.node)};
 if(d?.locals.estuary?.node)pop.estuary=count(d.locals.estuary.node);
 const all=[...Object.entries(c.city.wards),['lake',c.conurbation.node],['ridge',c.cityNetwork.node],...(d?.locals.estuary?.node?[['estuary',d.locals.estuary.node]]:[])];
 const cBefore=JSON.stringify(s);const history=h.ctx.CivilHistory.snapshot(s);assert.equal(JSON.stringify(s),cBefore);
 records.push({id,name,sha256:sha(bytes),at:c.elapsed,year:Math.floor(c.elapsed/600),seed:c.census.seed,world:h.ctx.CivilCensus.total(s),initial:c.census.initial,born:c.census.born,dead:c.census.dead,population:pop,total:Object.values(pop).reduce((a,b)=>a+b,0),
  local:Object.fromEntries(all.map(([key,n])=>[key,{population:count(n),beds:h.ctx.CivilCity.housing(s,key),health:n.health,stable:n.stable,born:n.born,dead:n.dead,produced:n.budget.produced,consumed:n.budget.consumed,received:n.budget.received,sent:n.budget.sent}])),
  council:d?{at:d.at,offices:d.offices,proposals:d.proposals,projects:d.projects,shipments:d.shipments,history:d.history,historyViewEntries:history.entries.filter(e=>e.key.startsWith('city_council_')).length}:null});
}
assert.ok(records.every(x=>x.seed===records[0].seed));
const byId=Object.fromEntries(records.map(r=>[r.id,r])),held=states[218].civilization.cityCouncil,recovered=states[219].civilization.cityCouncil,latest=states[223].civilization.cityCouncil;
assert.equal(held.offices.home.enabled,false);assert.ok(held.shipments.some(p=>p.source==='ridge'&&p.deliveredAt===null&&p.legs[0].deliveredAt!==null));
assert.ok(recovered.offices.home.enabled);assert.ok(recovered.projects[0].completedAt);assert.ok(recovered.shipments.every(p=>p.deliveredAt!==null));
for(const [i,p]of held.shipments.entries()){assert.deepEqual(p.cargo,recovered.shipments[i].cargo);assert.deepEqual(p.path,recovered.shipments[i].path);}
assert.ok(latest.proposals.some(p=>!p.accepted&&p.stances.some(x=>x.code==='housingFirst')));
assert.ok(latest.projects.some(p=>p.kind==='housing'&&p.target==='home'&&p.mode==='beneficiary'&&p.completedAt!==null));
assert.equal(latest.projects.filter(p=>p.kind==='road'&&p.completedAt!==null).length,2);
const pharmacy=latest.shipments.find(p=>p.source==='estuary');assert.ok(pharmacy&&pharmacy.cargo.medicine===48&&pharmacy.deliveredAt!==null);assert.deepEqual(pharmacy.path.ids,['estuary','lake','ridge']);
assert.ok(Object.values(byId[223].local).every(n=>n.health===100&&n.stable===600));assert.equal(byId[223].council.historyViewEntries,latest.history.length);
assert.ok(byId[223].local.yards.population>byId[219].local.yards.population);assert.equal(byId[223].local.ridge.beds-byId[219].local.ridge.beds,800);
// 220 is the preserved UI fault branch. The accepted continuation restarts from native 219.
assert.equal(states[220].civilization.cityCouncil.projects[1].target,'lake');assert.equal(latest.projects[1].target,'home');
for(const id of [221,222,223])assert.deepEqual(states[id].civilization.cityCouncil.proposals[0],recovered.proposals[0]);
const baseline='8c3383b4b2c943cb2da8cd277694d796f78f3a1a',originals=execFileSync('git',['ls-tree','-rz','--name-only',baseline,'验证/存档'],{cwd:root}).toString().split('\0').filter(f=>f.endsWith('.json'));
for(const file of originals){const old=execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:64*1024*1024});assert.equal(sha(fs.readFileSync(path.join(root,file))),sha(old),file);}
const report={kind:'native UI evidence, no simulated progress in this audit',baseline,originalsUnchanged:originals.length,lineage:'217→218→219; 220 is preserved fault branch; 219→221→222→223',records};
fs.writeFileSync(path.join(__dirname,'共同委托/原生存档与守恒复核.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({originalsUnchanged:originals.length,checkpoints:records.map(({id,at,population,total,council})=>({id,at,population,total,completed:council?.projects.filter(p=>p.completedAt!==null).length,delivered:council?.shipments.filter(p=>p.deliveredAt!==null).length}))},null,2));
