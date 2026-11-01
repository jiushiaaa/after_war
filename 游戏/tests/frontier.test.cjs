const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows加盟中央贡献返城与治理恢复40.json'),'utf8')).state;
function create(s=raw){const h=harness(s);h.front=h.ctx.CivilFrontier;return h;}
let seen;
function discovered(){if(!seen){const h=create();assert.equal(h.front.dispatch(h.s,'scout'),true);h.until(()=>!h.front.active(h.s),500);h.roundtrip();seen=clone(h.s);}return create(seen);}
function expedition(){const h=discovered();h.s.game.workers.guard=4;h.until(()=>h.front.trained(h.s,4),500);assert.equal(h.front.dispatch(h.s,'expedition'),true);return h;}

test('legacy save remains exact; scouting uses real crew, paid original vehicle and conserved supplies',()=>{
 const h=create(),{s,front,ctx}=h;assert.deepEqual(clone(s),raw);h.roundtrip();
 const stores=clone(s.stores),population=ctx.CivilNation.population(s),orders=clone(s.civilization.commerce.orders);
 assert.equal(front.dispatch(s,'scout'),true);const m=front.active(s);
 for(const [k,v]of Object.entries(m.paid))near(s.stores[k],stores[k]-v);
 assert.equal(ctx.CivilCommerce.reservedTransport(s),2);assert.equal(front.guardFloor(s),2);assert.equal(front.node(s),undefined);
 h.step(90);const restored=h.roundtrip();h.until(()=>!!front.node(s),120);
 assert.equal(front.node(s).population,60);assert.equal(front.node(s).control,'independent');assert.equal(ctx.CivilNation.population(s),population);
 h.until(()=>!front.active(s),220);restored.until(()=>!restored.ctx.CivilFrontier.active(restored.s),400);assert.deepEqual(clone(restored.s),clone(s));
 assert.equal(m.arrivedAt-m.departedAt,180);assert.equal(m.returnedAt-m.arrivedAt,180);near(m.refunded.food,4);near(m.refunded.tools,.28);near(m.refunded.medicine,1);
 assert.deepEqual(clone(s.civilization.commerce.orders),orders);h.roundtrip();
});

test('peaceful signatures pay independent treasuries atomically and cannot skip local public works',()=>{
 const h=discovered(),{s,front,ctx}=h,n=front.node(s),pop=n.population,source=clone(n.cohorts),know=n.stores.knowledge;n.stores.knowledge=0;
 const failed=clone(s);assert.equal(front.agreement(s),false);assert.deepEqual(clone(s),failed);n.stores.knowledge=know;
 h.until(()=>ctx.CivilNation.operational(s),500);const before=clone([s.stores,n.stores]);assert.equal(front.agreement(s),true);
 near(s.stores.knowledge,before[0].knowledge-80);near(n.stores.knowledge,before[1].knowledge-20);assert.equal(n.population,pop);assert.deepEqual(clone(n.cohorts),source);
 assert.equal(front.defenders(s),0);assert.equal(front.dispatch(s,'expedition'),false);assert.equal(h.r.associate(s,'ford'),false);assert.equal(n.relation,'trade');h.roundtrip();
});

test('withdrawal returns along the distance actually travelled, not instantly; same vehicle cannot trade',()=>{
 const h=expedition(),{s,front,ctx}=h,m=front.active(s);h.step(37);
 assert.equal(ctx.CivilCommerce.schedule(s),true);assert.match(ctx.CivilCommerce.dispatchReason(s),/原商车/);ctx.CivilCommerce.cancel(s);
 assert.equal(front.choose(s,'withdraw'),true);assert.equal(m.returnedAt,null);h.step(36);assert.equal(m.returnedAt,null);h.step(1);
 assert.equal(m.returnedAt-m.choiceAt,37);assert.equal(m.battle,null);assert.equal(front.data(s).occupation,null);assert.equal(front.wounded(s),0);near(m.refunded.food,106);h.roundtrip();
});

