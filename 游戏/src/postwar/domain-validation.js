/* MPL-2.0 — Replay every regional production, choice and cargo transition. */
CivilDomain.validate=function(s){
  const d=this.data(s);if(d===undefined)return;const fail=reason=>{throw Error('地区账册不符：'+reason);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),int=x=>Number.isSafeInteger(x)&&x>=0,time=x=>int(x)&&x<=s.civilization.elapsed;
  const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-5;
  if(d.schema!==1||!this.available(s)||!time(d.at)||!d.survey||!same(d.survey.paid,this.surveyCost)||!Array.isArray(d.ledger)||!Array.isArray(d.trips))fail('设立');
  if(d.survey.finishedAt===null){if(d.survey.remaining!==this.surveyTime-(s.civilization.elapsed-d.at)||d.survey.remaining<1||d.origin!==null||d.node!==null||d.mode!==null||d.priority!=='care'||d.enabled!==true||d.good!=='iron'||d.ledger.length||d.trips.length)fail('普查在途');return;}
  if(d.survey.finishedAt!==d.at+this.surveyTime||!time(d.survey.finishedAt)||d.survey.remaining!==0||!same(d.origin,this.origin(s,d.survey.finishedAt)))fail('地方来源');
  const c=s.civilization.census,partition=c.entries.filter(e=>e.kind==='partition'&&e.to===this.account);if(partition.length!==1||partition[0].at!==d.origin.at||partition[0].count!==d.origin.population)fail('人口细分');
  const node=this.initialNode(d.origin),dueRounds=Math.floor(s.civilization.elapsed/60)-Math.floor(d.origin.at/60),dueYears=Math.floor(s.civilization.elapsed/600)-Math.floor(d.origin.at/600);
  let mode=null,priority='care',enabled=true,good='iron',active=null,last=d.origin.at,rounds=0,years=0,tripCount=0,serviceDue=null,service=null;const home={...this.surveyCost},lake={},used=new Set();
  for(const e of d.ledger){if(!e||!time(e.at)||e.at<last||e.at<d.origin.at)fail('时序');last=e.at;
    if(e.kind==='agreement'){
      if(!Object.hasOwn(this.modes,e.mode)||e.mode===mode||active||node.condition<80||node.health<80||e.mode==='shared'&&!node.economy?.maintained)fail('协约');mode=e.mode;priority='care';enabled=true;CivilCity.sum(home,this.charterCost);CivilCity.sum(lake,{wood:120,tools:24});if(!CivilCity.pay(node,{wood:1200,tools:240}))fail('修船');
    }else if(e.kind==='policy'){
      if(!mode||!['enabled','priority','good'].includes(e.key))fail('授权');const previous={enabled,priority,good}[e.key];if(previous===e.value)fail('重复授权');
      if(e.key==='enabled'){if(typeof e.value!=='boolean')fail('停办');enabled=e.value;}
      if(e.key==='priority'){if(!Object.hasOwn(this.priorities,e.value)||e.value==='works'&&(mode!=='shared'||node.condition<80))fail('产业');priority=e.value;}
      if(e.key==='good'){if(!Object.hasOwn(this.goods,e.value))fail('货物');good=e.value;}CivilCity.sum(home,{knowledge:4});
    }else if(e.kind==='withdraw'){if(!mode||active)fail('退出');mode=null;priority='care';enabled=true;CivilCity.sum(home,{knowledge:4});
    }else if(e.kind==='regional'){
      const r=s.civilization.regional?.ledger[e.ref-1];if(!r||r.id!==e.ref||r.at!==e.at||!CivilRegional.applyNorth(node,r,s,{mode,enabled}))fail('跨地区流水');
    }else if(e.kind==='annual'){
      years++;if(e.at!==(Math.floor(d.origin.at/600)+years)*600)fail('年界');const delta=this.annual(node);
      for(const [kind,count]of [['birth',delta.born],['death',delta.dead]]){const rows=c.entries.filter(r=>r.kind===kind&&r.at===e.at&&(kind==='birth'?r.to:r.from)===this.account);if(count?(rows.length!==1||rows[0].count!==count):rows.length)fail('出生死亡');}
    }else if(e.kind==='round'){
      rounds++;if(e.at!==(Math.floor(d.origin.at/60)+rounds)*60||serviceDue!==null)fail('缺失结算');const regionalAway=typeof CivilRegional!=='undefined'?CivilRegional.northCrewAt(s,e.at):0;if(s.civilization.regional&&e.at>s.civilization.regional.at){if(e.regionalAway!==regionalAway)fail('跨地区驾驶员');}else if(e.regionalAway!==undefined)fail('未知跨地区岗位');this.settle(node,priority,mode==='shared'?enabled:true,(active?4:0)+regionalAway);serviceDue=mode?e.at:null;
    }else if(e.kind==='service'){
      if(!mode||e.mode!==mode||e.at!==serviceDue||typeof e.paid!=='boolean'||e.paid&&(!enabled||e.reason!==null)||!e.paid&&typeof e.reason!=='string')fail('共同维护');service=e;serviceDue=null;if(e.paid)CivilCity.sum(home,this.fees(mode));
    }else if(e.kind==='exportPrep'){
      const quantity=this.quantity(mode,priority,good),amount=Math.max(0,this.count(node)*.01*18+quantity-node.stores.medicine);
      if(!mode||good!=='medicine'||!enabled||active||!service?.paid||service.at!==e.at||e.at%60||node.condition<80||node.health<80||!node.economy?.fed||!node.economy?.treated||!near(e.amount,amount)||node.stores.food-amount/.15*.2<this.count(node)*.12*18+this.freightFees().food||!this.prepareMedicine(node,e.amount))fail('外供药品备料');
    }else if(e.kind==='dispatch'){
      const p=d.trips[tripCount++],cfg=this.goods[good],quantity=this.quantity(mode,priority,good);if(!mode||!enabled||active||!service?.paid||e.at-service.at>=120||node.condition<80||!node.economy?.fed||!node.economy?.treated||node.health<80||!p||p.id!==tripCount||e.id!==p.id||p.startedAt!==e.at||p.mode!==mode||p.good!==good||!same(p.out,{food:quantity*cfg.unit})||!same(p.back,{[good]:quantity})||!same(p.fees,this.freightFees())||Object.values(p.out).reduce((a,b)=>a+b,0)>2048||Object.values(p.back).reduce((a,b)=>a+b,0)>2048)fail('装船');
      const costs=CivilConurbation.plus(p.back,p.fees),pop=this.count(node),keep={food:pop*.12*18,medicine:pop*.01*18,tools:pop*.002,iron:120};for(const [k,v]of Object.entries(costs))if(node.stores[k]-v<(keep[k]||0)-1e-5)fail('地方保留');if(!CivilRules.pay({stores:node.stores},costs))fail('地方货源');CivilCity.sum(node.budget.sent,p.back);CivilCity.sum(node.budget.consumed,p.fees);CivilCity.sum(lake,p.fees);active=p;used.add(p.id);
    }else if(e.kind==='arrival'){
      if(!active||e.id!==active.id||active.deliveredAt!==e.at||e.at!==active.startedAt+this.travel)fail('到货');CivilConurbation.receive(node,active.out);
    }else if(e.kind==='return'){
      if(!active||e.id!==active.id||active.finishedAt!==e.at||e.at!==active.startedAt+this.travel*2||active.deliveredAt!==active.startedAt+this.travel)fail('返航');active=null;
    }else fail('未知记录');
  }
  if(rounds!==dueRounds||years!==dueYears||serviceDue!==null||tripCount!==d.trips.length)fail('遗漏结算');
  for(const p of d.trips){if(!used.has(p.id)||p.deliveredAt!==(p.startedAt+this.travel<=s.civilization.elapsed?p.startedAt+this.travel:null)||p.finishedAt!==(p.startedAt+this.travel*2<=s.civilization.elapsed?p.startedAt+this.travel*2:null))fail('在途保管');}
  if(d.mode!==mode||d.priority!==priority||d.enabled!==enabled||d.good!==good||!same(d.node,node))fail('地区经济回放');
  if(node.cohorts.length>160||this.count(node)!==d.origin.population+node.born-node.dead||this.count(node)!==c.accounts[this.account]||Object.values(node.workers).reduce((a,b)=>a+b,0)+(active?4:0)>CivilPopulation.workforce(node.cohorts))fail('人口岗位');
  for(const [id,cost]of [['home',home],['lake',lake]])for(const [k,v]of Object.entries(cost))if((this.city(s,id).budget.consumed[k]||0)+1e-5<v)fail('城市实付');
  // Exact event replay above still rejects any changed stock; this sum only allows accumulated floating-point cancellation.
  for(const k of CivilCityContent.resources)if(Math.abs(node.stores[k]-(d.origin.stores[k]+(node.budget.produced[k]||0)-(node.budget.consumed[k]||0)+(node.budget.received[k]||0)-(node.budget.sent[k]||0)))>1e-4+((node.budget.produced[k]||0)+(node.budget.consumed[k]||0))*1e-12)fail('地方物资');
};
