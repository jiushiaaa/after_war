const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ready}=require('./helpers/metro-fixture.cjs');

test('fixed-period mutual aid stays punctual across ordinary trade rotations',()=>{
  // Synthetic prebuilt cities, actual single-cart travel and paid settlements.
  const h=ready(),{s,f}=h,start=s.civilization.elapsed;
  h.step(6000);
  const periods=f.data(s).periods.filter(p=>p.startedAt>=start&&p.closedAt===p.endsAt);
  assert.ok(periods.length>=8);
  for(const p of periods){
    assert.deepEqual(Array.from(p.missed),[],`period ${p.index} must not drift into arrears`);
    for(const id of ['rail','river']){
      const orders=f.data(s).orders.filter(o=>o.id===p.routeOrders[id]);
      assert.equal(orders.length,1);assert.equal(orders[0].status,'complete');
      assert.ok(orders[0].returnedAt<=p.endsAt,`${id} period ${p.index} returned late`);
    }
  }
  h.roundtrip();
});
