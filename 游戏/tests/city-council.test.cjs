// Constructed full-adapter operations from immutable native inputs; NOT natural play.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const saves=path.resolve(__dirname,'../../验证/存档');
const save=id=>JSON.parse(fs.readFileSync(path.join(saves,fs.readdirSync(saves).find(f=>f.endsWith(id+'.json'))))).state;
const baseline=save(217);
function start(source=baseline){const h=harness(source);h.a=h.ctx.CivilCityCouncil;h.d=()=>h.a.data(h.s);return h;}
function formed(){const h=start();assert.ok(h.a.form(h.s));h.until(()=>['home','lake','ridge'].every(id=>h.a.activeOffice(h.s,id)),420);return h;}
function propose(h,kind,target,mode){assert.equal(h.a.reason(h.s,kind,target,mode),null);assert.ok(h.a.propose(h.s,kind,target,mode));assert.equal(h.d().proposals.at(-1).accepted,true);return h.d().projects.at(-1);}
function finish(h,kind,target,mode){const p=propose(h,kind,target,mode);h.until(()=>p.completedAt!==null,6000);return p;}
let lakeSnapshot,fourSnapshot;
function first(){if(!lakeSnapshot){const h=formed();finish(h,'housing','lake','equal');lakeSnapshot=clone(h.s);}return start(lakeSnapshot);}
function four(){if(!fourSnapshot){const h=first();assert.ok(h.a.survey(h.s));finish(h,'housing','home','beneficiary');h.until(()=>h.d().locals.estuary?.node?.stable>=120,1000);assert.ok(h.a.join(h.s));h.until(()=>h.a.activeOffice(h.s,'estuary'),420);finish(h,'road','river','self');finish(h,'road','cross','self');fourSnapshot=clone(h.s);}return start(fourSnapshot);}

test('217 is byte-equivalent in state until an explicit paid mandate, without repricing old routes',()=>{
 const h=start();assert.deepEqual(clone(h.s),baseline);h.roundtrip();const old=clone(h.s.civilization.conurbation.trips),before=clone(h.a.local(h.s,'lake').stores),population=h.ctx.CivilCensus.total(h.s);
 assert.ok(h.a.form(h.s));assert.equal(h.ctx.CivilCensus.total(h.s),population);near(h.a.local(h.s,'lake').stores.tools,before.tools-64);assert.deepEqual(clone(h.s.civilization.conurbation.trips),old);assert.equal(h.a.form(h.s),false);h.roundtrip();
});
test('each public station pays its own materials and reserves real builders before gaining a vehicle',()=>{
 const h=start();h.a.form(h.s);for(const id of h.a.ids(h.s)){assert.equal(h.a.local(h.s,id).workers.publicbuilder,20);assert.equal(h.a.activeOffice(h.s,id),false);}
 h.step(299);assert.equal(h.a.membersAt(h.s,h.s.civilization.elapsed).length,0);h.step(1);assert.equal(h.a.membersAt(h.s,h.s.civilization.elapsed).length,3);h.step(70);
 for(const id of h.a.ids(h.s)){assert.equal(h.a.local(h.s,id).workers.publicclerk,2);assert.equal(h.d().offices[id].worked,300);assert.equal(h.a.activeOffice(h.s,id),true);}h.roundtrip();
});
test('repeat subsidies can be refused on actual housing pressure and net contributions; changing responsibility works',()=>{
 const h=first(),before=h.d().projects.length,paid=h.a.local(h.s,'home').stores.knowledge;
 assert.ok(h.a.request(h.s,'home').due);assert.ok(h.a.propose(h.s,'housing','lake','equal'));assert.equal(h.d().proposals.at(-1).accepted,false);assert.equal(h.d().projects.length,before);near(h.a.local(h.s,'home').stores.knowledge,paid-4);
 const books=clone(h.d().shipments),p=finish(h,'housing','home','beneficiary');assert.equal(p.sites.home.worked,300);assert.ok(h.a.extraHousing(h.s,h.a.depot(h.s))===800);assert.equal(h.a.request(h.s,'home').due,false);assert.deepEqual(clone(h.d().shipments.slice(0,books.length)),books);h.roundtrip();
});
test('revoking a hub stops new forwarding, preserves escrow and paid empty returns, and restoration resumes the same shipment',()=>{
 const h=formed(),p=propose(h,'housing','lake','equal');h.until(()=>h.d().shipments.some(x=>x.source==='ridge'),500);
 const cargo=h.d().shipments.find(x=>x.source==='ridge'),before=clone(cargo.cargo);assert.ok(h.a.set(h.s,'home','enabled',false));h.step(650);
 assert.equal(cargo.deliveredAt,null);assert.equal(cargo.legs.length,1);assert.equal(cargo.legs[0].status,'complete');assert.deepEqual(clone(cargo.cargo),before);assert.equal(p.completedAt,null);h.roundtrip();
 assert.ok(h.a.set(h.s,'home','enabled',true));h.until(()=>p.completedAt!==null,4000);assert.equal(cargo.legs.length,2);assert.notEqual(cargo.deliveredAt,null);assert.equal(h.a.extraHousing(h.s,'lake'),800);h.roundtrip();
});
test('quota changes do not create stock or erase already paid responsibilities, while local supplies stay protected',()=>{
 const h=formed();propose(h,'housing','lake','equal');h.step(20);const spent=h.a.spent(h.s,'home'),stock=clone(h.a.local(h.s,'home').stores);
 assert.ok(h.a.set(h.s,'home','quota','careful'));near(h.a.spent(h.s,'home'),spent);near(h.a.local(h.s,'home').stores.wood,stock.wood);near(h.a.local(h.s,'home').stores.knowledge,stock.knowledge-4);assert.equal(h.a.allowance(h.s,'home'),Math.max(0,400-spent));
 assert.ok(h.a.set(h.s,'home','quota','active'));near(h.a.local(h.s,'home').stores.tools,stock.tools);h.until(()=>h.d().projects[0].completedAt!==null,4000);h.roundtrip();
});

