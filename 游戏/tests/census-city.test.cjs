const {test}=require('node:test'),assert=require('node:assert/strict');
const {fresh}=require('./helpers/census-fixture.cjs');
const copy=s=>JSON.parse(JSON.stringify(s));
function residents(h,n=4){assert.ok(h.c.move(h.s,'wanderers','home',n,'测试前置：已存在居民迁居'));h.s.game.population+=n;h.s.civilization.society.cohorts.push({age:25,count:n,identity:'human'});}

test('world initialization partitions 350–500 million people without counting parents twice',()=>{
 const h=fresh(),{s,c}=h,d=c.data(s);assert.ok(d.initial>=350000000&&d.initial<=500000000);
 assert.equal(c.total(s),d.initial);assert.equal(d.accounts.ward_terraces,3400);assert.equal(c.known(s).length,1);
 const before=JSON.stringify(s);c.init(s);c.known(s);assert.equal(JSON.stringify(s),before);c.validate(s);h.city.validate(s);
});

test('ledger rejects source overdrafts, altered populations and an unexplained added person',()=>{
 const {s,c}=fresh(),before=JSON.stringify(s);assert.equal(c.move(s,'wanderers','home',513),false);assert.equal(JSON.stringify(s),before);
 const tampered=copy(s);tampered.civilization.census.accounts.home++;assert.throws(()=>c.validate(tampered),/人口/);
 const x=copy(s);x.game.population=1;assert.throws(()=>c.validate(x),/所在名册/);
});

test('the last available wanderer may arrive alone and an exhausted source creates no people',()=>{
 const h=fresh(),{s,c,ctx}=h;s.game.buildings.hut=1;
 // Explicit scenario: all other wanderers died; one real source resident remains.
 c.death(s,'wanderers',511);ctx.Civilization.arrivals();assert.equal(s.game.population,1);assert.equal(c.data(s).accounts.wanderers,0);
 ctx.Civilization.arrivals();assert.equal(s.game.population,1);c.validate(s);ctx.CivilPlatform.validate(s);
});

test('uncontacted districts live before discovery; census moves no residents or inventories',()=>{
 const h=fresh(),{s,c,city,step}=h;residents(h);s.civilization.village.town=true;s.civilization.tech.survey=true;Object.assign(s.stores,{food:500,tools:100,knowledge:100});
 const n=city.data(s).wards.terraces;step(180);assert.ok(n.budget.produced.food>0);assert.ok(n.economy.ate);const total=c.total(s),home=s.game.population;
 assert.ok(city.contact(s,'terraces'));step(180);assert.notEqual(n.contactedAt,null);assert.equal(s.game.population,home);assert.equal(c.total(s),total);assert.equal(city.members(s).length,0);c.validate(s);city.validate(s);
});

test('all births and deaths, including unseen districts, conserve the world total through several years',()=>{
 const h=fresh();h.step(1800);const d=h.c.data(h.s);
 assert.ok(d.born>0&&d.dead>0);assert.equal(h.c.total(h.s),d.initial+d.born-d.dead);
 h.c.validate(h.s);h.city.validate(h.s);const saved=copy(h.s);h.c.validate(saved);h.city.validate(saved);
 saved.civilization.census.year--;assert.throws(()=>h.c.validate(saved),/世界人口底账/,'a stale annual cursor must not replay births after import');
});

test('water cutoff has real consequences and recovers without resetting population or stores',()=>{
 const h=fresh(),{s,city,c}=h,n=city.data(s).wards.canal;h.step(600);const total=c.total(s),population=city.count(n);
 // Synthetic administrative permission is explicit; the simulation receives no extra resources.
 n.contactedAt=0;n.joinedAt=0;n.buildings.water=1;n.buildings.road=1;
 assert.ok(city.set(s,'canal','waterEnabled',false));h.step(180);assert.equal(n.economy.water,0);assert.ok(n.health<100);assert.equal(n.stable,0);const low=n.health;
 assert.ok(city.set(s,'canal','waterEnabled',true));h.step(180);assert.ok(n.health>low);assert.ok(n.economy.water>=city.count(n));assert.ok(n.economy.ate&&n.economy.treated);assert.equal(city.count(n),population);assert.equal(c.total(s),total);
 const onePlant=n.workers.waterworker;n.buildings.water=2;city.settleWard(s,'canal');assert.ok(n.workers.waterworker<onePlant,'the second water plant actually releases workers');assert.ok(n.economy.water>=city.count(n));
});

