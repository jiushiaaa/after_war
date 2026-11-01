const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),copy=x=>JSON.parse(JSON.stringify(x));
const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('content/')||x.startsWith('src/postwar/'));
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-passenger-construction.json'),'utf8')).state,notes=[],elements=new Map();let active=null,saves=0;
  const $=selector=>{
    if(selector.startsWith('<'))return {attrs:{},children:[],handlers:{},addClass(){return this;},text(value){this.value=value;return this;},attr(values){Object.assign(this.attrs,values);return this;},click(fn){this.handlers.click=fn;return this;},on(name,fn){this.handlers[name]=fn;return this;},appendTo(parent){parent.children.push(this);return this;}};
    if(!elements.has(selector))elements.set(selector,{children:[],empty(){this.children=[];return this;}});return elements.get(selector);
  };
  const ctx=vm.createContext({State:s,_:x=>x,$,TextDecoder,TextEncoder,setTimeout,clearTimeout,setInterval,clearInterval,performance,
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){},killVillagers(n){s.game.population-=n;}},Events:{activeEvent:()=>active,startEvent(e){active=e;},buttonClick(){}},AudioEngine:{},
    Engine:{saveGame(){saves++;}},Notifications:{printMessage:text=>notes.push(text)},$SM:{get:p=>p.split('.').reduce((v,k)=>v?.[k],s),fireUpdate(){}}});
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.CivilClock=new ctx.SimulationClock();ctx.CivilClock.rate=s.civilization.speed;
  ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};
  ctx.Outside.updateWorkersView=()=>{};
  return {s,ctx,notes,elements,clearEvent(){active=null;},blockEvent(){active={title:'正在处理的事件'};},get active(){return active;},get saves(){return saves;}};
}
function clockHarness(){
  let now=0,serial=0;const callbacks=new Map();
  const ctx=vm.createContext({performance:{now:()=>now},setInterval:fn=>{const id=++serial;callbacks.set(id,fn);return id;},clearInterval:id=>callbacks.delete(id)});
  vm.runInContext(fs.readFileSync(path.join(root,'src/postwar/clock.js'),'utf8'),ctx);
  return {Clock:ctx.SimulationClock,callbacks,elapse(ms){now+=ms;for(const fn of [...callbacks.values()])fn();}};
}

