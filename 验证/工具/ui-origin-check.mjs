// Read-only original saves, independent paused UI copies. Not a natural playthrough.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './a7-cdp.mjs';
const out='验证/UI起源设施/改后',b=await connect(9394,out),finishOnly=process.argv.includes('--finish-only');
const rows=finishOnly?JSON.parse(fs.readFileSync(out+'/results.json')).rows:[];
const click=async css=>assert(await b.raw(css),'Cannot reach '+css);
const state=()=>b.read('JSON.stringify([State.game,State.stores,State.civilization])');
async function load(scenario,page,width){
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
 await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${page}&run=origin-${Date.now()}-${width}-check`});
 for(let i=0;i<140&&!await b.read('window.CivilTestSession?.ready');i++)await b.sleep(100);
 assert.equal(await b.read('CivilTestSession.ready'),true);await b.sleep(750);
}
try{
 for(const width of finishOnly?[]:[1280,853,390])for(const [scenario,archived]of [['exploration',false],['public-town',false],['public-city',true],['industry-city',true],['industry-synthetic',true]]){
  await load(scenario,archived?'city':'room',width);const before=await state();
  assert.equal(await b.read("!!document.querySelector('#civilResearchLink')"),false);
  assert.equal(await b.read("!!document.querySelector('#header #location_room')"),!archived);
  assert.equal(await b.read("document.querySelectorAll('#location_research').length"),1);
  const label=width+'-'+scenario;
  if(archived){
   assert.equal(await b.read("document.querySelector('#policyButton').parentElement.id"),'civilRationActions');
   await click('#location_outside');
   // The old A/Left shortcut must not silently reopen an archived page.
   await b.key('ArrowLeft','ArrowLeft',37);assert.equal(await b.read('Engine.activeModule===Outside'),true);
   await click('#civilOriginFacilities > summary');await b.shot(label+'-原镇入口');
   await click('#location_room');
   assert.equal(await b.read('Engine.activeModule===Room'),true);
   assert.equal(await b.read("document.querySelector('#location_outside').getAttribute('aria-current')"),'page');
   assert.equal(await b.read("document.querySelectorAll('#location_room').length"),1);
   assert.equal(await b.read("document.querySelector('#buildBtns').closest('.location').id"),'roomPanel');
   await b.sleep(800);assert.equal(await b.read('Engine.activeModule===Room'),true,'refresh must not eject an explicit visit');
   await b.shot(label+'-旧设施');await click('#civilOriginReturn a');
   assert.equal(await b.read('Engine.activeModule===Outside'),true);
   assert.equal(await b.read("document.activeElement===document.querySelector('#civilOriginFacilities > summary')"),true);
   await b.key('Tab','Tab',9);assert.equal(await b.read('document.activeElement.id'),'location_room');
   await b.key('Enter','Enter',13);assert.equal(await b.read('Engine.activeModule===Room'),true);
  }else{assert.equal(await b.read("!!document.querySelector('#civilOriginFacilities')"),false);await b.shot(label+'-早期保留');}
  await click('#location_research');assert.equal(await b.read('Engine.activeModule===CivilInterface.researchModule'),true);
  assert.equal(await state(),before,'Navigation changed gameplay state');
  assert(await b.read('document.documentElement.scrollWidth<=innerWidth+1'),'Horizontal overflow');
  if(archived){
   await click('#location_council');await b.shot(label+'-配给入口');
   const policyBefore=await b.read('JSON.stringify([State.stores,State.civilization.policy,State.civilization.policyCooldown])');
   await click('#policyButton');assert.equal(await b.read('Events.activeEvent().title'),'同一口锅');
   assert.equal(await b.read('State.civilization.pending'),'policy');
   assert.equal(await b.read('JSON.stringify([State.stores,State.civilization.policy,State.civilization.policyCooldown])'),policyBefore,'Merely opening the original policy dialog charged resources');
  }
  rows.push({width,scenario,archived,stateUnchangedByNavigation:true});
  fs.writeFileSync(out+'/results.json',JSON.stringify({complete:false,rows},null,2)+'\n');console.log('PASS',label);
 }
 // Both the removed shortcut and archived visit obey the same monochrome dark theme.
 assert.equal(rows.length,15,'Complete the full presentation matrix before the final checks');
 await load('industry-synthetic','outside',1280);await click('#saveMenu');await click('#event #theme');await click('#civilOriginFacilities > summary');await click('#location_room');await b.shot('1280-暗色旧设施');
 const colors=await b.read("[...document.querySelectorAll('#civilOriginReturn a')].map(e=>getComputedStyle(e).color)");assert.deepEqual(colors,['rgb(221, 221, 221)']);
 const paused=await state();assert(await b.click('#civilOriginReturn a'));await click('#location_research');assert(await b.click('#civilOriginReturn a'),'Tool follows the actual archive entry, never clicks a hidden tab');assert.equal(await state(),paused);
 await load('new','room',390);assert.equal(await b.read('Events.activeEvent()?.civilPending'),'game_setup');await click('#event #begin');
 assert.equal(await b.read("!!document.querySelector('#header #location_room')"),true);assert.equal(await b.read("!!document.querySelector('#civilOriginFacilities')"),false);assert.equal(await b.read("!!document.querySelector('#civilResearchLink')"),false);await b.shot('390-新开局保留维修间');
 const errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/results.json',JSON.stringify({complete:true,kind:'Paused UI copies, actual input; not natural play',rows,darkColors:colors,newGame:'Setup and first hearth retained',archiveHelper:'Actual visible clicks',errorsScope:finishOnly?'Final dark-theme and new-game checks':'Entire run',errors},null,2)+'\n');
}finally{b.close();}
