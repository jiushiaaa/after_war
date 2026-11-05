// A separate imported display copy. These UI checks are not part of either natural main line.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const dir='验证/A7/7-全流程/界面复核/modern',b=await connect(9372,dir),report={kind:'native UI on independent copy of the public supply-recovery export',views:[]};
await b.send('Page.reload');await b.sleep(2200);if(!await b.read('CivilClock.paused')){await b.click('#speedButton');await b.raw('#event #pause');}
for(const width of [1280,853,390]){
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.sleep(200);await b.click('#location_room');await b.click('#location_research');
 if(!await b.read('document.querySelector("#modernDesk").open'))assert.ok(await b.click('#modernDesk > summary'));
 const view=await b.read(`(()=>{const d=document.querySelector('#modernDesk'),i=document.querySelector('#civilResearchIntro'),s=document.querySelector('#stores');return {width:innerWidth,docWidth:document.documentElement.scrollWidth,desk:d.getBoundingClientRect().toJSON(),intro:i.getBoundingClientRect().toJSON(),stores:s.getBoundingClientRect().toJSON(),color:getComputedStyle(document.querySelector('#modernStatus')).color};})()`);
 assert.equal(view.width,width);assert.ok(view.docWidth<=width);assert.ok(view.desk.right<=width);assert.equal(view.color,'rgb(34, 34, 34)');if(width===1280){assert.ok(view.desk.right+20<view.stores.x);assert.ok(view.intro.right+20<view.stores.x);}
 report.views.push(view);await b.shot(width+'-after');
}
await b.click('#saveMenu');await b.raw('#event #theme');await b.sleep(700);await b.click('#location_research');report.dark=await b.read("getComputedStyle(document.querySelector('#modernStatus')).color");assert.equal(report.dark,'rgb(221, 221, 221)');await b.shot('390-dark');await b.click('#saveMenu');await b.raw('#event #theme');
const before=await b.read('({mode:State.civilization.modern.mode,knowledge:State.stores.knowledge,actions:State.civilization.modern.actions.length})');
await b.select('#modernTask','mode_materials');assert.ok(await b.click('#modern_commit'));assert.equal(await b.read('State.civilization.modern.mode'),'materials');
await b.select('#modernTask','mode_balanced');assert.ok(await b.click('#modern_commit'));const after=await b.read('({mode:State.civilization.modern.mode,knowledge:State.stores.knowledge,actions:State.civilization.modern.actions.length})');assert.equal(after.mode,'balanced');assert.equal(after.actions-before.actions,2);assert.ok(Math.abs(before.knowledge-after.knowledge-8)<1e-6);report.selection={before,after};report.errors=b.events;assert.equal(b.events.filter(e=>e.method==='Runtime.exceptionThrown').length,0);
fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Three widths, dark contrast, no store overlap, native selected-action payment verified');b.close();
