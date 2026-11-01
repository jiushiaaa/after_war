const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-regional-growth.json'),'utf8')).state;
  const ctx=vm.createContext({State:s,_:x=>x});
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/population.js','src/postwar/society.js','src/postwar/rules.js','src/postwar/village.js','src/postwar/industry.js','src/postwar/regions.js','src/postwar/urban.js','src/postwar/municipal.js','src/postwar/advanced.js','src/postwar/services.js','src/postwar/region-map.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  return {s,ctx,map:ctx.CivilRegionMap};
}
const copy=x=>JSON.parse(JSON.stringify(x));
function dom(h){
  const elements=new Map(),triggered=[];
  function element(id,exists=true){
    const e={id,length:exists?1:0,attrs:{},visible:true,open:true,left:0,renders:0,htmlText:'',handlers:{},
      attr(key,value){if(typeof key==='object'){Object.assign(this.attrs,key);if(key.id){this.id=key.id;elements.set('#'+key.id,this);}return this;}if(value===undefined)return this.attrs[key];this.attrs[key]=value;return this;},
      addClass(){return this;},insertBefore(target){this.before=target;return this;},on(name,selector,fn){this.handlers[name]={selector,fn};return this;},
      show(){this.visible=true;return this;},hide(){this.visible=false;return this;},
      html(value){this.htmlText=value;this.renders++;const details=element('regionMapDetails');details.open=value.includes('id="regionMapDetails" open');elements.set('#regionMapDetails',details);return this;},
      find(selector){const key=this.id+' '+selector;if(!elements.has(key))elements.set(key,element(key));return elements.get(key);},
      prop(key){return this[key];},scrollLeft(value){if(value===undefined)return this.left;this.left=value;return this;},
      trigger(name){triggered.push([this.id,name]);return this;}
    };return e;
  }
  elements.set('#regionsPanel',element('regionsPanel'));elements.set('#regionNodes',element('regionNodes'));
  for(const id of ['river','rail','highland'])elements.set('#regionNode_'+id,element('regionNode_'+id));
  h.ctx.$=selector=>{if(typeof selector!=='string')return selector;if(selector.startsWith('<'))return element('new');return elements.get(selector)||element(selector,false);};
  return {elements,triggered};
}

