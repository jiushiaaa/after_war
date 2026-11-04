// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9368',dir='/tmp/postwar-a3-close-20261104/ui']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
const page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p=>p.type==='page'&&p.url.includes(':4180'));
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0,done=false;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
ws.onclose=()=>{if(!done){console.error('Disconnected; retain browser and resume this existing save.');process.exit(2);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const read=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),q=css=>`document.querySelector(${JSON.stringify(css)})`;
const log=(kind,data)=>fs.appendFileSync(path.join(dir,'actions.ndjson'),JSON.stringify({wall:new Date().toISOString(),kind,...data})+'\n');
async function raw(css){
 await read(`(()=>{const e=${q(css)};if(e?.checkVisibility())e.scrollIntoView({block:'center',inline:'nearest'});})()`);await sleep(120);
 const box=await read(`(()=>{const e=${q(css)};if(!e||!e.checkVisibility()||e.classList.contains('disabled')||e.disabled)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y,text:e.innerText.slice(0,90)}:null;})()`);
 if(!box){log('unreachable',{css,info:await read(`(()=>{const e=${q(css)};if(!e)return null;const r=e.getBoundingClientRect();return {rect:r.toJSON(),visible:e.checkVisibility(),disabled:e.disabled,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500)};})()`)});return false;}for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});log('click',{css,...box});await sleep(250);return true;
}
async function click(css){
 const info=await read(`(()=>{const e=${q(css)};return e?{panel:e.closest('.location')?.id,folds:[...document.querySelectorAll('details:not([open])')].filter(d=>d.contains(e)&&e!==d.querySelector(':scope > summary')).map(d=>d.id)}:null;})()`);if(!info)return false;
 if(info.panel){const id=info.panel.replace(/Panel$/,'');if(!await read(`${q('#location_'+id)}?.classList.contains('selected')`))await raw('#location_'+id);for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);}
 for(const id of info.folds){for(let n=0;n<3&&!await read(`${q('#'+id)}.open`);n++){await raw('#'+id+' > summary');await sleep(300);}if(!await read(`${q('#'+id)}.open`))throw Error('Could not unfold '+id);}return raw(css);
}
async function select(css,value){
 for(let n=0;n<3;n++){if(await click(css))break;if(n===2)throw Error('Cannot reach selection '+css);await sleep(300);}
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}

const assert=(ok,label)=>{if(!ok)throw Error(label);};for(let i=0;i<6&&!await read('CivilClock.paused');i++){const p=await read('State.civilization.pending');if(p){await raw('#event #'+(p==='succession'?'engineer':p==='cold'?'wood':'repair'));continue;}await raw('#speedButton');await raw('#event #pause');}const before=await read('JSON.stringify(State)'),at=await read('State.civilization.elapsed'),evidence=[];
async function council(){await click('#location_city');await click('#metroCity_select_link');await click('#cityNet_council');}
for(const width of [1280,853,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await council();const folds=await read("[...document.querySelectorAll('#cityCouncilBody details[open]')].map(x=>x.id).filter(Boolean).reverse()");for(const id of folds)await click('#'+id+' > summary');
 for(const view of ['folded','ledger','terms']){let host='#councilSummary';if(view==='ledger'){await select('#governanceChoice_scope','home');await click('#governanceRecord > summary');await sleep(250);assert(await read('document.querySelector("#governanceLedger").innerText.includes("工具产出")'),'ledger opens while paused');host='#governanceRecord';}if(view==='terms'){assert(!await read('document.querySelector("#governanceSupplyLink").checkVisibility()'),'public does not need iron prompt');await click('#metroCity_select_link');await click('#cityNet_tab_transport');await click('#cityNet_lakeTerms');await click('#metroCityAgreement > summary');host='#metroCityTerms';assert(await read('document.querySelector("#metroCityChoice_mode option[value=restock]").hidden'),'supplemental industry hidden');assert(!await read('document.querySelector("#metroCitySupply").checkVisibility()'),'no irrelevant supply panel');}
 await read(`document.querySelector(${JSON.stringify(host)}).scrollIntoView({block:'start'})`);const m=await read(`(()=>{const r=document.querySelector('#cityBody').getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,right:r.right,text:document.querySelector(${JSON.stringify(host)}).innerText};})()`);assert(m.scroll<=width&&m.right<=width+1,'overflow');evidence.push({view,...m});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,view+'-'+width+'.png'),Buffer.from(shot.result.data,'base64'));}
}
assert(await read('JSON.stringify(State)')===before,'paused state changed');assert(await read('!State.civilization.tech.mechanics&&!State.civilization.tech.electricity'),'public retains its route');assert(await read('(()=>{try{CivilPlatform.validate(State);return true}catch(e){return e.message}})()')===true,'strict import');fs.writeFileSync(path.join(dir,'ui-evidence.json'),JSON.stringify({kind:'isolated native 283 after final UI changes; no game mutations',at,views:evidence.length,publicOptionsProgressive:true,pausedStateUnchanged:true,evidence},null,2));done=true;console.log('PUBLIC UI VERIFIED',evidence.length);ws.close();
