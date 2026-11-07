const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function sound(extra={}){const ctx=vm.createContext({setTimeout:()=>0,clearTimeout(){},Date,console,...extra});vm.runInContext(fs.readFileSync('src/postwar/sound.js','utf8'),ctx);return ctx.CivilSound;}
test('A7 sound selects every actual era and both city routes, with local ambience and echo priority',()=>{const a=sound(),c={},s={civilization:c};assert.equal(a.select(s).music,'room');c.settled=true;assert.equal(a.select(s).music,'village');c.village={town:true};assert.equal(a.select(s).music,'town');c.city={cityAt:100};c.course={id:'commons'};assert.equal(a.select(s).music,'public');c.course.id='industry';assert.equal(a.select(s).music,'industry');assert.equal(a.select(s).ambient,'factory');c.cityCouncil={};assert.equal(a.select(s).music,'nation');c.polity={future:{}};assert.equal(a.select(s).music,'advanced');assert.equal(a.select(s,{event:'旧战场回响'}).music,'echo');c.expedition={party:{encounter:'beetle'}};assert.equal(a.select(s).ambient,'beetle');c.polity.earth={ending:{}};assert.equal(a.select(s).music,'flight');});
test('A7 sound settings normalize locally; mobile defaults to no environment and cannot exceed safe gain',()=>{const a=sound();assert.equal(a.normalize(null,true).ambient,false);assert.equal(a.normalize(null,false).ambient,true);assert.equal(a.normalize({volume:20,music:false}).volume,1);assert.equal(a.normalize({volume:NaN}).volume,.55);assert.equal(a.normalize({volume:-2}).volume,0);assert.equal(a.normalize({music:false}).music,false);});
test('A7 no media is created before user unlock; blocked playback is caught',async()=>{let made=0;const a=sound({Audio:class{constructor(){made++;}}});a.prefs=a.defaults();await a.switch('music','room');await a.effect('audio/build.flac');assert.equal(made,0);assert.equal(a.context,null);});
test('A7 transition waits for new playback, fades for three seconds and invalidates stale loading tracks',async()=>{const waiting=[],ramps=[];const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v,t){ramps.push({v,t});this.value=v;}}),ctx={currentTime:10,createGain(){return {gain:param(),connect(){},disconnect(){}};},createMediaElementSource(){return {connect(){},disconnect(){}};}};
 class Media{constructor(path){this.path=path;}play(){return new Promise(r=>waiting.push({path:this.path,resolve:r}));}pause(){this.paused=true;}removeAttribute(){}load(){}}
 const a=sound({Audio:Media});a.context=ctx;a.buses={music:ctx.createGain()};a.unlocked=true;
 const one=a.switch('music','room');waiting.shift().resolve();await one;assert.equal(a.channels.music.id,'room');
 const two=a.switch('music','town'),three=a.switch('music','industry');waiting.shift().resolve();await two;assert.equal(a.channels.music.id,'room');waiting.shift().resolve();await three;assert.equal(a.channels.music.id,'industry');assert.equal(a.retiring.size,1);assert.ok(ramps.some(r=>r.v===0&&r.t===13));assert.ok(ramps.some(r=>r.v===a.levels.industry&&r.t===13));
});
test('A7 ambient bus is forty percent of background and native events duck background by six dB',()=>{const values={},a=sound();a.context={};a.prefs=a.defaults();a.master={gain:'master'};a.buses={music:{gain:'music'},ambient:{gain:'ambient'},effects:{gain:'effects'}};a.ramp=(p,v)=>values[p]=v;a.gains(false);assert.equal(values.ambient/values.music,.4);a.gains(true);assert.ok(Math.abs(values.music/.6-Math.pow(10,-6/20))<1e-12);a.prefs.music=false;a.gains();assert.equal(values.music,0);assert.equal(values.ambient,.24);});
test('a slow preference read cannot undo a newer mute and preference writes retain their order',async()=>{
 let read,release;const writes=[],a=sound({CivilLocalSaves:{readRaw:()=>new Promise(r=>read=r)}});
 a.mobile=()=>false;a.menu=a.update=()=>{};a.prefs=a.defaults();
 a.writePreferences=p=>new Promise(r=>{writes.push(p);release=r;});
 const loading=a.restorePreferences();a.prefs.music=false;const muted=a.save();a.prefs.volume=.2;const quieter=a.save();
 read({music:true,volume:1});await loading;assert.equal(a.prefs.music,false);assert.equal(a.prefs.volume,.2);
 await Promise.resolve();assert.equal(writes.length,1);assert.equal(writes[0].music,false);assert.equal(writes[0].volume,.55);
 release();await muted;await Promise.resolve();assert.equal(writes.length,2);assert.equal(writes[1].volume,.2);release();await quieter;
});
test('remembered device preferences restore without touching the world and write failures stay retryable',async()=>{
 const state={civilization:{elapsed:123},stores:{wood:8}},before=JSON.stringify(state),a=sound({State:state,CivilLocalSaves:{readRaw:async()=>({music:false,ambient:false,volume:.3})}});
 a.mobile=()=>false;a.menu=a.update=()=>{};a.prefs=a.defaults();await a.restorePreferences();assert.equal(a.prefs.music,false);assert.equal(a.prefs.volume,.3);assert.equal(JSON.stringify(state),before);
 let attempts=0;a.writePreferences=async()=>{if(!attempts++)throw Error('quota');};await a.save();assert.equal(a.failures.length,1);await a.save();assert.equal(attempts,2);assert.equal(JSON.stringify(state),before);
});
