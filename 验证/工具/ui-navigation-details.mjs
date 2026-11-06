// Extra visual checks requested during the navigation/entry work; originals remain read-only.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const out='验证/UI阶段导航与首页/补充',pages=await(await fetch('http://127.0.0.1:9394/json')).json(),target=pages.find(p=>p.url.includes('/test-game.html'));
const b=await connect(9394,out,target.id),results=[];
const click=async css=>assert(await b.raw(css),'Cannot reach '+css);
async function until(x){for(let i=0;i<220;i++){if(await b.read(x))return;await b.sleep(100);}throw Error('Timed out '+x);}
async function input(css,text){await click(css);await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:4,commands:['selectAll']});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65});await b.send('Input.insertText',{text});}
try{
 await b.send('Page.navigate',{url:'http://127.0.0.1:4180/test-game.html?scenario=public-nation&page=research&run=detail-'+Date.now()});await until('window.CivilTestSession?.ready');await b.sleep(900);
 const before=await b.read('JSON.stringify([State.game,State.stores,State.civilization])');
 for(const width of [1280,853,390]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.sleep(250);
  await b.read("document.querySelector('#research_semiconductor').scrollIntoView({block:'center'})");
  const m=await b.read("(()=>{const e=document.querySelector('#research_semiconductor'),r=document.createRange();r.selectNode(e.firstChild);return {lines:[...r.getClientRects()].map(x=>({top:x.top,width:x.width,height:x.height})),width:e.offsetWidth,height:e.offsetHeight,scroll:document.documentElement.scrollWidth,viewport:innerWidth};})()");
  assert.equal(m.lines.length,1,'Research title wrapped');assert(m.scroll<=m.viewport+1);await b.shot(width+'-科技名称一行');results.push({width,research:m});
 }
 assert.equal(await b.read('JSON.stringify([State.game,State.stores,State.civilization])'),before);
 assert.equal(await b.read("document.querySelectorAll('#civilUrbanJump,#civilUrbanBuild,#civilUrbanMigration').length"),0);
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await click('#location_city');await b.select('#civilPlaceSelect','domain');await b.read('window.scrollTo(0,0)');await b.shot('1280-国家主导航');await click('#civilNavMore > summary');await b.shot('1280-展开地方事务');
 // Replay an old five-city snapshot only through the ordinary import window in this test copy.
 await click('#saveMenu');await click('#event #import');await input('#event textarea',fs.readFileSync('验证/存档/自然游玩_工业路线恢复后十年稳定278.json','utf8'));await click('#event #inspect');await until("!!document.querySelector('#event #replace')");await click('#event #replace');await until("CivilLanding.phase==='playing'&&!Events.activeEvent()&&!!State.civilization.cityCouncil?.locals?.bridge?.node");await b.sleep(500);
 await click('#location_city');const oldBefore=await b.read('JSON.stringify([State.game,State.stores,State.civilization])'),choices=await b.read("[...document.querySelector('#civilPlaceSelect').options].map(e=>e.value)");assert(choices.includes('estuary')&&choices.includes('bridge'));
 for(const id of choices)await b.select('#civilPlaceSelect',id);
 assert.equal(await b.read('JSON.stringify([State.game,State.stores,State.civilization])'),oldBefore);await b.shot('1280-旧五城可达');results.push({oldSave:278,choices,stateUnchanged:true});
 // An invalid source produces recovery, not an empty world or a start button.
 await b.send('Page.navigate',{url:'http://127.0.0.1:4180/test-game.html?scenario=missing&run=bad-source-'+Date.now()});await until("!!document.querySelector('#startupError')");assert.equal(await b.read('typeof State'),'undefined');assert.equal(await b.read("document.querySelector('#civilStartButton').checkVisibility()"),false);await b.shot('1280-读取失败保护');results.push({invalidReadBlocksNewWorld:true});
 const exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0);fs.writeFileSync(out+'/results.json',JSON.stringify({complete:true,results,exceptions},null,2)+'\n');console.log(JSON.stringify(results));
}finally{b.close();}
