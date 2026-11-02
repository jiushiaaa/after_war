const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const raw=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Mac八区统一与无人首航通关124.json'))).data,'base64'))).state;
function ready(){const h=harness(raw);h.w=h.ctx.CivilWorld;h.sc=h.ctx.CivilStatecraft;h.d=h.w.data(h.s);h.w.political=()=>true;return h;}
// Isolated national-clock rule tests, NOT natural play. Unrelated town production
// is deliberately excluded so every material debit can be checked exactly.
// Administrative availability is fixed true here; full adapter integration is tested separately.
function advance(h,seconds){for(let i=0;i<seconds;i++){h.s.civilization.elapsed++;h.w.tick(h.s);h.w.settle(h.s);}h.w.validate(h.s);}
function accord(h,id='north',choice=0){assert.equal(h.sc.sign(h.s,id,choice),true,h.sc.accordReason(h.s,id,choice));advance(h,60);}
function start(h,id,kind,doctrine){assert.equal(h.w.start(h.s,id,kind,doctrine),true,h.w.reason(h.s,id,kind,doctrine));return h.w.active(h.s);}
function finish(h){const m=h.w.active(h.s);advance(h,m.duration*2+h.w.missionConfig(m).work-m.progress);return m;}

test('124 original save remains unchanged and readable; early stages expose no new actions',()=>{
 const h=ready();assert.equal(h.d.economy,undefined);assert.ok(Object.values(h.d.nodes).every(n=>!n.accord));h.roundtrip();
 const early=harness();assert.equal(early.ctx.CivilWorld.start(early.s,'north','credit'),false);assert.equal(early.ctx.CivilStatecraft.setPolicy(early.s,'market'),false);assert.equal(early.ctx.CivilStatecraft.sign(early.s,'north',0),false);
});
test('all eight regions offer unique real-cost choices, one grant per compact; no side effects when refused',()=>{
 const h=ready(),names=new Set();
 for(const[id,r]of Object.entries(h.ctx.CivilStatecraftContent.regions)){
   for(const c of r.choices){assert.ok(!names.has(c.name));names.add(c.name);assert.notDeepEqual(clone(c.cost),{});assert.notDeepEqual(clone(c.upkeep),{});}
   const before=clone(h.s.stores),cost=r.choices[0].cost;assert.equal(h.sc.sign(h.s,id,0),true,h.sc.accordReason(h.s,id,0));
   for(const[k,v]of Object.entries(cost))near(h.s.stores[k],before[k]-v);
   const signed=clone(h.s);assert.equal(h.sc.sign(h.s,id,1),false);assert.deepEqual(clone(h.s),signed);
 }
 h.w.validate(h.s);h.roundtrip();
});
test('political pledges and real upkeep affect regional stability without silently changing institutions',()=>{
 const h=ready();accord(h,'east');const n=h.d.nodes.east;assert.equal(n.accord.paidCycles,6);
 h.s.civilization.regions.rights='resident';advance(h,60);assert.equal(n.accord.missed,60);assert.equal(n.trust,90);assert.equal(n.stableSeconds,0);assert.match(h.sc.reason(h.s,'east','exchange'),/承诺/);
 h.s.civilization.regions.rights='equal';advance(h,600);assert.equal(n.accord.missed,0);assert.equal(n.stableSeconds,600);
 const before=clone(h.s.stores);assert.equal(h.sc.renew(h.s,'east'),true);near(h.s.stores.knowledge,before.knowledge-80);assert.equal(n.trust,100);assert.equal(h.sc.renew(h.s,'east'),false);h.w.validate(h.s);
});
test('paid economic policy changes future quotes and upkeep; original contract and debt terms are frozen',()=>{
 const h=ready();accord(h);const old=clone(h.sc.config(h.sc.quote(h.s,'north','exchange')));
 assert.equal(h.sc.setPolicy(h.s,'planned'),true);assert.equal(h.sc.config(h.sc.quote(h.s,'north','exchange')).cargo.coal,32);assert.equal(h.sc.setPolicy(h.s,'market'),false);
 const m=start(h,'north','exchange');assert.equal(m.paid.coal,32);assert.equal(h.sc.setPolicy(h.s,'market'),false);finish(h);advance(h,600);
 assert.equal(h.sc.setPolicy(h.s,'market'),true);assert.equal(h.sc.config(m).cargo.coal,32);assert.equal(h.sc.config(h.sc.quote(h.s,'north','exchange')).receive.parts,25);assert.equal(old.receive.parts,20);h.w.validate(h.s);
});
test('trade escrows both inventories, delivers only on return and recalls without duplicating cargo',()=>{
 const h=ready();accord(h);let n=h.d.nodes.north,before=clone([h.s.stores,n.stores]),m=start(h,'north','exchange');
 near(h.s.stores.coal,before[0].coal-40);near(h.s.stores.parts,before[0].parts-4);near(n.stores.parts,before[1].parts-20);assert.equal(h.w.start(h.s,'east','contact'),false);h.w.validate(h.s);
 advance(h,30);assert.equal(h.w.recall(h.s),true);advance(h,30);assert.deepEqual(clone(m.returnCargo),{});assert.equal(m.completedAt,null);near(h.s.stores.coal,before[0].coal-6*.2);
 // Cancelled local escrow is restored; the normal local budget adds its own income.
 assert.match(h.sc.reason(h.s,'north','exchange'),/600/);advance(h,540);m=start(h,'north','exchange');
 const part=h.s.stores.parts;advance(h,m.duration+h.w.missionConfig(m).work);assert.equal(m.returnedAt,null);assert.ok(h.s.stores.parts<part);assert.deepEqual(clone(m.returnCargo),{parts:20});
 finish(h);assert.deepEqual(clone(m.returnCargo),{});assert.equal(m.returnedAt,h.s.civilization.elapsed);h.w.validate(h.s);
});
test('credit physically reserves principal, carries collateral, repays with fixed interest and returns collateral',()=>{
 const h=ready();accord(h);const n=h.d.nodes.north,before=clone(n.stores),m=start(h,'north','credit');near(n.stores.parts,before.parts-80);assert.equal(n.credit,undefined);assert.equal(m.cargo.tools,40);
 finish(h);assert.equal(n.credit.status,'open');assert.equal(n.credit.collateral,40);assert.equal(n.credit.dueAt,m.completedAt+1800);assert.equal(h.w.start(h.s,'north','credit'),false);
 advance(h,600);assert.equal(h.sc.setPolicy(h.s,'market'),true);const repay=start(h,'north','repay');assert.equal(repay.economy,'mixed');assert.equal(repay.cargo.parts,88);assert.equal(n.credit.status,'repaying');assert.equal(n.credit.collateral,0);
 const tools=h.s.stores.tools;finish(h);assert.equal(n.credit.status,'repaid');assert.deepEqual(clone(repay.returnCargo),{});assert.ok(h.s.stores.tools>tools+35);assert.equal(h.w.start(h.s,'north','credit'),false);h.w.validate(h.s);
});
test('overdue credit forfeits collateral once, blocks trade and service; repayment never erases history',()=>{
 const h=ready();accord(h);finishAfterStart();function finishAfterStart(){start(h,'north','credit');finish(h);}
 const n=h.d.nodes.north,due=n.credit.dueAt;advance(h,due-h.s.civilization.elapsed+10);assert.equal(n.credit.status,'default');assert.equal(n.credit.collateral,0);assert.equal(n.trust,80);assert.equal(n.stableSeconds,0);assert.match(h.w.reason(h.s,'north','exchange'),/违约/);
 const defaultedAt=n.credit.defaultedAt;assert.ok(defaultedAt>=due);const m=start(h,'north','repay');assert.equal(m.forfeited,true);assert.deepEqual(clone(m.returnCargo),{});advance(h,20);assert.equal(n.stableSeconds,0);finish(h);assert.equal(n.credit.status,'repaid');assert.equal(n.credit.defaultedAt,defaultedAt);assert.equal(n.trust,90);assert.ok(h.d.missions.some(x=>x.kind==='credit'));h.w.validate(h.s);
});
test('recalling credit and repayment restores the exact local escrow and obligation',()=>{
 const h=ready();accord(h);let m=start(h,'north','credit');advance(h,40);h.w.recall(h.s);advance(h,40);assert.equal(h.d.nodes.north.credit,undefined);assert.deepEqual(clone(m.returnCargo),{});
 start(h,'north','credit');finish(h);const loan=clone(h.d.nodes.north.credit);m=start(h,'north','repay');advance(h,40);h.w.recall(h.s);advance(h,40);assert.deepEqual(clone(h.d.nodes.north.credit),loan);assert.equal(m.completedAt,null);h.w.validate(h.s);
});
test('ledger replay rejects forged price, collateral, duplicate dispatch/return, due date and policy state',()=>{
 const h=ready();accord(h);start(h,'north','credit');finish(h);const saved=clone(h.s),last=s=>s.civilization.worldstage;
 const mutations=[s=>last(s).economy={mode:'market',changedAt:s.civilization.elapsed},s=>last(s).nodes.north.credit.dueAt++,s=>last(s).nodes.north.credit.collateral++,s=>last(s).missions.at(-1).paid.tools--,s=>last(s).missions.at(-1).returnCargo.parts=80,s=>{const d=last(s),i=d.ledger.findIndex(r=>r.action==='dispatch');d.ledger.splice(i,0,clone(d.ledger[i]));},s=>{const d=last(s),i=d.ledger.findIndex(r=>r.action==='return');d.ledger.splice(i,0,clone(d.ledger[i]));},s=>{const d=last(s);d.ledger=d.ledger.filter(r=>r.action!=='dispatch');}];
 for(const mutate of mutations){const bad=clone(saved);mutate(bad);assert.throws(()=>h.w.validate(bad));}
});
test('alternative war doctrines price distinct time, lives, damage and external trust; ceasefire is not accession',()=>{
 for(const [doctrine,cfg]of Object.entries(ready().ctx.CivilStatecraftContent.doctrines)){
   const h=ready(),d=h.d,n=d.nodes.north; // Declared synthetic pre-accession branch of the rules only.
   // Use reducer in isolation: the natural 124 membership history is never edited or exported.
   const local={nodes:{north:h.w.seed('north',0),east:h.w.seed('east',0)},missions:[{id:1,region:'north',kind:'campaign',doctrine}]};
   const east=local.nodes.east.trust;h.w.apply(local,{kind:'mission',mission:1,at:1000});assert.equal(local.nodes.north.casualties,cfg.casualties);assert.equal(local.nodes.north.infrastructure,cfg.infrastructure);assert.equal(local.nodes.north.joinedAt,null);assert.equal(local.nodes.east.trust,east-cfg.external);
   assert.ok(cfg.work>h.ctx.CivilWorldContent.missions.campaign.work);assert.ok(cfg.cost.robots>0);assert.equal(local.nodes.north.control,'occupied');
 }
});


