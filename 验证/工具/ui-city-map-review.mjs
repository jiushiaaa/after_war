// Real input into an isolated test copy; the historical export is read-only.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {connect} from './a7-cdp.mjs';
const out='验证/UI按钮排版与滚动/城市地图',b=await connect(9394,out),rows=[];
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
async function until(x){for(let i=0;i<400;i++){if(await b.read(x))return;await b.sleep(100);}throw Error('Timed out '+x);}
async function click(s){assert.ok(await b.raw(s),'Cannot reach '+s);}
async function capture(name,selector){await b.read(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await b.sleep(180);await b.shot(name);}
try{
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await b.send('Page.navigate',{url:'http://127.0.0.1:4180/test-game.html?scenario=industry-city&page=city&run=city-map-review-'+Date.now()});await until('window.CivilTestSession?.ready');await b.sleep(900);
 await click('#saveMenu');await click('#import');await click('#description textarea');
 const source='验证/存档/自然游玩_工业路线恢复后十年稳定278.json',raw=fs.readFileSync(source,'utf8');await b.send('Input.insertText',{text:raw});await click('#inspect');await until("Events.activeScene==='confirm'");await click('#replace');await until('!Events.activeEvent() && State.civilization.cityCouncil?.locals.bridge?.node');await b.sleep(1500);
 assert.equal(await b.read('CivilClock.paused'),true);const initial=JSON.parse(await b.read('JSON.stringify(State)')),before=hash(JSON.stringify(initial));
 for(const width of [1280,853,390]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await b.sleep(350);
  for(const city of ['home','lake','ridge','estuary','bridge']){
   await b.select('#civilPlaceSelect',city);await b.sleep(300);
   const selector=city==='home'?'#cityMap':'#cityLocalMap';assert.ok(await b.read(`document.querySelector('${selector}').checkVisibility()`));
   const state=await b.read(`(()=>{const e=document.querySelector('${selector}'),nodes=[...e.querySelectorAll('.city-map-node')],box=e.getBoundingClientRect();return {city:CivilConurbationView.selected,title:e.querySelector('.city-local-title')?.textContent||e.querySelector('#cityMapTitle').textContent,width:innerWidth,scroll:document.documentElement.scrollWidth,rect:{left:box.left,right:box.right},nodes:nodes.map(n=>({name:n.getAttribute('aria-label'),left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right}))}})()`);
   assert.equal(state.city,city);assert.ok(state.scroll<=width+1);assert.ok(state.rect.left>=0&&state.rect.right<=width+1);for(const n of state.nodes)assert.ok(n.left>=0&&n.right<=width+1);
   if(city!=='home')for(const zone of ['housing','fields','industry','services','transport']){await click('#cityZone_'+zone);assert.equal(await b.read(`document.querySelector('#cityZone_${zone}').getAttribute('aria-pressed')`),'true');}
   await capture(width+'-'+city,selector);rows.push(state);
  }
 }
 // Native keyboard activation and dark theme, without changing any game rule.
 await b.select('#civilPlaceSelect','lake');await click('#cityZone_housing');await b.key('Tab','Tab',9);
 assert.equal(await b.read('document.activeElement.id'),'cityZone_fields');
 await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.equal(await b.read("document.querySelector('#cityZone_fields').getAttribute('aria-pressed')"),'true');
 const afterMaps=hash(await b.read('JSON.stringify(State)'));assert.equal(afterMaps,before,'Reading maps changed the paused world');
 await click('#saveMenu');await click('#theme');await until('!Events.activeEvent()');await b.sleep(300);await capture('390-lake-dark','#cityLocalMap');
 await click('#saveMenu');await click('#theme');await until('!Events.activeEvent()');
 const final=JSON.parse(await b.read('JSON.stringify(State)')),exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');
 // Toggling the existing theme records config.lightsOff=false even if originally absent.
 delete initial.config.lightsOff;delete final.config.lightsOff;
 assert.deepEqual(final,initial,'Theme changed data beyond its preference');assert.equal(exceptions.length,0);
 fs.writeFileSync(out+'/results.json',JSON.stringify({source,sourceHash:hash(raw),rows,pausedStateBefore:before,pausedStateAfter:afterMaps,keyboard:true,dark:true,themeOnlyChangesLightsOff:true,exceptions},null,2)+'\n');console.log('PASS',rows.length,'city/viewport cases; paused state unchanged');
}finally{b.close();}
