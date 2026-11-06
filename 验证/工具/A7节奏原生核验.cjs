// Independent read-only replay of new UI exports; never ticks or edits these worlds.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {harness}=require('../../游戏/tests/helpers/metro-fixture.cjs'),root=path.resolve(__dirname,'../..'),dir=path.join(root,'验证/A7节奏');
const file=path.join(dir,'原生核验.json'),report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{kind:'read-only strict validation of native UI exports, not a simulated playthrough',checked:[]};
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.startsWith('战后文明-存档')&&e.name.endsWith('.json')?[path.join(dir,e.name)]:[]);}
function check(){
 for(const route of ['public','industry','shelter-first'])for(const filename of files(path.join(dir,route))){const bytes=fs.readFileSync(filename),sha=crypto.createHash('sha256').update(bytes).digest('hex'),relative=path.relative(root,filename);if(report.checked.some(r=>r.file===relative&&r.sha===sha))continue;
  const raw=JSON.parse(bytes),s=(raw.encoding?JSON.parse(z.gunzipSync(Buffer.from(raw.data,'base64'))):raw).state,before=JSON.stringify(s),h=harness(s);h.ctx.CivilPlatform.validate(h.s);assert.equal(JSON.stringify(h.s),before,'validation must not change an exported state');
  assert.equal(s.civilization.ruleset,2);assert.equal(s.civilization.polishVersion,1);assert.equal(s.civilization.census.seed,7417);
  const c=s.civilization;report.checked.push({file:relative,sha,exact:true,elapsed:c.elapsed,world:h.ctx.CivilCensus.total(s),born:c.census.born,dead:c.census.dead,created:c.census.created||0,tech:Object.values(c.tech).filter(Boolean).length,fieldAmmo:c.fieldEquipment.ammoMade-c.fieldEquipment.ammoSpent,route:c.course?.id||null});
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log('STRICT OK',relative,c.elapsed);
 }
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'验证/A7节奏/原始导出基线.json')));for(const [p,sha]of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),sha,p);
 report.originals={count:Object.keys(baseline).length,unchanged:true};fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
}
async function main(){do{check();if(!process.argv.includes('--watch'))break;await new Promise(r=>setTimeout(r,60000));}while(!fs.existsSync(path.join(dir,'validation.stop')));}
main().catch(e=>{fs.writeFileSync(path.join(dir,'validation-error.txt'),e.stack);console.error(e);process.exitCode=1;});
