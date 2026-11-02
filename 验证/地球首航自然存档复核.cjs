// Read-only audit of native exports; never advances or rewrites natural saves.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {harness,clone}=require('../游戏/tests/helpers/metro-fixture.cjs');
const dir=path.join(__dirname,'存档');
function read(file){const bytes=fs.readFileSync(file),raw=JSON.parse(bytes),s=raw.state||JSON.parse(zlib.gunzipSync(Buffer.from(raw.data,'base64'))).state;return{bytes,s};}
const baseline=read(path.join(dir,'自然游玩_Mac轨道测绘与国家文案恢复118.json')).s;
const files=process.argv.slice(2);if(!files.length)throw Error('Pass one or more original JSON save paths');
for(const file of files){
 const {bytes,s}=read(file),h=harness(s);h.roundtrip();
 for(const key of ['nation','diplomacy','accession','security']){const old=baseline.civilization[key]?.records;if(old)assert.deepEqual(s.civilization[key].records.slice(0,old.length),old,key+' history prefix');}
 assert.equal(s.civilization.nation.foundedAt,baseline.civilization.nation.foundedAt);
 for(const key of ['commerce','intercity'])for(const old of baseline.civilization[key]?.orders||[])if(old.returnedAt!==null)assert.deepEqual(s.civilization[key].orders.find(x=>x.id===old.id),old,key+' completed order');
 const c=s.civilization,w=c.worldstage,space=c.space;
 console.log(JSON.stringify({file:path.basename(file),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),elapsed:c.elapsed,year:c.society.year,generation:c.society.generation,speed:c.speed,maxSpeed:c.maxSpeed,legitimacy:c.nation.legitimacy,tech:Object.keys(c.tech).filter(k=>c.tech[k]).length,members:h.ctx.CivilWorld.members(s),regionalPopulation:h.ctx.CivilWorld.population(s),stable:Object.fromEntries(Object.entries(w.nodes).map(([k,v])=>[k,v.stableSeconds])),missions:w.missions.map(m=>({id:m.id,region:m.region,kind:m.kind,departedAt:m.departedAt,returnedAt:m.returnedAt})),unification:space?.unification,space:space?.missions.map(m=>({kind:m.kind,startedAt:m.startedAt,completedAt:m.completedAt,progress:m.progress,receipts:m.receipts.length,paid:m.receipts.filter(r=>r.paid).length})),components:{spaceparts:s.stores.spaceparts,lifesupport:s.stores.lifesupport},validated:true,baselineHistoryPreserved:true},null,2));
}
