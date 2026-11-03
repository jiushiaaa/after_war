// 本地自然游玩驱动：只通过真实鼠标/键盘输入事件操作页面；eval 仅用于只读观察。
// 用法: node cdp.mjs <cmd> [args]
//   open <url> | click <css> | clicktext <text> | look <js-expr> | shot <file> | key <key> | text
import fs from 'node:fs';
const port=process.env.CDP_PORT||9333;
const targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
let page=targets.find(t=>t.type==='page'&&t.url.includes('127.0.0.1:4180'));
await fetch(`http://127.0.0.1:${port}/json/activate/${page.id}`);const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const wait=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,500));return r.result?.result?.value;};
async function clickAt(box){
  const x=box.x,y=box.y;
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
}
const locate=sel=>`(()=>{const el=${sel};if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,dis:el.classList.contains('disabled')};})()`;
const [cmd,...args]=process.argv.slice(2);
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
if(cmd==='open'){await send('Page.navigate',{url:args[0]});await new Promise(r=>setTimeout(r,2500));console.log('ok');}
else if(cmd==='click'||cmd==='clicktext'){
  const sel=cmd==='click'?`document.querySelector(${JSON.stringify(args[0])})`:`[...document.querySelectorAll('.button,.menuBtn,.headerButton,span,div')].filter(e=>e.offsetParent&&e.childElementCount<=3&&(e.firstChild?.nodeType===3?e.firstChild.textContent.trim():e.textContent.trim())===${JSON.stringify(args[0])}).pop()`;
  const box=await ev(locate(sel));if(!box){console.log('NOTFOUND');process.exit(2);}
  await clickAt(box);await new Promise(r=>setTimeout(r,300));console.log(box.dis?'clicked(disabled)':'clicked');
}
else if(cmd==='key'){for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:args[0],code:args[1]||args[0]});console.log('ok');}
else if(cmd==='look'){console.log(JSON.stringify(await ev(args[0]),null,0));}
else if(cmd==='text'){console.log(await ev(`(()=>{const q=s=>[...document.querySelectorAll(s)].map(e=>e.innerText.trim()).filter(Boolean);return ['HEADER: '+q('#header .headerButton').join(' | '),'EVENT: '+q('#event').join('\\n'),'BUTTONS: '+[...document.querySelectorAll('#locationSlider .location')].filter(l=>{const r=l.getBoundingClientRect();return r.left>-10&&r.left<900}).flatMap(l=>[...l.querySelectorAll('.button')].filter(b=>b.offsetParent).map(b=>(b.firstChild?.textContent||'').trim()+(b.classList.contains('disabled')?'[x]':''))).join(' | '),'STORES: '+q('#storesContainer').join(' ').replace(/\\n/g,' '),'LOG: '+q('#notifications .notification').slice(0,6).join(' / ')].join('\\n');})()`));}
else if(cmd==='export'){
  // Native UI export: open 存档 menu and press 导出进度; Chrome writes the real download.
  fs.mkdirSync(args[0],{recursive:true});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:args[0],eventsEnabled:true});
  for(const sel of ['document.querySelector("#saveMenu")','document.querySelector("#event #download")']){const b=await ev(locate(sel));if(!b){console.log('NOTFOUND '+sel);process.exit(2);}await clickAt(b);await new Promise(r=>setTimeout(r,800));}
  await new Promise(r=>setTimeout(r,2500));
  const c=await ev(locate('document.querySelector("#event #close")'));if(c)await clickAt(c);
  console.log(fs.readdirSync(args[0]).join('\n'));
}
else if(cmd==='import'){
  // Native UI import: 存档 → 导入进度 → paste text → 检查存档 → 替换当前进度
  const text=fs.readFileSync(args[0],'utf8');
  const tap=async sel=>{const b=await ev(locate(sel));if(!b){console.log('NOTFOUND '+sel);process.exit(2);}await clickAt(b);await new Promise(r=>setTimeout(r,900));};
  await tap('document.querySelector("#saveMenu")');await tap('document.querySelector("#event #import")');
  await tap('document.querySelector("#event textarea")');
  await send('Input.insertText',{text});await new Promise(r=>setTimeout(r,500));
  await tap('document.querySelector("#event #inspect")');await new Promise(r=>setTimeout(r,1500));
  console.log(await ev('document.querySelector("#event")?.innerText.slice(0,300)'));
  await tap('document.querySelector("#event #replace")');await new Promise(r=>setTimeout(r,3000));
  console.log(await ev('JSON.stringify([State.civilization.elapsed,State.game.population,State.stores])'));
}
else if(cmd==='shot'){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(args[0],Buffer.from(r.result.data,'base64'));console.log('saved');}
ws.close();