test('full adapter runs compact, trade and loan repayment across real budget clocks and a strict reload',()=>{
 const h=harness(raw),w=h.ctx.CivilWorld,sc=h.ctx.CivilStatecraft,s=h.s;
 assert.equal(sc.sign(s,'north',0),true);h.step(70,{checkEvery:0});assert.ok(w.data(s).nodes.north.accord.paidCycles>=6);
 for(const kind of ['exchange','credit','repay']){
   assert.equal(w.start(s,'north',kind),true,w.reason(s,'north',kind));
   const m=w.active(s);h.step(m.duration*2+w.missionConfig(m).work,{checkEvery:0});assert.ok(m.returnedAt!==null);h.roundtrip();
 }
 assert.equal(w.data(s).nodes.north.credit.status,'repaid');
});
test('both alternative doctrines execute paid outbound, occupation and rebuild with replayable timing',()=>{
 const input=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Mac北陆国家接纳与机器人量产115.json'))).data,'base64'))).state;
 for(const doctrine of ['evacuation','blockade']){
   const h=harness(input);h.w=h.ctx.CivilWorld;h.sc=h.ctx.CivilStatecraft;h.d=h.w.data(h.s);h.w.political=()=>true;
   start(h,'west','contact');finish(h);const before=clone(h.s.stores),cfg=h.ctx.CivilStatecraftContent.doctrines[doctrine];
   const m=start(h,'west','campaign',doctrine);for(const[k,v]of Object.entries(cfg.cost))near(h.s.stores[k],before[k]-v);
   finish(h);let n=h.d.nodes.west;assert.equal(n.casualties,cfg.casualties);assert.equal(n.infrastructure,cfg.infrastructure);assert.equal(n.control,'occupied');assert.equal(n.joinedAt,null);
   while(n.infrastructure<100){start(h,'west','rebuild');finish(h);}
   assert.equal(h.w.start(h.s,'west','campaign',doctrine),false);assert.equal(n.control,'independent');h.w.validate(h.s);
   const bad=clone(h.s);bad.civilization.worldstage.missions[m.id-1].doctrine=doctrine==='evacuation'?'blockade':'evacuation';assert.throws(()=>h.w.validate(bad));
 }
});


