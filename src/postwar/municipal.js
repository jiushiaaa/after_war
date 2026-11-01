/* MPL-2.0 — Local construction and economy; Regions alone owns residents, stores and workers. */
if(typeof CivilAdvancedContent!=='undefined'){Object.assign(CivilMunicipalContent.facilities,CivilAdvancedContent.facilities);CivilMunicipalContent.jobs.push(...Object.keys(CivilAdvancedContent.jobs));}
if(typeof CivilServiceContent!=='undefined')CivilMunicipalContent.jobs.push(...Object.keys(CivilServiceContent.jobs).filter(k=>k!=='servicebuilder'));
var CivilMunicipal={
  pendingIds:['municipalConsent_river','municipalConsent_rail','municipalConsent_highland','municipalTown_river','municipalTown_rail','municipalTown_highland','municipalCity_river','municipalCity_rail','municipalCity_highland'],
  init(s){if(s.civilization.municipal===undefined)s.civilization.municipal={schema:1,nodes:{}};},
  has(s,id){const nodes=s.civilization.municipal?.nodes;return typeof id==='string'&&Object.hasOwn(CivilRegionContent,id)&&!!nodes&&Object.hasOwn(nodes,id)&&!!nodes[id];},
  node(s,id){return s.civilization.regions?.nodes[id];},
  data(s,id){return s.civilization.municipal?.nodes[id];},
  eligible(s,id){const n=this.node(s,id);return !!(s.civilization.urban?.city && s.civilization.tech.urbanworks && n?.completedProjects.publicWorks && ['associated','integrated'].includes(n.relation));},
  activate(s,id){
    this.init(s);if(this.has(s,id)||!this.eligible(s,id)||!CivilRules.pay(s,CivilMunicipalContent.agreementCost))return false;
    const n=this.node(s,id),baseWorkers={};
    for(const [job,count]of Object.entries(n.workers))if(job!=='builder' && count)baseWorkers[job]=count;
    s.civilization.municipal.nodes[id]={agreedAt:s.civilization.elapsed,baseHousing:CivilRegionContent[id].population+12,baseWorkers,buildings:{},nextProject:1,project:null,completed:[],town:false,city:false,townStable:0,cityStable:0,pollution:0,power:{generation:0,used:0,demand:0},economy:null};
    this.planWorkers(s,id);return true;
  },
  capacity(s,id){const m=this.data(s,id);return m?m.baseHousing+(m.buildings.residential||0)*24+(m.buildings.blockhousing||0)*96+(typeof CivilServices!=='undefined'?CivilServices.capacityBonus(s,id):0):CivilRegionContent[id]?.population+(this.node(s,id)?.completedProjects.publicWorks?12:0);},
  legacyJobLimits(id){
    const cfg=CivilRegionContent[id],maxPopulation=cfg.population+12,limits={...cfg.workers,...cfg.service};
    limits.medic=Math.max(limits.medic||0,Math.ceil((maxPopulation*.01+(cfg.back.medicine||0)*10/(cfg.travel*2+10))/.15));
    limits.farmer+=Math.ceil(Math.max(0,12*.12+(limits.medic-(cfg.service.medic||cfg.workers.medic||0))*.2)/.8);
    return limits;
  },
  jobCapacity(s,id){
    const m=this.data(s,id);if(!m)return {};
    const result={...m.baseWorkers};for(const [key,count]of Object.entries(m.buildings))for(const [job,cap]of Object.entries(CivilMunicipalContent.facilities[key].jobs||{}))result[job]=(result[job]||0)+count*cap;
    if(typeof CivilServices!=='undefined')for(const [job,cap]of Object.entries(CivilServices.jobs(s,id)))result[job]=(result[job]||0)+cap;
    if(typeof CivilCooperative!=='undefined'&&CivilCooperative.data(s,id)){result.smith=Math.max(0,(result.smith||0)-4);result.coopsmith=4;}
    if(typeof CivilRuins!=='undefined'&&CivilRuins.needsWorkers(s,id))result.ruinworker=4;
    result.builder=m.project?.status==='building'||s.civilization.regions?.upgrades?.projects[id]?.status==='building'||typeof CivilServices!=='undefined'&&CivilServices.data(s,id)?.project?.status==='building'?2:0;return result;
  },
  canAccept(s,id){return this.has(s,id) && ['associated','integrated'].includes(this.node(s,id)?.relation);},
  tradeExports(s,id){
    if(typeof CivilRegions!=='undefined'&&CivilRegions.committedFlow){const flow=CivilRegions.committedFlow(s,id);return Object.fromEntries(Object.entries(flow).filter(([,n])=>n<0).map(([key,n])=>[key,-n]));}
    const route=s.civilization.regions?.routes[id],out={};if(route?.enabled && route.assigned>=2)for(const [key,value]of Object.entries(CivilRegionContent[id].back))out[key]=value*10/(route.travel*2+10);
    return out; // Conservative: never treat an expected delivery from home as local production.
  },
  outputFactor(s,id){const n=this.node(s,id);return (n.health<30?.75:1)*((n.stores.food||0)<CivilPopulation.foodPopulation(n.cohorts)*.12?.65:1);},
  planWorkers(s,id){
    const n=this.node(s,id),m=this.data(s,id);if(!n||!m)return {};
    const cap=this.jobCapacity(s,id),base=m.baseWorkers,exp=this.tradeExports(s,id),desired={},p=n.population;
    const positive=(job,value)=>Math.min(cap[job]||0,Math.max(base[job]||0,Math.ceil(value)));
    desired.medic=positive('medic',(p*.01+(exp.medicine||0)+.15)/.15);
    desired.teacher=positive('teacher',CivilPopulation.children(n.cohorts)/20);
    const service=typeof CivilServices!=='undefined'?CivilServices.data(s,id):null;
    desired.pharmacist=positive('pharmacist',Math.max(1,(p*.01+(exp.medicine||0)+.3-desired.medic*.15)/.4));
    desired.waterworker=positive('waterworker',Math.ceil((p+160)/(service?.manualWater?300:600))*(service?.manualWater?8:4));
    const manualHeat=typeof CivilHeating!=='undefined'&&CivilHeating.manual(s,id),heatStations=Math.min(service?.buildings.heatingplant||0,Math.ceil(p/(manualHeat?300:600)));
    desired.heatingworker=positive('heatingworker',heatStations*(manualHeat?4:2));
    const heatPower=manualHeat?0:heatStations,heatCoal=heatStations*(manualHeat?1.2:.8);
    const farmRate=typeof CivilServices!=='undefined'?CivilServices.farmRate(s,id):1.4,oldFarm=base.farmer||0,fieldCap=(m.buildings.farmland||0)*8;
    const farmFood=count=>Math.min(count,oldFarm)*.8+Math.min(Math.max(0,count-oldFarm),fieldCap)*1.4+Math.max(0,count-oldFarm-fieldCap)*farmRate;
    const aged=CivilPopulation.age(n.cohorts).cohorts,reserved=typeof CivilUrban!=='undefined'?CivilUrban.reservedBeds(s,id):0;
    const birthPlan=CivilPopulation.births(aged,{...(n.births||{scaled:false,credit:0,mutantCredit:0})},{yearStartPopulation:p,beds:Math.max(0,this.capacity(s,id)-CivilPopulation.count(aged)-reserved),health:n.health,hunger:0,food:Number.MAX_SAFE_INTEGER,medicine:Number.MAX_SAFE_INTEGER});
    // A year contains sixty settlements. Local farms fund births as well as daily meals;
    // previewing that budget must not advance the authoritative fractional birth ledger.
    const contract=typeof CivilCooperative!=='undefined'&&CivilCooperative.contractRunning(s,id);
    const farmFactor=this.outputFactor(s,id),foodNeed=CivilPopulation.foodPopulation(n.cohorts)*.12+desired.medic*.2+desired.pharmacist*.2+(exp.food||0)+birthPlan.cost.food/60+.5+(contract?6:0);
    desired.farmer=Math.min(oldFarm,cap.farmer||0);
    while(desired.farmer<(cap.farmer||0)&&farmFood(desired.farmer)*farmFactor<foodNeed)desired.farmer++;
    for(const job of ['miner','collier','smelter','machinist'])desired[job]=positive(job,Math.max(2,Math.ceil(p/100)));
    desired.steelworker=positive('steelworker',2);desired.glassworker=positive('glassworker',2);
    desired.chemist=positive('chemist',Math.max(2,(desired.pharmacist*.15+(service?.buildings.waterworks||0)*.2+desired.steelworker*.05+(m.buildings.filterplant||0)*.03+.2)/.4));
    desired.mineralworker=positive('mineralworker',(desired.chemist*.4+desired.glassworker*.6+.2)/1.2);
    const servicePower=(service?.manualWater?0:Math.floor(desired.waterworker/4)*4)+desired.pharmacist*.5+heatPower;
    desired.utilityworker=positive('utilityworker',(servicePower+desired.chemist*2+desired.steelworker*2+desired.glassworker+(m.buildings.filterplant||0)*2)/10);
    const heatBackup=Math.min(heatPower,Math.max(0,servicePower+desired.chemist*2+desired.steelworker*2+desired.glassworker+(m.buildings.filterplant||0)*2-desired.utilityworker*10));
    desired.electrician=positive('electrician',(Math.max(0,desired.machinist-(base.machinist||0))*2+(m.buildings.scrubber?1:0)+heatBackup)/4);
    if(service||desired.chemist||desired.steelworker||desired.glassworker||desired.utilityworker){
      // Scale spare-parts labor to actual maintenance. Keep two real powered jobs
      // beyond any legacy hand-work positions when built capacity permits them.
      const partsNeed=desired.electrician*.02+desired.utilityworker*.03+(service?.buildings.waterworks||0)*.02+heatStations*.02+(m.buildings.scrubber?.01:0)+(m.buildings.filterplant||0)*.02+(exp.parts||0)+.25;
      desired.machinist=positive('machinist',Math.max((base.machinist||0)+2,partsNeed/.5));
      desired.electrician=positive('electrician',(Math.max(0,desired.machinist-(base.machinist||0))*2+(m.buildings.scrubber?1:0)+heatBackup)/4);
    }
    if(desired.steelworker)desired.smelter=positive('smelter',Math.max(desired.smelter,(desired.steelworker*1.2+desired.machinist*.5+(exp.iron||0)+.2)/.6));
    if(desired.smelter)desired.miner=positive('miner',Math.max(desired.miner,desired.smelter-(base.smelter||0)));
    if(desired.utilityworker||desired.chemist||desired.steelworker||desired.glassworker||heatStations)desired.collier=positive('collier',Math.max(desired.collier,desired.smelter*.6+desired.electrician*.6+desired.utilityworker*.9+desired.chemist*.3+desired.steelworker*.7+desired.glassworker*.4+heatCoal+.2));
    const toolNeed=Math.max(0,desired.farmer-oldFarm)*.01+(desired.miner+desired.collier+desired.mineralworker)*.03+(desired.smelter+desired.machinist+desired.chemist+desired.steelworker)*.01;
    desired.smith=positive('smith',(toolNeed+(exp.tools||0)+.05)/.25);
    desired.salvager=positive('salvager',(desired.medic*.1+desired.smith*.6+(base.smelter||0)+desired.machinist*.2+(contract?4:0))/.8+1);
    desired.gatherer=positive('gatherer',(desired.teacher*.1+desired.smith*.2+(m.buildings.scrubber?.2:0)+(m.buildings.filterplant||0)*.2+(exp.wood||0)+(contract?4/3:0))/.5+1);
    desired.coopsmith=typeof CivilCooperative!=='undefined'&&CivilCooperative.productionReady(s,id)?4:0;desired.windworker=cap.windworker||0;desired.builder=cap.builder;
    let left=CivilPopulation.workforce(n.cohorts);n.workers={};
    for(const job of ['farmer','medic','waterworker','pharmacist','heatingworker','builder','coopsmith','smith','salvager','gatherer','teacher','miner','collier','smelter','electrician','windworker','utilityworker','mineralworker','chemist','steelworker','glassworker','machinist']){const count=Math.min(left,desired[job]||0);if(count)n.workers[job]=count;left-=count;}
    // Two organisers and twelve adult participants come only from the actual
    // labour remaining after production, care, teaching and construction.
    if((cap.communityworker||0)>=14&&left>=14&&typeof CivilCulture!=='undefined'&&CivilCulture.needsWorkers(s,id)){n.workers.communityworker=14;left-=14;}
    if(left>=4&&typeof CivilRuins!=='undefined'&&CivilRuins.needsWorkers(s,id))n.workers.ruinworker=4;
    return n.workers;
  },
  pay(stores,cost){if(Object.entries(cost).some(([key,n])=>(stores[key]||0)+1e-8<n))return false;for(const [key,n]of Object.entries(cost))stores[key]=Math.max(0,(stores[key]||0)-n);return true;},
  settleNode(s,id){
    const n=this.node(s,id),m=this.data(s,id);if(!n||!m)return {};
    if(typeof CivilServices!=='undefined')CivilServices.begin(s,id);
    const st=n.stores,before={...st};if(typeof CivilCooperative!=='undefined')CivilCooperative.standingTrade(s,id);
    this.planWorkers(s,id);const w=n.workers,base=m.baseWorkers,b=m.buildings,produced={},ran={},paidInputs={};
    const recordInputs=cost=>{for(const [key,v]of Object.entries(cost))paidInputs[key]=(paidInputs[key]||0)+v;};
    const factor=this.outputFactor(s,id);
    const run=(label,count,cost,output,reserve={},scale=true)=>{
      let batches=count;for(const [key,value]of Object.entries(cost))batches=Math.min(batches,Math.floor((Math.max(0,(st[key]||0)-(reserve[key]||0))+1e-8)/value));
      const actual=Object.fromEntries(Object.entries(cost).map(([key,v])=>[key,v*batches]));this.pay(st,actual);recordInputs(actual);
      for(const [key,v]of Object.entries(output)){const amount=v*batches*(scale?factor:1);st[key]=(st[key]||0)+amount;produced[key]=(produced[key]||0)+amount;}
      ran[label]=(ran[label]||0)+batches;return batches;
    };
    const old=job=>Math.min(w[job]||0,base[job]||0),added=job=>Math.max(0,(w[job]||0)-old(job));
    run('gatherer',w.gatherer||0,{}, {wood:.5});run('salvager',w.salvager||0,{}, {scrap:.8});run('smith',w.smith||0,{wood:.2,scrap:.6},{tools:.25});
    const farmBase=(m.buildings.farmland||0)*8,oldNewFarmers=Math.min(added('farmer'),farmBase),serviceFarmers=Math.max(0,added('farmer')-farmBase);
    run('farmer',old('farmer'),{},{food:.8});run('farmer',oldNewFarmers,{tools:.01},{food:1.4});
    if(serviceFarmers)run('farmer',serviceFarmers,{tools:.01},{food:typeof CivilServices!=='undefined'?CivilServices.farmRate(s,id):1.4});
    const cooperative=typeof CivilCooperative!=='undefined'?CivilCooperative.settle(s,id,factor):{meal:0};
    const meal=Math.max(0,CivilPopulation.foodPopulation(n.cohorts)*.12-cooperative.meal),mealPaid=Math.min(meal,st.food||0),ate=this.pay(st,{food:meal});if(!ate)st.food=0;
    run('medic',old('medic'),{food:.2,scrap:.1,...(id==='highland'?{coal:.01}:{})},{medicine:.15});
    run('medic',added('medic'),{food:.2,scrap:.1},{medicine:.15});
    run('teacher',w.teacher||0,{wood:.1},{knowledge:.2});
    run('legacySmelter',old('smelter'),{scrap:1,coal:.2,tools:.01},{iron:.6});
    run('legacyMachinist',old('machinist'),{iron:.5,scrap:.2,tools:.01},{parts:.3},{iron:CivilRegionContent[id].back.iron||0});
    const mine=run('miner',added('miner'),{tools:.03},{ore:1.2}),coal=run('collier',added('collier'),{tools:.03},{coal:1});
    const smelt=run('smelter',added('smelter'),{ore:1.2,coal:.6,tools:.01},{iron:.6});
    const generators=run('electrician',added('electrician'),{coal:.6,parts:.02},{}),machines=added('machinist');
    const rawRun=(job,count,cost,out)=>run(job,count,cost,out,{},false);
    const extra=typeof CivilAdvanced!=='undefined'?CivilAdvanced.prepare(s,{factor,run:rawRun},id):{generation:0,pollution:0};
    m.power={generation:generators*4*factor+extra.generation,used:0,demand:machines*2+(b.scrubber?1:0)};let power=m.power.generation,scrubbed=false;
    const service=typeof CivilServices!=='undefined'?CivilServices.run(s,id,{factor,run:rawRun,powerAvailable:power}):{used:0,demand:0};
    power-=service.used;m.power.used+=service.used;m.power.demand+=service.demand;
    if(b.scrubber && power>=1 && this.pay(st,{wood:.2,parts:.01})){recordInputs({wood:.2,parts:.01});power--;m.power.used++;scrubbed=true;}
    const advanced=typeof CivilAdvanced!=='undefined'?CivilAdvanced.run(s,{factor,run:rawRun,powerAvailable:power},id):{used:0,demand:0,pollution:0};
    power-=advanced.used;m.power.used+=advanced.used;m.power.demand+=advanced.demand;
    const powered=run('poweredMachine',Math.min(machines,Math.floor((power+1e-8)/2)),{iron:.5,scrap:.2,tools:.01},{parts:.5});
    m.power.used+=powered*2;const manual=run('manualMachine',machines-powered,{iron:.5,scrap:.2,tools:.01},{parts:.3});
    m.pollution=Math.max(0,Math.min(100,m.pollution+smelt*.05+generators*.03+extra.pollution+advanced.pollution-(scrubbed?.4:.02)));
    const care=n.population*.01,treated=(w.medic||0)>0 && this.pay(st,{medicine:care});
    n.health=Math.max(0,Math.min(100,n.health+(ate&&treated?.25:ate?-.02:-.4)-(m.pollution>=40?.05*(1+m.pollution/50):0)));
    n.unrest=Math.max(0,Math.min(100,n.unrest+(ate?-.02:.1)+(CivilRegions.load(s)>CivilRegions.capacity(s)?.1:0)));
    const deltas={};for(const key of new Set([...Object.keys(before),...Object.keys(st)]))deltas[key]=(st[key]||0)-(before[key]||0);
    const exports=this.tradeExports(s,id),previousAt=m.economy?.at;
    m.economy={at:s.civilization.elapsed,food:(deltas.food||0)-(exports.food||0),medicine:(deltas.medicine||0)-(exports.medicine||0),
      treatment:ate&&treated&&(produced.medicine||0)+1e-8>=care,education:CivilPopulation.children(n.cohorts)<=(ran.teacher||0)*20,
      productivePower:powered*2,industry:mine>0&&coal>0&&smelt>0&&powered+manual>0,deltas,
      paidInputs:{at:s.civilization.elapsed,resources:paidInputs},treatmentInputs:{at:s.civilization.elapsed,resources:{medicine:treated?care:0}},mealInputs:{at:s.civilization.elapsed,resources:{food:mealPaid+cooperative.meal}}};
    if(previousAt!==s.civilization.elapsed){m.townStable=this.developmentReady(s,id)?Math.min(180,m.townStable+10):0;m.cityStable=this.developmentReady(s,id,true)?Math.min(300,m.cityStable+10):0;}
    return {};
  },
  foodReserve(s,id,cohorts=[]){return (CivilPopulation.foodPopulation(this.node(s,id).cohorts)+CivilPopulation.foodPopulation(cohorts))*.12*12;},
  forecast(s,id,cohorts=[]){
    if(!this.has(s,id))return {reason:'地方尚未同意市政工程'};
    const copy=JSON.parse(JSON.stringify(s)),n=this.node(copy,id),before={...n.stores};copy.civilization.elapsed=typeof CivilServices!=='undefined'?CivilServices.nextSettlementAt(copy,id):copy.civilization.elapsed+10-(copy.civilization.productionClock||0);n.cohorts.push(...cohorts.map(c=>({...c})));n.population=CivilPopulation.count(n.cohorts);
    this.settleNode(copy,id);const e=this.data(copy,id).economy;
    if(typeof CivilFinance!=='undefined')CivilFinance.settle(copy);
    const deltas={};for(const key of new Set([...Object.keys(before),...Object.keys(n.stores)]))deltas[key]=(n.stores[key]||0)-(before[key]||0);
    return {copy,deltas,food:e.food,medicine:e.medicine,education:e.education,treatment:e.treatment,productivePower:e.productivePower,industry:e.industry,paidInputs:e.paidInputs,treatmentInputs:e.treatmentInputs,mealInputs:e.mealInputs,reason:null};
  },
  serviceCheck(s,id,cohorts=[]){
    if(!this.canAccept(s,id))return '地方尚未同意共同接纳';const n=this.node(s,id),m=this.data(s,id);
    if(n.health<60)return '先恢复地方健康';
    if(!(m.buildings.clinic && m.buildings.school && m.buildings.farmland))return '先建设地方田片、诊疗站和学舍';
    if((n.stores.food||0)+1e-8<this.foodReserve(s,id,cohorts))return '地方须留下120秒居民口粮';
    const f=this.forecast(s,id,cohorts);
    if(typeof CivilHeating!=='undefined'){const heat=CivilHeating.growthReason(s,id,cohorts,f.copy);if(heat)return heat;}
    if(!f.education)return '地方教师或教材不能覆盖新增儿童';
    if(!f.treatment || f.medicine<-1e-8)return '地方药品生产不足以持续治疗';
    if(f.food<-1e-8)return '地方农田与工具还不能持续供养';
    if(s.civilization.regions.adminService===false)return '地方公共行政暂未维持';return null;
  },
  admit(s,id,cohorts){const n=this.node(s,id);if(!this.has(s,id)||!n)return 0;const count=CivilPopulation.count(cohorts);n.cohorts.push(...cohorts.map(c=>({...c})));n.population+=count;this.planWorkers(s,id);return count;},
  developmentReady(s,id,city=false){
    return this.developmentChecks(s,id,city).every(row=>row.ready);
  },
  developmentChecks(s,id,city=false){
    const n=this.node(s,id),m=this.data(s,id),e=m?.economy,r=s.civilization.regions;
    const rows=[],add=(id,label,ready,value,hint)=>rows.push({id,label,ready:!!ready,value,hint}),number=x=>Number((Number(x)||0).toFixed(2));
    add('agreement','地方议约',this.canAccept(s,id),this.canAccept(s,id)?'共同营建有效':'尚未同意共同营建','先取得地方同意');
    if(!n||!m)return rows;
    add('population','实住居民',n.population>=(city?400:80),n.population+' / '+(city?400:80),'扩建住房并维持供养后接纳家庭；在途不计入');
    add('housing','住房容量',n.population<=this.capacity(s,id),n.population+' / '+this.capacity(s,id),'住房分类查看可扩建住区');
    add('health','居民健康',n.health>=(city?70:60),number(n.health)+' / '+(city?70:60),'先恢复口粮、诊疗与药品');
    add('receipt','近期供养记录',!!e&&s.civilization.elapsed-e.at<=10,e?'距今 '+number(s.civilization.elapsed-e.at)+' 秒':'尚未生产结算','等待下一轮真实生产结算');
    add('facilities','基础公共设施',m.buildings.farmland&&m.buildings.clinic&&m.buildings.school,['farmland','clinic','school'].map(k=>CivilMunicipalContent.facilities[k].name+' '+(m.buildings[k]||0)).join('、'),'供养分类补齐田片、诊疗站和学舍');
    add('education','儿童教学',e?.education,e?.education?'已覆盖':'未覆盖','需实际教师、学舍和木料教材');
    add('treatment','持续治疗',e?.treatment,e?.treatment?'已覆盖':'未覆盖','需实际医护、当轮产药与药品支出');
    add('food','粮食净供给',!!e&&e.food>=-1e-8,e?number(e.food)+' / 10秒':'无近期记录','补田片、农工与工具，并承担现有贸易义务');
    add('medicine','药品净供给',!!e&&e.medicine>=-1e-8,e?number(e.medicine)+' / 10秒':'无近期记录','补诊疗产能、食物和废料；药剂另需供电与化学品');
    add('administration','公共行政',r.adminService!==false,r.adminService===false?'物资不足':'正常','维持公共行政的实际物资支出');
    add('heating','已交接供暖',typeof CivilHeating==='undefined'||CivilHeating.covered(s,id),typeof CivilHeating!=='undefined'&&CivilHeating.handed(s,id)?CivilHeating.capacity(s,id)+' / '+n.population+' 人份':'尚未交接集中供暖','供养分类检查供热站、燃料、值守和供电');
    add('route','通路与交付',CivilRegions.serviceReady(s,id),CivilRegions.serviceReady(s,id)?'近期实际交付有效':'通路或交付不足','保持通路启用、班组与实际货物到达；建设运材也可证明服务');
    if(city){
      add('town','正式镇制',m.town,m.town?'已登记':'尚未登记','先完成镇制的持续供养与登记');
      add('industry','地方工业链',e?.industry,e?.industry?'当轮实际运行':'尚未完整运行','需地方采矿、产煤、冶炼与机械生产同时实际运行');
      add('power','机械生产用电',(e?.productivePower||0)>=4,number(e?.productivePower)+' / 4','至少2位新增机械工实际用电；地方随实住人口与维护需求配工，先保障供养与扩居');
      add('pollution','地方烟尘',m.pollution<40,number(m.pollution)+' / 小于40','能源分类建设烟尘处理并保持材料和供电');
      add('reserve_food','居民口粮储备',(n.stores.food||0)+1e-8>=this.foodReserve(s,id),number(n.stores.food)+' / '+number(this.foodReserve(s,id)),'至少留下120秒实际居民口粮');
      for(const [key,amount]of Object.entries({tools:40,iron:40,parts:20}))add('reserve_'+key,(CivilText.labels[key]||key)+'储备',n.stores[key]>=amount,number(n.stores[key])+' / '+amount,'当地仓库实际存量；在途、主城库存均不计入');
    }
    return rows;
  },
  facilityGate(s,id,type){
    const m=this.data(s,id),d=CivilMunicipalContent.facilities[type];if(!m||!d||!this.canAccept(s,id)||(m.buildings[type]||0)>=d.max)return false;
    if(typeof CivilAdvancedContent!=='undefined'&&Object.hasOwn(CivilAdvancedContent.facilities,type))return CivilAdvanced.gate(s,type,id);
    const b=m.buildings,t=s.civilization.tech;
    if(type==='meetinghall')return !!(typeof CivilCulture!=='undefined'&&CivilCulture.data(s,id));
    if(type==='residential')return !!(b.farmland&&b.clinic&&b.school);
    if(type==='blockhousing')return !!(m.town&&b.farmland&&b.clinic&&b.school);
    if(['mine','coalpit'].includes(type))return !!(m.town&&t.mining&&t.survey);
    if(type==='furnace')return !!(b.mine&&b.coalpit&&t.furnace);
    if(type==='machineworks')return !!(b.furnace&&t.mechanics);
    if(type==='powerhouse')return !!(b.machineworks&&t.power);
    if(type==='scrubber')return !!(b.powerhouse&&t.water);
    return true;
  },
  projectAvailable(s,id){
    return this.canAccept(s,id)&&![this.data(s,id)?.project,s.civilization.regions?.projects[id]].some(p=>['supplying','building'].includes(p?.status))&&!(typeof CivilRegions.upgradeActive==='function'&&CivilRegions.upgradeActive(s,id))&&!(typeof CivilServices!=='undefined'&&CivilServices.active(s,id));
  },
  startProject(s,id,type){
    const m=this.data(s,id),d=CivilMunicipalContent.facilities[type];
    if(!this.facilityGate(s,id,type)||!this.projectAvailable(s,id))return false;
    m.project={id:m.nextProject++,type,status:'supplying',required:{...d.cost},buffer:{},remaining:0,receipts:[]};
    this.planWorkers(s,id);return true;
  },
  nextCargo(s,id,capacity){
    const m=this.data(s,id),p=m?.project;if(!p||p.status!=='supplying'||!Number.isFinite(capacity)||capacity<=0)return null;
    const inflight={};for(const shipment of s.civilization.regions.shipments)if(shipment.purpose==='municipal'&&shipment.route===id&&shipment.projectId===p.id&&shipment.phase==='outbound')for(const [key,n]of Object.entries(shipment.cargo))inflight[key]=(inflight[key]||0)+n;
    let room=capacity;const cargo={};
    for(const [key,required]of Object.entries(p.required)){
      const count=Math.min(room,Math.max(0,required-(p.buffer[key]||0)-(inflight[key]||0)),s.stores[key]||0);
      if(count>0){cargo[key]=count;room-=count;}
    }
    return Object.keys(cargo).length?{projectId:p.id,cargo}:null;
  },
  receiveCargo(s,id,cargo,projectId){
    const m=this.data(s,id),p=m?.project;if(!p||p.id!==projectId||p.status!=='supplying')return false;
    const shipment=s.civilization.regions.shipments.find(x=>x.route===id&&x.projectId===projectId&&x.purpose==='municipal'&&x.cargo===cargo&&x.phase==='outbound'&&x.source==='home'&&x.target===id&&x.status==='moving'&&x.remaining===0);
    if(!shipment||p.receipts.includes(shipment.id)||!Object.keys(cargo).length||Object.entries(cargo).some(([key,n])=>!Number.isFinite(n)||n<=0||!Object.hasOwn(p.required,key)||(p.buffer[key]||0)+n>p.required[key]+1e-8))return false;
    for(const [key,n]of Object.entries(cargo))p.buffer[key]=(p.buffer[key]||0)+n;p.receipts.push(shipment.id);
    if(Object.entries(p.required).every(([key,n])=>(p.buffer[key]||0)+1e-8>=n)){this.pay(p.buffer,p.required);p.status='building';p.remaining=CivilMunicipalContent.facilities[p.type].duration;this.planWorkers(s,id);}
    return true;
  },
  validShipment(s,shipment){
    const m=this.data(s,shipment?.route);if(!m||shipment.purpose!=='municipal'||!Number.isInteger(shipment.projectId)||shipment.projectId<1)return false;
    const p=m.project?.id===shipment.projectId?m.project:null,completed=m.completed.find(x=>x.id===shipment.projectId),type=p?.type||completed?.type;if(!type)return false;
    if(shipment.phase==='empty')return shipment.source===shipment.route&&shipment.target==='home'&&Object.values(shipment.cargo).every(n=>n===0);
    if(!p||p.status!=='supplying'||!['outbound','returning'].includes(shipment.phase))return false;
    const cost=CivilMunicipalContent.facilities[type].cost;
    return Object.entries(shipment.cargo).every(([key,n])=>Object.hasOwn(cost,key)&&Number.isFinite(n)&&n>=0&&n+(p.buffer[key]||0)<=cost[key]+1e-8);
  },
  tick(s){
    this.init(s);for(const [id,m]of Object.entries(s.civilization.municipal.nodes)){
      const n=this.node(s,id),p=m.project;this.planWorkers(s,id);
      if(p?.status==='building' && this.canAccept(s,id) && n.health>=30 && n.workers.builder>=2){
        p.remaining=Math.max(0,p.remaining-1);
        if(!p.remaining){p.status='complete';m.buildings[p.type]=(m.buildings[p.type]||0)+1;m.completed.push({id:p.id,type:p.type,completedAt:s.civilization.elapsed});this.planWorkers(s,id);this.note(CivilRegionContent[id].name+'的'+CivilMunicipalContent.facilities[p.type].name+'已经建成。当地居民开始接管新的设施。');}
      }
    }
    return {storesChanged:false,populationChanged:false};
  },
  nextEvent(s){
    for(const [id,m]of Object.entries(s.civilization.municipal?.nodes||{})){
      if(!m.town&&m.townStable>=180&&this.developmentReady(s,id))return 'municipalTown_'+id;
      if(!m.city&&m.cityStable>=300&&this.developmentReady(s,id,true))return 'municipalCity_'+id;
    }
    return null; // Consent is a deliberate native button, not an unsolicited automatic annexation.
  },
  event(eventId,done){
    const match=/^municipal(Consent|Town|City)_(river|rail|highland)$/.exec(eventId);if(!match)return null;
    const [,kind,id]=match,s=State,n=this.node(s,id),m=this.data(s,id);if(!n)return null;
    const title=CivilRegionContent[id].name;
    if(kind==='Consent'){
      if(!this.eligible(s,id)||m)return null;
      return {title:title+'的城市工程议约',text:['地方代表带来了新的营建计划。田地、诊疗与课堂需要扩建，居民也想为更多家庭留出住处。','整理图纸与公共约定需要20知识。先登记约定，再从炉火城运来建材，由当地居民施工。','大家决定先修农田、诊疗站和学舍，再筹办新的住宅与工坊。'],buttons:{agree:{text:'登记市政议约（20知识）',nextScene:'end',onChoose:()=>{const ok=this.activate(s,id);return done(ok?title+'同意了营建计划，代表开始核对第一批建材。':'议约尚未完成，代表留下图纸等待商议。')();}},later:{text:'暂缓议约',nextScene:'end',onChoose:done('代表收好图纸，约定日后再议。')}}};
    }
    if(!m)return null;const city=kind==='City',field=city?'city':'town',threshold=city?300:180;
    return {title:title+(city?'的城市职责':'的镇制'),text:[city?'四百位居民住进了这片家园。田地供应口粮，诊疗与课堂照看家庭，矿井和工坊在自己的电站下运转。':'八十位居民的日常渐渐安定。口粮送进仓库，诊疗站有人值守，课堂里响起了孩子们的声音。','代表们翻开公共记录，准备把新的职责留给这一代与下一代居民。'],buttons:{record:{text:city?'登记地方城市':'登记地方镇制',nextScene:'end',onChoose:()=>{const ready=!m[field]&&m[city?'cityStable':'townStable']>=threshold&&this.developmentReady(s,id,city);return done(ready?title+'的'+(city?'城市职责':'镇制')+'已经登记。':'供养条件已有变化，恢复稳定后再登记。',()=>{if(ready)m[field]=true;})();}}}};
  },
  note(message){if(typeof Civilization!=='undefined'&&Civilization.notify)Civilization.notify(message);},
  reset(){this.module=null;this.selected=null;},
  refresh(){
    const s=State,c=s.civilization;if(!c.urban?.city||!c.tech.urbanworks)return;
    const ids=Object.keys(c.regions?.nodes||{}).filter(id=>this.has(s,id)||this.eligible(s,id));if(!ids.length)return;
    if(!this.module){
      const module=this.module={onArrival(diff){document.title='市政';Engine.moveStoresView(null,diff);}};
      module.tab=Header.addLocation('市政','municipal',module);module.panel=$('<div>').attr('id','municipalPanel').addClass('location').appendTo('#locationSlider');
      $('<div>').attr('id','municipalSelect').appendTo(module.panel);
      $('<div>').attr('id','municipalStatus').css({width:'420px',lineHeight:'1.8',margin:'20px 0'}).appendTo(module.panel);
      const columns=$('<div>').css({position:'relative',minHeight:'160px'}).appendTo(module.panel);
      $('<div>').attr('id','municipalBuild').appendTo(columns);$('<div>').attr('id','municipalStructures').css({position:'absolute',left:'160px',top:0,width:'175px'}).appendTo(columns);
      $('<div>').attr('id','municipalProject').css({width:'420px',lineHeight:'1.8',marginTop:'20px'}).appendTo(module.panel);Engine.updateSlider();
    }
    if(!ids.includes(this.selected))this.selected=ids[0];
    for(const id of ids){const button=Civilization.button('municipalSelect_'+id,CivilRegionContent[id].name,'#municipalSelect',()=>{this.selected=id;this.refresh();});Button.setDisabled(button,this.selected===id);}
    const id=this.selected,n=this.node(s,id),m=this.data(s,id),fmt=obj=>Object.entries(obj).filter(([,v])=>v>0).map(([key,v])=>_(key)+' '+Number(v.toFixed(2))).join('、');
    const consent=Civilization.button('municipalConsent','商议城市工程','#municipalBuild',()=>{if(!Events.activeEvent()&&!c.pending){c.pending='municipalConsent_'+this.selected;Civilization.showPending();}},{knowledge:20});consent.toggle(!m);Button.setDisabled(consent,!!m||!CivilRules.canPay(s,{knowledge:20}));
    if(typeof CivilInterface!=='undefined')CivilInterface.renderMunicipal(s,id);else $('#municipalStatus').text(CivilRegionContent[id].name+' · '+n.population+' / '+this.capacity(s,id)+'居民 · 健康'+Math.floor(n.health)+'。'+(m?(m.city?'地方城市。':m.town?'正式镇制。':'地方共同体。')+'烟尘'+Math.floor(m.pollution)+'，生产用电'+(m.economy?.productivePower||0)+' / '+Number(m.power.generation.toFixed(2))+'。'+(m.economy?'每10秒供养余量：粮'+Number(m.economy.food.toFixed(2))+'、药'+Number(m.economy.medicine.toFixed(2))+'。':''):'代表正在等待营建计划。'));
    for(const [type,d]of Object.entries(CivilMunicipalContent.facilities)){
      const bid='municipalBuild_'+type;let button=$('#'+bid);const show=!!m&&this.facilityGate(s,id,type);
      if(show){
        button=Civilization.button(bid,'建'+d.name,'#municipalBuild',()=>{const ok=typeof CivilPlanning!=='undefined'?CivilPlanning.request(s,this.selected,'municipal',type):this.startProject(s,this.selected,type);if(ok){Engine.saveGame();if(Civilization.refresh)Civilization.refresh();else this.refresh();}});
        const queue=typeof CivilPlanning!=='undefined'&&CivilPlanning.queueMode(s,id);if(typeof CivilPlanning!=='undefined')CivilPlanning.caption(button,(queue?'排入：':'建')+d.name);
        button.attr('title',fmt(d.cost)+'；建材运到后，由当地2名施工者施工'+d.duration+'秒'+(queue?'。加入有限后续计划，按顺序启动，不预扣材料。':''));Button.setDisabled(button,queue?!CivilPlanning.canQueue(s,id,'municipal',type):!this.projectAvailable(s,id));
      }
      button.toggle(show);
      let row=$('#municipalCount_'+type);if(!row.length){row=$('<div>').attr('id','municipalCount_'+type).addClass('storeRow').appendTo('#municipalStructures');$('<div>').addClass('row_key').text(d.name).appendTo(row);$('<div>').addClass('row_val').appendTo(row);$('<div>').addClass('clear').appendTo(row);}
      const count=m?.buildings[type]||0;row.toggle(count>0).find('.row_val').text(count);
    }
    if(m&&typeof CivilInterface==='undefined')$('#municipalStatus').append($('<div>').text('地方储备：食物 '+Math.floor(n.stores.food||0)+'、药品 '+Number((n.stores.medicine||0).toFixed(1))+'、工具 '+Number((n.stores.tools||0).toFixed(1))+'。'));
    if(typeof CivilInterface==='undefined'&&m&&typeof CivilAdvancedContent!=='undefined'&&Object.keys(CivilAdvancedContent.facilities).some(k=>m.buildings[k]))$('#municipalStatus').append($('<div>').text('工业储备：'+['coal','iron','parts','minerals','chemicals','steel','glass'].map(k=>_(k)+' '+Number((n.stores[k]||0).toFixed(2))).join('、')+'。'));
    const p=m?.project;
    $('#municipalProject').text(p?'当前工程：'+CivilMunicipalContent.facilities[p.type].name+'；'+({supplying:'材料分批在途，已到：'+(fmt(p.buffer)||'尚无')+'。所需：'+fmt(p.required),building:'当地施工 '+Math.ceil(p.remaining)+' 秒；施工者 '+(n.workers.builder||0)+' / 2',complete:'已经完工，可筹办下一项'}[p.status])+'。'+(m&&!m.town?'镇制稳定 '+m.townStable+' / 180秒。':m&&!m.city?'城市稳定 '+m.cityStable+' / 300秒。':''):'先建公共服务，再扩住房。工程和贸易交替使用原有货车。');
    if(typeof CivilRegions.upgradeActive==='function'&&CivilRegions.upgradeActive(s,id))$('#municipalProject').append($('<div>').text('当地正在筹备或施工货车改装，完成后再开下一项市政工程。'));
    else if(typeof CivilServices!=='undefined'&&CivilServices.active(s,id))$('#municipalProject').append($('<div>').text('当地正在进行下方公用工程，完成后再开下一项市政工程。'));
    if(typeof CivilCulture!=='undefined')CivilCulture.refresh(s,id);
    if(typeof CivilCooperative!=='undefined')CivilCooperative.refresh(s,id);
    if(typeof CivilRuins!=='undefined')CivilRuins.refresh(s,id);
  },
  powerLimits(s,id){
    const m=this.data(s,id),caps=this.jobCapacity(s,id),generation=Math.max(0,(caps.electrician||0)-(m.baseWorkers.electrician||0))*4+(typeof CivilAdvanced!=='undefined'?CivilAdvanced.generationCapacity(s,id):0);
    const demand=Math.max(0,(caps.machinist||0)-(m.baseWorkers.machinist||0))*2+(m.buildings.scrubber?1:0)+(typeof CivilAdvanced!=='undefined'?CivilAdvanced.demandCapacity(s,id):0)+(typeof CivilServices!=='undefined'?CivilServices.demandCapacity(s,id):0);
    return {generation,demand,used:Math.min(generation,demand)};
  },
  validate(s){
    const all=s.civilization.municipal;if(all===undefined)return;
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),num=(x,max=1e12)=>Number.isFinite(x)&&x>=0&&x<=max,int=(x,max=1e8)=>Number.isInteger(x)&&num(x,max),fac=CivilMunicipalContent.facilities;
    const cargo=x=>obj(x)&&Object.entries(x).every(([k,v])=>CivilCatalog.resources.includes(k)&&num(v));
    if(!obj(all)||all.schema!==1||!obj(all.nodes))throw Error('市政总账无效');
    for(const [id,m]of Object.entries(all.nodes)){
      const n=this.node(s,id),cfg=CivilRegionContent[id];
      const powerLimits=cfg&&n&&obj(m)&&obj(m.buildings)&&obj(m.baseWorkers)?this.powerLimits(s,id):{generation:0,demand:0,used:0};
      if(!cfg||!n||!obj(m)||!num(m.agreedAt,s.civilization.elapsed)||m.baseHousing!==cfg.population+12||!obj(m.baseWorkers)||!obj(m.buildings)||!int(m.nextProject)||m.nextProject<1||!Array.isArray(m.completed)||typeof m.town!=='boolean'||typeof m.city!=='boolean'||m.city&&!m.town||!num(m.townStable,180)||!num(m.cityStable,300)||!num(m.pollution,100)||!obj(m.power)||['generation','used','demand'].some(k=>!num(m.power[k],powerLimits[k]+1e-8))||m.power.used>m.power.generation+1e-8||m.power.used>m.power.demand+1e-8)throw Error('地方市政状态无效');
      const legacy=this.legacyJobLimits(id);
      if(Object.entries(m.baseWorkers).some(([job,count])=>!Object.hasOwn(legacy,job)||!int(count,legacy[job]))||Object.entries(m.buildings).some(([type,count])=>!fac[type]||!int(count,fac[type].max)))throw Error('市政设施容量无效');
      const completed=new Set(),totals={};
      for(const p of m.completed){if(!obj(p)||!int(p.id)||p.id<1||p.id>=m.nextProject||completed.has(p.id)||!fac[p.type]||!num(p.completedAt,s.civilization.elapsed))throw Error('市政完工记录无效');completed.add(p.id);totals[p.type]=(totals[p.type]||0)+1;}
      for(const type of Object.keys(fac))if((totals[type]||0)!==(m.buildings[type]||0))throw Error('市政完工与设施不符');
      const p=m.project;
      if(p!==null){
        const d=fac[p?.type];if(!obj(p)||!d||!int(p.id)||p.id!==m.nextProject-1||!['supplying','building','complete'].includes(p.status)||!cargo(p.required)||JSON.stringify(p.required)!==JSON.stringify(d.cost)||!cargo(p.buffer)||!num(p.remaining,d.duration)||!Array.isArray(p.receipts)||new Set(p.receipts).size!==p.receipts.length||p.receipts.some(x=>!int(x)||x<1||x>=s.civilization.regions.nextShipment))throw Error('市政工程无效');
        if(Object.entries(p.buffer).some(([key,n])=>n>(p.required[key]||0)+1e-8)||p.status!=='supplying'&&Object.values(p.buffer).some(Boolean)||p.status==='supplying'&&p.remaining!==0||p.status==='building'&&!p.remaining||p.status==='complete'&&(p.remaining!==0||!completed.has(p.id))||p.status!=='complete'&&completed.has(p.id))throw Error('市政材料或工期无效');
      }
      const expected=m.completed.length+(p&&p.status!=='complete'?1:0);if(m.nextProject!==expected+1||!p&&expected)throw Error('市政工程序号无效');
      const caps=this.jobCapacity(s,id);if(Object.entries(n.workers).some(([job,count])=>!CivilMunicipalContent.jobs.includes(job)||!int(count,caps[job]||0))||Object.values(n.workers).reduce((sum,x)=>sum+x,0)>CivilPopulation.workforce(n.cohorts)||n.population>this.capacity(s,id))throw Error('地方岗位或住房超额');
      const e=m.economy;if(e!==null&&(!obj(e)||!num(e.at,s.civilization.elapsed)||!Number.isFinite(e.food)||!Number.isFinite(e.medicine)||typeof e.treatment!=='boolean'||typeof e.education!=='boolean'||typeof e.industry!=='boolean'||!num(e.productivePower,Math.max(0,(this.jobCapacity(s,id).machinist||0)-(m.baseWorkers.machinist||0))*2)||e.productivePower>m.power.used+1e-8||!obj(e.deltas)||Object.entries(e.deltas).some(([key,x])=>!CivilCatalog.resources.includes(key)||!Number.isFinite(x))))throw Error('地方经济证据无效');
      if(e)for(const field of ['paidInputs','treatmentInputs','mealInputs']){const paid=e[field];if(paid!==undefined&&(!obj(paid)||paid.at!==e.at||!cargo(paid.resources)||Object.keys(paid.resources).some(key=>field==='treatmentInputs'&&key!=='medicine'||field==='mealInputs'&&key!=='food')))throw Error('地方实际投入记录无效');}
      for(const shipment of s.civilization.regions.shipments)if(shipment.route===id&&shipment.purpose==='municipal'&&!this.validShipment(s,shipment))throw Error('市政工程在途记录无效');
    }
  }
};
