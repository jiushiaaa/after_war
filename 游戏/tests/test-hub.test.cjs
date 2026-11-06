const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib'),http=require('node:http');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'testing/catalog.json'),'utf8'));

test('test catalogue references intact native evidence without rewriting or upgrading it',()=>{
  const seen=new Set();assert.equal(catalog.scenarios.length,37);
  for(const e of catalog.scenarios){assert.ok(!seen.has(e.id));seen.add(e.id);assert.ok(catalog.stages[e.stage]);assert.ok(catalog.routes[e.route]);assert.ok(e.pages.length);for(const p of e.pages)assert.ok(catalog.pages[p]);
    if(!e.source){assert.equal(e.id,'new');continue;}
    const bytes=fs.readFileSync(path.resolve(root,'..',e.source));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);assert.equal(bytes.length,e.bytes);
    const raw=JSON.parse(bytes),state=(raw.encoding?JSON.parse(zlib.gunzipSync(Buffer.from(raw.data,'base64'))):raw).state;
    assert.equal(state.civilization.elapsed,e.elapsed);assert.equal(state.civilization.ruleset,2);assert.equal(state.civilization.pacingVersion,2);
    if(e.route!=='shared')assert.equal(state.civilization.course.id,e.route==='public'?'commons':'industry');
  }
});

test('only the local preview route injects a wrapper; fixture delivery is read-only and allowlisted',async()=>{
  const {testRoute}=await import('../testing/server.js');const server=http.createServer(async(req,res)=>{if(!await testRoute(req,res,decodeURIComponent(new URL(req.url,'http://localhost').pathname),root)){res.writeHead(404);res.end('ordinary handler');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    const page=await fetch(base+'/test-game.html');assert.equal(page.status,200);assert.match(await page.text(),/testing\/session.js/);
    assert.doesNotMatch(fs.readFileSync(path.join(root,'index.html'),'utf8'),/testing\/session/);
    assert.match(await(await fetch(base+'/test.html')).text(),/体验测试/);
    const original=await fetch(base+'/testing/saves/exploration.json');assert.equal(original.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),catalog.scenarios.find(e=>e.id==='exploration').sha256);
    const head=await fetch(base+'/testing/saves/exploration.json',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    for(const url of ['/testing/saves/missing.json','/testing/saves/catalog.json','/testing/saves/%2e%2e%2FAGENTS.md','/testing/saves/new.json'])assert.equal((await fetch(base+url)).status,404);
    assert.equal((await fetch(base+'/testing/saves/exploration.json',{method:'POST',body:'overwrite'})).status,405);
    assert.equal((await fetch(base+'/index.html')).status,404); // Falls through to the unchanged static handler in dev-server.
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

function preview({query='scenario=example&run=12345678-1234-4321-9876-123456789012',rows={},bad=false,missing=false,badHash=false}={}){
  const calls=[],text='{"format":"native-copy","state":{"untouched":true}}',sha=crypto.createHash('sha256').update(text).digest('hex');
  const platform={loaded:false,decodeSave:async value=>{calls.push('decode');assert.equal(value,text);if(bad)throw Error('invalid native ledger');return JSON.parse(value).state;}};
  const local={database:'postwar-local-v1',readRaw:async function(key){calls.push([this.database,key]);return rows[key];},load:async function(){calls.push('load');if(bad)throw Error('corrupt stored copy');return {savedCopy:true};}};
  const ctx=vm.createContext({window:{},location:{search:'?'+query},document:{body:null,addEventListener(){}},URLSearchParams,URL,TextEncoder,AbortController,setTimeout,clearTimeout,crypto:crypto.webcrypto,CivilLocalSaves:local,CivilSound:{key:'postwar.sound.v1'},CivilPlatform:platform,Engine:{init(){}},Civilization:{setPaused(){}},LumiMakerSdk:{ready(){calls.push('SDK');throw Error('must not touch cloud');}},fetch:async url=>({ok:true,json:async()=>({pages:{room:'火堆'},scenarios:missing?[]:[{id:'example',source:'proof.json',sha256:badHash?'incorrect':sha}]}),text:async()=>{calls.push('source');return text;}})});
  vm.runInContext(fs.readFileSync(path.join(root,'testing/session.js'),'utf8'),ctx);return {ctx,platform,local,calls};
}
test('preview boot isolates storage before the first read and passes the exact decoded state to the game',async()=>{
  const p=preview(),state=await p.platform.load();assert.deepEqual(state,{untouched:true});assert.equal(p.platform.loaded,true);assert.equal(p.platform.sdk,null);
  assert.ok(p.calls.filter(Array.isArray).every(([db])=>db.startsWith('postwar-test-v1-example-')));assert.ok(!p.calls.includes('SDK'));assert.equal(p.ctx.CivilSound.key,'postwar.test.sound.v1');
});
test('preview reload reads its own saved progress instead of overwriting it with the source',async()=>{
  const p=preview({rows:{active:1,slot1:{text:'copy'}}});assert.deepEqual(await p.platform.load(),{savedCopy:true});assert.ok(!p.calls.includes('source'));
});
test('corrupt copies, missing nodes and invalid links never silently become fresh worlds',async()=>{
  for(const options of [{bad:true},{bad:true,rows:{active:1,slot1:{text:'bad'}}},{rows:{active:1}},{missing:true},{query:'scenario=example&run=../normal'},{query:'scenario=example&run=12345678-1234-4321-9876-123456789012&resume=1'}]){
    const p=preview(options);await assert.rejects(p.platform.load());assert.equal(p.platform.loaded,false);assert.ok(p.calls.filter(Array.isArray).every(([db])=>db!=='postwar-local-v1'));assert.ok(!p.calls.includes('SDK'));
  }
});
test('a fixture checksum mismatch blocks decoding and never marks the test ready to save',async()=>{
  const p=preview({badHash:true});await assert.rejects(p.platform.load(),/校验/);assert.equal(p.platform.loaded,false);assert.ok(!p.calls.includes('decode'));
});
