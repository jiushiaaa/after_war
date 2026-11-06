// Supplemental real-input checks: overflowing history, touch scroll, ending and mandatory setup.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const out='验证/UI宽屏与弹窗/弹窗复核',b=await connect(9394,out),results=[];
const click=async css=>assert.ok(await b.raw(css),'unreachable '+css);
async function load(scenario,page,w,h){
 await b.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w===390});
 await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${page}&run=modal-${Date.now()}-${w}-check`});
 for(let i=0;i<120&&!await b.read('window.CivilTestSession?.ready');i++)await b.sleep(100);await b.sleep(900);
 assert.equal(await b.read('CivilTestSession.ready'),true);
}
const details=()=>b.read(`(()=>{const e=document.querySelector('.civil-event-body'),r=document.querySelector('#event').getBoundingClientRect(),close=document.querySelector('.civil-event-close').getBoundingClientRect();return {y:scrollY,inner:e.scrollTop,max:e.scrollHeight-e.clientHeight,x:r.x,top:r.y,width:r.width,height:r.height,bottom:r.bottom,closeTop:close.top,closeBottom:close.bottom,viewport:innerHeight};})()`);
async function scroll(label,touch=false){
 const start=await details();assert.ok(start.max>0,'fixture must actually overflow');
 if(touch){
  await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const x=Math.round(start.x+start.width/2),from=Math.round(start.bottom-140),to=Math.round(start.top+100);
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
  for(let i=1;i<=12;i++){await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.round(from+(to-from)*i/12)}]});await b.sleep(25);}
  await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:start.x+60,y:start.top+150,deltaX:0,deltaY:10000});
 await b.sleep(500);const after=await details();assert.ok(after.inner>0,'content does not scroll');assert.equal(after.y,start.y);assert.equal(after.top,start.top);assert.equal(after.height,start.height);
 assert.ok(after.closeTop>=start.top&&after.closeBottom<start.bottom);
 await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:2,y:Math.round(start.viewport/2),deltaX:0,deltaY:10000});await b.sleep(250);assert.equal(await b.read('scrollY'),start.y);
 await b.shot(label);await click('.civil-event-close');await b.sleep(300);assert.equal(await b.read('!!Events._pageLock'),false);assert.equal(await b.read('scrollY'),start.y);
 if(touch)await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 results.push({label,touch,start,after});
}
try{
 for(const [w,h]of [[1920,1080],[1280,900],[853,500],[390,844]]){
  await load('industry-synthetic','bodies',w,h);const before=await b.read('JSON.stringify([State.game,State.stores,State.civilization])');
  await click('#historyMenu');await b.sleep(300);await scroll(`${w}x${h}-发展史内部滚动`,w===390);
  assert.equal(await b.read('JSON.stringify([State.game,State.stores,State.civilization])'),before);
 }
 await load('public-ending','ending',1280,900);await scroll('1280-文明回顾内部滚动');
 await load('new','room',390,844);assert.equal(await b.read('Events.activeEvent()?.civilPending'),'game_setup');
 await b.key('Escape','Escape',27);assert.equal(await b.read('Events.activeEvent()?.civilPending'),'game_setup','Escape must not dismiss a decision');
 await b.shot('390-新世界设定');await click('#event #begin');await b.sleep(400);assert.equal(await b.read('!!Events._pageLock'),false);assert.equal(await b.read('State.civilization.setup.confirmed'),true);await b.shot('390-新档');
 results.push({mandatorySetup:'Escape retained decision; normal begin unlocked page'});
 const errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(out+'/modal-results.json',JSON.stringify({results,errors},null,2)+'\n');console.log(JSON.stringify(results));
}finally{b.close();}
