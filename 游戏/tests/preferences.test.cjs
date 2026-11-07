const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const notices=[],calls=[],s={civilization:{elapsed:123,setup:{confirmed:true}},stores:{wood:7}},ctx=vm.createContext({State:s,Promise,clearTimeout(){},CivilClock:{paused:false},CivilLocalSaves:{queue:Promise.resolve(),metadata:s=>({year:0}),backupRestart:async row=>calls.push(['backup',row]),activate:async slot=>calls.push(['active',slot]),changed(){calls.push(['local-change']);}},CivilPlatform:{loaded:true,dirty:false,encode:async()=>JSON.stringify(ctx.State),changed(){if(this.loaded&&!this.transitioning&&ctx.State.civilization.setup.confirmed)this.dirty=true;},status:m=>notices.push(m)},Civilization:{restart(next){calls.push(['restart']);ctx.State=Object.keys(next).length?next:{civilization:{elapsed:0,setup:{confirmed:false}}};ctx.CivilClock.paused=true;}},Notifications:{notify:(_,m)=>notices.push(m)}});
 vm.runInContext(fs.readFileSync('src/postwar/preferences.js','utf8'),ctx);return {a:ctx.CivilPreferences,ctx,s,calls,notices};
}
test('theme preferences survive reload without entering the world or changing its data',async()=>{
 const {a,ctx,s}=fixture(),before=JSON.stringify(s),records=new Map();
 ctx.CivilLocalSaves.readRaw=async key=>records.get(key);ctx.CivilLocalSaves.writeRaw=async(key,value)=>records.set(key,value);
 await a.load();assert.equal(a.prefs.dark,false);await a.toggleTheme();assert.equal(a.prefs.dark,true);
 a.prefs={dark:false};await a.load();assert.equal(a.prefs.dark,true);assert.equal(JSON.stringify(s),before);
});
test('slow preference reads cannot undo clicks; rapid writes keep their final order and recover from failure',async()=>{
 const {a,ctx,notices}=fixture();let read,write;const rows=[];
 ctx.CivilLocalSaves.readRaw=()=>new Promise(r=>read=r);ctx.CivilLocalSaves.writeRaw=(_,p)=>new Promise(r=>{rows.push(p.dark);write=r;});
 const loading=a.load(),one=a.toggleTheme(),two=a.toggleTheme();read({dark:true});await loading;assert.equal(a.prefs.dark,false);
 await Promise.resolve();assert.deepEqual(rows,[true]);write();await one;await Promise.resolve();assert.deepEqual(rows,[true,false]);write();await two;
 ctx.CivilLocalSaves.writeRaw=async()=>{throw Error('quota');};await a.toggleTheme();assert.equal(a.prefs.dark,true);assert.match(notices[0],/未保存/);
 ctx.CivilLocalSaves.writeRaw=async()=>{};await a.save();assert.equal(a.prefs.dark,true);
});
test('new-world transition drains in-flight cloud and local writes, backs up exactly once, and waits for seed confirmation to autosave',async()=>{
 const {a,ctx,s,calls}=fixture();let cloud,local;
 ctx.CivilPlatform.writePromise=new Promise(r=>cloud=r);ctx.CivilLocalSaves.queue=new Promise(r=>local=r);
 const pending=a.restartWorld();assert.equal(ctx.CivilClock.paused,true);assert.equal(ctx.CivilPlatform.transitioning,true);assert.equal(ctx.CivilLocalSaves.suspended,true);
 assert.equal(await a.restartWorld(),false);assert.deepEqual(calls,[]);
 cloud();await Promise.resolve();assert.deepEqual(calls,[]);local();assert.equal(await pending,true);
 assert.deepEqual(calls.map(c=>c[0]),['backup','restart']);assert.equal(calls[0][1].text,JSON.stringify(s));
 assert.equal(ctx.State.civilization.setup.confirmed,false);assert.equal(ctx.CivilPlatform.dirty,false);
 assert.equal(ctx.CivilPlatform.transitioning,false);assert.equal(ctx.CivilLocalSaves.suspended,false);
 ctx.State.civilization.setup.confirmed=true;ctx.CivilPlatform.changed();assert.equal(ctx.CivilPlatform.dirty,true);
});
test('a failed backup cancels restart without changing the world or its pause setting',async()=>{
 for(const paused of [false,true]){const {a,ctx,s,calls,notices}=fixture(),before=JSON.stringify(s);ctx.CivilClock.paused=paused;
 ctx.CivilLocalSaves.backupRestart=async()=>{throw Error('quota');};assert.equal(await a.restartWorld(),false);
 assert.equal(ctx.State,s);assert.equal(JSON.stringify(s),before);assert.equal(ctx.CivilClock.paused,paused);assert.equal(calls.length,0);assert.match(notices[0],/当前世界仍在/);assert.equal(a.restarting,false);}
});
test('backup restoration also preserves the departing world and keeps original local slots read-only',async()=>{
 const {a,ctx,s,calls}=fixture(),restored={civilization:{elapsed:456,setup:{confirmed:true}},stores:{wood:11}};
 assert.equal(await a.restartWorld(restored,true),true);assert.equal(calls[0][1].text,JSON.stringify(s));assert.deepEqual(calls.map(c=>c[0]),['backup','active','restart']);assert.equal(calls[1][1],null);assert.equal(ctx.State,restored);
});
test('an initialization error after backup blocks all automatic writes of partial new state',async()=>{
 const {a,ctx,calls,notices}=fixture();ctx.Civilization.restart=()=>{ctx.State={civilization:{setup:{confirmed:true}}};throw Error('render');};
 assert.equal(await a.restartWorld(),false);assert.equal(calls[0][0],'backup');assert.equal(ctx.CivilPlatform.loaded,false);assert.equal(ctx.CivilLocalSaves.blocked,true);assert.equal(ctx.CivilPlatform.dirty,false);assert.equal(ctx.CivilClock.paused,true);assert.match(notices[0],/备份已保留/);
});
test('successful cloud saves are silent; failures remain visible and retryable',async()=>{
 const statuses=[],ctx=vm.createContext({State:{civilization:{setup:{confirmed:true}}},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(fs.readFileSync('src/postwar/platform.js','utf8'),ctx);const a=ctx.CivilPlatform;let release,entered;const writing=new Promise(r=>entered=r);
 a.status=m=>statuses.push(m);a.loaded=true;a.dirty=true;a.encode=async()=>'snapshot';a.sdk={writeSave:()=>new Promise(r=>{release=r;entered();})};
 const pending=a.flush();await writing;const inflight=a.writePromise;assert.ok(inflight);assert.equal(a.busy,true);release();await pending;await inflight;assert.equal(a.busy,false);assert.deepEqual(statuses,[]);
 a.sdk.writeSave=async()=>{throw Error('offline');};a.dirty=true;await a.flush();assert.equal(a.dirty,true);assert.match(statuses[0],/云端未保存/);
 a.sdk.writeSave=async()=>{};await a.flush();assert.equal(a.dirty,false);assert.equal(a.error,null);assert.equal(statuses.length,1);
});
