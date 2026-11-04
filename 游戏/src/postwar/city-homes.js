/* MPL-2.0 — Finite resettlement contracts. Every household keeps its age/identity,
 * every ration is either in a warehouse, in transit, or consumed. */
var CivilCityHomes={
  schemes:{neighborhood:{name:'安居街区',beds:3200,jobs:320,builders:60,duration:600,cost:{wood:1440,tools:288,medicine:96,knowledge:72}},district:{name:'成片社区',beds:8000,jobs:800,builders:120,duration:900,cost:{wood:3200,tools:640,medicine:240,knowledge:160}}},
  modes:{food:'合作粮作',tools:'合作制器'},
  data(s){return s.civilization.cityHomes;},c(){return CivilCityCouncil;},copy(x){return JSON.parse(JSON.stringify(x));},
  init(s){if(!this.data(s))s.civilization.cityHomes={schema:1,at:s.civilization.elapsed,estates:{},orders:[],trips:[]};return this.data(s);},
  estate(s,id){return this.data(s)?.estates[this.c().logical(s,id)];},
  account(s,id){return id==='home'?'ward_'+this.c().depot(s):'city_'+id;},
  project(s,id){const e=this.estate(s,id);return e?this.c().data(s).projects[e.project-1]:null;},
  cfg(s,id){const p=this.project(s,id);return p?this.schemes[p.kind]:null;},
  register(s,p){if(!this.schemes[p.kind])return;const d=this.init(s);d.estates[p.target]={project:p.id,at:p.completedAt,enabled:true,mode:'food',condition:100,lastPaidAt:null,records:[],changes:[]};},
  fee(s,id){const scale=this.cfg(s,id).beds/800;return {wood:4*scale,tools:.8*scale,medicine:scale,knowledge:.2*scale};},
  maintainers(s,id){return this.cfg(s,id).beds/100;},
  active(s,id){const e=this.estate(s,id);return !!e&&e.enabled&&e.condition>=60&&e.lastPaidAt!==null&&s.civilization.elapsed-e.lastPaidAt<120&&this.c().activeOffice(s,this.c().logical(s,id));},
  note(s,text){this.c().note(s,text);},
  set(s,id,field,value){const e=this.estate(s,id);if(!e||!['enabled','mode'].includes(field)||field==='enabled'&&typeof value!=='boolean'||field==='mode'&&!this.modes[value]||e[field]===value)return false;const city=this.c().logical(s,id),paid={knowledge:2};if(!CivilCity.pay(this.c().local(s,city),paid))return false;
    e[field]=value;const r=this.c().record(s,city,'homesPolicy',e.project,paid,{field,value});e.changes.push(r.id);this.c().replan(s);this.note(s,this.c().name(s,city)+(field==='enabled'?(value?'恢复安居维护。':'暂停安居维护，居民保留住所，新接纳与合作岗位暂停。'):'把接纳岗位改为'+this.modes[value]+'，实际投入与产品均计入当地公仓。'));return true;},
  aged(groups,at,now){const y=Math.floor(now/600)-Math.floor(at/600);return groups.map(c=>({...c,age:c.age+y})).filter(c=>c.age<80);},
  merge(groups){const m=new Map();for(const c of groups){const key=c.age+'_'+c.identity;if(m.has(key))m.get(key).count+=c.count;else if(c.count)m.set(key,{...c});}return [...m.values()];},
  settled(s,id,workers=false){const city=this.c().logical(s,id),groups=(this.data(s)?.trips||[]).filter(p=>p.outcome==='arrived'&&p.to===city).flatMap(p=>this.aged(p.initial,p.at,s.civilization.elapsed));return this.merge(workers?groups.filter(c=>c.age>=18&&c.age<65):groups);},
  count(groups){return CivilPopulation.count(groups);},
  activeTrips(s){return (this.data(s)?.trips||[]).filter(p=>p.settledAt===null);},
  busy(s,id){return (this.data(s)?.trips||[]).some(p=>p.from===id&&p.finishedAt===null);},
  crew(s,id){return this.busy(s,this.c().logical(s,id))?4:0;},
  reserved(s,id,ignore=null){const city=this.c().logical(s,id);return this.activeTrips(s).filter(p=>p!==ignore&&(p.to===city||p.from===city)).reduce((n,p)=>n+this.count(p.cohorts),0);},
  freeBeds(s,id,ignore=null){const city=this.c().logical(s,id),physical=this.c().physical(s,city),n=this.c().local(s,city),e=this.estate(s,city),beds=CivilCity.housing(s,physical)-(e&&!this.active(s,city)?this.cfg(s,city).beds:0);return Math.max(0,beds-CivilCity.count(n)-this.reserved(s,city,ignore));},
  birthBeds(s,id){if(!this.c().data(s))return CivilCity.housing(s,id)-CivilCity.count(CivilCity.node(s,id));return this.freeBeds(s,id);},
  freeJobs(s,id,ignore=null){const city=this.c().logical(s,id),cfg=this.cfg(s,city);return cfg?Math.max(0,cfg.jobs-CivilPopulation.workforce(this.settled(s,city))-this.activeTrips(s).filter(p=>p!==ignore&&p.to===city).reduce((n,p)=>n+CivilPopulation.workforce(p.cohorts),0)):0;},
  candidates(s,from){const id=this.c().physical(s,from),n=this.c().local(s,from),x=CivilCityInstitutions.local(s,id),used=new Map();
    const protectedGroups=[...CivilCityInstitutions.qualified(s,id,'craft'),...CivilCityInstitutions.qualified(s,id,'care'),...(x?.training?CivilCityInstitutions.aged(x.training.cohorts,x.training.startedAt,s.civilization.elapsed):[]),...this.settled(s,from)];
    for(const c of protectedGroups){const k=c.age+'_'+c.identity;used.set(k,(used.get(k)||0)+c.count);}
    const pool=n.cohorts.map(c=>({...c,count:Math.max(0,c.count-(used.get(c.age+'_'+c.identity)||0))})).filter(c=>c.count),out=[];
    for(const [test,wanted]of [[c=>c.age>=18&&c.age<60,60],[c=>c.age<18,36],[c=>c.age>=65,24]]){const group=pool.filter(test),total=this.count(group);if(total<wanted)return [];let taken=0;for(const c of group){const count=Math.floor(c.count*wanted/total);out.push({...c,count});taken+=count;}for(let i=out.length-group.length;i<out.length&&taken<wanted;i++){const c=out[i],available=group[i-(out.length-group.length)].count;if(c.count<available){c.count++;taken++;}}}
    return out.filter(c=>c.count);
  },
  intakeReason(s,to,groups,ignore=null){const n=this.c().local(s,to);if(!this.estate(s,to))return '接收城须先建成安居街区或成片社区';if(!this.active(s,to))return '接收社区维护未续办或完好度不足60';if(!this.c().activeOffice(s,to))return '接收城公用事务尚未续办';if(n.stable<120||n.health<60)return '接收城基础供养尚未稳定';if(this.freeBeds(s,to,ignore)<this.count(groups))return '接收城空床不足，含已在途与返乡预留';if(this.freeJobs(s,to,ignore)<CivilPopulation.workforce(groups))return '接收社区保留岗位不足';
    const food=(CivilPopulation.foodPopulation(n.cohorts)+CivilPopulation.foodPopulation(groups))*.12*6,med=(CivilCity.count(n)+this.count(groups))*.01*4;
    if(n.stores.food+1e-7<food||n.stores.medicine+1e-7<med)return '接收城须备足入住后6轮口粮与4轮诊疗';return null;},
  pack(groups,distance,at){const duration=2*distance+120,years=Math.floor((at+duration)/600)-Math.floor(at/600);let mouths=0;for(let y=0;y<=years;y++)mouths=Math.max(mouths,CivilPopulation.foodPopulation(groups.map(c=>({...c,age:c.age+y})).filter(c=>c.age<80)));return {food:Math.ceil(mouths*.12*duration/10)};},
  departureReason(s,from,to){const api=this.c();if(from===to)return '请选择另一座来源城市';if(!api.membersAt(s,s.civilization.elapsed).includes(from)||!api.membersAt(s,s.civilization.elapsed).includes(to))return '两城须先完成公用站登记';const path=api.path(s,from,to);if(!path)return '两城尚无公共通路';const groups=this.candidates(s,from);if(this.count(groups)!==120)return '来源须有60名成年、36名儿童和24名老人自愿家庭，且不占专业或既有安置名册';const reason=this.intakeReason(s,to,groups);if(reason)return reason;
    if(this.busy(s,from)||api.activeLegs(s).some(l=>l.from===from))return '来源勤务车尚未返回，迁居与共同供料共用车辆';if(!api.activeOffice(s,from))return '来源城公用事务尚未续办';const n=api.local(s,from),assigned=Object.values(n.workers).reduce((a,b)=>a+b,0);if(CivilCity.workforce(n)-assigned<64)return '来源须留足原有岗位，再安排60名成年居民和4名驾驶员';const cost=api.copy(this.pack(groups,path.distance,s.civilization.elapsed));api.sum(cost,api.legFee(path.distance));return api.payReason(s,from,cost);},
  orderReason(s,from,to,total){if(![120,480].includes(total))return '本次接纳120或480人';if(this.data(s)?.orders.some(o=>o.endedAt===null))return '先完成或撤销现有迁居约';return this.departureReason(s,from,to);},
  order(s,from,to,total){if(this.orderReason(s,from,to,total))return false;const d=this.data(s);d.orders.push({id:d.orders.length+1,from,to,total,at:s.civilization.elapsed,endedAt:null,cancelled:false});this.note(s,this.c().name(s,from)+'与'+this.c().name(s,to)+'签订'+total+'人迁居约，每批120人，逐批复核住房、保留岗位、供养和车辆；未出发者仍在原处。');return true;},
  cancel(s){const o=this.data(s)?.orders.find(o=>o.endedAt===null);if(!o)return false;o.cancelled=true;o.endedAt=s.civilization.elapsed;this.note(s,'撤销迁居约未出发部分。已在途家庭继续按预留住房接收或原路返乡。');return true;},
  remove(n,groups){for(const c of groups){const old=n.cohorts.find(x=>x.age===c.age&&x.identity===c.identity);if(!old||old.count<c.count)throw Error('迁居家庭不在来源名册');old.count-=c.count;}n.cohorts=n.cohorts.filter(c=>c.count);},
  depart(s,o){if(this.departureReason(s,o.from,o.to))return false;const api=this.c(),d=this.data(s),at=s.civilization.elapsed,groups=this.candidates(s,o.from),path=api.path(s,o.from,o.to),pack=this.pack(groups,path.distance,s.civilization.elapsed),fee=api.legFee(path.distance),n=api.local(s,o.from),p={id:d.trips.length+1,order:o.id,from:o.from,to:o.to,at,path,initial:this.copy(groups),cohorts:this.copy(groups),year:Math.floor(at/600),dead:0,food:pack.food,consumed:0,pack,fee,phase:'outbound',remaining:path.distance,arrivedAt:null,waited:0,settledAt:null,outcome:null,received:0,finishedAt:null};
    api.pay(s,o.from,'moveFee',p.id,fee);CivilRules.pay({stores:n.stores},pack);api.sum(n.budget.sent,pack);api.record(s,o.from,'movePack',p.id,pack);this.remove(n,groups);CivilCensus.move(s,this.account(s,o.from),'transit',120,'安居迁居#'+p.id+'出发');d.trips.push(p);api.replan(s);return true;},
  settle(s,p,returned){const id=returned?p.from:p.to,n=this.c().local(s,id),count=this.count(p.cohorts);CivilCensus.move(s,'transit',this.account(s,id),count,'安居迁居#'+p.id+(returned?'返乡':'入住'));n.cohorts=this.merge([...n.cohorts,...p.cohorts]);p.cohorts=[];p.outcome=returned?'returned':'arrived';p.settledAt=s.civilization.elapsed;p.received=p.food;CivilConurbation.receive(n,{food:p.food});p.food=0;
    if(returned){p.phase='complete';p.remaining=0;p.finishedAt=s.civilization.elapsed;}else{p.phase='empty';p.remaining=p.path.distance;}
    this.note(s,this.c().name(s,id)+(returned?'接回':'接纳')+count+'位家庭成员，剩余途中口粮'+Math.floor(p.received)+'入当地公仓。'+(returned?'原址床位解除预留。':'保留岗位与日常供养由接收城承担，车辆继续空返。'));this.c().replan(s);},
  delta(s,id){const city=this.c().logical(s,id);return (this.data(s)?.trips||[]).reduce((n,p)=>n-(p.from===city?120:0)+(p.settledAt!==null&&(p.outcome==='arrived'?p.to:p.from)===city?120-p.dead:0),0);},
  transfers(s,id){const sent={},received={};for(const p of this.data(s)?.trips||[]){if(p.from===id)sent.food=(sent.food||0)+p.pack.food;if(p.settledAt!==null&&(p.outcome==='arrived'?p.to:p.from)===id)received.food=(received.food||0)+p.received;}return {sent,received};},
  plan(s,id,slots,want,reserved){const e=this.estate(s,id);if(!e)return;const crew=this.maintainers(s,id);if(e.enabled&&this.c().activeOffice(s,this.c().logical(s,id)))reserved.homekeeper=crew;if(this.active(s,id))reserved.settler=Math.min(this.cfg(s,id).jobs,CivilPopulation.workforce(this.settled(s,id)));
    if(e.enabled){const fee=this.fee(s,id),clinical=id==='estuary'||CivilCityInstitutions.local(s,id)?.careMethod==='clinical',before=want.medic;const n=CivilCity.node(s,id),buffer=Math.max(0,(CivilCity.count(n)+this.reserved(s,id))*.01*8-n.stores.medicine)/60;want.medic+=Math.ceil((fee.medicine/6+buffer)/(clinical?.3:.15))+2;if(clinical&&id!=='estuary')want.medic=Math.min(want.medic,CivilCityInstitutions.skillLimit(s,id,'care'));const extra=Math.max(0,want.medic-before),cfg=CivilCity.config(id);want.farmer+=Math.ceil(extra*.2/cfg.foodRate);want.salvager+=Math.ceil(extra*.1/cfg.scrapRate);want.gatherer+=Math.ceil(fee.wood/6/cfg.woodRate);}
  },
  produce(s,id,run,wet){const e=this.estate(s,id);if(!e)return;if(this.active(s,id))run('settler',e.mode==='food'?{tools:.015}:{scrap:.8,wood:.2},{[e.mode==='food'?'food':'tools']:e.mode==='food'?1.6*(wet?1:.45):.3});},
  maintenanceTick(s){const d=this.data(s);if(!d)return;const t=s.civilization.elapsed,api=this.c();
    if(t%60===0)for(const [id,e]of Object.entries(d.estates)){const n=api.local(s,id),cost=this.fee(s,id),paid=e.enabled&&api.activeOffice(s,id)&&n.economy?.ate&&n.workers.homekeeper===this.maintainers(s,id)&&api.pay(s,id,'homeMaintenance',e.project+':'+t,cost);e.condition=Math.max(0,Math.min(100,e.condition+(paid?5:-4)));e.records.push({at:t,paid:!!paid,condition:e.condition});if(paid)e.lastPaidAt=t;}
  },
  wantsVehicle(s,id){const d=this.data(s),o=d?.orders.find(x=>x.endedAt===null&&x.from===id);return !!o&&d.trips.filter(p=>p.order===o.id).length*120<o.total&&!d.trips.some(p=>p.order===o.id&&p.finishedAt===null)&&!this.departureReason(s,o.from,o.to);},
  tick(s){const d=this.data(s);if(!d)return;const t=s.civilization.elapsed,api=this.c();
    for(const p of d.trips)if(p.finishedAt===null){
      if(p.settledAt===null){while(p.year<Math.floor(t/600)){const aged=CivilPopulation.age(p.cohorts);p.year++;p.cohorts=aged.cohorts;p.dead+=aged.deceased;CivilCensus.death(s,'transit',aged.deceased,'安居迁居#'+p.id+'途中离世');}
        const meal=CivilPopulation.foodPopulation(p.cohorts)*.12/10;if(p.food+1e-7<meal)throw Error('迁居封存口粮不足');p.food=Math.max(0,p.food-meal);p.consumed+=meal;
      }
      if(p.phase==='waiting'){p.waited++;if(!this.intakeReason(s,p.to,p.cohorts,p)){this.settle(s,p,false);continue;}if(p.waited>=120){p.phase='returning';p.remaining=p.path.distance;this.note(s,'第'+p.id+'批迁居等待接收超时，沿原路返乡。途中口粮和原址床位仍有预留。');}continue;}
      if(--p.remaining>0)continue;
      if(p.phase==='outbound'){p.arrivedAt=t;if(this.intakeReason(s,p.to,p.cohorts,p)){p.phase='waiting';p.remaining=0;}else this.settle(s,p,false);}
      else if(p.phase==='returning')this.settle(s,p,true);else if(p.phase==='empty'){p.phase='complete';p.finishedAt=t;api.replan(s);}
    }
    if(t%10===0){api.replan(s);const o=d.orders.find(x=>x.endedAt===null);if(o){const trips=d.trips.filter(p=>p.order===o.id);if(trips.length*120>=o.total)o.endedAt=t;else if(!trips.some(p=>p.finishedAt===null))this.depart(s,o);}api.replan(s);}
  }
};
