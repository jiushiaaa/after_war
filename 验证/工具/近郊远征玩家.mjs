// M2 自然验收：只用真实点击操作近郊地图。plan 为命令序列：
//  tab road | set members 2 | set food 6 | set water 9 | kit on | depart | go N 3 | home | choose <id> | wait <sec> | build <id> | research <id> | shot <file> | note <text>
import fs from 'node:fs';
const port=process.env.CDP_PORT||9333;
const page=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page'&&t.url.includes('127.0.0.1:4180'));
await fetch(`http://127.0.0.1:${port}/json/activate/${page.id}`);const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const wait=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.result?.value;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
async function click(sel,allowDisabled=false){
  const b=await ev(`(()=>{const el=${sel};if(!el||!el.offsetParent)return null;if(!${allowDisabled}&&el.classList.contains('disabled'))return 'disabled';el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  if(!b||b==='disabled')return b||'missing';
  for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1});
  await sleep(300);return 'ok';
}
const q=s=>`document.querySelector(${JSON.stringify(s)})`;
const byText=(scope,t)=>`[...document.querySelectorAll('${scope}')].find(e=>e.offsetParent&&(e.firstChild?.textContent||e.textContent).trim().startsWith(${JSON.stringify(t)}))`;
const obs=()=>ev(`(()=>{const c=State.civilization,d=c.expedition,p=d?.party;return {t:c.elapsed,pop:State.game.population,free:Outside.getNumGatherers(),st:Object.fromEntries(Object.entries(State.stores).map(([k,v])=>[k,Math.round(v*100)/100])),party:p?{pos:p.pos,pack:p.pack,steps:p.steps,hurt:p.hurt,enc:p.encounter}:null,sites:d?.sites,beetles:d?.beetles,resting:d?.resting,ev:Events.activeEvent()?.title||null,evText:[...document.querySelectorAll('#event .eventPanel, #event')].map(e=>e.innerText).join('').slice(0,400),log:[...document.querySelectorAll('#notifications .notification')].slice(0,3).map(e=>e.innerText)}})()`);
const out=[];const say=async(cmd)=>{const o=await obs();const line=`[${o.t}s] ${cmd} → pop ${o.pop} free ${o.free} ${o.party?'@'+o.party.pos+' steps '+o.party.steps+' pack '+JSON.stringify(o.party.pack):'home'} ${o.ev?'EVENT '+o.ev:''} | ${o.log[0]||''}`;console.log(line);out.push({cmd,...o});};
const plan=fs.readFileSync(process.argv[2],'utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
for(const line of plan){
  const [cmd,...a]=line.split(/\s+/);
  if(cmd==='tab'){await click(q('#location_'+a[0]));await sleep(900);}
  else if(cmd==='set'){const label={members:'队员',food:'口粮',water:'饮水'}[a[0]];
    for(let i=0;i<80;i++){const cur=await ev(`(()=>{const r=[...document.querySelectorAll('.civil-outfit')].find(r=>r.querySelector('.civil-outfit-name')?.textContent===${JSON.stringify(label)});return Number(r?.querySelector('.civil-outfit-val')?.textContent)})()`);
      if(cur===Number(a[1]))break;const sign=cur<Number(a[1])?'增加':'减少';await click(`document.querySelector('.civil-step[aria-label="${sign+label}"]')`);}}
  else if(cmd==='kit'){const on=await ev(`document.querySelector('.civil-step[aria-label="切换是否携带泵站维修件"]')?.getAttribute('aria-pressed')`);if((on==='true')!==(a[0]==='on'))await click(q('.civil-step[aria-label="切换是否携带泵站维修件"]'));}
  else if(cmd==='depart'){console.log('depart:',await click(q('#expeditionDepart')));}
  else if(cmd==='go'){const lab={N:'向北走一格',S:'向南走一格',E:'向东走一格',W:'向西走一格'}[a[0]];
    for(let i=0;i<Number(a[1]||1);i++){if(await ev('!!Events.activeEvent()'))break;const r=await click(`[...document.querySelectorAll('.civil-step')].find(e=>e.getAttribute('aria-label').startsWith(${JSON.stringify(lab)}))`);if(r!=='ok'){console.log('move blocked',r);break;}}}
  else if(cmd==='key'){const code={N:[38,'ArrowUp'],S:[40,'ArrowDown'],E:[39,'ArrowRight'],W:[37,'ArrowLeft']}[a[0]];
    for(let i=0;i<Number(a[1]||1);i++){if(await ev('!!Events.activeEvent()'))break;for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:code[1],code:code[1],windowsVirtualKeyCode:code[0],nativeVirtualKeyCode:code[0]});await sleep(200);}}
  else if(cmd==='home'){console.log('home:',await click(q('#expeditionReturn')));await sleep(500);}
  else if(cmd==='look'){console.log('look:',await click(q('#expeditionLook')));}
  else if(cmd==='choose'){await sleep(400);console.log('choose',a[0],await click(q('#event #ex_'+a[0])));await sleep(600);}
  else if(cmd==='evclick'){console.log('evclick',await click(q('#event #'+a[0])));await sleep(600);}
  else if(cmd==='wait'){await sleep(Number(a[0])*1000);}
  else if(cmd==='build'){console.log('build',a[0],await click(q('#build_'+a[0])));}
  else if(cmd==='research'){console.log('research',a[0],await click(q('#research_'+a[0])));}
  else if(cmd==='btn'){console.log('btn',a[0],await click(q('#'+a[0])));}
  else if(cmd==='shot'){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(a[0],Buffer.from(r.result.data,'base64'));}
  await say(line);
}
fs.writeFileSync(process.argv[3]||'/tmp/pwcdp/expedition-run.json',JSON.stringify(out,null,1));ws.close();
