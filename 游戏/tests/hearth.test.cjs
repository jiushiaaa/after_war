const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),copy=x=>JSON.parse(JSON.stringify(x));
function harness({adapted=true,state,restored}={}){
  const s=state||{game:{fire:{value:2,text:'微火'},temperature:{value:2,text:'适宜'},builder:{level:4},buildings:{}},stores:{wood:10},civilization:{village:{town:false},urban:{city:false}}},messages=[];
  const ctx=vm.createContext({State:s,_:x=>x,AudioLibrary:new Proxy({},{get:(_,k)=>k}),AudioEngine:{playSound(){}},Notifications:{notify:(m,text)=>messages.push(text)},Button:{clearCooldown(){}},$:()=>({length:0}),performance,setInterval,clearInterval});
  ctx.$SM={get(p,zero){const value=p.split('.').reduce((v,k)=>v?.[k],s);return value===undefined&&zero?0:value;},set(p,value){const keys=p.split('.');let target=s;for(const key of keys.slice(0,-1))target=target[key]??={};target[keys.at(-1)]=value;return value;}};
  for(const f of ['src/postwar/clock.js','script/room.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
  const clock=new ctx.SimulationClock();clock.restored=restored;
  ctx.Engine={activeModule:null,clearTimeout:id=>clock.clear(id),setTimeout(fn,delay){const key=fn===ctx.Room.coolFire?'fire':fn===ctx.Room.adjustTemp?'temperature':undefined;return clock.add(fn,delay,0,key);}};
  ctx.Room.updateButton=()=>{};ctx.Room.setTitle=()=>{};ctx.Room.setMusic=()=>{};
  if(adapted)vm.runInContext(fs.readFileSync(path.join(root,'src/postwar/hearth.js'),'utf8'),ctx);
  return {s,ctx,clock,messages,begin(){ctx.Room._fireTimer=ctx.Engine.setTimeout(ctx.Room.coolFire,300000);ctx.Room._tempTimer=ctx.Engine.setTimeout(ctx.Room.adjustTemp,30000);}};
}
function dom(ctx){
  const nodes=new Map();
  function element(tag){return {tag,length:1,attrs:{},style:{},children:[],visible:true,parent:null,
    attr(key,value){if(typeof key==='object'){Object.assign(this.attrs,key);if(key.id)nodes.set('#'+key.id,this);}else if(value===undefined)return this.attrs[key];else{this.attrs[key]=value;if(key==='id')nodes.set('#'+value,this);}return this;},
    css(key,value){if(typeof key==='object')Object.assign(this.style,key);else this.style[key]=value;return this;},text(value){this.value=value;return this;},toggle(value){this.visible=value;return this;},
    appendTo(parent){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=typeof parent==='string'?nodes.get(parent):parent;this.parent?.children.push(this);return this;},
    insertAfter(selector){return this.appendTo(nodes.get(selector)?.parent||nodes.get('#roomPanel'));},insertBefore(selector){return this.appendTo(nodes.get(selector)?.parent||nodes.get('#roomPanel'));}};}
  const room=element('div').attr('id','roomPanel');element('div').attr('id','lightButton').appendTo(room);element('div').attr('id','stokeButton').appendTo(room);
  ctx.$=selector=>selector.startsWith('<')?element(selector):nodes.get(selector)||{length:0};return nodes;
}

test('normal automatic watch keeps the original exact five-minute one-wood cadence without changing the save shape',()=>{
  const h=harness(),legacy=harness({adapted:false,state:copy(h.s)});h.begin();legacy.begin();
  const keys=Object.keys(h.s.civilization);h.clock.advance(299999);legacy.clock.advance(299999);assert.equal(h.s.stores.wood,10);
  h.clock.advance(1);legacy.clock.advance(1);assert.equal(h.s.stores.wood,9);assert.equal(h.s.game.fire.value,2);
  for(let i=0;i<5;i++){h.clock.advance(300000);legacy.clock.advance(300000);assert.deepEqual(copy(h.s),copy(legacy.s));}
  assert.equal(h.s.stores.wood,4);assert.deepEqual(Object.keys(h.s.civilization),keys);assert.equal(h.clock.snapshot().fire,300000);
});

test('fractional wood cannot fund manual or automatic tending, and the unfunded hearth cools without negative inventory',()=>{
  const h=harness();h.s.stores.wood=.5;const before=copy(h.s);h.ctx.Room.stokeFire();assert.deepEqual(copy(h.s),before);assert.match(h.messages.at(-1),/1份木料/);
  h.begin();h.clock.advance(300000);assert.equal(h.s.stores.wood,.5);assert.equal(h.s.game.fire.value,1);h.clock.advance(300000);assert.equal(h.s.stores.wood,.5);assert.equal(h.s.game.fire.value,0);
  h.clock.advance(300000);assert.equal(h.clock.snapshot().fire,undefined);assert.equal(h.s.game.temperature.value,0);assert.equal(h.s.stores.wood,.5);
});

test('an extinguished city hearth consumes no wood or electricity and can recover only through the existing paid light action',()=>{
  const h=harness();h.s.game.fire.value=0;h.s.game.temperature.value=0;h.s.stores.wood=20;h.s.civilization.urban.city=true;h.s.civilization.industry={generation:80,used:60,online:true};h.s.game.buildings.utilitypower=2;
  const before=JSON.stringify(h.s);h.ctx.CivilHearth.install();assert.equal(JSON.stringify(h.s),before);h.begin();h.clock.advance(900000);
  assert.equal(h.s.stores.wood,20);assert.equal(h.s.game.fire.value,0);assert.equal(h.s.game.temperature.value,0);assert.deepEqual(h.s.civilization.industry,{generation:80,used:60,online:true});
  h.s.stores.wood=4.5;h.ctx.Room.lightFire();assert.equal(h.s.game.fire.value,0);assert.equal(h.s.stores.wood,4.5);
  h.s.stores.wood=5;h.ctx.Room.lightFire();assert.equal(h.s.game.fire.value,3);assert.equal(h.s.stores.wood,0);assert.equal(h.clock.snapshot().fire,300000);h.clock.advance(60000);assert.equal(h.s.game.temperature.value,2);
});

test('manual tending still pays one whole wood and defers the shared fire deadline, while reload preserves its remainder',()=>{
  const h=harness();h.begin();h.clock.advance(100000);h.ctx.Room.stokeFire();assert.equal(h.s.stores.wood,9);assert.equal(h.s.game.fire.value,3);assert.equal(h.clock.snapshot().fire,300000);
  h.clock.advance(123000);const timers=copy(h.clock.snapshot()),saved=copy(h.s),resumed=harness({state:copy(saved),restored:timers});resumed.begin();assert.deepEqual(copy(resumed.s),saved);assert.equal(resumed.clock.snapshot().fire,177000);
  resumed.clock.advance(176999);assert.equal(resumed.s.game.fire.value,3);resumed.clock.advance(1);assert.equal(resumed.s.game.fire.value,2);assert.equal(resumed.s.stores.wood,9,'strong flames cool once before watch needs fuel');resumed.clock.advance(300000);assert.equal(resumed.s.stores.wood,8);assert.equal(resumed.s.game.fire.value,2);
});

test('introductory free fire and unattended early cooling retain the original behavior',()=>{
  const h=harness();delete h.s.stores.wood;h.s.game.fire.value=0;h.s.game.builder.level=0;h.ctx.Room.lightFire();assert.equal(h.s.game.fire.value,3);assert.equal(h.s.stores.wood,undefined);
  h.s.stores.wood=10;h.clock.advance(300000);assert.equal(h.s.game.fire.value,2);h.clock.advance(300000);assert.equal(h.s.game.fire.value,1);assert.equal(h.s.stores.wood,10,'the early stranger has not begun watching the fire');
});

test('municipal delegation can file routine hearth notices without changing fuel cadence or hiding an extinguished hearth',()=>{
  const h=harness(),legacy=harness({state:copy(h.s)});h.s.civilization.cityCouncil={offices:{home:{completedAt:1},lake:{completedAt:1},ridge:{completedAt:1}}};
  const notify=h.ctx.Notifications.notify;h.ctx.Notifications.notify=(module,text)=>{if(!h.ctx.CivilHearth.quietRoutine(h.s,text))notify(module,text);};
  h.begin();legacy.begin();h.clock.advance(300000);legacy.clock.advance(300000);assert.equal(h.s.stores.wood,legacy.s.stores.wood);assert.equal(h.s.game.fire.value,legacy.s.game.fire.value);assert.equal(h.messages.length,0);assert.ok(legacy.messages.length>0);
  h.s.stores.wood=0;h.clock.advance(600000);assert.equal(h.s.game.fire.value,0);assert.ok(h.messages.length>0);assert.equal(h.ctx.CivilHearth.quietRoutine(h.s,'not enough wood to get the fire going'),false);
});

test('town hearth controls fold once, preserve the native buttons and reveal shortages in the closed summary',()=>{
  const h=harness(),nodes=dom(h.ctx),light=nodes.get('#lightButton'),stoke=nodes.get('#stokeButton'),before=JSON.stringify(h.s);stoke.originalAction=h.ctx.Room.stokeFire;
  h.ctx.CivilHearth.refresh(h.s);assert.equal(nodes.has('#hearthManagement'),false);assert.match(nodes.get('#hearthNote').value,/工匠已接手/);assert.equal(JSON.stringify(h.s),before);
  h.s.civilization.village.town=true;h.ctx.CivilHearth.refresh(h.s);const details=nodes.get('#hearthManagement');assert.equal(details.attrs.open,undefined);assert.equal(light.parent,nodes.get('#hearthControls'));assert.equal(stoke.parent,nodes.get('#hearthControls'));assert.equal(stoke.originalAction,h.ctx.Room.stokeFire);
  h.s.stores.wood=.5;h.ctx.CivilHearth.refresh(h.s);assert.match(nodes.get('#hearthSummary').value,/守火缺柴/);assert.equal(details.attrs.open,undefined);assert.equal(nodes.get('#hearthSummary').style.fontWeight,'bold');
  details.attr('open','open');h.s.civilization.urban.city=true;h.s.game.fire.value=0;h.ctx.CivilHearth.refresh(h.s);assert.equal(details.attrs.open,'open');assert.match(nodes.get('#hearthSummary').value,/旧维修间炉火.*炉火已熄/);assert.match(nodes.get('#hearthNote').value,/发电机优先供应工区与公用设施/);assert.equal(nodes.get('#hearthControls').children.filter(x=>x===stoke).length,1);
});

// Isolated native-room transition fixture: construction and paid electrical
// production are covered by heating.test.cjs. Here the historical handover is an
// explicit input, so the real clock and Room methods can be observed directly.
function retiredHearth({restored}={}){
  const h=harness({restored}),{s,ctx,clock}=h;
  s.game.population=1000;s.civilization.elapsed=100;s.civilization.heating={schema:1,nodes:{home:{introducedAt:0,manual:false,handedOverAt:90,handover:{},economy:null,emergency:null}}};
  ctx.CivilClock=clock;ctx.CivilServices={population:state=>state.game.population};ctx.CivilUrban={reservedBeds:()=>0};
  for(const f of ['src/postwar/rules.js','src/postwar/heating.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
  return h;
}

test('explicit handover cancels native heat timers and their saved remainders, including already-captured old callbacks',()=>{
  const h=retiredHearth({restored:{fire:177000,temperature:9000,builder:1200}}),{ctx,s,clock}=h;
  h.begin();assert.equal(clock.snapshot().fire,177000);const before=copy(s);ctx.CivilHearth.stopLegacy();
  assert.equal(clock.snapshot().fire,undefined);assert.equal(clock.snapshot().temperature,undefined);assert.equal(clock.snapshot().builder,1200);
  ctx.Room.coolFire();ctx.Room.adjustTemp();ctx.Room.onFireChange();clock.advance(900000);
  assert.deepEqual(copy(s),before);assert.equal(clock.snapshot().fire,undefined);assert.equal(clock.snapshot().temperature,undefined);
  const lazy=retiredHearth({restored:{fire:1,temperature:2}});lazy.ctx.CivilHearth.stopLegacy();assert.equal(lazy.clock.snapshot().fire,undefined);assert.equal(lazy.clock.snapshot().temperature,undefined,'unconsumed reload keys must also retire');
});

test('both old native fire buttons pay for one bounded emergency and cannot restart free tending or refund time on reload',()=>{
  const h=retiredHearth(),{ctx,s,clock}=h;s.stores.wood=20;
  ctx.Room.lightFire();assert.equal(s.stores.wood,15);assert.deepEqual(copy(ctx.CivilHeating.data(s).emergency),{at:100,until:220,capacity:20,cost:{wood:5}});
  const paid=copy(s);ctx.Room.stokeFire();ctx.Room.lightFire();assert.deepEqual(copy(s),paid);assert.equal(clock.snapshot().fire,undefined);assert.equal(clock.snapshot().temperature,undefined);
  const resumed=retiredHearth();Object.assign(resumed.s,copy(s));resumed.s.civilization.elapsed=219;assert.equal(resumed.ctx.CivilHeating.workshopReady(resumed.s),true);resumed.ctx.Room.lightFire();assert.equal(resumed.s.stores.wood,15);
  resumed.s.civilization.elapsed=220;assert.equal(resumed.ctx.CivilHeating.workshopReady(resumed.s),false);resumed.ctx.Room.stokeFire();assert.equal(resumed.s.stores.wood,10);assert.equal(resumed.ctx.CivilHeating.data(resumed.s).emergency.until,340);
  resumed.s.civilization.elapsed=340;resumed.s.stores.wood=4.5;const insufficient=copy(resumed.s);resumed.ctx.Room.lightFire();assert.deepEqual(copy(resumed.s),insufficient);assert.equal(resumed.clock.snapshot().fire,undefined);
});

test('the real Room build gate ignores stale warm temperature after handover and paid emergency enables a material-paid repair',()=>{
  const h=retiredHearth(),{ctx,s}=h;s.stores.wood=40;s.game.temperature.value=4;
  const normalized=p=>p.replace(/\["([^\"]+)"\]/g,'.$1'),originalGet=ctx.$SM.get,originalSet=ctx.$SM.set;
  ctx.$SM.get=(p,zero)=>originalGet(normalized(p),zero);ctx.$SM.set=(p,value)=>originalSet(normalized(p),value);ctx.$SM.setM=(p,values)=>{for(const [key,n]of Object.entries(values))ctx.$SM.set(p+'.'+key,n);};ctx.$SM.add=(p,n)=>ctx.$SM.set(p,(ctx.$SM.get(p,true)||0)+n);
  const originalDollar=ctx.$;ctx.$=value=>typeof value==='object'?value:originalDollar(value);const button={attr:()=> 'cart'};
  assert.equal(ctx.Room.build(button),false);assert.equal(s.stores.wood,40);assert.equal(s.game.buildings.cart,undefined);assert.match(h.messages.at(-1),/应急工作间/);
  ctx.Room.lightFire();assert.equal(s.stores.wood,35);s.game.temperature.value=0;ctx.Room.build(button);assert.equal(s.game.buildings.cart,1);assert.equal(s.stores.wood,5);assert.equal(ctx.CivilHeating.covered(s),false,'a repaired workshop never heats the whole city');
});
