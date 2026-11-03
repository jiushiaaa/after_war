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
    const health = (c.village?.health ?? 80)<30?.75:1;
    const factor = policy.output * hunger * health*(typeof CivilSociety!=='undefined'?CivilSociety.outputFactor(state):1);
    const away = typeof CivilExpedition!=='undefined'?CivilExpedition.unavailable(state):0;
    const gatherers = Math.max(0, (typeof CivilSociety!=='undefined'?CivilSociety.workforce(state):Math.max(0,p-away)) - Object.values(jobs).reduce((a,b) => a+b,0));
    const farmers=Math.min(jobs.farmer||0,CivilCatalog.jobCapacity(state,'farmer')),serviceCap=typeof CivilServices!=='undefined'?(CivilServices.jobs(state,'home').farmer||0):0,legacyCap=CivilCatalog.jobCapacity(state,'farmer')-serviceCap;
    const legacyFarmers=Math.min(farmers,legacyCap),serviceFarmers=Math.min(Math.max(0,farmers-legacyCap),Math.floor(((state.stores.tools||0)+1e-8)/.01)),serviceRate=typeof CivilServices!=='undefined'?CivilServices.farmRate(state,'home'):1.4;
    return {
      '工匠': {wood:state.game.builder?.level >= 4 && !(typeof CivilHeating!=='undefined'&&CivilHeating.handed(state)) ? 2 : 0},
      '采木工': {wood:gatherers * factor},
      '猎人': {food:(jobs.hunter || 0) * .8 * factor, fur:(jobs.hunter || 0) * .3 * factor},
      '农夫': {food:(legacyFarmers*(c.tech.irrigation && c.outpostSupplied!==false?2:1.4)+serviceFarmers*serviceRate)*factor,...(serviceFarmers?{tools:-serviceFarmers*.01}:{})},
      '回收工': {scrap:(jobs.salvager || 0) * (c.tech.metal ? .8 : .5) * factor},
      ...(state.game.buildings.outpost ? {'外站维护':{wood:-.5,food:-.2}} : {}),
      '口粮': {food:-(typeof CivilSociety!=='undefined'?CivilSociety.foodPopulation(state):Math.max(0,p-(typeof CivilExpedition!=='undefined'?CivilExpedition.awayEaters(state):0))) * .12 * policy.food * (state.game.buildings.cistern ? .9 : 1)}
    };
  }
  function industry(state) {
    const j=state.game.workers,c=state.civilization;
    const factor=(policies[c.policy]||policies.equal).output*(c.hunger>=30?.65:1)*((c.village?.health??80)<30?.75:1)*(typeof CivilSociety!=='undefined'?CivilSociety.outputFactor(state):1);
    return {
      '制器工':{count:j.smith||0,cost:{scrap:.6,wood:.2},output:{tools:.25*factor}},
      '医护':{count:j.medic||0,cost:{food:.2,scrap:.1},output:{medicine:.15*factor}},
      '教师':{count:j.teacher||0,cost:{wood:.1},output:{knowledge:.2*factor}}
    };
  }
  function settleIndustry(state,consume) {
    const flows={};
    for(const [name,r]of Object.entries(industry(state))){
      let n=r.count;for(const [key,cost]of Object.entries(r.cost))n=Math.min(n,Math.floor(((state.stores[key]||0)+1e-8)/cost));
      flows[name]={};
      for(const [key,amount]of Object.entries(r.cost))flows[name][key]=-amount*n;
      for(const [key,amount]of Object.entries(r.output))flows[name][key]=amount*n;
      if(consume)for(const [key,amount]of Object.entries(flows[name]))if(amount)state.stores[key]=Math.max(0,(state.stores[key]||0)+amount);
    }
    return flows;
  }
  function settle(state) {
    if(typeof CivilServices!=='undefined')CivilServices.begin(state,'home');
    const flow = rates(state), stores = state.stores, c = state.civilization;
    for (const [source, values] of Object.entries(flow)) {
      if(source === '口粮' || source === '外站维护') continue;
      for (const [key, amount] of Object.entries(values)) if(amount) stores[key] = Math.max(0,(stores[key] || 0) + amount);
    }
    const need = -flow['口粮'].food;
    const hungry = (stores.food || 0) + 1e-8 < need;
    if(need) stores.food = Math.max(0, (stores.food || 0) - need);
    c.hunger = hungry ? c.hunger + 10 : Math.max(0,c.hunger - 20);
    if(hungry) c.trust = Math.max(0,c.trust - 1);
    else if(state.game.population > 0) c.trust = Math.min(100,c.trust + .1);
    Object.assign(flow,settleIndustry(state,true));
    // Resident food has priority over remote upkeep.
    if(flow['外站维护']) {
      const upkeep=flow['外站维护'];
      c.outpostSupplied=Object.entries(upkeep).every(([key,n])=>(stores[key] || 0)+n>=0);
      if(c.outpostSupplied) for(const [key,n] of Object.entries(upkeep))stores[key]+=n;
      else flow['外站维护']={wood:0,food:0};
    }
    return {hungry, need, flow};
  }
  function stable(state) {
    const b = state.game.buildings, c = state.civilization;
    return state.game.population >= 4 && b.lodge > 0 && b.granary > 0 && !!c.policy && state.stores.wood >= 60 && state.stores.food >= 20 && c.hunger === 0;
  }
  function canPay(state,cost) { return Object.entries(cost).every(([key,n]) => (state.stores[key] || 0) + 1e-8 >= n); }
  function pay(state,cost) { if(!canPay(state,cost)) return false; for(const [key,n] of Object.entries(cost)) state.stores[key] = Math.max(0,state.stores[key] - n); return true; }
  root.CivilRules = {policies, rates, industry, settleIndustry, settle, stable, canPay, pay};
})(globalThis);
