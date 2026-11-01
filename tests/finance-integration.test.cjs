const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,label='quantity')=>assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);
const exact=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-two-towns.json'),'utf8')).state;
const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));

function emptyMetro(at){return {schema:1,introducedAt:at,agreementId:null,members:[],samples:[],lastObservedAt:null,stableSince:null,stableSeconds:0,formedAt:null,formedAgreementId:null,formedMembers:[],formedStableSince:null,offered:false};}

// Headless integration, not browser play: the exact exported residents, cargo,
// stocks, jobs and facilities are the only initial assets. No economic owner is
// stubbed. Presentation methods are inert and normal random events use a fixed
// harmless draw. The actual adapter advances every demographic and work clock.
function harness(saved=exact){
  const s=clone(saved),messages=[],events=[],settlements=[];let active=null,saves=0,ctx;
  const get=key=>key.split('.').reduce((v,k)=>v?.[k],s);
  const set=(key,value)=>{const parts=key.split('.'),last=parts.pop();let node=s;for(const part of parts)node=node[part]||(node[part]={});node[last]=value;};
  const nativeEvents={activeEvent:()=>active,activeScene:'start',loadScene(){},startEvent(event){active=event;events.push({at:s.civilization.elapsed,pending:s.civilization.pending,title:event.title});},endEvent(){active=null;},buttonClick(button){const info=active?.scenes.start.buttons[button.attr('id')];if(!info)return;if(info.cost&&!ctx.CivilRules.pay(s,info.cost))return;if(info.onChoose)info.onChoose();if(info.nextScene==='end')nativeEvents.endEvent();}};
  ctx=vm.createContext({State:s,_:x=>x,TextEncoder,TextDecoder,setTimeout:fn=>{fn();return 0;},clearTimeout(){},Math:Object.assign(Object.create(Math),{random:()=>.9}),
    Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){},killVillagers(n){s.game.population-=n;}},Events:nativeEvents,
    $SM:{get:(key,zero)=>get(key)??(zero?0:undefined),set,add:(key,n)=>set(key,(get(key)||0)+n),fireUpdate(){}},AudioEngine:{},Engine:{saveGame(){saves++;}},Notifications:{printMessage:text=>messages.push(text)}});
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Outside.updateWorkersView=()=>{};
  ctx.Civilization.initState();
  const settle=ctx.Civilization.settleEconomy.bind(ctx.Civilization);
  ctx.Civilization.settleEconomy=state=>{
    const result=settle(state);
    if(state===s)settlements.push({at:s.civilization.elapsed,flow:clone(result.flow),home:clone(s.civilization.urban.economy),nodes:Object.fromEntries(Object.entries(s.civilization.municipal.nodes).map(([id,n])=>[id,clone(n.economy)]))});
    return result;
  };
  const h={s,ctx,f:ctx.CivilFinance,r:ctx.CivilRegions,messages,events,settlements,get active(){return active;},get saves(){return saves;},
    click(key){assert.ok(active?.scenes.start.buttons[key],`native event button ${key}`);ctx.Events.buttonClick({attr:()=>key});},
    chooseRoutine(){if(!active)return;const pending=s.civilization.pending;if(pending==='succession'){this.click(Object.hasOwn(active.scenes.start.buttons,'engineer')?'engineer':Object.keys(active.scenes.start.buttons)[0]);return;}if(pending==='cold'){this.click('wood');return;}throw Error('unexpected event '+pending);},
    step(seconds,{choose=true,checkEvery=60}={}){for(let i=0;i<seconds;i++){ctx.Civilization.tick();if(choose)this.chooseRoutine();if(checkEvery&&s.civilization.elapsed%checkEvery===0)ctx.CivilPlatform.validate(s);}},
    until(predicate,limit=1200){for(let i=0;i<limit&&!predicate();i++)this.step(1);assert.ok(predicate(),`condition not reached within ${limit} seconds`);},
    roundtrip(){ctx.CivilPlatform.validate(s);const copy=ctx.CivilPlatform.decode(JSON.stringify({format:'postwar-civilization',version:1,state:s}));assert.deepEqual(clone(copy),clone(s));const reloaded=harness(copy);assert.deepEqual(clone(reloaded.s),clone(s));reloaded.ctx.CivilPlatform.validate(reloaded.s);return reloaded;},
    approve(){s.civilization.pending='financeOffer';ctx.Civilization.showPending();const key=Object.keys(active.scenes.start.buttons).find(key=>key==='agree_river_rail'||key==='agree_rail_river');assert.ok(key);this.click(key);assert.ok(this.f.agreement(s));ctx.CivilPlatform.validate(s);return this;},
    ledger(action){assert.equal(active,null);s.civilization.pending='financeLedger';ctx.Civilization.showPending();this.click(action);ctx.CivilPlatform.validate(s);}
  };return h;
}
let baseline;
function completeBaseline(){
  if(baseline)return baseline;
  const h=harness().approve(),start=h.s.civilization.elapsed,initial=clone(h.s),milestones={};
  for(let i=0;i<1200;i++){
    h.step(1);
    for(const p of h.s.civilization.regions.shipments.filter(p=>p.purpose==='common')){
      if(!milestones[p.phase])milestones[p.phase]=clone(h.s);
      if(!milestones[p.phase+'_'+p.status])milestones[p.phase+'_'+p.status]=clone(h.s);
    }
    if(i===599)milestones.firstClosed=clone(h.s);
  }
  baseline={initial,final:clone(h.s),milestones,settlements:clone(h.settlements),events:clone(h.events),messages:[...h.messages],start};return baseline;
}

