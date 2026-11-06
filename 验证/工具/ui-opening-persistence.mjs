// The ordinary entry in a disposable browser context: real UI, no fixture or state injection.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const out='验证/UI阶段导航与首页/正式入口';fs.mkdirSync(out,{recursive:true});
const version=await(await fetch('http://127.0.0.1:9394/json/version')).json(),ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const waits=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){waits.get(m.id)?.(m);waits.delete(m.id);}};
const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waits.set(id,m=>m.error?no(Error(JSON.stringify(m.error))):ok(m.result));ws.send(JSON.stringify({id,method,params}));});
const {browserContextId}=await send('Target.createBrowserContext');let b;const result={};
try{
 const {targetId}=await send('Target.createTarget',{url:'http://127.0.0.1:4180/index.html',browserContextId});b=await connect(9394,out,targetId);
 const until=async x=>{for(let i=0;i<180;i++){if(await b.read(x))return;await b.sleep(100);}throw Error('Timed out '+x);};
 const click=async css=>{await until(`!!document.querySelector(${JSON.stringify(css)})`);assert(await b.raw(css),'Cannot reach '+css);};
 const rawSlot=async slot=>(await b.send('Runtime.evaluate',{expression:`CivilLocalSaves.readRaw('slot${slot}')`,awaitPromise:true,returnByValue:true})).result.value;
 const type=async(css,text)=>{await click(css);await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:4,windowsVirtualKeyCode:65,commands:['selectAll']});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65});await b.send('Input.insertText',{text});};
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await until("window.CivilLanding?.phase==='ready'");assert.equal(await b.read('typeof State'),'undefined');assert.equal(await rawSlot(1),undefined);
 await click('#civilStartButton');await until("!!document.querySelector('#worldSeed')");await b.sleep(1500);assert.equal(await b.read('CivilClock.time'),0);assert.equal(await rawSlot(1),undefined);
 assert.equal(await b.read("document.querySelector('#event #begin').firstChild.textContent"),'进入世界');
 await type('#worldSeed','7417');await b.shot('00-进入世界');await click('#event #begin');await until("CivilLanding.phase==='playing'&&!Events.activeEvent()");await click('#lightButton');await b.sleep(1200);assert(await b.read('CivilClock.time>0'));assert.equal(await b.read('CivilClock.paused'),false);
 const opening=await b.read("[...document.querySelectorAll('#notifications .notification')].reverse().map(e=>e.textContent)");
 assert(opening[0].startsWith('记忆停在'));assert(opening[1].startsWith('金属舱盖'));assert(opening[2].startsWith('房间寒冷'));assert(opening[3].startsWith('火堆熄灭'));result.openingChronology=opening;await b.shot('03-从下往上的开局顺序');
 await click('#speedButton');await click('#event #pause');await until('!Events.activeEvent()');
 // Explicitly save through the ordinary local-slot confirmation.
 await click('#saveMenu');await click('#event #local');await click('#event #slot_1');await click('#event #save');await click('#event #yes');await b.sleep(600);
 const first=await rawSlot(1);assert(first?.text);result.firstSavedAt=first.meta;await b.shot('01-正常开局与存档');
 await b.send('Page.reload');await until("window.CivilLanding?.phase==='ready'");assert.equal(await b.read("document.querySelector('#civilStartButton').textContent"),'继续游戏');assert.equal(await b.read('typeof State'),'undefined');assert.equal((await rawSlot(1)).text,first.text);
 await b.shot('02-继续游戏');await click('#civilStartButton');await until("CivilLanding.phase==='playing'");assert.equal(await b.read('State.civilization.setup.seed'),7417);assert.equal(await b.read("!!document.querySelector('#worldSeed')"),false);assert(await b.read("State.game.fire.value>0"));result.reloadKeepsSeedAndFire=true;
 await click('#speedButton');await click('#event #pause');await until('!Events.activeEvent()');
 // Starting in another slot opens the same seed window and does not erase the first slot.
 const preserved=(await rawSlot(1)).text;await click('#saveMenu');await click('#event #local');await click('#event #slot_2');await click('#event #new');await click('#event #begin');await until("CivilLanding.phase==='setup'&&!!document.querySelector('#worldSeed')");await b.sleep(1200);
 assert.equal(await b.read('CivilClock.time'),0);assert.equal((await rawSlot(1)).text,preserved);assert.equal(await rawSlot(2),undefined);
 await type('#worldSeed','7418');await click('#event #begin');await until("CivilLanding.phase==='playing'&&!Events.activeEvent()");assert.equal(await b.read('State.civilization.setup.seed'),7418);assert.equal((await rawSlot(1)).text,preserved);result.newSlotPreservesFirst=true;
 result.exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(result.exceptions.length,0);result.complete=true;
 fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{b?.close();await send('Target.disposeBrowserContext',{browserContextId});ws.close();}
