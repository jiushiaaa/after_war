/* MPL-2.0 — Local replay plus cross-ledger references for regional obligations. */
CivilRegional.applyNorth=function(n,e,s,north){
 const d=this.data(s),pay=cost=>CivilCity.pay(n,cost);
 if(['survey','agreement','service','dispatch'].includes(e.kind)&&north.mode!=='shared')return false;
 if(['agreement','service','dispatch'].includes(e.kind)&&!north.enabled)return false;
 if(['agreement','dispatch'].includes(e.kind)&&(n.health<80||n.condition<80))return false;
 if(e.kind==='survey')return pay(this.northSurvey);
 if(e.kind==='agreement')return pay(this.setup.north);
 if(e.kind==='service'&&e.paid)return pay(this.northFees());
 if(e.kind==='dispatch'){
  const p=d.trips[e.trip-1],needed=Math.max(0,CivilDomain.count(n)*.01*18+24000-n.stores.medicine);
  if(!p||!Number.isFinite(e.prepared)||Math.abs(e.prepared-needed)>1e-5||e.prepared&&!CivilDomain.prepareMedicine(n,e.prepared))return false;
  const fees=this.freightFees(),pop=CivilDomain.count(n);if(n.stores.food-fees.food<pop*.12*18||n.stores.tools-fees.tools<pop*.002||!CivilRules.pay({stores:n.stores},CivilConurbation.plus({medicine:24000},fees)))return false;
  CivilCity.sum(n.budget.sent,{medicine:24000});CivilCity.sum(n.budget.consumed,fees);return true;
 }
 if(e.kind==='arrival'){CivilConurbation.receive(n,{tools:12000});return true;}return false;
};
CivilRegional.validate=function(s){
 const d=this.data(s);if(d===undefined)return;
 const fail=why=>{throw Error('两区共同账不符：'+why);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),int=x=>Number.isSafeInteger(x)&&x>=0,time=x=>int(x)&&x<=s.civilization.elapsed,near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-5;
 if(d.schema!==1||s.civilization.ruleset!==2||!CivilDomain.data(s)?.node||!time(d.at)||!d.survey||!Array.isArray(d.ledger)||!Array.isArray(d.trips)||!Array.isArray(d.deliveries)||!d.ledger.length)fail('设立');
 const c=s.civilization.census,finished=d.survey.finishedAt,at=s.civilization.elapsed;
 if(finished!==null&&(finished!==d.at+this.surveyTime||!time(finished)||!same(d.origin,this.origin(s,finished))))fail('普查来源');
 if(d.survey.remaining!==(finished===null?this.surveyTime-(at-d.at):0)||finished===null&&d.survey.remaining<=0)fail('普查时点');
 const node=finished===null?null:CivilDomain.initialNode(d.origin),partition=c.entries.filter(e=>e.kind==='partition'&&e.to===this.account);
 if(finished===null?partition.length:partition.length!==1||partition[0].at!==finished||partition[0].count!==d.origin.population)fail('人口细分');
 let previous=d.at,pact=null,enabled=true,levee=80,buffer=0,medical={stock:0,received:0,local:0,used:0},active=null,cart=null,rounds=0,years=0,trips=0,carts=0,discovered=false,lastRound=null,leveeDue=null,floodDue=null,service=null,cofunding;
 const home={...this.surveyCost},northRefs=new Set(),arrivals=new Set(),distributions=new Set();
 const referenced=e=>{const references=CivilDomain.data(s).ledger.filter(r=>r.kind==='regional'&&r.ref===e.id);if(references.length!==1||references[0].at!==e.at)fail('北岸引用');northRefs.add(e.id);};
 for(const [i,e]of d.ledger.entries()){
  if(!e||e.id!==i+1||!time(e.at)||e.at<previous||e.at<d.at)fail('流水号');previous=e.at;
  if(i===0){if(e.kind!=='survey'||e.at!==d.at)fail('普查缴费');referenced(e);continue;}
  if(e.kind==='discover'){if(discovered||finished===null||e.at!==finished)fail('重复接触');discovered=true;continue;}
  if(!discovered||!node)fail('先普查后治理');
  if(e.kind==='agreement'){
   if(e.handoff!==undefined&&e.handoff!==1||!Object.hasOwn(this.shares,e.share)||pact?.share===e.share||active||cart||buffer>0||node.health<80||node.condition<80||!node.economy?.maintained||24000-e.share<this.need(node)&&!(cofunding&&this.localBacking(node,e.share))||!CivilCity.pay(node,this.setup.east))fail('地方同意');
   referenced(e);CivilCity.sum(home,this.setup.home);pact={at:e.at,share:e.share,...(e.handoff===1?{handoff:1}:{})};enabled=true;
  }else if(e.kind==='policy'){if(!pact||typeof e.enabled!=='boolean'||e.enabled===enabled)fail('授权');enabled=e.enabled;CivilCity.sum(home,{knowledge:4});
  }else if(e.kind==='withdraw'){if(!pact||active||cart||buffer)fail('退出未结清');pact=null;enabled=true;CivilCity.sum(home,{knowledge:4});
  }else if(e.kind==='polity'){
   const p=s.civilization.polity?.records[e.ref-1];if(!p||p.at!==e.at||!CivilPolity.applyLocal(node,p,'east',{permit:!!pact&&enabled,cofunded:!!cofunding}))fail('国家地方回执');
  }else if(e.kind==='annual'){
   years++;if(e.at!==(Math.floor(finished/600)+years)*600)fail('年份');const delta=CivilDomain.annual(node);
   for(const [kind,count]of [['birth',delta.born],['death',delta.dead]]){const rows=c.entries.filter(r=>r.kind===kind&&r.at===e.at&&(kind==='birth'?r.to:r.from)===this.account&&(kind!=='death'||r.reason==='东原年度死亡'));if(count?(rows.length!==1||rows[0].count!==count):rows.length)fail('出生死亡');}
  }else if(e.kind==='round'){
   rounds++;if(e.at!==(Math.floor(finished/60)+rounds)*60||leveeDue!==null||floodDue!==null)fail('结算');CivilDomain.settle(node,'care',true,(active?16:0)+(cart?4:0),this.profiles);lastRound=e.at;leveeDue=e.at;
  }else if(e.kind==='levee'){
   if(e.at!==leveeDue)fail('堤务时点');const cost=this.leveeCost(node),material={...cost};delete material.medicine;let local=0;
   const waiting=pact?.handoff===1&&enabled&&!d.trips.some(p=>p.at>=pact.at&&arrivals.has(p.id));
   if((!pact||waiting||cofunding&&enabled)&&medical.stock<cost.medicine&&CivilDomain.prepareMedicine(node,cost.medicine)){local=cost.medicine;CivilRules.pay({stores:node.stores},{medicine:local});CivilCity.sum(node.budget.sent,{medicine:local});medical.local+=local;medical.stock+=local;}
   const paid=!!((!pact||enabled)&&node.economy.fed&&medical.stock>=cost.medicine&&CivilCity.pay(node,material));if(e.paid!==paid||!near(local,e.local))fail('实付堤务');if(paid){medical.stock-=cost.medicine;medical.used+=cost.medicine;}levee=Math.max(20,Math.min(100,levee+(paid?4:-4)));leveeDue=null;floodDue=levee<60?e.at:null;
  }else if(e.kind==='flood'){
   const spoil=Math.min(node.stores.food,CivilDomain.count(node)*.002);if(e.at!==floodDue||!near(e.food,spoil)||!CivilCity.pay(node,{food:spoil}))fail('实际粮损');floodDue=null;
  }else if(e.kind==='cofund'){
   if(cofunding||!pact||!enabled||node.health<80||node.condition<80||!CivilCity.pay(node,this.cofundCost))fail('共筹机构');cofunding={at:e.at};CivilCity.sum(home,{knowledge:60});
  }else if(e.kind==='selfCare'){
   const amount=this.need(node)/2;if(!pact||!enabled||medical.stock>=amount||!near(e.amount,amount)||node.stores.food-amount/.15*.2<CivilDomain.count(node)*.12*18||node.stores.scrap<amount/.15*.1||!CivilDomain.prepareMedicine(node,amount))fail('地方自筹');CivilRules.pay({stores:node.stores},{medicine:amount});CivilCity.sum(node.budget.sent,{medicine:amount});medical.stock+=amount;medical.local+=amount;
  }else if(e.kind==='service'){
   if(!pact||e.at!==lastRound||typeof e.paid!=='boolean'||e.paid&&(!enabled||e.reason!==null)||!e.paid&&typeof e.reason!=='string')fail('联络维护');service=e;if(e.paid){referenced(e);CivilCity.sum(home,this.serviceFees());}
  }else if(e.kind==='dispatch'){
   const p=d.trips[trips++];if(!pact||!enabled||active||!service?.paid||service.at!==e.at||e.at!==lastRound||levee<60||24000-pact.share<this.need(node)&&!(cofunding&&this.localBacking(node,pact.share))||node.health<80||node.condition<80||buffer>4800||!p||p.id!==trips||p.id!==e.trip||p.at!==e.at||p.share!==pact.share||!same(p.out,{medicine:24000})||!same(p.back,{tools:12000})||!same(p.fees,this.freightFees())||node.stores.tools-12000-p.fees.tools<CivilDomain.count(node)*.002)fail('地区装船');
   if(!CivilRules.pay({stores:node.stores},CivilConurbation.plus(p.back,p.fees)))fail('东原货源');CivilCity.sum(node.budget.sent,p.back);CivilCity.sum(node.budget.consumed,p.fees);referenced(e);active=p;
  }else if(e.kind==='arrival'){
   if(!active||arrivals.has(e.trip)||e.trip!==active.id||e.at!==active.at+this.travel||active.deliveredAt!==e.at)fail('地区交割');arrivals.add(e.trip);referenced(e);medical.stock+=24000-active.share;medical.received+=24000-active.share;buffer+=active.share;
  }else if(e.kind==='return'){if(!active||e.trip!==active.id||active.finishedAt!==e.at||e.at!==active.at+2*this.travel)fail('地区返航');active=null;
  }else if(e.kind==='distribution'){
   const p=d.deliveries[carts++],amount=Math.min(2400,buffer);if(cart||!amount||!p||p.id!==carts||e.trip!==p.id||p.at!==e.at||!same(p.cargo,{medicine:amount})||!same(p.fees,this.cartFees())||!CivilCity.pay(node,p.fees))fail('分药装车');buffer-=amount;CivilCity.sum(home,p.fees);cart=p;
  }else if(e.kind==='distributed'){if(!cart||distributions.has(e.trip)||e.trip!==cart.id||e.at!==cart.at+this.lastMile||cart.deliveredAt!==e.at)fail('城市实到');distributions.add(e.trip);
  }else if(e.kind==='cartReturn'){if(!cart||e.trip!==cart.id||e.at!==cart.at+2*this.lastMile||cart.finishedAt!==e.at)fail('分药返程');cart=null;
  }else fail('未知流水');
 }
 for(const e of CivilDomain.data(s).ledger.filter(e=>e.kind==='regional'))if(!northRefs.has(e.ref))fail('孤立北岸流水');
 const timeTrips=(rows,duration)=>{for(const p of rows)if(p.deliveredAt!==(p.at+duration<=at?p.at+duration:null)||p.finishedAt!==(p.at+2*duration<=at?p.at+2*duration:null))fail('在途时序');};timeTrips(d.trips,this.travel);timeTrips(d.deliveries,this.lastMile);
 if(finished===null){if(d.node!==null||d.origin!==null||d.ledger.length!==1)fail('未普查账');}
 else{if(!discovered||rounds!==Math.floor(at/60)-Math.floor(finished/60)||years!==Math.floor(at/600)-Math.floor(finished/600)||leveeDue!==null||floodDue!==null||!same(d.node,node))fail('地方生产回放');if(CivilDomain.count(node)!==c.accounts[this.account]||CivilDomain.count(node)!==d.origin.population+node.born-node.dead||node.cohorts.length>160)fail('名册');
  // Exact event replay above still rejects any changed stock; this sum only allows accumulated floating-point cancellation.
  for(const k of CivilCityContent.resources)if(Math.abs(node.stores[k]-(d.origin.stores[k]+(node.budget.produced[k]||0)-(node.budget.consumed[k]||0)+(node.budget.received[k]||0)-(node.budget.sent[k]||0)))>1e-4+((node.budget.produced[k]||0)+(node.budget.consumed[k]||0))*1e-12)fail('地方库存');
 }
 if(!same(d.cofunding,cofunding)||!same(d.pact,pact)||d.enabled!==enabled||d.levee!==levee||d.buffer!==buffer||!same(d.medical,medical)||trips!==d.trips.length||carts!==d.deliveries.length)fail('最终责任');
 if(!near(medical.stock,medical.received+medical.local-medical.used))fail('公共药品账');
 const delivered=d.trips.filter(p=>p.deliveredAt!==null),allocated=delivered.reduce((v,p)=>v+p.share,0),loaded=d.deliveries.reduce((v,p)=>v+p.cargo.medicine,0);if(allocated-loaded!==buffer||medical.received!==delivered.reduce((v,p)=>v+24000-p.share,0))fail('分药守恒');
 for(const [k,v]of Object.entries(home))if((this.home(s).budget.consumed[k]||0)+1e-5<v)fail('本城实付');
};
