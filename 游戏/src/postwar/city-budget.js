/* MPL-2.0 — Reviewed, opt-in municipal scheduling. Reservations are claims on
 * existing spending authority, never stock, money, income or population. */
var CivilCityBudget={
  modes:{balanced:'轮替办理',learning:'接班优先',delivery:'履约优先',manual:'恢复分项办理'},
  cost:{knowledge:4},
  upkeepKinds:['service','homeMaintenance','continuityService','laborLodgingService'],
  committedKinds:['continuityLesson','laborInput','laborMeals','leg'],
  c(){return CivilCityCouncil;},x(){return CivilCityContinuity;},l(){return CivilCityLabor;},
  data(s){return s.civilization.cityBudget;},
  available(s){return this.l().available(s)&&this.c().membersAt(s,s.civilization.elapsed).length>=3;},
  mode(s,id){const rows=this.data(s)?.decisions||[];for(let i=rows.length-1;i>=0;i--)if(rows[i].cities.some(x=>x.city===id))return rows[i].mode;return 'manual';},
  enabled(s,id){return this.mode(s,id)!=='manual';},
  category(kind){if(kind.startsWith('continuity'))return 'learning';if(kind.startsWith('labor'))return 'employment';return 'delivery';},
  add(a,b,k=1){for(const [r,n]of Object.entries(b))a[r]=(a[r]||0)+n*k;return a;},
  // Inclusive start, exclusive end. On a payment tick, already-paid receipts
  // are omitted so the same service cannot be reserved twice.
  ticks(start,end,interval){const out=[];for(let t=Math.ceil(start/interval)*interval;t<end;t+=interval)out.push(t);return out;},
  upkeep(s,id,start=s.civilization.elapsed,end=this.c().period(s)+600){
    const a=this.c(),o=a.data(s).offices[id],rows=[],h=CivilCityHomes.estate(s,id),x=this.x().local(s,id);
    if(o?.completedAt!==null&&o?.enabled)rows.push({kind:'公用站',cost:a.serviceCost,last:o.lastPaidAt});
    if(h?.enabled)rows.push({kind:'安居社区',cost:CivilCityHomes.fee(s,id),last:h.lastPaidAt});
    if(x?.completedAt!==null&&x?.enabled)rows.push({kind:'岗位工坊',cost:this.x().officeFee(s,id),last:x.lastPaidAt});
    for(const p of this.l().data(s)?.contracts||[])if(p.to===id&&p.from!==id&&(p.endedAt===null||this.l().shifts(s).some(t=>t.order===p.id&&t.leftAt===null)))rows.push({kind:'驻班临住',cost:this.l().lodgingFee(p.count),last:p.lastLodgingAt});
    const total={};for(const r of rows){r.rounds=this.ticks(start,end,60).filter(t=>r.last!==t).length;this.add(total,r.cost,r.rounds);}return {total,rows};
  },
  schedule(s){return {start:this.c().period(s),costs:[{},{},{}]};},
  put(plan,at,cost){const i=Math.floor((at-plan.start)/600);if(i>=0&&i<plan.costs.length)this.add(plan.costs[i],cost);},
  lessons(s,plan,id,course){let at=Math.ceil(s.civilization.elapsed/10)*10;if(at<=course.at||at===course.lastAt)at+=10;for(let i=course.rounds;i<30;i++,at+=10)this.put(plan,at,this.x().lesson);},
  work(s,plan,p){const l=this.l(),o=l.data(s).contracts[p.order-1],trade=l.trade(s,p.to,o),cost=this.add({},trade.input,p.count);if(p.from!==p.to)cost.food=(cost.food||0)+p.count*.12;
    const arrival=p.arrivedAt??s.civilization.elapsed+p.remaining;let at=Math.ceil(Math.max(s.civilization.elapsed,arrival)/10)*10;if(at<=p.at||at<=arrival&&p.arrivedAt===null||at===p.rounds.at(-1)?.at)at+=10;
    for(let i=p.rounds.length;i<30;i++,at+=10)this.put(plan,at,cost);
  },
  commitments(s,id){const p=this.schedule(s),o=this.x().local(s,id);if(o?.training)this.lessons(s,p,id,o.training);
    for(const shift of this.l().shifts(s))if(shift.to===id&&['working','outbound'].includes(shift.phase))this.work(s,p,shift);
    for(const ship of this.c().data(s).shipments){if(ship.deliveredAt!==null)continue;const next=ship.path.legs[ship.legs.length],last=ship.legs.at(-1);if(next?.from===id&&last?.deliveredAt!==null)this.put(p,s.civilization.elapsed,this.c().legFee(next.travel));}
    return p;
  },
  reserve(s,id,index=0,committed=true){const start=index?this.c().period(s)+index*600:s.civilization.elapsed,end=this.c().period(s)+(index+1)*600,out=this.upkeep(s,id,start,end).total;if(committed)this.add(out,this.commitments(s,id).costs[index]);return out;},
  trainingPlan(s,id){const p=this.schedule(s);this.put(p,s.civilization.elapsed,this.x().enrollment);this.lessons(s,p,id,{at:s.civilization.elapsed,lastAt:null,rounds:0});return p;},
  laborPlans(s,o){const l=this.l(),q=l.quote(s,o),out=Object.fromEntries([...new Set([o.from,o.to])].map(id=>[id,this.schedule(s)])),at=s.civilization.elapsed;
    this.put(out[o.from],at,this.add({...q.pack},q.fee));this.put(out[o.to],at,q.escrow);
    const trade=l.trade(s,o.to,o),cost=this.add({},trade.input,o.count);if(o.from!==o.to)cost.food=(cost.food||0)+o.count*.12;
    let t=(Math.floor((at+q.distance)/10)+1)*10;for(let i=0;i<30;i++,t+=10)this.put(out[o.to],t,cost);return out;
  },
  fits(s,id,plan,priority=false,category='delivery'){
    const a=this.c(),limit=a.quotas[a.data(s).offices[id].quota].value;
    for(let i=0;i<plan.costs.length;i++){const held=this.reserve(s,id,i);if(i===0&&priority)this.add(held,this.ahead(s,id,category));const need=a.value(plan.costs[i])+a.value(held)+(i===0?a.spent(s,id):0);if(need>limit+1e-6)return (i===0?'本期':'下期')+'须先留维护与已承诺费用；本次续办需'+Math.ceil(need)+'，授权'+limit;}
    return a.stockReason(s,id,plan.costs[0]);
  },
  freight(s,id){const a=this.c(),p=a.data(s).projects.find(p=>p.completedAt===null);if(!p)return null;for(const q of p.pledges.filter(q=>q.from===id&&!a.full({required:q.required,installed:q.allocated}))){
    if(!a.activeOffice(s,id))continue;const route=id===q.to?null:a.path(s,id,q.to),leg=route?.legs[0];if(id!==q.to&&(!leg||a.legReason(s,id,leg.travel,true)))continue;
    const remaining=Object.fromEntries(Object.entries(q.required).map(([k,n])=>[k,n-(q.allocated[k]||0)])),fee=leg?a.legFee(leg.travel):{},cargo=a.batch(s,id,remaining,fee,true);if(!Object.keys(cargo).length)continue;
    const plan=this.schedule(s);this.put(plan,s.civilization.elapsed,this.add({...cargo},fee));if(!this.fits(s,id,plan))return plan;
  }return null;},
  order(s,id){const mode=this.mode(s,id);if(mode==='learning')return ['learning','employment','delivery'];if(mode==='delivery')return ['delivery','employment','learning'];const start=this.data(s)?.at||0,i=Math.floor((this.c().period(s)-this.c().period(s,start))/600)%3;return [['learning','employment','delivery'],['employment','delivery','learning'],['delivery','learning','employment']][i];},
  candidate(s,id,category){if(category==='learning'){if(this.x().enrollReason(s,id,true))return null;const p=this.trainingPlan(s,id);return this.fits(s,id,p)?null:p;}
    if(category==='employment'){const o=this.l().contract(s,id);if(!o||this.l().departureReason(s,o,false,true))return null;const plans=this.laborPlans(s,o);if(Object.entries(plans).some(([city,p])=>this.enabled(s,city)&&this.fits(s,city,p)))return null;return plans[id];}
    return this.freight(s,id);
  },
  ahead(s,id,category){for(const k of this.order(s,id)){if(k===category)break;const p=this.candidate(s,id,k);if(p)return {...p.costs[0]};}return {};},
  maintenanceIssue(s,id){const a=this.c(),o=a.data(s).offices[id],h=CivilCityHomes.estate(s,id),x=this.x().local(s,id);
    if(!o.enabled)return '公用站已暂停';if(o.lastPaidAt===null||s.civilization.elapsed-o.lastPaidAt>=120)return '公用站待续办';
    if(h&&(!h.enabled||h.condition<80||h.lastPaidAt===null||s.civilization.elapsed-h.lastPaidAt>=120))return '社区维护未稳';
    if(x?.completedAt!==null&&x&&(!x.enabled||x.lastPaidAt===null||s.civilization.elapsed-x.lastPaidAt>=120))return '接续工坊待续办';return null;
  },
  held(s,id,kind='other'){if(!this.enabled(s,id)||this.upkeepKinds.includes(kind))return {};const committed=this.committedKinds.includes(kind),out=this.reserve(s,id,0,!committed);if(!committed)this.add(out,this.ahead(s,id,this.category(kind)));return out;},
  free(s,id,kind='cargo'){return Math.max(0,this.c().allowance(s,id)-this.c().value(this.held(s,id,kind)));},
  reason(s,id,cost,kind='other'){if(!this.enabled(s,id)||this.upkeepKinds.includes(kind))return null;
    if(!this.committedKinds.includes(kind)&&this.maintenanceIssue(s,id))return this.maintenanceIssue(s,id)+'，先恢复再开新任务';
    const held=this.held(s,id,kind);if(this.c().value(cost)+this.c().value(held)>this.c().allowance(s,id)+1e-6)return '共同预算先留维护与已承诺费用，待下期或调整安排';return null;
  },
  enrollReason(s,id){return this.enabled(s,id)?this.fits(s,id,this.trainingPlan(s,id),true,'learning'):null;},
  departureReason(s,o){for(const [id,p]of Object.entries(this.laborPlans(s,o)))if(this.enabled(s,id)){const why=this.maintenanceIssue(s,id)||this.fits(s,id,p,true,'employment');if(why)return this.c().name(s,id)+'：'+why;}return null;},
  requests(s,id){const out=[],issue=this.maintenanceIssue(s,id),x=this.x(),o=x.local(s,id);if(issue)out.push({kind:'maintenance',text:issue+'；暂停新任务，保留已付承诺'});
    if(o){const need=Math.max(0,x.need(s,id)-x.count(x.trainees(s,id)));if(need)out.push({kind:'learning',text:'两年内需补'+need+'名合格接班人'+(o.policy==='manual'?'，尚未委托培养':'')});}
    const a=this.c(),p=a.data(s).projects.find(p=>p.completedAt===null),owed=p?.pledges.filter(q=>q.from===id).reduce((n,q)=>n+a.value(Object.fromEntries(Object.entries(q.required).map(([k,v])=>[k,v-(q.allocated[k]||0)]))),0)||0;
    if(owed>0)out.push({kind:'delivery',text:'共同工程尚需本城供料'+Math.ceil(owed)+'折值'});
    const held=a.data(s).shipments.filter(p=>p.deliveredAt===null&&p.legs.at(-1)?.deliveredAt!==null&&p.path.legs[p.legs.length]?.from===id);if(held.length)out.unshift({kind:'delivery',text:held.length+'批寄存货等待本城接力，先留下一段旅费'});
    const housing=a.request(s,id);if(housing.due)out.push({kind:'housing',text:'本城住房紧张且持续出料，要求先安排本地安居'});
    return out;
  },
  recommended(s,id){const a=this.c(),start=a.period(s)+600,life=a.value(this.upkeep(s,id,start,start+600).total),o=this.l().contract(s,id),task=o?a.value(this.laborPlans(s,o)[id].costs.reduce((r,c)=>this.add(r,c),{})):400,need=life+Math.max(400,task),current=a.data(s).offices[id].quota;return Object.keys(a.quotas).find(k=>a.quotas[k].value>=Math.max(need,a.quotas[current].value))||'active';},
  preview(s,scope,mode){if(!this.available(s)||!Object.hasOwn(this.modes,mode))return [];const a=this.c(),ids=a.membersAt(s,s.civilization.elapsed);if(scope!=='all'&&!ids.includes(scope))return [];return ids.filter(id=>scope==='all'||scope===id).map(city=>{const quota=mode==='manual'?a.data(s).offices[city].quota:this.recommended(s,city),quotaChanged=quota!==a.data(s).offices[city].quota,changed=quotaChanged||this.mode(s,city)!==mode;return {city,quota,quotaChanged,changed,cost:{knowledge:changed?4+(quotaChanged?4:0):0}};});},
  applyReason(s,scope,mode){const rows=this.preview(s,scope,mode);if(!rows.length)return '先完成接续工坊和三城公用站';if(!rows.some(r=>r.changed))return '各城已按此安排办理';for(const r of rows)if(r.changed&&!CivilRules.canPay({stores:this.c().local(s,r.city).stores},r.cost))return this.c().name(s,r.city)+'需知识'+r.cost.knowledge;return null;},
  apply(s,scope,mode){if(this.applyReason(s,scope,mode))return false;const a=this.c(),at=s.civilization.elapsed,rows=this.preview(s,scope,mode).filter(r=>r.changed);if(!this.data(s))s.civilization.cityBudget={schema:1,at,decisions:[]};const d=this.data(s),decision={id:d.decisions.length+1,at,scope,mode,cities:[]};d.decisions.push(decision);
    for(const row of rows){let quotaReceipt=null;if(row.quotaChanged){a.set(s,row.city,'quota',row.quota);quotaReceipt=a.data(s).receipts.at(-1).id;}CivilCity.pay(a.local(s,row.city),this.cost);const r=a.record(s,row.city,'budgetPolicy',decision.id,this.cost);decision.cities.push({city:row.city,receipt:r.id,quotaReceipt});}
    a.note(s,(scope==='all'?'登记各城':a.name(s,scope))+'议定'+this.modes[mode]+'。'+(mode==='manual'?'保留旧承诺与支出记录，恢复分项办理。':'先留维护和在办费用，再按实际条件续班、用工、供料；各地仍独立实付。'));return true;
  },
  receipt(s,e){const d=this.data(s),p=d?.decisions[e.ref-1];return p?.at===e.at&&p.cities.some(r=>r.city===e.city&&r.receipt===e.id)?this.cost:null;}
};
