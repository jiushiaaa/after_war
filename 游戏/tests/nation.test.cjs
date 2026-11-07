const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {ready,harness,clone,near}=require('./helpers/metro-fixture.cjs');

// Explicit synthetic city fixture. None of these accelerated ticks are natural UI evidence.
let citySnapshot;
function city(){
  if(!citySnapshot){const h=ready();h.until(()=>h.metro.canRegister(h.s));h.click('register');h.ctx.CivilPlatform.validate(h.s);citySnapshot=clone(h.s);}
  const h=harness(citySnapshot);h.n=h.ctx.CivilNation;return h;
}
function draft(mode='local',charter='constitution'){
  const h=city();h.s.civilization.society.axes.devolution=mode;h.s.civilization.society.axes.charter=charter;
  // The prebuilt synthetic cities keep growing during this longer scenario.
  // Staff their already-declared home facilities, using existing adult labour.
  for(const job of ['farmer','pharmacist','teacher'])h.s.game.workers[job]=h.ctx.CivilCatalog.jobCapacity(h.s,job);
  h.s.civilization.pending='nationCharter';h.ctx.Civilization.showPending();h.click('propose');
  assert.ok(h.s.civilization.nation);
  for(const id of h.s.civilization.nation.members.slice(1)){
    h.s.civilization.pending='nationCharter';h.ctx.Civilization.showPending();h.click('approve_'+id);assert.ok(h.s.civilization.nation.approvals[id]);
  }
  return h;
}
function founded(mode='local',charter='constitution'){
  const h=draft(mode,charter);h.until(()=>h.n.canFound(h.s),3600);assert.equal(h.n.found(h.s),true);h.ctx.CivilPlatform.validate(h.s);return h;
}

test('early and legacy natural saves do not gain nation data or bypass the metropolis',()=>{
  const h=harness(),n=h.ctx.CivilNation,before=clone(h.s);
  assert.equal(n.available(h.s),false);assert.equal(n.propose(h.s),false);assert.equal(n.found(h.s),false);
  assert.deepEqual(clone(h.s),before);h.roundtrip();
  h.s.civilization.pending='nationCharter';assert.throws(()=>h.ctx.CivilPlatform.validate(h.s),/国家/);
});

test('Windows natural metropolitan export validates unchanged and may reopen an unpaid charter',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows城市群正式登记03.json'),'utf8')).state;
  const h=harness(raw);assert.equal(h.ctx.CivilNation.available(h.s),true);assert.equal(h.s.civilization.nation,undefined);
  assert.deepEqual(clone(h.s),raw);h.s.civilization.pending='nationCharter';h.roundtrip();
});

test('each city consents once and pays only its own real warehouse; insufficient funds are atomic',()=>{
  const h=city(),{s,n}=h;const before=clone(s);
  assert.equal(n.propose(s),true);for(const [key,value]of Object.entries(n.approvalCost('home')))near(s.stores[key],before.stores[key]-value);
  for(const id of s.civilization.nation.members.slice(1))assert.deepEqual(clone(n.stores(s,id)),before.civilization.regions.nodes[id].stores);
  const id=s.civilization.nation.members[1],old=n.stores(s,id).knowledge;n.stores(s,id).knowledge=0;
  const failed=clone(s);assert.equal(n.approve(s,id),false);assert.deepEqual(clone(s),failed);n.stores(s,id).knowledge=old;
  assert.equal(n.approve(s,id),true);const approved=clone(s);assert.equal(n.approve(s,id),false);assert.equal(n.propose(s),false);assert.deepEqual(clone(s),approved);
  assert.equal(n.found(s),false);h.roundtrip();
});

test('both existing devolution choices charge distinct budgets, retain reserves and never double settle',()=>{
  for(const mode of ['central','local']){
    const h=draft(mode),{s,n}=h,costs=clone(n.costs(s)),before=Object.fromEntries(s.civilization.nation.members.map(id=>[id,clone(n.stores(s,id))]));
    n.settle(s);for(const [id,cost]of Object.entries(costs))for(const [key,value]of Object.entries(cost))near(n.stores(s,id)[key],before[id][key]-value);
    const once=clone(s);n.settle(s);assert.deepEqual(clone(s),once);
    n.observe(s);h.ctx.CivilPlatform.validate(s);
    assert.equal(costs.home.knowledge,mode==='central'?.4:.2);
    assert.equal(costs[s.civilization.nation.members[1]].wood,mode==='central'?undefined:.4);
  }
});

