import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from '../../验证/工具/a7-cdp.mjs';
const out='发布准备/2026-11-07_开源工程',hub=await connect(9399,out);let game;
async function until(b,expression){for(let n=0;n<150;n++){if(await b.read(expression))return;await b.sleep(100);}throw Error('Timeout '+expression);}
async function readAsync(b,expression){const r=await b.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
try {
 await until(hub,'document.querySelectorAll(".card").length>0');
 assert.equal(await hub.read('document.querySelector("#resume").hidden'),true);
 assert(await hub.raw('[data-scenario="exploration"] .enter'));
 let page;
 for(let n=0;n<100&&!page;n++){page=(await(await fetch('http://127.0.0.1:9399/json')).json()).find(p=>p.type==='page'&&p.url.includes('/test-game.html'));if(!page)await hub.sleep(100);}
 assert(page);game=await connect(9399,out,page.id);
 await until(game,'globalThis.CivilTestSession?.ready&&!globalThis.Events?.activeEvent()');
 const before=await game.read('({run:CivilTestSession.run,scenario:CivilTestSession.scenario,page:CivilTestSession.page,paused:CivilClock.paused})');assert(before.paused);
 await game.select('#testPage','room');assert(await game.raw('#testGo'));
 await until(game,'CivilTestSession.page==="room"');
 const bookmark=await readAsync(game,'import("/testing/bookmark.js").then(m=>m.readBookmark())');assert.equal(bookmark.run,before.run);assert.equal(bookmark.page,'room');
 const dbs=await readAsync(game,'indexedDB.databases().then(rows=>rows.map(r=>r.name))');assert(dbs.some(n=>n.includes(before.run)));assert(!dbs.includes('postwar-local-v1'));
 await hub.send('Page.reload',{ignoreCache:true});await until(hub,'document.querySelector("#resume")?.checkVisibility()');
 const resume=await hub.read('({text:document.querySelector("#resume").textContent,href:document.querySelector("#resume").href})');assert(new URL(resume.href).searchParams.get('run')===before.run);assert(new URL(resume.href).searchParams.get('page')==='room');
 await hub.shot('继续上次测试');assert(await hub.raw('#resume'));
 let resumedPage;
 for(let n=0;n<100&&!resumedPage;n++){resumedPage=(await(await fetch('http://127.0.0.1:9399/json')).json()).find(p=>p.type==='page'&&p.url.includes('resume=1'));if(!resumedPage)await hub.sleep(100);}
 assert(resumedPage);const resumed=await connect(9399,out,resumedPage.id);
 await until(resumed,'globalThis.CivilTestSession?.ready');
 const restored=await resumed.read('({run:CivilTestSession.run,page:CivilTestSession.page,cloud:CivilPlatform.sdk,paused:CivilClock.paused})');assert.equal(restored.run,before.run);assert.equal(restored.page,'room');assert.equal(restored.cloud,null);assert(restored.paused);
 const errors=[...hub.events,...game.events,...resumed.events].filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0);resumed.close();
 fs.writeFileSync(out+'/测试位置UI验证.json',JSON.stringify({passed:true,before,bookmark,resume,restored,databases:dbs,errors},null,2)+'\n');
 console.log('测试位置：真实UI进入、切页、目录刷新和恢复通过；正式本机槽未创建，云存档为空。');
}finally{hub.close();game?.close();}
