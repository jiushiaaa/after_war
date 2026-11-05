// Constructed storage-failure test in the dedicated 9372 browser. Never used as natural evidence.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const dir='验证/A7/6-档案存档/浏览器',b=await connect(Number(process.argv[2]||9372),dir),checks=[];
const ar=async expression=>{const x=await b.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value;};
const click=async css=>assert.ok(await b.click(css),'visible input '+css);
const input=async(css,text)=>{await click(css);await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:4,windowsVirtualKeyCode:65,commands:['selectAll']});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:4});await b.send('Input.insertText',{text});};
await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
await b.send('Page.reload');await b.sleep(1200);
assert.equal(await b.read('State.civilization.setup.confirmed'),false);const initial=await b.read('State.civilization.elapsed');await b.sleep(1300);assert.equal(await b.read('State.civilization.elapsed'),initial);
await input('#worldSeed','-1');await click('#event #begin');assert.equal(await b.read('!!document.querySelector("#worldSetupError")'),true);
await input('#worldSeed','7417');await click('#event #begin');assert.equal(await b.read('State.civilization.setup.seed'),7417);checks.push('seed form and paused opening; invalid seed rejected');
await b.shot('1280-新档');
const menu=async slot=>{if(!await b.read('!!Events.activeEvent()'))await click('#saveMenu');if(await b.read('Events.activeScene')!=='start'){await click('#event #back');if(await b.read('Events.activeScene')!=='start')await click('#event #back');}await click('#event #local');await b.sleep(250);await click('#event #slot_'+slot);};
const save=async slot=>{await menu(slot);await click('#event #save');await click('#event #yes');await b.sleep(550);};
await save(1);const first=await ar('CivilLocalSaves.readRaw("slot1")');await b.sleep(1400);await save(1);const second=await ar('CivilLocalSaves.readRaw("slot1")');await save(1);
assert.equal((await ar('CivilLocalSaves.readRaw("slot1:2")')).text,first.text);assert.equal((await ar('CivilLocalSaves.readRaw("slot1:1")')).text,second.text);checks.push('actual IndexedDB atomic two-backup rotation preserves exact prior export bytes');
await save(2);await save(3);assert.ok(await ar('CivilLocalSaves.readRaw("slot2")'));assert.ok(await ar('CivilLocalSaves.readRaw("slot3")'));checks.push('all three native save slots write independently');await b.shot('1280-三个槽');
await menu(1);await click('#event #load');await b.sleep(700);await click('#event #replace');await b.sleep(1000);assert.equal(await b.read('CivilLocalSaves.active'),1);
const protectedBackup=await ar('CivilLocalSaves.readRaw("slot1:1")');
// Deliberately corrupt only this test browser's copied local slot. Never edits native-export originals.
await ar(`new Promise((resolve,reject)=>{const r=indexedDB.open('postwar-local-v1',1);r.onsuccess=()=>{const tx=r.result.transaction('entries','readwrite');tx.objectStore('entries').put({text:'deliberately invalid A7 test'},'slot1');tx.oncomplete=()=>{r.result.close();resolve(true)};tx.onerror=()=>reject(tx.error)}})`);
await b.send('Page.reload');await b.sleep(1500);assert.ok(await b.read('!!document.querySelector("#startupError")'));assert.equal(await b.read('CivilPlatform.loaded'),false);
assert.equal((await ar('CivilLocalSaves.readRaw("slot1")')).text,'deliberately invalid A7 test');assert.equal((await ar('CivilLocalSaves.readRaw("slot1:1")')).text,protectedBackup.text);checks.push('corrupt startup blocks world and saving, leaving original and backups exact');await b.shot('1280-损坏保护');
const n=await b.read('[...document.querySelectorAll("#startupError button")].findIndex(e=>e.textContent==="检查槽1备份1")');await click('#startupError button:nth-of-type('+(n+1)+')');await b.sleep(1200);assert.equal(await b.read('CivilLocalSaves.active'),null);assert.equal(await b.read('State.civilization.setup.seed'),7417);
await save(3);checks.push('valid backup restores through UI read-only, explicit other-slot save resumes safely');
await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await b.shot('390-本地槽');
fs.writeFileSync(dir+'/report.json',JSON.stringify({kind:'constructed storage failure + real UI',checks,errors:b.events},null,2));console.log({checks,errors:b.events});b.close();
