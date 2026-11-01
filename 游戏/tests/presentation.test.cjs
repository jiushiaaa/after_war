const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness:domainHarness,clone}=require('./helpers/metro-fixture.cjs');
const root=path.join(__dirname,'..');
const natural=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-second-city.json'),'utf8')).state;

// The real domain tick and clock run against the exact natural save. Only DOM
// painting is counted; this is a headless timing regression, not a browser test.
function advanceAt(rate){
  const h=domainHarness(natural()),{ctx,s}=h;let now=0,views=0,workers=0,villageTicks=0;
  ctx.performance={now:()=>now};ctx.Civilization.refresh=()=>{views++;};ctx.Outside.updateWorkersView=()=>{workers++;};
  const village=ctx.CivilVillage.tick.bind(ctx.CivilVillage);ctx.CivilVillage.tick=state=>{villageTicks++;return village(state);};
  const clock=new ctx.SimulationClock(()=>now);clock.rate=rate;
  clock.add(()=>{ctx.Civilization.tick();h.chooseRoutine();},1000,1000,'civilTick');
  for(let i=0;i<160000/rate/100;i++){now+=100;clock.advance(100*rate);}
  ctx.CivilPlatform.validate(s);
  return {s:clone(s),views,workers,villageTicks,settlements:h.settlements,events:h.events};
}

test('1x and 16x retain identical real economic, population, travel and event progress while reducing periodic views',()=>{
  const slow=advanceAt(1),fast=advanceAt(16);
  assert.deepEqual(fast.s,slow.s);assert.deepEqual(fast.events,slow.events);
  assert.deepEqual(fast.settlements,slow.settlements);assert.equal(fast.settlements.length,16);
  assert.equal(slow.villageTicks,160);assert.equal(fast.villageTicks,160);
  assert.equal(slow.workers,160);assert.equal(fast.workers,20);
  assert.equal(slow.views-slow.workers,1);assert.equal(fast.views-fast.workers,1,'the same routine event still refreshes immediately');
  assert.ok(fast.s.civilization.society.year>natural().civilization.society.year,'a real annual census occurred');
});

test('periodic rendering is bounded by wall time, not changed simulation seconds, and resetting permits an immediate frame',()=>{
  const h=domainHarness(natural()),{ctx,s}=h,C=ctx.Civilization;let now=100,views=0,workers=0;
  ctx.performance={now:()=>now};C.refresh=()=>{views++;};ctx.Outside.updateWorkersView=()=>{workers++;};
  const before=JSON.stringify(s);
  assert.equal(C.refreshPeriodic(),true);for(let i=0;i<16;i++)assert.equal(C.refreshPeriodic(),false);
  now=599;assert.equal(C.refreshPeriodic(),false);now=600;assert.equal(C.refreshPeriodic(),true);
  C.resetViewRefresh();assert.equal(C.refreshPeriodic(),true);assert.equal(views,3);assert.equal(workers,3);
  assert.equal(JSON.stringify(s),before,'presentation timing is never stored in the game');
  now=1;assert.equal(C.refreshPeriodic(),true,'a replaced/reset monotonic time source does not strand the UI');
});

