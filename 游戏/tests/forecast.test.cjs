const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {harness,clone}=require('./helpers/metro-fixture.cjs');
const dir=path.join(__dirname,'../../验证/存档');
const raw=n=>{const p=JSON.parse(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>f.startsWith('自然游玩_Windows')&&f.endsWith(n+'.json'))),'utf8'));return p.state||JSON.parse(zlib.gunzipSync(Buffer.from(p.data,'base64'))).state;};
const tails={nation:2,diplomacy:2,accession:2,security:31};
function samePrediction(actual,expected){
  const a=clone(actual),b=clone(expected);
  for(const key of Object.keys(tails))if(a.copy.civilization[key]){
    const rows=a.copy.civilization[key].records;
    b.copy.civilization[key].records=b.copy.civilization[key].records.slice(-rows.length);
  }
  if(a.copy.civilization.finance)for(const [i,p]of a.copy.civilization.finance.periods.entries())b.copy.civilization.finance.periods[i].adminPayments=b.copy.civilization.finance.periods[i].adminPayments.slice(-p.adminPayments.length);
  if(a.copy.civilization.corridor)b.copy.civilization.corridor.maintenance=b.copy.civilization.corridor.maintenance.slice(-a.copy.civilization.corridor.maintenance.length);
  assert.deepEqual(a,b,'only explicitly bounded historical receipt prefixes may differ');
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
  const finance=clone(s.civilization.finance);for(const p of finance.periods)if(p.endsAt<s.civilization.elapsed-1200)p.adminPayments=p.adminPayments.slice(-2);
  assert.deepEqual(clone(copy.civilization.finance),finance,'all orders, periods and totals remain; only obsolete preview administration rows are bounded');
  const paid=copy.civilization.finance.periods.find(p=>p.adminPayments.length);if(paid)paid.adminPayments[0].at=-1;
  assert.equal(JSON.stringify(s),before);ctx.CivilPlatform.validate(s);
  assert.deepEqual(clone(ctx.CivilPlatform.decode(ctx.CivilPlatform.serialize())),clone(s));
});

for(const shortage of [false,true])test('long-save passenger payment previews stay bounded and preserve '+(shortage?'rejected families':'real family quotes'),()=>{
  const h=harness(raw(77)),{s,ctx}=h;
  // Separate synthetic teaching shortage; never written into the natural file.
  if(shortage)s.civilization.municipal.nodes.ford.buildings.school=0;
  const before=JSON.stringify(s),service=ctx.CivilUrban.serviceCheck,copy=ctx.CivilForecast.copy,seen=[];
  ctx.CivilUrban.serviceCheck=function(paid,...args){seen.push(paid.civilization.nation.records.length);return service.call(this,paid,...args);};
  const actual=ctx.CivilPassenger.quote(s,{source:'old_city_fringe',target:'ford'});
  ctx.CivilUrban.serviceCheck=service;ctx.CivilForecast.copy=clone;
  let expected;try{expected=ctx.CivilPassenger.quote(s,{source:'old_city_fringe',target:'ford'});}finally{ctx.CivilForecast.copy=copy;}
  assert.deepEqual(clone(actual),clone(expected));assert.equal(JSON.stringify(s),before,'quoting must preserve all live costs, cohorts, transport and history');
  if(shortage){assert.match(actual.reason,/教师|教学|学舍/);assert.ok(seen.length>1,'failed destinations must exercise smaller family retries');}
  else {assert.equal(actual.sourceQuote.count,8);assert.equal(actual.cost.food,48);assert.equal(actual.transport.crew,2);}
  assert.ok(seen.length>0);assert.ok(seen.every(n=>n<=2),'each paid candidate must exclude archived national receipts');
});
