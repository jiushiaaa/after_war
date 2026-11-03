const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./helpers/metro-fixture.cjs');
const original=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/存档/自然游玩_万人城域水务恢复207.json'),'utf8')).state;
const copy=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function scenario(){const h=harness(original);h.i=h.ctx.CivilCityInstitutions;h.city=h.ctx.CivilCity;h.c=h.ctx.CivilCensus;return h;}
function found(){const h=scenario();assert.ok(h.i.found(h.s));return h;}

test('207 retains every original field until a paid civic charter is explicitly signed',()=>{
 const h=scenario(),{s,i,city,ctx}=h;assert.deepEqual(copy(s),original);ctx.CivilPlatform.validate(s);
 const global=h.c.total(s),local=city.population(s),wood=s.stores.wood,tools=city.data(s).wards.yards.stores.tools;
 assert.ok(i.found(s));near(s.stores.wood,wood-120);near(city.data(s).wards.yards.stores.tools,tools-12);assert.equal(city.population(s),local);assert.equal(h.c.total(s),global);
 assert.equal(i.found(s),false);ctx.CivilPlatform.validate(s);assert.equal(i.data(s).home.enabled,false);
 assert.equal(i.trained(s,'yards','craft'),12);assert.equal(i.trained(s,'yards','care'),12);
});

test('a paid class reserves residents, requires actual lessons and survives a native round trip once',()=>{
 const h=found(),{s,i,city,ctx}=h,n=city.data(s).wards.yards,pop=city.count(n),budget=copy(n.budget.consumed);
 assert.ok(i.enroll(s,'yards','craft'));city.plan(s,'yards');assert.equal(n.workers.apprentice,24);assert.equal(n.workers.tutor,2);
 assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=city.workforce(n));assert.equal(i.enroll(s,'yards','craft'),false);
 h.step(300);assert.equal(i.local(s,'yards').training,null);assert.equal(i.trained(s,'yards','craft'),36);assert.ok(n.budget.consumed.tools-budget.tools>=18);
 const t=i.local(s,'yards').courses[0];assert.equal(t.rounds,30);near(t.paid.food,60);near(t.paid.tools,18);near(t.paid.knowledge,60);
 assert.ok(city.count(n)>=pop);ctx.CivilPlatform.validate(s);
 const saved=JSON.stringify({format:'postwar-civilization',version:1,state:s}),loaded=ctx.CivilPlatform.decode(saved);assert.deepEqual(copy(loaded),copy(s));
 const again=harness(loaded);again.step(50);assert.equal(again.ctx.CivilCityInstitutions.local(again.s,'yards').certificates.length,3);
});

test('water interruption pauses teaching and cancellation releases the same people without a refund',()=>{
 const h=found(),{s,i,city}=h,n=city.data(s).wards.canal;assert.ok(i.enroll(s,'canal','care'));assert.ok(city.set(s,'canal','waterEnabled',false));
 h.step(60);const t=i.local(s,'canal').training;assert.equal(t.rounds,0);near(t.paid.tools,12);
 assert.ok(city.set(s,'canal','waterEnabled',true));h.step(50);assert.ok(t.rounds>0);const paid=copy(t.paid),stock=n.stores.tools;
 assert.ok(i.cancelTraining(s,'canal'));assert.equal(i.trained(s,'canal','care'),12);near(n.stores.tools,stock);city.plan(s,'canal');assert.equal(n.workers.apprentice,0);
 assert.deepEqual(copy(i.local(s,'canal').courses[0].paid),paid);h.ctx.CivilPlatform.validate(s);
});

test('professional methods share finite technicians and clinical jobs cannot exceed qualified residents',()=>{
 const h=found(),{s,i,city}=h,n=city.data(s).wards.yards;
 // Explicit technology test precondition; this is not a natural industrial playthrough.
 s.civilization.tech.mechanics=true;assert.ok(city.set(s,'yards','method','standard'));city.settleWard(s,'yards');
 assert.ok(n.workers.smith+n.workers.smelter<=i.trained(s,'yards','craft'));
 assert.ok(i.set(s,'yards','careMethod','clinical'));city.settleWard(s,'yards');assert.equal(n.workers.medic,12);
 assert.ok(i.enroll(s,'yards','care'));city.plan(s,'yards');assert.equal(n.workers.medic,10,'two clinical tutors cannot also make medicine');
 h.step(300);city.settleWard(s,'yards');assert.ok(n.workers.medic>12);assert.ok(n.workers.medic<=36);h.ctx.CivilPlatform.validate(s);
});

