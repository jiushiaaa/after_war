// UI-only layout checks, in isolated paused copies. No progression or resources injected.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const out='验证/UI按钮排版与滚动/展开与弹窗',b=await connect(9394,out,process.argv[2]||null),previous=fs.existsSync(out+'/results.json')?JSON.parse(fs.readFileSync(out+'/results.json')):{},rows=previous.expanded||[],modals=previous.modals||[];
function save(complete=false){fs.writeFileSync(out+'/results.json',JSON.stringify({complete,expanded:rows,modals,exceptions:b.events.filter(e=>e.method==='Runtime.exceptionThrown')},null,2)+'\n');}
async function until(x){for(let i=0;i<200;i++){if(await b.read(x))return;await b.sleep(100);}throw Error('Timed out '+x);}
async function click(s){assert.ok(await b.raw(s),'Cannot reach '+s);}
async function load(scenario,page,width=1280,height=960){await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${page}&run=layout-expanded-${Date.now()}`});await until('window.CivilTestSession?.ready');await b.sleep(900);}
const readLayout=`(()=>{
 const root=document.querySelector('.location.civil-active'),visible=e=>e.checkVisibility(),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
 const bad=[...root.querySelectorAll('p,select,table,.button')].filter(visible).filter(e=>{const r=rect(e);return r.x< -1||r.right>innerWidth+1;}).map(e=>e.id||e.tagName);
 const note=document.querySelector('#socialNote'),jobs=document.querySelector('#workers'),hearth=document.querySelector('#hearthNote'),guide=document.querySelector('#civilGuide');
 const overlap=(a,b)=>a?.checkVisibility()&&b?.checkVisibility()&&Math.min(rect(a).right,rect(b).right)>Math.max(rect(a).x,rect(b).x)+2&&Math.min(rect(a).bottom,rect(b).bottom)>Math.max(rect(a).y,rect(b).y)+2;
 const cooldowns=[...root.querySelectorAll('.button > .cooldown')].filter(visible).filter(e=>{const r=rect(e),p=rect(e.parentElement);return r.x<p.x-2||r.y<p.y-2||r.right>p.right+2||r.bottom>p.bottom+2;}).map(e=>e.parentElement.id);
 return {width:innerWidth,scroll:document.documentElement.scrollWidth,bad,workerNoteOverlap:!!overlap(note,jobs),hearthGuideOverlap:!!overlap(hearth,guide),cooldowns};
})()`;
try{
 for(const width of [1280,1024,853,390])for(const [scenario,page]of [['exploration','outside'],['exploration','room'],['public-town','outside'],['industry-city','research'],['public-budget','budget']]){
  if(rows.some(r=>r.width===width&&r.scenario===scenario&&r.page===page))continue;
  await load(scenario,page,width);const before=await b.read('JSON.stringify(State)');
  for(let i=0;i<12;i++){
   const id=await b.read("[...document.querySelectorAll('.location.civil-active details:not([open])')].find(e=>e.id&&e.checkVisibility()&&!e.classList.contains('civil-tech-row'))?.id");if(!id)break;await click('#'+id+' > summary');
  }
  const row={scenario,page,...await b.read(readLayout)};assert.ok(row.scroll<=width+1);assert.deepEqual(row.bad,[]);assert.equal(row.workerNoteOverlap,false);assert.equal(row.hearthGuideOverlap,false);assert.deepEqual(row.cooldowns,[]);
  assert.equal(await b.read('JSON.stringify(State)'),before);await b.read('window.scrollTo(0,0)');await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});await b.shot(width+'-'+scenario+'-'+page);rows.push(row);save();
 }
 for(const [width,height]of [[1280,480],[853,650],[390,480]]){
  if(modals.some(r=>r.width===width&&r.height===height))continue;
  await load('industry-ending','future',width,height);await b.read('window.scrollTo(0,300)');const before=await b.read('window.scrollY');
  await click('#historyMenu');await until("!!document.querySelector('#event .civil-event-close')");await b.sleep(400);
  const info=await b.read(`(()=>{const e=document.querySelector('#event'),body=e.querySelector('.civil-event-body'),r=e.getBoundingClientRect(),q=body.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,bodyHeight:body.clientHeight,contentHeight:body.scrollHeight,x:q.x+q.width/2,y:q.y+q.height/2,page:scrollY};})()`);
  assert.ok(info.top>=0&&info.bottom<=height&&info.left>=0&&info.right<=width);assert.ok(info.contentHeight>info.bodyHeight);
  await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:info.x,y:info.y,deltaX:0,deltaY:2000});await b.sleep(350);
  const wheel=await b.read("({inner:document.querySelector('#event .civil-event-body').scrollTop,page:scrollY})");assert.ok(wheel.inner>0);assert.equal(wheel.page,info.page);
  await click('#event .civil-event-close');await until('!Events.activeEvent()');assert.equal(await b.read('window.scrollY'),before);
  await click('#historyMenu');await b.sleep(400);await b.key('Tab','Tab',9);assert.equal(await b.read('document.activeElement.className'),'civil-event-body');await b.key('PageDown','PageDown',34);await b.sleep(300);
  assert.ok(await b.read("document.querySelector('#event .civil-event-body').scrollTop>0"));await b.shot(width+'-history-keyboard');await click('#event .civil-event-close');await until('!Events.activeEvent()');
  assert.equal(await b.read('document.activeElement.id'),'historyMenu');
  await click('#saveMenu');await click('#local');await until("Events.activeScene==='local'");await b.shot(width+'-save-slots');await click('#back');await click('#close');await until('!Events.activeEvent()');
  await click('#saveMenu');await click('#import');await b.shot(width+'-import');await click('#cancel');await until('!Events.activeEvent()');
  modals.push({width,height,bounds:info,wheel,keyboardScroll:true,returnFocus:true,saveAndImport:true});save();
 }
 const exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0);
 save(true);console.log('PASS',rows.length,'expanded layouts;',modals.length,'short-screen modal sets');
}finally{b.close();}
