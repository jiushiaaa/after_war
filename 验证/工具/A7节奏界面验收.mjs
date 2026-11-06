// Display-only native copies. No progression, state injection, or edits to source exports.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const dir='验证/A7节奏/界面',b=await connect(9382,dir),report={kind:'native display copy; not natural progression',views:[]};
async function clear(){for(let i=0;i<15;i++){const keys=await b.read('[...document.querySelectorAll("#event .button:not(.disabled)")].map(e=>e.id)');if(!keys.length)return;const key=['close','begin','continue','later','read','keep','wood','medicine','automatic'].find(x=>keys.includes(x));assert.ok(key,keys.join(','));await b.raw('#event #'+key);}}
async function pause(){await clear();if(!await b.read('CivilClock.paused')){await b.raw('#speedButton');assert.ok(await b.raw('#event #pause'));}}
async function load(file){await clear();await b.click('#saveMenu');await b.raw('#event #import');await b.raw('#event textarea');await b.send('Input.insertText',{text:fs.readFileSync(file,'utf8')});assert.ok(await b.raw('#event #inspect'));for(let i=0;i<100&&!await b.read('!!document.querySelector("#event #replace")');i++)await b.sleep(100);assert.ok(await b.raw('#event #replace'));await b.sleep(500);await pause();}
await b.send('Page.reload');await b.sleep(1200);
await load('验证/A7/7-全流程/public/village/city/战后文明-存档.json');
for(const width of [1280,853,390]){
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await b.click('#location_city');
 assert.ok(await b.click('#civilGuideGo'));await b.sleep(400);
 const v=await b.read(`(()=>{const el=document.querySelector('#cityInstitution'),guide=document.querySelector('#civilGuide');return {width:innerWidth,doc:document.documentElement.scrollWidth,guide:guide.textContent,rect:guide.getBoundingClientRect().toJSON(),target:el.checkVisibility(),focus:document.activeElement.id,bodyRight:document.querySelector('#cityBody').getBoundingClientRect().right,storesLeft:document.querySelector('#stores').getBoundingClientRect().left};})()`);
 assert.ok(v.doc<=width);assert.ok(v.target);assert.equal(v.focus,'cityInstitution');if(width===1280)assert.ok(v.bodyRight<=v.storesLeft);report.views.push(v);await b.shot(width+'-city-guide');
}
await b.click('#saveMenu');await b.raw('#event #theme');await b.click('#location_city');await b.shot('390-city-dark');report.dark=await b.read('getComputedStyle(document.querySelector("#civilGuide")).color');assert.equal(report.dark,'rgb(221, 221, 221)');await b.click('#saveMenu');await b.raw('#event #theme');
await b.click('#location_road');
await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
const before=await b.read('JSON.stringify(State.stores)');
for(const [key,value]of [['members','3'],['food','18'],['water','27']]){assert.ok(await b.click('#expeditionPrep_'+key));await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:4,commands:['selectAll']});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65});await b.send('Input.insertText',{text:value});await b.sleep(1500);assert.equal(await b.read('document.activeElement.id'),'expeditionPrep_'+key);await b.key('Tab','Tab',9);await b.sleep(100);assert.equal(await b.read('CivilExpedition.prep.'+key),Number(value));}
assert.equal(await b.read('JSON.stringify(State.stores)'),before);report.packing=await b.read('CivilExpedition.prep');await b.shot('1280-packing');
report.errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(report.errors.length,0);fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Guide, three widths, dark and direct packing input verified');b.close();
