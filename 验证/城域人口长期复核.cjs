// Declared isolated model test; not a natural playthrough or full-game long run.
const assert=require('node:assert/strict');
const {fresh}=require('../游戏/tests/helpers/census-fixture.cjs');
const h=fresh(),years=300;h.step(years*600);h.c.validate(h.s);h.city.validate(h.s);
const d=h.city.data(h.s),wards={};
for(const [id,n]of Object.entries(d.wards)){
  assert.equal(n.contactedAt,null);assert.ok(n.health>=60&&n.stable>=120&&n.economy.ate&&n.economy.treated&&n.economy.educated);
  assert.ok(n.cohorts.length<=160);assert.ok(h.city.count(n)<=h.city.housing(h.s,id));
  wards[id]={population:h.city.count(n),health:n.health,stable:n.stable,groups:n.cohorts.length,food:n.stores.food,medicine:n.stores.medicine,born:n.born,dead:n.dead};
}
console.log(JSON.stringify({synthetic:true,scope:'仅片区与世界人口底账，不是全适配器或自然游玩',years,world:h.c.total(h.s),initial:h.c.data(h.s).initial,entries:h.c.data(h.s).entries.length,wards},null,2));
