// Natural A3 continuation from native city saves, real input only. No state/time/resources injected.
import fs from 'node:fs';import path from 'node:path';
const [port='9372',dir='/tmp/postwar-a4-regional-20261105/public']=process.argv.slice(2);fs.mkdirSync(dir,{recursive:true});
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
 for(let n=0;n<6;n++){if(await click(css))break;if(n===5)throw Error('Cannot reach selection '+css);await sleep(300);}
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 const o=await read(`(()=>{const e=${q(css)};return {index:e.selectedIndex,target:[...e.options].findIndex(x=>x.value===${JSON.stringify(value)})};})()`);if(o.target<0)throw Error('option '+value);
 for(let j=0;j<Math.abs(o.target-o.index);j++)for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:o.target>o.index?'ArrowDown':'ArrowUp',code:o.target>o.index?'ArrowDown':'ArrowUp',windowsVirtualKeyCode:o.target>o.index?40:38});
 for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(250);const actual=await read(`${q(css)}.value`);log('select',{css,value,actual});if(actual!==value)throw Error('Native select did not change: '+css);return true;
}



const route=port==='9372'?'public':'industrial',base=route==='public'?318:320;
const observe=()=>read(`(()=>{const s=State,r=CivilRegional,d=r.data(s);return {at:s.civilization.elapsed,paused:!!CivilClock.paused,event:Events.activeEvent()?.title,pending:s.civilization.pending,buttons:[...document.querySelectorAll('#event .button')].filter(b=>!b.classList.contains('disabled')).map(b=>b.id),known:r.known(s),common:r.governed(s),regional:d,regionReason:r.dispatchReason(s),consent:r.consent(s,19200),cityReason:r.cityReason(s),cities:CivilCityCouncil.ids(s).map(id=>{const n=CivilCityCouncil.local(s,id);return {id,people:CivilCity.count(n),health:n.health,stable:n.stable,stores:n.stores};})};})()`);
async function pause(value){for(let i=0;i<6;i++){if(await read('!!CivilClock.paused')===value)return;const s=await observe();if(s.event&&s.pending){const k=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!k||!s.buttons.includes(k))throw Error('Unknown decision '+s.pending);await raw('#event #'+k);continue;}await raw('#speedButton');await raw('#event #pause');}throw Error('Pause failed');}
async function region(){await click('#location_city');for(let k=0;k<30&&await read("$('#locationSlider').is(':animated')");k++)await sleep(100);if(!await click('#domainEntry'))throw Error('Regional entry unavailable');}
async function exportSave(label){await pause(true);await region();if(!await read("document.querySelector('#regionalDesk').open"))await click('#regionalDesk > summary');const destination=path.resolve(dir,label);fs.mkdirSync(destination,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:destination});if(!await raw('#saveMenu')||!await raw('#event #download'))throw Error('Export unavailable');await sleep(1500);await raw('#event #close');const state=await observe();fs.writeFileSync(path.join(destination,'observation.json'),JSON.stringify(state,null,2));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(destination,'screen.png'),Buffer.from(shot.result.data,'base64'));log('export',{label,at:state.at});}

const report={route,source:process.argv[4]};if(!report.source)throw Error('Provide native pre-compact export');
await send('Page.navigate',{url:'http://127.0.0.1:4180/?regional-handoff=1'});await sleep(1500);for(let i=0;i<80&&!await read("typeof State!=='undefined' && typeof CivilRegional!=='undefined' && typeof CivilClock!=='undefined'");i++)await sleep(100);
await pause(true);await raw('#saveMenu');await raw('#event #import');await raw('#event textarea');await send('Input.insertText',{text:fs.readFileSync(report.source,'utf8')});await raw('#event #inspect');for(let i=0;i<100&&!await read("!!document.querySelector('#event #replace')");i++)await sleep(100);if(!await raw('#event #replace'))throw Error('Native import rejected');await pause(true);await region();await select('#regionalShare',route==='public'?'2400':'480');
if(!await click('#regional_agree'))throw Error('Cannot agree: '+await read('CivilRegional.reason(State,CivilRegionalView.share)'));
if(!await read('State.civilization.regional.pact.handoff===1'))throw Error('Old code still loaded');report.from=(await observe()).at;await exportSave(base+'_paid_handoff');await pause(false);
const deadline=Date.now()+10*60*1000;while(Date.now()<deadline){const s=await observe();if(s.event){const k=s.pending==='succession'?'engineer':s.pending==='cold'?'wood':s.pending==='roadIncident'?'repair':null;if(!k||!s.buttons.includes(k))throw Error('Unknown decision '+s.pending);await raw('#event #'+k);continue;}
 if(s.regional.deliveries.some(p=>p.deliveredAt!==null)){await exportSave((base+1)+'_first_city_delivery');report.to=(await observe()).at;report.paidLocal=await read("State.civilization.regional.ledger.filter(e=>e.kind==='levee' && e.local>0).map(e=>({at:e.at,paid:e.paid,local:e.local}))");report.floodLoss=await read("State.civilization.regional.ledger.filter(e=>e.kind==='flood').reduce((v,e)=>v+e.food,0)");if(report.floodLoss!==0)throw Error('First handoff caused a supply gap');report.health=s.regional.node.health;report.levee=s.regional.levee;done=true;break;}await sleep(950);
}if(!done)throw Error('First shipment not finished; keep current browser');fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));ws.close();
