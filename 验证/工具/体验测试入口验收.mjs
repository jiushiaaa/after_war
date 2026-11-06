// Browser UI of the isolated test hub. Storage sentinels are constructed isolation tests, not natural-play evidence.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {connect} from './a7-cdp.mjs';
const dir='验证/体验测试入口',catalog=JSON.parse(fs.readFileSync('游戏/testing/catalog.json')),b=await connect(9394,dir);
const asyncRead=async expression=>{const r=await b.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const report={kind:'native snapshot copies + test-hub UI; NOT a fresh natural campaign',startedAt:new Date().toISOString(),catalog:[],layouts:[],navigation:[]};
const url=(e,page=e.pages[0],run='ui-'+crypto.randomUUID())=>'http://127.0.0.1:4180/test-game.html?'+new URLSearchParams({scenario:e.id,page,run});
const wait=async (expression)=>{for(let i=0;i<300;i++){if(await b.read(expression))return;await b.sleep(100);}throw Error('Timed out: '+expression);};
const load=async href=>{await b.send('Page.navigate',{url:href});await wait('!!window.CivilTestSession?.ready||!!document.querySelector("#startupError")');const error=await b.read('document.querySelector("#startupError")?.innerText');assert.equal(error,undefined,error);await b.sleep(120);};
const world=()=>b.read('JSON.stringify([State.game,State.stores,State.civilization])');
const close=async()=>{if(await b.read('!!window.Events?.activeEvent()')){assert.ok(await b.raw('#event #close'),'close event');await wait('!Events.activeEvent()');await b.sleep(350);}};
try{
 await b.send('Page.navigate',{url:'http://127.0.0.1:4180/test.html'});await wait('document.querySelectorAll(".card").length>0');
 for(const width of [1280,853,390]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width===390});await b.sleep(200);assert.equal(await b.read('document.documentElement.scrollWidth<=innerWidth'),true);report.layouts.push({page:'hub',width,overflow:false});await b.shot('目录-'+width);}
 await b.raw('#routes button[data-value="industry"]');assert.equal(await b.read('[...document.querySelectorAll(".card")].some(e=>e.dataset.scenario.startsWith("public-"))'),false);
 await b.raw('#search');await b.send('Input.insertText',{text:'合成人'});assert.equal(await b.read('document.querySelectorAll(".card").length'),1);await b.raw('.enter');await b.sleep(400);
 const targets=(await b.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page'&&t.url.includes('scenario=industry-synthetic'));
 assert.ok(targets.length);report.realNewTabLink=true;await b.send('Target.closeTarget',{targetId:targets.at(-1).targetId});
 // Place a protected byte sentinel in this dedicated Chrome profile's formal slots.
 await asyncRead(`(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('postwar-local-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('entries');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('entries','readwrite'),s=tx.objectStore('entries');s.put(1,'active');for(const k of ['slot1','slot1:1','slot1:2','slot2','slot3'])s.put({text:'protected normal '+k,meta:{sentinel:true}},k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();localStorage.setItem('postwar.sound.v1','{"music":false,"ambient":false,"effects":false,"volume":0.33}');return true;})()`);
 const protectedRead=()=>asyncRead(`(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('postwar-local-v1');q.onsuccess=()=>r(q.result);});const rows=await new Promise(r=>{const q=db.transaction('entries').objectStore('entries').getAll();q.onsuccess=()=>r(q.result);});db.close();return JSON.stringify([rows,localStorage.getItem('postwar.sound.v1')]);})()`);
 const protectedBefore=await protectedRead();
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:950,deviceScaleFactor:1,mobile:false});
 for(const e of catalog.scenarios){
  await load(url(e));const facts=await b.read(`({at:State.civilization.elapsed,paused:CivilClock.paused,db:CivilLocalSaves.database,unavailable:${JSON.stringify(e.pages)}.filter(p=>!CivilTestSession.available(p))})`);assert.equal(facts.at,e.elapsed||0);assert.equal(facts.paused,true);assert.deepEqual(facts.unavailable,[]);assert.ok(facts.db.startsWith('postwar-test-v1-'+e.id+'-'));report.catalog.push({id:e.id,...facts});console.log('loaded '+e.id);
  if(e.id==='new'){assert.equal(await b.read('State.game.population'),0);continue;}
  await close();const before=await world();
  for(const page of e.pages){await b.select('#testPage',page);await b.raw('#testGo');await b.sleep(60);assert.equal(await b.read('CivilTestSession.page'),page);if(['history','archives','ending'].includes(page))assert.ok(await b.read('!!Events.activeEvent()'));await close();report.navigation.push({id:e.id,page});}
  assert.equal(await world(),before,'page navigation changed world '+e.id);
 }
 report.normalStorageUnchanged=protectedBefore===await protectedRead();assert.ok(report.normalStorageUnchanged);
 const e=catalog.scenarios.find(e=>e.id==='exploration'),href=url(e,'road');await load(href);const original=await b.read('State.civilization.elapsed');await b.raw('#testPause');await b.sleep(1250);await b.raw('#testPause');const advanced=await b.read('State.civilization.elapsed');assert.ok(advanced>original);await b.raw('#testSave');await wait('document.querySelector("#testNotice").textContent.includes("已保存")');await b.send('Page.reload');await wait('!!window.CivilTestSession?.ready');assert.equal(await b.read('State.civilization.elapsed'),advanced);assert.equal(await b.read('CivilClock.paused'),true);report.resume={source:original,saved:advanced,restored:advanced};
 const db=await b.read('CivilLocalSaves.database');await b.raw('#testReset');await b.sleep(500);const reset=(await b.send('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url.includes('scenario=exploration')&&t.url!==href);assert.ok(reset);assert.notEqual(new URL(reset.url).searchParams.get('run'),new URL(href).searchParams.get('run'));await b.send('Target.closeTarget',{targetId:reset.targetId});await load(reset.url);assert.equal(await b.read('State.civilization.elapsed'),original);assert.notEqual(await b.read('CivilLocalSaves.database'),db);report.resetIsSeparate=true;
 for(const id of ['public-city','industry-echo','industry-launch']){
  const e=catalog.scenarios.find(e=>e.id===id);await load(url(e));for(const width of [1280,853,390]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width===390});await b.sleep(900);const info=await b.read('({width:innerWidth,scroll:document.documentElement.scrollWidth,bar:document.querySelector("#testToolbar").getBoundingClientRect().top})');assert.ok(info.scroll<=width);assert.ok(info.bar>=0);report.layouts.push({page:id,...info});await b.shot(id+'-'+width);}
 }
 // Invalid input remains in an isolated namespace and never creates an empty fallback save.
 await b.send('Page.navigate',{url:'http://127.0.0.1:4180/test-game.html?scenario=missing&run=invalid-test-123456'});await wait('!!document.querySelector("#startupError")');assert.equal(await b.read('CivilPlatform.loaded'),false);assert.equal(await b.read('typeof State'), 'undefined');await b.shot('损坏链接-不替换');report.invalidLinkBlocks=true;
 assert.equal(await protectedRead(),protectedBefore);report.errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(report.errors.length,0);
 report.finishedAt=new Date().toISOString();report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));b.close();}
