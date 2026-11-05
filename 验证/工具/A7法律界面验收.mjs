// Uses the independent display copy on 9372. No writes to either main-line world.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const dir='验证/A7/7-全流程/界面复核/laws',b=await connect(9372,dir),report={kind:'independent native city export, normal UI only',views:[]};
await b.send('Page.reload');await b.sleep(1800);
for(let n=0;n<10;n++){
 const x=await b.read('({event:Events.activeEvent()?.title,buttons:[...document.querySelectorAll("#event .button:not(.disabled)")].map(e=>e.id),paused:!!CivilClock.paused})');
 if(x.event){const id=['continue','automatic','repair','wood','medicine','close'].find(k=>x.buttons.includes(k));assert.ok(id,'Unexpected copy event '+x.event);await b.raw('#event #'+id);continue;}
 if(!x.paused){await b.click('#speedButton');await b.raw('#event #pause');continue;}break;
}
assert.equal(await b.read('CivilClock.paused'),true);
for(const width of [1280,853,390]){
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.sleep(200);assert.ok(await b.click('#location_council'));
 if(!await b.read('document.querySelector("#civicLaws").open'))assert.ok(await b.click('#civicLaws > summary'));
 const v=await b.read('({width:innerWidth,docWidth:document.documentElement.scrollWidth,law:document.querySelector("#civilLawPage").getBoundingClientRect().toJSON(),stores:document.querySelector("#stores").getBoundingClientRect().toJSON(),color:getComputedStyle(document.querySelector("#civicCurrent")).color,domains:document.querySelectorAll("#civicLaws dt").length})');
 assert.equal(v.width,width);assert.equal(v.domains,8);assert.equal(v.color,'rgb(34, 34, 34)');assert.ok(v.docWidth<=width&&v.law.right<=width);if(width===1280)assert.ok(v.law.right+20<v.stores.x);report.views.push(v);await b.shot(width+'-after');
}
await b.click('#saveMenu');await b.raw('#event #theme');report.dark=await b.read('getComputedStyle(document.querySelector("#civicCurrent")).color');assert.equal(report.dark,'rgb(221, 221, 221)');await b.shot('390-dark');await b.click('#saveMenu');await b.raw('#event #theme');
report.errors=b.events;assert.equal(b.events.filter(x=>x.method==='Runtime.exceptionThrown').length,0);fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Law page: eight domains, three widths, light/dark contrast, no inventory overlap');b.close();
