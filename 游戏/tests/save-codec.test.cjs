const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
const raw=fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows旧渡口战后共同治理完成52.json'),'utf8');
const web={TextEncoder,TextDecoder,Blob,Response,CompressionStream,DecompressionStream,atob,btoa,setTimeout,clearTimeout};
function codec(){const ctx=vm.createContext(web);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/postwar/save-codec.js'),'utf8'),ctx);return ctx.CivilSaveCodec;}
function game(){const h=harness(JSON.parse(raw).state);Object.assign(h.ctx,web);return h;}

test('all natural national, diplomatic, battle and medical ledgers survive lossless compressed export',async()=>{
 const h=game(),before=JSON.stringify(h.s),p=h.ctx.CivilPlatform,encoded=await p.encode();
 assert.equal(JSON.parse(encoded).version,2);assert.ok(encoded.length<raw.length/4);assert.equal(JSON.stringify(h.s),before);
 const decoded=await p.decodeSave(encoded);assert.deepEqual(clone(decoded),JSON.parse(before));h.ctx.CivilPlatform.validate(decoded);
 assert.deepEqual(clone(await p.decodeSave(raw)),JSON.parse(before));
});

test('a declared synthetic text load beyond the old nine-million-character ceiling remains fully readable',async()=>{
 // Only a codec stress fixture; never imported into the natural browser or saved as progress.
 const h=game(),p=h.ctx.CivilPlatform;h.s.codecStress='长期记录'.repeat(800000);
 const text=p.serialize();assert.ok(text.length>9e6);const encoded=await p.encode(),decoded=await p.decodeSave(encoded);
 assert.equal(JSON.stringify(decoded),JSON.stringify(h.s));assert.ok(encoded.length<text.length/4);
});

test('truncation, wrong lengths, foreign wrappers and unsupported encodings fail without replacing live state',async()=>{
 const h=game(),p=h.ctx.CivilPlatform,before=JSON.stringify(h.s),valid=JSON.parse(await p.encode());
 for(const bad of [{...valid,data:valid.data.slice(0,-8)},{...valid,bytes:valid.bytes-1},{...valid,bytes:valid.bytes+1},{...valid,bytes:64000001},{...valid,encoding:'other'},{...valid,format:'foreign'},{...valid,data:'not base64!'}])await assert.rejects(p.decodeSave(JSON.stringify(bad)));
 assert.equal(JSON.stringify(h.s),before);
});

test('the stream stops at its declared expansion bound and cancellation during decode cannot reopen an import',async()=>{
 const h=game(),p=h.ctx.CivilPlatform,valid=JSON.parse(await p.encode());valid.bytes=64;
 await assert.rejects(p.decodeSave(JSON.stringify(valid)),/展开长度/);
 let active={},scene='import',resolve;const event=active;p.pending=null;
 h.ctx.Events={activeEvent:()=>active,get activeScene(){return scene;},loadScene:next=>{scene=next;}};
 p.decodeSave=()=>new Promise(r=>resolve=r);const importing=p.inspectImport(raw,event);active=null;resolve(h.s);await importing;
 assert.equal(scene,'import');assert.equal(p.pending,null);
});

test('small saves and browsers without a compressor retain readable version-one JSON',async()=>{
 const c=codec(),small='{"format":"postwar-civilization","version":1,"state":{}}';assert.equal(await c.encode(small),small);assert.equal(await c.unpack(small),small);
 const ctx=vm.createContext({...web,CompressionStream:undefined});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/postwar/save-codec.js'),'utf8'),ctx);
 assert.equal(await ctx.CivilSaveCodec.encode(raw),raw);assert.equal(await c.unpack(await ctx.CivilSaveCodec.encode(raw)),raw);
});

test('cloud persistence writes a complete compressed snapshot and corrupted reads never enable saving',async()=>{
 const h=game(),p=h.ctx.CivilPlatform;let resolve,writes=0,stored;
 p.sdk={writeSave:async text=>{writes++;stored=text;await new Promise(r=>resolve=r);}};p.loaded=true;p.dirty=true;p.status=()=>{};
 const flushing=p.flush();while(!stored)await new Promise(r=>setTimeout(r,5));const snapshot=await p.decodeSave(stored);assert.deepEqual(clone(snapshot),clone(h.s));
 p.changed();await p.flush();assert.equal(writes,1);resolve();await flushing;clearTimeout(p.timer);p.timer=null;
 h.ctx.LumiMakerSdk={ready:async()=>({ready:true}),readSave:async()=>new TextEncoder().encode('{broken'),writeSave:async()=>{throw Error('must not write');}};
 p.loaded=false;await assert.rejects(p.load());assert.equal(p.loaded,false);
});

test('an unopened landing or unconfirmed seed cannot replace a cloud save',async()=>{
 const h=game(),p=h.ctx.CivilPlatform;let writes=0;p.loaded=true;p.dirty=true;p.sdk={writeSave:async()=>writes++};p.status=()=>{};
 h.ctx.CivilLanding.phase='ready';p.changed();await p.flush();assert.equal(writes,0);assert.equal(p.dirty,true);
 h.ctx.CivilLanding.phase='setup';h.s.civilization.setup={confirmed:false};await p.flush();assert.equal(writes,0);
 h.ctx.CivilLanding.phase='playing';await p.flush();assert.equal(writes,0,'a premature reveal still cannot save an unconfirmed seed');
 delete h.s.civilization.setup;await p.flush();assert.equal(writes,1);
});