test('alternate accords are real choices; absent consent, unknown policy and insufficient local funds refuse without mutation',()=>{
 const h=ready();for(const id of Object.keys(h.ctx.CivilStatecraftContent.regions))assert.equal(h.sc.sign(h.s,id,1),true);h.w.validate(h.s);
 const other=ready();other.s.civilization.regions.rights='resident';const before=clone(other.s);assert.equal(other.sc.sign(other.s,'east',0),false);assert.deepEqual(clone(other.s),before);
 assert.equal(other.sc.setPolicy(other.s,'toString'),false);assert.deepEqual(clone(other.s),before);
 accord(other);other.d.nodes.north.stores.parts=0;const poor=clone(other.s);assert.equal(other.w.start(other.s,'north','credit'),false);assert.deepEqual(clone(other.s),poor);
});


test('forecast computes compact arrears and credit default silently without changing live treasuries or history',()=>{
 const h=ready();accord(h,'east');h.s.civilization.regions.rights='resident';advance(h,50);
 const before=clone(h.s),messages=h.messages.length,copy=h.ctx.CivilForecast.copy(h.s);copy.civilization.elapsed+=10;
 h.w.settle(copy);assert.equal(copy.civilization.worldstage.nodes.east.accord.missed,60);assert.equal(h.messages.length,messages);assert.deepEqual(clone(h.s),before);
 const creditCopy=h.ctx.CivilForecast.copy(h.s);creditCopy.civilization.elapsed+=10;
 // Declared forecast-only pending credit input, never exported or applied live.
 creditCopy.civilization.worldstage.nodes.east.credit={status:'open',dueAt:creditCopy.civilization.elapsed,collateral:40};
 h.w.settle(creditCopy);assert.equal(creditCopy.civilization.worldstage.nodes.east.credit.status,'default');assert.equal(h.messages.length,messages);assert.deepEqual(clone(h.s),before);
});

test('a region-specific compact replaces repeated aid on the actual pre-accession route',()=>{
 const input=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Mac北陆国家接纳与机器人量产115.json'))).data,'base64'))).state;
 const h=harness(input);h.w=h.ctx.CivilWorld;h.sc=h.ctx.CivilStatecraft;h.d=h.w.data(h.s);h.w.political=()=>true;
 start(h,'west','contact');finish(h);assert.equal(h.d.nodes.west.trust,20);
 assert.equal(h.sc.sign(h.s,'west',0),true,h.sc.accordReason(h.s,'west',0));assert.equal(h.d.nodes.west.trust,60);
 advance(h,600);assert.equal(h.w.join(h.s,'west'),true,h.w.joinReason(h.s,'west'));assert.equal(h.d.nodes.west.control,'member');
 assert.equal(h.d.missions.filter(m=>m.region==='west'&&m.kind==='negotiate').length,0);h.w.validate(h.s);
});