test('national founding requires a new paid continuous 600 seconds and persists through normal save reload',()=>{
  const h=draft(),{s,n}=h,start=s.civilization.elapsed;assert.equal(n.found(s),false);
  h.until(()=>n.canFound(s),2400);assert.ok(s.civilization.elapsed-start>=600);assert.ok(s.civilization.nation.records.length>=61);
  assert.equal(n.found(s),true);const at=s.civilization.nation.foundedAt,before=clone(s);assert.equal(n.found(s),false);assert.deepEqual(clone(s),before);
  const loaded=h.roundtrip();assert.equal(loaded.s.civilization.nation.foundedAt,at);assert.ok(loaded.ctx.CivilNation.operational(loaded.s));
  const base=loaded.ctx.CivilRegions.capacity(loaded.s);loaded.s.civilization.nation.legitimacy=0;assert.equal(base-loaded.ctx.CivilRegions.capacity(loaded.s),4);
  assert.match(loaded.ctx.CivilNation.status(loaded.s),/经费与供养已恢复.*40/);
  assert.ok(h.ctx.CivilHistory.snapshot(s).entries.some(e=>e.key==='nation_founded'));
});

test('a missed local fee spends nothing elsewhere, suspends authority and can recover without erasing state',()=>{
  const h=founded(),{s,n}=h,at=s.civilization.nation.foundedAt,id=s.civilization.nation.members[1];
  // Deliberate synthetic outage; this is not a natural save or player action.
  const settle=n.settle;let intercepted=false;
  n.settle=function(state){
    if(state!==s||intercepted)return settle.call(this,state);
    const local=this.stores(s,id),saved=local.knowledge;local.knowledge=0;
    const stores=Object.fromEntries(s.civilization.nation.members.map(id=>[id,clone(this.stores(s,id))]));
    const result=settle.call(this,state);intercepted=true;
    assert.deepEqual(Object.fromEntries(s.civilization.nation.members.map(id=>[id,clone(this.stores(s,id))])),stores);
    assert.equal(n.operational(s),false);local.knowledge=saved;return result;
  };
  h.step(10);n.settle=settle;assert.ok(intercepted);
  assert.equal(n.operational(s),false);assert.equal(s.civilization.nation.foundedAt,at);assert.equal(s.civilization.nation.stableSeconds,0);
  assert.equal(s.civilization.nation.legitimacy,59);
  h.until(()=>n.operational(s),2400);assert.equal(s.civilization.nation.foundedAt,at);assert.ok(s.civilization.nation.legitimacy>59);h.roundtrip();
});

test('nation survives a real succession and legal devolution reform changes only future invoices',()=>{
  const h=founded('central'),{s,n}=h,at=s.civilization.nation.foundedAt,records=clone(s.civilization.nation.records),assets=clone(s.game.buildings),generation=s.civilization.society.generation;
  h.until(()=>s.civilization.society.generation>generation,6000);
  assert.equal(s.civilization.nation.foundedAt,at);assert.deepEqual(clone(s.game.buildings),assets);assert.deepEqual(clone(s.civilization.nation.records.slice(0,records.length)),records);
  const knowledge=s.stores.knowledge;assert.equal(h.ctx.CivilSociety.beginReform(s,'devolution'),true);near(s.stores.knowledge,knowledge-60);
  h.ctx.Civilization.showPending();h.step(10,{choose:false});assert.match(n.status(s),/先完成眼下的换届交接、变法或互助公示/);
  h.click('local');assert.equal(s.civilization.society.axes.devolution,'local');
  h.step(20);assert.equal(s.civilization.nation.records.at(-1).mode,'local');h.roundtrip();
});

test('forged founding, missing payments, duplicate rounds and malformed nation state are rejected',()=>{
  const h=founded(),good=clone(h.s);
  for(const mutate of [s=>s.civilization.nation=null,s=>s.civilization.nation.approvals.home.cost.tools=0,s=>s.civilization.nation.records.push(clone(s.civilization.nation.records.at(-1))),s=>s.civilization.nation.foundedAt=s.civilization.nation.proposedAt,s=>s.civilization.nation.records[0].costs={},s=>s.civilization.nation.legitimacy=999]){
    const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
  }
  h.ctx.CivilPlatform.validate(good);
});

test('customary national budgets trade written knowledge for real supplies in both devolution modes',()=>{
  for(const mode of ['central','local']){
    const h=draft(mode,'custom'),{s,n}=h,costs=clone(n.costs(s));
    const before=Object.fromEntries(s.civilization.nation.members.map(id=>[id,clone(n.stores(s,id))]));
    n.settle(s);assert.equal(s.civilization.nation.records.at(-1).charter,'custom');
    for(const [id,cost]of Object.entries(costs))for(const [key,value]of Object.entries(cost))near(n.stores(s,id)[key],before[id][key]-value);
    assert.equal(costs.home.knowledge,mode==='central'?.1:.05);
    assert.equal(costs[s.civilization.nation.members[1]].wood,mode==='central'?.2:.8);
    const once=clone(s);n.settle(s);assert.deepEqual(clone(s),once);n.observe(s);h.roundtrip();
  }
});

