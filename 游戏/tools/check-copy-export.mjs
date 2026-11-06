// MPL-2.0. Verify editorial exports without changing game sources or save files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(game),out=path.join(root,'文案编辑');
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const metadata=json(path.join(out,'导出校验.json'));
const mapping=json(path.join(out,'文案定位.json'));
const main=read(path.join(out,'作品完整文案.md'));
const ids=s=>[...s.matchAll(/<!-- @(cw\.[\w.]+) -->/g)].map(m=>m[1]);
const expected=mapping.records.map(r=>r.id);
assert.equal(metadata.records,expected.length);
assert.equal(new Set(expected).size,expected.length,'Source IDs must be unique');
assert.deepEqual(ids(main),expected,'Full manuscript must retain every ID in reading order');
assert.equal(main,read(path.join(out,'_导出基线/作品完整文案.md')),'Unimported manuscript changes');
assert.equal(metadata.uncoveredChinese,0);

const sources=new Map();
for(const f of metadata.sourceHashes){
 const source=read(path.join(root,f.file));
 assert.equal(hash(source),f.sha256,'Source changed: '+f.file);
 sources.set(f.file,source);
}
const batches=new Map(),batchIDs=[];
for(const b of metadata.batches){
 const body=read(path.join(out,b.file)),found=ids(body);
 assert.equal(found.length,b.count,b.file);
 assert.equal(found[0],b.first,b.file);
 assert.equal(found.at(-1),b.last,b.file);
 for(const id of found){assert(!batches.has(id),'Duplicate batch ID '+id);batches.set(id,body);}
 batchIDs.push(...found);
}
assert.deepEqual(batchIDs,expected,'Batches must partition the full manuscript exactly');
const actualBatchFiles=fs.readdirSync(path.join(out,'分卷')).filter(f=>f.endsWith('.md')).map(f=>'分卷/'+f).sort();
assert.deepEqual(actualBatchFiles,metadata.batches.map(b=>b.file).sort(),'Unexpected or stale batch file');
let visibleVariables=0,markupOnlyVariables=0,negativeNumbers=0;
for(const r of mapping.records){
 const source=sources.get(r.file);
 assert.equal(hash(source),r.sourceHash,r.id);
 assert.equal(source.slice(r.start,r.end),r.original,r.id);
 assert.equal(hash(r.original),r.originalHash,r.id);
 assert(r.text.trim(),'Empty editorial entry '+r.id);
 const needle='<!-- @'+r.id+' -->\n'+r.text+'\n';
 assert(main.includes(needle),'Changed body in full manuscript '+r.id);
 assert(batches.get(r.id).includes(needle),'Changed body in batch '+r.id);
 const placeholders=new Set();
 for(const v of r.variables||[]){
  assert.equal(source.slice(v.start,v.end),v.expression,'Variable source mismatch '+r.id);
  assert(!placeholders.has(v.placeholder),'Duplicate placeholder '+r.id);placeholders.add(v.placeholder);
  if(r.text.includes(v.placeholder))visibleVariables++;
  else {assert(/<\/?[a-z][^>]*>/i.test(r.original),'Missing non-HTML variable '+r.id);markupOnlyVariables++;}
 }
 for(const marker of r.text.match(/\{(?:变量|分支|列表)\d+\}/g)||[])assert(placeholders.has(marker),'Unmapped placeholder '+r.id);
}
const numeric=json(path.join(out,'数值定位.json'));
assert.equal(numeric.staticContent.length,metadata.numericContentRows);
for(const n of numeric.programNumbers){
 const code=sources.get(n.file).slice(n.start,n.end);
 assert.equal(Number(code.replaceAll('_','').replace(/^-\s*/, '-')),n.value,'Numeric source mismatch '+n.file+':'+n.start);
 if(n.value<0)negativeNumbers++;
}
for(const [f,digest]of Object.entries(json(path.join(out,'_导出基线/分卷哈希.json'))))assert.equal(hash(read(path.join(out,f))),digest,'Unimported attachment changes: '+f);
let oldSaveCount=0;
for(const [f,digest]of Object.entries(json(path.join(root,'验证/A7收口/原始导出基线.json')))){
 assert.equal(hash(fs.readFileSync(path.join(root,f))),digest,'Protected original save changed: '+f);oldSaveCount++;
}

// Re-extraction and overwrite protection are exercised only in a disposable directory.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'postwar-copy-check-'));
function exportToTemporary(){return spawnSync(process.execPath,[path.join(game,'tools/export-copy.mjs'),'--out',temporary],{cwd:game,encoding:'utf8',maxBuffer:8*1024*1024});}
try{
 let result=exportToTemporary();assert.equal(result.status,0,result.stderr);
 const again=json(path.join(temporary,'文案定位.json'));
 assert.deepEqual(again.records,mapping.records,'Repeated export changed IDs or records');
 const tempMain=path.join(temporary,'作品完整文案.md'),original=read(tempMain);
 const edited=original.replace(mapping.records[0].text,mapping.records[0].text+'（仅测试编辑保护）');
 assert.notEqual(original,edited);fs.writeFileSync(tempMain,edited);
 result=exportToTemporary();assert.notEqual(result.status,0);assert.match(result.stderr,/文稿有未导入改动/);
 assert.equal(read(tempMain),edited,'Exporter overwrote the edited full manuscript');
 fs.writeFileSync(tempMain,original);
 const batch=path.join(temporary,metadata.batches[0].file),originalBatch=read(batch),editedBatch=originalBatch+'\n编辑者批注：保留这条修改。\n';
 fs.writeFileSync(batch,editedBatch);
 result=exportToTemporary();assert.notEqual(result.status,0);assert.match(result.stderr,/分卷或润色附件有未导入改动/);
 assert.equal(read(batch),editedBatch,'Exporter overwrote an edited batch');
 fs.writeFileSync(batch,originalBatch);
 result=exportToTemporary();assert.equal(result.status,0,result.stderr);
 assert.deepEqual(json(path.join(temporary,'文案定位.json')).records,mapping.records,'Re-export after guard recovery');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}

const report={checkedAt:new Date().toISOString(),revision:metadata.revision,pass:true,records:expected.length,sourceFiles:sources.size,chineseLiteralSpans:metadata.chineseLiteralSpans,uncoveredChinese:metadata.uncoveredChinese,batches:metadata.batches.length,visibleVariables,markupOnlyVariables,staticNumericRows:numeric.staticContent.length,negativeNumberLiterals:negativeNumbers,unchangedOldSaves:oldSaveCount,repeatExportStable:true,editedMainProtected:true,editedBatchProtected:true,limits:'Static editorial export only. This is not gameplay, natural play, or full game regression. HTML class/style/identifier variables are kept only in provenance, not editorial prose.'};
fs.writeFileSync(path.join(out,'校验结果.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
