const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
function read(name){return JSON.parse(z.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档',name))).data,'base64'))).state;}
const raw=read('自然游玩_Mac国家协约互市与信贷清偿125.json');
function ready(){const h=harness(raw);h.w=h.ctx.CivilWorld;h.f=h.ctx.CivilForeign;h.sc=h.ctx.CivilStatecraft;h.d=h.w.data(h.s);return h;}
// Isolated world clock with declared constant administrative availability. This
// is a rules test, never a replacement for natural browser play.
function advance(h,n){h.w.political=()=>true;for(let i=0;i<n;i++){h.s.civilization.elapsed++;h.w.tick(h.s);h.w.settle(h.s);}h.w.validate(h.s);}
function open(h){assert.equal(h.f.start(h.s),true,h.f.startReason(h.s));}
function total(d){const out={};for(const n of Object.values(d.nodes))for(const[k,v]of Object.entries(n.stores))out[k]=(out[k]||0)+v;for(const o of d.foreign.shipments)if(o.arrivedAt===null)for(const[k,v]of Object.entries(o.cargo))out[k]=(out[k]||0)+v;return out;}

test('old125 strictly roundtrips without new grants, and early stages cannot activate diplomacy',()=>{
 const h=ready();assert.equal(h.d.foreign,undefined);h.roundtrip();const early=harness();assert.equal(early.ctx.CivilForeign.available(early.s),false);assert.equal(early.ctx.CivilForeign.start(early.s),false);
 const before=clone(h.s.stores);open(h);near(h.s.stores.knowledge,before.knowledge-180);near(h.s.stores.electronics,before.electronics-20);assert.equal(h.f.start(h.s),false);assert.ok(Object.values(h.d.foreign.actors).every(a=>a.balance===0));h.roundtrip();
});
test('autonomous production and trade conserve material including cargo and consume actual local fares',()=>{
 const h=ready();open(h);const d=h.d,f=d.foreign,before=total(d),expected={...before};
 for(const[id,n]of Object.entries(d.nodes)){const p=h.ctx.CivilForeignContent.profiles[id],cost={food:12,[p.need]:p.use};if(h.f.canSpend(n,cost)){for(const[k,v]of Object.entries(cost))expected[k]=(expected[k]||0)-v;for(const[k,v]of Object.entries(p.output))expected[k]=(expected[k]||0)+v;}}
 h.f.round(d,{at:f.startedAt+300,political:true});assert.ok(f.shipments.length>0);
 for(const o of f.shipments)for(const[k,v]of Object.entries(o.fare))expected[k]=(expected[k]||0)-v;
 const after=total(d);for(const k of new Set([...Object.keys(after),...Object.keys(expected)]))near(after[k]||0,expected[k]||0,k);
 assert.equal(Object.values(f.actors).reduce((sum,a)=>sum+a.balance,0),0);assert.ok(f.shipments.every(o=>o.arrivedAt===null&&o.dueAt-o.departedAt===300));
 const count=f.shipments.length;h.f.round(d,{at:f.lastRoundAt,political:true});assert.equal(f.shipments.length,count);
});
test('normal budget replay preserves autonomous shipments, credit limits and old Earth ending',()=>{
 const h=ready();open(h);advance(h,910);const f=h.d.foreign;assert.equal(f.round,3);assert.ok(f.shipments.some(o=>o.arrivedAt!==null));assert.equal(Object.values(f.actors).reduce((sum,a)=>sum+a.balance,0),0);h.w.validate(h.s);
 assert.ok(Object.values(f.pairs).every(p=>p.phase!=='war'));assert.ok(Object.values(h.d.nodes).every(n=>n.casualties===0));
});
test('price responds to shortages and freezes at player dispatch; later quotes do not rewrite cargo',()=>{
 const h=ready();open(h);const rate=h.f.rate(h.d,'north'),quote=h.sc.quote(h.s,'north','exchange');assert.equal(quote.marketRate,rate);
 assert.equal(h.w.start(h.s,'north','exchange'),true,h.w.reason(h.s,'north','exchange'));const m=h.w.active(h.s),cfg=clone(h.w.missionConfig(m));advance(h,540);assert.equal(m.returnedAt!==null,true);assert.deepEqual(clone(h.w.missionConfig(m)),cfg);h.w.validate(h.s);
 const poor=clone(h.d);poor.nodes.north.stores.parts=0;assert.ok(h.f.rate(poor,'north')<rate);
 const bad=clone(h.s);bad.civilization.worldstage.missions.at(-1).marketRate++;assert.throws(()=>h.w.validate(bad));
});
test('credit policy changes risk capacity without erasing old claims; proposals use response-time conditions',()=>{
 const h=ready();open(h);advance(h,910);const f=h.d.foreign,key='desert-polar';assert.equal(f.pairs[key].phase,'dispute');
 const before=clone(Object.fromEntries(Object.entries(f.actors).map(([id,a])=>[id,a.balance])));assert.equal(h.f.setPolicy(h.s,'tight'),true);assert.deepEqual(clone(Object.fromEntries(Object.entries(f.actors).map(([id,a])=>[id,a.balance]))),before);assert.equal(h.f.setPolicy(h.s,'open'),false);
 assert.equal(h.f.propose(h.s,key,'observe'),true,h.f.proposalReason(h.s,key,'observe'));const proposal=f.proposals.at(-1);assert.equal(proposal.resolvedAt,null);advance(h,610);assert.equal(proposal.accepted,true);assert.equal(f.pairs[key].phase,'truce');assert.ok(proposal.score>=50);h.w.validate(h.s);
});
test('observer proposal can be refused under hostile conditions, and later acceptance is not guaranteed at submission',()=>{
 const h=ready();open(h);const f=h.d.foreign,key='desert-polar',p=f.pairs[key];
 // Declared counterfactual decision fixture, not a valid saved history.
 p.phase='embargo';p.pressure=100;p.relation=-100;const o={id:1,pair:key,kind:'observe',at:f.startedAt,paid:{knowledge:100,medicine:12,tools:12},resolvedAt:null,accepted:null,score:null};f.proposals.push(o);
 h.f.round(h.d,{at:f.startedAt+300,political:false});assert.equal(o.accepted,false);assert.ok(o.score<50);
});
test('overdue accounts stop borrowing but physical exports can settle balances without printing currency',()=>{
 const h=ready();open(h);const f=h.d.foreign,start=f.startedAt;
 // Explicit clearing-account microfixture: desert owes east 72, no new stock.
 f.actors.desert.balance=-72;f.actors.desert.debtSince=start-1800;f.actors.east.balance=72;
 const oldDebtSince=f.actors.desert.debtSince;h.f.round(h.d,{at:start+300,political:true});assert.equal(Object.values(f.actors).reduce((sum,a)=>sum+a.balance,0),0);
 assert.ok(f.events.some(e=>e.kind==='credit'&&e.text.includes(h.f.name('desert'))));assert.ok(!f.shipments.some(o=>o.to==='desert'&&!o.settlement));assert.ok(f.shipments.some(o=>o.from==='desert'));assert.ok(f.actors.desert.balance>=-72);
 if(f.actors.desert.balance<0)assert.equal(f.actors.desert.debtSince,oldDebtSince);
});
test('full adapter, forecast and strict import handle new autonomous state and actual player missions',()=>{
 const h=ready();open(h);h.step(620,{checkEvery:0});h.roundtrip();const before=clone(h.s),messages=h.messages.length,copy=h.ctx.CivilForecast.copy(h.s);copy.civilization.elapsed=h.d.foreign.lastRoundAt+300;h.w.settle(copy);assert.deepEqual(clone(h.s),before);assert.equal(h.messages.length,messages);
});
test('replay rejects fabricated credits, unbacked cargo, changed outcome, timeline and foreign enrollment',()=>{
 const h=ready();open(h);advance(h,900);const saved=clone(h.s);
 for(const mutate of [s=>s.civilization.worldstage.foreign.actors.east.balance++,s=>s.civilization.worldstage.foreign.shipments[0].cargo.parts=1000,s=>s.civilization.worldstage.foreign.pairs['desert-polar'].pressure++,s=>s.civilization.worldstage.foreign.lastRoundAt++,s=>s.civilization.worldstage.foreign.creditPolicy='open',s=>s.civilization.worldstage.nodes.north.stores.coal++,s=>{const d=s.civilization.worldstage;d.ledger=d.ledger.filter(r=>r.kind!=='foreign');}]){const bad=clone(saved);mutate(bad);assert.throws(()=>h.w.validate(bad));}
});
test('unified members only have budget disputes; threatened independent states fight, exhaust and rebuild',()=>{
 const h=ready();open(h);const f=h.d.foreign;
 // Counterfactual boundary test explicitly separate from natural125.
 const n=h.d.nodes.north,w=h.d.nodes.west,p=f.pairs['north-west'];n.joinedAt=null;n.control='independent';w.joinedAt=null;w.control='independent';n.stores.coal=0;w.stores.steel=0;p.pressure=84;p.phase='embargo';
 h.f.round(h.d,{at:f.lastRoundAt+300,political:true});assert.equal(p.phase,'war');const populations=[n.population,w.population];
 h.f.round(h.d,{at:f.lastRoundAt+300,political:true});assert.equal(n.population,populations[0]-2);assert.equal(w.population,populations[1]-2);assert.equal(n.infrastructure,95);assert.equal(w.infrastructure,95);assert.equal(n.joinedAt,null);
 for(let i=0;i<3;i++)h.f.round(h.d,{at:f.lastRoundAt+300,political:true});assert.equal(p.phase,'truce');const damage=n.infrastructure;h.f.round(h.d,{at:f.lastRoundAt+300,political:true});assert.ok(n.infrastructure>damage);
});


test('real independent-country history escalates to war and a member can be rebuilt without losing membership',()=>{
 const h=harness(read('自然游玩_Mac北陆国家接纳与机器人量产115.json'));h.w=h.ctx.CivilWorld;h.f=h.ctx.CivilForeign;h.sc=h.ctx.CivilStatecraft;h.d=h.w.data(h.s);h.w.political=()=>true;
 assert.equal(h.w.start(h.s,'west','contact'),true);advance(h,960);open(h);advance(h,4500);
 assert.ok(h.d.foreign.events.some(e=>e.kind==='battle'));const n=h.d.nodes.north;assert.ok(n.casualties>0);assert.ok(n.joinedAt!==null);assert.ok(n.infrastructure<100);
 assert.equal(h.w.start(h.s,'north','rebuild'),true,h.w.reason(h.s,'north','rebuild'));advance(h,900);assert.equal(n.infrastructure,100);assert.equal(n.control,'member');h.w.validate(h.s);
});
