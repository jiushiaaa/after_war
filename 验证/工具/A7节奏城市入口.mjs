// Read-only source exports, imported as separate UI display copies; not natural progression.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const dir='验证/A7节奏/界面/城市入口',b=await connect(9382,dir),report={kind:'native display copies; no natural progression',cases:[]};
async function clear(){for(let i=0;i<10;i++){const keys=await b.read('[...document.querySelectorAll("#event .button:not(.disabled)")].map(e=>e.id)');if(!keys.length)return;const id=['close','later','continue','keep','wood','record','read'].find(x=>keys.includes(x));assert.ok(id,keys.join(','));await b.raw('#event #'+id);}}
await b.send('Page.reload');await b.sleep(1000);
for(const n of [213,217,223]){
 await clear();const source='验证/存档/'+fs.readdirSync('验证/存档').find(f=>f.endsWith(n+'.json'));
 await b.click('#saveMenu');await b.raw('#event #import');await b.raw('#event textarea');await b.send('Input.insertText',{text:fs.readFileSync(source,'utf8')});await b.raw('#event #inspect');await b.sleep(700);assert.ok(await b.raw('#event #replace'));await b.sleep(500);await clear();if(!await b.read('CivilClock.paused')){await b.raw('#speedButton');await b.raw('#event #pause');}
 for(const width of [1280,853,390]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await b.click('#location_city');assert.ok(await b.click('#civilGuideGo'));await b.sleep(300);
  const v=await b.read(`(()=>{const g=CivilGuide.steps(State),e=document.querySelector('#civilGuide');return {width:innerWidth,scroll:document.documentElement.scrollWidth,goal:g.goal,target:g.visit?.target,focus:document.activeElement.id,visible:e.checkVisibility(),tab:CivilConurbationView.selected};})()`);assert.ok(v.visible);assert.ok(v.scroll<=width);if(v.target)assert.equal(v.focus,v.target);report.cases.push({source,...v});await b.shot(n+'-'+width);
 }
}
report.errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(report.errors.length,0);fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));b.close();console.log('Three city/network guide stages remain visible and focus real destinations while paused, at three widths.');
