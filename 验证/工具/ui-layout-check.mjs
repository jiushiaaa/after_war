// Presentation regression against immutable native test nodes. Not a natural-play run.
// Uses actual mouse, wheel and keyboard inputs; evaluations only observe DOM/game state.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './a7-cdp.mjs';
const out='验证/UI宽屏与弹窗/改后',b=await connect(9394,out),rows=[];
const wait=async predicate=>{for(let i=0;i<100;i++){if(await b.read(predicate))return;await b.sleep(100);}throw Error('Timed out: '+predicate);};
const click=async css=>assert.ok(await b.raw(css),'unreachable '+css);
const wheel=async(x,y,dy)=>{await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:dy});await b.sleep(250);};
const state=()=>b.read('JSON.stringify([State.game,State.stores,State.civilization])');
const geometry=()=>b.read(`(()=>{
 const rect=id=>document.querySelector(id)?.getBoundingClientRect().toJSON(),main=rect('#content'),stores=rect('#storesContainer');
 return {width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,main,stores,storeCount:document.querySelectorAll('#storesContainer').length,
   visiblePanels:[...document.querySelectorAll('.location')].filter(e=>e.checkVisibility()).map(e=>e.id),
   linkColors:[...document.querySelectorAll('#main a')].filter(e=>e.checkVisibility()).map(e=>getComputedStyle(e).color),
   bodyOverflow:document.querySelector('#cityBody')&&getComputedStyle(document.querySelector('#cityBody')).overflow,
   researchOverflow:document.querySelector('#civilResearchPanel')&&getComputedStyle(document.querySelector('#civilResearchPanel')).overflow};
})()`);
async function load(scenario,page,width,height){
 await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
 await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${page}&run=layout-${Date.now()}-${Math.random().toString(16).slice(2)}`});
 await wait('window.CivilTestSession?.ready === true');await b.sleep(900);
}
async function modal(label){
 await click('#historyMenu');await b.sleep(250);
 const before=await b.read(`({y:scrollY,lockY:Events._pageLock.y,event:document.querySelector('#event').getBoundingClientRect().toJSON(),h:innerHeight,w:innerWidth})`);
 assert.equal(before.y,before.lockY,'opening history jumps the background');
 assert.ok(before.event.top>=0&&before.event.bottom<=before.h&&before.event.left>=0&&before.event.right<=before.w,'dialog must fit screen');
 // Both short and paginated long categories keep the same window size.
 await click('#history_governance');await b.sleep(250);
 const needsScroll=await b.read('document.querySelector(".civil-event-body").scrollHeight>document.querySelector(".civil-event-body").clientHeight');
 await wheel(before.event.left+40,before.event.top+120,10000);
 const after=await b.read(`({y:scrollY,scroll:document.querySelector('.civil-event-body').scrollTop,close:document.querySelector('.civil-event-close').getBoundingClientRect().toJSON(),event:document.querySelector('#event').getBoundingClientRect().toJSON()})`);
 assert.equal(after.y,before.y);if(needsScroll)assert.ok(after.scroll>0,'history must scroll inside');assert.deepEqual(after.event,before.event);
 assert.ok(after.close.top>=before.event.top&&after.close.bottom<before.event.bottom,'close stays visible');
 await wheel(2,Math.round(before.h/2),10000);assert.equal(await b.read('scrollY'),before.y,'backdrop wheel scrolls background');
 await click('.civil-event-close');await b.sleep(300);
 assert.equal(await b.read('scrollY'),before.y);assert.equal(await b.read('document.querySelector("#content").inert'),false);
 await click('#historyMenu');await b.sleep(250);
 await click('#history_governance');await b.sleep(250);
 assert.equal(await b.read('document.querySelector(".civil-event-body").scrollTop'),0,'category resets only inner scroll');
 assert.deepEqual(await b.read('document.querySelector("#event").getBoundingClientRect().toJSON()'),before.event,'category changes modal size');
 await b.shot(label+'-发展史');
 for(let i=0;i<8;i++){await b.key('Tab','Tab',9);assert.equal(await b.read('!!document.activeElement.closest("#event")'),true,'focus escapes');}
 await b.key('Escape','Escape',27);await b.sleep(300);
 assert.equal(await b.read('!!Events.activeEvent()'),false);assert.equal(await b.read('scrollY'),before.y);
 return {before,after,needsScroll};
}
try{
 const cases=[['industry-synthetic','domain'],['industry-synthetic','bodies'],['public-city','city'],['public-two-cities','network'],['industry-town','room'],['exploration','road']];
 for(const [width,height]of [[1920,1080],[1280,900],[853,900],[390,844]]){
  for(const [scenario,page]of cases){
   await load(scenario,page,width,height);const before=await state();
   // Show the native navigation, rather than leaving the test shortcut halfway down the page.
   await wheel(Math.floor(width/2),height-180,-10000);
   const g=await geometry();assert.ok(g.docWidth<=width+1,`${width}/${scenario}/${page}: horizontal overflow ${g.docWidth}`);
   assert.equal(g.storeCount,1);assert.equal(g.visiblePanels.length,1);
   assert.ok(g.linkColors.every(c=>c==='rgb(34, 34, 34)'),`${page}: link color ${g.linkColors}`);
   if(width>=940){assert.ok(g.main.right+15<=g.stores.left,'warehouse intersects main');assert.ok(g.stores.right<=width);assert.ok(g.main.width>width*.5);}
   if(g.bodyOverflow!==null)assert.equal(g.bodyOverflow,'visible');
   if(g.researchOverflow!==null)assert.equal(g.researchOverflow,'visible');
   const label=`${width}-${scenario}-${page}`;
   if((width===1280||width===390)||page==='domain')await b.shot(label);
   let history=null;if(scenario==='industry-synthetic'&&page==='bodies')history=await modal(label);
   assert.equal(await state(),before,'presentation changed world state');
   rows.push({scenario,page,width,height,geometry:g,history});
   fs.writeFileSync(out+'/layout-results.json',JSON.stringify({kind:'UI copies, not natural play',complete:false,rows},null,2)+'\n');
   console.log('PASS',label);
  }
 }
 // A very short window must still retain the history header and close control.
 await load('industry-synthetic','domain',853,500);await modal('853x500');rows.push({shortModal:true});
 const errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(out+'/layout-results.json',JSON.stringify({kind:'UI copies, not natural play',rows,errors},null,2)+'\n');
 console.log('Layout checks passed:',rows.length);
}finally{b.close();}
