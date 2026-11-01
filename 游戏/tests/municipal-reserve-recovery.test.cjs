const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepared,clone,near}=require('./helpers/metro-fixture.cjs');

test('local fuel and reagent shortages assign bounded real reserve crews without granting inventory',()=>{
  const h=prepared(),{s,m,ctx}=h,id='rail',node=s.civilization.regions.nodes[id];
  node.stores.coal=10000;node.stores.chemicals=10000;m.planWorkers(s,id);const normal={...node.workers};
  // Declared synthetic shortage in an already prebuilt city, not a natural save.
  node.stores.coal=0;node.stores.chemicals=0;const stores=clone(node.stores),cohorts=clone(node.cohorts);
  m.planWorkers(s,id);assert.ok(node.workers.chemist>normal.chemist);assert.ok(node.workers.chemist<=normal.chemist+2);
  assert.ok(node.workers.collier>normal.collier);assert.deepEqual(clone(node.stores),stores);assert.deepEqual(clone(node.cohorts),cohorts);
  const caps=m.jobCapacity(s,id);for(const [job,count]of Object.entries(node.workers))assert.ok(count<=caps[job]);
  assert.ok(Object.values(node.workers).reduce((a,b)=>a+b,0)<=ctx.CivilPopulation.workforce(node.cohorts));
  s.civilization.elapsed+=10;m.settleNode(s,id);
  const e=m.data(s,id).economy;assert.ok(e.paidInputs.resources.tools>0);assert.ok(e.paidInputs.resources.minerals>0);
  near(node.stores.coal,node.workers.collier-e.paidInputs.resources.coal,'coal is produced by real miners minus actual consumption');
  assert.ok(node.stores.coal>0);assert.ok(node.stores.chemicals>0);
  node.stores.coal=10000;node.stores.chemicals=10000;m.planWorkers(s,id);
  assert.equal(node.workers.collier,normal.collier);assert.equal(node.workers.chemist,normal.chemist);
});
