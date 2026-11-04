/* MPL-2.0 — Paid local charters, bounded external commitments and
 * revocable workshop stewardship. Existing residents and warehouses remain. */
var CivilCityGovernance={
  modes:{repair:'循环修造 · 本地保留',standard:'标准加工 · 协作供料',manual:'暂停生产委托'},
  cost:{wood:40,tools:8,knowledge:12},changeCost:{tools:2,knowledge:4},fee:{food:1,tools:.2,knowledge:.2},
  recipes:{repair:{input:{scrap:.4,wood:.08},output:{tools:.2}},standard:{input:{scrap:.8,wood:.1,iron:.1},output:{tools:.6}}},
  c(){return CivilCityCouncil;},data(s){return s.civilization.cityGovernance;},
  office(s,id){return this.data(s)?.offices[this.c().logical(s,id)];},
  available(s){return !!CivilCityBudget.data(s)&&this.c().membersAt(s,s.civilization.elapsed).length>=3;},
  active(s,id){const o=this.office(s,id);return !!o&&o.mode!=='manual'&&o.lastPaidAt!==null&&s.civilization.elapsed-o.lastPaidAt<120&&this.c().activeOffice(s,this.c().logical(s,id));},
  modeAt(s,id,at=s.civilization.elapsed,order=Infinity){const o=this.office(s,id);if(!o)return 'manual';let mode='manual';for(const i of o.changes){const e=this.c().data(s).receipts[i-1];if(e.at<=at&&e.id<order)mode=e.mode;}return mode;},
  readyAt(s,at=s.civilization.elapsed,order=Infinity){return this.c().membersAt(s,at).filter(id=>this.modeAt(s,id,at,order)!=='manual').length>=3;},
  preview(s,scope,mode){if(!this.available(s)||!Object.hasOwn(this.modes,mode))return [];const ids=this.c().membersAt(s,s.civilization.elapsed);if(scope!=='all'&&!ids.includes(scope))return [];return ids.filter(id=>scope==='all'||id===scope).map(city=>{const o=this.office(s,city),changed=(o?.mode||'manual')!==mode;return {city,changed,paid:changed?{...(o?this.changeCost:this.cost)}:{}};});},
  reason(s,scope,mode){const rows=this.preview(s,scope,mode);if(!rows.length)return '先议定三城共同预算';if(!rows.some(r=>r.changed))return '当前已采用此安排';if(mode==='standard'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards))return '标准加工需要机械传动与标准计量';for(const r of rows.filter(r=>r.changed)){if(mode!=='manual'&&(!CivilCityBudget.enabled(s,r.city)||!this.c().activeOffice(s,r.city)))return this.c().name(s,r.city)+'须先续办公用站与共同预算';const why=this.c().stockReason(s,r.city,r.paid);if(why)return this.c().name(s,r.city)+'：'+why;}return null;},
  apply(s,scope,mode){if(this.reason(s,scope,mode))return false;const at=s.civilization.elapsed,rows=this.preview(s,scope,mode);if(!this.data(s))s.civilization.cityGovernance={schema:1,at,offices:{}};const d=this.data(s);
    for(const r of rows.filter(r=>r.changed)){CivilCity.pay(this.c().local(s,r.city),r.paid);const receipt=this.c().record(s,r.city,'governancePolicy',r.city,r.paid,{mode});let o=d.offices[r.city];if(!o)o=d.offices[r.city]={at,mode:'manual',operation:null,changes:[],services:[],production:[],lastPaidAt:null};o.mode=mode;o.operation=mode==='manual'?null:'repair';o.changes.push(receipt.id);}
    this.c().replan(s);this.c().note(s,'各地实付议定'+this.modes[mode]+'。机构按储备安排既有工坊；新工程须另行表决，已签供料不撤销。');return true;
  },
  exportCap(s,id,at=s.civilization.elapsed,order=Infinity){const mode=this.modeAt(s,id,at,order);if(mode==='manual')return 0;const a=this.c(),b=a.burdenAt(s,id,at,order),due=a.populationAt(s,id,at)>=a.housingAt(s,id,at)*.95&&b.owed>300&&b.lastOther>b.lastHousing;return mode==='repair'?(due?100:200):(due?200:600);},
  allocations(s,sites,members,at,order){const a=this.c(),left=Object.fromEntries(members.map(id=>[id,this.exportCap(s,id,at,order)])),out=[];
    for(const [to,cost]of Object.entries(sites)){const buckets=Object.fromEntries(members.map(id=>[id,{}]));for(const [resource,total]of Object.entries(cost)){let needed=total;const preferred={wood:'lake',tools:'ridge',medicine:members.includes('estuary')?'estuary':'home',knowledge:members.includes('bridge')?'bridge':'home'}[resource];
      for(const id of [...new Set([preferred,...members])].filter(id=>members.includes(id)&&id!==to)){const n=Math.min(needed,Math.floor((left[id]+1e-7)/a.values[resource]));if(n){buckets[id][resource]=n;left[id]-=n*a.values[resource];needed-=n;}if(!needed)break;}
      if(needed)buckets[to][resource]=(buckets[to][resource]||0)+needed;
    }for(const from of members)if(Object.keys(buckets[from]).length)out.push({from,to,required:buckets[from]});}return out;
  },
  recipe(s,id){const o=this.office(s,id);return this.active(s,id)?this.recipes[o.operation]:null;},
  reserve(s,id,reserved){const o=this.office(s,id);if(o&&o.mode!=='manual')reserved.steward=2;},
  plan(s,id,want){const recipe=this.recipe(s,id);if(recipe){const n=CivilCity.node(s,id);want.smith=Math.ceil(want.smith*(n.method==='standard'?.6:.25)/recipe.output.tools);}},
  recordProduction(s,id,workers,recipe){if(!workers||!recipe)return;const o=this.office(s,id),at=s.civilization.elapsed;o.production.push({at,authority:o.changes.at(-1),service:o.lastPaidAt,operation:o.operation,workers,paid:Object.fromEntries(Object.entries(recipe.input).map(([k,v])=>[k,v*workers])),output:{tools:recipe.output.tools*workers}});},
  tick(s){const d=this.data(s),at=s.civilization.elapsed;if(!d||at%60)return;for(const [id,o]of Object.entries(d.offices)){if(at<=o.at||o.services.at(-1)?.at===at)continue;const n=this.c().local(s,id),iron=n.stores.iron||0,previous=o.operation;
      const paid=o.mode!=='manual'&&n.workers.steward===2&&n.economy?.ate&&this.c().activeOffice(s,id)&&this.c().pay(s,id,'governanceService',id+':'+at,this.fee);
      if(paid){o.lastPaidAt=at;o.operation=o.mode==='standard'&&iron>=(previous==='standard'?6:60)?'standard':'repair';}
      o.services.push({at,authority:o.changes.at(-1),receipt:paid?this.c().data(s).receipts.at(-1).id:null,paid:!!paid,iron,operation:o.operation});if(paid&&o.mode==='standard'&&previous!==o.operation)this.c().note(s,this.c().name(s,id)+(o.operation==='repair'?'铁料不足，受托工坊转为循环修造，等待实际补料。':'铁料储备恢复，受托工坊恢复标准加工。'));
    }this.c().replan(s);
  },
  receipt(s,e){const o=this.office(s,e.city);if(!o)return null;if(e.kind==='governancePolicy'){const i=o.changes.indexOf(e.id);return i>=0&&e.ref===e.city?(i===0?this.cost:this.changeCost):null;}return e.kind==='governanceService'&&e.ref===e.city+':'+e.at&&o.services.some(r=>r.at===e.at&&r.paid)?this.fee:null;},
  issues(s){const out=[];for(const id of this.c().ids(s)){for(const issue of CivilCityBudget.requests(s,id))out.push({city:id,...issue});const o=this.office(s,id);if(o&&o.mode!=='manual'){if(!this.active(s,id))out.push({city:id,kind:'governance',text:'机构待续办，现用原工序；检查人员、实物与公共额度'});else if(o.mode==='standard'&&o.operation==='repair')out.push({city:id,kind:'governance',text:'铁料不足，机构已转循环修造；补至60铁后恢复标准加工'});}}return out.sort((a,b)=>(a.kind==='maintenance'?-1:0)-(b.kind==='maintenance'?-1:0));},
  status(s,id){const o=this.office(s,id);return !o?'未议定地方章程':o.mode==='manual'?'生产委托暂停':!this.active(s,id)?'待续办，使用原工序':o.operation==='standard'?'标准加工运行':o.mode==='standard'?'缺铁转修造，等待补料':'循环修造运行';}
};