test('regional snapshot preserves real inventories, ages, projects and routes without running simulation',()=>{
  const h=harness(),before=JSON.stringify(h.s);const view=h.map.snapshot(h.s);
  assert.ok(view.nodes.length>1);assert.equal(view.nodes[0].id,'home');assert.equal(view.nodes[0].population,h.s.game.population);
  for(const n of view.nodes.slice(1))assert.equal(n.population,h.s.civilization.regions.nodes[n.id].population);
  assert.equal(JSON.stringify(h.s),before);h.map.snapshot(h.s);assert.equal(JSON.stringify(h.s),before);
  view.nodes[0].stores.food=0;assert.notEqual(h.s.stores.food,0,'view never exposes mutable inventory references');
});
test('only discovered settlement nodes and their recorded routes appear; origins and unknown neighbors never leak',()=>{
  const {s,map}=harness(),r=s.civilization.regions;
  r.nodes.rail.discovered=false;delete r.nodes.highland;s.civilization.origins={nodes:{secret:{name:'秘密来源',population:9999}}};
  const view=map.snapshot(s);assert.deepEqual(copy(view.nodes.map(n=>n.id)),['home','river']);assert.deepEqual(copy(view.routes.map(n=>n.id)),['river']);
  const html=map.markup(view);assert.ok(!html.includes('铁轨镇'));assert.ok(!html.includes('高地'));assert.ok(!html.includes('9999'));
  delete r.routes.river;const noRoute=map.snapshot(s);assert.equal(noRoute.routes.length,0);assert.ok(map.markup(noRoute).includes('尚未记录运输路线'));
  r.nodes={};assert.equal(map.snapshot(s),null);
});
test('held freight and paid construction show actual direction, goods, missing deliveries and local shortages',()=>{
  const {s,map}=harness(),c=s.civilization,r=c.regions;r.routes.river.condition='closed';
  r.shipments=[{id:101,route:'river',source:'home',target:'river',status:'held',phase:'outbound',purpose:'services',remaining:32,cargo:{steel:30,glass:10}}];
  c.services={nodes:{river:{buildings:{},project:{type:'waterworks',status:'supplying',required:{steel:40,glass:12},buffer:{steel:10},remaining:0}}}};
  r.nodes.river.stores.food=0;r.nodes.river.health=49;
  const view=map.snapshot(s),route=view.routes.find(x=>x.id==='river'),n=view.nodes.find(x=>x.id==='river');
  assert.equal(route.state,'道路受阻');assert.equal(route.shipments[0].remaining,32);assert.equal(route.shipments[0].cargo.steel,30);
  assert.ok(n.issues.includes('健康需要恢复'));assert.ok(n.issues.includes('现有居民口粮储备不足120秒'));
  assert.deepEqual(copy(n.projects.at(-1).missing),[{resource:'steel',amount:30},{resource:'glass',amount:12}]);
  const html=map.markup(view,'river');assert.ok(html.includes('货车受阻'));assert.ok(html.includes('材料待交付'));assert.ok(html.includes('钢材 30'));assert.ok(html.includes('剩余 32 秒'));
});
test('graph uses stored route timing, distinguishes missing crew and does not claim a settlement has current production from stale history',()=>{
  const {s,map}=harness(),c=s.civilization,r=c.regions;s.game.workers.transporter=0;r.routes.river.enabled=true;r.routes.river.condition='open';s.game.buildings.road=1;c.outpostSupplied=true;
  c.urban.economy={at:c.elapsed-11,food:999,medicine:999,treatment:true,education:true};
  const view=map.snapshot(s);assert.equal(view.routes.find(x=>x.id==='river').state,'运输工不足');assert.equal(view.routes.find(x=>x.id==='river').travel,r.routes.river.travel);assert.equal(view.nodes[0].economy,null);
  assert.ok(!map.markup(view).includes('粮 999'));
});
test('rendered settlement and route text is escaped while actual native controls remain addressable',()=>{
  const {s,ctx,map}=harness();ctx.CivilRegionContent.river.name='<script>alert("x")</script>';s.civilization.regions.routes.river.status='<img onerror=x>';
  const html=map.markup(map.snapshot(s),'river');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('id="regionMapNode_river"'));assert.ok(html.includes('data-region="river"'));
});
test('native refresh mounts once, preserves collapsed details and scroll, and routes clicks through the existing regional button',()=>{
  const h=harness(),d=dom(h),before=JSON.stringify(h.s);h.map.refresh(h.s);
  const panel=d.elements.get('#regionMap');assert.ok(panel);assert.equal(panel.before,'#regionNodes');assert.equal(panel.renders,1);assert.ok(d.elements.get('#regionNode_river'));
  h.map.refresh(h.s);assert.equal(panel.renders,1,'unchanged tick does not replace controls');
  d.elements.get('#regionMapDetails').open=false;panel.find('.region-map-scroll').scrollLeft(55);h.s.civilization.regions.routes.river.status='等待备货';h.map.refresh(h.s);
  assert.equal(d.elements.get('#regionMapDetails').open,false);assert.equal(panel.find('.region-map-scroll').scrollLeft(),55);
  assert.equal(h.map.select(h.s,'river'),true);assert.deepEqual(d.triggered,[['regionNode_river','click']]);assert.equal(h.map.selected,'river');assert.equal(h.map.select(h.s,'secret'),false);assert.equal(d.triggered.length,1);
  const expected=JSON.parse(before);expected.civilization.regions.routes.river.status='等待备货';assert.deepEqual(h.s,expected,'UI adds no saved fields and makes no economic changes');
  h.map.reset();assert.equal(h.map.selected,'home');assert.equal(h.map.signature,null);
});

test('home reserve warning follows the actual ration policy and cistern consumption without inventing traveler residents',()=>{
 const {s,ctx,map}=harness();s.game.buildings.cistern=1;
 for(const policy of ['ration','equal','generous']){s.civilization.policy=policy;const reserve=ctx.CivilUrban.foodReserve(s);s.stores.food=reserve+1;assert.ok(!map.snapshot(s).nodes[0].issues.includes('现有居民口粮储备不足120秒'));s.stores.food=reserve-1;assert.ok(map.snapshot(s).nodes[0].issues.includes('现有居民口粮储备不足120秒'));}
});
