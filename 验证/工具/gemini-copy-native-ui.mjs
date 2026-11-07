// Fresh opening and native import in an isolated test slot. Only real UI input advances play.
import fs from 'node:fs';import assert from 'node:assert/strict';import z from 'node:zlib';import {connect} from './a7-cdp.mjs';
const port=9447,out='验证/Gemini文案导入/UI',url=`http://127.0.0.1:4180/test-game.html?scenario=new&page=room&run=gemini-start-${Date.now()}`;
const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json(),b=await connect(port,out,target.id);
async function until(expr){for(let i=0;i<250;i++){if(await b.read(expr))return;await b.sleep(100);}throw Error('Timed out '+expr);}
const click=async css=>assert.ok(await b.raw(css),'Cannot reach '+css);
try{
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await until('!!document.querySelector("#civilStartButton")');await click('#civilStartButton');await until('!!document.querySelector("#worldSeed")');
 assert.equal(await b.read('document.querySelector("#begin").textContent'),'进入世界');await b.shot('1280-new-seed');await click('#begin');await until('State.civilization.setup.confirmed');
 const opening=await b.read('({messages:[...document.querySelectorAll("#notifications .notification")].map(e=>e.textContent),elapsed:State.civilization.elapsed,ruleset:State.civilization.ruleset,seed:State.civilization.census.seed})');
 await click('#lightButton');await b.shot('1280-new-lit');
 // Import an unchanged original through the ordinary textarea/validation/confirmation flow.
 const source='验证/存档/'+fs.readdirSync('验证/存档').find(f=>f.endsWith('278.json')),raw=fs.readFileSync(source,'utf8'),envelope=JSON.parse(raw),saved=(envelope.encoding?JSON.parse(z.gunzipSync(Buffer.from(envelope.data,'base64'))):envelope).state;
 await click('#saveMenu');await click('#event #import');await click('#event textarea');await b.send('Input.insertText',{text:raw});assert.equal(await b.read('document.querySelector("#event textarea").value'),raw);
 await click('#event #inspect');await until('!!document.querySelector("#event #replace")');await click('#event #replace');await until(`State.civilization.elapsed>=${saved.civilization.elapsed} && !Events.activeEvent()`);
 const imported=await b.read('({elapsed:State.civilization.elapsed,seed:State.civilization.census.seed,population:State.game.population,paused:CivilClock.paused})');
 assert.equal(imported.seed,saved.civilization.census.seed);assert.ok(imported.elapsed-saved.civilization.elapsed<20);assert.equal(imported.population,saved.game.population);await b.shot('1280-native-import-278');
 const errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0);
 fs.writeFileSync(out+'/native-input.json',JSON.stringify({kind:'Actual UI input in an isolated copy; short opening/import only, not a full natural playthrough',opening,source,imported,literalImportUnchanged:true,errors},null,2)+'\n');console.log(JSON.stringify({opening,imported,errors:errors.length}));
}finally{b.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);}
