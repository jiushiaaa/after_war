// Read-only native export validation. No replay advancement or raw-file rewriting.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const {harness}=require('../游戏/tests/helpers/metro-fixture.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(__dirname,'存档'),numbers=process.argv.slice(2).map(Number),wanted=numbers.length?numbers:[259,260,261,262,263,264,265,266];
const report={kind:'read-only native exports; 262 is an isolated driver-selection branch, not merged into 263–266',baseline:'8ef92e95a6912faf7858f891d6656eb3a7193e48',saves:[],historicalFiles:0};
for(const number of wanted){
 const name=fs.readdirSync(dir).find(f=>f.endsWith(number+'.json'));assert.ok(name,'missing '+number);const bytes=fs.readFileSync(path.join(dir,name));let raw=JSON.parse(bytes);if(raw.encoding)raw=JSON.parse(z.gunzipSync(Buffer.from(raw.data,'base64')));assert.equal(raw.format,'postwar-civilization');assert.equal(raw.version,1);
 const h=harness(raw.state),s=h.s,c=h.ctx.CivilCityCouncil,f=h.ctx.CivilCityDispatch,H=h.ctx.CivilCityHomes;h.roundtrip();const at=s.civilization.elapsed,newShips=c.data(s).shipments.filter(p=>p.at>88905),d=f.data(s),census=s.civilization.census;
 const row={number,name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),at,year:Math.floor(at/600),world:h.ctx.CivilCensus.total(s),initial:census.initial,born:census.born,dead:census.dead,totalCities:h.ctx.CivilCity.population(s)+c.ids(s).filter(id=>id!=='home').reduce((n,id)=>n+h.ctx.CivilCity.count(c.local(s,id)),0),
  cities:c.ids(s).map(id=>{const n=c.local(s,id);return {id,population:id==='home'?h.ctx.CivilCity.population(s):h.ctx.CivilCity.count(n),health:n.health,stable:n.stable,drivers:n.workers.publiccourier||0,builders:n.workers.freightbuilder||0,keepers:n.workers.freightkeeper||0,mode:h.ctx.CivilCityBudget.mode(s,id),quota:c.data(s).offices[id].quota,requests:h.ctx.CivilCityBudget.requests(s,id)};}),
  dispatch:d?{mode:d.mode,changes:d.changes.map(i=>c.data(s).receipts[i-1]),depots:Object.fromEntries(Object.entries(d.depots).map(([id,o])=>[id,{at:o.at,capital:o.paid,capitalReceipt:o.order,remaining:o.remaining,completedAt:o.completedAt,enabled:o.enabled,active:f.active(s,id),maintenancePaid:o.services.filter(r=>r.paid).length,maintenanceUnpaid:o.services.filter(r=>!r.paid).length,lastPaidAt:o.lastPaidAt,changes:o.changes.map(i=>c.data(s).receipts[i-1])}]))}:null,
  projects:c.data(s).projects.filter(p=>p.at>88905).map(p=>({id:p.id,at:p.at,kind:p.kind,target:p.target,completedAt:p.completedAt,sites:p.sites})),
  shipments:newShips.map(p=>({id:p.id,project:p.project,at:p.at,source:p.source,target:p.target,carrier:p.carrier||'duty',cargo:p.cargo,deliveredAt:p.deliveredAt,legs:p.legs})),
  publicReturned:c.data(s).shipments.every(p=>p.deliveredAt!==null&&p.legs.every(l=>l.finishedAt!==null)),familiesReturned:H.data(s).trips.every(p=>p.finishedAt!==null),
  capitalPaid:c.data(s).receipts.filter(e=>e.at>88905&&e.kind==='dispatchBuild').map(e=>({city:e.city,at:e.at,paid:e.paid})),maintenancePaid:c.data(s).receipts.filter(e=>e.at>88905&&e.kind==='dispatchService').reduce((n,e)=>{for(const [k,v]of Object.entries(e.paid))n[k]=(n[k]||0)+v;return n;},{})};
 assert.equal(row.world,row.initial+row.born-row.dead);report.saves.push(row);
}
const entries=cp.execFileSync('git',['ls-tree','-rz',report.baseline,'--','验证/存档'],{cwd:root}).toString('utf8').split('\0').filter(Boolean);
for(const line of entries){const [meta,name]=line.split('\t');if(!name.endsWith('.json'))continue;const expected=meta.split(' ')[2],bytes=fs.readFileSync(path.join(root,name)),actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');assert.equal(actual,expected,'historical bytes changed: '+name);report.historicalFiles++;}
console.log(JSON.stringify(report,null,2));
