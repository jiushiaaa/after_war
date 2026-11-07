const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const original=JSON.parse(fs.readFileSync('tests/fixtures/natural-recovered-town.json','utf8')).state;
function create(){const h=harness(original);h.d=h.ctx.CivilDecisions;h.soc=h.ctx.CivilSociety;return h;}
function propose(h,axis){assert.ok(h.soc.beginReform(h.s,axis));h.ctx.Civilization.showPending();}

test('old natural saves and read-only history remain unchanged; old choices have no invented dates',()=>{
 const h=create();assert.deepEqual(clone(h.s),original);h.roundtrip();const before=JSON.stringify(h.s),view=h.ctx.CivilHistory.snapshot(h.s);
 assert.equal(h.s.civilization.decisions,undefined);assert.equal(view.entries.filter(e=>e.category==='governance').length,4);
 for(const e of view.entries.filter(e=>['policy','governance'].includes(e.category))){assert.equal(e.at,null);assert.match(e.detail,/原始底档未载明/);}
 assert.equal(JSON.stringify(h.s),before);
});
test('native ration decisions record only actual changes and reject reused callbacks from old windows',()=>{
 const h=create(),c=h.s.civilization,stores=JSON.stringify(h.s.stores),at=c.elapsed;
 h.ctx.Civilization.policyEvent();const old=h.active.scenes.start.buttons.policy_ration.onChoose;
 h.click('policy_ration');assert.equal(c.policy,'ration');assert.equal(c.decisions.records.length,1);assert.equal(c.decisions.records[0].at,at);assert.equal(c.decisions.records[0].from,'equal');assert.equal(JSON.stringify(h.s.stores),stores);
 const after=JSON.stringify(h.s);assert.equal(old(),false);assert.equal(JSON.stringify(h.s),after);
 h.ctx.Civilization.policyEvent();const reopened=JSON.stringify(h.s);assert.equal(old(),false);assert.equal(JSON.stringify(h.s),reopened);h.click('policy_ration');assert.equal(c.decisions.records.length,1);
 h.ctx.Civilization.policyEvent();h.click('policy_equal');assert.equal(c.decisions.records.length,2);h.roundtrip();
});
test('first four constitutional choices are recorded by their native owner and never manufacture an earlier constitution',()=>{
 const early=JSON.parse(fs.readFileSync('tests/fixtures/natural-river-town.json','utf8')).state,h=harness(early),c=h.s.civilization;
 assert.deepEqual(clone(c.society.axes),{});
 for(const [axis,value]of Object.entries({structure:'federation',selection:'election',charter:'constitution',devolution:'local'})){
  c.pending='constitution_'+axis;h.ctx.Civilization.showPending();h.click(value);
 }
 assert.deepEqual(clone(c.decisions.baseline.axes),{});assert.equal(c.decisions.records.length,4);assert.ok(c.decisions.records.every(r=>r.kind==='founding'&&r.from===null&&r.knowledge===0));assert.equal(c.society.governed,true);h.roundtrip();
});
test('real reform reservations survive reload and cancellation refunds once with a separate receipt',()=>{
 const h=create(),c=h.s.civilization,before=h.s.stores.knowledge;propose(h,'structure');
 near(h.s.stores.knowledge,before-60);assert.equal(c.decisions.records[0].kind,'proposal');assert.equal(c.society.axes.structure,'federation');
 const restored=h.roundtrip();restored.ctx.Civilization.showPending();restored.click('keep');near(restored.s.stores.knowledge,before);
 const d=restored.s.civilization.decisions;assert.equal(d.records.length,2);assert.equal(d.records[1].kind,'cancel');assert.equal(d.records[1].proposalId,1);assert.equal(d.records[1].knowledge,60);
 const after=JSON.stringify(restored.s);assert.equal(restored.ctx.CivilSociety.cancelReform(restored.s),false);assert.equal(JSON.stringify(restored.s),after);restored.roundtrip();
});
test('an old reform window cannot commit or refund a later proposal on the same axis',()=>{
 const h=create();propose(h,'structure');const old=h.active.scenes.start.buttons.city.onChoose,oldKeep=h.active.scenes.start.buttons.keep.onChoose;h.click('keep');propose(h,'structure');
 const before=JSON.stringify(h.s);assert.equal(old(),false);assert.equal(oldKeep(),false);assert.equal(JSON.stringify(h.s),before);assert.equal(h.s.civilization.pending,'constitution_structure');
 h.click('league');assert.equal(h.s.civilization.society.axes.structure,'league');assert.equal(h.s.civilization.decisions.records.at(-1).proposalId,3);h.roundtrip();
});
test('adopting a different charter spends the original reservation once, then future proposals use the new real price',()=>{
 const h=create(),c=h.s.civilization;propose(h,'charter');const paid=h.s.stores.knowledge;h.click('custom');near(h.s.stores.knowledge,paid);assert.equal(c.society.transition,180);assert.equal(c.decisions.records.at(-1).knowledge,60);h.roundtrip();
 h.step(600);const before=h.s.stores.knowledge;propose(h,'structure');near(h.s.stores.knowledge,before-30);h.click('league');assert.equal(c.decisions.records.at(-1).knowledge,30);h.roundtrip();
});
test('a legacy in-progress reservation can complete without inventing a proposal timestamp or paying twice',()=>{
 const h=create();propose(h,'charter');const legacy=clone(h.s);delete legacy.civilization.decisions; // Explicit old-save compatibility case.
 const restored=harness(legacy),before=restored.s.stores.knowledge;restored.ctx.Civilization.showPending();restored.click('custom');
 const d=restored.s.civilization.decisions;assert.equal(d.baseline.reform.knowledge,60);assert.equal(d.records.length,1);assert.equal(d.records[0].proposalId,0);near(restored.s.stores.knowledge,before);restored.roundtrip();
 const record=restored.ctx.CivilHistory.snapshot(restored.s).entries.find(e=>e.key==='decision_1');assert.match(record.detail,/原始动议发起时点已不可考/);
});
test('insufficient resources, invalid axes, current-value choices and busy requests leave no successful decision receipts',()=>{
 const h=create();h.s.stores.knowledge=0;const before=JSON.stringify(h.s);assert.equal(h.soc.beginReform(h.s,'structure'),false);assert.equal(h.soc.beginReform(h.s,'bogus'),false);assert.equal(JSON.stringify(h.s),before);assert.equal(h.s.civilization.decisions,undefined);
 const x=create();propose(x,'structure');const pending=JSON.stringify(x.s);assert.equal(x.soc.chooseAxis(x.s,'structure','federation'),false);assert.equal(x.soc.beginReform(x.s,'structure'),false);assert.equal(JSON.stringify(x.s),pending);
});
test('the ledger rejects mismatched costs, dangling proposals, false current choices and invented generations or times',()=>{
 const h=create();propose(h,'structure');h.click('league');
 for(const mutate of [
  d=>d.records[0].knowledge=30,d=>d.records[1].proposalId=99,d=>d.records[1].to='city',d=>d.records[1].at=h.s.civilization.elapsed+1,
  d=>d.records[0].generation=1,d=>d.records[1].kind='cancel',d=>d.records.push({...d.records[1]}),d=>d.baseline.reform={},d=>d.nextId++,d=>d.records[0].from='city'
 ]){const bad=clone(h.s);mutate(bad.civilization.decisions);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
 for(const bad of [null,[],false,{}]){const s=clone(h.s);s.civilization.decisions=bad;assert.throws(()=>h.ctx.CivilPlatform.validate(s));}
});
test('history pagination and reload never replay receipts, spend resources or rewrite political choices',()=>{
 const h=create();propose(h,'structure');h.click('keep');propose(h,'charter');h.click('custom');
 const before=JSON.stringify(h.s),history=h.ctx.CivilHistory,view=history.snapshot(h.s),event=history.event(h.s);
 assert.ok(event.scenes.start.buttons.history_governance);assert.equal(view.entries.filter(e=>e.key.startsWith('decision_')).length,4);assert.match(view.entries.find(e=>e.key==='decision_2').detail,/实际退回60知识/);assert.match(view.entries.find(e=>e.key==='decision_4').detail,/不再次扣款/);
 for(const scene of Object.values(event.scenes))for(const b of Object.values(scene.buttons)){assert.equal(b.onChoose,undefined);assert.equal(b.cost,undefined);}
 h.roundtrip();assert.equal(JSON.stringify(h.s),before);
 for(const [key,scene]of Object.entries(event.scenes))if(key.startsWith('governance_'))assert.ok(scene.text.length<=4);
});
test('receipts retain their original generation through real year ticks and a completed succession',()=>{
 const h=create(),c=h.s.civilization,first=c.society.generation;propose(h,'structure');h.click('keep');const before=clone(c.decisions);
 h.step(4200);assert.ok(c.society.generation>first);assert.deepEqual(clone(c.decisions),before);
 h.ctx.Civilization.policyEvent();h.click('policy_generous');assert.equal(c.decisions.records.at(-1).generation,c.society.generation);assert.equal(c.decisions.records[0].generation,first);h.roundtrip();
});
