/* MPL-2.0 — Municipal wage work. Residents keep their home census entry;
 * reservations describe the same people, never another population. Wages are
 * physical food held in escrow, carried home and consumed by households. */
var CivilCityLabor={
  cost:{wood:120,tools:24,knowledge:12},fee:{wood:6,tools:1,knowledge:.5},
  capacity:120,duration:300,wage:.24,
  trades:{
    home:{name:'木作供应',job:'gatherer',input:{tools:.01},output:{wood:2}},
    lake:{name:'粮作供应',job:'farmer',input:{tools:.01},output:{food:2.8}},
    ridge:{name:'回收供应',job:'salvager',input:{tools:.01},output:{scrap:1.6}},
    estuary:{name:'药务供应',job:'medic',input:{food:.2,scrap:.1,tools:.01,knowledge:.02},output:{medicine:.3}},
    bridge:{name:'学堂助教',job:'teacher',input:{wood:.1},output:{knowledge:.3}}
  },
  data(s){return s.civilization.cityLabor;},c(){return CivilCityCouncil;},h(){return CivilCityHomes;},x(){return CivilCityContinuity;},
  city(s,id){return this.c().logical(s,id);},count(a){return CivilPopulation.count(a);},
  demand(s,id,order=this.contract(s,this.city(s,id))){if(!this.ready(s,id))return 0;const city=this.city(s,id),n=this.c().local(s,city),trade=this.trade(s,city,order);if(trade.job==='teacher')return Math.min(this.slots(s,id),Math.ceil(CivilPopulation.children(n.cohorts)/20));const target=CivilCity.targets(n,s,this.c().physical(s,city));return Math.min(this.slots(s,id),Math.max(...Object.entries(trade.output).map(([k,v])=>Math.ceil(Math.max(0,target[k]-(n.stores[k]||0))/v))));},
  available(s){return this.x().ready(s,'home')&&this.c().membersAt(s,s.civilization.elapsed).length>=3;},
  office(s,id){return this.data(s)?.offices[this.city(s,id)];},
  schoolPlaces(s,id){if(!this.ready(s,id))return 0;const city=this.city(s,id),physical=this.c().physical(s,city),n=this.c().local(s,city),extra=this.x().local(s,city)?.policy==='local'&&this.x().need(s,city)>0?2:0;return Math.min(this.capacity,Math.max(0,Math.ceil(CivilPopulation.children(n.cohorts)/20)+extra-Math.ceil(CivilCity.serviceCapacity(s,physical)*.02)));},
  slots(s,id){return this.capacity-this.schoolPlaces(s,id);},
  ready(s,id){const o=this.office(s,id);return !!o&&o.completedAt!==null;},
  active(s,id){return this.ready(s,id)&&this.office(s,id).enabled&&this.c().activeOffice(s,this.city(s,id));},
  shifts(s){return (this.data(s)?.shifts||[]).filter(p=>p.finishedAt===null);},
  groups(s,p){return this.h().aged(p.cohorts,p.at,s.civilization.elapsed);},
  protected(s,id){const city=this.city(s,id);return this.x().merge(this.shifts(s).filter(p=>p.from===city).flatMap(p=>this.groups(s,p)));},
  away(s,id){const city=this.city(s,id);return this.shifts(s).filter(p=>p.from===city&&p.from!==p.to).reduce((n,p)=>n+p.count,0);},
  guests(s,id){const city=this.city(s,id);return this.shifts(s).filter(p=>p.to===city&&p.from!==p.to&&p.phase==='working').reduce((n,p)=>n+p.count,0);},
  beds(s,id){const city=this.city(s,id),d=this.data(s);return (d?.contracts||[]).filter(o=>o.to===city&&o.from!==o.to&&o.endedAt===null).reduce((n,o)=>n+o.count,0)+this.shifts(s).filter(p=>p.to===city&&p.from!==p.to&&p.leftAt===null&&d.contracts[p.order-1].endedAt!==null).reduce((n,p)=>n+p.count,0);},
  lodgingCost(count){return {wood:count,tools:count/6,medicine:count*.1};},
  lodgingFee(count){return {wood:count*.02,tools:count*.002,medicine:count*.005};},
  lodgingReady(s,o){return o.from===o.to||o.id===undefined||o.lastLodgingAt!==null&&s.civilization.elapsed-o.lastLodgingAt<120;},
  busy(s,id){return this.shifts(s).some(p=>p.from===this.city(s,id)&&p.from!==p.to);},
  crew(s,id){return this.busy(s,id)?4:0;},
  present(s,id){return CivilCity.count(CivilCity.node(s,id))-this.away(s,id)+this.guests(s,id);},
  candidates(s,id,count,order){
    if(order?.version===2)return this.skilledCandidates(s,id,count);
    const a=this.c(),physical=a.physical(s,id),n=a.local(s,id),inst=CivilCityInstitutions.local(s,physical);
    const used=[...this.h().settled(s,id),...this.x().extraProtected(s,id),...this.unqualifiedProtected(s,id),...CivilCityInstitutions.qualified(s,physical,'craft'),...CivilCityInstitutions.qualified(s,physical,'care'),...(inst?.training?CivilCityInstitutions.aged(inst.training.cohorts,inst.training.startedAt,s.civilization.elapsed):[])];
    return this.x().pick(this.x().subtract(n.cohorts,used),count,50);
  },
  idle(s,id){const n=this.c().local(s,id);return Math.max(0,CivilCity.workforce(n)-Object.values(n.workers).reduce((a,b)=>a+b,0));},
  buildReason(s,id){if(!this.available(s))return '先完成接续工坊与三城公用站';if(!this.c().membersAt(s,s.civilization.elapsed).includes(id)||!this.trades[id])return '当地尚未登记公用站';if(this.office(s,id))return '当地劳务工位已有登记';if(!this.c().activeOffice(s,id))return '先续办当地公用站';return this.c().payReason(s,id,this.cost,'laborBuild');},
  build(s,id){if(this.buildReason(s,id))return false;const at=s.civilization.elapsed;
    if(!this.data(s))s.civilization.cityLabor={schema:1,at,offices:{},contracts:[],shifts:[],households:{}};
    this.c().pay(s,id,'laborBuild',id,this.cost);this.data(s).offices[id]={at,paid:{...this.cost},worked:0,remaining:120,completedAt:null,enabled:true,changes:[]};this.c().replan(s);this.c().note(s,this.c().name(s,id)+'实付开设120个'+this.trades[id].name+'劳务工位，20名居民安装120秒；工资仍须逐班封存。');return true;
  },
  set(s,id,value){const o=this.office(s,id);if(!this.ready(s,id)||typeof value!=='boolean'||o.enabled===value||!CivilCity.pay(this.c().local(s,id),{knowledge:2}))return false;
    const r=this.c().record(s,id,'laborPolicy',id,{knowledge:2},{value});o.enabled=value;o.changes.push(r.id);this.c().replan(s);this.c().note(s,this.c().name(s,id)+(value?'恢复劳务委托，按既定来源和真实空缺续班。':'暂停劳务委托，已挣工资保留，驻班人员结束本轮后返乡。'));return true;
  },
  contract(s,id){return this.data(s)?.contracts.find(o=>o.to===id&&o.endedAt===null);},
  orderReason(s,from,to,count,task='supply'){if(!['supply','food','tools'].includes(task))return '尚无这项班组工序';if(!this.ready(s,to))return '先在雇用城市建成劳务工位';if(this.contract(s,to))return '先结束当地旧委托，再改变来源或人数';if(![24,60,120].includes(count))return '每班24、60或120人';return this.departureReason(s,{from,to,count,...(task==='supply'?{}:{version:2,task})},true);},
  order(s,from,to,count,task='supply'){if(this.orderReason(s,from,to,count,task))return false;const d=this.data(s),o={id:d.contracts.length+1,at:s.civilization.elapsed,from,to,count,lastAt:null,endedAt:null,paid:from===to?{}:this.lodgingCost(count),lastLodgingAt:from===to?null:s.civilization.elapsed,services:[],...(task==='supply'?{}:{version:2,task,recognition:{...this.recognitionCost}})};if(o.version===2)this.c().pay(s,to,'laborRecognition',o.id,o.recognition);if(from!==to)this.c().pay(s,to,'laborLodging',o.id,o.paid);d.contracts.push(o);this.c().note(s,this.c().name(s,to)+'按班预付粮酬，向'+this.c().name(s,from)+'委托'+count+'个'+this.trade(s,to,o).name+'岗位。'+(from===to?'居民留在本地工作。':'居民保留原址，通勤期间暂离原城排班，临住与诊疗由雇用城市承担。'));return true;},
  cancel(s,id){const o=this.contract(s,id);if(!o)return false;o.endedAt=s.civilization.elapsed;this.c().note(s,this.c().name(s,id)+'结束后续劳务委托；已出发班次按原约结清，不扣回已挣工资。');return true;},
  quote(s,o){const distance=o.from===o.to?0:this.c().path(s,o.from,o.to)?.distance;
    return {distance,escrow:{food:o.count*this.wage*30},pack:{food:distance?Math.ceil((o.count+4)*.012*(2*distance+this.duration)):0},fee:distance?{...this.fee}:{}};
  },
  departureReason(s,o,preview=false,probe=false){
    const {from,to,count}=o,a=this.c();if(!this.active(s,to))return '雇用城市劳务委托或公用站未续办';if(!a.membersAt(s,s.civilization.elapsed).includes(from)||!a.activeOffice(s,from))return '来源城公用事务尚未续办';
    if(count>this.slots(s,to))return '当地须留'+this.schoolPlaces(s,to)+'个工位作补充课堂，当前可用工位'+this.slots(s,to);
    if(this.shifts(s).some(p=>p.to===to))return '当地上一班尚未结清';if(!preview&&!this.demand(s,to,o))return '当地储备已足，保留委托，暂不发班';if(!preview&&o.lastAt!==null&&s.civilization.elapsed-o.lastAt<600)return '先观察本期产销和家庭收入，下期再开班';
    const n=a.local(s,from),target=a.local(s,to),q=this.quote(s,o);if(q.distance===undefined)return '两城尚无公共通路';if(q.distance>720)return '路程超过当前轮班车辆的保障半径';
    const taskReason=this.taskReason(s,o);if(taskReason)return taskReason;
    if(this.count(this.candidates(s,from,count,o))<count||this.idle(s,from)<(o.version===2?0:count)+(from===to?0:4))return '来源须留足原有职责，再安排本班成年居民与驾驶员';
    if(from!==to){if(this.h().freeBeds(s,to)+(o.id&&o.endedAt===null?o.count:0)<count)return '雇用城市临住空床不足，含已承诺入住与返乡预留';if(this.busy(s,from)||this.h().busy(s,from)||a.activeLegs(s).some(l=>l.from===from))return '来源勤务车尚未返回，通勤、迁居和供料共用车辆';if(this.h().wantsVehicle(s,from))return '先履行已经签订的迁居约';}
    if(!this.lodgingReady(s,o))return '临住房维护未续办，先恢复当地公共预算';
    if(target.health<60||target.stable<120||n.health<60||n.stable<120)return '双方先恢复基本供养';
    const sourceCost={...q.pack};a.sum(sourceCost,q.fee);if(from===to){a.sum(sourceCost,q.escrow);if(preview&&o.version===2)a.sum(sourceCost,this.recognitionCost);}
    const employerCost={...q.escrow};if(preview&&from!==to){a.sum(employerCost,this.lodgingCost(count));if(o.version===2)a.sum(employerCost,this.recognitionCost);}
    return a.payReason(s,from,sourceCost,probe?'probe':'laborEscrow')||(from===to?null:a.payReason(s,to,employerCost,probe?'probe':'laborEscrow'))||(!preview&&!probe&&typeof CivilCityBudget!=='undefined'?CivilCityBudget.departureReason(s,o):null);
  },
  send(s,id,kind,ref,goods){const a=this.c(),n=a.local(s,id);CivilRules.pay({stores:n.stores},goods);a.sum(n.budget.sent,goods);a.record(s,id,kind,ref,goods);},
  depart(s,o){if(this.departureReason(s,o))return false;const d=this.data(s),a=this.c(),q=this.quote(s,o),at=s.civilization.elapsed,cohorts=this.candidates(s,o.from,o.count,o),p={id:d.shifts.length+1,order:o.id,from:o.from,to:o.to,count:o.count,at,cohorts,path:o.from===o.to?null:a.path(s,o.from,o.to),pack:q.pack,fee:q.fee,escrow:q.escrow.food,earned:0,refunded:0,food:q.pack.food,consumed:0,received:0,hospitality:0,rounds:[],phase:o.from===o.to?'working':'outbound',remaining:o.from===o.to?this.duration:q.distance,arrivedAt:o.from===o.to?at:null,leftAt:null,finishedAt:null,reason:null};
    if(q.distance){a.pay(s,o.from,'laborTravel',p.id,q.fee);this.send(s,o.from,'laborPack',p.id,q.pack);}this.send(s,o.to,'laborEscrow',p.id,q.escrow);d.shifts.push(p);o.lastAt=at;a.replan(s);return true;
  },
  workers(s,id){return this.shifts(s).filter(p=>p.to===this.city(s,id)&&p.phase==='working'&&p.count<=this.slots(s,id)&&this.active(s,id)).reduce((n,p)=>n+p.count,0);},
  reservedOutput(s,id,job){const p=this.shifts(s).find(p=>p.to===this.city(s,id)&&p.phase==='working'),order=p&&this.data(s).contracts[p.order-1],trade=this.trade(s,id,order),count=this.workers(s,id);return (order?.version===2||trade?.job===job)&&count?Object.fromEntries(Object.entries(trade.output).map(([k,v])=>[k,v*count])):{};},
  plan(s,id,slots,want,reserved){const city=this.city(s,id),o=this.office(s,id);const own=this.count(this.protected(s,id));if(own)reserved.wageworker=own;
    if(o&&o.completedAt===null)reserved.wagebuilder=20;
    // Existing paid benches can become temporary classrooms. Those places cease
    // to be vacancies, and the extra teachers still consume local wood and food.
    slots.teacher+=this.schoolPlaces(s,id);
    const n=CivilCity.node(s,id),extra=this.guests(s,id)-this.away(s,id);
    if(extra){want.waterworker=n.waterEnabled?Math.ceil(this.present(s,id)/CivilCity.waterPerWorker(n)):0;want.medic=Math.max(1,want.medic+Math.ceil(extra*.01/(city==='estuary'?.3:.15)));}
    // Paid shifts take over an existing supply duty; they do not grant a second
    // job to the same residents. A teacher shift also has actual pupils to cover.
    const p=this.shifts(s).find(p=>p.to===city&&p.phase==='working'),order=p&&this.data(s).contracts[p.order-1],count=this.workers(s,id),trade=this.trade(s,id,order),job=trade?.job;
    if(count&&job){const rate=order?.version===2?(job==='smith'?trade.output.tools/(n.method==='standard'?.6:.25):trade.output.food/CivilCity.config(id).foodRate):1;want[job]=Math.max(0,want[job]-Math.floor(count*rate));}
  },
  produce(s,id,run,wet){const city=this.city(s,id),n=CivilCity.node(s,id);if(!this.trades[city])return {taught:0,cared:0};let taught=0,cared=0;
    for(const p of this.shifts(s).filter(p=>p.to===city&&p.phase==='working')){
      const trade=this.trade(s,id,this.data(s).contracts[p.order-1]),at=s.civilization.elapsed;if(p.rounds.at(-1)?.at===at)continue;
      let reason=p.count>this.slots(s,city)?'工位改作补充课堂，本班先行结清':!this.active(s,city)?'当地暂停或未续办':!this.lodgingReady(s,this.data(s).contracts[p.order-1])?'临住维护未续办':!wet?'供水中断':null;
      const target=CivilCity.targets(n,s,id),workers=trade.job==='teacher'?p.count:Math.min(p.count,Math.max(...Object.entries(trade.output).map(([k,v])=>Math.ceil(Math.max(0,target[k]-(n.stores[k]||0))/v))));
      if(!workers)reason=reason||'当地储备已足，结束本班';
      const inputs=Object.fromEntries(Object.entries(trade.input).map(([k,v])=>[k,v*workers])),meal=p.from===p.to?0:p.count*.12,cost={...inputs};cost.food=(cost.food||0)+meal;
      if(!reason)reason=this.c().payReason(s,city,cost,'laborInput');
      if(reason){p.reason=reason;this.leave(s,p);continue;}
      // Inputs are consumed; reimbursement is a physical return cargo. Home
      // packed all journey meals, so guests never eat from two warehouses.
      this.c().pay(s,city,'laborInput',p.id+':'+(p.rounds.length+1),inputs);
      if(meal)this.send(s,city,'laborMeals',p.id+':'+(p.rounds.length+1),{food:meal});
      const output=Object.fromEntries(Object.entries(trade.output).map(([k,v])=>[k,Math.min(v*workers,Math.max(0,target[k]-(n.stores[k]||0)))]));
      for(const [k,v]of Object.entries(output)){n.stores[k]=(n.stores[k]||0)+v;n.budget.produced[k]=(n.budget.produced[k]||0)+v;}
      const wage=workers*this.wage;p.earned+=wage;p.hospitality+=meal;p.rounds.push({at,workers,paid:inputs,output,wage,meal});
      if(trade.job==='teacher')taught+=workers;if(trade.job==='medic')cared+=workers;
      if(p.rounds.length===30){p.reason='完成本班';this.leave(s,p);}
    }return {taught,cared};
  },
  leave(s,p){if(p.leftAt!==null)return;p.leftAt=s.civilization.elapsed;p.refunded=Math.max(0,p.escrow-p.earned);CivilConurbation.receive(this.c().local(s,p.to),{food:p.refunded});
    p.phase='returning';p.remaining=p.path?.distance||0;if(!p.remaining)this.finish(s,p);this.c().replan(s);
  },
  finish(s,p){if(p.finishedAt!==null)return;p.finishedAt=s.civilization.elapsed;p.phase='complete';p.remaining=0;p.received=p.food+p.hospitality;CivilConurbation.receive(this.c().local(s,p.from),{food:p.received});p.food=0;
    const d=this.data(s),h=d.households[p.from]||(d.households[p.from]={food:0,received:0,consumed:0,rounds:0,lastAt:null});h.food+=p.earned;h.received+=p.earned;
    this.c().note(s,this.c().name(s,p.from)+'的'+p.count+'名居民'+(p.from===p.to?'结清本班':'乘原车返乡')+'，带回粮酬'+Math.round(p.earned*100)/100+'。'+p.rounds.length+'轮实际工作；未挣预付已退回雇用公仓，旅粮余款与实付驻班口粮返还来源公仓。');this.c().replan(s);
  },
  feed(s,id,need){const h=this.data(s)?.households[this.city(s,id)];if(!h||!h.food)return 0;const used=Math.min(need,h.food);h.food-=used;h.consumed+=used;h.rounds++;h.lastAt=s.civilization.elapsed;return used;},
  transfers(s,id){const sent={},received={};for(const p of this.data(s)?.shifts||[]){if(p.from===id&&p.from!==p.to)sent.food=(sent.food||0)+p.pack.food;if(p.to===id){sent.food=(sent.food||0)+p.escrow+p.hospitality;if(p.leftAt!==null)received.food=(received.food||0)+p.refunded;}if(p.from===id&&p.finishedAt!==null)received.food=(received.food||0)+p.received;}return {sent,received};},
  tick(s){const d=this.data(s);if(!d)return;const at=s.civilization.elapsed,a=this.c();
    for(const [id,o]of Object.entries(d.offices))if(o.completedAt===null&&a.activeOffice(s,id)&&a.local(s,id).economy?.ate&&a.local(s,id).workers.wagebuilder===20){o.worked++;o.remaining--;if(!o.remaining){o.completedAt=at;a.replan(s);}}
    if(at%60===0)for(const o of d.contracts)if(o.from!==o.to&&(o.endedAt===null||this.shifts(s).some(p=>p.order===o.id&&p.leftAt===null))){const paid=a.activeOffice(s,o.to)&&a.pay(s,o.to,'laborLodgingService',o.id+':'+at,this.lodgingFee(o.count));o.services.push({at,paid:!!paid});if(paid)o.lastLodgingAt=at;}
    for(const p of this.shifts(s)){
      if(p.from!==p.to&&at>p.at){const meal=(p.count+4)*.012;if(p.food+1e-7<meal)throw Error('通勤封存口粮不足');p.food=Math.max(0,p.food-meal);p.consumed+=meal;}
      if(p.phase==='working'){if(!this.active(s,p.to)||at-p.arrivedAt>=this.duration){p.reason=p.reason||(!this.active(s,p.to)?'当地暂停或未续办':'班期结束');this.leave(s,p);}continue;}
      // A departure or early-return transition at this second consumes no
      // travel second until the following tick.
      if(at===(p.leftAt??p.at))continue;
      if(--p.remaining>0)continue;
      if(p.phase==='outbound'){p.phase='working';p.arrivedAt=at;p.remaining=this.duration;a.replan(s);}else this.finish(s,p);
    }
    if(at%10===0){a.replan(s);for(const o of d.contracts)if(o.endedAt===null)this.depart(s,o);a.replan(s);}
  }
};
