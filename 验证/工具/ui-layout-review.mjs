// Inspect real UI pages in paused, isolated copies; never invoke gameplay from evaluation.
import fs from 'node:fs';import assert from 'node:assert/strict';import {connect} from './a7-cdp.mjs';
const mode=process.argv.includes('--after')?'改后':'改前',out='验证/UI按钮排版与滚动/'+mode,b=await connect(9394,out),rows=process.argv.includes('--resume')&&fs.existsSync(out+'/results.json')?JSON.parse(fs.readFileSync(out+'/results.json')).rows:[];
const profiles=[['exploration',['room','outside','road','research']],['public-town',['laws','room','outside']],['industry-city',['city','census','production','industry','urban']],['public-budget',['lake','network','budget','domain']],['industry-synthetic',['future','bodies','research']],['public-echo',['echo']],['industry-war',['trade','war','equipment']],['public-unified',['earth']],['public-launch',['space']],['industry-ending',['history','archives','ending']]];
const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
const audit=`(()=>{
 const visible=e=>e.checkVisibility()&&getComputedStyle(e).visibility!=='hidden',rect=${rect.toString()},root=document.querySelector('#event')||document.querySelector('.location.civil-active');
 const buttons=[...root.querySelectorAll('.button')].filter(visible).map(e=>{const nodes=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()),lines=nodes.flatMap(n=>{const r=document.createRange();r.selectNode(n);return [...r.getClientRects()];});return {id:e.id,text:nodes.map(n=>n.textContent).join('').trim(),lines:new Set(lines.map(r=>Math.round(r.top))).size,...rect(e)};});
 const overlaps=[];for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],c=buttons[j];if(Math.min(a.right,c.right)-Math.max(a.x,c.x)>2&&Math.min(a.bottom,c.bottom)-Math.max(a.y,c.y)>2)overlaps.push([a.id,c.id]);}
 const clipped=[...root.querySelectorAll('p,select,input,table,.civil-plan-row,.city-setting,.civil-kv')].filter(visible).filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.right>innerWidth+1||r.left< -1||(e.scrollWidth>e.clientWidth+3&&s.overflowX==='visible'&&!e.closest('.civil-table-scroll'));}).map(e=>({id:e.id,tag:e.tagName,text:e.textContent.trim().slice(0,65),...rect(e),client:e.clientWidth,scroll:e.scrollWidth}));
 const escapedCooldowns=[...root.querySelectorAll('.button > .cooldown')].filter(visible).filter(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.x<p.x-2||r.y<p.y-2||r.right>p.right+2||r.bottom>p.bottom+2;}).map(e=>e.parentElement.id);
 return {viewport:{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth},buttonCount:buttons.length,wrapped:buttons.filter(e=>e.lines>1),overlaps,clipped,escapedCooldowns,modal:document.querySelector('#event')?rect(document.querySelector('#event')):null};
})()`;
async function until(x){for(let i=0;i<180;i++){if(await b.read(x))return;await b.sleep(100);}throw Error('Timed out '+x);}
async function click(css){assert(await b.raw(css),'Cannot reach '+css);}
async function close(){if(await b.read("!!document.querySelector('#event .civil-event-close')")){await click('#event .civil-event-close');await until('!Events.activeEvent()');}}
try{
 for(const width of [1280,390])for(const [scenario,pages]of profiles){
  if(pages.every(page=>rows.some(r=>r.width===width&&r.scenario===scenario&&r.page===page)))continue;
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.send('Page.navigate',{url:`http://127.0.0.1:4180/test-game.html?scenario=${scenario}&page=${pages[0]}&run=layout-${Date.now()}-${width}`});await until('window.CivilTestSession?.ready');await b.sleep(800);
  for(const page of pages){
   if(rows.some(r=>r.width===width&&r.scenario===scenario&&r.page===page))continue;
   await close();if(['urban','industry'].includes(page))await click('#location_'+page);else{await b.select('#testPage',page);await click('#testGo');await b.sleep(750);}
   const r={width,scenario,page,...await b.read(audit)};rows.push(r);if(r.wrapped.length||r.overlaps.length||r.clipped.length||r.escapedCooldowns.length){console.log(scenario,page,width,JSON.stringify({wrap:r.wrapped.map(x=>x.text),overlap:r.overlaps,clip:r.clipped.map(x=>x.id||x.tag),cooldown:r.escapedCooldowns}));await b.read("(document.querySelector('#event .civil-event-body')||document.documentElement).scrollTop=0");await b.shot(width+'-'+scenario+'-'+page);}
   fs.writeFileSync(out+'/results.json',JSON.stringify({complete:false,rows},null,2)+'\n');
  }
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify({complete:true,rows,exceptions:b.events.filter(e=>e.method==='Runtime.exceptionThrown')},null,2)+'\n');console.log('DONE',rows.length);
}finally{b.close();}
