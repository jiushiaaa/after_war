// Read-only validation of representative original UI exports. No ticks or source writes.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {harness}=require('../../游戏/tests/helpers/metro-fixture.cjs'),root=path.resolve(__dirname,'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'游戏/testing/catalog.json'))),out=path.join(root,'验证/Gemini文案导入/原生核验.json');
const report={kind:'read-only native replay, not natural gameplay',checked:[],failures:[]};
for(const row of catalog.scenarios.filter(r=>r.source)){
 try{
  const bytes=fs.readFileSync(path.join(root,row.source));assert.equal(hash(bytes),row.sha256);
  const raw=JSON.parse(bytes),s=(raw.encoding?JSON.parse(z.gunzipSync(Buffer.from(raw.data,'base64'))):raw).state,before=JSON.stringify(s),h=harness(s);
  h.ctx.CivilPlatform.validate(h.s);assert.equal(JSON.stringify(h.s),before);const decoded=h.ctx.CivilPlatform.decode(JSON.stringify({format:'postwar-civilization',version:1,state:h.s}));assert.equal(JSON.stringify(decoded),before);
  report.checked.push({id:row.id,source:row.source,sha256:row.sha256,elapsed:s.civilization.elapsed});console.log('OK',row.id);
 }catch(e){report.failures.push({id:row.id,error:e.message});console.log('FAIL',row.id,e.message);}
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
}
const baseline=JSON.parse(fs.readFileSync(path.join(root,'验证/A7收口/原始导出基线.json')));
for(const [file,digest]of Object.entries(baseline))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file);
report.unchangedOriginals=Object.keys(baseline).length;report.pass=!report.failures.length;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');if(!report.pass)process.exitCode=1;
