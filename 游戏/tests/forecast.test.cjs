const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
const dir=path.join(__dirname,'../../验证/存档');
const raw=n=>JSON.parse(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.startsWith('自然游玩_Windows')&&f.endsWith(n+'.json'))),'utf8')).state;
const tails={nation:2,diplomacy:2,accession:2,security:31};
function samePrediction(actual,expected){
  const a=clone(actual),b=clone(expected);
  for(const key of Object.keys(tails))if(a.copy.civilization[key]){
    const rows=a.copy.civilization[key].records;
    b.copy.civilization[key].records=b.copy.civilization[key].records.slice(-rows.length);
  }
  assert.deepEqual(a,b,'only the unused prefix of four temporary receipt arrays may differ');
}
function compare(h,run){
  const {ctx,s}=h,before=JSON.stringify(s),optimized=ctx.CivilForecast.copy;
  const actual=run();ctx.CivilForecast.copy=clone;
  let expected;try{expected=run();}finally{ctx.CivilForecast.copy=optimized;}
  samePrediction(actual,expected);assert.equal(JSON.stringify(s),before,'forecast must leave every real historical byte and resource unchanged');
}
for(const n of [48,51,53])test('full and bounded previews agree during natural checkpoint '+n,()=>{
  const h=harness(raw(n)),{ctx,s}=h;
  compare(h,()=>ctx.CivilUrban.forecast(s));
  for(const id of ['rail','river'])compare(h,()=>ctx.CivilMunicipal.forecast(s,id));
  compare(h,()=>{const copy=ctx.CivilForecast.copy(s);copy.civilization.elapsed=ctx.CivilServices.nextSettlementAt(copy,'home');return {copy,result:ctx.Civilization.settleEconomy(copy)};});
  ctx.CivilPlatform.validate(s);
});

test('shortages, prospective children, and both constitutional cost systems keep identical previews',()=>{
  const h=harness(raw(53)),{ctx,s}=h,extra=[{age:9,count:2,identity:'human'}];
  // Declared synthetic boundary inputs, never exported as natural progress.
  for(const mode of ['central','local'])for(const charter of ['constitution','custom']){
    s.civilization.society.axes.devolution=mode;s.civilization.society.axes.charter=charter;
    s.stores.tools=0;s.stores.coal=0;s.civilization.regions.nodes.rail.stores.medicine=0;
    compare(h,()=>ctx.CivilUrban.forecast(s,extra));compare(h,()=>ctx.CivilMunicipal.forecast(s,'rail',extra));
    compare(h,()=>{const copy=ctx.CivilForecast.copy(s);copy.civilization.elapsed=ctx.CivilServices.nextSettlementAt(copy,'home');return {copy,result:ctx.Civilization.settleEconomy(copy)};});
  }
});

test('preview receipts are deeply detached and neither copying nor saving prunes actual history',()=>{
  const h=harness(raw(53)),{ctx,s}=h,before=JSON.stringify(s),copy=ctx.CivilForecast.copy(s);
  for(const [key,count]of Object.entries(tails)){
    assert.equal(copy.civilization[key].records.length,count);assert.ok(s.civilization[key].records.length>count);
    copy.civilization[key].records[0].at=-1;
  }
  assert.deepEqual(clone(copy.civilization.finance),clone(s.civilization.finance),'all old finance orders and periods remain available');
  assert.equal(JSON.stringify(s),before);ctx.CivilPlatform.validate(s);
  assert.deepEqual(clone(ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize())),clone(s));
});
