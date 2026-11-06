// Real input on isolated test copies. No gameplay, resource or time injection.
// Chrome CDP is used for touch, which the in-app browser does not expose.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connect} from './a7-cdp.mjs';
const port=Number(process.env.TECH_REVIEW_PORT||9394),out='验证/UI科技图谱/原生输入';
const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('http://127.0.0.1:4180/test-game.html?scenario=public-city&page=research&run=atlas-touch-'+Date.now())}`,{method:'PUT'})).json();
const b=await connect(port,out,target.id),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function until(expression){for(let i=0;i<200;i++){if(await b.read(expression))return;await b.sleep(100);}throw Error('Timed out '+expression);}
try{
  await until('window.CivilTestSession?.ready');await b.sleep(500);
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const before=hash(await b.read('JSON.stringify(State)'));
  await b.select('#civilTechSelect','radio');
  await b.read("document.querySelector('#civilTechViewport').scrollIntoView({block:'center'})");await b.sleep(150);
  const box=await b.read("(()=>{const e=document.querySelector('#civilTechViewport'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:e.clientWidth,h:e.clientHeight,left:e.scrollLeft,page:scrollY}})()");
  const x=box.x+260,y=box.y+box.h/2;
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(const dx of [25,50,75,100,125]){await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-dx,y,id:1}]});await b.sleep(50);}
  await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await b.sleep(350);
  const afterTouch=await b.read("({left:document.querySelector('#civilTechViewport').scrollLeft,page:scrollY})");
  assert.ok(afterTouch.left>box.left,'Touch must pan the atlas');assert.ok(Math.abs(afterTouch.page-box.page)<1,'Horizontal map swipe must not scroll the page');
  await b.shot('390-touch');
  await b.select('#civilTechSelect','powerstorage');
  await b.read("document.querySelector('#civilTechDetail').scrollIntoView({block:'center'})");await b.sleep(200);
  assert.ok(await b.raw('#civilTechDetail'));
  const detailBefore=await b.read("({top:document.querySelector('#civilTechDetail').scrollTop,page:scrollY})");
  await b.key('PageDown','PageDown',34);await b.sleep(250);
  const detailAfter=await b.read("({top:document.querySelector('#civilTechDetail').scrollTop,page:scrollY})");
  assert.ok(detailAfter.top>detailBefore.top);assert.ok(Math.abs(detailAfter.page-detailBefore.page)<1);
  await b.shot('390-detail-scroll');
  assert.equal(hash(await b.read('JSON.stringify(State)')),before,'Reading the map changed the paused world');
  // Lossless desktop captures supplement the in-app browser's scaled screenshots.
  await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await b.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await b.sleep(300);
  assert.ok(await b.raw('#techNode_radio'));assert.ok(await b.raw('#civilTechReset'));await b.read('window.scrollTo(0,0)');await b.sleep(200);await b.shot('1600-atlas');
  assert.ok(await b.raw('#techNode_semiconductor'));assert.ok(await b.raw('#civilTechAction > .button'));
  const active=await b.read('({...State.civilization.research,paused:CivilClock.paused})');assert.equal(active.id,'semiconductor');assert.equal(active.remaining,420);assert.equal(active.paused,true);
  assert.ok(await b.raw('#civilTechLocate'));await b.read('window.scrollTo(0,0)');await b.sleep(150);await b.shot('1600-researching');
  for(let i=0;i<3;i++)assert.ok(await b.raw('#civilTechZoomOut'));
  assert.ok(await b.raw('#civilTechLocate'));await b.read('window.scrollTo(0,0)');await b.sleep(150);await b.shot('1600-overview');
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await b.sleep(250);
  // Import an unchanged older native export into this test-only database.
  assert.ok(await b.raw('#saveMenu'));assert.ok(await b.raw('#import'));assert.ok(await b.raw('#description textarea'));
  const source='验证/存档/自然游玩_工业路线恢复后十年稳定278.json',raw=fs.readFileSync(source,'utf8');
  await b.send('Input.insertText',{text:raw});assert.ok(await b.raw('#inspect'));await until("Events.activeScene==='confirm'");assert.ok(await b.raw('#replace'));
  await until('!Events.activeEvent() && State.civilization.cityCouncil?.locals.bridge?.node');
  await b.sleep(500);await b.select('#testPage','research');assert.ok(await b.raw('#testGo'));
  await b.sleep(350);const legacyBefore=hash(await b.read('JSON.stringify(State)'));
  await b.select('#civilTechSelect','power');assert.ok(await b.raw('#civilTechZoomOut'));await b.shot('390-legacy278');
  assert.equal(hash(await b.read('JSON.stringify(State)')),legacyBefore);assert.equal(fs.readFileSync(source,'utf8'),raw);
  const exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0);
  fs.writeFileSync(out+'/results.json',JSON.stringify({touch:{before:box,after:afterTouch},detail:{before:detailBefore,after:detailAfter},pausedStateHash:before,active,legacy:{source,sourceHash:hash(raw),stateHash:legacyBefore},exceptions},null,2)+'\n');
  console.log('PASS: touch pan, bounded detail scroll, legacy 278 import, unchanged paused states');
}finally{b.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);}
