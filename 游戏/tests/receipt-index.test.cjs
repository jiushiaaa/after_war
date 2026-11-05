const test=require('node:test'),assert=require('node:assert/strict');
const {start}=require('./helpers/polity-fixture.cjs');
test('indexed long-save housing reconciliation still rejects duplicate and missing paid maintenance receipts',()=>{
 const h=start(278),s=h.s,rows=s.civilization.cityCouncil.receipts,a=h.ctx.CivilCityHomes;
 const exact=JSON.stringify(s);a.validate(s);assert.equal(JSON.stringify(s),exact);
 const index=rows.findIndex(r=>r.kind==='homeMaintenance');assert.ok(index>=0);const original=rows[index];
 rows.push({...original});assert.throws(()=>a.validate(s),/维护实付/);rows.pop();
 rows.splice(index,1);assert.throws(()=>a.validate(s));rows.splice(index,0,original);a.validate(s);assert.equal(JSON.stringify(s),exact);
});