test('four real guards pay 180 seconds of combat; casualties, reserved beds and returned treatment conserve people',()=>{
 const h=expedition(),{s,front,ctx}=h,m=front.active(s);h.until(()=>m.phase==='waiting',200);assert.equal(front.choose(s,'attack'),true);
 h.step(179);assert.equal(m.battle,null);const home=s.game.population,local=front.node(s).population,nation=ctx.CivilNation.population(s),beds=ctx.CivilUrban.availableBeds(s);
 h.step(1);assert.equal(m.battle.dead.length,1);assert.equal(m.battle.wounded.length,1);assert.equal(m.battle.localDead.length,1);
 assert.equal(s.game.population,home-2);assert.equal(front.node(s).population,local-1);assert.equal(front.wounded(s),1);assert.equal(ctx.CivilNation.population(s),nation-1);assert.equal(ctx.CivilUrban.availableBeds(s),beds+1);
 assert.equal(s.game.workers.guard,2);assert.equal(front.guardFloor(s),2);assert.equal(h.r.associate(s,'ford'),false);assert.equal(front.agreement(s),false);
 const loaded=h.roundtrip();h.until(()=>!front.active(s),200);assert.equal(front.data(s).patients[0].arrivedAt,m.returnedAt);assert.equal(front.wounded(s),1);
 h.until(()=>front.wounded(s)===0,150);loaded.until(()=>loaded.ctx.CivilFrontier.wounded(loaded.s)===0&&!loaded.ctx.CivilFrontier.active(loaded.s),400);assert.deepEqual(clone(loaded.s),clone(s));
 const p=front.data(s).patients[0];assert.equal(p.records.filter(r=>r.paid).length,12);assert.ok(p.recoveredAt-p.arrivedAt>=120);assert.equal(p.recovery,120);
 // A stationed pair cannot simultaneously escort a public convoy.
 s.game.workers.guard=4;h.until(()=>!ctx.CivilCommerce.agreementReason(s),1800);assert.equal(ctx.CivilCommerce.schedule(s),true,ctx.CivilCommerce.agreementReason(s));assert.equal(ctx.CivilCommerce.dispatch(s),true);ctx.CivilCommerce.cancel(s);
 const convoy=ctx.CivilCommerce.active(s);s.game.workers.guard=2;h.step(10);assert.equal(convoy.outboundSeconds,0);assert.equal(front.guardFloor(s),2);
 s.game.workers.guard=4;h.until(()=>!ctx.CivilCommerce.active(s),600);
 assert.equal(front.endOccupation(s),true);assert.equal(front.guardFloor(s),2);h.step(179);assert.equal(front.guardFloor(s),2);h.step(1);assert.equal(front.guardFloor(s),0);assert.equal(front.node(s).relation,'trade');assert.equal(h.r.associate(s,'ford'),false);h.roundtrip();
});

test('unanswered expedition returns after sixty real seconds; missing drivers preserve supplies',()=>{
 const h=expedition(),{s,front}=h,m=front.active(s);h.until(()=>m.phase==='waiting',200);
 const drivers=s.game.workers.transporter,buffer=clone(m.buffer);s.game.workers.transporter=0;h.step(20);assert.equal(m.waitingSeconds,0);assert.deepEqual(clone(m.buffer),buffer);s.game.workers.transporter=drivers;
 h.step(60);assert.equal(m.choice,'withdraw');h.until(()=>!front.active(s),200);assert.equal(m.battle,null);h.roundtrip();
});

test('edited route progress, refunds, phantom casualties and missing frontier proofs are rejected',()=>{
 const h=expedition(),{s,front}=h;h.step(30);const good=clone(s);
 for(const mutate of [s=>delete s.civilization.frontier,s=>s.civilization.frontier.missions[1].buffer.food++,s=>s.civilization.frontier.missions[1].guards=1,s=>s.civilization.frontier.missions[1].outboundSeconds=180,s=>s.civilization.frontier.missions[1].uses[0].cost.food=0,s=>s.civilization.frontier.peace={at:s.civilization.elapsed,kind:'peace',costs:{}}]){const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});

test('postwar shortage withdraws on foot; repair deliveries, local consent and 600 seconds still precede citizenship',()=>{
 const h=expedition(),{s,front,ctx}=h,m=front.active(s);h.until(()=>m.phase==='waiting',200);front.choose(s,'attack');h.until(()=>!!m.battle,200);h.until(()=>!front.active(s),200);
 // Synthetic job shortage; no natural claim. Actual ward care and two survivor cohorts remain.
 s.game.workers.guard=0;h.until(()=>front.data(s).occupation.retreatAt!==null,80);const o=front.data(s).occupation;assert.equal(o.reason,'supply');assert.equal(front.guardFloor(s),2);h.until(()=>o.endedAt!==null,200);assert.equal(o.endedAt-o.retreatAt,180);
 assert.equal(h.r.associate(s,'ford'),false);assert.equal(front.agreement(s),false);assert.equal(h.r.setRoute(s,'ford',true),true);
 h.until(()=>front.node(s).trust>=60&&s.civilization.regions.routes.ford.completedTrips>=3,6200);
 assert.equal(h.r.startProject(s,'ford'),true);const p=s.civilization.regions.projects.ford;h.until(()=>p.status==='complete',2200);assert.ok(front.node(s).completedProjects.publicWorks);assert.equal(h.r.associate(s,'ford'),false);
 h.until(()=>ctx.CivilNation.operational(s),2000);const before=clone([s.stores,front.node(s).stores]);assert.equal(front.agreement(s),true);near(s.stores.knowledge,before[0].knowledge-120);near(front.node(s).stores.knowledge,before[1].knowledge-20);
 assert.equal(h.r.associate(s,'ford'),true);const nation=ctx.CivilNation.population(s);h.step(599);assert.equal(front.node(s).relation,'associated');h.until(()=>front.node(s).relation==='integrated',900);assert.ok(ctx.CivilNation.population(s)>nation);h.roundtrip();
 assert.ok(ctx.CivilHistory.snapshot(s).entries.some(e=>e.key==='ford_battle_2'));
});