test('charter choices disclose paid national consequences only after the metropolis unlocks',()=>{
  const early=harness(),done=()=>()=>{};
  assert.equal(early.ctx.CivilSociety.event('constitution_charter',done).text.some(t=>t.includes('国家职责')),false);
  const h=city(),event=h.ctx.CivilSociety.event('constitution_charter',done);
  assert.equal(event.text.filter(t=>t.includes('国家职责')).length,2);
  assert.ok(event.text.some(t=>t.includes('连续筹备900秒')&&t.includes('正常运转时协调 +2')));
  assert.ok(event.text.some(t=>t.includes('连续筹备600秒')&&t.includes('正常运转时协调 +4')));
});

test('customary founding needs 900 paid seconds, preserves its founding law and has a smaller coordination bonus',()=>{
  const h=draft('local','custom'),{s,n}=h;
  h.until(()=>s.civilization.nation.stableSeconds>=600,3600);assert.equal(n.canFound(s),false);
  h.until(()=>n.canFound(s),3600);assert.equal(s.civilization.nation.stableSeconds,900);assert.equal(n.found(s),true);
  assert.equal(s.civilization.nation.foundingAxes.charter,'custom');assert.equal(n.capacityBonus(s),2);
  h.step(10);assert.equal(s.civilization.nation.legitimacy,60.125);h.roundtrip();
  assert.match(h.ctx.CivilHistory.snapshot(s).entries.find(e=>e.key==='nation_founded').title,/惯例/);
  const good=clone(s);
  for(const mutate of [x=>x.civilization.nation.foundingAxes.charter='constitution',x=>delete x.civilization.nation.records[0].charter,x=>x.civilization.nation.records.at(-1).charter='unknown',x=>x.civilization.nation.legitimacy+=.125]){
    const bad=clone(good);mutate(bad);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));
  }
});

test('changing a draft charter cannot reuse the previous continuous founding run',()=>{
  const h=draft(),{s,n}=h;h.until(()=>n.canFound(s),3600);
  const approvals=clone(s.civilization.nation.approvals);
  assert.equal(h.ctx.CivilSociety.beginReform(s,'charter'),true);h.ctx.Civilization.showPending();h.click('custom');
  assert.equal(n.canFound(s),false);h.step(10);assert.equal(s.civilization.nation.stableSeconds,0);
  assert.deepEqual(clone(s.civilization.nation.approvals),approvals);
  h.until(()=>n.canFound(s),3600);assert.equal(s.civilization.nation.stableSeconds,900);assert.equal(n.found(s),true);h.roundtrip();
});

test('customary missed fees remain atomic and lose 1.25 legitimacy before paid recovery',()=>{
  const h=founded('central','custom'),{s,n}=h,id=s.civilization.nation.members[1];
  assert.equal(n.capacityBonus(s),1);
  const settle=n.settle;let intercepted=false;
  n.settle=function(state){
    if(state!==s||intercepted)return settle.call(this,state);
    const local=this.stores(s,id),saved=local.knowledge;local.knowledge=0;
    const before=Object.fromEntries(s.civilization.nation.members.map(member=>[member,clone(this.stores(s,member))]));
    const result=settle.call(this,state);intercepted=true;
    assert.deepEqual(Object.fromEntries(s.civilization.nation.members.map(member=>[member,clone(this.stores(s,member))])),before);
    assert.equal(n.operational(s),false);local.knowledge=saved;return result;
  };
  h.step(10);n.settle=settle;assert.ok(intercepted);assert.equal(s.civilization.nation.legitimacy,58.75);
  h.until(()=>n.operational(s),3600);assert.equal(s.civilization.nation.legitimacy,58.875);h.roundtrip();
});

test('unaltered railway save can pay for charter reform without rewriting its historic invoices or assets',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../验证/存档/自然游玩_Windows铁路货车往返切换17.json'),'utf8')).state;
  const h=harness(raw),{s,ctx}=h,n=ctx.CivilNation;h.roundtrip();assert.deepEqual(clone(s),raw);
  const records=clone(s.civilization.nation.records),founding=clone(s.civilization.nation.foundingAxes),buildings=clone(s.civilization.services.nodes.rail.buildings);
  assert.equal(records.at(-1).charter,undefined);
  const knowledge=s.stores.knowledge;assert.equal(ctx.CivilSociety.beginReform(s,'charter'),true);near(s.stores.knowledge,knowledge-60);
  ctx.Civilization.showPending();h.click('custom');assert.equal(n.operational(s),false);assert.equal(n.capacityBonus(s),0);
  h.until(()=>n.operational(s),3600);assert.equal(s.civilization.nation.records.at(-1).charter,'custom');assert.equal(n.capacityBonus(s),2);
  assert.deepEqual(clone(s.civilization.nation.records.slice(0,records.length)),records);assert.deepEqual(clone(s.civilization.nation.foundingAxes),founding);
  assert.deepEqual(clone(s.civilization.services.nodes.rail.buildings),buildings);h.roundtrip();
});
