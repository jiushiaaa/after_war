/* MPL-2.0 — District public economy. Real residents, local assets, paid work and freight.
   Population groups are the same age/identity cohorts used by the early game. */
var CivilCity={
  data(s){return s.civilization.city;},
  enabled(s){return s.civilization.ruleset===2;},
  node(s,id){return this.data(s)?.wards[id] || (id==='lake'?s.civilization.conurbation?.node:id==='ridge'?s.civilization.cityNetwork?.node:null);},
  config(id){return CivilCityContent.wards[id] || (id==='lake'&&typeof CivilConurbation!=='undefined'?CivilConurbation.config:id==='ridge'&&typeof CivilCityNetwork!=='undefined'?CivilCityNetwork.config:null);},
  count(n){return CivilPopulation.count(n.cohorts);},
  cohortSeed(pop){
    const a=[];for(let age=0;age<80;age++){const n=Math.floor((age+1)*pop/80)-Math.floor(age*pop/80),mutant=Math.floor(n*.2);if(n-mutant)a.push({age,count:n-mutant,identity:'human'});if(mutant)a.push({age,count:mutant,identity:'mutant'});}return a;
  },
  initialStores(pop){return {food:pop*.12*60,medicine:pop*.01*60,wood:1800,scrap:1800,tools:240,knowledge:0,iron:0};},
  init(s){
    if(!this.enabled(s)||this.data(s))return;
    if(s.civilization.elapsed!==0)throw Error('片区名册只能在新世界开局建立');
    const wards={};for(const [id,cfg]of Object.entries(CivilCityContent.wards))wards[id]={
      cohorts:this.cohortSeed(cfg.population),stores:this.initialStores(cfg.population),year:0,births:{scaled:true,credit:0,mutantCredit:0},
      health:80,hunger:0,workers:{},contactedAt:null,joinedAt:null,priority:'balanced',method:'manual',waterEnabled:true,freightEnabled:true,
      buildings:{road:0,water:0,housing:0},project:null,completed:[],nextProject:1,economy:null,stable:0,
      budget:{produced:{},consumed:{},received:{},sent:{}},born:0,dead:0
    };
    s.civilization.city={schema:1,wards,contact:null,shipments:[],nextShipment:1,arrived:0,cityAt:null,history:[]};
  },
  available(s){return this.enabled(s)&&!!s.civilization.village?.town&&!!s.civilization.tech.survey;},
  members(s){return Object.entries(this.data(s)?.wards||{}).filter(([,n])=>n.joinedAt!==null);},
  population(s){return s.game.population+this.members(s).reduce((a,[,n])=>a+this.count(n),0);},
  housing(s,id){return (id==='lake'?s.civilization.conurbation.origin.housing:id==='ridge'?s.civilization.cityNetwork.origin.housing:Math.ceil(this.config(id).population*11/10))+this.node(s,id).buildings.housing*800;},
  waterPerWorker(n){return n.buildings.water?160*n.buildings.water:45;},
  workforce(n){return CivilPopulation.workforce(n.cohorts);},
  foodPopulation(s,id){const n=this.node(s,id),away=(this.data(s).shipments.some(p=>p.source===id)?2:0)+(typeof CivilConurbation!=='undefined'?CivilConurbation.crew(s,id):0)+(typeof CivilCityNetwork!=='undefined'?CivilCityNetwork.crew(s,id):0);return Math.max(0,CivilPopulation.foodPopulation(n.cohorts)-away);},
  crew(s){return (this.data(s)?.shipments||[]).filter(p=>p.source==='home').length*2+(this.data(s)?.contact?2:0);},
  freeCrew(s){return CivilSociety.workforce(s)-Object.values(s.game.workers).reduce((a,b)=>a+b,0);},
  note(s,kind,id,text){const d=this.data(s);d.history.push({at:s.civilization.elapsed,kind,id,text});if(typeof State!=='undefined'&&s===State&&typeof Civilization!=='undefined')Civilization.notify(text);},
  sum(into,values){for(const [k,v]of Object.entries(values))into[k]=(into[k]||0)+v;},
  pay(n,cost){if(!CivilRules.canPay({stores:n.stores},cost))return false;CivilRules.pay({stores:n.stores},cost);this.sum(n.budget.consumed,cost);return true;},
  contactReason(s,id){const d=this.data(s),n=d?.wards[id];return !this.available(s)?'先议定小镇方针并完成地理测绘':!n?'未知片区':n.contactedAt!==null?'已经普查':d.contact?'已有普查队在途':this.freeCrew(s)<2?'原镇须有两名空闲成年普查员':!CivilRules.canPay(s,CivilCityContent.contactCost)?'先备足普查旅费':null;},
  contact(s,id){if(this.contactReason(s,id))return false;CivilRules.pay(s,CivilCityContent.contactCost);this.data(s).contact={id,startedAt:s.civilization.elapsed,remaining:CivilCityContent.contactDuration,paid:{...CivilCityContent.contactCost}};return true;},
  projectReason(s,id,type){
    const n=this.data(s)?.wards[id],cfg=CivilCityContent.projects[type];
    if(!n||!cfg||n.contactedAt===null)return '先普查当地居民与设施';
    if(n.project)return '已有工程施工';if(n.buildings[type]>=cfg.max)return '已达到当前扩建上限';
    if(!s.civilization.tech.administration)return '先完成公共行政';
    if(!CivilRules.canPay(s,cfg.cost))return '原镇公仓尚缺建材';
    return null;
  },
  startProject(s,id,type){
    if(this.projectReason(s,id,type))return false;
    const n=this.data(s).wards[id],cfg=CivilCityContent.projects[type];CivilRules.pay(s,cfg.cost);
    n.project={id:n.nextProject++,type,phase:'transport',remaining:CivilCityContent.travel,startedAt:s.civilization.elapsed,paid:{...cfg.cost},worked:0};
    this.note(s,'project',id,CivilCityContent.wards[id].name+'的'+cfg.name+'材料已出仓，先运输后施工。');return true;
  },
  joinReason(s,id){
    const n=this.data(s)?.wards[id];if(!n||n.contactedAt===null)return '先完成普查';if(n.joinedAt!==null)return '已纳入本城公共服务';
    if(!s.civilization.urban?.chartered)return '先登记原镇公共职责';
    if(!n.buildings.road||!n.buildings.water)return '先连接道路并修复公共水务';
    if(n.stable<120)return '当地粮食、诊疗、课堂与用水须稳定 120 秒';
    if(!CivilRules.canPay(s,CivilCityContent.charterCost)||!CivilRules.canPay({stores:n.stores},{food:40,tools:10}))return '双方分别备足登记与维护物资';
    return null;
  },
  join(s,id){
    if(this.joinReason(s,id))return false;const n=this.data(s).wards[id];
    CivilRules.pay(s,CivilCityContent.charterCost);this.pay(n,{food:40,tools:10});n.joinedAt=s.civilization.elapsed;
    this.note(s,'join',id,CivilCityContent.wards[id].name+'纳入本城公共服务。'+this.count(n)+'位居民继续住在原处，地方仓库与职责一并列入普查。');return true;
  },
  set(s,id,key,value){
    const n=this.data(s)?.wards[id];if(!n||n.contactedAt===null)return false;
    if(n.joinedAt===null)return false;
    if(key==='priority'&&!Object.hasOwn(CivilCityContent.priorities,value)||key==='method'&&!Object.hasOwn(CivilCityContent.methods,value)||['waterEnabled','freightEnabled'].includes(key)&&typeof value!=='boolean'||!['priority','method','waterEnabled','freightEnabled'].includes(key))return false;
    if(key==='method'&&value==='standard'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards))return false;
    if(n[key]===value)return false;n[key]=value;
    this.note(s,'policy',id,CivilCityContent.wards[id].name+'调整了'+({priority:'生产优先级',method:'制器工序',waterEnabled:'水务值守',freightEnabled:'公共货运'}[key])+'。');return true;
  },
  plan(s,id){
    const n=this.node(s,id),cfg=this.config(id),p=this.count(n),meal=this.foodPopulation(s,id)*.12,cap=(id==='lake'?s.civilization.conurbation.origin.housing:id==='ridge'?s.civilization.cityNetwork.origin.housing:cfg.population)+n.buildings.housing*800;
    const slots={farmer:Math.ceil(cap*.2),medic:Math.ceil(cap*.1),teacher:Math.ceil(cap*.02),smith:Math.ceil(cap*.025),salvager:Math.ceil(cap*.1),gatherer:Math.ceil(cap*.1),waterworker:Math.ceil(cap*.03),builder:40,driver:2,smelter:Math.ceil(cap*.01)};
    const med=Math.ceil(p*.01/.15)+2,smith=Math.ceil(p*.001/.25)+4,water=Math.ceil(p/this.waterPerWorker(n));
    const want={waterworker:n.waterEnabled?water:0,medic:med,farmer:Math.ceil((meal+med*.2+10)*1.18/cfg.foodRate),teacher:Math.ceil(CivilPopulation.children(n.cohorts)/20),smith,
      salvager:Math.ceil((med*.1+smith*(n.method==='manual'?.6:.8))/cfg.scrapRate)+4,gatherer:Math.ceil(p*.01/cfg.woodRate)+8,builder:n.project?.phase==='building'?(n.priority==='building'?40:20):0,driver:n.buildings.road||n.project?.phase==='transport'?2:0,smelter:n.method==='standard'?Math.ceil(smith/4):0};
    if(n.priority==='care'){want.farmer=Math.ceil(want.farmer*1.15);want.medic+=3;}
    if(n.priority==='building'){want.gatherer*=2;want.salvager=Math.ceil(want.salvager*1.5);}
    const reserved=typeof CivilCityInstitutions!=='undefined'?CivilCityInstitutions.plan(s,id,slots,want):{};
    if(typeof CivilConurbation!=='undefined')CivilConurbation.plan(s,id,slots,want,reserved);
    if(typeof CivilCityNetwork!=='undefined')CivilCityNetwork.plan(s,id,slots,want,reserved);
    let left=this.workforce(n);n.workers={};
    for(const [job,count]of Object.entries(reserved)){n.workers[job]=Math.min(left,count);left-=n.workers[job];}
    const order=n.priority==='building'?['waterworker','farmer','medic','driver','builder','gatherer','salvager','smith','teacher','smelter']:['waterworker','farmer','medic','teacher','driver','salvager','gatherer','smith','builder','smelter'];
    for(const job of order){const v=Math.min(left,slots[job],want[job]);n.workers[job]=v;left-=v;}return {slots,idle:left};
  },
  targets(n,s,id){
    if(id==='ridge'&&typeof CivilCityNetwork!=='undefined')return CivilCityNetwork.targets(s);
    if(id==='lake'&&typeof CivilConurbation!=='undefined')return CivilConurbation.targets(s);
    const civic=s&&typeof CivilCityInstitutions!=='undefined'?CivilCityInstitutions.targets(n,CivilCityInstitutions.local(s,id)):null;if(civic)return civic;
    const p=this.count(n);return {food:CivilPopulation.foodPopulation(n.cohorts)*.12*60,medicine:p*.01*60,wood:2500,scrap:2500,tools:300,knowledge:3000,iron:150};
  },
  settleWard(s,id){
    const n=this.node(s,id),cfg=this.config(id),before={...n.stores},p=this.count(n),plan=this.plan(s,id),w=n.workers,target=this.targets(n,s,id),blocked=[],worked={};
    const run=(job,cost,out,continuous=false)=>{
      let batches=w[job]||0;
      if(!continuous&&Object.keys(out).length&&Object.entries(out).every(([k])=>(n.stores[k]||0)>=target[k]))batches=0;
      for(const [k,v]of Object.entries(cost))batches=Math.min(batches,Math.floor(((n.stores[k]||0)+1e-8)/v));
      const paid=Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,v*batches]));this.pay(n,paid);worked[job]=batches;
      for(const [k,v]of Object.entries(out)){const made=continuous?Math.min(v*batches,Math.max(0,target[k]-(n.stores[k]||0))):v*batches;n.stores[k]=(n.stores[k]||0)+made;n.budget.produced[k]=(n.budget.produced[k]||0)+made;}
      if(batches<(w[job]||0)&&Object.entries(cost).some(([k,v])=>(n.stores[k]||0)<v))blocked.push(job);return batches;
    };
    run('gatherer',{}, {wood:cfg.woodRate});run('salvager',{}, {scrap:cfg.scrapRate});
    const waterWorkers=run('waterworker',{wood:.02,tools:.001},{}),water=waterWorkers*this.waterPerWorker(n),wet=water>=p;
    run('farmer',{tools:.01},{food:cfg.foodRate*(wet?1:.45)});
    const ate=this.pay(n,{food:this.foodPopulation(s,id)*.12});n.hunger=ate?Math.max(0,n.hunger-20):n.hunger+10;
    const clinical=typeof CivilCityInstitutions!=='undefined'&&CivilCityInstitutions.local(s,id)?.careMethod==='clinical';
    run('medic',clinical?{food:.2,scrap:.1,tools:.01,knowledge:.02}:{food:.2,scrap:.1},{medicine:clinical?.3:.15});run('teacher',{wood:.1},{knowledge:.2},true);
    run('smelter',{scrap:1,wood:.5},{iron:.3});
    run('smith',n.method==='standard'?{scrap:.8,wood:.1,iron:.05}:{scrap:.6,wood:.2},{tools:n.method==='standard'?.6:.25});
    const treated=(w.medic||0)>0&&this.pay(n,{medicine:p*.01}),educated=(worked.teacher||0)*20>=CivilPopulation.children(n.cohorts);
    const administered=id==='ridge'?(n.workers.clerk===2&&this.pay(n,{food:2,wood:1,knowledge:.1})):id==='lake'?CivilConurbation.officeReady(s)&&this.pay(n,{food:2,wood:1,knowledge:.1}):n.joinedAt===null||this.pay(n,{food:2,wood:1,knowledge:.1});
    n.health=Math.max(0,Math.min(100,n.health+(ate&&treated&&wet?.25:-.3)));
    const ready=ate&&treated&&wet&&educated&&administered&&n.health>=60;
    n.stable=ready?Math.min(600,n.stable+10):0;
    n.economy={at:s.civilization.elapsed,food:n.stores.food-before.food,medicine:n.stores.medicine-before.medicine,water,population:p,treated,educated,administered,ate,blocked,worked,idle:plan.idle,
      flow:Object.fromEntries(CivilCityContent.resources.map(k=>[k,(n.stores[k]||0)-(before[k]||0)]))};
    if(typeof CivilCityInstitutions!=='undefined')CivilCityInstitutions.lessonTick(s,id);
    if(typeof CivilCityInstitutions!=='undefined')CivilCityInstitutions.schoolTick(s,id);
    n.economy.flow=Object.fromEntries(CivilCityContent.resources.map(k=>[k,(n.stores[k]||0)-(before[k]||0)]));n.economy.food=n.economy.flow.food;n.economy.medicine=n.economy.flow.medicine;
  },
  annual(s,id){
    const n=this.node(s,id),year=Math.floor(s.civilization.elapsed/600),account=['lake','ridge'].includes(id)?'city_'+id:'ward_'+id;
    while(n.year<year){const old=this.count(n),aged=CivilPopulation.age(n.cohorts);n.year++;n.cohorts=aged.cohorts;n.dead+=aged.deceased;CivilCensus.death(s,account,aged.deceased);
      const born=CivilPopulation.births(n.cohorts,n.births,{yearStartPopulation:old,beds:this.housing(s,id)-this.count(n),health:n.health,hunger:n.hunger,food:n.stores.food,medicine:n.stores.medicine});
      if(born.count&&this.pay(n,born.cost)){n.cohorts.push(...born.cohorts);n.born+=born.count;CivilCensus.birth(s,account,born.count);}
      // Merge equal groups, never average away age or mutant identity.
      const groups=new Map();for(const c of n.cohorts){const key=c.age+'_'+c.identity;if(groups.has(key))groups.get(key).count+=c.count;else groups.set(key,{...c});}n.cohorts=[...groups.values()];
    }
  },
  aidReason(s,id){
    const d=this.data(s),n=d?.wards[id];if(!n||n.contactedAt===null)return '先完成普查';
    if(d.shipments.some(p=>p.source==='home'))return '原镇援助车尚未返程';
    if(this.freeCrew(s)<2)return '原镇须有两名空闲成年运输员';
    return !CivilRules.canPay(s,{...CivilCityContent.aid,food:CivilCityContent.aid.food+6,wood:1})?'先备齐援助和旅费':null;
  },
  aid(s,id){if(this.aidReason(s,id))return false;const cargo={...CivilCityContent.aid};CivilRules.pay(s,{...cargo,food:cargo.food+6,wood:1});this.ship(s,'home',id,cargo);return true;},
  ship(s,source,target,cargo){const d=this.data(s);d.shipments.push({id:d.nextShipment++,source,target,cargo:{...cargo},phase:'outbound',remaining:CivilCityContent.travel,startedAt:s.civilization.elapsed,deliveredAt:null});},
  dispatch(s){
    const d=this.data(s),members=this.members(s);
    for(const [source,n]of members){
      if(!n.freightEnabled||!n.buildings.road||n.workers.driver<2||d.shipments.some(p=>p.source===source))continue;
      let sent=false;const own=this.targets(n,s,source),civic=typeof CivilCityInstitutions!=='undefined'&&!!CivilCityInstitutions.data(s);
      if(civic){CivilCityInstitutions.dispatch(s,source,n,members);continue;}
      for(const [target,to]of members){if(target===source||!to.buildings.road||!to.freightEnabled)continue;
        for(const key of ['food','medicine','tools','scrap','wood']){
          const need=this.targets(to,s,target)[key]*.5-(to.stores[key]||0)-d.shipments.filter(p=>p.target===target&&p.phase==='outbound').reduce((a,p)=>a+(p.cargo[key]||0),0);
          const amount=Math.floor(Math.min(CivilCityContent.freightCapacity,need,(n.stores[key]||0)-own[key]*.8));if(amount<=0)continue;
          const cargo={[key]:amount},fee={food:6,wood:1},cost={...cargo};for(const [k,v]of Object.entries(fee))cost[k]=(cost[k]||0)+v;
          if(!CivilRules.canPay({stores:n.stores},cost))continue;
          CivilRules.pay({stores:n.stores},cost);this.sum(n.budget.sent,cargo);this.sum(n.budget.consumed,fee);this.ship(s,source,target,cargo);sent=true;break;
        }if(sent)break;
      }
    }
  },
  tick(s){
    if(!this.enabled(s))return;const d=this.data(s),t=s.civilization.elapsed;
    if(d.contact){d.contact.remaining=Math.max(0,d.contact.remaining-1);if(!d.contact.remaining){const id=d.contact.id;d.wards[id].contactedAt=t;d.contact=null;this.note(s,'contact',id,'普查队找到了'+CivilCityContent.wards[id].name+'：'+this.count(d.wards[id])+'位居民一直在此生活，普查没有新增人口。');}}
    for(const [id,n]of Object.entries(d.wards)){
      this.annual(s,id);if(t%10===0)this.settleWard(s,id);
      const p=n.project;if(p){
        if(p.phase==='transport'){if(n.economy?.ate&&n.workers.driver>=2)p.remaining=Math.max(0,p.remaining-1);if(!p.remaining){p.phase='building';p.remaining=CivilCityContent.projects[p.type].duration;}}
        else if(n.economy?.ate&&n.workers.builder>=20){const work=Math.min(p.remaining,Math.floor(n.workers.builder/20));p.remaining-=work;p.worked+=work;if(!p.remaining){n.buildings[p.type]++;n.completed.push({...p,completedAt:t});n.project=null;this.note(s,'complete',id,CivilCityContent.wards[id].name+'的'+CivilCityContent.projects[p.type].name+'建成。');}}
      }
    }
    for(const p of [...d.shipments]){
      p.remaining=Math.max(0,p.remaining-1);if(p.remaining)continue;
      if(p.phase==='outbound'){const n=d.wards[p.target];for(const [k,v]of Object.entries(p.cargo))n.stores[k]=(n.stores[k]||0)+v;this.sum(n.budget.received,p.cargo);p.deliveredAt=t;p.phase='returning';p.remaining=CivilCityContent.travel;d.arrived++;}
      else d.shipments.splice(d.shipments.indexOf(p),1);
    }
    if(t%10===0)this.dispatch(s);
    if(d.cityAt===null&&s.civilization.urban?.city&&this.population(s)>=10000&&this.members(s).length>=2&&this.members(s).every(([,n])=>n.stable>=120)){
      d.cityAt=t;this.note(s,'city','home','原镇与已连接片区共同登记为万人城市。居民仍住在各自街区，公共服务、生产和运输按片区治理。');
    }
  },
  validate(s){
    if(!this.enabled(s)){if(this.data(s)!==undefined)throw Error('旧档不能混入片区经营');return;}
    const d=this.data(s),int=n=>Number.isSafeInteger(n)&&n>=0,num=n=>Number.isFinite(n)&&n>=0,fail=()=>{throw Error('片区经营数据无效');};
    const time=t=>int(t)&&t<=s.civilization.elapsed;
    if(!d||d.schema!==1||!d.wards||Object.keys(d.wards).sort().join()!==Object.keys(CivilCityContent.wards).sort().join()||!Array.isArray(d.shipments)||!Array.isArray(d.history)||!int(d.nextShipment)||d.nextShipment<1||!int(d.arrived)||d.arrived>=d.nextShipment)fail();
    if(d.contact){const p=d.contact;if(!d.wards[p.id]||d.wards[p.id].contactedAt!==null||!time(p.startedAt)||!int(p.remaining)||p.remaining<1||p.remaining>CivilCityContent.contactDuration||s.civilization.elapsed-p.startedAt!==CivilCityContent.contactDuration-p.remaining||JSON.stringify(p.paid)!==JSON.stringify(CivilCityContent.contactCost))fail();}
    if(d.cityAt!==null&&(!time(d.cityAt)||!s.civilization.urban?.city||!d.history.some(e=>e.kind==='city'&&e.at===d.cityAt)))fail();
    let last=0;for(const e of d.history){if(!time(e.at)||e.at<last||!['contact','project','complete','join','policy','city'].includes(e.kind)||e.id!=='home'&&!d.wards[e.id]||typeof e.text!=='string'||e.text.length>300)fail();last=e.at;}
    for(const [id,n]of Object.entries(d.wards)){
      if(!Array.isArray(n.cohorts)||n.cohorts.length>160||n.cohorts.some(c=>!int(c.age)||c.age>=80||!int(c.count)||!c.count||!['human','mutant'].includes(c.identity))||!num(n.health)||n.health>100||!int(n.year)||n.year!==Math.floor(s.civilization.elapsed/600)||!int(n.born)||!int(n.dead)||this.count(n)!==CivilCityContent.wards[id].population+n.born-n.dead)fail();
      if(!num(n.hunger)||!n.births||n.births.scaled!==true||!num(n.births.credit)||n.births.credit>=1||!num(n.births.mutantCredit)||n.births.mutantCredit>=1||!int(n.nextProject)||n.nextProject!==n.completed.length+(n.project?1:0)+1)fail();
      if(!Object.hasOwn(CivilCityContent.priorities,n.priority)||!Object.hasOwn(CivilCityContent.methods,n.method)||typeof n.waterEnabled!=='boolean'||typeof n.freightEnabled!=='boolean'||!num(n.stable)||n.stable>600||!Array.isArray(n.completed))fail();
      if(this.count(n)>this.housing(s,id))fail();
      if([n.contactedAt,n.joinedAt].some(t=>t!==null&&(!int(t)||t>s.civilization.elapsed))||n.joinedAt!==null&&(n.contactedAt===null||n.joinedAt<n.contactedAt||!n.buildings.road||!n.buildings.water))fail();
      for(const [k,cfg]of Object.entries(CivilCityContent.projects))if(!int(n.buildings[k])||n.buildings[k]>cfg.max||n.completed.filter(p=>p.type===k).length!==n.buildings[k])fail();
      const initial=this.initialStores(CivilCityContent.wards[id].population);
      for(const bucket of [n.stores,...['produced','consumed','received','sent'].map(k=>n.budget?.[k])])if(!bucket||Object.entries(bucket).some(([k,v])=>!CivilCityContent.resources.includes(k)||!num(v)))fail();
      for(const key of CivilCityContent.resources){const values=['produced','consumed','received','sent'].map(k=>n.budget[k][key]??0);if(!num(n.stores[key])||Math.abs(n.stores[key]-(initial[key]+values[0]-values[1]+values[2]-values[3]))>1e-4)fail();}
      if(Object.values(n.workers).some(v=>!int(v))||Object.values(n.workers).reduce((a,b)=>a+b,0)>this.workforce(n))fail();
      for(const p of [...n.completed,...(n.project?[n.project]:[])]){const cfg=CivilCityContent.projects[p.type];if(!cfg||!int(p.id)||!int(p.startedAt)||p.startedAt>s.civilization.elapsed||!num(p.remaining)||p.remaining>Math.max(cfg.duration,CivilCityContent.travel)||!int(p.worked)||p.worked>cfg.duration||JSON.stringify(p.paid)!==JSON.stringify(cfg.cost)||!['transport','building'].includes(p.phase))fail();if(p.completedAt!==undefined&&(!time(p.completedAt)||p.completedAt-p.startedAt<CivilCityContent.travel+Math.ceil(cfg.duration/2)||p.worked!==cfg.duration||p.remaining!==0))fail();}
    }
    const ids=new Set(),sources=new Set();for(const p of d.shipments){if(!int(p.id)||p.id<1||p.id>=d.nextShipment||ids.has(p.id)||sources.has(p.source)||p.source!=='home'&&!d.wards[p.source]||!d.wards[p.target]||p.source===p.target||!['outbound','returning'].includes(p.phase)||!int(p.remaining)||p.remaining<1||p.remaining>CivilCityContent.travel||!time(p.startedAt)||!p.cargo||!Object.keys(p.cargo).length||Object.entries(p.cargo).some(([k,v])=>!CivilCityContent.resources.includes(k)||!num(v)||v<=0)||Object.values(p.cargo).reduce((a,b)=>a+b,0)>CivilCityContent.freightCapacity)fail();
      if(p.phase==='outbound'&&(p.deliveredAt!==null||s.civilization.elapsed-p.startedAt!==CivilCityContent.travel-p.remaining)||p.phase==='returning'&&(!time(p.deliveredAt)||p.deliveredAt-p.startedAt!==CivilCityContent.travel||s.civilization.elapsed-p.deliveredAt!==CivilCityContent.travel-p.remaining))fail();ids.add(p.id);sources.add(p.source);}
  }
};
