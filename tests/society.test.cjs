const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-river-town.json'))).state;const ctx=vm.createContext({_:x=>x});for(const f of ['content/zh.js','content/development.js','src/postwar/population.js','src/postwar/society.js','src/postwar/rules.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);ctx.CivilSociety.init(s);return {s,r:ctx.CivilSociety,rules:ctx.CivilRules,ctx};}
test('old population migrates as working adults, once, without retroactive birthdays',()=>{const {s,r}=setup(),x=s.civilization.society;assert.equal(r.workforce(s),20);assert.equal(x.leader.age,28+Math.floor(s.civilization.elapsed/600));const before=JSON.stringify(x);r.init(s);assert.equal(JSON.stringify(x),before);r.validate(s);});
test('children and retirees still eat, cannot work, and retirement trims overassigned jobs',()=>{const {s,r}=setup(),x=s.civilization.society;x.cohorts=[{age:17,count:4},{age:64,count:16}];r.annual(s,()=>1);assert.equal(r.workforce(s),4);assert.ok(Object.values(s.game.workers).reduce((a,b)=>a+b,0)<=4);assert.equal(r.foodPopulation(s),20);s.civilization.elapsed=x.year*600;r.validate(s);});
test('leader death and one-shot succession preserve collective assets and ongoing tasks',()=>{const {s,r}=setup(),x=s.civilization.society;x.leader.age=84;s.civilization.research={id:'water',remaining:35};s.civilization.journey={id:'station',remaining:12};const assets=JSON.stringify([s.stores,s.game.buildings,s.civilization.tech,s.civilization.village]);r.annual(s,()=>1);assert.equal(x.leader.alive,false);assert.equal(x.succession,'death');assert.equal(r.succeed(s,'scholar'),true);assert.equal(r.succeed(s,'scholar'),false);assert.equal(x.history.length,1);assert.equal(JSON.stringify([s.stores,s.game.buildings,s.civilization.tech,s.civilization.village]),assets);assert.equal(s.civilization.research.remaining,35);assert.equal(s.civilization.journey.remaining,12);});
test('zero supplies and an empty population do not prevent a successor',()=>{const {s,r}=setup(),x=s.civilization.society;s.game.population=0;s.game.workers={};s.stores={};r.sync(s);x.succession='death';assert.equal(r.succeed(s,'engineer'),true);assert.equal(x.leader.alive,true);});
test('annual election fires at six years, age does not advance twice after reload',()=>{const {s,r}=setup(),x=s.civilization.society;x.axes.selection='election';x.governed=true;x.leader.started=x.year;x.leader.termStarted=x.year;for(let i=0;i<5;i++)r.annual(s,()=>1);assert.equal(x.succession,null);r.annual(s,()=>1);assert.equal(x.succession,'election');s.civilization.elapsed=x.year*600;const age=x.leader.age;r.init(s);r.tick(s);assert.equal(x.leader.age,age);});
test('constitutional combinations have recurring real costs and fail without negative stock',()=>{const {s,r}=setup(),x=s.civilization.society;for(const [a,v]of Object.entries({structure:'federation',selection:'hereditary',charter:'constitution',devolution:'local'}))r.chooseAxis(s,a,v);assert.equal(x.governed,true);const before=s.stores.knowledge;r.settle(s);assert.ok(s.stores.knowledge<before);s.stores={food:0,knowledge:0};r.settle(s);assert.equal(x.service,false);assert.ok(r.outputFactor(s)<1);assert.equal(s.stores.food,0);});
test('minor heir remains the same person through regency and can later inherit',()=>{const {s,r}=setup(),x=s.civilization.society;x.axes.selection='hereditary';x.heir={age:16,trained:true};x.succession='death';r.succeed(s,'regent');assert.equal(x.heir.age,16);r.annual(s,()=>1);r.annual(s,()=>1);assert.equal(x.succession,'regency');r.succeed(s,'heir');assert.equal(x.leader.age,18);assert.equal(x.leader.title,'继承人');});
test('births require spare housing and supplies; adulthood requires eighteen annual transitions',()=>{const {s,r}=setup(),x=s.civilization.society;s.game.buildings.longhouse=2;const before=s.game.population;r.annual(s,()=>1);assert.equal(s.game.population,before+1);assert.equal(x.cohorts.at(-1).age,0);assert.equal(r.workforce(s),before);assert.ok(r.foodPopulation(s)>before);s.stores.food=0;for(let i=0;i<17;i++)r.annual(s,()=>1);assert.equal(x.cohorts.at(-1).age,17);r.annual(s,()=>1);assert.equal(x.cohorts.at(-1).age,18);});
test('late legacy previews get a recorded age grace period without replaying past deaths',()=>{const {s,r}=setup();delete s.civilization.society;s.civilization.elapsed=600*100;r.init(s);const x=s.civilization.society;assert.equal(x.year,100);assert.equal(x.leader.age,64);assert.equal(x.legacyAgeGrace,true);assert.equal(x.succession,null);r.annual(s,()=>1);assert.equal(x.leader.age,65);assert.equal(x.leader.alive,true);});
test('regency is an institution rather than an ageing person, and reform does not restore the dynasty',()=>{const {s,r}=setup(),x=s.civilization.society;for(const [a,v]of Object.entries({structure:'city',selection:'hereditary',charter:'constitution',devolution:'local'}))r.chooseAxis(s,a,v);x.heir={age:14,trained:false};x.succession='death';r.succeed(s,'regent');x.leader.age=84;r.annual(s,()=>0);assert.equal(x.leader.alive,true);assert.equal(x.leader.age,84);assert.equal(x.succession,null);x.reformCooldown=0;s.civilization.pending=null;s.stores.knowledge=100;assert.equal(r.beginReform(s,'selection'),true);r.chooseAxis(s,'selection','election');assert.equal(x.succession,'retirement');r.succeed(s,'engineer');for(let i=0;i<3;i++)r.annual(s,()=>1);assert.equal(x.succession,null);assert.equal(x.leader.title,'工程代表');});
test('reform reservation is atomic, non-repeatable, refundable once, and has a genuine transition cost',()=>{const {s,r}=setup(),x=s.civilization.society;for(const [a,v]of Object.entries({structure:'city',selection:'election',charter:'constitution',devolution:'local'}))r.chooseAxis(s,a,v);x.reformCooldown=0;s.civilization.pending=null;s.stores.knowledge=100;assert.equal(r.beginReform(s,'structure'),true);assert.equal(s.stores.knowledge,40);assert.equal(r.beginReform(s,'structure'),false);assert.equal(r.cancelReform(s),true);assert.equal(s.stores.knowledge,100);assert.equal(r.cancelReform(s),false);s.civilization.pending=null;assert.equal(r.beginReform(s,'charter'),true);r.chooseAxis(s,'charter','custom');assert.equal(x.transition,180);assert.equal(x.reformCooldown,600);s.civilization.pending=null;assert.equal(r.beginReform(s,'structure'),false);x.reformCooldown=0;assert.equal(r.beginReform(s,'structure'),true);assert.equal(x.reformPaid,30);assert.equal(s.stores.knowledge,10);});
test('the two elected platforms have different functioning benefits',()=>{const {s,r}=setup(),x=s.civilization.society;for(const [a,v]of Object.entries({structure:'city',selection:'election',charter:'constitution',devolution:'local'}))r.chooseAxis(s,a,v);x.succession='election';r.succeed(s,'engineer');x.transition=0;assert.equal(r.outputFactor(s),1.05);assert.equal(r.researchSpeed(s),1);x.succession='election';r.succeed(s,'scholar');x.transition=0;assert.equal(r.outputFactor(s),1);assert.equal(r.researchSpeed(s),1.15);});
test('annual boundary survives save and reload with exactly one birthday',()=>{const {s,r}=setup(),x=s.civilization.society;s.civilization.elapsed=x.year*600+599;const before=x.leader.age;r.tick(s);assert.equal(x.leader.age,before);s.civilization.elapsed++;r.tick(s);assert.equal(x.leader.age,before+1);const reloaded=JSON.parse(JSON.stringify(s));r.init(reloaded);r.tick(reloaded);assert.equal(reloaded.civilization.society.leader.age,before+1);assert.equal(reloaded.civilization.society.year,x.year);});

