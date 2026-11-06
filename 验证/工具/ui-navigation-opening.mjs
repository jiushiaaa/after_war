// Real browser input in isolated preview copies. These checks are not a natural playthrough.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './a7-cdp.mjs';
const out='验证/UI阶段导航与首页/改后',b=await connect(9394,out),openingOnly=process.argv.includes('--opening-only'),rows=openingOnly?JSON.parse(fs.readFileSync(out+'/matrix.json')).rows:[];
const click=async css=>assert(await b.raw(css),'Cannot reach '+css);
const state=()=>b.read('JSON.stringify([State.game,State.stores,State.civilization])');
async function until(expression){for(let i=0;i<180;i++){if(await b.read(expression))return;await b.sleep(100);}throw Error('Timed out: '+expression);}
async function viewport(width){await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});}
async function load(scenario,width){
 await viewport(width);await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${/town|exploration/.test(scenario)?'room':'city'}&run=nav-${Date.now()}-${width}-check`});
 await until('window.CivilTestSession?.ready');await b.sleep(800);
}
async function type(css,text){await click(css);await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:4,commands:['selectAll']});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:4});await b.send('Input.insertText',{text});}
try{
 for(const [scenario,width]of openingOnly?[]:[['exploration',1280],['public-town',1280],['industry-town',1280],['public-city',1280],['industry-city',1280],['public-budget',1280],['industry-synthetic',1280],['public-budget',853],['industry-synthetic',853],['public-city',390],['public-budget',390],['industry-synthetic',390]]){
  await load(scenario,width);const before=await state(),tabs=await b.read("[...document.querySelectorAll('#header .headerButton')].map(e=>e.id)");
  const navigation=await b.read("({main:[...document.querySelectorAll('#header > .headerButton')].map(e=>e.textContent),secondary:[...document.querySelectorAll('#civilNavPlaces .headerButton')].map(e=>e.textContent)})");
  await b.shot(width+'-'+scenario+'-导航');
  for(const id of tabs){await click('#'+id);assert(await b.read(`document.querySelector('#${id}').classList.contains('selected')`));}
  if(tabs.includes('location_city')){
   await click('#location_city');const choices=await b.read("[...document.querySelectorAll('#civilPlaceSelect option')].map(e=>e.value)");
   if(choices.length>1){for(const value of choices){await b.select('#civilPlaceSelect',value);assert.equal(await b.read('CivilConurbationView.selected'),value);assert(await b.read('document.documentElement.scrollWidth<=innerWidth+1'),'Scope overflow');}await b.shot(width+'-'+scenario+'-范围');}
   if(navigation.secondary.length){await click('#civilNavMore > summary');await b.shot(width+'-'+scenario+'-地方事务');await b.key('Tab','Tab',9);assert(await b.read("!!document.activeElement.closest('#civilNavMore')"));await b.key('Enter','Enter',13);assert.equal(await b.read("document.querySelector('#civilNavMore').open"),false);}
  }
  assert.equal(await state(),before,'Navigation changed the world');
  assert(await b.read('document.documentElement.scrollWidth<=innerWidth+1'),'Horizontal overflow');
  assert.equal(await b.read("document.querySelectorAll('#domainEntry,#councilLocation,#civilResearchLink,[id^=metroCity_select_]').length"),0);
  rows.push({scenario,width,...navigation,worldUnchanged:true});fs.writeFileSync(out+'/matrix.json',JSON.stringify({rows,exceptions:b.events.filter(e=>e.method==='Runtime.exceptionThrown')},null,2)+'\n');console.log('PASS',scenario,width);
 }
 // The dark theme uses the same controls, without blue browser-default links.
 if(!openingOnly){await load('industry-synthetic',1280);await click('#saveMenu');await click('#event #theme');await click('#civilNavMore > summary');await b.shot('1280-暗色导航');
 rows.push({theme:'dark',ink:await b.read("getComputedStyle(document.querySelector('#civilNavMore summary')).color")});}
 // Fresh preview uses the real landing and seed flow, while retaining test pause after confirmation.
 for(const width of [1280,853,390]){
  await viewport(width);await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=new&run=opening-${Date.now()}-${width}`});await until("window.CivilLanding?.phase==='ready'");
  assert.equal(await b.read('typeof State'),'undefined');assert.equal(await b.read('typeof CivilClock'),'undefined');
  assert.deepEqual(await b.read("[...document.querySelectorAll('button')].filter(e=>e.checkVisibility()).map(e=>e.id)"),['civilStartButton']);
  await b.sleep(200);
  const center=await b.read("(()=>{const r=document.querySelector('#civilStartButton').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight};})()");assert(Math.abs(center.x-center.w/2)<2&&Math.abs(center.y-center.h/2)<2);
  await b.shot(width+'-留白首页');await click('#civilStartButton');await until("CivilLanding.phase==='setup'&&!!document.querySelector('#worldSeed')");await b.sleep(600);
  const untouched=await state();await b.sleep(1300);assert.equal(await b.read('CivilClock.time'),0);assert.equal(await state(),untouched);assert.equal(await b.read("document.querySelector('#content').checkVisibility()"),false);
  await b.key('Escape','Escape',27);assert.equal(await b.read('Events.activeEvent().civilPending'),'game_setup');
  await type('#worldSeed','-1');await click('#event #begin');assert(await b.read("!!document.querySelector('#worldSetupError')"));assert.equal(await b.read('CivilLanding.phase'),'setup');assert.equal(await b.read('CivilClock.time'),0);
  await type('#worldSeed','7417');await b.shot(width+'-种子设定');await click('#event #begin');await until("CivilLanding.phase==='playing'&&!Events.activeEvent()");
  assert.equal(await b.read('State.civilization.setup.seed'),7417);assert.equal(await b.read('CivilClock.paused'),true);assert.equal(await b.read("document.querySelector('#content').checkVisibility()"),true);await b.shot(width+'-正式进入');
  rows.push({opening:width,seed:7417,noWorldBeforeClick:true,invalidSeedBlocked:true,setupClockHeld:true});console.log('PASS opening',width);
 }
 const exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 fs.writeFileSync(out+'/results.json',JSON.stringify({complete:true,rows,exceptions},null,2)+'\n');
}finally{b.close();}
