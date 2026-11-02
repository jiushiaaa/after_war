const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(z.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Mac地区自主外交与清算126.json'))).data,'base64'))).state;
function ready(){const h=harness(raw);h.w=h.ctx.CivilWorld;h.l=h.ctx.CivilLeagues;h.f=h.ctx.CivilForeign;h.d=h.w.data(h.s);return h;}
function open(h){assert.equal(h.l.act(h.s,'open'),true,h.l.reason(h.s,'open'));}
// Isolated declared constant-administration world clock, not a natural save.
function advance(h,n){h.w.political=()=>true;for(let i=0;i<n;i++){h.s.civilization.elapsed++;h.w.tick(h.s);h.w.settle(h.s);}h.w.validate(h.s);}
function balance(d){return Object.values(d.foreign.actors).reduce((sum,a)=>sum+a.balance,0);}

test('126 history and in-flight promises stay intact; activation costs real home resources and is gated',()=>{
 const h=ready();h.roundtrip();assert.equal(h.l.data(h.d),undefined);const old=clone(h.d.foreign.shipments),home=clone(h.s.stores);open(h);near(h.s.stores.knowledge,home.knowledge-200);near(h.s.stores.electronics,home.electronics-20);assert.deepEqual(clone(h.d.foreign.shipments),old);assert.equal(h.l.act(h.s,'open'),false);h.roundtrip();const early=harness();assert.equal(early.ctx.CivilLeagues.act(early.s,'open'),false);
});
test('paid treaty proposal is answered later, maintenance lowers pressure and limits real commitments',()=>{
 const h=ready();open(h);assert.equal(h.l.act(h.s,'offer',{pair:'east-north',type:'commerce'}),true);assert.equal(h.l.data(h.d).offers[0].accepted,null);advance(h,610);const pact=h.l.active(h.d,'east-north');assert.ok(pact);assert.ok(pact.paidCycles>0);assert.ok(h.l.credit(h.d,'east')>=40);assert.equal(h.l.act(h.s,'offer',{pair:'east-north',type:'defense'}),false);assert.ok(Object.keys(h.d.nodes).every(id=>h.l.count(h.d,id)<=2));h.w.validate(h.s);
});
test('repeated real deliveries provoke autonomous alliance offers without player clicking each pact',()=>{
 const h=ready();open(h);advance(h,1210);const l=h.l.data(h.d);assert.ok(l.offers.some(o=>o.source==='各方根据往来主动议约'));assert.ok(l.pacts.length>0);assert.equal(balance(h.d),0);h.w.validate(h.s);
});
test('breach damages outside relationships and credit, while normal notice preserves reputation',()=>{
 for(const action of ['breach','notice']){
  const h=ready();open(h);assert.equal(h.l.act(h.s,'offer',{pair:'east-north',type:'commerce'}),true);advance(h,610);const p=h.l.active(h.d,'east-north'),before=h.d.foreign.pairs['east-west'].relation,limit=h.f.limit(h.d,'east');assert.ok(p);
  assert.equal(h.l.act(h.s,action,{pair:p.pair,actor:'east'}),true);
  if(action==='breach'){assert.equal(p.status,'broken');assert.equal(h.l.reputation(h.d,'east'),20);assert.equal(h.d.foreign.pairs['east-west'].relation,Math.max(-100,before-6));assert.ok(h.f.limit(h.d,'east')<limit);}
  else{assert.equal(p.status,'active');advance(h,910);assert.equal(p.status,'ended');assert.equal(h.l.reputation(h.d,'east'),0);assert.match(h.l.offerReason(h.d,p.pair,'commerce',h.s.civilization.elapsed),/冷静/);}
  h.w.validate(h.s);
 }
});
test('new routes charge actual escort costs and durations while existing cargo is unchanged',()=>{
 const h=ready();open(h);const f=h.d.foreign,old=clone(f.shipments);for(const pair of Object.keys(f.pairs))assert.equal(h.l.act(h.s,'route',{pair,mode:'escort'}),true);
 advance(h,1010);const newer=f.shipments.slice(old.length);assert.ok(newer.length);assert.ok(newer.every(o=>o.route==='escort'&&o.dueAt-o.departedAt===600&&o.fare.parts===3&&o.fare.tools===2));for(let i=0;i<old.length;i++)assert.equal(f.shipments[i].dueAt,old[i].dueAt);assert.equal(balance(h.d),0);h.w.validate(h.s);
});
test('direct wartime cargo is held and returned once with reversing claims; escorted and legacy deliveries are honored',()=>{
 const h=ready();open(h);const d=h.d,f=d.foreign,at=h.s.civilization.elapsed;
 // Explicit transit microfixture, not an imported or natural history.
 const o={id:100,from:'north',to:'west',cargo:{parts:10},value:50,route:'auto',dueAt:at,arrivedAt:null};h.ctx.CivilServices.pay(d.nodes.north.stores,o.cargo);h.f.account(f,'north',50,at);h.f.account(f,'west',-50,at);const initial=clone(d.nodes.north.stores),accounts=balance(d);f.pairs['north-west'].phase='war';
 assert.equal(h.l.arrive(d,o,at),false);assert.equal(o.arrivedAt,null);assert.equal(h.l.arrive(d,o,at+300),false);assert.equal(h.l.arrive(d,o,at+600),false);assert.equal(o.returned,true);near(d.nodes.north.stores.parts,initial.parts+10);assert.equal(balance(d),accounts);const returned=clone(d.nodes.north.stores);assert.equal(h.l.arrive(d,o,at+900),false);assert.deepEqual(clone(d.nodes.north.stores),returned);
 assert.equal(h.l.arrive(d,{...o,route:'escort',arrivedAt:null},at),true);assert.equal(h.l.arrive(d,{...o,route:undefined,arrivedAt:null},at),true);
});
test('funded defense pact sends physical aid, while nonperformance breaks an actual obligation',()=>{
 for(const funded of [true,false]){
  const h=ready();open(h);assert.equal(h.l.act(h.s,'offer',{pair:'east-north',type:'defense'}),true);advance(h,610);const p=h.l.active(h.d,'east-north');assert.ok(p);h.l.data(h.d).pacts=[p];h.l.data(h.d).offers=[];
  // Counterfactual war fixtures isolate promise enforcement from war initiation.
  const f=h.d.foreign,at=h.s.civilization.elapsed;f.shipments.forEach(o=>o.arrivedAt??=at);f.pairs['north-west'].phase='war';f.pairs['north-west'].since=at;
  if(!funded)h.d.nodes.east.stores.food=82;
  const before=clone(h.d.nodes.east.stores),sum=balance(h.d);h.l.beforeRound(h.d,{at:at+300});
  if(funded){const aid=f.shipments.findLast(o=>o.aid);assert.ok(aid);assert.equal(aid.from,'east');assert.equal(aid.to,'north');near(h.d.nodes.east.stores.food,before.food-12-24-12);assert.equal(aid.value,0);assert.equal(aid.dueAt-aid.departedAt,600);assert.equal(balance(h.d),sum);}
  else{h.l.beforeRound(h.d,{at:at+600});assert.equal(p.status,'active');h.l.beforeRound(h.d,{at:at+900});assert.equal(p.status,'broken');assert.match(p.cause,/援助/);assert.equal(h.l.reputation(h.d,'east'),20);}
 }
});
test('workout is creditor consent with conserved interest claims and one request per debt cycle',()=>{
 const h=ready();open(h);assert.equal(h.l.act(h.s,'workout',{actor:'west'}),true);assert.equal(h.l.act(h.s,'workout',{actor:'west'}),false);advance(h,610);const o=h.l.data(h.d).workouts[0];assert.equal(o.accepted,true);assert.ok(o.fee>0);assert.equal(balance(h.d),0);assert.ok(h.l.data(h.d).extensions.west.until>o.resolvedAt);assert.equal(h.l.act(h.s,'workout',{actor:'west'}),false);h.w.validate(h.s);
});
test('bad reputation can reject debt workout, preserving debt and recording refusal',()=>{
 const h=ready();open(h);assert.equal(h.l.act(h.s,'workout',{actor:'west'}),true);const l=h.l.data(h.d);l.reputation.west=40;const before=h.d.foreign.actors.west.balance;h.l.beforeRound(h.d,{at:h.s.civilization.elapsed+300});assert.equal(l.workouts[0].accepted,false);assert.equal(h.d.foreign.actors.west.balance,before);assert.equal(l.extensions.west,undefined);
});
test('full adapter and forecast preserve league state without side effects, strict replay rejects forged terms',()=>{
 const h=ready();open(h);assert.equal(h.l.act(h.s,'offer',{pair:'east-north',type:'commerce'}),true);h.step(620,{checkEvery:0});h.roundtrip();const before=clone(h.s),messages=h.messages.length,copy=h.ctx.CivilForecast.copy(h.s);copy.civilization.elapsed=h.d.foreign.lastRoundAt+300;h.w.settle(copy);assert.deepEqual(clone(h.s),before);assert.equal(h.messages.length,messages);
 for(const edit of [s=>s.civilization.worldstage.foreign.leagues.pacts[0].paidCycles++,s=>s.civilization.worldstage.foreign.leagues.reputation.west=0,s=>s.civilization.worldstage.foreign.leagues.routes['east-west']={mode:'escort',at:s.civilization.elapsed},s=>s.civilization.worldstage.foreign.leagues.extensions.west={until:s.civilization.elapsed+9000},s=>s.civilization.worldstage.ledger.pop()]){const bad=clone(h.s);edit(bad);assert.throws(()=>h.w.validate(bad));}
});

test('a region strategically abandons an unaffordable export future, and occupation is not blamed as voluntary betrayal',()=>{
 for(const occupied of [false,true]){
  const h=ready();open(h);const at=h.s.civilization.elapsed,l=h.l.data(h.d),pair='east-north';
  // Declared decision boundary fixture, separate from natural provenance.
  const pact={id:1,pair,type:'commerce',status:'active',at:at-900,paidCycles:3,missed:{east:0,north:0},calls:[],notice:null,endedAt:null};l.pacts.push(pact);
  if(occupied)h.d.nodes.east.control='occupied';else{h.d.nodes.east.stores.medicine=0;h.d.foreign.actors.east.balance=-30;h.d.foreign.actors.east.debtSince=at-1800;h.d.foreign.actors.north.balance+=516;}
  h.l.beforeRound(h.d,{at});assert.equal(pact.status,'broken');assert.equal(h.l.reputation(h.d,'east'),occupied?0:20);if(!occupied)assert.match(pact.cause,/主动保留/);
 }
});