test('public delegation pays once, preserves external jobs, and an emergency manual order revokes it',()=>{
 const h=found(),{s,i}=h,prior=copy(s.game.workers),tech=copy(s.civilization.tech),buildings=copy(s.game.buildings),food=s.stores.food;
 assert.ok(i.delegate(s,true));i.homeTick(s);near(s.stores.food,food-2);const assigned=copy(s.game.workers);i.homeTick(s);assert.equal(i.data(s).home.records.length,1);
 assert.equal(s.game.workers.transporter,prior.transporter);assert.ok(s.game.workers.medic>=prior.medic);assert.ok(s.game.workers.teacher>=1);
 assert.ok(Object.values(s.game.workers).reduce((a,b)=>a+b,0)<=h.ctx.CivilSociety.workforce(s)-2);
 i.manual(s);h.step(120);assert.equal(i.data(s).home.records.length,1);assert.deepEqual(copy(s.game.workers),assigned);
 assert.deepEqual(copy(s.civilization.tech),tech);assert.deepEqual(copy(s.game.buildings),buildings);h.ctx.CivilPlatform.validate(s);
});

test('delegated home food, medicine and schooling remain covered through several annual transitions',()=>{
 const h=found(),{s,i}=h;assert.ok(i.delegate(s,true));h.step(1800);
 assert.equal(s.civilization.hunger,0);assert.ok(s.civilization.village.health>=95);assert.ok(s.civilization.urban.economy.education&&s.civilization.urban.economy.treatment);
 assert.ok(i.data(s).home.records.length>=25);h.ctx.CivilPlatform.validate(s);
});

test('skills retire with their actual cohorts and textbooks provide a costly recovery path',()=>{
 const h=found(),{s,i,city,c}=h;
 // Independent city/census run only: the unchanged home is not claimed as a full-game long run.
 for(let j=0;j<28800;j++){s.civilization.elapsed++;c.annual(s);city.tick(s);}
 assert.equal(i.trained(s,'yards','craft'),0);assert.ok(i.enroll(s,'yards','craft'));assert.equal(i.local(s,'yards').training.required,60);
 for(let j=0;j<600;j++){s.civilization.elapsed++;c.annual(s);city.tick(s);}
 assert.equal(i.trained(s,'yards','craft'),24);i.validate(s);city.validate(s);c.validate(s);
});

test('forged certificates, course costs, duplicated people and charter payments are rejected',()=>{
 const h=found(),{s,i}=h;assert.ok(i.enroll(s,'terraces','craft'));h.step(300);i.validate(s);
 for(const alter of [x=>x.wards.terraces.certificates.at(-1).cohorts[0].count++,x=>x.wards.terraces.courses[0].paid.tools++,x=>x.paid.home.tools++,x=>x.wards.terraces.certificates.push(copy(x.wards.terraces.certificates.at(-1))),x=>x.home.enabled=true]){
   const modified=copy(s);alter(modified.civilization.city.institutions);assert.throws(()=>i.validate(modified),/机构/);
 }
});

test('specialization trades real surplus; cutting off tools hurts production and self-supply restores it',()=>{
 const h=found(),{s,i,city}=h,a=city.data(s).wards.terraces,b=city.data(s).wards.yards;
 assert.ok(i.set(s,'terraces','profile','provisioning'));assert.ok(i.set(s,'yards','profile','workshop'));
 const before=copy({received:a.budget.received,sent:b.budget.sent});h.step(1200);
 assert.equal(a.workers.smith,0);assert.ok((a.budget.received.tools||0)>(before.received.tools||0));assert.ok((b.budget.sent.tools||0)>(before.sent.tools||0));
 assert.ok(city.set(s,'terraces','freightEnabled',false));h.step(2400);assert.ok(a.stores.tools<1);assert.ok(a.economy.blocked.includes('farmer')||!a.economy.ate||a.health<95);
 assert.match(i.settingReason(s,'terraces','profile','balanced'),/调岗物资/);assert.ok(city.set(s,'terraces','freightEnabled',true));h.step(240);
 assert.ok(i.set(s,'terraces','profile','balanced'));h.step(2400);
 assert.ok(a.economy.ate&&a.economy.treated&&a.economy.water>=city.count(a));assert.ok(a.health>=95&&a.stable>=120);h.ctx.CivilPlatform.validate(s);
});