test('two production methods change input chains and an unavailable input stops output',()=>{
 const h=fresh(),{s,city}=h,n=city.data(s).wards.yards;n.contactedAt=0;n.joinedAt=0;
 assert.equal(city.set(s,'yards','method','standard'),false);s.civilization.tech.mechanics=true;s.civilization.tech.standards=true;
 assert.ok(city.set(s,'yards','method','standard'));n.stores.tools=0;
 city.settleWard(s,'yards');assert.ok(n.budget.consumed.iron>0);assert.ok(n.budget.produced.iron>0);assert.ok(n.budget.produced.tools>0);
 assert.equal(city.set(s,'yards','priority','magic'),false);assert.equal(city.set(s,'yards','waterEnabled','false'),false);
});

test('paid construction takes transport and staffed working time; completed buildings are not reissued',()=>{
 const h=fresh(),{s,city}=h,n=city.data(s).wards.terraces;n.contactedAt=0;s.civilization.tech.administration=true;
 Object.assign(s.stores,{wood:1000,food:1000,tools:200,medicine:100});const w=s.stores.wood;
 assert.ok(city.startProject(s,'terraces','road'));assert.equal(s.stores.wood,w-180);assert.equal(city.startProject(s,'terraces','road'),false);
 h.step(119);assert.equal(n.buildings.road,0);assert.equal(n.project.phase,'transport');h.step(300);assert.equal(n.buildings.road,1);assert.equal(n.completed.length,1);
 assert.equal(city.startProject(s,'terraces','road'),false);city.validate(s);h.c.validate(s);
});

test('joining a ward changes jurisdiction only and requires actual completed services',()=>{
 const h=fresh(),{s,c,city}=h,n=city.data(s).wards.terraces;n.contactedAt=0;s.civilization.tech.administration=true;s.civilization.urban.chartered=true;
 Object.assign(s.stores,{wood:5000,food:5000,tools:500,medicine:100,knowledge:100});assert.equal(city.join(s,'terraces'),false);
 assert.ok(city.startProject(s,'terraces','road'));h.step(420);assert.ok(city.startProject(s,'terraces','water'));h.step(480);
 const global=c.total(s),local=s.game.population,residents=city.count(n);assert.ok(city.join(s,'terraces'));
 assert.equal(c.total(s),global);assert.equal(s.game.population,local);assert.equal(city.population(s),residents+local);assert.equal(city.join(s,'terraces'),false);city.validate(s);c.validate(s);
});

test('public transport takes actual surplus and delivers once, preserving the material equation',()=>{
 const h=fresh(),{s,city}=h,d=city.data(s);h.step(400);
 // Test preconditions: two registered districts and available roads, not natural-play evidence.
 for(const n of Object.values(d.wards)){n.contactedAt=0;n.joinedAt=0;n.buildings.road=1;city.plan(s,Object.keys(d.wards).find(k=>d.wards[k]===n));}
 const a=d.wards.terraces,b=d.wards.yards,key='tools';
 // Spend existing tools as a declared maintenance shock, recorded in the actual budget.
 city.pay(b,{tools:b.stores.tools});const b0=b.stores.tools;city.dispatch(s);
 const trip=d.shipments.find(p=>p.target==='yards'&&p.cargo.tools);assert.ok(trip);assert.equal(b.stores.tools,b0,'nothing delivered on dispatch');
 for(const n of Object.values(d.wards))n.freightEnabled=false;
 h.step(120);assert.notEqual(trip.deliveredAt,null);const received=b.budget.received.tools;assert.ok(received>0);h.step(120);assert.equal(b.budget.received.tools,received);assert.ok(!d.shipments.includes(trip));
});

test('old saves do not acquire the world or city model on initialization',()=>{
 const h=fresh(),s=copy(h.s);delete s.civilization.ruleset;delete s.civilization.city;delete s.civilization.census;
 const before=JSON.stringify(s);h.c.init(s);h.city.init(s);h.c.validate(s);h.city.validate(s);assert.equal(JSON.stringify(s),before);
});

