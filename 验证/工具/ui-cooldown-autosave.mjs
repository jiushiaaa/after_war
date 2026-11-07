// Isolated browser profile; gameplay changes only through native mouse/keyboard input.
// Runtime reads inspect progress, layout and stored bytes; no time/resources are injected.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './a7-cdp.mjs';
const out='验证/UI冷却与自动保存',b=await connect(9398,out),finish=process.argv.includes('--finish'),results=finish?JSON.parse(fs.readFileSync(out+'/results.json','utf8')):{cooldowns:[],dialogs:[]};
async function until(expression,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){if(await b.read(expression))return;await b.sleep(100);}throw Error('Timeout: '+expression);}
async function click(css){assert(await b.raw(css),'Unreachable '+css);}
async function pause(){if(!await b.read('CivilClock.paused')){await click('#speedButton');await click('#pause');await until('!Events.activeEvent()');}}
async function resume(){if(await b.read('CivilClock.paused')){await click('#speedButton');await click('#pause');await until('!Events.activeEvent()');}}
async function theme(dark){if(await b.read('CivilPreferences.prefs.dark')!==dark)await click('#themeMenu');}
async function size(width){await b.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:width===390});await b.sleep(250);}
async function bar(css){return b.read(`(()=>{const e=document.querySelector(${JSON.stringify(css)}),p=e.querySelector('.cooldown'),r=p.getBoundingClientRect(),q=e.getBoundingClientRect();return {text:e.childNodes[0].textContent,disabled:e.classList.contains('disabled'),left:State.cooldown[e.id],width:r.width,height:r.height,buttonWidth:q.width,isolation:getComputedStyle(e).isolation,color:getComputedStyle(p).backgroundColor,ink:getComputedStyle(e).color,inside:r.x>=q.x&&r.right<=q.right&&r.y>=q.y&&r.bottom<=q.bottom};})()`);}
try{
 if(!finish){
 await size(1280);await resume();await theme(false);
 await click('#stokeButton');const first=await bar('#stokeButton');await b.sleep(1600);const later=await bar('#stokeButton');
 assert(first.disabled&&first.width>later.width&&later.width>0);assert.equal(first.isolation,'isolate');assert(first.inside);await b.shot('改后-添火-日间');
 results.cooldowns.push({action:'添火',first,later});
 await click('#location_outside');await click('#gatherButton');await b.sleep(1300);await pause();
 const stopped=await bar('#gatherButton');await b.sleep(1600);assert.deepEqual(await bar('#gatherButton'),stopped);assert(stopped.disabled&&stopped.width>0&&stopped.inside);
 await b.shot('改后-砍柴-日间');results.cooldowns.push({action:'砍柴-暂停',...stopped});
 for(const width of [1280,390])for(const dark of [false,true]){
  await size(width);await theme(dark);const row=await bar('#gatherButton');assert(row.inside&&row.width>0);assert.equal(row.color,dark?'rgb(69, 70, 64)':'rgb(221, 221, 221)');
  await b.shot(width+'-砍柴-'+(dark?'夜间':'日间'));results.cooldowns.push({width,dark,...row});
  const before=await b.read('JSON.stringify(State)');await click('#restartMenu');
  const dialog=await b.read(`(()=>{const e=document.querySelector('#event');return {title:e.querySelector('.eventTitle').textContent,text:e.querySelector('#description').textContent,buttons:[...e.querySelectorAll('#exitButtons .button')].map(b=>b.childNodes[0].textContent),width:e.getBoundingClientRect().width,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};})()`);
  assert.deepEqual(dialog.buttons,['是','否']);assert.equal(dialog.text.trim(),'重开游戏？');assert(dialog.pageWidth<=width);await b.shot(width+'-重开-'+(dark?'夜间':'日间'));
  await click('#cancel');await until('!Events.activeEvent()');assert.equal(await b.read('JSON.stringify(State)'),before);results.dialogs.push({width,dark,...dialog});
 }
 assert.equal(await b.read("document.querySelectorAll('.menu #saveMenu').length"),0);
 await size(1280);await theme(false);await resume();const active=await bar('#gatherButton');await b.sleep(1000);assert((await bar('#gatherButton')).width<active.width);await pause();
 // Wait for the existing automatic save timer; never invoke a save function.
 await until('!CivilLocalSaves.dirty&&!CivilLocalSaves.busy',40000);
 // Await read-only storage inspection without invoking a save operation.
 const saved=await b.send('Runtime.evaluate',{expression:"(async()=>{const r=await CivilLocalSaves.readRaw('slot'+CivilLocalSaves.active);return {saved:!!r,seed:State.civilization.setup.seed,wood:State.stores.wood,fire:State.game.fire.value,elapsed:State.civilization.elapsed,status:document.querySelector('#saveNotify').textContent};})()",awaitPromise:true,returnByValue:true});
 results.autosave=saved.result.value;assert(results.autosave.saved);assert.equal(results.autosave.status,'');
 await b.send('Page.reload',{ignoreCache:true});await until("document.querySelector('#civilStartButton')?.checkVisibility()");await click('#civilStartButton');await until("document.querySelector('#stokeButton')?.checkVisibility()");await pause();
 assert.equal(await b.read('State.civilization.setup.seed'),results.autosave.seed);assert.equal(await b.read('State.stores.wood'),results.autosave.wood);assert.equal(await b.read('State.game.fire.value'),results.autosave.fire);
 const savedText=(await b.send('Runtime.evaluate',{expression:"CivilLocalSaves.readRaw('slot'+CivilLocalSaves.active).then(r=>r.text)",awaitPromise:true,returnByValue:true})).result.value;
 await click('#restartMenu');await click('#begin');await until("document.querySelector('#worldSeed')?.checkVisibility()");
 assert.equal(await b.read('State.civilization.setup.confirmed'),false);
 const after=(await b.send('Runtime.evaluate',{expression:"CivilLocalSaves.readRaw('slot'+CivilLocalSaves.active).then(r=>r.text)",awaitPromise:true,returnByValue:true})).result.value;assert.equal(after,savedText);
 const backup=(await b.send('Runtime.evaluate',{expression:"CivilLocalSaves.readRaw('restart:latest').then(r=>CivilPlatform.decodeSave(r.text)).then(s=>({seed:s.civilization.setup.seed,wood:s.stores.wood}))",awaitPromise:true,returnByValue:true})).result.value;
 assert.equal(backup.seed,results.autosave.seed);assert.equal(backup.wood,results.autosave.wood);results.restartBackup=backup;
 }
 const newSeed=(results.autosave.seed+1)%2147483647;await click('#worldSeed');
 // Headless Chrome does not consistently map macOS Command+A; use native navigation/deletion.
 const length=await b.read("document.querySelector('#worldSeed').value.length");
 for(let i=0;i<length;i++)await b.key('ArrowRight','ArrowRight',39);
 for(let i=0;i<length;i++)await b.key('Backspace','Backspace',8);
 await b.send('Input.insertText',{text:String(newSeed)});await click('#begin');await until('!Events.activeEvent()');
 assert.equal(await b.read('State.civilization.setup.seed'),newSeed);await click('#lightButton');await b.sleep(1300);assert((await bar('#stokeButton')).width>0);await b.shot('改后-新局生火');await pause();
 await until('!CivilLocalSaves.dirty&&!CivilLocalSaves.busy',40000);
 await b.send('Page.reload',{ignoreCache:true});await until("document.querySelector('#civilStartButton')?.checkVisibility()");await click('#civilStartButton');await until("document.querySelector('#stokeButton')?.checkVisibility()");assert.equal(await b.read('State.civilization.setup.seed'),newSeed);await pause();
 results.newWorld={seed:newSeed,restored:true};results.exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(results.exceptions.length,0);
 results.complete=true;console.log(JSON.stringify(results,null,2));
}finally{fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');b.close();}