test('a 100-year independent specialized city run conserves people and material budgets across large generations',()=>{
 const h=found(),{s,i,city,c}=h;assert.ok(i.set(s,'terraces','profile','provisioning'));assert.ok(i.set(s,'yards','profile','workshop'));
 let worst=100;for(let j=0;j<60000;j++){s.civilization.elapsed++;c.annual(s);city.tick(s);if(j%600===0)worst=Math.min(worst,...Object.values(city.data(s).wards).map(n=>n.health));}
 assert.ok(worst>=95);assert.ok(Object.values(city.data(s).wards).every(n=>n.economy.ate&&n.economy.treated&&n.stable>=120));
 assert.ok(city.data(s).arrived>100);city.validate(s);i.validate(s);c.validate(s);
});

test('the naturally discovered 208 bottleneck receives production inputs before optional food reserves',()=>{
 const raw=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/存档/自然游玩_城市分工调运阻塞208.json'))),h=harness(raw.state),{s,ctx}=h,city=ctx.CivilCity,i=ctx.CivilCityInstitutions,n=city.data(s).wards.terraces;
 // Regression runs a COPY of the native failure, not a replacement natural export.
 ctx.CivilPlatform.validate(s);assert.equal(n.stores.tools,0);const tools=n.budget.received.tools||0;
 h.step(360);assert.ok((n.budget.received.tools||0)>tools);assert.ok(n.stores.tools>0);assert.ok(n.economy.ate);assert.ok(n.health>0);
 assert.ok(i.set(s,'terraces','profile','balanced'));h.step(4200);assert.ok(n.health>=98&&n.stable>=120);ctx.CivilPlatform.validate(s);
});

test('a ward joining after the civic charter pays its own registration and receives no free people',()=>{
 const h=scenario(),{s,i,city}=h,n=city.data(s).wards.canal;
 // Declared two-member city fixture; the third district still runs its own economy.
 n.joinedAt=null;assert.ok(i.found(s));assert.equal(i.local(s,'canal'),undefined);assert.equal(i.register(s,'canal'),false);
 h.step(20);assert.ok(city.join(s,'canal'));const pop=city.population(s),before=n.stores.tools;
 assert.ok(i.register(s,'canal'));near(n.stores.tools,before-12);assert.equal(city.population(s),pop);assert.equal(i.register(s,'canal'),false);
 assert.equal(i.local(s,'canal').registeredAt,s.civilization.elapsed);h.ctx.CivilPlatform.validate(s);
});

test('a revocable school mandate pays actual courses and preserves emergency supplies',()=>{
 const h=found(),{s,i,city}=h,n=city.data(s).wards.canal;
 assert.ok(i.set(s,'canal','careMethod','clinical'));h.step(10);assert.equal(i.local(s,'canal').training,null);
 assert.ok(i.delegateSchool(s,'canal',true));h.step(1800);assert.equal(i.schoolNeed(s,'canal'),null);
 assert.equal(i.local(s,'canal').courses.length,5);assert.ok(i.local(s,'canal').courses.every(t=>t.rounds===30&&Math.abs(t.paid.tools-18)<1e-6));
 // Declared low-stock copy: the school must preserve these inputs rather than create free classes.
 const low=copy(s);low.civilization.city.wards.canal.stores.tools=59;low.civilization.city.institutions.wards.canal.certificates=low.civilization.city.institutions.wards.canal.certificates.slice(0,2);
 i.schoolTick(low,'canal');assert.equal(i.local(low,'canal').training,null);
 assert.ok(i.enroll(s,'canal','craft'));assert.ok(i.cancelTraining(s,'canal'));assert.equal(i.local(s,'canal').schoolEnabled,false);h.step(20);assert.equal(i.local(s,'canal').training,null);h.ctx.CivilPlatform.validate(s);
});

test('delegated clinical and technical teaching replaces retiring cohorts across a century',()=>{
 const h=found(),{s,i,city,c}=h;s.civilization.tech.mechanics=true;
 i.set(s,'canal','careMethod','clinical');i.set(s,'terraces','profile','provisioning');i.set(s,'yards','profile','workshop');city.set(s,'yards','method','standard');i.delegateSchool(s,'canal',true);i.delegateSchool(s,'yards',true);
 // Independent district/world simulation; the home and other game systems are not advanced here.
 for(let j=0;j<60000;j++){s.civilization.elapsed++;c.annual(s);city.tick(s);}
 assert.ok(i.local(s,'canal').courses.length>5);assert.ok(i.local(s,'yards').courses.length>2);
 for(const n of Object.values(city.data(s).wards)){assert.ok(n.health>=95,JSON.stringify({health:n.health,stores:n.stores}));assert.ok(n.stable>=120);}
 assert.ok(i.trained(s,'canal','care')>100);assert.ok(i.trained(s,'yards','craft')>20);i.validate(s);city.validate(s);c.validate(s);
});
