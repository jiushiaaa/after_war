const test=require('node:test'),assert=require('node:assert/strict');
const {fresh}=require('./helpers/census-fixture.cjs');
test('A7 numeric units preserve exact source values and do not mix people with mass',()=>{
 const h=fresh(),r=h.ctx.CivilReadable;assert.equal(r.number(123456,'人'),'12.35万人');assert.equal(r.number(1051728506,'人'),'10.52亿人');assert.equal(r.quantity(12500,'吨'),'1.25万吨');assert.equal(r.number(0,'人'),'0人');assert.equal(r.resource(12500000,'iron',true),'1.25万吨');assert.equal(r.resource(12500000,'iron',false),'1,250万');
 const stock={food:123456.789},book={received:{food:125000},consumed:{food:1543.211}},before=JSON.stringify([stock,book]);const rows=r.ledger(stock,book);assert.match(rows[0][2],/123,456.789/);assert.match(rows[0][2],/未折算物理质量/);assert.equal(JSON.stringify([stock,book]),before);
});
test('A7 census does not expose unknown reserves or count discoveries as births',()=>{
 const h=fresh(),{s,c,ctx}=h;const r=ctx.CivilReadable,original=JSON.stringify(s);let p=r.population(s);assert.equal(p.total,0);assert.equal(p.global,false);assert.equal(p.rows.some(x=>x.id.startsWith('reserve_')),false);assert.equal(JSON.stringify(s),original);
 c.move(s,'wanderers','home',2,'接纳');s.game.population=2;ctx.CivilSociety.sync(s);
 p=r.population(s);assert.equal(p.total,2);assert.equal(p.years[0].birth,0);assert.equal(p.years[0].arrival,2);assert.equal(c.total(s),s.civilization.census.initial);
 c.move(s,'home','transit',1);s.game.population--;ctx.CivilSociety.sync(s);p=r.population(s);assert.equal(p.total,2);assert.equal(p.rows.find(r=>r.id==='transit').count,1);assert.equal(p.years[0].arrival-p.years[0].departure,2);
});
test('A7 source rows distinguish genuine births/deaths and show only ten calendar years',()=>{
 const h=fresh(),{s,c,ctx}=h;s.civilization.elapsed=20*600;c.birth(s,'home',5);s.game.population=5;s.civilization.elapsed=21*600;c.death(s,'home',1);s.game.population=4;
 const p=ctx.CivilReadable.population(s);assert.equal(p.years.length,10);assert.equal(p.years[0].year,12);assert.equal(p.years.find(x=>x.year===20).birth,5);assert.equal(p.years.at(-1).death,1);assert.equal(p.total,4);
});
