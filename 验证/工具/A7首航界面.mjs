// Fresh public ending imported into an isolated display copy (9372). No mainline is altered.
import fs from'node:fs';import assert from'node:assert/strict';import{connect}from'./a7-cdp.mjs';
const dir='验证/A7/7-全流程/界面复核/fresh-ending',b=await connect(9372,dir),report={kind:'native fresh-ending display copy; real inputs, not another playthrough',widths:[]};
assert.ok(await b.read('!!State.civilization.polity?.earth?.ending'));assert.ok(await b.read('CivilClock.paused'));
const before=await b.read('JSON.stringify(State)');
await b.click('#civilSound > summary');if(!await b.read('CivilSound.prefs.music'))await b.click('#sound_music');await b.click('#civilSound > summary');await b.sleep(3500);
for(const width of[1280,853,390]){
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await b.click('#location_research');await b.click('#civilChronicle');await b.sleep(600);
 const info=await b.read(`(()=>{const e=document.querySelector('#event'),r=e.getBoundingClientRect();return {width:innerWidth,event:r.toJSON(),pageOverflow:document.documentElement.scrollWidth>innerWidth+1,scrollable:e.scrollHeight>e.clientHeight,paragraphs:e.querySelectorAll('p').length,text:e.innerText,focus:document.activeElement?.outerHTML.slice(0,180),music:CivilSound.channels.music?.id,playing:CivilSound.channels.music?.audio.paused===false,musicGain:CivilSound.buses.music.gain.value};})()`);
 assert.ok(!info.pageOverflow);assert.ok(info.event.x>=0&&info.event.right<=width+1);assert.ok(info.text.includes('火与最初的名字')&&info.text.includes('先进社会与地球'));assert.equal(info.music,'flight');assert.equal(info.playing,true);assert.ok(Math.abs(info.musicGain-.6*Math.pow(10,-6/20))<.01);
 await b.shot('chronicle-'+width);await b.raw('#event #close');report.widths.push({...info,text:info.text.slice(0,300)});
}
await b.click('#civilSound > summary');await b.click('#sound_music');await b.click('#civilSound > summary');await b.sleep(3300);report.muted=await b.read('!CivilSound.prefs.music&&CivilSound.buses.music.gain.value===0');assert.ok(report.muted);
report.worldUnchanged=before===await b.read('JSON.stringify(State)');assert.ok(report.worldUnchanged);report.failures=await b.read('CivilSound.failures');assert.equal(report.failures.length,0);report.errors=b.events;assert.equal(b.events.filter(e=>e.method==='Runtime.exceptionThrown').length,0);
fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({widths:report.widths.map(x=>x.width),music:'flight',muted:report.muted,worldUnchanged:report.worldUnchanged}));b.close();
