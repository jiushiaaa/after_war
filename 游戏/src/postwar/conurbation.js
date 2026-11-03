/* MPL-2.0 — A3: two sovereign municipal books, finite reciprocal freight.
 * Survey refines the existing north reserve; no annexation, inventory grant or time skip.
 * Unknown-city assets use the explicit coarse reconstruction below. Detailed settlement
 * reuses CivilCity after survey. Older saves stay byte-identical until a paid survey. */
var CivilConurbation={
  config:{name:'湖滨市',population:40000,foodRate:2.9,scrapRate:.6,woodRate:.8},
  values:{food:1,scrap:1,tools:8,medicine:4,iron:5},
  surveyCost:{food:48,tools:12,knowledge:24},travel:180,capacity:1600,
  construction:{wood:240,tools:40,knowledge:12},maintenance:{wood:80,tools:16},running:{wood:20,tools:4,knowledge:2},
  modes:{provisions:{name:'粮医互济',out:{tools:96,medicine:48},back:{food:1200,scrap:160}},industry:{name:'工料协作',out:{tools:160,iron:24},back:{food:1400,scrap:80}}},
  workshopCosts:{timber:{wood:480,tools:160,medicine:64},iron:{wood:240,tools:160,iron:48}},
  shares:{equal:{name:'双方各半',home:.5},host:{name:'本城承担四分之三',home:.75}},
  data(s){return s.civilization.conurbation;},
  available(s){return CivilCity.enabled(s)&&Number.isSafeInteger(CivilCity.data(s)?.cityAt)&&!!CivilCityInstitutions.data(s);},
  local(s,id){return CivilCity.node(s,id);},
  copy(x){return JSON.parse(JSON.stringify(x));},
  plus(a,b){const out={...a};CivilCity.sum(out,b);return out;},
  split(cost,share,side){const fraction=side==='lake'?1-this.shares[share].home:this.shares[share].home;return Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,v*fraction]));},
  note(s,kind,text){const d=this.data(s);d.history.push({at:s.civilization.elapsed,kind,text});if(typeof State!=='undefined'&&s===State&&typeof Civilization!=='undefined')Civilization.notify(text);},
  origin(s,at){
    // This city's unknown inhabitants were already inside reserve_north. Attribute a
    // fixed share of the *recorded* coarse births/deaths; partition neither repeats them
    // nor rewrites them. Age/identity details were unspecified before this census.
    const census=CivilCensus.data(s),base=CivilCensus.initial(census.seed),initial=36000+census.seed%8001,ratio=initial/base.counts.reserve_north;
    let population=initial,born=0,dead=0,housing=Math.ceil(initial*1.5);
    const initialStores={food:initial*.12*18,medicine:initial*.01*8,wood:2400,scrap:1600,tools:240,knowledge:120,iron:0};
    const produced={},consumed={},stores={...initialStores};
    for(const e of census.entries){if(e.at>at)break;
      if(e.kind==='birth'&&e.to==='reserve_north'){const n=Math.floor(e.count*ratio);population+=n;born+=n;}
      if(e.kind==='death'&&e.from==='reserve_north'){
        const n=Math.floor(e.count*ratio);population-=n;dead+=n;
        // Before contact: annual subsistence accounting, not a fabricated detailed
        // simulation. Local farms/clinics replace annual consumption and restore a
        // finite buffer. Their output never enters another city's warehouse.
        const needs={food:population*.12*60,medicine:population*.01*60,wood:360,scrap:1200,tools:720,knowledge:60};
        if(population>housing){const blocks=Math.ceil((population-housing)/800);housing+=blocks*800;needs.wood+=blocks*400;needs.tools+=blocks*50;needs.medicine+=blocks*10;}
        const growth={food:Math.max(0,population*.12*18-stores.food),medicine:Math.max(0,population*.01*8-stores.medicine)};
        CivilCity.sum(produced,this.plus(needs,growth));CivilCity.sum(consumed,needs);CivilCity.sum(stores,growth);
      }
    }
    return {at,initial,population,born,dead,housing,initialStores,produced,consumed,stores,
      assets:{familyBeds:housing,publicWaterworks:1,workshopSlots:80},model:'north-share-annual-subsistence-v1'};
  },
  surveyReason(s){
    if(!this.available(s))return '先登记万人城域与城市机构';if(this.data(s))return '两城普查已登记';
    const n=CivilCity.data(s).wards.yards;
    if(n.joinedAt===null||n.stable<120)return '旧厂街区先恢复稳定的本地服务';
    if(CivilCity.workforce(n)-Object.values(n.workers).reduce((a,b)=>a+b,0)<2)return '旧厂街区需要两名空闲成年普查员';
    if(!CivilRules.canPay({stores:n.stores},this.surveyCost))return '旧厂街区公仓尚缺普查旅费';return null;
  },
  survey(s){
    if(this.surveyReason(s))return false;const at=s.civilization.elapsed;CivilCity.pay(CivilCity.data(s).wards.yards,this.surveyCost);
    s.civilization.conurbation={schema:1,at,survey:{startedAt:at,remaining:360,paid:this.copy(this.surveyCost)},origin:null,node:null,
      route:null,contract:null,suspended:false,share:'equal',trips:[],nextTrip:1,policies:[],payments:[],history:[],clusterAt:null,nextAction:1,workshop:null};
    CivilCity.plan(s,'yards');this.note(s,'survey','普查员沿湖岸寻找另一座城市。旅费由旧厂街区公仓实付，两人暂离生产岗位。');return true;
  },
  discover(s){
    const d=this.data(s),o=this.origin(s,s.civilization.elapsed);if(!CivilCensus.partition(s,o.population))throw Error('湖滨市人口细分失败');
    d.origin=o;d.survey=null;d.node={cohorts:CivilCity.cohortSeed(o.population),stores:{...o.stores},year:Math.floor(o.at/600),births:{scaled:true,credit:0,mutantCredit:0},health:85,hunger:0,workers:{},contactedAt:o.at,joinedAt:null,
      priority:'balanced',method:'manual',waterEnabled:true,freightEnabled:true,buildings:{road:0,water:1,housing:0},project:null,stable:0,
      economy:null,budget:{produced:{},consumed:{},received:{},sent:{}},born:0,dead:0};
    d.office={cohorts:d.node.cohorts.filter(c=>c.age===64).slice(0,1).map(c=>({...c,count:2})),at:o.at,records:[]};
    CivilCity.plan(s,'lake');CivilCity.plan(s,'yards');
    this.note(s,'contact','湖滨市完成普查：'+o.population+'位居民在湖岸生活。地方住房、水务、工坊和公仓继续归当地；普查没有新增人口。');
  },
  crew(s,id){const d=this.data(s);if(!d)return 0;return (d.survey&&id==='yards'?2:0)+d.trips.filter(p=>p.status==='outbound'||p.status==='returning'||p.status==='recalled').reduce((a,p)=>a+(id===p.depot||id==='lake'?6:0),0);},
  officeReady(s){const d=this.data(s);return !!d?.office&&d.office.cohorts.every(c=>c.age+Math.floor(s.civilization.elapsed/600)-Math.floor(d.office.at/600)<65);},
  plan(s,id,slots,want,reserved){
    const d=this.data(s);if(!d)return;const crew=this.crew(s,id);if(crew)reserved.courier=crew;
    if(d.route?.phase==='building'&&(id===d.route.depot||id==='lake')){want.builder=Math.max(want.builder,20);reserved.routebuilder=20;want.builder=0;}
    if(id!=='lake')return;
    reserved.clerk=this.officeReady(s)?2:0;
    // Imports replace local work only while the tool reserve and a funded, healthy partner
    // support it. On interruption the city reopens its own finite manual workshops.
    const n=d.node,partner=d.route?this.local(s,d.route.depot):null,recent=!!d.contract&&!d.suspended&&partner?.stable>=120&&partner.stores.tools>128,covered=n.stores.tools>240;
    const capacity=d.workshop?.completedAt!==null&&d.workshop?160:80;slots.smith=capacity;want.smith=recent&&covered?16:capacity;
    const parents=n.cohorts.filter(c=>c.age>=17&&c.age<=48).reduce((a,c)=>a+c.count,0),expected=Math.min(Math.ceil(CivilCity.count(n)*.04),Math.max(0,d.origin.housing-CivilCity.count(n))+n.cohorts.filter(c=>c.age===79).reduce((a,c)=>a+c.count,0),Math.floor(parents*.08+n.births.credit));
    want.medic+=Math.ceil(expected*2/60/.15);want.farmer+=Math.ceil(expected*6/60/this.config.foodRate);
    if(d.workshop&&d.workshop.completedAt===null)reserved.localbuilder=20;
    if(recent&&covered)want.farmer+=60;
  },
  targets(s){const n=this.data(s).node;return {food:CivilPopulation.foodPopulation(n.cohorts)*.12*18,medicine:CivilCity.count(n)*.01*8,wood:3200,scrap:2400,tools:720,knowledge:3000,iron:150};},
  officeTick(s){const d=this.data(s);if(this.officeReady(s))return;
    const n=d.node,cohorts=n.cohorts.filter(c=>c.age>=30&&c.age<50&&c.count>=2).slice(0,1).map(c=>({...c,count:2})),paid={wood:4,tools:2,knowledge:6};
    if(!cohorts.length||!CivilCity.pay(n,paid))return;
    d.office.records.push({at:s.civilization.elapsed,previous:{at:d.office.at,cohorts:this.copy(d.office.cohorts)},cohorts:this.copy(cohorts),paid});d.office.at=s.civilization.elapsed;d.office.cohorts=cohorts;
    this.note(s,'office','湖滨市原任公署人员退休。两名当地成年居民接任，交接教具从地方公仓实付，职责和人口均没有重置。');
  },
  safe(s,id,cost,crew=0){
    const n=this.local(s,id);if(!n||n.stable<120||n.health<60)return '当地公共服务尚未稳定';
    if(CivilCity.workforce(n)-Object.values(n.workers).reduce((a,b)=>a+b,0)<crew)return '缺少空闲成年运输员';
    const floor={food:CivilPopulation.foodPopulation(n.cohorts)*.12*6,medicine:CivilCity.count(n)*.01*4,tools:32,iron:0};
    for(const [k,v]of Object.entries(cost))if((n.stores[k]||0)-v<(floor[k]||0))return (CivilText.labels[k]||k)+'须先留足本地储备';return null;
  },
  buildReason(s,depot){const d=this.data(s);if(!d?.node)return '先完成湖岸普查';if(d.route)return '共同道路已有工程记录';
    if(!CivilCity.data(s).wards[depot]||this.local(s,depot).joinedAt===null)return '请选择本城已接纳的出发仓';
    return this.safe(s,depot,this.construction)||this.safe(s,'lake',this.construction);
  },
  build(s,depot){if(this.buildReason(s,depot))return false;const d=this.data(s);for(const id of [depot,'lake'])CivilCity.pay(this.local(s,id),this.construction);
    d.route={depot,startedAt:s.civilization.elapsed,completedAt:null,phase:'building',remaining:240,worked:0,condition:100,paid:this.copy(this.construction)};
    CivilCity.plan(s,depot);CivilCity.plan(s,'lake');this.note(s,'works','两城各付一份路材，各派20名当地建设者修复各自路段。住房与地方仓库不转移。');return true;},
  workshopReason(s,method){const d=this.data(s);if(!d?.node)return '先完成湖岸普查';if(d.workshop)return '地方工坊已有扩建记录';if(!this.workshopCosts[method])return '未知工坊方案';if(d.route?.phase==='building')return '先完成两城道路施工';if(method==='iron'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards))return '钢架工坊需要机械传动与标准计量';return this.safe(s,'lake',this.workshopCosts[method]);},
  workshop(s,method){if(this.workshopReason(s,method))return false;const d=this.data(s),paid=this.copy(this.workshopCosts[method]);CivilCity.pay(d.node,paid);d.workshop={method,paid,startedAt:s.civilization.elapsed,remaining:240,worked:0,completedAt:null};CivilCity.plan(s,'lake');this.note(s,'works','湖滨市选择'+(method==='iron'?'钢架':'木构')+'扩建工坊，建材从地方公仓实付，20名本地建设者施工；外来物资只有实到后才能用。');return true;},
  signReason(s,mode){const d=this.data(s);if(!d?.route||d.route.phase!=='ready')return '先由双方完成道路工程';if(!this.modes[mode])return '未知协作方式';if(d.contract)return '先结束当前有限协约，再签新约';if(this.active(s))return '先等上一批车辆和货物归仓';
    if(mode==='industry'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards))return '工料协作需要机械传动与标准计量；粮医互济无需矿业与电力';
    return this.safe(s,d.route.depot,{knowledge:12})||this.safe(s,'lake',{knowledge:12});},
  sign(s,mode){if(this.signReason(s,mode))return false;const d=this.data(s);for(const id of [d.route.depot,'lake'])CivilCity.pay(this.local(s,id),{knowledge:12});
    d.contract=mode;d.suspended=false;d.policies.push({order:d.nextAction++,at:s.civilization.elapsed,kind:'sign',value:mode});this.note(s,'agreement','两城议定'+this.modes[mode].name+'。仅互供约定物资、共同维护道路；各自人口、资产和公共职责保持独立。');return true;},
  active(s){return this.data(s)?.trips.find(p=>['outbound','returning','recalled'].includes(p.status));},
  suspend(s,value){const d=this.data(s);if(!d?.contract||typeof value!=='boolean'||d.suspended===value)return false;d.suspended=value;d.policies.push({order:d.nextAction++,at:s.civilization.elapsed,kind:'suspend',value});
    if(value)this.recall(s);this.note(s,'supply',value?'两城停止新发运，未抵达货物随原车折返，旅费不退；地方重新承担自给。':'两城恢复发运授权，仍须满足本地储备、运力与道路条件。');return true;},
  end(s){const d=this.data(s);if(!d?.contract)return false;d.contract=null;d.suspended=false;d.policies.push({order:d.nextAction++,at:s.civilization.elapsed,kind:'end',value:null});this.recall(s);this.note(s,'agreement','有限协约已结束。在途货物按路程返还各自仓库，公共道路仍留在当地，没有清空库存或吞并居民。');return true;},
  recall(s){const p=this.active(s);if(p?.status==='outbound'){p.status='recalled';p.recalledAt=s.civilization.elapsed;p.remaining=Math.max(1,this.travel-p.remaining);}},
  setShare(s,value){const d=this.data(s);if(!d?.contract||!this.shares[value]||d.share===value)return false;
    const paid={knowledge:6};if(!CivilCity.pay(this.local(s,d.route.depot),paid))return false;
    d.share=value;d.policies.push({order:d.nextAction++,at:s.civilization.elapsed,kind:'share',value,paid});this.note(s,'burden','后续道路与运行开支改为'+this.shares[value].name+'，已出发批次按原约结清。两城仍各自承担驾驶员口粮。');return true;},
  payment(s,kind,cost){const d=this.data(s),depot=d.route.depot,home=this.split(cost,d.share,'home'),lake=this.split(cost,d.share,'lake');
    if(this.safe(s,depot,home)||this.safe(s,'lake',lake))return false;
    CivilCity.pay(this.local(s,depot),home);CivilCity.pay(d.node,lake);d.payments.push({order:d.nextAction++,at:s.civilization.elapsed,kind,share:d.share,home,lake});return true;},
  repairReason(s){const d=this.data(s);if(!d?.route||d.route.phase!=='ready')return '道路尚未建成';if(d.route.condition>80)return '道路暂不需要维护';
    return this.safe(s,d.route.depot,this.split(this.maintenance,d.share,'home'))||this.safe(s,'lake',this.split(this.maintenance,d.share,'lake'));},
  repair(s){if(this.repairReason(s)||!this.payment(s,'repair',this.maintenance))return false;this.data(s).route.condition=100;this.note(s,'maintenance','双方公仓按约支付检修用料，道路恢复通行能力。');return true;},
  value(cargo){return Object.entries(cargo).reduce((a,[k,v])=>a+this.values[k]*v,0);},
  order(s){
    const d=this.data(s),m=this.modes[d.contract],home=this.local(s,d.route.depot),lake=d.node;
    const remoteTarget=this.targets(s),localTarget={...CivilCity.targets(home,s,d.route.depot),food:CivilPopulation.foodPopulation(home.cohorts)*.12*30};
    const offers=(source,destination,target,limits,side)=>{const fee=this.plus(this.split(this.running,d.share,side),{food:6*.12*this.travel*2/10}),floor={food:CivilPopulation.foodPopulation(source.cohorts)*.12*6,medicine:CivilCity.count(source)*.01*4,tools:32};return Object.fromEntries(Object.entries(limits).map(([k,max])=>[k,Math.max(0,Math.floor(Math.min(max,(target[k]||0)-(destination.stores[k]||0),(source.stores[k]||0)-(floor[k]||0)-(fee[k]||0))))]).filter(([,v])=>v>0));};
    const proposed=offers(home,lake,remoteTarget,m.out,'home'),back=offers(lake,home,localTarget,m.back,'lake');
    // A clearing unit is only the agreed value of these physical baskets. No cash
    // or debt is created. Both sides escrow equal value, with bounded local needs.
    let limit=Math.min(this.value(proposed),this.value(back)),out={};for(const k of ['iron','medicine','tools']){const n=Math.min(proposed[k]||0,Math.floor(limit/this.values[k]));if(n){out[k]=n;limit-=n*this.values[k];}}
    let remaining=this.value(out);const result={};for(const k of ['food','scrap']){const n=Math.min(back[k]||0,remaining);if(n){result[k]=n;remaining-=n;}}
    return {out,back:result};
  },
  dispatchReason(s){const d=this.data(s);if(!d?.contract)return '尚无有限协约';if(d.suspended)return '已暂停发运，地方恢复自给';if(this.active(s))return '原车仍在途，不能重复占用车辆与人员';if(d.route.condition<20)return '路面磨损，须先分担检修材料';
    const m=this.order(s),ration=6*.12*this.travel*2/10;if(this.value(m.out)<80||this.value(m.out)!==this.value(m.back))return '双方暂未形成足够互补缺口，保留库存等待需求';
    for(const [id,cargo,side]of [[d.route.depot,m.out,'home'],['lake',m.back,'lake']]){const fee=this.plus(this.split(this.running,d.share,side),{food:ration}),reason=this.safe(s,id,this.plus(cargo,fee),6);if(reason)return (id==='lake'?'湖滨市':CivilCity.config(id).name)+'：'+reason;}
    return null;
  },
  dispatch(s){if(this.dispatchReason(s))return false;const d=this.data(s),m=this.order(s),ration=6*.12*this.travel*2/10;
    const p={order:d.nextAction++,id:d.nextTrip++,depot:d.route.depot,mode:d.contract,share:d.share,startedAt:s.civilization.elapsed,deliveredAt:null,recalledAt:null,finishedAt:null,status:'outbound',remaining:this.travel,
      out:this.copy(m.out),back:this.copy(m.back),fees:{home:this.plus(this.split(this.running,d.share,'home'),{food:ration}),lake:this.plus(this.split(this.running,d.share,'lake'),{food:ration})}};
    for(const [id,cargo,side]of [[p.depot,p.out,'home'],['lake',p.back,'lake']]){const n=this.local(s,id);CivilRules.pay({stores:n.stores},this.plus(cargo,p.fees[side]));CivilCity.sum(n.budget.sent,cargo);CivilCity.sum(n.budget.consumed,p.fees[side]);}
    d.trips.push(p);d.route.condition-=20;CivilCity.plan(s,p.depot);CivilCity.plan(s,'lake');return true;
  },
  receive(n,cargo){CivilCity.sum(n.stores,cargo);CivilCity.sum(n.budget.received,cargo);},
  tick(s){const d=this.data(s);if(!d)return;const t=s.civilization.elapsed;
    if(d.survey){if(--d.survey.remaining===0)this.discover(s);return;}
    CivilCity.annual(s,'lake');if(t%10===0){this.officeTick(s);CivilCity.settleWard(s,'lake');}
    const w=d.workshop;if(w&&w.completedAt===null&&d.node.economy?.ate&&d.node.workers.localbuilder===20){w.remaining--;w.worked++;if(!w.remaining){w.completedAt=t;CivilCity.plan(s,'lake');this.note(s,'works','湖滨市工坊扩建完成，本地制器岗位由80增至160；停运时能够承担更多自给生产。');}}
    const r=d.route;if(r?.phase==='building'&&d.node.economy?.ate&&this.local(s,r.depot).economy?.ate&&d.node.workers.routebuilder===20&&this.local(s,r.depot).workers.routebuilder===20){r.remaining--;r.worked++;if(!r.remaining){r.phase='ready';r.completedAt=t;this.note(s,'works','两城道路修通，有限协作可以议定。');CivilCity.plan(s,r.depot);CivilCity.plan(s,'lake');}}
    const p=this.active(s);if(p&&--p.remaining===0){
      if(p.status==='outbound'){this.receive(d.node,p.out);this.receive(this.local(s,p.depot),p.back);p.deliveredAt=t;p.status='returning';p.remaining=this.travel;}
      else {if(p.status==='recalled'){this.receive(this.local(s,p.depot),p.out);this.receive(d.node,p.back);}p.status=p.status==='recalled'?'returned':'complete';p.finishedAt=t;CivilCity.plan(s,p.depot);CivilCity.plan(s,'lake');}
    }
    if(t%10===0&&d.contract&&!d.suspended){if(d.route.condition<20)this.repair(s);this.dispatch(s);}
    if(d.clusterAt===null&&d.contract&&d.trips.filter(p=>p.deliveredAt!==null).length>=3&&d.node.stable>=120&&CivilCity.members(s).every(([,n])=>n.stable>=120)){
      d.clusterAt=t;this.note(s,'cluster','炉火城与湖滨市形成了两城协作网：物资按约往来，公共开支分别入账。这是共同承担有限职责的城市群，并非建国或合并仓库。');}
  },
  validate(s){
    const d=this.data(s);if(!d)return;const fail=()=>{throw Error('两城人口、资产或运输账不符');},int=n=>Number.isSafeInteger(n)&&n>=0,time=n=>int(n)&&n<=s.civilization.elapsed,num=n=>Number.isFinite(n)&&n>=0;
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-4,resources=CivilCityContent.resources;
    if(!this.available(s)||d.schema!==1||!time(d.at)||!Array.isArray(d.trips)||d.nextTrip!==d.trips.length+1||!Array.isArray(d.history)||!Array.isArray(d.policies)||!Array.isArray(d.payments)||!this.shares[d.share]||typeof d.suspended!=='boolean')fail();
    if(d.survey){if(d.node!==null||d.origin!==null||d.route!==null||d.contract!==null||d.trips.length||d.clusterAt!==null||d.survey.startedAt!==d.at||!int(d.survey.remaining)||d.survey.remaining<1||d.survey.remaining!==360-(s.civilization.elapsed-d.at)||!same(d.survey.paid,this.surveyCost))fail();return;}
    const o=d.origin,n=d.node;if(!o||!n||o.at!==d.at+360||!same(o,this.origin(s,o.at))||!Array.isArray(n.cohorts)||n.cohorts.length>160||n.cohorts.some(c=>!int(c.age)||c.age>=80||!int(c.count)||!c.count||!['human','mutant'].includes(c.identity))||n.year!==Math.floor(s.civilization.elapsed/600)||!int(n.born)||!int(n.dead)||CivilCity.count(n)!==o.population+n.born-n.dead||CivilCity.count(n)>o.housing||n.contactedAt!==o.at||n.joinedAt!==null||!num(n.health)||n.health>100||!num(n.hunger)||!num(n.stable)||n.stable>600||n.priority!=='balanced'||n.method!=='manual'||n.waterEnabled!==true||n.freightEnabled!==true||!same(n.buildings,{road:0,water:1,housing:0})||n.project!==null)fail();
    const partitions=CivilCensus.data(s).entries.filter(e=>e.kind==='partition');if(partitions.length!==1||partitions[0].at!==o.at||partitions[0].count!==o.population)fail();
    if(!n.births||n.births.scaled!==true||!num(n.births.credit)||n.births.credit>=1||!num(n.births.mutantCredit)||n.births.mutantCredit>=1||Object.values(n.workers).some(v=>!int(v))||Object.values(n.workers).reduce((a,b)=>a+b,0)>CivilCity.workforce(n))fail();
    for(const bucket of [n.stores,...['produced','consumed','received','sent'].map(k=>n.budget?.[k])])if(!bucket||Object.entries(bucket).some(([k,v])=>!resources.includes(k)||!num(v)))fail();
    for(const k of resources)if(!near(n.stores[k],o.stores[k]+(n.budget.produced[k]||0)-(n.budget.consumed[k]||0)+(n.budget.received[k]||0)-(n.budget.sent[k]||0)))fail();
    const ordered=[...d.policies,...d.payments,...d.trips].sort((a,b)=>a.order-b.order);if(d.nextAction!==ordered.length+1||ordered.some((e,i)=>e.order!==i+1||i&&e.at===undefined&&e.startedAt< (ordered[i-1].at??ordered[i-1].startedAt)||i&&e.at!==undefined&&e.at<(ordered[i-1].at??ordered[i-1].startedAt)))fail();
    let contract=null,share='equal',suspended=false,last=d.at;for(const e of d.policies){if(!time(e.at)||e.at<last||!d.route||e.at<d.route.completedAt)fail();last=e.at;
      if(e.kind==='sign'){if(contract||!this.modes[e.value])fail();contract=e.value;suspended=false;}
      else if(e.kind==='share'){if(!contract||!this.shares[e.value]||share===e.value||!same(e.paid,{knowledge:6}))fail();share=e.value;}
      else if(e.kind==='suspend'){if(!contract||typeof e.value!=='boolean'||suspended===e.value)fail();suspended=e.value;}
      else if(e.kind==='end'){if(!contract||e.value!==null)fail();contract=null;suspended=false;}else fail();}
    if(contract!==d.contract||share!==d.share||suspended!==d.suspended)fail();
    const w=d.workshop;if(w){if(!this.workshopCosts[w.method]||!same(w.paid,this.workshopCosts[w.method])||!time(w.startedAt)||w.startedAt<o.at||!int(w.worked)||w.worked>240||w.remaining!==240-w.worked||w.completedAt!==null&&(!time(w.completedAt)||w.completedAt-w.startedAt<240||w.worked!==240)||w.completedAt===null&&w.remaining<1)fail();}
    const r=d.route;if(r){if(!CivilCity.data(s).wards[r.depot]||!time(r.startedAt)||r.startedAt<o.at||!same(r.paid,this.construction)||!int(r.worked)||r.worked>240||!int(r.condition)||r.condition>100||r.condition%20)fail();
      if(r.phase==='building'){if(r.completedAt!==null||r.remaining!==240-r.worked||r.remaining<1||d.policies.length||d.trips.length)fail();}else if(r.phase!=='ready'||!time(r.completedAt)||r.completedAt-r.startedAt<240||r.worked!==240||r.remaining!==0)fail();
    }else if(d.policies.length||d.trips.length||d.payments.length)fail();
    let busy=0,end=0,expectedSent={},expectedReceived={},minConsumed={};
    const currentAt=(order)=>{let mode=null,burden='equal',paused=false;for(const e of d.policies){if(e.order>order)break;if(e.kind==='sign'){mode=e.value;paused=false;}if(e.kind==='end'){mode=null;paused=false;}if(e.kind==='share')burden=e.value;if(e.kind==='suspend')paused=e.value;}return {mode,burden,paused};};
    // Trips capture their exact contract and fee. Subsequent policy changes cannot
    // reprice an in-flight cargo. Same-second UI changes are allowed after dispatch.
    for(const [i,p]of d.trips.entries()){
      const m=this.modes[p.mode],ration=6*.12*this.travel*2/10;
      if(!r||!m||!this.shares[p.share]||p.id!==i+1||p.depot!==r.depot||!time(p.startedAt)||p.startedAt<r.completedAt||p.startedAt<end||!p.out||!p.back||Object.entries(p.out).some(([k,v])=>!Object.hasOwn(m.out,k)||!int(v)||!v||v>m.out[k])||Object.entries(p.back).some(([k,v])=>!Object.hasOwn(m.back,k)||!int(v)||!v||v>m.back[k])||this.value(p.out)<80||this.value(p.out)!==this.value(p.back)||Object.values(p.out).reduce((a,b)=>a+b,0)>this.capacity||Object.values(p.back).reduce((a,b)=>a+b,0)>this.capacity||!same(p.fees,{home:this.plus(this.split(this.running,p.share,'home'),{food:ration}),lake:this.plus(this.split(this.running,p.share,'lake'),{food:ration})}))fail();
      const agreement=currentAt(p.order);if(agreement.mode!==p.mode||agreement.burden!==p.share||agreement.paused)fail();
      CivilCity.sum(expectedSent,p.back);CivilCity.sum(minConsumed,p.fees.lake);
      if(p.deliveredAt!==null){if(p.deliveredAt!==p.startedAt+this.travel||!time(p.deliveredAt)||p.recalledAt!==null||!['returning','complete'].includes(p.status))fail();CivilCity.sum(expectedReceived,p.out);}
      if(p.recalledAt!==null){if(!time(p.recalledAt)||p.recalledAt<p.startedAt||p.recalledAt>=p.startedAt+this.travel||p.deliveredAt!==null||!['recalled','returned'].includes(p.status)||!d.policies.some(e=>e.at===p.recalledAt&&(e.kind==='end'||e.kind==='suspend'&&e.value)))fail();}
      if(['outbound','returning','recalled'].includes(p.status)){busy++;if(p.finishedAt!==null||!int(p.remaining)||p.remaining<1||p.remaining>this.travel)fail();const due=p.status==='outbound'?p.startedAt+this.travel:p.status==='returning'?p.startedAt+this.travel*2:p.recalledAt+Math.max(1,p.recalledAt-p.startedAt);if(due-s.civilization.elapsed!==p.remaining)fail();end=Infinity;}
      else if(['complete','returned'].includes(p.status)){const due=p.status==='complete'?p.startedAt+this.travel*2:p.recalledAt+Math.max(1,p.recalledAt-p.startedAt);if(p.finishedAt!==due||!time(p.finishedAt)||p.remaining!==0||p.status==='complete'&&p.deliveredAt===null||p.status==='returned'&&p.recalledAt===null)fail();end=p.finishedAt;if(p.status==='returned')CivilCity.sum(expectedReceived,p.back);}else fail();
      if(p.status==='outbound'&&(p.deliveredAt!==null||p.recalledAt!==null))fail();
    }
    if(busy>1)fail();
    for(const e of d.payments){if(!time(e.at)||e.kind!=='repair'||!this.shares[e.share]||currentAt(e.order).burden!==e.share||!same(e.home,this.split(this.maintenance,e.share,'home'))||!same(e.lake,this.split(this.maintenance,e.share,'lake')))fail();CivilCity.sum(minConsumed,e.lake);}
    if(r){CivilCity.sum(minConsumed,this.construction);let condition=100;const events=[...d.trips.map(p=>({at:p.startedAt,kind:'trip',order:p.order})),...d.payments.map((e,i)=>({at:e.at,kind:'repair',order:e.order}))].sort((a,b)=>a.order-b.order);for(const e of events){if(e.kind==='repair'){if(condition>80)fail();condition=100;}else{if(condition<20)fail();condition-=20;}}if(condition!==r.condition)fail();}
    if(w)CivilCity.sum(minConsumed,w.paid);
    CivilCity.sum(minConsumed,{knowledge:12*d.policies.filter(e=>e.kind==='sign').length});
    for(const k of resources)if(!near(n.budget.sent[k]||0,expectedSent[k]||0)||!near(n.budget.received[k]||0,expectedReceived[k]||0)||(n.budget.consumed[k]||0)+1e-6<(minConsumed[k]||0))fail();
    if(!d.office||!time(d.office.at)||!Array.isArray(d.office.records))fail();let prior={at:o.at,cohorts:CivilCity.cohortSeed(o.population).filter(c=>c.age===64).slice(0,1).map(c=>({...c,count:2}))};
    for(const e of d.office.records){if(!time(e.at)||e.at<prior.at||!same(e.previous,prior)||!same(e.paid,{wood:4,tools:2,knowledge:6})||!Array.isArray(e.cohorts)||e.cohorts.length!==1||e.cohorts[0].count!==2||!int(e.cohorts[0].age)||e.cohorts[0].age<30||e.cohorts[0].age>=50||!['human','mutant'].includes(e.cohorts[0].identity)||prior.cohorts.some(c=>c.age+Math.floor(e.at/600)-Math.floor(prior.at/600)<65))fail();prior={at:e.at,cohorts:e.cohorts};}
    if(!same(prior,{at:d.office.at,cohorts:d.office.cohorts}))fail();
    if(d.clusterAt!==null&&(!time(d.clusterAt)||d.trips.filter(p=>p.deliveredAt!==null&&p.deliveredAt<=d.clusterAt).length<3||!d.history.some(e=>e.kind==='cluster'&&e.at===d.clusterAt)))fail();
    last=d.at;for(const e of d.history){if(!time(e.at)||e.at<last||!['survey','contact','office','works','agreement','supply','burden','maintenance','cluster'].includes(e.kind)||typeof e.text!=='string'||e.text.length>300)fail();last=e.at;}
  }
};
