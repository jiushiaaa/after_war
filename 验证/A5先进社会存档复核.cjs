// Read-only ORIGINAL native exports. No state normalization is accepted as proof.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {harness}=require('../游戏/tests/helpers/metro-fixture.cjs');
const root=path.resolve(__dirname,'..'),index=JSON.parse(fs.readFileSync(path.join(__dirname,'A5先进社会/原生存档索引.json'))),selected=process.argv.slice(2).map(Number);
const report={kind:'original-native-ui-read-only',baseline:'db13686f73a547fed580ac8393db86b85aad08ac',historicalFiles:0,saves:[]};
for(const item of index.filter(r=>!selected.length||selected.includes(r.number))){
 const bytes=fs.readFileSync(path.join(root,item.file)),e=JSON.parse(bytes),raw=e.encoding?JSON.parse(z.gunzipSync(Buffer.from(e.data,'base64'))):e,s=raw.state,h=harness(s),c=s.civilization,p=c.polity,f=p.future;
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);h.ctx.CivilPlatform.validate(s);h.roundtrip();
 const counts=h.ctx.CivilFuturePeople.counts(f),world=h.ctx.CivilCensus.total(s);
 assert.equal(world,c.census.initial+c.census.born+(c.census.created||0)-c.census.dead);assert.equal(counts.total,f.migrated+f.born+f.created-f.dead);
 const row={number:item.number,file:item.file,source:item.source,sha256:item.sha256,at:c.elapsed,world,globalBorn:c.census.born,globalDead:c.census.dead,globalCreated:c.census.created||0,counts,migrated:f.migrated,born:f.born,dead:f.dead,created:f.created,converted:f.converted,condition:f.condition,health:f.health,geneSafety:f.geneSafety,wear:f.machineWear,qualified:f.qualified,recovered:f.recovered,laws:f.laws,lawsHistory:f.lawsHistory,echo:f.echo,history:f.history.length,last:f.last,stock:f.stock,book:f.book,energy:f.energy,exports:f.exports,supplyVersion:f.supplyVersion||1,originalExactReplay:true};
 if([359,362,364,377,380].includes(item.number)){
  let d=null;const periods=[];
  for(const event of p.records){d=h.ctx.CivilPolity.reduce(d,event).d;if(event.action==='period'&&event.at>c.elapsed-6000&&d.future?.last)periods.push({at:event.at,health:d.future.health,condition:d.future.condition,...d.future.last});}
  assert.ok(periods.length>=100);row.lastTenYears={seconds:6000,periods:periods.length,minHealth:Math.min(...periods.map(r=>r.health)),minCondition:Math.min(...periods.map(r=>r.condition)),...Object.fromEntries(['fed','treated','powered','maintained','monitoring'].map(k=>[k,periods.filter(r=>r[k]).length]))};
  if([364,380].includes(item.number))for(const k of ['fed','treated','powered','maintained','monitoring'])assert.equal(row.lastTenYears[k],periods.length,item.number+' '+k);
 }
 report.saves.push(row);console.error('validated original '+item.number);
}
for(const line of cp.execFileSync('git',['ls-tree','-rz',report.baseline,'--','验证/存档'],{cwd:root}).toString().split('\0').filter(Boolean)){
 const [meta,name]=line.split('\t');if(!name.endsWith('.json'))continue;const bytes=fs.readFileSync(path.join(root,name)),hash=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');assert.equal(hash,meta.split(' ')[2],name+' changed');report.historicalFiles++;
}
console.log(JSON.stringify(report,null,2));
