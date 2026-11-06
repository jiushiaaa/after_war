const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {fresh}=require('./helpers/census-fixture.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function route(id){
  // Constructed presentation fixture, not evidence of natural progress.
  const h=fresh(),s=h.s,c=s.civilization;
  s.game.buildings.workshop=1;c.course={schema:1,id};c.village.town=true;
  for(const k of ['water','metal','records','preservation','sanitation','school','handtools','agronomy','irrigation','standards','power','localgrid'])c.tech[k]=true;
  return h;
}

test('technology atlas respects discovery and never includes hidden names, costs or remote branches',()=>{
  const {s,ctx}=fresh(),t=ctx.CivilTechTree;
  assert.equal(t.build(s).nodes.length,0);s.game.buildings.workshop=1;
  const before=JSON.stringify(s),m=t.build(s),unknown=m.nodes.filter(n=>n.unknown),known=m.nodes.filter(n=>!n.unknown);
  assert.ok(known.some(n=>n.id==='water'));assert.ok(unknown.length>0&&unknown.length<=3);
  for(const n of unknown){assert.equal(n.name,'？');assert.deepEqual(copy(n.cost),{});assert.equal(n.detail,undefined);assert.equal(n.duration,undefined);}
  for(const id of ['power','semiconductor','closed_ecology','automation'])assert.ok(!JSON.stringify(m).includes(ctx.CivilText.research[id].name));
  assert.equal(JSON.stringify(s),before);
});

test('public and industrial atlas prerequisites come from the actual selected route',()=>{
  for(const id of ['commons','industry']){
    const {s,ctx}=route(id),before=JSON.stringify(s),m=ctx.CivilTechTree.build(s),node=m.nodes.find(n=>n.id==='electricalSafety');
    assert.ok(node);assert.deepEqual(copy(node.requires.map(p=>p.id)),id==='commons'?['localgrid']:['power']);
    const source=id==='commons'?'localgrid':'power';assert.ok(m.edges.some(e=>e.from===source&&e.to==='electricalSafety'));
    assert.equal(JSON.stringify(s),before);
  }
});

test('technology atlas distinguishes material shortages, active research and completed records',()=>{
  const {s,ctx}=fresh(),t=ctx.CivilTechTree;s.game.buildings.workshop=1;s.stores={wood:20,scrap:10};
  assert.equal(t.build(s).nodes.find(n=>n.id==='water').state,'ready');
  s.stores.scrap=9;assert.equal(t.build(s).nodes.find(n=>n.id==='water').state,'materials');
  s.stores.scrap=10;ctx.Civilization.research('water');
  assert.equal(s.stores.wood,0);assert.equal(s.stores.scrap,0);assert.equal(t.build(s).nodes.find(n=>n.id==='water').state,'active');
  const before=JSON.stringify(s);t.build(s);ctx.Civilization.research('water');assert.equal(JSON.stringify(s),before,'viewing or repeating research cannot charge twice');
  s.civilization.tech.water=true;s.civilization.research=null;
  assert.equal(t.build(s).nodes.find(n=>n.id==='water').state,'done');
});

test('real survivor discount appears in the atlas without editing research data or paying materials',()=>{
  const {s,ctx}=route('commons'),c=s.civilization;c.village.riverAllied=true;c.tech.logistics=true;c.expedition={sites:{cellar:{state:'joined'}}};
  const before=JSON.stringify(s),content=JSON.stringify(ctx.CivilText.research.survey),n=ctx.CivilTechTree.build(s).nodes.find(n=>n.id==='survey');
  assert.equal(n.cost.knowledge,25);assert.equal(n.cost.tools,12);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(ctx.CivilText.research.survey),content);
});

test('all known technology graphs are acyclic, nonoverlapping and highlight exactly the prerequisite closure',()=>{
  for(const id of ['commons','industry']){
    const {s,ctx}=route(id);for(const k of Object.keys(ctx.CivilText.research))s.civilization.tech[k]=true;
    const before=JSON.stringify(s),t=ctx.CivilTechTree,m=t.build(s),nodes=new Map(m.nodes.map(n=>[n.id,n]));
    for(const e of m.edges){const a=nodes.get(e.from),b=nodes.get(e.to);assert.ok(a.x+a.width<b.x);assert.ok(a.era<=b.era);}
    for(let i=0;i<m.nodes.length;i++)for(let j=i+1;j<m.nodes.length;j++){const a=m.nodes[i],b=m.nodes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
    const expected=new Set(),visit=k=>{if(expected.has(k))return;expected.add(k);ctx.CivilCourse.requires(s,k).forEach(visit);};visit('radio');
    assert.deepEqual([...t.ancestors(m,'radio')].sort(),[...expected].sort());assert.equal(JSON.stringify(s),before);
  }
});

test('reading a real pre-polish export preserves every field and its original research rules',()=>{
  const {ctx}=fresh(),file=path.resolve(__dirname,'../../验证/存档/自然游玩_工业路线恢复后十年稳定278.json');
  const raw=fs.readFileSync(file,'utf8'),envelope=JSON.parse(raw),s=JSON.parse(zlib.gunzipSync(Buffer.from(envelope.data,'base64')).toString()).state,before=JSON.stringify(s);
  const m=ctx.CivilTechTree.build(s);assert.ok(m.nodes.some(n=>n.done));assert.ok(!m.nodes.some(n=>n.id==='semiconductor'));
  assert.equal(s.civilization.modern,undefined);assert.equal(JSON.stringify(s),before);assert.equal(fs.readFileSync(file,'utf8'),raw);
});
