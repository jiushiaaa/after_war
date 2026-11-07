// Read-only UI review of isolated scenario copies; actual mouse/key input only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect} from './a7-cdp.mjs';
const port=Number(process.env.COPY_REVIEW_PORT||9447),out='验证/Gemini文案导入/UI';
const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('http://127.0.0.1:4180/test.html')}`,{method:'PUT'})).json();
const finishOnly=process.argv.includes('--finish');
const b=await connect(port,out,target.id),rows=finishOnly?JSON.parse(fs.readFileSync(out+'/results.json')).rows:[];
const profiles=[['exploration','room'],['exploration','road'],['public-town','laws'],['industry-city','production'],['public-budget','budget'],['industry-synthetic','research'],['industry-synthetic','bodies'],['public-echo','echo'],['industry-war','trade'],['public-unified','earth'],['public-launch','space'],['industry-ending','archives']];
async function until(x){for(let i=0;i<200;i++){if(await b.read(x))return;await b.sleep(100);}throw Error('Timed out '+x);}
const click=async css=>assert.ok(await b.raw(css),'Cannot reach '+css);
const audit=`(()=>{
 const root=document.querySelector('#event')||document.querySelector('.location.civil-active');
 const visible=e=>e.checkVisibility()&&getComputedStyle(e).visibility!=='hidden';
 const buttons=[...root.querySelectorAll('.button')].filter(visible).map(e=>{const nodes=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()),lines=nodes.flatMap(n=>{const r=document.createRange();r.selectNode(n);return [...r.getClientRects()];});return {id:e.id,text:nodes.map(n=>n.textContent).join('').trim(),lines:new Set(lines.map(r=>Math.round(r.top))).size};});
 const text=root.innerText;
 const event=document.querySelector('#event'),body=event?.querySelector('.civil-event-body'),r=event?.getBoundingClientRect();
 return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,buttonCount:buttons.length,wrapped:buttons.filter(e=>e.lines>1),leaks:text.match(/\\{(?:变量|分支|列表)\\d+\\}|cw\\.[a-f0-9]{14}|undefined|NaN/g)||[],excerpt:text.slice(0,1200),modal:r?{top:r.top,bottom:r.bottom,height:r.height,innerHeight:body?.clientHeight,scrollHeight:body?.scrollHeight}:null};
})()`;
try{
 for(const width of finishOnly?[]:[1920,1280,853,390])for(const [scenario,page] of profiles){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${page}&run=gemini-${width}-${Date.now()}`});
  await until('window.CivilTestSession?.ready');await b.sleep(950); // native subsection jump waits 700ms
  const result={scenario,page,width,...await b.read(audit)};rows.push(result);
  assert.ok(result.pageWidth<=width+1,JSON.stringify(result));assert.equal(result.leaks.length,0,JSON.stringify(result));
  if(result.modal)assert.ok(result.modal.top>=0&&result.modal.bottom<=900,JSON.stringify(result.modal));
  if(width===390||width===1920)await b.shot(`${width}-${scenario}-${page}`);
  fs.writeFileSync(out+'/results.json',JSON.stringify({complete:false,rows},null,2));
 }
 // History body scrolls while the page and fixed dialog remain still.
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=industry-ending&page=history&run=gemini-modal-${Date.now()}`});await until('window.CivilTestSession?.ready');await b.sleep(400);
 const before=await b.read("({outer:scrollY,inner:document.querySelector('.civil-event-body').scrollTop,top:document.querySelector('#event').getBoundingClientRect().top})");
 await click('.civil-event-body');await b.key('PageDown','PageDown',34);await b.sleep(250);
 const after=await b.read("({outer:scrollY,inner:document.querySelector('.civil-event-body').scrollTop,top:document.querySelector('#event').getBoundingClientRect().top})");
 assert.equal(before.outer,after.outer);assert.equal(before.top,after.top);assert.ok(after.inner>before.inner);await b.shot('390-history-scroll');
 await click('.civil-event-close');
 // Theme preference is changed with its ordinary menu, never by setting game state.
 await click('#saveMenu');await click('#theme');await b.sleep(300);await click('#historyMenu');await b.sleep(200);await b.shot('390-history-dark');
 const dark=await b.read("({color:getComputedStyle(document.querySelector('#description')).color,body:document.querySelector('#event').innerText.slice(0,180)})");
 const exceptions=b.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0,JSON.stringify(exceptions));
 fs.writeFileSync(out+'/results.json',JSON.stringify({complete:true,kind:'Isolated paused UI snapshots and actual input; not a natural full playthrough or real-device usability test',rows,history:{before,after},dark,exceptions},null,2)+'\n');
 console.log(JSON.stringify({pages:rows.length,wrapped:rows.filter(r=>r.wrapped.length).map(r=>({scenario:r.scenario,page:r.page,width:r.width,buttons:r.wrapped})),history:{before,after},exceptions:exceptions.length}));
}finally{b.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);}
