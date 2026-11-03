// M0 新档基线：通过真实鼠标事件游玩全新档，记录每次解锁/首次出现的时间。
// 只读观察 State；所有改变都来自点击原生按钮。不注入资源、不改时间。
import fs from 'node:fs';
const port=process.env.CDP_PORT||9333, out=process.argv[2]||'/tmp/pwcdp/baseline.json', wallLimit=Number(process.argv[3]||1800)*1000;
const page=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const wait=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result?.result?.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function click(sel){
  const box=await ev(`(()=>{const el=${sel};if(!el||!el.offsetParent||el.classList.contains('disabled'))return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  if(!box)return false;
  for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});
  await sleep(350);return true;
}
const q=s=>`document.querySelector(${JSON.stringify(s)})`;
const tab=async idName=>{const sel=q('#location_'+idName);const sel2=await ev(`!!${sel}&&!${sel}.classList.contains('selected')`);if(sel2)await click(sel);};
const t0=Date.now()-Number(process.argv[4]||0)*1000,log=[],seen={};
const mark=(k,detail)=>{if(seen[k])return;seen[k]=1;const sim=snap.sim;log.push({k,wall:Math.round((Date.now()-t0)/1000),sim,detail});console.log(`[${Math.round((Date.now()-t0)/1000)}s 墙钟 / ${sim}s 模拟] ${k}${detail?' '+detail:''}`);};
let snap={};
const read=()=>ev(`(()=>{const s=State,c=s.civilization;return {sim:c.elapsed,speed:c.speed,max:c.maxSpeed,pop:s.game.population,b:s.game.buildings,st:Object.fromEntries(Object.entries(s.stores).map(([k,v])=>[k,Math.floor(v)])),w:s.game.workers,fire:s.game.fire.value,builder:s.game.builder.level,tech:Object.keys(c.tech),research:c.research?.id||null,journey:c.journey?.id||null,pending:c.pending,ev:!!Events.activeEvent(),evTitle:Events.activeEvent()?.title||null,
 tabs:[...document.querySelectorAll('#header .headerButton')].map(e=>e.id.replace('location_','')+':'+e.innerText),
 btns:[...document.querySelectorAll('.location .button')].filter(b=>b.offsetParent!==null||true).map(b=>b.id),
 settled:c.settled,station:c.station,pump:c.pump,town:!!c.village?.town};})()`);
let lastNotes=0;
while(Date.now()-t0<wallLimit){
  snap=await read();if(!snap){await sleep(1000);continue;}
  for(const t of snap.tabs)mark('地点:'+t);
  for(const b of snap.btns)mark('按钮:'+b);
  for(const [k,v] of Object.entries(snap.b))if(v>0)mark('建成:'+k);
  for(const k of snap.tech)mark('技术:'+k);
  if(snap.pop>0)mark('首批居民');
  if(snap.settled)mark('稳定聚落');
  if(snap.station)mark('交通站');if(snap.pump)mark('泵站');if(snap.town)mark('小镇');
  if(snap.max>1)mark('倍率上限:'+snap.max);
  if(snap.ev){
    mark('事件:'+snap.evTitle);
    // 事件：优先第一个可用选项（政策选均分）
    const ok=await click(`[...document.querySelectorAll('#event .button')].find(b=>!b.classList.contains('disabled'))`);
    if(!ok)await sleep(500);continue;
  }
  if(snap.speed<snap.max){await click(q('#speedButton'));await sleep(400);await click(`[...document.querySelectorAll('#event .button')].find(b=>b.innerText.startsWith('${snap.max}×'))`);continue;}
  // 维修间
  await tab('room');
  if(await click(q('#lightButton')))continue;
  if(snap.fire<4) await click(q('#stokeButton'));
  for(const b of ['granary','workshop','lodge','hut','cart','trap','cistern','outpost','farm','toolshop','longhouse','clinic','schoolhouse','road'])if(await click(q('#build_'+b)))break;
  await click(`[...document.querySelectorAll('#researchBtns .button')].find(b=>!b.classList.contains('disabled')&&b.offsetParent)`);
  if(await ev(`!!${q('#policyButton')}`)){} 
  // 荒林
  if(snap.tabs.some(t=>t.startsWith('outside'))){
    await tab('outside');
    await click(q('#gatherButton'));await click(q('#trapsButton'));await click(q('#forageButton'));await click(q('#scrapButton'));
    // 分工：保持食物为正
    const foodLow=(snap.st.food||0)<40, need=snap.b.lodge?1:0;
    if(need&&foodLow)await click(q('#workers_row_hunter .upBtn'));
    else {const want={smith:snap.b.toolshop?3:0,medic:(snap.b.clinic||0)*2,teacher:(snap.b.schoolhouse||0)*2,salvager:2,farmer:Math.min((snap.b.farm||0)*4,Math.ceil(snap.pop*0.4))};
      for(const [j,n] of Object.entries(want))if((snap.w[j]??-1)>=0&&(snap.w[j]||0)<n&&await ev(`Outside.getNumGatherers()>2`)){await click(q('#workers_row_'+j+' .upBtn'));break;}}
  }
  if(snap.tabs.some(t=>t.startsWith('road'))&&!snap.journey&&!snap.pending){
    await tab('road');
    if(!(await click(q('#pumpButton'))))if(!snap.station)await click(q('#stationButton'));
    for(const b of ['riverButton','riverPact','geologyButton'])await click(q('#'+b));
  }
  await sleep(800);
}
snap=await read();
fs.writeFileSync(out,JSON.stringify({log,final:snap},null,1));console.log('final',JSON.stringify(snap));process.exit(0);
