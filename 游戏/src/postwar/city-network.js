/* MPL-2.0 — A3 municipal transport network, opt-in schema 1.
 * Budget limits authorize spending from existing warehouses; they are NOT money or
 * stock. Cargo, crews, local works and recurring maintenance remain physical.
 * The schema-1 lake book is never repriced. Its pending return occupies a fleet slot.
 */
var CivilCityNetwork={
  config:{name:'矿岭市',population:50000,foodRate:1.75,scrapRate:1.8,woodRate:.8},
  charterCost:{wood:120,tools:16,knowledge:24},surveyCost:{food:60,tools:16,knowledge:24},
  roadCost:{wood:300,tools:48,knowledge:16},travel:240,
  expansionCosts:{timber:{wood:640,tools:96,medicine:48},steel:{wood:240,tools:64,iron:96}},
  budgets:{hold:{name:'暂缓交通',limit:{}},regular:{name:'维持运转',limit:{food:100,wood:100,tools:24,iron:10,medicine:6,knowledge:16}},expand:{name:'加强交通',limit:{food:220,wood:220,tools:56,iron:24,medicine:12,knowledge:32}}},
  priorities:{balanced:'轮流调度',food:'粮医优先',industry:'工料优先'},
  data(s){return s.civilization.cityNetwork;},copy(x){return JSON.parse(JSON.stringify(x));},
  local(s,id){return CivilCity.node(s,id==='home'?this.data(s).depot:id);},
  name(id){return {home:'本城出发仓',lake:'湖滨市',ridge:'矿岭市'}[id];},
  note(s,text){const d=this.data(s);d.history.push({at:s.civilization.elapsed,text});if(typeof State!=='undefined'&&State===s)Civilization.notify(text);},
  formReason(s){const d=CivilConurbation.data(s);if(!d?.clusterAt)return '先让两城协作实际运行';if(this.data(s))return '联合调度所已设立';return CivilConurbation.safe(s,d.route.depot,this.charterCost)||CivilConurbation.safe(s,'lake',this.charterCost);},
  form(s){if(this.formReason(s))return false;const lake=CivilConurbation.data(s),at=s.civilization.elapsed;
    for(const id of [lake.route.depot,'lake'])CivilCity.pay(CivilCity.node(s,id),this.charterCost);
    s.civilization.cityNetwork={schema:1,at,legacyTrips:lake.trips.length,legacyRepairs:lake.payments.length,depot:lake.route.depot,paid:this.copy(this.charterCost),survey:null,origin:null,node:null,road:null,expansion:null,
      priority:'balanced',enabled:false,policies:[],nextOrder:1,entries:[],trips:[],repairs:[],inspections:{home:null,lake:null,ridge:null},
      budget:{home:'regular',lake:'regular',ridge:'regular'},waiting:{lake:null,ridge:null},departures:[],history:[]};
    this.replan(s);this.note(s,'两城共同设立调度所。已有本城车组纳入共同调度；地方仓库不合并，运行预算从各自公仓实付。');return true;
  },
  origin(s,at){
    const census=CivilCensus.data(s),initial=48000+census.seed%6001,ratio=initial/CivilCensus.initial(census.seed).counts.reserve_west;
    let population=initial,born=0,dead=0,housing=Math.ceil(initial*1.5);
    const initialStores={food:initial*.12*18,medicine:initial*.01*8,wood:3200,scrap:3600,tools:600,knowledge:120,iron:240},stores={...initialStores},produced={},consumed={};
    for(const e of census.entries){if(e.at>at)break;
      if(e.kind==='birth'&&e.to==='reserve_west'){const n=Math.floor(e.count*ratio);population+=n;born+=n;}
      if(e.kind==='death'&&e.from==='reserve_west'){
        const n=Math.floor(e.count*ratio);population-=n;dead+=n;
        const needs={food:population*.12*60,medicine:population*.01*60,wood:840,scrap:2400,tools:1440,knowledge:60,iron:120};
        if(population>housing){const blocks=Math.ceil((population-housing)/800);housing+=blocks*800;needs.wood+=blocks*400;needs.tools+=blocks*50;needs.medicine+=blocks*10;}
        const growth={food:Math.max(0,population*.12*18-stores.food),medicine:Math.max(0,population*.01*8-stores.medicine)};
        CivilCity.sum(produced,CivilConurbation.plus(needs,growth));CivilCity.sum(consumed,needs);CivilCity.sum(stores,growth);
      }
    }
    return {at,initial,population,born,dead,housing,initialStores,stores,produced,consumed,assets:{familyBeds:housing,publicWaterworks:1,foundrySlots:160},model:'west-share-annual-subsistence-v1'};
  },
  surveyReason(s){const d=this.data(s);if(!d)return '先设联合调度所';if(d.survey||d.node)return '矿岭普查已有记录';return CivilConurbation.safe(s,d.depot,this.surveyCost,2);},
  survey(s){if(this.surveyReason(s))return false;const d=this.data(s);CivilCity.pay(this.local(s,'home'),this.surveyCost);d.survey={startedAt:s.civilization.elapsed,remaining:420,paid:this.copy(this.surveyCost)};this.replan(s);this.note(s,'两名普查员沿西部旧铁路寻找矿岭市。旅粮一次实付，两人暂离本城岗位。');return true;},
  discover(s){const d=this.data(s),o=this.origin(s,s.civilization.elapsed);if(!CivilCensus.partition(s,o.population,'ridge'))throw Error('矿岭人口细分失败');d.origin=o;d.survey.finishedAt=o.at;d.survey.remaining=0;
    d.node={cohorts:CivilCity.cohortSeed(o.population),stores:{...o.stores},year:Math.floor(o.at/600),births:{scaled:true,credit:0,mutantCredit:0},health:85,hunger:0,workers:{},contactedAt:o.at,joinedAt:null,priority:'balanced',method:'manual',waterEnabled:true,freightEnabled:true,buildings:{road:0,water:1,housing:0},project:null,stable:0,economy:null,budget:{produced:{},consumed:{},received:{},sent:{}},born:0,dead:0};
    this.replan(s);this.note(s,'矿岭市普查登记 '+o.population+' 人，从西陆失联名册细分。当地保有住房、铸炉和公仓；全球人口没有增加。');
  },
  active(s){return this.data(s)?.trips.find(p=>p.status!=='complete');},
  capacity(s,at=s.civilization.elapsed){const e=this.data(s)?.expansion;return e?.completedAt!==null&&e&&e.completedAt<=at?2:1;},
  occupied(s){return (CivilConurbation.active(s)?1:0)+(this.active(s)?1:0);},
  crew(s,id){const d=this.data(s);if(!d)return 0;return (id===d.depot&&d.survey&&!d.survey.finishedAt?2:0)+(this.active(s)&&(id===d.depot||id==='ridge')?6:0);},
  replan(s){const d=this.data(s);if(!d)return;for(const id of [d.depot,'lake',...(d.node?['ridge']:[])])CivilCity.plan(s,id);},
  inspectionCost(s,id,at=s.civilization.elapsed){
    if(id==='lake')return {food:4,wood:2,tools:1,medicine:.5,knowledge:.5};
    if(id==='ridge')return {food:4,wood:2,tools:1,iron:1,knowledge:.5};
    if(this.capacity(s,at)===1)return {food:4,wood:4,tools:1,knowledge:.5};
    return this.data(s).expansion.method==='steel'?{food:6,wood:4,tools:2,iron:2,knowledge:1}:{food:6,wood:12,tools:3,knowledge:1};
  },
  inspected(s,id){const at=this.data(s).inspections[id];return at!==null&&s.civilization.elapsed-at<120;},
  period(s,at=s.civilization.elapsed){return this.data(s).at+Math.floor((at-this.data(s).at)/300)*300;},
  spent(s,id){const d=this.data(s),start=this.period(s),sum={};for(let i=d.entries.length-1;i>=0&&d.entries[i].at>=start;i--){const e=d.entries[i];if(e.city===id&&e.kind!=='policy')CivilCity.sum(sum,e.paid);}return sum;},
  canSpend(s,id,cost){const d=this.data(s),limit=this.budgets[d.budget[id]].limit,used=this.spent(s,id);for(const [k,v]of Object.entries(cost))if((used[k]||0)+v>(limit[k]||0)+1e-7)return this.name(id)+'：本期'+(CivilText.labels[k]||k)+'运行额度不足';return CivilConurbation.safe(s,id==='home'?d.depot:id,cost);},
  receipt(s,city,kind,ref,paid){const d=this.data(s);d.entries.push({order:d.nextOrder++,at:s.civilization.elapsed,city,kind,ref,paid:this.copy(paid)});},
  spend(s,id,kind,ref,cost){if(this.canSpend(s,id,cost))return false;CivilCity.pay(this.local(s,id),cost);this.receipt(s,id,kind,ref,cost);return true;},
  setBudget(s,id,value){const d=this.data(s);if(!d||!['home','lake','ridge'].includes(id)||!this.local(s,id)||!this.budgets[value]||d.budget[id]===value)return false;
    const paid={knowledge:4};if(!CivilCity.pay(this.local(s,id),paid))return false;d.budget[id]=value;this.receipt(s,id,'policy',value,paid);this.replan(s);this.note(s,this.name(id)+'将后续运行额度改为“'+this.budgets[value].name+'”。本期已支出不返还；基础口粮、诊疗与课堂仍由地方维持。');return true;
  },
  setPriority(s,value){const d=this.data(s);if(!d||!this.priorities[value]||d.priority===value)return false;const paid={knowledge:4};if(!CivilCity.pay(this.local(s,'home'),paid))return false;d.priority=value;d.policies.push({order:d.nextOrder++,at:s.civilization.elapsed,kind:'priority',value,paid});this.note(s,'共同车辆改为'+this.priorities[value]+'；另一条具备条件的线路最多让行两次。');return true;},
  plan(s,id,slots,want,reserved){const d=this.data(s);if(!d)return;
    if(id===d.depot||id==='lake'||id==='ridge')reserved.trafficclerk=2;
    const crew=this.crew(s,id);if(crew)reserved.courier=(reserved.courier||0)+crew;
    if(d.road?.completedAt===null&&(id===d.depot||id==='ridge'))reserved.networkbuilder=20;
    if(d.expansion?.completedAt===null&&id===d.depot)reserved.fleetbuilder=20;
    if(id!=='ridge')return;const n=d.node;reserved.clerk=2;
    const expected=Math.min(Math.ceil(CivilCity.count(n)*.04),Math.max(0,CivilCity.housing(s,'ridge')-CivilCity.count(n))+n.cohorts.filter(c=>c.age===79).reduce((a,c)=>a+c.count,0),Math.floor(n.cohorts.filter(c=>c.age>=17&&c.age<=48).reduce((a,c)=>a+c.count,0)*.08+n.births.credit));
    want.medic+=Math.ceil(expected*2/60/.15);want.farmer+=Math.ceil(expected*6/60/this.config.foodRate);
    slots.smith=480;want.smith=Math.ceil((want.farmer*.01+want.waterworker*.001+7)/.25);
    want.smelter=this.inspected(s,'ridge')?160:0;
    want.salvager=Math.ceil((want.medic*.1+want.smith*.6+want.smelter)/this.config.scrapRate)+4;
    want.gatherer+=Math.ceil((want.smelter*.5+want.smith*.2)/this.config.woodRate);
  },
  targets(s){const n=this.data(s).node;return {food:CivilPopulation.foodPopulation(n.cohorts)*.12*18,medicine:CivilCity.count(n)*.01*8,wood:4000,scrap:5000,tools:1200,knowledge:3000,iron:800};},
  buildReason(s){const d=this.data(s);if(!d?.node)return '先完成矿岭普查';if(d.road)return '矿岭道路已有工程记录';return CivilConurbation.safe(s,d.depot,this.roadCost)||CivilConurbation.safe(s,'ridge',this.roadCost);},
  build(s){if(this.buildReason(s))return false;const d=this.data(s);for(const id of ['home','ridge'])CivilCity.pay(this.local(s,id),this.roadCost);d.road={startedAt:s.civilization.elapsed,completedAt:null,worked:0,remaining:300,condition:100,paid:this.copy(this.roadCost)};this.replan(s);this.note(s,'本城与矿岭各自支付路材、派20名建设者修复旧铁路沿线道路。');return true;},
  expansionReason(s,method){const d=this.data(s);if(!d?.road?.completedAt)return '先完成第三城道路';if(d.expansion)return '已有车场扩建记录';if(!this.expansionCosts[method])return '未知车场方案';if(method==='steel'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards))return '钢架车场需要机械传动和标准计量';return CivilConurbation.safe(s,d.depot,this.expansionCosts[method]);},
  expand(s,method){if(this.expansionReason(s,method))return false;const d=this.data(s),paid=this.copy(this.expansionCosts[method]);CivilCity.pay(this.local(s,'home'),paid);d.expansion={method,paid,startedAt:s.civilization.elapsed,completedAt:null,remaining:300,worked:0};this.replan(s);this.note(s,'本城实付扩建'+(method==='steel'?'钢架':'木构')+'车场，20名建设者施工。建成后增加一组车，持续检修负担也会增加。');return true;},
  setEnabled(s,value){const d=this.data(s);if(!d?.road?.completedAt||typeof value!=='boolean'||value===d.enabled)return false;const paid=value?{knowledge:12}:{};if(value&&(!CivilRules.canPay({stores:this.local(s,'home').stores},paid)||!CivilRules.canPay({stores:d.node.stores},paid)))return false;
    for(const id of ['home','ridge'])CivilCity.pay(this.local(s,id),paid);d.enabled=value;d.policies.push({order:d.nextOrder++,at:s.civilization.elapsed,kind:'enabled',value,paid});this.note(s,value?'矿岭工料互市已获双方授权。新订单依实际缺口、共同车辆和地方预算发运。':'矿岭暂停新订单；已付款在途货物继续交割，车辆按原路返回。');return true;},
  fees(){return {food:6*.12*this.travel*2/10,wood:12,tools:2,knowledge:1};},
  order(s){const d=this.data(s);if(!d?.node)return {out:{},back:{}};const home=this.local(s,'home'),ridge=d.node,fee=this.fees(),target=this.targets(s),ht={...CivilCity.targets(home,s,d.depot),iron:300,tools:640};
    const offers=(from,to,desired,limits)=>{const floor={food:CivilPopulation.foodPopulation(from.cohorts)*.12*6,medicine:CivilCity.count(from)*.01*4,tools:32,iron:24};return Object.fromEntries(Object.entries(limits).map(([k,v])=>[k,Math.max(0,Math.floor(Math.min(v,(desired[k]||0)-(to.stores[k]||0),(from.stores[k]||0)-(floor[k]||0)-(fee[k]||0))))]).filter(([,v])=>v));};
    const proposed=offers(home,ridge,target,{food:1200,medicine:96}),back=offers(ridge,home,ht,{iron:96,tools:120}),value=x=>CivilConurbation.value(x);
    const limit=Math.min(value(proposed),value(back));let best={out:{},back:{}},bestValue=0;
    // At most 97 iron quantities. Tools have value 8, so for a fixed iron
    // quantity their maximum feasible amount also minimizes required food modulo 4.
    // This finds a payable physical basket even when medicine is the only offer
    // (e.g. 73 iron cannot clear, but 72 iron exchanges for 90 medicine).
    for(let iron=Math.min(back.iron||0,Math.floor(limit/5));iron>=0;iron--){
      const tools=Math.min(back.tools||0,Math.floor((limit-iron*5)/8)),v=iron*5+tools*8;
      if(v<=bestValue)continue;const medicine=Math.min(proposed.medicine||0,Math.floor(v/4)),food=v-medicine*4;
      if(food>(proposed.food||0))continue;
      best={out:Object.fromEntries(Object.entries({medicine,food}).filter(([,n])=>n)),back:Object.fromEntries(Object.entries({iron,tools}).filter(([,n])=>n))};bestValue=v;
    }
    return best;
  },
  guardLegacy(s,ignoreFleet=false){const d=this.data(s),old=CivilConurbation.data(s);if(!d)return null;if(old.route.depot!==d.depot)return '共同出发仓与旧道路不符';
    for(const id of ['home','lake']){if(!this.inspected(s,id))return this.name(id)+'：交通检修待续费';const cost=CivilConurbation.plus(CivilConurbation.split(CivilConurbation.running,old.share,id),{food:25.92}),reason=this.canSpend(s,id,cost);if(reason)return reason;}
    return !ignoreFleet&&this.occupied(s)>=this.capacity(s)?'共同车组正被其他线路占用':null;
  },
  legacyTrip(s,p){if(!this.data(s))return;for(const id of ['home','lake'])this.receipt(s,id,'lakeTrip',p.id,p.fees[id]);this.departure(s,'lake',p.id);},
  legacyRepair(s,ref,home,lake){if(!this.data(s))return;this.receipt(s,'home','lakeRepair',ref,home);this.receipt(s,'lake','lakeRepair',ref,lake);},
  dispatchReason(s,ignoreFleet=false){const d=this.data(s);if(!d?.road?.completedAt)return '先完成双方道路';if(!d.enabled)return '工料互市尚未授权';if(this.active(s))return '矿岭原车仍在途';if(d.road.condition<20)return '矿岭道路待付检修';
    const order=this.order(s);if(CivilConurbation.value(order.out)<80||CivilConurbation.value(order.out)!==CivilConurbation.value(order.back))return '尚未形成等值的实际补库需求';
    for(const [id,cargo]of [['home',order.out],['ridge',order.back]]){if(!this.inspected(s,id))return this.name(id)+'：交通检修待续费';const reason=this.canSpend(s,id,this.fees())||CivilConurbation.safe(s,id==='home'?d.depot:id,CivilConurbation.plus(cargo,this.fees()),6);if(reason)return reason;}
    return !ignoreFleet&&this.occupied(s)>=this.capacity(s)?'共同车组正被湖滨线路占用':null;
  },
  departure(s,route,ref){const d=this.data(s);d.departures.push({at:s.civilization.elapsed,route,ref});d.waiting[route]=null;},
  dispatch(s){if(this.dispatchReason(s))return false;const d=this.data(s),order=this.order(s),p={id:d.trips.length+1,startedAt:s.civilization.elapsed,deliveredAt:null,finishedAt:null,status:'outbound',remaining:this.travel,out:order.out,back:order.back,fees:this.fees()};
    for(const [id,cargo]of [['home',p.out],['ridge',p.back]]){const n=this.local(s,id);CivilRules.pay({stores:n.stores},CivilConurbation.plus(cargo,p.fees));CivilCity.sum(n.budget.sent,cargo);CivilCity.sum(n.budget.consumed,p.fees);this.receipt(s,id,'ridgeTrip',p.id,p.fees);}
    d.trips.push(p);d.road.condition-=20;this.departure(s,'ridge',p.id);this.replan(s);return true;
  },
  repair(s){const d=this.data(s),cost={wood:48,tools:8};if(!d?.road?.completedAt||d.road.condition>=20||this.canSpend(s,'home',cost)||this.canSpend(s,'ridge',cost))return false;const ref=d.repairs.length+1;
    for(const id of ['home','ridge'])this.spend(s,id,'ridgeRepair',ref,cost);d.repairs.push({at:s.civilization.elapsed,paid:cost});d.road.condition=100;return true;
  },
  schedule(s){const d=this.data(s),lake=CivilConurbation.data(s);if(lake.contract&&!lake.suspended&&lake.route.condition<20)CivilConurbation.repair(s);if(d.enabled&&d.road?.condition<20)this.repair(s);
    const eligible={lake:!CivilConurbation.dispatchReason(s,true),ridge:!this.dispatchReason(s,true)},at=s.civilization.elapsed;
    for(const id of ['lake','ridge'])d.waiting[id]=eligible[id]?(d.waiting[id]??at):null;
    let ready=Object.keys(eligible).filter(id=>eligible[id]);
    while(ready.length&&this.occupied(s)<this.capacity(s)){
      const recent=d.departures.slice(-2),fav=d.priority==='food'?'lake':d.priority==='industry'?'ridge':null;
      const last=id=>{for(let i=d.departures.length-1;i>=0;i--)if(d.departures[i].route===id)return d.departures[i].at;return -1;};
      ready.sort((a,b)=>last(a)-last(b));let id=ready[0];if(fav&&ready.includes(fav)&&!(recent.length===2&&recent.every(x=>x.route===fav)))id=fav;
      if(id==='lake')CivilConurbation.dispatch(s);else this.dispatch(s);ready=ready.filter(x=>x!==id);
    }
  },
  tick(s){const d=this.data(s);if(!d)return;const t=s.civilization.elapsed;
    if(d.survey&&!d.survey.finishedAt&&--d.survey.remaining===0)this.discover(s);
    if(d.node){CivilCity.annual(s,'ridge');if(t%10===0)CivilCity.settleWard(s,'ridge');}
    for(const [key,ids,job]of [['road',['home','ridge'],'networkbuilder'],['expansion',['home'],'fleetbuilder']]){const p=d[key];if(p&&p.completedAt===null&&ids.every(id=>this.local(s,id)?.economy?.ate&&this.local(s,id).workers[job]===20)){p.worked++;p.remaining--;if(!p.remaining){p.completedAt=t;this.replan(s);this.note(s,key==='road'?'矿岭道路修通，双方可以授权工料互市。':'第二组共同车辆投入使用。可同时服务两条线路，检修和运行开支随之增加。');}}}
    const p=this.active(s);if(p&&--p.remaining===0){if(p.status==='outbound'){CivilConurbation.receive(d.node,p.out);CivilConurbation.receive(this.local(s,'home'),p.back);p.deliveredAt=t;p.status='returning';p.remaining=this.travel;}else{p.status='complete';p.finishedAt=t;this.replan(s);}}
    if(t%60===0)for(const id of ['home','lake',...(d.node?['ridge']:[])]){const n=this.local(s,id);if(n.workers.trafficclerk===2&&this.spend(s,id,'inspection',t,this.inspectionCost(s,id)))d.inspections[id]=t;}
    if(t%10===0){this.replan(s);this.schedule(s);}
  },
  validate(s){
    const d=this.data(s);if(!d)return;const fail=msg=>{throw Error('城市群调度账不符：'+msg);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),num=n=>Number.isFinite(n)&&n>=0,int=n=>Number.isSafeInteger(n)&&n>=0,time=n=>int(n)&&n<=s.civilization.elapsed,near=(a,b)=>num(a)&&num(b)&&Math.abs(a-b)<1e-4;
    const old=CivilConurbation.data(s),resources=CivilCityContent.resources;
    if(d.schema!==1||!int(d.legacyTrips)||d.legacyTrips>old?.trips.length||!int(d.legacyRepairs)||d.legacyRepairs>old?.payments.length||!old?.clusterAt||d.at<old.clusterAt||!time(d.at)||d.depot!==old.route.depot||!same(d.paid,this.charterCost)||!this.priorities[d.priority]||typeof d.enabled!=='boolean')fail('设立');
    for(const k of ['policies','entries','trips','repairs','departures','history'])if(!Array.isArray(d[k]))fail(k);
    for(const id of ['home','lake','ridge'])if(!this.budgets[d.budget[id]]||d.inspections[id]!==null&&!time(d.inspections[id])||d.waiting[id]!==undefined&&d.waiting[id]!==null&&!time(d.waiting[id]))fail('预算/候车');
    const survey=d.survey;if(survey){if(!time(survey.startedAt)||survey.startedAt<d.at||!same(survey.paid,this.surveyCost))fail('普查');if(d.node){if(survey.remaining!==0||survey.finishedAt!==survey.startedAt+420||d.origin.at!==survey.finishedAt)fail('普查到达');}else if(survey.finishedAt!==undefined||survey.remaining!==420-(s.civilization.elapsed-survey.startedAt)||survey.remaining<1)fail('普查在途');}
    if(!!d.node!==!!d.origin||d.node&&!survey)fail('地方账');
    if(d.node){const n=d.node,o=d.origin;if(!same(o,this.origin(s,o.at))||n.contactedAt!==o.at||n.joinedAt!==null||n.year!==Math.floor(s.civilization.elapsed/600)||!int(n.born)||!int(n.dead)||CivilCity.count(n)!==o.population+n.born-n.dead||CivilCity.count(n)>CivilCity.housing(s,'ridge')||!Array.isArray(n.cohorts)||n.cohorts.length>160||n.cohorts.some(c=>!int(c.count)||!c.count||!int(c.age)||c.age>=80||!['human','mutant'].includes(c.identity))||!num(n.health)||n.health>100||!num(n.stable)||n.stable>600||!num(n.hunger)||!same(n.buildings,{road:0,water:1,housing:0})||n.method!=='manual'||n.priority!=='balanced'||n.waterEnabled!==true||n.freightEnabled!==true||n.project!==null)fail('人口/地方设施');
      if(!n.births||n.births.scaled!==true||!num(n.births.credit)||n.births.credit>=1||!num(n.births.mutantCredit)||n.births.mutantCredit>=1||Object.values(n.workers).some(v=>!int(v))||Object.values(n.workers).reduce((a,b)=>a+b,0)>CivilCity.workforce(n))fail('岗位/出生');
      const partitions=CivilCensus.data(s).entries.filter(e=>e.kind==='partition'&&e.to==='city_ridge');if(partitions.length!==1||partitions[0].count!==o.population||partitions[0].at!==o.at)fail('西陆底账');
      for(const bucket of [n.stores,...['produced','consumed','received','sent'].map(k=>n.budget?.[k])])if(!bucket||Object.entries(bucket).some(([k,v])=>!resources.includes(k)||!num(v)))fail('库存');
      for(const k of resources)if(!near(n.stores[k],o.stores[k]+(n.budget.produced[k]||0)-(n.budget.consumed[k]||0)+(n.budget.received[k]||0)-(n.budget.sent[k]||0)))fail('库存守恒');
    }
    for(const key of ['road','expansion']){const p=d[key];if(!p)continue;const cost=key==='road'?this.roadCost:this.expansionCosts[p.method];if(!d.node||!cost||!same(p.paid,cost)||!time(p.startedAt)||p.startedAt<d.origin.at||!int(p.worked)||p.worked>300||p.remaining!==300-p.worked||p.completedAt===null&&p.remaining<1||p.completedAt!==null&&(!time(p.completedAt)||p.completedAt-p.startedAt<300||p.worked!==300))fail('施工');if(key==='expansion'&&(!d.road?.completedAt||p.startedAt<d.road.completedAt))fail('车场前置');}
    const ordered=[...d.entries,...d.policies].sort((a,b)=>a.order-b.order);if(d.nextOrder!==ordered.length+1)fail('流水号');
    let last=d.at,priority='balanced',enabled=false,period=null,limits={home:'regular',lake:'regular',ridge:'regular'},used={home:{},lake:{},ridge:{}},inspection={home:null,lake:null,ridge:null};const unique=new Set(),consumed={home:{},lake:{},ridge:{}};
    for(const [i,e]of ordered.entries()){
      if(e.order!==i+1||!time(e.at)||e.at<last)fail('流水顺序');last=e.at;
      if(!e.city){if(e.kind==='priority'){if(!this.priorities[e.value]||priority===e.value||!same(e.paid,{knowledge:4}))fail('调度优先级');priority=e.value;CivilCity.sum(consumed.home,e.paid);}else if(e.kind==='enabled'){if(typeof e.value!=='boolean'||enabled===e.value||!d.road?.completedAt||e.at<d.road.completedAt||!same(e.paid,e.value?{knowledge:12}:{}))fail('互市授权');enabled=e.value;for(const id of ['home','ridge'])CivilCity.sum(consumed[id],e.paid);}else fail('政策');continue;}
      if(!Object.hasOwn(limits,e.city)||e.city==='ridge'&&(!d.node||e.at<d.origin.at))fail('付款人');
      const p=this.period(s,e.at);if(period!==p){period=p;used={home:{},lake:{},ridge:{}};}
      let expected;
      if(e.kind==='policy'){if(!this.budgets[e.ref]||limits[e.city]===e.ref)fail('预算议定');limits[e.city]=e.ref;expected={knowledge:4};}
      else{
        const key=e.city+':'+e.kind+':'+e.ref;if(unique.has(key))fail('重复付款');unique.add(key);
        if(e.kind==='inspection'){if(e.ref!==e.at||e.at%60)fail('检修时点');expected=this.inspectionCost(s,e.city,e.at);inspection[e.city]=e.at;}
        else if(e.kind==='lakeTrip'){const t=old.trips[e.ref-1];if(!['home','lake'].includes(e.city)||!t||t.startedAt!==e.at||e.ref<=d.legacyTrips||t.startedAt<d.at)fail('湖滨运费');expected=t.fees[e.city];}
        else if(e.kind==='lakeRepair'){const t=old.payments[e.ref-1];if(!['home','lake'].includes(e.city)||!t||t.at!==e.at||e.ref<=d.legacyRepairs||t.at<d.at)fail('湖滨路费');expected=t[e.city];}
        else if(e.kind==='ridgeTrip'){const t=d.trips[e.ref-1];if(!['home','ridge'].includes(e.city)||!t||t.startedAt!==e.at||!enabled)fail('矿岭运费');expected=this.fees();}
        else if(e.kind==='ridgeRepair'){const t=d.repairs[e.ref-1];if(!['home','ridge'].includes(e.city)||!t||t.at!==e.at)fail('矿岭路费');expected={wood:48,tools:8};}else fail('支出项目');
        if(e.kind.endsWith('Trip')&&(inspection[e.city]===null||e.at-inspection[e.city]>=120))fail('未检修出车');
        CivilCity.sum(used[e.city],e.paid);for(const [k,v]of Object.entries(used[e.city]))if(v>(this.budgets[limits[e.city]].limit[k]||0)+1e-6)fail('超预算');
      }
      if(!same(e.paid,expected))fail('支出费率');CivilCity.sum(consumed[e.city],e.paid);
    }
    if(!same(limits,d.budget)||!same(inspection,d.inspections)||enabled!==d.enabled||priority!==d.priority)fail('现行授权');
    let end=0,sent={},received={};
    for(const [i,p]of d.trips.entries()){
      if(!d.road?.completedAt||p.id!==i+1||!time(p.startedAt)||p.startedAt<d.road.completedAt||p.startedAt<end||!same(p.fees,this.fees())||!p.out||!p.back||Object.entries(p.out).some(([k,v])=>!({food:1200,medicine:96}[k])||!int(v)||!v||v>({food:1200,medicine:96}[k]))||Object.entries(p.back).some(([k,v])=>!({iron:96,tools:120}[k])||!int(v)||!v||v>({iron:96,tools:120}[k]))||CivilConurbation.value(p.out)<80||CivilConurbation.value(p.out)!==CivilConurbation.value(p.back))fail('运单');
      for(const id of ['home','ridge'])if(!unique.has(id+':ridgeTrip:'+p.id))fail('缺少运费');
      CivilCity.sum(sent,p.back);if(p.deliveredAt!==null){if(p.deliveredAt!==p.startedAt+this.travel||!time(p.deliveredAt))fail('到货时间');CivilCity.sum(received,p.out);}
      if(p.status==='complete'){if(p.finishedAt!==p.startedAt+this.travel*2||!time(p.finishedAt)||p.remaining!==0||p.deliveredAt===null)fail('返程');end=p.finishedAt;}
      else if(['outbound','returning'].includes(p.status)){const due=p.startedAt+(p.status==='outbound'?this.travel:this.travel*2);if(p.finishedAt!==null||!int(p.remaining)||p.remaining<1||due-s.civilization.elapsed!==p.remaining||(p.status==='outbound')!==(p.deliveredAt===null))fail('在途');end=Infinity;}else fail('运输状态');
    }
    if(typeof CivilCityCouncil!=='undefined'){const extra=CivilCityCouncil.transfers(s,'ridge');CivilCity.sum(sent,extra.sent);CivilCity.sum(received,extra.received);}
    if(d.node)for(const k of resources)if(!near(d.node.budget.sent[k]||0,sent[k]||0)||!near(d.node.budget.received[k]||0,received[k]||0))fail('地方收发');
    for(const [i,r]of d.repairs.entries()){if(!time(r.at)||!same(r.paid,{wood:48,tools:8}))fail('道路维护');for(const id of ['home','ridge'])if(!unique.has(id+':ridgeRepair:'+(i+1)))fail('缺少道路款');}
    if(d.road){let condition=100;const order=d.entries.filter(e=>e.city==='home'&&['ridgeRepair','ridgeTrip'].includes(e.kind));for(const e of order){if(e.kind==='ridgeRepair'){if(condition>=20)fail('重复修路');condition=100;}else{if(condition<20)fail('坏路出车');condition-=20;}}if(d.road.condition!==condition)fail('路况');}
    if(old.trips.slice(0,d.legacyTrips).some(p=>p.startedAt>d.at)||old.payments.slice(0,d.legacyRepairs).some(p=>p.at>d.at))fail('旧账边界');
    const departures=[...old.trips.slice(d.legacyTrips).map(p=>({at:p.startedAt,route:'lake',ref:p.id})),...d.trips.map(p=>({at:p.startedAt,route:'ridge',ref:p.id}))];
    // Same-second departures may be either order; each must appear exactly once.
    if(d.departures.length!==departures.length||new Set(d.departures.map(e=>e.route+e.ref)).size!==departures.length||d.departures.some((e,i)=>!departures.some(x=>same(x,e))||i&&e.at<d.departures[i-1].at))fail('发运记录');
    for(const p of old.trips.slice(d.legacyTrips))for(const id of ['home','lake'])if(!unique.has(id+':lakeTrip:'+p.id))fail('缺少湖滨运费');
    for(const [i,p]of old.payments.entries())if(i>=d.legacyRepairs)for(const id of ['home','lake'])if(!unique.has(id+':lakeRepair:'+(i+1)))fail('缺少湖滨维护费');
    const all=[...old.trips,...d.trips].filter(p=>(p.finishedAt??Infinity)>d.at);
    for(const p of all){const at=Math.max(p.startedAt,d.at),busy=all.filter(q=>q.startedAt<=at&&(q.finishedAt??Infinity)>at).length;if(busy>this.capacity(s,at))fail('共同车辆超用');}
    for(const id of ['home','lake',...(d.node?['ridge']:[])]){const n=this.local(s,id);if(id!=='ridge')CivilCity.sum(consumed[id],this.charterCost);if(id==='home'&&survey)CivilCity.sum(consumed[id],this.surveyCost);if(d.road&&id!=='lake')CivilCity.sum(consumed[id],this.roadCost);if(d.expansion&&id==='home')CivilCity.sum(consumed[id],d.expansion.paid);for(const [k,v]of Object.entries(consumed[id]))if((n.budget.consumed[k]||0)+1e-6<v)fail('公仓未支付');}
    last=d.at;for(const e of d.history){if(!time(e.at)||e.at<last||typeof e.text!=='string'||e.text.length>300)fail('历史');last=e.at;}
  }
};
