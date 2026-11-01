const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));

// Only the native DOM/button primitives and unrelated presentation are inert.
// Adapter.refresh, Adapter.button, Metro.refresh/check and event routing remain
// the shipped implementations, so omitting the refresh call breaks this test.
function harness(fixture){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',fixture+'.json'),'utf8')).state,elements=new Map();let active=null;
  class Element{
    constructor(length=1){this.length=length;this.attrs={};this.children=[];this.handlers={};this.visible=true;this.value='';}
    attr(key,value){if(typeof key==='object')Object.assign(this.attrs,key);else if(value===undefined)return this.attrs[key];else this.attrs[key]=value;return this;}
    appendTo(parent){parent=typeof parent==='string'?$(parent):parent;this.parent=parent;parent.children.push(this);if(this.attrs.id)elements.set('#'+this.attrs.id,this);return this;}
    text(value){if(value===undefined)return this.value;this.value=value;return this;}
    show(){this.visible=true;return this;}hide(){this.visible=false;return this;}toggle(value){this.visible=!!value;return this;}
    css(){return this;}addClass(){return this;}find(){return new Element(0);}contents(){return this;}filter(){return this;}first(){return this;}replaceWith(){return this;}
  }
  const $=selector=>selector instanceof Element?selector:selector.startsWith('<')?new Element():elements.get(selector)||new Element(0);
  for(const id of ['councilPanel','roomPanel','roadPanel','stores'])elements.set('#'+id,new Element().attr('id',id));
  const Button={Button:function(opts){const element=new Element().attr('id',opts.id).text(opts.text);element.handlers.click=opts.click;return element;},setDisabled(element,value){element.disabled=!!value;}};
  const get=key=>key.split('.').reduce((value,key)=>value?.[key],s);
  const ctx=vm.createContext({State:s,_:x=>x,$,Button,TextEncoder,TextDecoder,setTimeout,clearTimeout,document:{createTextNode:text=>({nodeType:3,textContent:text})},
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){}},Events:{activeEvent:()=>active,startEvent:event=>{active=event;}},AudioEngine:{},Engine:{saveGame(){}},
    Notifications:{notify(){},printMessage(){}},$SM:{get:(key,zero)=>get(key)??(zero?0:undefined),fireUpdate(){}}});
  const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  for(const name of ['CivilVillage','CivilSociety','CivilIndustry','CivilRegions','CivilUrban','CivilOrigins','CivilMunicipal','CivilAdvanced','CivilServices','CivilInterface','CivilHearth','CivilFinance','CivilHistory'])if(ctx[name])ctx[name].refresh=()=>{};
  ctx.Room.updateBuildButtons=()=>{};ctx.Civilization.roadModule={};ctx.Civilization.updateIncome=()=>{};
  ctx.Civilization.initState();ctx.CivilPlatform.validate(s);
  return {s,ctx,elements,get active(){return active;},close(){active.scenes.start.buttons.close.onChoose();active=null;}};
}

test('the real adapter refresh keeps the Metro entry absent in an unmodified early natural save',()=>{
  const h=harness('natural-first-residents'),before=JSON.stringify(h.s);
  h.ctx.Civilization.refresh();h.ctx.Civilization.refresh();
  assert.equal(h.elements.has('#metroButton'),false);assert.equal(h.elements.has('#metroSummary'),false);
  assert.equal(h.active,null);assert.equal(JSON.stringify(h.s),before);
});

test('the real adapter refresh exposes only a review entry for the natural second city and routes its button to metroStatus',()=>{
  const h=harness('natural-second-city'),{s,ctx}=h,before=JSON.stringify(s);
  assert.equal(s.civilization.urban.city,true);assert.equal(s.civilization.municipal.nodes.river.city,true);assert.equal(s.civilization.municipal.nodes.rail.city,false);
  assert.equal(ctx.CivilMetro.canRegister(s),false);assert.equal(s.civilization.metro.formedAt,null);
  ctx.Civilization.refresh();const button=h.elements.get('#metroButton'),summary=h.elements.get('#metroSummary');
  assert.ok(button,'adapter.refresh must invoke the real Metro renderer');assert.equal(button.visible,true);assert.equal(button.value,'核对三城职责');assert.equal(button.parent,h.elements.get('#councilPanel'));
  assert.equal(summary.visible,true);assert.match(summary.value,/连续稳定 0 \/ 600秒/);assert.equal(JSON.stringify(s),before,'rendering never manufactures qualification or changes the old save');
  ctx.Civilization.refresh();assert.equal(h.elements.get('#metroButton'),button);assert.equal(button.parent.children.filter(x=>x.attrs.id==='metroButton').length,1);
  button.handlers.click();assert.equal(s.civilization.pending,'metroStatus');assert.equal(h.active.title,'三城公共记录');assert.deepEqual(Object.keys(h.active.scenes.start.buttons),['close']);
  assert.equal(s.civilization.metro.formedAt,null);const event=h.active;button.handlers.click();assert.equal(h.active,event,'review cannot replace an already open native event');
  h.close();assert.equal(s.civilization.pending,null);assert.equal(h.active,null);assert.equal(JSON.stringify(s),before,'opening and closing review spends nothing and records no city group');
  const copy=ctx.CivilPlatform.decode(JSON.stringify({format:'postwar-civilization',version:1,state:s}));assert.deepEqual(clone(copy),clone(s));
});
