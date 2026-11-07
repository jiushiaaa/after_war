const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {fresh}=require('./helpers/census-fixture.cjs'),{harness}=require('./helpers/metro-fixture.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function saved(id){const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../testing/catalog.json'))),cfg=catalog.scenarios.find(x=>x.id===id),raw=fs.readFileSync(path.join(__dirname,'../..',cfg.source),'utf8'),e=JSON.parse(raw);return (e.encoding?JSON.parse(zlib.gunzipSync(Buffer.from(e.data,'base64'))):e).state;}
function node(h,id){return h.ctx.CivilTechTree.build(h.s).nodes.find(n=>n.id===id);}

test('unified atlas reveals advanced and space capabilities only from their actual ledgers',()=>{
  const {ctx}=fresh();
  for(const id of ['public-city','public-ecology','public-earth','industry-earth']){
    const s=saved(id),before=JSON.stringify(s),m=ctx.CivilTechTree.build(s),visible=m.nodes.filter(n=>!n.unknown);
    for(const family of ctx.CivilTechSources.families(s))for(const [key,cfg]of Object.entries(family.content)){
      const expected=!!family.data&&(!!family.data.tech[key]||family.data.research?.id===key||family.rules.canUse(family.data,cfg));
      assert.equal(visible.some(n=>n.id===family.id+'__'+key),expected,key);
      if(!expected)assert.ok(!JSON.stringify(m).includes(cfg.name),'hidden name: '+cfg.name);
    }
    assert.ok(m.nodes.filter(n=>n.unknown).length<=3);assert.equal(JSON.stringify(s),before);
    const known=new Map(visible.map(n=>[n.id,n]));
    for(const e of m.edges){const a=m.nodes.find(n=>n.id===e.from),b=m.nodes.find(n=>n.id===e.to);assert.ok(a.x+a.width<b.x);assert.ok(a.era<=b.era);if(!b.unknown)assert.equal(a.source,b.source,'do not invent cross-ledger prerequisites');}
    assert.equal(known.has('earth__mapping'),id.endsWith('earth'));
  }
});

test('advanced research uses the community warehouse, facilities and original paid reducer',()=>{
  const h=harness(saved('public-ecology')),S=h.ctx.CivilTechSources,f=h.s.civilization.polity.future,n=node(h,'future__interface');
  const stock=copy(f.stock),home=JSON.stringify(h.s.stores),people=h.ctx.CivilCensus.total(h.s);
  f.stock.parts=0;assert.equal(S.state(h.s,n),'materials');assert.match(S.block(h.s,n),/机械零件/);
  const blocked=JSON.stringify(h.s);assert.equal(S.start(h.s,n),false);assert.equal(JSON.stringify(h.s),blocked);
  f.stock=copy(stock);const lab=f.assets.laboratory;f.assets.laboratory=0;assert.equal(S.state(h.s,n),'blocked');assert.match(S.block(h.s,n),/临床与研究楼/);assert.equal(S.start(h.s,n),false);f.assets.laboratory=lab;
  assert.equal(S.start(h.s,n),true);assert.equal(f.stock.knowledge,stock.knowledge-100);assert.equal(f.stock.parts,stock.parts-24);
  assert.equal(JSON.stringify(h.s.stores),home);assert.equal(h.ctx.CivilCensus.total(h.s),people);
  const paid=JSON.stringify(h.s);assert.equal(S.start(h.s,n),false);assert.equal(JSON.stringify(h.s),paid);
  assert.equal(node(h,'future__interface').state,'active');assert.match(S.block(h.s,node(h,'future__automation')),/班组正在忙碌/);
  const loaded=h.roundtrip();assert.equal(loaded.s.civilization.polity.future.research.remaining,360);
});

test('space and advanced teams may coexist, keep separate progress and charge the correct shared stock',()=>{
  const h=harness(saved('public-earth')),S=h.ctx.CivilTechSources,d=h.s.civilization.polity,home=JSON.stringify(h.s.stores),book=copy(d.future.book.consumed),stock=copy(d.future.stock);
  assert.equal(S.start(h.s,node(h,'earth__mapping')),true);
  assert.equal(S.start(h.s,node(h,'future__interface')),true);
  assert.equal(d.future.stock.knowledge,stock.knowledge-280);assert.equal(d.future.stock.parts,stock.parts-48);assert.equal(d.future.stock.electronics,stock.electronics-16);
  assert.equal(d.future.book.consumed.knowledge,book.knowledge+280);assert.equal(JSON.stringify(h.s.stores),home);
  const m=h.ctx.CivilTechTree.build(h.s);assert.deepEqual(copy(m.nodes.filter(n=>n.active).map(n=>n.id)),['future__interface','earth__mapping']);
  assert.equal(S.research(h.s,node(h,'future__interface')).id,'interface');assert.equal(S.research(h.s,node(h,'earth__mapping')).id,'mapping');
  h.roundtrip();
});

test('actual power interruption stalls space progress and restoring power resumes without repaying capital',()=>{
  const h=harness(saved('industry-earth')),S=h.ctx.CivilTechSources,n=node(h,'earth__mapping');assert.equal(S.start(h.s,n),true);
  assert.equal(h.ctx.CivilEarth.act(h.s,'policy',{key:'power',value:false}),true);h.step(60,{checkEvery:0});
  assert.equal(h.s.civilization.polity.earth.research.remaining,360);assert.match(S.operation(h.s,node(h,'earth__mapping')),/供电不足/);
  assert.equal(h.ctx.CivilEarth.act(h.s,'policy',{key:'power',value:true}),true);h.step(60,{checkEvery:0});
  assert.equal(h.s.civilization.polity.earth.research.remaining,300);
  h.step(300,{checkEvery:0});assert.equal(node(h,'earth__mapping').state,'done');assert.ok(node(h,'earth__fabrication'));assert.ok(node(h,'earth__navigation'));assert.equal(node(h,'earth__closed'),undefined);
  h.roundtrip();
});

test('all late technologies coexist without key collisions, missing prerequisites or overlapping nodes',()=>{
  const {ctx}=fresh(),s=saved('industry-earth');
  // Synthetic completed graph for presentation topology, not natural progression.
  for(const f of ctx.CivilTechSources.families(s))for(const k of Object.keys(f.content))f.data.tech[k]=1;
  const before=JSON.stringify(s),m=ctx.CivilTechTree.build(s),known=m.nodes.filter(n=>!n.unknown);
  assert.equal(known.filter(n=>n.source==='future').length,13);assert.equal(known.filter(n=>n.source==='earth').length,5);
  assert.equal(new Set(m.nodes.map(n=>n.id)).size,m.nodes.length);
  for(const n of known)for(const r of n.requires)assert.ok(known.some(p=>p.id===r.id));
  for(let i=0;i<m.nodes.length;i++)for(let j=i+1;j<m.nodes.length;j++){const a=m.nodes[i],b=m.nodes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
  const pathSet=[...ctx.CivilTechTree.ancestors(m,'earth__guidance')].sort();assert.deepEqual(pathSet,['earth__fabrication','earth__guidance','earth__mapping','earth__navigation']);
  assert.equal(JSON.stringify(s),before);
});
