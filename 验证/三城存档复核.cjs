// Read-only native evidence audit; never edits a save or injects resources/time.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'..'),{harness}=require('../游戏/tests/helpers/metro-fixture.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),copy=x=>JSON.parse(JSON.stringify(x)),sum=cs=>cs.reduce((a,c)=>a+c.count,0),names=fs.readdirSync(path.join(__dirname,'存档'));
const report=[];
for(const id of [213,215,216,217]){
 const name=names.find(f=>f.endsWith(id+'.json')),bytes=fs.readFileSync(path.join(__dirname,'存档',name)),raw=JSON.parse(bytes),h=harness(raw.state),s=h.s,c=s.civilization,d=c.cityNetwork,l=c.conurbation;
 assert.deepEqual(copy(s),raw.state);h.roundtrip();const census=h.ctx.CivilCensus.data(s);assert.equal(h.ctx.CivilCensus.total(s),census.initial+census.born-census.dead);
 const item={name,sha256:sha(bytes),at:c.elapsed,year:Math.floor(c.elapsed/600),seed:census.seed,world:h.ctx.CivilCensus.total(s),initial:census.initial,born:census.born,dead:census.dead,
  home:h.ctx.CivilCity.population(s),lake:sum(l.node.cohorts),ridge:d?.node?sum(d.node.cohorts):null,
  health:Object.fromEntries([...Object.entries(c.city.wards),['lake',l.node],...(d?.node?[['ridge',d.node]]:[])].map(([k,n])=>[k,{population:sum(n.cohorts),health:n.health,stable:n.stable}])),
  network:d?{at:d.at,legacyTrips:d.legacyTrips,partition:census.entries.find(e=>e.to==='city_ridge'&&e.kind==='partition'),survey:d.survey,road:d.road,expansion:d.expansion,budget:d.budget,priority:d.priority,capacity:h.ctx.CivilCityNetwork.capacity(s),occupied:h.ctx.CivilCityNetwork.occupied(s),trips:d.trips,departures:d.departures,inspections:d.inspections,actualSmelters:d.node.economy.worked.smelter,assignedSmelters:d.node.workers.smelter,produced:d.node.budget.produced,consumed:d.node.budget.consumed,entries:d.entries}:null};
 item.combined=item.home+item.lake+(item.ridge||0);report.push(item);
}
assert.ok(report.every(r=>r.seed===report[0].seed));const [source,connected,cut,recovered]=report;
assert.equal(connected.network.capacity,1);assert.ok(connected.network.trips.filter(p=>p.deliveredAt!==null).length>=3);
assert.equal(cut.network.budget.ridge,'hold');assert.equal(cut.network.assignedSmelters,0);assert.equal(cut.network.actualSmelters,0);assert.ok(cut.at-cut.network.inspections.ridge>=120);
assert.equal(cut.health.ridge.health,100);assert.equal(cut.health.ridge.stable,600);assert.ok(cut.network.trips.every(p=>p.finishedAt!==null));
assert.equal(recovered.network.budget.ridge,'expand');assert.equal(recovered.network.capacity,2);assert.ok(recovered.network.produced.iron>cut.network.produced.iron);assert.ok(recovered.network.trips.length>cut.network.trips.length);
assert.ok(Object.values(recovered.health).every(n=>n.health===100&&n.stable===600));
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'存档',source.name))).state.civilization.conurbation,last=JSON.parse(fs.readFileSync(path.join(__dirname,'存档',recovered.name))).state.civilization.conurbation;
assert.deepEqual(last.trips.slice(0,old.trips.length-1),old.trips.slice(0,-1));const pending=last.trips[old.trips.length-1];assert.equal(pending.finishedAt,source.at+old.trips.at(-1).remaining);assert.equal(pending.status,'complete');
const actions=fs.readFileSync(path.join(__dirname,'三城/213至217正常操作.ndjson'),'utf8').trim().split('\n').map(JSON.parse);assert.ok(actions.some(e=>e.kind==='shared_fleet_queue'));const overlap=actions.find(e=>e.kind==='two_fleet_overlap');assert.ok(overlap);assert.ok(overlap.expansion.completedAt<=overlap.at);assert.ok(overlap.legacy.startedAt<=overlap.at&&overlap.ridge.startedAt<=overlap.at);
const baseline='85273d039c6565dc1af8df5737918a576aac95ee',originals=execFileSync('git',['ls-tree','-r','-z','--name-only',baseline,'--','验证/存档'],{cwd:root}).toString().split('\0').filter(Boolean);
for(const file of originals){const before=execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:64*1024*1024});assert.equal(sha(fs.readFileSync(path.join(root,file))),sha(before),'modified original '+file);}
fs.writeFileSync(path.join(__dirname,'三城/原始存档与守恒复核.json'),JSON.stringify({kind:'native UI exports, immutable source audit',baseline,originalsUnchanged:originals.length,queue:actions.find(e=>e.kind==='shared_fleet_queue'),overlap,report},null,2));
console.log(JSON.stringify({originalsUnchanged:originals.length,checkpoints:report.map(({name,at,home,lake,ridge,combined,network})=>({name,at,home,lake,ridge,combined,delivered:network?.trips.filter(p=>p.deliveredAt!==null).length,capacity:network?.capacity,occupied:network?.occupied,producedIron:network?.produced.iron}))},null,2));