// Minimal ADR primitives exercise the shipped adapter refresh and native button
// callback. All unrelated module renderers are inert, but no timing method is.
function viewHarness(){
  const s=natural(),elements=new Map(),calls={renders:0,workers:0,init:0};let now=100;
  class Element{
    constructor(length=1){this.length=length;this.attrs={};this.handlers={};this.items=[];}
    attr(k,v){if(typeof k==='object')Object.assign(this.attrs,k);else if(v===undefined)return this.attrs[k];else this.attrs[k]=v;return this;}
    appendTo(parent){parent=typeof parent==='string'?$(parent):parent;parent.items.push(this);if(this.attrs.id)elements.set('#'+this.attrs.id,this);return this;}
    text(){return this;}show(){return this;}hide(){return this;}toggle(){return this;}css(){return this;}addClass(){return this;}stop(){return this;}remove(){return this;}html(){return this;}
    find(){return new Element(0);}contents(){return this;}filter(){return this;}first(){return this;}replaceWith(){return this;}
  }
  const $=selector=>selector instanceof Element?selector:selector.startsWith('<')?new Element():elements.get(selector)||new Element(0);
  for(const id of ['roomPanel','roadPanel','stores','main'])elements.set('#'+id,new Element());
  const ctx=vm.createContext({State:s,_:x=>x,$,TextEncoder,TextDecoder,performance:{now:()=>now},setTimeout,clearTimeout,
    document:{createTextNode:text=>({nodeType:3,textContent:text})},
    Button:{Button:function(o){const b=new Element().attr('id',o.id);b.handlers.click=o.click;return b;},setDisabled(){}},
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){}},Events:{activeEvent:()=>null},AudioEngine:{},
    Engine:{saveGame(){},init(){calls.init++;}},Notifications:{notify(){},printMessage(){}},
    $SM:{get:(key,zero)=>key.split('.').reduce((v,k)=>v?.[k],s)??(zero?0:undefined),fireUpdate(){}}});
  const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  for(const name of ['CivilVillage','CivilSociety','CivilIndustry','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal','CivilAdvanced','CivilServices','CivilHearth','CivilFinance','CivilMetro','CivilHistory'])ctx[name].refresh=()=>{};
  ctx.CivilInterface.refresh=(_s,options)=>{assert.equal(options.summaries,false);calls.renders++;};
  ctx.Room.updateBuildButtons=()=>{};ctx.Outside.updateWorkersView=()=>{calls.workers++;};ctx.Civilization.roadModule={};
  ctx.CivilClock={stop(){}};ctx.Civilization.initState();
  return {ctx,s,calls,elements,time(value){now=value;}};
}

test('a native button refresh remains immediate inside the periodic quiet window, including two actions in the same simulated second',()=>{
  const h=viewHarness(),{ctx,s,calls}=h,C=ctx.Civilization,before=JSON.stringify(s);
  assert.equal(C.refreshPeriodic(),true);assert.equal(calls.renders,1);
  const button=C.button('presentationClick','查看','#roomPanel',()=>C.refresh());
  h.time(101);button.handlers.click();button.handlers.click();assert.equal(calls.renders,3);
  assert.equal(C.refreshPeriodic(),false);assert.equal(calls.workers,1);
  h.time(600);assert.equal(C.refreshPeriodic(),false);h.time(601);assert.equal(C.refreshPeriodic(),true);
  assert.equal(calls.renders,4);assert.equal(JSON.stringify(s),before);
});

test('the real restart clears only presentation throttling and never adds it to the imported save',()=>{
  const h=viewHarness(),{ctx,s,calls}=h,C=ctx.Civilization;C.refreshPeriodic();const before=JSON.stringify(s);
  assert.equal(C.refreshPeriodic(),false);C.restart(s);assert.equal(calls.init,1);assert.equal(C.lastViewRefreshAt,undefined);
  C.roadModule={}; // Native Engine.init rebuilds this location in the browser.
  assert.equal(C.refreshPeriodic(),true);assert.equal(calls.renders,2);assert.equal(JSON.stringify(s),before);
});

test('whole-page organization omits owner-rendered summaries while direct category selection still paints them immediately',()=>{
  const h=domainHarness(natural()),{ctx,s}=h,ui=ctx.CivilInterface,paint=[];
  // Chainable presentation primitives; the real Interface.urban/municipal and
  // refresh methods retain their conditional summary dispatch.
  let chain;chain=new Proxy({length:1,0:{style:{display:''}}},{get:(target,key)=>key in target?target[key]:(..._args)=>chain});ctx.$=()=>chain;
  ctx.CivilMunicipal.selected='river';ctx.Civilization.button=()=>chain;
  ui.summary=(selector)=>paint.push(selector);ui.tabs=()=> 'overview';ui.serviceGroups=()=>{};
  ui.industry=()=>{};ui.research=()=>{};ui.construction=()=>{};
  const before=JSON.stringify(s);
  ui.renderUrban(s);ui.renderMunicipal(s,'river');ui.summary('#councilRecord',ui.councilSummary(s));
  ui.refresh(s,{summaries:false});assert.deepEqual(paint,['#urbanRecord','#municipalStatus','#councilRecord']);
  paint.length=0;ui.select('urban','housing');assert.deepEqual(paint,['#urbanRecord','#municipalStatus','#councilRecord']);
  assert.equal(JSON.stringify(s),before);
});
