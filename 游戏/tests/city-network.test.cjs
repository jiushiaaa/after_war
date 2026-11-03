// Synthetic full-adapter operations from immutable native inputs; NOT natural play.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./helpers/metro-fixture.cjs');
const copy=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const save=id=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../验证/存档/'+fs.readdirSync(path.resolve(__dirname,'../../验证/存档')).find(f=>f.endsWith(id+'.json'))))).state;
const baseline=save(213),publicSave=save(214);
function start(source=baseline){const h=harness(source);h.n=h.ctx.CivilCityNetwork;h.c=h.ctx.CivilConurbation;h.city=h.ctx.CivilCity;return h;}
function connected(source=baseline){const h=start(source),n=h.n;assert.ok(n.form(h.s));assert.ok(n.survey(h.s));h.step(600);h.until(()=>!n.buildReason(h.s),1200);assert.ok(n.build(h.s));h.step(310);assert.ok(n.setEnabled(h.s,true));return h;}

test('213/214 remain identical until the funded charter; existing return and historical prices survive',()=>{
 for(const source of [baseline,publicSave]){const h=start(source);assert.deepEqual(copy(h.s),source);h.roundtrip();const old=copy(h.c.data(h.s).trips),stock=copy(h.city.node(h.s,h.c.data(h.s).route.depot).stores);assert.ok(h.n.form(h.s));const d=h.n.data(h.s);assert.equal(d.legacyTrips,old.length);assert.deepEqual(copy(h.c.data(h.s).trips),old);near(h.n.local(h.s,'home').stores.tools,stock.tools-h.n.charterCost.tools);h.roundtrip();h.step(180);assert.equal(h.c.data(h.s).trips[old.length-1].status,'complete');
 const sameSecond=start(source),count=sameSecond.c.data(sameSecond.s).trips.length;sameSecond.until(()=>sameSecond.c.data(sameSecond.s).trips.length>count,1200);assert.equal(sameSecond.c.data(sameSecond.s).trips.at(-1).startedAt,sameSecond.s.civilization.elapsed);assert.ok(sameSecond.n.form(sameSecond.s));assert.equal(sameSecond.n.data(sameSecond.s).entries.length,0);sameSecond.roundtrip();}
});
test('west census partitions existing residents and assets, with paid survey crew and finite population groups',()=>{
 const h=start(),{s,n}=h;assert.ok(n.form(s));assert.ok(n.survey(s));assert.equal(n.crew(s,n.data(s).depot),2);h.step(419);const census=h.ctx.CivilCensus,at=census.total(s),born=census.data(s).born,dead=census.data(s).dead,west=census.data(s).accounts.reserve_west;h.step(1);const d=n.data(s);
 assert.equal(census.total(s),at+census.data(s).born-born-(census.data(s).dead-dead));assert.equal(census.data(s).accounts.reserve_west,west-d.origin.population);assert.equal(d.origin.population,d.origin.initial+d.origin.born-d.origin.dead);assert.equal(census.known(s).find(x=>x.id==='city_ridge').member,false);assert.ok(d.node.cohorts.length<=160);assert.equal(n.crew(s,d.depot),0);h.roundtrip();
 for(const k of h.ctx.CivilCityContent.resources)near(d.origin.stores[k],d.origin.initialStores[k]+(d.origin.produced[k]||0)-(d.origin.consumed[k]||0));
});
test('road and second fleet use paid stock and resident work; one fleet queues, two fleets can overlap',()=>{
 const h=connected(),{s,n}=h,d=n.data(s);assert.equal(d.road.worked,300);assert.equal(n.capacity(s),1);let queued=false;
 for(let i=0;i<2200;i++){h.step(1);assert.ok(n.occupied(s)<=1);if(d.waiting.lake!==null||d.waiting.ridge!==null)queued=true;}
 assert.ok(queued);assert.ok(d.trips.some(p=>p.deliveredAt!==null));assert.ok(n.setPriority(s,'industry'));
 const before=copy(n.local(s,'home').stores);assert.ok(n.expand(s,'steel'));near(n.local(s,'home').stores.iron,before.iron-96);assert.equal(n.local(s,'home').workers.fleetbuilder,20);h.step(299);assert.equal(n.capacity(s),1);h.step(1);assert.equal(n.capacity(s),2);
 assert.ok(n.setBudget(s,'home','expand'));let overlap=false;for(let i=0;i<3000;i++){h.step(1);assert.ok(n.occupied(s)<=2);if(n.occupied(s)===2)overlap=true;}assert.ok(overlap);assert.equal(d.expansion.worked,300);h.roundtrip();
});
test('public operating limits are not inventory, hold stops inspections and metal work, funded recovery restores both',()=>{
 const h=connected(),{s,n}=h,d=n.data(s);h.step(2000);const before=copy(d.node.stores),spent=copy(n.spent(s,'ridge'));assert.ok(n.setBudget(s,'ridge','hold'));assert.deepEqual(copy(n.spent(s,'ridge')),spent);near(d.node.stores.knowledge,before.knowledge-4);near(d.node.stores.iron,before.iron);h.step(200);assert.equal(n.inspected(s,'ridge'),false);assert.equal(d.node.workers.smelter,0);assert.equal(d.node.economy.ate,true);assert.equal(d.node.economy.treated,true);
 const count=d.trips.length;h.step(400);assert.equal(d.trips.length,count);assert.equal(n.active(s),undefined);assert.equal(d.node.stable,600);
 const iron=d.node.budget.produced.iron;assert.ok(n.setBudget(s,'ridge','expand'));h.step(1800);assert.ok(n.inspected(s,'ridge'));assert.ok(d.trips.length>count);assert.ok(d.node.budget.produced.iron>iron);assert.equal(d.node.health,100);h.roundtrip();
});
test('per-second physical stock, in-flight cargo, production and consumption reconcile across all five local books',()=>{
 const h=connected(),{s,n,city}=h,d=n.data(s),keys=h.ctx.CivilCityContent.resources;
 const book=()=>{const stock={},made={},used={};for(const v of [...Object.values(s.civilization.city.wards),h.c.data(s).node,d.node]){city.sum(stock,v.stores);city.sum(made,v.budget.produced);city.sum(used,v.budget.consumed);}for(const p of s.civilization.city.shipments){assert.notEqual(p.source,'home');if(p.phase==='outbound')city.sum(stock,p.cargo);}for(const p of [...h.c.data(s).trips,...d.trips])if(['outbound','recalled'].includes(p.status)){city.sum(stock,p.out);city.sum(stock,p.back);}return {stock,made,used};};
 let before=book();for(let i=0;i<2400;i++){if(i===500)n.setBudget(s,'home','hold');if(i===950)n.setBudget(s,'home','expand');if(i===1500)n.expand(s,'timber');h.step(1);const after=book();for(const k of keys)near(after.stock[k]-before.stock[k],(after.made[k]||0)-(before.made[k]||0)-(after.used[k]||0)+(before.used[k]||0));before=after;}h.roundtrip();
});
test('public-service 214 reaches three cities and wooden extra fleet without gifting mining or electricity',()=>{
 const h=connected(publicSave),{s,n}=h;assert.ok(!s.civilization.tech.mechanics);assert.equal(n.expand(s,'steel'),false);h.until(()=>!n.expansionReason(s,'timber'),4000);assert.ok(n.expand(s,'timber'));n.setBudget(s,'home','expand');h.step(3000);const d=n.data(s);assert.equal(n.capacity(s),2);assert.ok(d.trips.some(p=>p.deliveredAt!==null));assert.equal(d.node.health,100);assert.equal(d.node.stable,600);assert.ok(!s.civilization.tech.mechanics);h.roundtrip();
});
test('priority is bounded by actual need and alternates after two favored eligible departures',()=>{
 const h=connected(),{s,n}=h;n.setPriority(s,'food');let both=0,checked=0;const schedule=n.schedule.bind(n);
 n.schedule=state=>{const d=n.data(state),eligible=!h.c.dispatchReason(state,true)&&!n.dispatchReason(state,true),old=d.departures.length,recent=copy(d.departures.slice(-2));if(eligible)both++;schedule(state);if(eligible&&d.departures.length>old&&recent.length===2&&recent.every(p=>p.route==='lake')){assert.equal(d.departures[old].route,'ridge');checked++;}};
 h.step(6000);assert.ok(both>0);assert.ok(checked>0);assert.ok(n.data(s).departures.some(p=>p.route==='ridge'));h.roundtrip();
});
test('a century through the full adapter keeps three cities supplied with bounded cohorts and conserved world population',()=>{
 const h=connected(),{s,n}=h;assert.ok(n.expand(s,'steel'));n.setBudget(s,'home','expand');h.step(60000,{checkEvery:600});const d=n.data(s);for(const v of [...Object.values(s.civilization.city.wards),h.c.data(s).node,d.node]){assert.equal(v.health,100);assert.equal(v.stable,600);assert.ok(v.cohorts.length<=160);assert.ok(Object.values(v.stores).every(x=>Number.isFinite(x)&&x>=0));}const c=h.ctx.CivilCensus.data(s);assert.equal(h.ctx.CivilCensus.total(s),c.initial+c.born-c.dead);assert.ok(d.trips.length>10);h.roundtrip();
});
test('native decoding rejects phantom people, duplicated receipts, altered cargo, free fleet and unpriced new trips',()=>{
 const h=connected();h.step(2000);h.n.expand(h.s,'steel');h.step(350);const source=copy(h.s);
 for(const mutate of [s=>s.civilization.cityNetwork.node.cohorts[0].count++,s=>s.civilization.cityNetwork.origin.stores.iron++,s=>s.civilization.cityNetwork.entries.push(copy(s.civilization.cityNetwork.entries[0])),s=>s.civilization.cityNetwork.trips[0].back.iron++,s=>s.civilization.cityNetwork.expansion.worked--,s=>s.civilization.cityNetwork.trips[0].fees.tools++,s=>s.civilization.cityNetwork.legacyTrips=0,s=>s.civilization.cityNetwork.budget.home='hold',s=>s.civilization.cityNetwork.inspections.ridge=0]){const bad=copy(source);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
 h.roundtrip();
});

// Explicit synthetic stock inputs isolate a real clearing corner case; not a save.
test('medicine-only demand clears an attainable basket instead of refusing useful trade over a remainder',()=>{
 const h=connected(),{s,n}=h,d=n.data(s),home=n.local(s,'home'),targets=n.targets(s);
 d.node.stores.food=targets.food;d.node.stores.medicine=targets.medicine-95;home.stores.medicine=1000;home.stores.iron=227;home.stores.tools=640;
 const order=n.order(s);assert.deepEqual(copy(order),{out:{medicine:90},back:{iron:72}});assert.equal(h.c.value(order.out),h.c.value(order.back));
});