test('the shipped index initializes an empty Finance ledger without altering the exact natural warehouses, census or project assets',()=>{
  assert.ok(files.includes('content/finance.js'));assert.ok(files.includes('src/postwar/finance.js'));assert.ok(files.indexOf('src/postwar/finance.js')<files.indexOf('src/postwar/adapter.js'));
  const h=harness(),{s,ctx}=h;for(const key of ['stores','game'])assert.deepEqual(clone(s[key]),exact[key]);
  for(const key of ['regions','municipal','services','origins'])assert.deepEqual(clone(s.civilization[key]),exact.civilization[key]);
  assert.equal(s.civilization.finance.introducedAt,exact.civilization.elapsed);assert.equal(s.civilization.finance.orders.length,0);ctx.CivilPlatform.validate(s);
});
test('two complete six-hundred-second adapter periods produce real two-way contributions without granting stock, people or service',t=>{
  const run=completeBaseline(),h=harness(run.final),f=h.s.civilization.finance,a=f.agreements[0];
  assert.equal(run.final.civilization.elapsed-run.start,1200);assert.equal(f.agreements.length,1);assert.deepEqual([...a.members].sort(),['home','rail','river']);
  const closed=f.periods.filter(p=>p.closedAt!==null);assert.equal(closed.length,2);
  for(const p of closed)for(const id of ['river','rail']){const o=f.orders.find(o=>o.id===p.routeOrders[id]);assert.ok(o,`${p.id} ${id} actually dispatched`);assert.equal(o.status,'complete');assert.ok(o.returnedAt<=p.endsAt);assert.equal(p.missed.includes(id),false);}
  assert.ok(run.final.civilization.society.year>=run.initial.civilization.society.year+2);assert.ok(run.final.civilization.society.generation>run.initial.civilization.society.generation);assert.ok(run.events.some(e=>e.pending==='succession'));
  for(const st of [h.s.stores,...Object.values(h.s.civilization.regions.nodes).map(n=>n.stores)])assert.ok(Object.values(st).every(v=>Number.isFinite(v)&&v>=0));h.ctx.CivilPlatform.validate(h.s);
  t.diagnostic(`Headless exact-save run ${run.start} → ${run.final.civilization.elapsed}: ${f.orders.filter(o=>o.status==='complete').length} completed common round trips; ${closed.length} closed periods; leader ${run.initial.civilization.society.generation} → ${run.final.civilization.society.generation}; population ${run.initial.game.population} → ${run.final.game.population}.`);
});
test('the real adapter event charges all three agreement signatures once while leaving every other asset unchanged',()=>{
  const h=harness(),before=clone(h.s),{s,f}=h;h.approve();assert.equal(h.active,null);assert.equal(s.civilization.pending,null);
  for(const id of ['home','river','rail']){
    const prev=id==='home'?before.stores:before.civilization.regions.nodes[id].stores,now=f.stores(s,id);
    for(const key of Object.keys(prev))near(now[key],prev[key]-(key==='knowledge'?(id==='home'?30:10):0),id+' '+key);
  }
  assert.deepEqual(clone(s.game),before.game);assert.deepEqual(clone(s.civilization.municipal),before.civilization.municipal);assert.deepEqual(clone(s.civilization.regions.shipments),before.civilization.regions.shipments);
  const snapshot=JSON.stringify(s);h.ledger('close');assert.equal(JSON.stringify(s),snapshot);h.roundtrip();
});
test('all three service summaries equal their unique actual adapter payments, never the net inventory change or a budget approval',()=>{
  const run=completeBaseline(),f=run.final.civilization.finance;
  for(const period of f.periods.filter(p=>p.closedAt!==null))for(const id of ['home','river','rail']){
    const evidence=run.settlements.filter(e=>e.at>=period.startedAt&&e.at<period.endsAt).map(e=>id==='home'?e.home:e.nodes[id]),totals=period.serviceTotals[id];
    assert.equal(totals.observations,evidence.length);assert.equal(totals.education,evidence.filter(e=>e.education).length);assert.equal(totals.treatment,evidence.filter(e=>e.treatment&&e.treatmentInputs.resources.medicine>0).length);
    for(const field of ['paidInputs','treatmentInputs']){
      const expected={};for(const e of evidence)for(const [resource,n]of Object.entries(e[field].resources))expected[resource]=(expected[resource]||0)+n;
      assert.deepEqual(Object.keys(totals[field]).sort(),Object.keys(expected).sort());for(const [resource,n]of Object.entries(expected))near(totals[field][resource],n,id+' '+field+' '+resource);
    }
    assert.ok(totals.treatmentInputs.medicine>0);assert.ok(totals.paidInputs.tools>0);
  }
  for(const settlement of run.settlements){const paid=settlement.flow['共同记录'];if(paid)near(paid.knowledge,-.02);}
  assert.ok(run.final.civilization.finance.receipts.some(r=>r.deliveredAt!==null));
});
test('full platform JSON round trips preserve outbound, candidate return loading and paid inbound cargo and resume identically',()=>{
  const run=completeBaseline();
  for(const name of ['outbound_moving','inbound_loading','inbound_moving']){
    assert.ok(run.milestones[name],name);const original=harness(run.milestones[name]),loaded=original.roundtrip(),before=clone(original.s.civilization.finance);
    assert.deepEqual(clone(loaded.s.civilization.finance),before);original.step(100);loaded.step(100);assert.deepEqual(clone(loaded.s),clone(original.s));loaded.roundtrip();
  }
});
test('an actual sixty-second public pause retains old freight through arrival and blocks subsequent budget dispatches',()=>{
  const h=harness(completeBaseline().milestones.outbound_moving),{s,f}=h,old=f.data(s).orders.map(o=>o.id),at=s.civilization.elapsed;
  assert.ok(s.civilization.regions.shipments.some(p=>p.purpose==='common'));h.ledger('pause');assert.equal(f.agreement(s).paused,false);assert.equal(f.data(s).revision.effectiveAt,at+60);h.step(59);assert.equal(f.agreement(s).paused,false);h.step(1);assert.equal(f.agreement(s).paused,true);
  h.step(700);assert.deepEqual(f.data(s).orders.map(o=>o.id),old);for(const id of old)assert.equal(f.data(s).orders.find(o=>o.id===id).status,'complete');assert.equal(s.civilization.regions.shipments.some(p=>p.purpose==='common'),false);
  assert.ok(h.settlements.length>=70,'all daily economies continued during the pause');h.roundtrip();
});
test('public resumption charges coordination again and uses a later real route slot without duplicating old receipts',()=>{
  const h=harness(completeBaseline().milestones.outbound_moving),{s,f}=h;h.ledger('pause');h.step(700);const old=clone(f.data(s).orders),receiptIds=f.data(s).receipts.map(r=>r.invoiceId),knowledge=s.stores.knowledge;
  h.ledger('resume');h.step(59);assert.equal(f.agreement(s).paused,true);h.step(1);assert.equal(f.agreement(s).paused,false);h.until(()=>f.data(s).orders.length>old.length,360);
  for(const order of old)assert.deepEqual(clone(f.data(s).orders.find(o=>o.id===order.id)),order);assert.ok(f.data(s).receipts.length>receiptIds.length);assert.equal(new Set(f.data(s).receipts.map(r=>r.invoiceId)).size,f.data(s).receipts.length);
  assert.ok(h.settlements.some(e=>e.at>s.civilization.elapsed-360&&e.flow['共同记录']));assert.ok(Number.isFinite(knowledge));h.roundtrip();
});
test('exiting the agreement leaves both paid legs legal until their original truck returns, and never silently restores received exports',()=>{
  const h=harness(completeBaseline().milestones.inbound_moving),{s,f}=h,old=f.data(s).orders.map(o=>o.id),a=f.agreement(s),paid=clone(a.approvals);
  h.ledger('exit');h.step(60);assert.equal(f.agreement(s),null);assert.ok(a.exitedAt!==null);h.roundtrip();h.step(500);
  assert.deepEqual(f.data(s).orders.map(o=>o.id),old);for(const id of old)assert.equal(f.data(s).orders.find(o=>o.id===id).status,'complete');assert.deepEqual(clone(a.approvals),paid);assert.equal(s.civilization.regions.shipments.some(p=>p.purpose==='common'),false);h.roundtrip();
});
test('a real election crossing and exact reload preserve approvals, order ownership and evidence instead of granting a new plan',()=>{
  const run=completeBaseline(),h=harness(run.final),{s,f}=h;assert.ok(run.events.some(e=>e.pending==='succession'));
  assert.equal(s.civilization.society.history.at(-1).reason,'election');assert.equal(f.data(s).nextAgreement,2);assert.equal(f.data(s).agreements[0].approvedAt,run.start);
  for(const o of f.data(s).orders){assert.equal(o.agreementId,1);assert.ok(f.data(s).periods.some(p=>p.agreementId===o.agreementId&&p.index===o.periodIndex));}
  const before=clone(s),loaded=h.roundtrip();assert.deepEqual(clone(loaded.s),before);loaded.step(10);assert.equal(loaded.f.data(loaded.s).agreements.length,1);loaded.ctx.CivilPlatform.validate(loaded.s);
});
test('full platform validation rejects impossible service history and treatment without the actually paid medicine category',()=>{
  const h=harness().approve(),{s,ctx}=h,at=s.civilization.elapsed;
  for(const totals of [
    {observations:60,treatment:60,education:60,paidInputs:{},treatmentInputs:{medicine:60}},
    {observations:1,treatment:1,education:1,paidInputs:{},treatmentInputs:{}},
    {observations:1,treatment:0,education:1,paidInputs:{},treatmentInputs:{tools:1}}
  ]){const bad=clone(s),period=bad.civilization.finance.periods[0];period.serviceTotals.home=totals;period.lastObserved.home=at;assert.throws(()=>ctx.CivilPlatform.validate(bad));}
  const valid=clone(completeBaseline().milestones.outbound_moving);ctx.CivilPlatform.validate(valid);
});
test('full platform rejects a paid real common shipment after its necessary coordination proof is removed or moved ten seconds too early',()=>{
  const h=harness(completeBaseline().milestones.outbound_moving),{s,ctx}=h,p=s.civilization.regions.shipments.find(p=>p.purpose==='common'),o=h.f.order(s,p);
  const periodIndex=s.civilization.finance.periods.findIndex(p=>p.agreementId===o.agreementId&&p.index===o.periodIndex);
  const missing=clone(s);missing.civilization.finance.periods[periodIndex].adminPayments=[];missing.civilization.finance.periods[periodIndex].paidAdmin={};assert.throws(()=>ctx.CivilPlatform.validate(missing));
  const stale=clone(s),period=stale.civilization.finance.periods[periodIndex];period.adminPayments=period.adminPayments.filter(pay=>pay.at<=o.dispatchedAt-10);period.paidAdmin={};for(const pay of period.adminPayments)for(const [id,n]of Object.entries(pay.costs))period.paidAdmin[id]=(period.paidAdmin[id]||0)+n;assert.throws(()=>ctx.CivilPlatform.validate(stale));
  const noLedger=clone(s);delete noLedger.civilization.finance;assert.throws(()=>ctx.CivilPlatform.validate(noLedger));
});
test('the saved charter snapshot preserves the actual sixty-second publication instead of accepting an edited immediate revision',()=>{
  const h=harness(completeBaseline().milestones.outbound_moving),{s,ctx,f}=h;h.ledger('pause');const revision=clone(f.data(s).revision);assert.equal(revision.charter,'constitution');assert.equal(revision.effectiveAt-revision.requestedAt,60);
  const bad=clone(s);bad.civilization.finance.revision.effectiveAt=bad.civilization.finance.revision.requestedAt;assert.throws(()=>ctx.CivilPlatform.validate(bad));
  const loaded=h.roundtrip();assert.deepEqual(clone(loaded.f.data(loaded.s).revision),revision);loaded.step(59);assert.equal(loaded.f.agreement(loaded.s).paused,false);loaded.step(1);assert.equal(loaded.f.agreement(loaded.s).paused,true);loaded.roundtrip();
});
test('the new raw browser common-freight checkpoint reloads byte-for-byte and its two existing paid carts finish exactly once',()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-common-freight.json'),'utf8')).state,h=harness(raw),{s,ctx,f}=h;
  ctx.CivilPlatform.validate(raw);assert.equal(raw.civilization.metro,undefined);assert.deepEqual(clone(s.civilization.metro),emptyMetro(raw.civilization.elapsed));const legacy=clone(s);delete legacy.civilization.metro;assert.equal(JSON.stringify(legacy),JSON.stringify(raw));assert.equal(s.civilization.elapsed,73944);assert.equal(s.civilization.society.generation,19);
  const existing=clone(f.data(s).orders),ids=existing.filter(o=>o.status==='outbound').map(o=>o.id);assert.equal(ids.length,2);assert.deepEqual(existing.filter(o=>o.status==='outbound').map(o=>o.shipmentId),[942,943]);
  h.step(45);const loaded=h.roundtrip();h.step(145);loaded.step(145);assert.deepEqual(clone(loaded.s),clone(h.s));
  assert.equal(f.data(s).orders.length,existing.length);for(const id of ids){const o=f.data(s).orders.find(o=>o.id===id),old=existing.find(o=>o.id===id);assert.equal(o.status,'complete');assert.deepEqual(clone(o.paid),old.paid);assert.equal(o.dispatchedAt,old.dispatchedAt);assert.equal(o.shipmentId,old.shipmentId);assert.equal(f.data(s).receipts.filter(r=>r.orderId===id).length,2);}
  for(const old of existing.filter(o=>o.status==='complete'))assert.deepEqual(clone(f.data(s).orders.find(o=>o.id===old.id)),old);
  assert.equal(new Set(f.data(s).receipts.map(r=>r.invoiceId)).size,f.data(s).receipts.length);assert.equal(s.civilization.regions.shipments.some(p=>[942,943].includes(p.id)),false);h.roundtrip();
});
