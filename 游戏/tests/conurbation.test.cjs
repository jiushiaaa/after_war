const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./helpers/metro-fixture.cjs');
const save=name=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/存档/'+name+'.json'),'utf8')).state;
const original=save('自然游玩_工业路线万人城市与专业生产210'),publicSave=save('自然游玩_城市机构分工与供给恢复209');
const copy=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function start(source=original){const h=harness(source);h.c=h.ctx.CivilConurbation;h.city=h.ctx.CivilCity;h.census=h.ctx.CivilCensus;return h;}
function surveyed(source=original){const h=start(source);assert.equal(h.c.survey(h.s),true);h.step(500);return h;}
function linked(source=original,depot='yards',mode='industry'){const h=surveyed(source);assert.equal(h.c.build(h.s,depot),true);h.step(300);assert.equal(h.c.sign(h.s,mode),true);return h;}

test('210 and 209 are unchanged until an explicit paid two-city survey; old population rules cannot enter',()=>{
 for(const saved of [original,publicSave]){const h=start(saved);assert.deepEqual(copy(h.s),saved);h.ctx.CivilPlatform.validate(h.s);assert.equal(h.c.data(h.s),undefined);}
 const h=start();h.s.civilization.ruleset=1;assert.ok(h.c.surveyReason(h.s));assert.equal(h.c.survey(h.s),false);
});
test('survey reserves real local workers and refines exactly one existing reserve, never home population or stock',()=>{
 const h=start(),{s,c,city,census}=h,n=s.civilization.city.wards.yards,stock=copy(n.stores),home=s.game.population;
 assert.ok(c.survey(s));assert.equal(c.crew(s,'yards'),2);assert.equal(n.workers.courier,2);near(n.stores.tools,stock.tools-12);assert.equal(s.game.population,home);assert.equal(c.survey(s),false);
 h.step(359);const before=census.total(s),born=census.data(s).born,dead=census.data(s).dead,reserve=census.data(s).accounts.reserve_north;h.step(1);
 const d=c.data(s);assert.equal(census.total(s),before+census.data(s).born-born-(census.data(s).dead-dead));assert.equal(census.data(s).accounts.city_lake,d.origin.population);assert.equal(census.data(s).accounts.reserve_north,reserve-d.origin.population);
 assert.equal(city.population(s),s.game.population+Object.values(s.civilization.city.wards).reduce((a,n)=>a+city.count(n),0));assert.equal(census.known(s).find(x=>x.id==='city_lake').member,false);
 assert.equal(c.crew(s,'yards'),0);assert.deepEqual(copy(d.node.stores),copy(d.origin.stores));h.roundtrip();
});
test('the city opening book derives from recorded coarse births/deaths and cannot be inflated on import',()=>{
 const h=surveyed(),{s,c}=h,o=c.data(s).origin;assert.equal(o.population,o.initial+o.born-o.dead);
 for(const k of h.ctx.CivilCityContent.resources)near(o.stores[k],o.initialStores[k]+(o.produced[k]||0)-(o.consumed[k]||0));
 for(const mutate of [s=>{s.civilization.conurbation.origin.stores.tools+=100;},s=>{s.civilization.census.accounts.city_lake++;},s=>{s.civilization.census.entries.find(e=>e.kind==='partition').count++;},s=>{s.civilization.conurbation.node.cohorts[0].count++;}]){const bad=copy(s);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
test('both cities pay their own road assets and construction consumes resident work before cooperation unlocks',()=>{
 const h=surveyed(),{s,c,city}=h,local=copy(c.data(s).node.stores),depot=copy(city.node(s,'yards').stores),population=city.count(c.data(s).node);
 assert.ok(c.build(s,'yards'));near(c.data(s).node.stores.tools,local.tools-40);near(city.node(s,'yards').stores.wood,depot.wood-240);assert.equal(c.sign(s,'industry'),false);
 assert.equal(city.node(s,'yards').workers.routebuilder,20);assert.equal(c.data(s).node.workers.routebuilder,20);h.step(239);assert.equal(c.data(s).route.phase,'building');h.step(1);assert.equal(c.data(s).route.phase,'ready');assert.equal(c.data(s).route.worked,240);assert.equal(city.count(c.data(s).node),population+c.data(s).node.born-c.data(s).node.dead);h.roundtrip();
});
test('reciprocal cargo leaves both local stocks, reserves 12 residents and enters only after real travel',()=>{
 const h=linked(),{s,c,city}=h,d=c.data(s),population=h.census.total(s),before={home:copy(city.node(s,'yards').stores),lake:copy(d.node.stores)};
 assert.ok(c.dispatch(s));const p=d.trips[0];assert.equal(c.value(p.out),c.value(p.back));assert.equal(h.census.total(s),population);assert.equal(c.crew(s,'yards'),6);assert.equal(c.crew(s,'lake'),6);
 for(const [side,cargo]of [['home',p.out],['lake',p.back]])for(const k of Object.keys(cargo))near((side==='home'?city.node(s,'yards'):d.node).stores[k],before[side][k]-cargo[k]-(p.fees[side][k]||0));
 assert.equal(c.dispatch(s),false);h.step(179);assert.equal(p.deliveredAt,null);const received=copy(d.node.budget.received);h.step(1);assert.equal(p.status,'returning');for(const [k,v]of Object.entries(p.out))near(d.node.budget.received[k]-(received[k]||0),v);
 const imported=h.roundtrip();imported.step(20);assert.equal(imported.ctx.CivilConurbation.data(imported.s).trips[0].deliveredAt,p.deliveredAt);assert.deepEqual(copy(imported.s.civilization.conurbation.node.budget.received),copy(d.node.budget.received));
});
test('interrupted outbound cargo returns over the travelled distance, with no instant refund or repeated reward',()=>{
 const h=linked(),{s,c}=h,d=c.data(s);assert.ok(c.dispatch(s));h.step(70);const p=d.trips[0],received=copy(d.node.budget.received),fees=copy(p.fees);assert.ok(c.suspend(s,true));assert.equal(p.status,'recalled');assert.equal(p.remaining,70);assert.deepEqual(copy(d.node.budget.received),received);h.roundtrip();
 h.step(69);assert.equal(p.status,'recalled');h.step(1);assert.equal(p.status,'returned');assert.equal(c.crew(s,'lake'),0);for(const [k,v]of Object.entries(p.back))near(d.node.budget.received[k]-(received[k]||0),v);assert.deepEqual(copy(p.fees),fees);
 const restored=h.roundtrip();restored.step(400);assert.deepEqual(copy(restored.s.civilization.conurbation.node.budget.received),copy(d.node.budget.received));assert.equal(c.suspend(s,false),true);h.step(200);assert.ok(d.trips.some(x=>x.deliveredAt!==null));
});
test('burden changes affect only future fees, and exit settles existing vehicles before another contract',()=>{
 const h=linked(),{s,c}=h,d=c.data(s);assert.ok(c.dispatch(s));const old=copy(d.trips[0].fees);assert.ok(c.setShare(s,'host'));assert.deepEqual(copy(d.trips[0].fees),old);assert.ok(c.end(s));assert.equal(c.sign(s,'provisions'),false);h.step(1);assert.equal(d.trips[0].status,'returned');assert.ok(c.sign(s,'provisions'));h.step(400);
 const next=d.trips[1];assert.equal(next.share,'host');near(next.fees.home.tools,3);near(next.fees.lake.tools,1);h.roundtrip();
});
test('local reserve floors block unaffordable exports, then ordinary production recovers the route',()=>{
 const h=linked(),{s,c,city}=h,n=city.node(s,'yards');
 // Declared test-only public consumption, recorded against the very same stock.
 assert.ok(city.pay(n,{tools:n.stores.tools-32,iron:n.stores.iron}));assert.ok(c.dispatchReason(s));assert.equal(c.dispatch(s),false);h.step(600);assert.ok(c.data(s).trips.length>0);assert.equal(n.health,100);h.roundtrip();
});
test('industrial deliveries become local workshop assets; the retiring office is replaced by paid resident successors',()=>{
 const h=linked(),{s,c}=h,d=c.data(s);h.step(800);assert.ok(d.node.budget.received.iron>=48);const iron=d.node.stores.iron,pop=h.ctx.CivilCity.count(d.node);assert.ok(c.workshop(s,'iron'));near(d.node.stores.iron,iron-48);assert.equal(h.ctx.CivilCity.count(d.node),pop);h.step(240);assert.equal(d.workshop.worked,240);assert.ok(d.office.records.length>=1);assert.equal(d.office.records[0].previous.cohorts[0].age,64);assert.equal(d.office.records[0].cohorts[0].count,2);h.roundtrip();
});
test('dynamic orders respect real need and equal physical value instead of endlessly importing idle iron',()=>{
 const h=linked(),{s,c}=h;h.step(6000);const d=c.data(s);assert.ok(d.trips.length>5);assert.ok(d.node.stores.iron<=150);assert.ok(d.trips.some(p=>p.out.iron));assert.ok(d.trips.some(p=>!p.out.iron));for(const p of d.trips)assert.equal(c.value(p.out),c.value(p.back));h.roundtrip();
});
test('the independent public-service route can form the same two-city network without mining, mechanics or power',()=>{
 const h=linked(publicSave,'canal','provisions'),{s,c}=h;assert.equal(!!s.civilization.tech.mechanics,false);assert.ok(c.signReason(s,'industry'));h.step(1000);assert.ok(c.workshop(s,'timber'));h.step(4000);const d=c.data(s);assert.ok(d.clusterAt!==null);assert.equal(d.node.health,100);assert.equal(d.node.stable,600);assert.ok(d.trips.some(p=>p.out.medicine));assert.ok(d.trips.some(p=>p.out.tools));assert.ok(d.trips.some(p=>p.back.food));assert.equal(!!s.civilization.tech.mechanics,false);h.roundtrip();
});
test('a century of full-adapter two-city operation keeps stocks conserved, service healthy and delegation renewed',()=>{
 const h=linked(),{s,c}=h;h.step(800);assert.ok(c.workshop(s,'iron'));h.step(60000,{checkEvery:600});const d=c.data(s);assert.equal(d.node.health,100);assert.equal(d.node.stable,600);assert.ok(d.office.records.length>=3);assert.ok(d.payments.length>=10);assert.ok(d.trips.filter(p=>p.deliveredAt!==null).length>=100);
 for(const n of Object.values(s.civilization.city.wards)){assert.equal(n.health,100);assert.equal(n.stable,600);}
 assert.equal(h.census.total(s),h.census.data(s).initial+h.census.data(s).born-h.census.data(s).dead);h.roundtrip();
});
test('native validation rejects duplicated cargo, repriced old fees, false completion and phantom assets',()=>{
 const h=linked();h.step(800);const saved=copy(h.s);
 for(const mutate of [s=>s.civilization.conurbation.trips[0].out.tools++,s=>s.civilization.conurbation.trips[0].fees.home.tools++,s=>s.civilization.conurbation.trips[0].deliveredAt--,s=>s.civilization.conurbation.trips[0].order++,s=>s.civilization.conurbation.node.stores.tools++,s=>s.civilization.conurbation.route.condition+=20]){const bad=copy(saved);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});

test('each second of two-city operations conserves material across local stocks and both kinds of in-flight cargo',()=>{
 const h=linked(),{s,c}=h,keys=h.ctx.CivilCityContent.resources;
 const book=()=>{const stock={},made={},used={};for(const n of [...Object.values(s.civilization.city.wards),c.data(s).node]){h.city.sum(stock,n.stores);h.city.sum(made,n.budget.produced);h.city.sum(used,n.budget.consumed);}
 for(const p of s.civilization.city.shipments){assert.notEqual(p.source,'home','this fixture has no original-town aid');if(p.phase==='outbound')h.city.sum(stock,p.cargo);}
 for(const p of c.data(s).trips)if(p.status==='outbound'||p.status==='recalled'){h.city.sum(stock,p.out);h.city.sum(stock,p.back);}return {stock,made,used};};
 let before=book();for(let i=0;i<1600;i++){if(i===420)c.suspend(s,true);if(i===700)c.suspend(s,false);if(i===1000)c.setShare(s,'host');h.step(1,{checkEvery:60});const after=book();for(const k of keys)near(after.stock[k]-before.stock[k],(after.made[k]||0)-(before.made[k]||0)-((after.used[k]||0)-(before.used[k]||0)));before=after;}
 h.roundtrip();
});
test('16x is earned by actual two-city cooperation, remains optional, and survives a valid imported save',()=>{
 const h=linked(),{s,c}=h;h.ctx.CivilClock=new h.ctx.SimulationClock(()=>s.civilization.elapsed*1000);assert.equal(s.civilization.maxSpeed,8);assert.equal(h.ctx.Civilization.setSpeed(16),false);h.step(1200);assert.ok(c.data(s).clusterAt!==null);assert.equal(s.civilization.maxSpeed,16);assert.equal(s.civilization.speed,8);assert.ok(h.ctx.Civilization.setSpeed(16));h.roundtrip();assert.ok(c.end(s));h.step(300);assert.equal(s.civilization.maxSpeed,16);h.roundtrip();
});
test('a late survey refines a coarse city whose housing was maintained before contact',()=>{
 const h=start();h.step(72000,{checkEvery:600});assert.ok(h.c.survey(h.s));h.step(500);const d=h.c.data(h.s);assert.ok(d.origin.population<=d.origin.housing);assert.ok(d.origin.assets.familyBeds>=d.origin.initial*1.5);h.roundtrip();
});
