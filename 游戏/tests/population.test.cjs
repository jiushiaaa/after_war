const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function helper(){
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/postwar/population.js'),'utf8'),ctx);
  return ctx.CivilPopulation;
}
const plain=value=>JSON.parse(JSON.stringify(value));
const birthState=(extra={})=>({scaled:true,credit:0,mutantCredit:0,...extra});
const options=(extra={})=>({yearStartPopulation:80,beds:544,health:100,hunger:0,food:1000,medicine:1000,...extra});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} ≈ ${expected}`);

test('population arithmetic distinguishes dependent children, workers and retirees without a game state',()=>{
  const p=helper(),cohorts=[{age:0,count:2},{age:17,count:3},{age:18,count:4},{age:49,count:5},{age:64,count:6},{age:65,count:7},{age:79,count:8}],before=JSON.stringify(cohorts);
  assert.equal(p.count(cohorts),35);assert.equal(p.workforce(cohorts),15);assert.equal(p.children(cohorts),5);close(p.foodPopulation(cohorts),30+10/3);
  assert.equal(JSON.stringify(cohorts),before);
  for(const fn of ['count','workforce','children','foodPopulation'])assert.equal(p[fn]([]),0);
});

test('one age step returns new surviving groups, preserves metadata and accounts for every death',()=>{
  const p=helper(),cohorts=Object.freeze([{age:17,count:4,identity:'mutant',origin:'ridge'},{age:64,count:5,identity:'human'},{age:79,count:6},{age:3,count:2}].map(Object.freeze));
  const result=p.age(cohorts);
  assert.equal(result.deceased,6);assert.deepEqual(plain(result.cohorts),[{age:18,count:4,identity:'mutant',origin:'ridge'},{age:65,count:5,identity:'human'},{age:4,count:2}]);
  assert.equal(p.count(result.cohorts)+result.deceased,p.count(cohorts));assert.equal(p.workforce(result.cohorts),4);
  assert.equal(cohorts[0].age,17);assert.notEqual(result.cohorts[0],cohorts[0]);assert.deepEqual(plain(p.age([])),{cohorts:[],deceased:0});
});

test('the early village plan returns one zero-age newborn and its fee without paying or changing its parents',()=>{
  const p=helper(),cohorts=Object.freeze([Object.freeze({age:25,count:6})]),b=birthState({scaled:false,credit:.8,mutantCredit:.7}),o=Object.freeze(options({yearStartPopulation:6,beds:1,health:60,food:6,medicine:.2}));
  const result=p.births(cohorts,b,o);
  assert.deepEqual(plain(result),{cohorts:[{age:0,count:1,identity:'human'}],count:1,cost:{food:6,medicine:.2}});
  assert.equal(p.count(cohorts),6);assert.equal(p.workforce(result.cohorts),0);assert.equal(o.food,6);assert.equal(o.medicine,.2);
  assert.deepEqual(b,{scaled:false,credit:0,mutantCredit:0});
});

test('all existing birth guards return a zero fee and discard missed births',()=>{
  const p=helper(),parents=[{age:25,count:80,identity:'human'}];
  const cases=[{beds:0},{beds:-1},{beds:.9},{health:59.99},{hunger:1},{food:6-2e-8},{medicine:.2-2e-8},{food:undefined},{medicine:undefined}];
  for(const input of cases){const b=birthState({credit:.9}),o=options(input),before=JSON.stringify(o);assert.deepEqual(plain(p.births(parents,b,o)),{cohorts:[],count:0,cost:{food:0,medicine:0}});assert.equal(b.credit,0);assert.equal(JSON.stringify(o),before);}
  for(const cohorts of [[],[{age:17,count:80}],[{age:50,count:80}],[{age:25,count:1},{age:50,count:10}],[{age:25,count:5}],[{age:25,count:2},{age:60,count:3},{age:65,count:10}]]){
    const b=birthState({credit:.9});assert.equal(p.births(cohorts,b,options()).count,0);assert.equal(b.credit,0);
  }
});

test('the reproductive boundary includes forty-nine and excludes fifty, and ageing precedes the decision',()=>{
  const p=helper(),b=birthState({scaled:false});
  assert.equal(p.births([{age:49,count:6}],b,options()).count,1);
  assert.equal(p.births(p.age([{age:49,count:6}]).cohorts,b,options()).count,0);
  const adults=p.age([{age:17,count:6}]).cohorts;
  assert.equal(p.workforce(adults),6);assert.equal(p.births(adults,b,options()).count,1);
});

test('the scaled plan preserves fractional fertility and the existing resource-payment epsilon',()=>{
  const p=helper(),cohorts=p.age(Array.from({length:80},(_,age)=>({age,count:1}))).cohorts,b=birthState();
  const result=p.births(cohorts,b,options({food:12-1e-9,medicine:.4-1e-9}));
  assert.equal(result.count,2);assert.deepEqual(plain(result.cost),{food:12,medicine:.4});close(b.credit,.56);assert.equal(p.count(cohorts),79);
  const small=birthState();const first=p.births([{age:25,count:6}],small,options());
  assert.deepEqual(plain(first),{cohorts:[],count:0,cost:{food:0,medicine:0}});close(small.credit,.48);
});

test('annual caps, partial supplies and beds limit real newborns without banking unpaid whole people',()=>{
  const p=helper(),cohorts=[{age:25,count:80}],b=birthState({credit:.9});
  const result=p.births(cohorts,b,options());assert.equal(result.count,4);assert.deepEqual(plain(result.cost),{food:24,medicine:.8});close(b.credit,.3);
  for(const restriction of [{beds:2},{food:12},{medicine:.4}]){
    const credit=birthState({credit:.9}),limited=p.births(cohorts,credit,options(restriction));
    assert.equal(limited.count,2);assert.equal(credit.credit,0);assert.equal(p.count(limited.cohorts),2);assert.deepEqual(plain(limited.cost),{food:12,medicine:.4});
  }
  assert.equal(p.count(cohorts),80);
});

test('identity rounding follows actual reproductive cohorts and survives serialization',()=>{
  const p=helper(),parents=[{age:25,count:5,identity:'human'},{age:25,count:5,identity:'mutant'},{age:70,count:30,identity:'mutant'}],b=birthState({scaled:false});
  const first=p.births(parents,b,options());assert.equal(first.cohorts[0].identity,'human');close(b.mutantCredit,.5);
  const saved=plain(b),second=p.births(parents,saved,options());assert.equal(second.cohorts[0].identity,'mutant');assert.equal(saved.mutantCredit,0);
  const changed=p.births([{age:25,count:10},{age:65,count:20,identity:'mutant'}],b,options());assert.equal(changed.cohorts[0].identity,'human');assert.equal(b.mutantCredit,0);
  const mutant=p.births([{age:25,count:6,identity:'mutant'},{age:65,count:40,identity:'human'}],birthState({scaled:false}),options());assert.equal(mutant.cohorts[0].identity,'mutant');
});

test('the helper does not unlock proportional births or share fractional state between independent populations',()=>{
  const p=helper(),parents=[{age:25,count:100}],home=birthState({scaled:false}),source=birthState({credit:.25});
  assert.equal(p.births(parents,home,options({yearStartPopulation:100})).count,1);assert.equal(home.scaled,false);
  const before=JSON.stringify(home),result=p.births(parents,source,options({yearStartPopulation:100}));
  assert.equal(result.count,4);assert.equal(source.credit,.25);assert.equal(JSON.stringify(home),before);
  const next=plain(source);assert.deepEqual(plain(p.births(parents,source,options())),plain(p.births(parents,next,options())));assert.deepEqual(source,next);
});