test('one native speed entry lists only earned choices and never interrupts another or pending event',()=>{
  const h=harness(),{s,ctx}=h,c=s.civilization,C=ctx.Civilization;c.maxSpeed=4;c.speed=4;C.renderSpeed();
  let children=h.elements.get('#speedMenu').children;assert.equal(children.length,1);assert.equal(children[0].value,'速度：4×');assert.equal(children[0].attrs.role,'button');
  h.blockEvent();const active=h.active;children[0].handlers.click();assert.equal(h.active,active);
  h.clearEvent();c.pending='merchant';assert.equal(C.speedMenu(),false);assert.equal(h.active,null);c.pending=null;
  children[0].handlers.click();assert.equal(h.active.title,'时间流速');assert.deepEqual(Object.keys(h.active.scenes.start.buttons),['speed_1','speed_2','speed_4','close']);
  h.active.scenes.start.buttons.speed_2.onChoose();assert.equal(c.speed,2);assert.equal(ctx.CivilClock.rate,2);assert.equal(h.saves,1);assert.equal(h.elements.get('#speedMenu').children[0].value,'速度：2×');
  h.clearEvent();let prevented=false;h.elements.get('#speedMenu').children[0].handlers.keydown({key:'Enter',preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(h.active.title,'时间流速');
});

test('unmodified natural 4x saves initialize byte-for-byte and unlock 8x on the next ordinary tick without changing selected speed',()=>{
  const h=harness(),{s,ctx}=h,c=s.civilization;assert.equal(c.maxSpeed,4);assert.equal(c.urban.city,true);assert.equal(c.tech.passenger_transport,true);
  ctx.CivilPlatform.validate(s);const before=JSON.stringify(s);ctx.Civilization.initState();assert.equal(JSON.stringify(s),before);
  h.blockEvent();ctx.Civilization.tick();assert.equal(c.maxSpeed,8);assert.equal(c.speed,4);assert.equal(ctx.CivilClock.rate,4);assert.equal(h.notes.filter(n=>n.includes('8×')).length,1);ctx.CivilPlatform.validate(s);
  ctx.Civilization.tick();assert.equal(h.notes.filter(n=>n.includes('8×')).length,1);
});

test('8x requires city plus passenger organization and 16x requires a second recorded city, independently of current population',()=>{
  const h=harness(),{s,ctx}=h,C=ctx.Civilization,c=s.civilization;
  c.maxSpeed=4;c.urban.city=false;assert.equal(C.unlockSpeed(),false);c.urban.city=true;c.tech.passenger_transport=false;assert.equal(C.unlockSpeed(),false);
  c.tech.passenger_transport=true;assert.equal(C.unlockSpeed(),true);assert.equal(c.maxSpeed,8);assert.equal(C.setSpeed(16),false);
  for(const n of Object.values(c.municipal.nodes)){n.city=false;n.town=true;}s.game.population=3000;assert.equal(C.unlockSpeed(),false);assert.equal(c.maxSpeed,8,'a large population or several towns is not two cities');
  // A registered milestone is permanent; this fixture tests the unlock rule, not city acquisition.
  c.municipal.nodes.river.city=true;s.game.population=0;assert.equal(C.unlockSpeed(),true);assert.equal(c.maxSpeed,16);assert.equal(c.speed,4);
  s.civilization.regions.nodes.river.population=0;assert.equal(C.unlockSpeed(),false);assert.equal(c.maxSpeed,16);
  assert.equal(C.setSpeed(16),true);assert.equal(ctx.CivilClock.rate,16);assert.equal(C.setSpeed(1),true);assert.equal(c.maxSpeed,16);assert.equal(c.speed,1);
});

test('the save codec accepts old 1/2/4 and earned 8/16 while rejecting arbitrary rates and unearned high-speed claims',()=>{
  const h=harness(),{s,ctx}=h;
  for(const n of [1,2,4]){const x=copy(s);x.civilization.speed=n;x.civilization.maxSpeed=n;assert.doesNotThrow(()=>ctx.CivilPlatform.validate(x));}
  const eight=copy(s);eight.civilization.maxSpeed=8;eight.civilization.speed=8;assert.doesNotThrow(()=>ctx.CivilPlatform.validate(eight));
  const lost=copy(eight);lost.civilization.tech.passenger_transport=false;assert.throws(()=>ctx.CivilPlatform.validate(lost));
  const sixteen=copy(eight);sixteen.civilization.maxSpeed=16;sixteen.civilization.speed=16;assert.throws(()=>ctx.CivilPlatform.validate(sixteen));
  sixteen.civilization.municipal.nodes.river.town=true;sixteen.civilization.municipal.nodes.river.city=true;assert.doesNotThrow(()=>ctx.CivilPlatform.validate(sixteen));
  for(const n of [0,-1,3,32,Infinity,NaN,'8',null]){const bad=copy(s);bad.civilization.speed=n;assert.throws(()=>ctx.CivilPlatform.validate(bad));}
  for(const n of [0,-1,3,32,Infinity,NaN,'8',null]){const bad=copy(s);bad.civilization.maxSpeed=n;assert.throws(()=>ctx.CivilPlatform.validate(bad));}
  const over=copy(s);over.civilization.speed=8;assert.throws(()=>ctx.CivilPlatform.validate(over));
});

test('all simulation deadlines retain their order across 1/2/4/8/16x, including construction, travel, aging and cooldowns',()=>{
  const h=clockHarness(),clock=new h.Clock(),counts={production:0,construction:0,age:0},events=[];
  clock.add(()=>counts.production++,10000,10000,'production');clock.add(()=>counts.construction++,1000,1000,'construction');clock.add(()=>counts.age++,600000,600000,'age');
  for(const [key,at]of [['cooldown',60000],['journey',120000],['event',180000],['fire',300000]])clock.add(()=>events.push([key,clock.time]),at,0,key);
  clock.start();clock.start();assert.equal(h.callbacks.size,1);
  for(const [rate,seconds]of [[1,10],[2,10],[4,10],[8,10],[16,28.125]]){clock.rate=rate;for(let i=0;i<seconds*8;i++)h.elapse(125);}
  assert.equal(clock.time,600000);assert.deepEqual(counts,{production:60,construction:600,age:1});assert.deepEqual(events,[['cooldown',60000],['journey',120000],['event',180000],['fire',300000]]);
});

test('driver suspension and reload preserve remaining simulation time without offline catch-up or duplicate timers',()=>{
  const h=clockHarness(),clock=new h.Clock();let hits=0;clock.rate=16;clock.add(()=>hits++,60000,0,'journey');clock.start();h.elapse(500);assert.equal(clock.time,8000);
  h.elapse(3600000);assert.equal(clock.time,24000,'an hour-suspended driver admits at most the existing one-second wall-time cap');assert.equal(hits,0);
  const timers=clock.snapshot();assert.equal(timers.journey,36000);clock.stop();assert.equal(h.callbacks.size,0);h.elapse(3600000);assert.equal(hits,0);
  const resumed=new h.Clock();resumed.rate=8;resumed.restored=copy(timers);resumed.add(()=>hits++,60000,0,'journey');resumed.start();h.elapse(1000);assert.equal(hits,0);resumed.rate=16;h.elapse(1000);assert.equal(hits,0);h.elapse(750);assert.equal(hits,1);assert.equal(resumed.time,36000);resumed.stop();
});

test('invalid rate changes and invalid durations cannot poison the active clock or selected speed',()=>{
  const h=harness(),{s,ctx}=h,c=s.civilization,clock=ctx.CivilClock,rate=clock.rate,speed=c.speed;let calls=0;clock.add(()=>calls++,1000);
  for(const n of [0,-1,3,32,Infinity,NaN,'8',null]){assert.throws(()=>{clock.rate=n;});assert.equal(clock.rate,rate);assert.equal(ctx.Civilization.setSpeed(n),false);assert.equal(c.speed,speed);}
  for(const ms of [-1,NaN,Infinity,'1000'])assert.throws(()=>clock.advance(ms));assert.equal(clock.time,0);clock.advance(1000);assert.equal(calls,1);
});