test('a funded medicine obligation adds actual production staff and inputs instead of waiting for an accidental surplus',()=>{
 const h=first(),n=h.a.local(h.s,'home'),floor=h.ctx.CivilCity.count(n)*.01*4;
 // Explicit constructed depletion paid through the same ledger, not a natural run.
 assert.ok(h.ctx.CivilCity.pay(n,{medicine:Math.max(0,n.stores.medicine-floor)}));const before=n.budget.produced.medicine||0;
 const p=propose(h,'housing','home','beneficiary');h.step(30);assert.ok(n.budget.produced.medicine>before);h.until(()=>p.completedAt!==null,4000);assert.equal(h.a.extraHousing(h.s,h.a.depot(h.s)),800);h.roundtrip();
});
test('river census partitions the eastern reserve, preserves global population, and keeps independent clinical assets',()=>{
 const h=first();assert.ok(h.a.survey(h.s));assert.equal(h.a.crew(h.s,'lake'),2);h.step(479);const census=h.ctx.CivilCensus,world=census.total(h.s),born=census.data(h.s).born,dead=census.data(h.s).dead,east=census.data(h.s).accounts.reserve_east;h.step(1);
 const r=h.d().locals.estuary;assert.equal(census.total(h.s),world+census.data(h.s).born-born-census.data(h.s).dead+dead);assert.equal(census.data(h.s).accounts.reserve_east,east-r.origin.population);assert.ok(r.node.cohorts.length<=160);assert.ok(!h.d().offices.estuary);assert.equal(h.a.crew(h.s,'lake'),0);
 for(const k of h.ctx.CivilCityContent.resources)near(r.origin.stores[k],r.origin.initialStores[k]+(r.origin.produced[k]||0)-(r.origin.consumed[k]||0));h.roundtrip();
});
test('two-ended roads use local construction and change new paths; old consignments keep their committed routes',()=>{
 const h=four();for(const id of ['river','cross']){const p=h.d().projects.find(p=>p.target===id);assert.ok(p.completedAt);assert.equal(Object.keys(p.sites).length,2);assert.ok(Object.values(p.sites).every(site=>site.worked===300));}
 assert.deepEqual(clone(h.a.path(h.s,'ridge','lake').ids),['ridge','lake']);assert.deepEqual(clone(h.d().shipments.find(p=>p.source==='ridge'&&p.target==='lake').path.ids),['ridge','home','lake']);
 const ironBefore=h.a.local(h.s,'estuary').budget.produced.medicine||0;const p=finish(h,'housing','ridge','specialist'),ship=h.d().shipments.find(x=>x.project===p.id&&x.source==='estuary');assert.ok(ship);assert.deepEqual(clone(ship.path.ids),['estuary','lake','ridge']);assert.equal(ship.cargo.medicine,48);assert.notEqual(ship.deliveredAt,null);assert.ok(h.a.local(h.s,'estuary').budget.produced.medicine>ironBefore);h.roundtrip();
});
test('per-second stock plus held cargo reconciles against real production and consumption across the four-city network',()=>{
 const h=four(),s=h.s,city=h.ctx.CivilCity,keys=h.ctx.CivilCityContent.resources;
 const book=()=>{const stock={},made={},used={};for(const n of [...Object.values(s.civilization.city.wards),s.civilization.conurbation.node,s.civilization.cityNetwork.node,h.d().locals.estuary.node]){city.sum(stock,n.stores);city.sum(made,n.budget.produced);city.sum(used,n.budget.consumed);}for(const p of s.civilization.city.shipments){assert.notEqual(p.source,'home');if(p.phase==='outbound')city.sum(stock,p.cargo);}for(const p of [...s.civilization.conurbation.trips,...s.civilization.cityNetwork.trips])if(['outbound','recalled'].includes(p.status)){city.sum(stock,p.out);city.sum(stock,p.back);}for(const p of h.d().shipments)if(p.deliveredAt===null)city.sum(stock,p.cargo);return {stock,made,used};};
 let before=book();for(let i=0;i<2600;i++){if(i===0)propose(h,'housing','ridge','specialist');if(i===80)h.a.set(s,'lake','enabled',false);if(i===800)h.a.set(s,'lake','enabled',true);h.step(1);const after=book();for(const k of keys)near(after.stock[k]-before.stock[k],(after.made[k]||0)-(before.made[k]||0)-(after.used[k]||0)+(before.used[k]||0),k);before=after;}assert.ok(h.d().projects.at(-1).completedAt);h.roundtrip();
});
test('new beds allow only real paid births, with bounded cohorts and a thirty-year full-adapter stability run',()=>{
 const h=four();finish(h,'housing','ridge','specialist');const before=clone(h.s.civilization.census);h.step(18000,{checkEvery:600});
 for(const id of h.a.ids(h.s)){const n=h.a.local(h.s,id);assert.equal(n.health,100);assert.equal(n.stable,600);assert.ok(n.cohorts.length<=160);assert.ok(h.ctx.CivilCity.count(n)<=h.ctx.CivilCity.housing(h.s,h.a.physical(h.s,id)));}
 const c=h.s.civilization.census;assert.equal(h.ctx.CivilCensus.total(h.s),c.initial+c.born-c.dead);assert.ok(c.born>before.born);h.roundtrip();
});
test('native decoding rejects unpaid public cargo, ghost inhabitants, forged votes, duplicated receipts and free beds',()=>{
 const h=four();finish(h,'housing','ridge','specialist');const original=clone(h.s);
 const mutations=[d=>d.locals.estuary.node.cohorts[0].count++,d=>d.shipments[0].cargo.tools++,d=>d.shipments[0].legs[0].paid.food++,d=>d.receipts.push(clone(d.receipts[0])),d=>d.projects[0].sites.lake.worked--,d=>d.projects[0].sites.lake.installed.tools++,d=>d.projects[0].pledges[0].allocated.wood++,d=>d.proposals[0].stances[0].share++,d=>d.offices.home.quota='careful',d=>d.offices.home.completedAt--,d=>d.locals.estuary.origin.housing++,d=>d.shipments.find(p=>p.path.legs.length>1).path.legs[0].travel--];
 for(const mutate of mutations){const bad=clone(original);mutate(bad.civilization.cityCouncil);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}h.roundtrip();
});
test('public town route can fund municipal stations and housing without granting industrial technologies',()=>{
 const h=start(save(214)),n=h.ctx.CivilCityNetwork,s=h.s;assert.ok(!s.civilization.tech.mechanics);n.form(s);n.survey(s);h.step(600);h.until(()=>!n.buildReason(s),1200);n.build(s);h.step(310);n.setEnabled(s,true);h.until(()=>h.a.available(s),3500);assert.ok(h.a.form(s));h.until(()=>['home','lake','ridge'].every(id=>h.a.activeOffice(s,id)),420);finish(h,'housing','lake','equal');assert.ok(!s.civilization.tech.mechanics);h.roundtrip();
});

test('very long cumulative river flows tolerate rounding but still reject a hundredth of unpaid goods',()=>{
 const h=four(),n=h.d().locals.estuary.node;
 // Declared numerical boundary: equal inflow/outflow leaves the physical stock unchanged.
 n.budget.produced.food+=300000000;n.budget.consumed.food+=300000000;n.stores.food+=.00011;
 h.a.validate(h.s);n.stores.food+=.01;assert.throws(()=>h.a.validate(h.s),/河口物资守恒/);
});
