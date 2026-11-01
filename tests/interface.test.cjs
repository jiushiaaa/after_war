const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-passenger-construction.json'),'utf8')).state;
  const ctx=vm.createContext({State:s,_:x=>x});
  const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
  for(const f of files.filter(f=>!['src/postwar/adapter.js','src/postwar/hearth.js','src/postwar/history.js'].includes(f)))vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
  return {s,ui:ctx.CivilInterface,ctx};
}
const copy=x=>JSON.parse(JSON.stringify(x));
test('summary boards are read-only and keep origin populations distinct from home residents',()=>{
 const {s,ui,ctx}=harness(),before=JSON.stringify(s),home=ui.urbanSummary(s),source=ctx.CivilUrban.sourceId(s);
 assert.equal(home.cards[0][1],s.game.population+' / '+ctx.CivilCatalog.capacity(s));
 const origin=ui.originSummary(s,source);assert.equal(origin.cards[0][1],s.civilization.origins.nodes[source].population);
 ui.councilSummary(s);ui.municipalSummary(s,'river');ui.researchRows(s);assert.equal(JSON.stringify(s),before);
});
test('warnings reflect actual local shortages and migration reservations are not treated as residents',()=>{
 const {s,ui}=harness();s.civilization.urban.economy.food=-4;s.civilization.urban.economy.medicine=-.25;
 const v=ui.urbanSummary(s);assert.ok(v.notices.includes('粮食正在消耗储备'));assert.ok(v.notices.includes('药品正在消耗储备'));assert.equal(v.cards.find(c=>c[0]==='粮食 / 10秒')[1],'-4');
 const m=s.civilization.municipal.nodes.river;m.economy={food:-3,medicine:1,education:false,productivePower:2};m.power={generation:4};
 const local=ui.municipalSummary(s,'river');assert.ok(local.notices.includes('当地粮食净供给不足'));assert.equal(local.cards[0][1].split(' / ')[0],String(s.civilization.regions.nodes.river.population));
});
test('technology route reveals immediate frontiers but not all future branches',()=>{
 const {s,ui}=harness();s.civilization.tech={};s.game.buildings.workshop=1;s.civilization.urban.city=false;
 const initial=copy(ui.researchRows(s));assert.ok(initial.some(r=>r.id==='water'));assert.ok(!initial.some(r=>r.id==='passenger_transport'));
 s.civilization.tech.metal=true;assert.ok(!ui.researchRows(s).some(r=>r.id==='power'),'shared early prerequisite does not expose distant power');s.civilization.tech.water=true;const after=copy(ui.researchRows(s));assert.ok(after.find(r=>r.id==='water').done);assert.ok(after.length<24);
});
test('mastered technology records retain real costs and prerequisites without changing unlock authority',()=>{
 const {s,ui,ctx}=harness();const before=JSON.stringify(s),rows=ui.researchRows(s),r=rows.find(r=>r.id==='passenger_transport');
 assert.ok(r.done);assert.deepEqual(copy(r.cost),copy(ctx.CivilText.research.passenger_transport.cost));assert.equal(r.duration,480);assert.equal(r.requires.length,3);assert.equal(JSON.stringify(s),before);
});
