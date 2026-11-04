/* MPL-2.0 — Paid civic institutions, finite vocational cohorts and revocable delegation.
   The charter is opt-in: existing city saves keep their previous rules until it is signed. */
var CivilCityInstitutions = {
  charter: {home:{wood:120,tools:20,knowledge:60},local:{wood:80,tools:12,knowledge:30}},
  enrollment:{tools:12,knowledge:30}, lesson:{food:2,tools:.2,knowledge:1}, lessons:30,
  profiles:{balanced:'本地自给',provisioning:'粮食与诊疗',workshop:'回收与制器'},
  subjects:{craft:'技术工种',care:'临床医护'},
  data(s){return CivilCity.data(s)?.institutions;},
  local(s,id){return this.data(s)?.wards[id];},
  available(s){return CivilCity.enabled(s)&&CivilCity.data(s)?.cityAt!==null&&Number.isSafeInteger(CivilCity.data(s)?.cityAt);},
  reason(s){
    if(!this.available(s))return '先完成万人城域登记';
    if(this.data(s))return '城市公署已登记';
    if(!CivilRules.canPay(s,this.charter.home))return '原镇尚缺公署登记物资';
    for(const [id,n] of CivilCity.members(s)){
      if(n.stable<120)return CivilCityContent.wards[id].name+'公共服务尚未稳定';
      if(!CivilRules.canPay({stores:n.stores},this.charter.local))return CivilCityContent.wards[id].name+'尚缺教具与登记物资';
    }
    return null;
  },
  key(c){return c.age+'_'+c.identity;},
  merge(groups){
    const map=new Map();for(const c of groups){const key=this.key(c);if(map.has(key))map.get(key).count+=c.count;else if(c.count)map.set(key,{...c});}return [...map.values()];
  },
  aged(groups,at,now){const years=Math.floor(now/600)-Math.floor(at/600);return groups.map(c=>({...c,age:c.age+years})).filter(c=>c.age>=18&&c.age<65);},
  qualified(s,id,subject){
    const x=this.local(s,id);return x?this.merge(x.certificates.filter(c=>c.subject===subject).flatMap(c=>this.aged(c.cohorts,c.at,s.civilization.elapsed))):[];
  },
  trained(s,id,subject){return CivilPopulation.count(this.qualified(s,id,subject));},
  candidates(s,id,count){
    const n=CivilCity.data(s).wards[id],x=this.local(s,id),used=new Map(),out=[];
    const busy=[...(typeof CivilCityLabor!=='undefined'?CivilCityLabor.unqualifiedProtected(s,id):[]),...(typeof CivilCityHomes!=='undefined'?CivilCityHomes.settled(s,id,true):[]),...(typeof CivilCityContinuity!=='undefined'?CivilCityContinuity.extraProtected(s,id):[]),...this.qualified(s,id,'craft'),...this.qualified(s,id,'care'),...(x?.training?this.aged(x.training.cohorts,x.training.startedAt,s.civilization.elapsed):[])];
    for(const c of busy)used.set(this.key(c),(used.get(this.key(c))||0)+c.count);
    // Young adults first; this is a subset of the actual residents, never additional population.
    for(const c of [...n.cohorts].sort((a,b)=>a.age-b.age))if(c.age>=18&&c.age<=49){const take=Math.min(count,Math.max(0,c.count-(used.get(this.key(c))||0)));if(take){out.push({...c,count:take});count-=take;}if(!count)break;}
    return out;
  },
  found(s){
    if(this.reason(s))return false;const at=s.civilization.elapsed,wards={};
    CivilRules.pay(s,this.charter.home);
    const d=CivilCity.data(s);d.institutions={schema:1,at,paid:JSON.parse(JSON.stringify(this.charter)),wards,home:{enabled:false,mode:'reserves',lastAt:null,records:[],changes:[]}};
    for(const [id] of CivilCity.members(s))this.register(s,id);
    CivilCity.note(s,'policy','home','城市公署登记了现任教员与公共职责。培训占用真实居民和教具；原镇调度须另行授权，可随时停止。');
    return true;
  },
  registrationReason(s,id){
    const n=CivilCity.data(s)?.wards[id];
    if(!this.data(s))return '先筹设城市公署';
    if(this.local(s,id))return '本片区已登记';
    if(!n||n.joinedAt===null)return '先接入公共服务网络';
    if(n.stable<120)return '先使本片区公共服务稳定';
    return CivilRules.canPay({stores:n.stores},this.charter.local)?null:'当地公仓尚缺木80、工具12、知识30';
  },
  register(s,id){
    if(this.registrationReason(s,id))return false;
    const n=CivilCity.data(s).wards[id],at=s.civilization.elapsed;
    CivilCity.pay(n,this.charter.local);
    const x=this.data(s).wards[id]={registeredAt:at,paid:{...this.charter.local},profile:'balanced',careMethod:'basic',certificates:[],courses:[],training:null,nextCourse:1,changes:[],initialWorkers:{...n.workers}};
    for(const subject of ['craft','care']){
      const current=subject==='craft'?(n.workers.smith||0)+(n.workers.smelter||0):(n.workers.medic||0)+(n.workers.teacher||0);
      x.certificates.push({subject,at,source:'register',cohorts:this.candidates(s,id,Math.min(12,current))});
    }
    return true;
  },
  trainingReason(s,id,subject){
    const x=this.local(s,id),n=CivilCity.data(s)?.wards[id];
    if(!x||!Object.hasOwn(this.subjects,subject))return '先登记城市公署';
    if(x.training)return '当前培训尚未结束';
    if(this.trained(s,id,subject)<2&&(n.workers.teacher||0)<2)return '需要两名专业教员或学堂教师';
    if(CivilPopulation.count(this.candidates(s,id,24))<24)return '尚缺24名未登记专业资格的青年成人';
    if(!n.economy?.ate||!n.economy?.educated||n.economy.water<CivilCity.count(n))return '先恢复口粮、儿童课堂与供水';
    if((n.economy?.idle||0)<26)return '须为24名学员和2名教员留出劳力';
    return CivilRules.canPay({stores:n.stores},this.enrollment)?null:'当地公仓尚缺12工具、30知识';
  },
  enroll(s,id,subject){
    if(this.trainingReason(s,id,subject))return false;
    const x=this.local(s,id),n=CivilCity.data(s).wards[id],cohorts=this.candidates(s,id,24);
    CivilCity.pay(n,this.enrollment);
    const required=this.trained(s,id,subject)>=2?30:60;
    x.training={id:x.nextCourse++,subject,startedAt:s.civilization.elapsed,cohorts,rounds:0,required,paid:{...this.enrollment,food:0},lastAt:null};
    CivilCity.note(s,'policy',id,CivilCityContent.wards[id].name+'开设'+this.subjects[subject]+'培训：24名学员与2名教员离开常规岗位，完成'+required+'次实付课程后取得资格。');return true;
  },
  cancelTraining(s,id){
    const x=this.local(s,id);if(!x?.training)return false;
    x.courses.push({...x.training,endedAt:s.civilization.elapsed,result:'cancelled'});x.training=null;
    if(x.schoolEnabled)this.delegateSchool(s,id,false);
    CivilCity.note(s,'policy',id,CivilCityContent.wards[id].name+'停止本期培训与自动补员；居民返回可用劳力，已使用的教具不退还。');return true;
  },
  delegateSchool(s,id,enabled){
    const x=this.local(s,id);if(!x||typeof enabled!=='boolean'||!!x.schoolEnabled===enabled)return false;
    x.schoolEnabled=enabled;x.changes.push({at:s.civilization.elapsed,key:'schoolEnabled',value:enabled,paid:{}});return true;
  },
  schoolNeed(s,id){
    const x=this.local(s,id),n=CivilCity.data(s).wards[id];if(!x)return null;
    const needs={care:x.careMethod==='clinical'?Math.ceil(CivilCity.count(n)*.01/.3)+2:0,craft:n.method==='standard'&&x.profile!=='provisioning'?Math.ceil(Math.max(x.profile==='workshop'?32:0,Math.ceil(CivilCity.count(n)*.001/.25)+4)*1.25):0};
    // Look two calendar years ahead; a retiring cohort is replaced by paid teaching.
    for(const subject of ['care','craft']){
      const retained=this.qualified(s,id,subject).filter(c=>c.age<63).reduce((a,c)=>a+c.count,0);
      if(retained<needs[subject])return {subject,target:needs[subject],retained};
    }
    return null;
  },
  schoolTick(s,id){
    const x=this.local(s,id),n=CivilCity.data(s).wards[id];if(!x?.schoolEnabled||x.training)return;
    const need=this.schoolNeed(s,id);if(!need)return;
    // Do not spend emergency production inputs to open another class.
    if(n.stores.food<CivilCity.foodPopulation(s,id)*.12*6||n.stores.tools<60||n.stores.knowledge<60)return;
    this.enroll(s,id,need.subject);
  },
  trainingCrew(s,id){
    const x=this.local(s,id),t=x?.training;
    if(!t)return {apprentice:0,tutor:0};
    const teachers=CivilCity.data(s).wards[id].workers.teacher||0;
    return {apprentice:CivilPopulation.count(this.aged(t.cohorts,t.startedAt,s.civilization.elapsed)),tutor:Math.min(2,Math.max(teachers,this.trained(s,id,t.subject)))};
  },
  skillLimit(s,id,subject){const t=this.local(s,id)?.training;return Math.max(0,this.trained(s,id,subject)-(t?.subject===subject?this.trainingCrew(s,id).tutor:0));},
  settingCost(key){return key==='profile'?{knowledge:4,tools:1}:{knowledge:6,tools:2};},
  settingReason(s,id,key,value){
    const x=this.local(s,id),n=CivilCity.data(s)?.wards[id];if(!x)return '本片区尚未登记机构';
    if(key==='profile'&&!Object.hasOwn(this.profiles,value)||key==='careMethod'&&!['basic','clinical'].includes(value)||!['profile','careMethod'].includes(key))return '无此生产安排';
    if(x[key]===value)return '当前已经采用';
    if(key==='careMethod'&&value==='clinical'&&(!s.civilization.tech.sanitation||this.trained(s,id,'care')<2))return '先完成公共卫生并培养两名临床人员';
    return CivilRules.canPay({stores:n.stores},this.settingCost(key))?null:'当地缺少调岗物资；先恢复调运或从原镇援助';
  },
  set(s,id,key,value){
    if(this.settingReason(s,id,key,value))return false;
    const x=this.local(s,id),n=CivilCity.data(s).wards[id],paid=this.settingCost(key);CivilCity.pay(n,paid);
    x.changes.push({at:s.civilization.elapsed,key,value,paid});x[key]=value;
    CivilCity.note(s,'policy',id,CivilCityContent.wards[id].name+'改为'+(key==='profile'?this.profiles[value]:value==='clinical'?'临床制药':'基础配药')+'，调岗与校准物资已实付。');return true;
  },
  plan(s,id,slots,want){
    const x=this.local(s,id);if(!x)return {apprentice:0,tutor:0,clerk:0};
    const n=CivilCity.data(s).wards[id],cfg=CivilCityContent.wards[id],p=CivilCity.count(n),clinical=x.careMethod==='clinical';
    const med=Math.ceil(p*.01/(clinical?.3:.15))+2;
    want.medic=clinical?Math.min(med,this.skillLimit(s,id,'care')):med;
    const surplus=x.profile==='workshop'?-2:x.profile==='provisioning'?30:8;
    // Reserve the coming cohort transition, including large generations reaching old age.
    // A fixed average would quietly bankrupt food budgets when a large cohort turns 80.
    const parents=n.cohorts.filter(c=>c.age>=17&&c.age<=48).reduce((a,c)=>a+c.count,0);
    const nextBeds=Math.max(0,CivilCity.housing(s,id)-p)+n.cohorts.filter(c=>c.age===79).reduce((a,c)=>a+c.count,0);
    const expectedBirths=Math.min(Math.ceil(p*.04),nextBeds,Math.floor(parents*.08+n.births.credit));
    const familyReserve=expectedBirths*6/60;
    want.farmer=Math.max(0,Math.ceil((CivilCity.foodPopulation(s,id)*.12+want.medic*.2+2+familyReserve+surplus)/cfg.foodRate));
    if(n.priority==='care')want.farmer+=8;
    if(x.profile==='provisioning')want.smith=0;
    if(x.profile==='workshop'){want.smith=Math.max(want.smith,32);want.salvager+=16;}
    if(n.method==='standard'){
      const technicians=this.skillLimit(s,id,'craft');want.smelter=Math.min(Math.ceil(want.smith/4),Math.floor(technicians/5));
      want.smith=Math.min(want.smith,Math.max(0,technicians-want.smelter));
    }
    if(x.profile==='provisioning')want.smelter=0;
    return {...this.trainingCrew(s,id),clerk:2};
  },
  targets(n,x){
    if(!x)return null;
    const food=CivilPopulation.foodPopulation(n.cohorts)*.12;
    return {food:food*(x.profile==='provisioning'?36:x.profile==='workshop'?18:24),medicine:CivilCity.count(n)*.01*24,wood:2500,scrap:2500,tools:x.profile==='workshop'?480:240,knowledge:3000,iron:150};
  },
  dispatch(s,source,n,members){
    const d=CivilCity.data(s),own=CivilCity.targets(n,s,source),offers=[];
    for(const [target,to]of members){
      if(target===source||!to.buildings.road||!to.freightEnabled)continue;
      const wanted=CivilCity.targets(to,s,target),w=to.workers,x=this.local(s,target);
      const consumption={food:CivilCity.foodPopulation(s,target)*.12,medicine:CivilCity.count(to)*.01,
        tools:Math.max(1,(w.farmer||0)*.01+(w.waterworker||0)*.001+(x?.careMethod==='clinical'?(w.medic||0)*.01:0)+(x?.training?.2:0)),
        wood:Math.max(1,(w.teacher||0)*.1+(w.smith||0)*.2+(w.waterworker||0)*.02+1),scrap:Math.max(1,(w.medic||0)*.1+(w.smith||0)*.6)};
      const items=[];
      for(const key of ['tools','food','medicine','scrap','wood']){
        const incoming=d.shipments.filter(p=>p.target===target&&p.phase==='outbound').reduce((a,p)=>a+(p.cargo[key]||0),0);
        const onHand=(to.stores[key]||0)+incoming,need=wanted[key]*.8-onHand,spare=(n.stores[key]||0)-own[key]*.6;
        const amount=Math.floor(Math.min(CivilCityContent.freightCapacity,need,spare));if(amount<=0)continue;
        const coverage=onHand/consumption[key],critical=coverage<3;
        if(amount<24&&!critical)continue;
        // A desired larger food buffer must not monopolize the carts while missing tools halt farming.
        const score=(coverage<1?120:coverage<3?100:coverage<6?80:Math.max(1,25*need/wanted[key]))+(key==='tools'&&critical?10:0);
        items.push({key,amount,score});
      }
      items.sort((a,b)=>b.score-a.score);if(items.length)offers.push({target,items,score:items[0].score});
    }
    offers.sort((a,b)=>b.score-a.score);
    for(const offer of offers){
      let free=CivilCityContent.freightCapacity;const cargo={};
      for(const item of offer.items){const amount=Math.min(free,item.amount);if(amount){cargo[item.key]=amount;free-=amount;}if(!free)break;}
      const fee={food:6,wood:1},cost={...cargo};for(const [k,v]of Object.entries(fee))cost[k]=(cost[k]||0)+v;
      if(!CivilRules.canPay({stores:n.stores},cost))continue;
      CivilRules.pay({stores:n.stores},cost);CivilCity.sum(n.budget.sent,cargo);CivilCity.sum(n.budget.consumed,fee);CivilCity.ship(s,source,offer.target,cargo);return true;
    }
    return false;
  },
  lessonTick(s,id){
    const x=this.local(s,id),n=CivilCity.data(s).wards[id],t=x?.training;if(!t||t.lastAt===s.civilization.elapsed)return;
    if(!n.economy?.ate||!n.economy.educated||n.economy.water<CivilCity.count(n)||this.trainingCrew(s,id).tutor<2||n.workers.apprentice!==24||n.workers.tutor!==2)return;
    if(!CivilCity.pay(n,this.lesson))return;
    t.lastAt=s.civilization.elapsed;t.rounds++;CivilCity.sum(t.paid,this.lesson);
    if(t.rounds===t.required){
      const cohorts=this.aged(t.cohorts,t.startedAt,s.civilization.elapsed);
      x.certificates.push({subject:t.subject,at:s.civilization.elapsed,source:t.id,cohorts});
      x.courses.push({...t,endedAt:s.civilization.elapsed,result:'completed'});x.training=null;
      CivilCity.note(s,'policy',id,CivilCityContent.wards[id].name+'的'+CivilPopulation.count(cohorts)+'名居民完成'+this.subjects[t.subject]+'培训。他们没有增加人口，可以承担相应专业岗位。');
    }
  },
  homeMode(s,mode){
    const h=this.data(s)?.home;if(!h||!['reserves','building'].includes(mode)||h.mode===mode)return false;
    h.mode=mode;h.changes.push({at:s.civilization.elapsed,kind:'mode',value:mode});return true;
  },
  delegate(s,enabled){
    const h=this.data(s)?.home;if(!h||typeof enabled!=='boolean'||h.enabled===enabled)return false;
    h.enabled=enabled;if(typeof CivilCityContinuity!=='undefined'&&CivilCityContinuity.data(s))CivilSociety.trimJobs(s);h.changes.push({at:s.civilization.elapsed,kind:'enabled',value:enabled});
    CivilCity.note(s,'policy','home',enabled?'原镇例行岗位交给公署：每60秒检查供养与岗位，并实付办公开支。工程、研究、法律与对外决定仍由共同体决定。':'原镇岗位委托已暂停，保留当前岗位安排。');return true;
  },
  manual(s){if(this.data(s)?.home.enabled)this.delegate(s,false);},
  homePlan(s){
    const mode=this.data(s).home.mode,w=s.game.workers,cap=j=>CivilCatalog.jobCapacity(s,j),factor=Math.max(.15,CivilIndustry.factor(s));
    const children=CivilPopulation.children(s.civilization.society.cohorts),p=s.game.population;
    const medic=Math.min(cap('medic'),Math.ceil((p*.01+.5)/(.15*factor))),teacher=Math.min(cap('teacher'),Math.max(2,Math.ceil(children/20)+1));
    const smith=Math.min(cap('smith'),s.game.buildings.toolshop?4:0);
    const desired={medic,teacher,smith,farmer:0,hunter:0,salvager:Math.ceil((medic*.1+smith*.6+2)/(.8*factor))};
    const need=CivilSociety.foodPopulation(s)*.12*(CivilRules.policies[s.civilization.policy]?.food||1)*(s.game.buildings.cistern?.9:1)+medic*.2+8;
    desired.farmer=Math.min(cap('farmer'),Math.ceil(need/((s.civilization.tech.irrigation&&s.civilization.outpostSupplied!==false?2:1.4)*factor)));
    const farm=desired.farmer*(s.civilization.tech.irrigation&&s.civilization.outpostSupplied!==false?2:1.4)*factor;
    desired.hunter=Math.min(s.game.buildings.lodge?Infinity:0,Math.max(0,Math.ceil((need-farm)/(.8*factor))));
    if(mode==='building')desired.salvager+=4;
    // All non-civilian jobs, particularly drivers and guards already serving outside, stay assigned.
    const fixed=Object.fromEntries(Object.entries(w).filter(([j])=>!Object.hasOwn(desired,j)));
    let left=Math.max(0,CivilSociety.workforce(s)-Object.values(fixed).reduce((a,b)=>a+b,0)-2);
    const next={...fixed};for(const j of ['farmer','hunter','medic','teacher','salvager','smith']){next[j]=Math.min(left,desired[j]);left-=next[j];}
    return next;
  },
  homeTick(s){
    if(typeof CivilCityContinuity!=='undefined'&&CivilCityContinuity.data(s))return CivilCityContinuity.homeTick(s);
    const h=this.data(s)?.home,at=s.civilization.elapsed;if(!h?.enabled||h.lastAt!==null&&at-h.lastAt<60)return;
    const paid={food:2,tools:.2,knowledge:.1};h.lastAt=at;
    if(!CivilRules.pay(s,paid)){h.records.push({at,paid:{},status:'shortage',changes:{}});return;}
    const next=this.homePlan(s),changes={};for(const [j,n]of Object.entries(next))if((s.game.workers[j]||0)!==n)changes[j]=[s.game.workers[j]||0,n];
    Object.assign(s.game.workers,next);h.records.push({at,paid,status:'paid',changes});
    return paid;
  },
  validate(s){
    const d=this.data(s);if(d===undefined)return;
    const fail=()=>{throw Error('城市机构、培训名册或委托账无效');},at=s.civilization.elapsed,int=n=>Number.isSafeInteger(n)&&n>=0,time=n=>int(n)&&n<=at;
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),num=n=>Number.isFinite(n)&&n>=0;
    const cohorts=a=>Array.isArray(a)&&a.length<=160&&a.every(c=>int(c.age)&&c.age>=18&&c.age<=64&&int(c.count)&&c.count>0&&['human','mutant'].includes(c.identity));
    if(!this.available(s)||d.schema!==1||!time(d.at)||d.at<CivilCity.data(s).cityAt||!same(d.paid,this.charter)||!d.wards||!d.home)fail();
    for(const [id,x]of Object.entries(d.wards)){
      const registered=x.registeredAt??d.at,n=CivilCity.data(s).wards[id];if(!n||n.joinedAt===null||n.joinedAt>registered||!time(registered)||registered<d.at||x.registeredAt!==undefined&&!same(x.paid,this.charter.local)||!Object.hasOwn(this.profiles,x.profile)||!['basic','clinical'].includes(x.careMethod)||!Array.isArray(x.certificates)||!Array.isArray(x.courses)||!Array.isArray(x.changes)||!int(x.nextCourse)||x.nextCourse!==x.courses.length+(x.training?1:0)+1)fail();
      if(!x.initialWorkers||Object.values(x.initialWorkers).some(v=>!int(v)))fail();
      const courses=[...x.courses,...(x.training?[x.training]:[])];let ended=registered;
      for(const [i,t]of courses.entries()){
        if(t.id!==i+1||!Object.hasOwn(this.subjects,t.subject)||!time(t.startedAt)||t.startedAt<ended||!cohorts(t.cohorts)||CivilPopulation.count(t.cohorts)!==24||t.cohorts.some(c=>c.age>49)||![30,60].includes(t.required)||!int(t.rounds)||t.rounds>t.required||t.lastAt!==null&&(!time(t.lastAt)||t.lastAt<t.startedAt+10*(t.rounds-1))||t.rounds>0&&t.lastAt===null)fail();
        const mentors=x.certificates.filter(c=>c.subject===t.subject&&(c.source==='register'||c.source<t.id)).flatMap(c=>this.aged(c.cohorts,c.at,t.startedAt));
        if(t.required!==(CivilPopulation.count(mentors)>=2?30:60))fail();
        const paid={...this.enrollment};for(const [k,v]of Object.entries(this.lesson))paid[k]=(paid[k]||0)+v*t.rounds;
        if(Object.keys(t.paid||{}).length!==Object.keys(paid).length||Object.entries(paid).some(([k,v])=>!num(t.paid[k])||Math.abs(t.paid[k]-v)>1e-6))fail();
        if(i<x.courses.length){if(!time(t.endedAt)||t.endedAt<t.startedAt||!['completed','cancelled'].includes(t.result)||t.result==='completed'&&(t.rounds!==t.required||t.endedAt!==t.lastAt)||t.result==='cancelled'&&t.rounds===t.required)fail();ended=t.endedAt;}else if(t.rounds>=t.required)fail();
      }
      for(const subject of ['craft','care']){
        const base=x.certificates.filter(c=>c.subject===subject&&c.source==='register');if(base.length!==1||base[0].at!==registered||!cohorts(base[0].cohorts))fail();
        const slots=subject==='craft'?(x.initialWorkers.smith||0)+(x.initialWorkers.smelter||0):(x.initialWorkers.medic||0)+(x.initialWorkers.teacher||0);
        if(CivilPopulation.count(base[0].cohorts)!==Math.min(12,slots))fail();
      }
      for(const c of x.certificates){
        if(!Object.hasOwn(this.subjects,c.subject)||!time(c.at)||c.at<d.at||!cohorts(c.cohorts))fail();
        if(c.source!=='register'){const t=x.courses.find(t=>t.id===c.source);if(!t||t.result!=='completed'||t.subject!==c.subject||c.at!==t.endedAt||!same(c.cohorts,this.aged(t.cohorts,t.startedAt,c.at)))fail();}
      }
      if(x.certificates.length!==2+x.courses.filter(t=>t.result==='completed').length||x.courses.some(t=>t.result==='completed'&&x.certificates.filter(c=>c.source===t.id).length!==1))fail();
      const used=this.merge([...this.qualified(s,id,'craft'),...this.qualified(s,id,'care'),...(x.training?this.aged(x.training.cohorts,x.training.startedAt,at):[])]);
      if(used.some(c=>c.count>(n.cohorts.find(r=>this.key(r)===this.key(c))?.count||0)))fail();
      const settings={profile:'balanced',careMethod:'basic',schoolEnabled:false};let previous=registered;
      for(const e of x.changes){if(!time(e.at)||e.at<previous||!Object.hasOwn(settings,e.key)||e.key==='profile'&&!Object.hasOwn(this.profiles,e.value)||e.key==='careMethod'&&!['basic','clinical'].includes(e.value)||e.key==='schoolEnabled'&&typeof e.value!=='boolean'||!same(e.paid,e.key==='schoolEnabled'?{}:this.settingCost(e.key)))fail();settings[e.key]=e.value;previous=e.at;}
      if(settings.profile!==x.profile||settings.careMethod!==x.careMethod||settings.schoolEnabled!==!!x.schoolEnabled||x.schoolEnabled!==undefined&&typeof x.schoolEnabled!=='boolean')fail();
    }
    const h=d.home;if(typeof h.enabled!=='boolean'||!['reserves','building'].includes(h.mode)||!Array.isArray(h.records)||!Array.isArray(h.changes)||h.lastAt!==null&&!time(h.lastAt))fail();
    let previous=null;for(const r of h.records){if(!time(r.at)||r.at<d.at||previous!==null&&r.at-previous<60||!['paid','shortage'].includes(r.status)||!same(r.paid,r.status==='paid'?{food:2,tools:.2,knowledge:.1}:{})||!r.changes||Object.entries(r.changes).some(([j,v])=>!Object.hasOwn(CivilCatalog.jobs,j)||!Array.isArray(v)||v.length!==2||v.some(n=>!int(n))))fail();previous=r.at;}
    if(h.lastAt!==previous)fail();let enabled=false,mode='reserves',last=d.at;
    for(const e of h.changes){if(!time(e.at)||e.at<last||!['mode','enabled'].includes(e.kind)||e.kind==='enabled'&&typeof e.value!=='boolean'||e.kind==='mode'&&!['reserves','building'].includes(e.value))fail();if(e.kind==='enabled')enabled=e.value;else mode=e.value;last=e.at;}
    if(enabled!==h.enabled||mode!==h.mode)fail();
  }
};
