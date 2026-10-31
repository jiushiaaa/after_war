/* MPL-2.0 — Pure economy rules shared by the live ADR adapter and tests. */
(function(root) {
  const policies = {
    equal: {name:'均分口粮', food:1, output:1, trust:5},
    ration: {name:'压缩口粮', food:.75, output:.9, trust:-8},
    generous: {name:'加厚口粮', food:1.25, output:1.1, trust:3}
  };
  function rates(state) {
    const p = state.game.population || 0, jobs = state.game.workers || {}, c = state.civilization;
    const policy = policies[c.policy] || policies.equal;
    const hunger = c.hunger >= 30 ? .65 : 1;
    const factor = policy.output * hunger;
    const gatherers = Math.max(0, p - Object.values(jobs).reduce((a,b) => a+b,0));
    return {
      '工匠': {wood:state.game.builder?.level >= 4 ? 2 : 0},
      '采木工': {wood:gatherers * factor},
      '猎人': {food:(jobs.hunter || 0) * .8 * factor, fur:(jobs.hunter || 0) * .3 * factor},
      '回收工': {scrap:(jobs.salvager || 0) * (c.tech.metal ? .8 : .5) * factor},
      '口粮': {food:-p * .12 * policy.food * (state.game.buildings.cistern ? .9 : 1)}
    };
  }
  function settle(state) {
    const flow = rates(state), stores = state.stores, c = state.civilization;
    for (const [source, values] of Object.entries(flow)) {
      if(source === '口粮') continue;
      for (const [key, amount] of Object.entries(values)) if(amount) stores[key] = (stores[key] || 0) + amount;
    }
    const need = -flow['口粮'].food;
    const hungry = (stores.food || 0) + 1e-8 < need;
    if(need) stores.food = Math.max(0, (stores.food || 0) - need);
    c.hunger = hungry ? c.hunger + 10 : Math.max(0,c.hunger - 20);
    if(hungry) c.trust = Math.max(0,c.trust - 1);
    else if(state.game.population > 0) c.trust = Math.min(100,c.trust + .1);
    return {hungry, need, flow};
  }
  function stable(state) {
    const b = state.game.buildings, c = state.civilization;
    return state.game.population >= 4 && b.lodge > 0 && b.granary > 0 && !!c.policy && state.stores.wood >= 60 && state.stores.food >= 20 && c.hunger === 0;
  }
  function canPay(state,cost) { return Object.entries(cost).every(([key,n]) => (state.stores[key] || 0) + 1e-8 >= n); }
  function pay(state,cost) { if(!canPay(state,cost)) return false; for(const [key,n] of Object.entries(cost)) state.stores[key] = Math.max(0,state.stores[key] - n); return true; }
  root.CivilRules = {policies, rates, settle, stable, canPay, pay};
})(globalThis);