test('survey and relief reserve real adults, pay once and release them only on return',()=>{
 const h=fresh(),{s,city}=h;residents(h);s.civilization.village.town=true;s.civilization.tech.survey=true;Object.assign(s.stores,{food:1000,tools:100,medicine:100,knowledge:100});
 const initial=s.stores.food;assert.ok(city.contact(s,'terraces'));assert.equal(city.crew(s),2);assert.equal(h.ctx.CivilSociety.workforce(s),2);assert.equal(s.stores.food,initial-24);
 assert.equal(city.contact(s,'yards'),false);h.step(90);city.validate(s);h.step(90);assert.equal(city.crew(s),0);
 assert.ok(city.aid(s,'terraces'));assert.equal(city.crew(s),2);assert.equal(city.aid(s,'terraces'),false);h.step(120);
 const received=city.data(s).wards.terraces.budget.received.food;assert.equal(received,96);assert.equal(city.crew(s),2);city.validate(s);h.step(120);assert.equal(city.crew(s),0);assert.equal(city.data(s).wards.terraces.budget.received.food,received);city.validate(s);h.c.validate(s);
});

test('a 10k city is earned by three resident wards, paid infrastructure and stable services',()=>{
 const h=fresh(),{s,city,c}=h;residents(h,400);
 // Explicit synthetic core-town foundation, not a natural new-game acceptance.
 Object.assign(s.civilization.village,{town:true});Object.assign(s.civilization.tech,{survey:true,administration:true});Object.assign(s.civilization.urban,{chartered:true,city:true});
 Object.assign(s.stores,{wood:10000,food:5000,tools:500,medicine:200,knowledge:500});
 for(const id of Object.keys(h.ctx.CivilCityContent.wards)){assert.ok(city.contact(s,id));h.step(180);assert.ok(city.startProject(s,id,'road'));}
 h.step(420);for(const id of Object.keys(h.ctx.CivilCityContent.wards))assert.ok(city.startProject(s,id,'water'));
 h.step(480);const before=c.total(s),home=s.game.population;
 for(const id of Object.keys(h.ctx.CivilCityContent.wards))assert.ok(city.join(s,id));
 assert.equal(c.total(s),before);assert.equal(s.game.population,home);assert.equal(city.data(s).cityAt,null);h.step(10);
 assert.ok(city.population(s)>=10000);assert.equal(typeof city.data(s).cityAt,'number');city.validate(s);c.validate(s);
 const saved=copy(s);city.validate(saved);c.validate(saved);h.step(6000);city.validate(s);c.validate(s);
 assert.ok(city.members(s).every(([,n])=>n.economy.ate&&n.economy.treated&&n.stable>=120));
 const altered=copy(s);altered.civilization.city.wards.terraces.stores.food++;assert.throws(()=>city.validate(altered));
});

test('world and district accounting stays bounded through a 100-year uncontacted run',()=>{
 const h=fresh();h.step(60000);h.c.validate(h.s);h.city.validate(h.s);
 assert.ok(Object.values(h.city.data(h.s).wards).every(n=>n.cohorts.length<=160&&n.health>=60&&n.economy.ate&&n.economy.treated));
 assert.ok(h.c.data(h.s).entries.length<3000);assert.ok(JSON.stringify(h.s).length<500000);
});

test('the complete adapter advances new-game demographic accounts and survives native decoding',()=>{
 const h=fresh();for(let i=0;i<1800;i++)h.ctx.Civilization.tick();h.ctx.CivilPlatform.validate(h.s);
 const decoded=h.ctx.CivilPlatform.decode(JSON.stringify({format:'postwar-civilization',version:1,state:h.s}));
 assert.deepEqual(copy(decoded),copy(h.s));assert.ok(h.c.data(h.s).born>0);assert.equal(h.s.civilization.city.wards.terraces.year,3);
});

test('the complete adapter combines a populated home, joined city districts and strict save decoding',()=>{
 const h=require('../../验证/工具/构造城域基线.cjs').build(),{s,ctx,city,c}=h;
 assert.equal(s.civilization.ruleset,2);assert.ok(city.population(s)>=10000);ctx.CivilPlatform.validate(s);
 const original=copy(s);assert.deepEqual(copy(ctx.CivilPlatform.decode(JSON.stringify({format:'postwar-civilization',version:1,state:s}))),original);
 const pre=c.total(s);h.step(1800);assert.ok(c.total(s)>pre);ctx.CivilPlatform.validate(s);
 assert.ok(city.members(s).every(([,n])=>n.economy.educated&&n.economy.ate&&n.economy.treated));
});