test('unfinished constitution cannot trigger an election from the founders old tenure',()=>{const {s,r}=setup(),x=s.civilization.society;r.chooseAxis(s,'structure','federation');r.chooseAxis(s,'selection','election');r.annual(s,()=>1);assert.equal(x.succession,null);r.chooseAxis(s,'charter','constitution');r.chooseAxis(s,'devolution','local');assert.equal(x.leader.started,0);assert.equal(x.leader.termStarted,x.year);});
test('founder history includes survival years while elections start when the constitution is completed',()=>{const {s,r}=setup(),x=s.civilization.society;for(const [a,v]of Object.entries({structure:'city',selection:'election',charter:'constitution',devolution:'local'}))r.chooseAxis(s,a,v);const founded=x.year;assert.equal(x.leader.started,0);assert.equal(x.leader.termStarted,founded);for(let i=0;i<5;i++)r.annual(s,()=>1);assert.equal(x.succession,null);r.annual(s,()=>1);assert.equal(x.succession,'election');r.succeed(s,'engineer');assert.equal(x.history[0].from,0);assert.equal(x.history[0].to,founded+6);assert.equal(x.leader.started,x.year);assert.equal(x.leader.termStarted,x.year);});
test('unaltered second-leader preview migrates the founder history from year eleven back to year zero once',()=>{const {r}=setup();const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-second-leader-mining.json'))).state;assert.equal(s.civilization.society.history[0].from,11);r.validate(s);const before=JSON.stringify([s.stores,s.game,s.civilization.tech]);r.init(s);const x=s.civilization.society;assert.equal(x.history[0].from,0);assert.equal(x.history[0].to,12);assert.equal(x.leader.started,12);assert.equal(x.leader.termStarted,12);assert.equal(JSON.stringify([s.stores,s.game,s.civilization.tech]),before);r.validate(s);const migrated=JSON.stringify(x);r.init(s);assert.equal(JSON.stringify(x),migrated);});
test('broken lineage, frozen years and missing succession are rejected before import',()=>{for(const mutate of [x=>{x.generation=2;x.history=[null];},x=>{x.year+=100;},x=>{x.leader.alive=false;},x=>{x.leader.termStarted=x.year+1;}]){const {s,r}=setup();mutate(s.civilization.society);assert.throws(()=>r.validate(s));}});
test('a reserved reform must have the matching recoverable pending event',()=>{const {s,r}=setup(),x=s.civilization.society;for(const [a,v]of Object.entries({structure:'city',selection:'election',charter:'constitution',devolution:'local'}))r.chooseAxis(s,a,v);x.reformCooldown=0;s.civilization.pending=null;s.stores.knowledge=100;r.beginReform(s,'structure');assert.doesNotThrow(()=>r.validate(s));const encoded=JSON.stringify(s),restored=JSON.parse(encoded);r.validate(restored);r.init(restored);assert.equal(restored.civilization.society.reformPaid,60);s.civilization.pending=null;assert.throws(()=>r.validate(s));s.civilization.pending='constitution_structure';x.reformPaid=0;assert.throws(()=>r.validate(s));});

function familySetup(cohorts){
  const h=setup(),{s,r,ctx}=h;
  for(const f of ['content/industry.js','content/regions.js','content/urban.js','src/postwar/urban.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
  s.civilization.society.cohorts=cohorts.map(c=>({...c}));s.game.population=r.total(s.civilization.society);s.game.workers={};
  Object.assign(s.game.buildings,{hut:4,longhouse:4,residential:8,blockhousing:4});
  s.stores.food=100000;s.stores.medicine=100000;s.civilization.hunger=0;s.civilization.village.health=100;
  ctx.CivilUrban.init(s);r.init(s);return h;
}
function familyYear(h){h.s.civilization.elapsed=(h.s.civilization.society.year+1)*600;h.r.tick(h.s);}
const newborns=s=>s.civilization.society.cohorts.filter(c=>c.age===0).reduce((n,c)=>n+c.count,0);
test('legacy birth records initialize once without retroactive people; malformed new records are rejected',()=>{
  const {s,r}=setup(),x=s.civilization.society;delete x.births;const before=JSON.stringify([s.game,s.stores,x.cohorts,x.year]);
  assert.doesNotThrow(()=>r.validate(s));r.init(s);assert.equal(JSON.stringify([s.game,s.stores,x.cohorts,x.year]),before);assert.equal(x.births.credit,0);assert.equal(x.births.mutantCredit,0);assert.equal(x.births.scaled,false);
  const initialized=JSON.stringify(x);r.init(s);assert.equal(JSON.stringify(x),initialized);
  for(const bad of [null,false,0,{}, {scaled:true,credit:1,mutantCredit:0},{scaled:true,credit:-.1,mutantCredit:0},{scaled:true,credit:0,mutantCredit:Infinity}]){const copy=JSON.parse(JSON.stringify(s));copy.civilization.society.births=bad;assert.throws(()=>r.validate(copy));}
});
test('small villages retain one paid newborn; public facilities enable proportional growth below eighty',()=>{
  const h=familySetup([{age:25,count:44}]),{s,r}=h,x=s.civilization.society;const food=s.stores.food,medicine=s.stores.medicine;
  familyYear(h);assert.equal(newborns(s),1);assert.equal(x.births.scaled,false);assert.equal(s.stores.food,food-6);assert.ok(Math.abs(s.stores.medicine-(medicine-.2))<1e-8);
  Object.assign(s.civilization.tech,{standards:true});Object.assign(s.game.buildings,{publicclinic:1,publicschool:1});r.tick(s);assert.equal(x.births.scaled,true);
  familyYear(h);assert.equal(newborns(s),2);assert.equal(r.workforce(s),44,'infants do not fill jobs');
  delete s.game.buildings.publicclinic;delete s.civilization.tech.standards;r.tick(s);assert.equal(x.births.scaled,true,'a later shortage cannot reset the demographic phase');
});
test('eighty residents activate proportional births before an annual death can lower the count to seventy-nine',()=>{
  const h=familySetup(Array.from({length:80},(_,age)=>({age,count:1}))),{s}=h;
  s.civilization.society.births={scaled:false,credit:0,mutantCredit:0};familyYear(h);
  assert.equal(s.civilization.society.births.scaled,true);assert.equal(newborns(s),2);assert.equal(s.game.population,81);assert.ok(Math.abs(s.civilization.society.births.credit-.56)<1e-8);
  const old=familySetup([{age:25,count:70}]);old.s.civilization.urban.chartered=true;old.r.tick(old.s);assert.equal(old.s.civilization.society.births.scaled,true);
});
test('birth identities come only from current reproductive cohorts, never retired or unknown parents',()=>{
  for(const [parent,elder]of [['mutant','human'],['human','mutant']]){
    const h=familySetup([{age:25,count:20,identity:parent},{age:65,count:20,identity:elder}]);h.s.civilization.society.births.scaled=true;familyYear(h);
    assert.equal(newborns(h.s),1);assert.equal(h.s.civilization.society.cohorts.find(c=>c.age===0).identity,parent);
  }
  for(const age of [0,50,65]){const h=familySetup([{age,count:80,identity:'mutant'}]);familyYear(h);assert.equal(newborns(h.s),0);}
  const mixed=familySetup([{age:25,count:5,identity:'human'},{age:25,count:5,identity:'mutant'}]);familyYear(mixed);assert.equal(mixed.s.civilization.society.cohorts.at(-1).identity,'human');
  const copy=JSON.parse(JSON.stringify(mixed.s));mixed.r.init(copy);copy.civilization.elapsed=(copy.civilization.society.year+1)*600;mixed.r.tick(copy);assert.equal(copy.civilization.society.cohorts.at(-1).identity,'mutant');
});
test('paid passenger reservations and newborns cannot consume the same available beds',()=>{
  const h=familySetup([{age:25,count:620}]),{s,r,ctx}=h,x=s.civilization.society;
  s.civilization.urban.parties=[{state:'outbound',cohorts:[{age:25,count:4,identity:'human'}]}];x.births.credit=.9;const food=s.stores.food;familyYear(h);
  assert.equal(newborns(s),0);assert.equal(s.game.population,620);assert.equal(x.births.credit,0);assert.equal(s.stores.food,food);assert.equal(ctx.CivilUrban.availableBeds(s),0);
  s.civilization.urban.parties[0].cohorts[0].count=2;familyYear(h);assert.equal(newborns(s),2);assert.equal(s.game.population+ctx.CivilUrban.reservedBeds(s),624);assert.equal(r.workforce(s),620);
});
test('supply, health and capacity shortages discard missed births instead of banking a later population burst',()=>{
  for(const problem of ['food','medicine','health','hunger']){
    const h=familySetup([{age:25,count:80}]),{s}=h,x=s.civilization.society;x.births.credit=.9;
    if(problem==='food'||problem==='medicine')s.stores[problem]=0;else if(problem==='health')s.civilization.village.health=59;else s.civilization.hunger=10;
    for(let i=0;i<5;i++)familyYear(h);assert.equal(s.game.population,80);assert.equal(x.births.credit,0);
    s.stores.food=10000;s.stores.medicine=10000;s.civilization.hunger=0;s.civilization.village.health=100;familyYear(h);assert.equal(newborns(s),4,problem+' recovery respects the annual cap');
  }
  const partial=familySetup([{age:25,count:80}]);partial.s.stores.food=6;partial.s.stores.medicine=.2;partial.s.civilization.society.births.credit=.9;familyYear(partial);
  assert.equal(newborns(partial.s),1);assert.equal(partial.s.stores.food,0);assert.equal(partial.s.stores.medicine,0);assert.equal(partial.s.civilization.society.births.credit,0);
});
test('the six-hundred-second birthday boundary saves fractional births exactly once and resumes identically',()=>{
  const h=familySetup(Array.from({length:80},(_,age)=>({age,count:1,identity:age%2?'human':'mutant'}))),{s,r}=h,x=s.civilization.society;
  s.civilization.elapsed=x.year*600+599;const before=JSON.stringify([s.stores,s.game.population,x.cohorts,x.births]);r.tick(s);assert.equal(JSON.stringify([s.stores,s.game.population,x.cohorts,x.births]),before);
  s.civilization.elapsed++;r.tick(s);const copy=JSON.parse(JSON.stringify(s));r.validate(copy);r.init(copy);r.tick(copy);assert.equal(JSON.stringify(copy),JSON.stringify(s));
  for(let i=0;i<12;i++){familyYear(h);copy.civilization.elapsed=(copy.civilization.society.year+1)*600;r.tick(copy);}
  assert.equal(JSON.stringify(copy),JSON.stringify(s));r.validate(copy);
});
test('an exhausted migration source no longer caps a supplied, age-diverse town at eighty residents',()=>{
  // Isolated demographic regression: actual 600-second years, 624 paid-capacity beds and ample initial supplies.
  // This proves birth/age recovery, not that an unattended economy produces those supplies for the player.
  const h=familySetup(Array.from({length:80},(_,age)=>({age,count:1,identity:age%4?'human':'mutant'}))),{s,r,ctx}=h;
  s.civilization.urban.registered=true;s.civilization.urban.admitted=480;const source=JSON.stringify(s.civilization.urban.source),initialFood=s.stores.food,initialMedicine=s.stores.medicine;
  let first400=null,minAfter400=Infinity,totalBorn=0;
  for(let year=1;year<=200;year++){
    const workers=r.workforce(s),population=s.game.population;familyYear(h);const born=newborns(s);totalBorn+=born;
    assert.ok(born<=Math.ceil(population*.04),'annual growth remains bounded');
    assert.ok(s.game.population<=ctx.CivilCatalog.capacity(s));assert.equal(r.total(s.civilization.society),s.game.population);assert.ok(r.workforce(s)<=s.game.population);
    if(s.game.population>=400 && first400===null)first400=year;if(first400!==null)minAfter400=Math.min(minAfter400,s.game.population);
    if(year===1)assert.ok(r.workforce(s)<=workers+1,'newborns were not treated as adults');
  }
  assert.ok(first400!==null && first400<=75,'proportional births restore the 400-person path within the tested horizon');assert.ok(minAfter400>=400);
  assert.equal(JSON.stringify(s.civilization.urban.source),source);assert.equal(s.civilization.urban.admitted,480);assert.equal(initialFood-s.stores.food,totalBorn*6);assert.ok(Math.abs(initialMedicine-s.stores.medicine-totalBorn*.2)<1e-6);r.validate(s);
});
