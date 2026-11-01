/* MPL-2.0 — Source-preserving migration, reserved beds and sustained local urban economy. */
var CivilUrban = {
  pendingIds:['urban_register','urban_charter','urban_city'],
  init(s){
    if(s.civilization.urban!==undefined)return;
    s.civilization.urban={schema:1,registered:false,enabled:false,source:[],parties:[],nextParty:1,admitted:0,deceased:0,year:Math.floor(s.civilization.elapsed/600),dispatchClock:0,status:'等待地区名册',chartered:false,city:false,townStable:0,cityStable:0,economy:null};
  },
  buildings:{
    publicclinic:{cost:()=>({wood:200,iron:20,parts:8}),max:8,gate:()=>State.civilization.tech.standards && State.civilization.tech.sanitation && State.game.buildings.clinic},
    publicschool:{cost:()=>({wood:180,iron:12,parts:6}),max:4,gate:()=>State.civilization.tech.standards && State.civilization.tech.school},
    irrigatedfield:{cost:()=>({wood:160,iron:6,tools:18}),max:6,gate:()=>State.civilization.tech.standards && State.civilization.tech.irrigation && State.civilization.pump && State.civilization.outpostSupplied===true},
    toolworks:{cost:()=>({wood:160,iron:20,parts:6}),max:2,gate:()=>State.civilization.tech.standards && State.game.buildings.toolshop},
    residential:{cost:()=>({wood:400,iron:40,parts:10}),max:8,gate:()=>State.civilization.tech.standards && State.civilization.industry?.announcedPower && CivilUrban.publicServices(State)},
    blockhousing:{cost:()=>({wood:650,iron:70,parts:20,tools:20}),max:4,gate:()=>State.civilization.tech.urbanworks && CivilUrban.publicServices(State) && CivilUrban.housingReady(State)}
  },
  count(cohorts){return cohorts.reduce((n,c)=>n+c.count,0);},
  children(cohorts){return cohorts.filter(c=>c.age<18).reduce((n,c)=>n+c.count,0);},
  sourceIds(s){return ['dispersed',...Object.entries(s.civilization.origins?.nodes||{}).filter(([,n])=>['contacted','agreed'].includes(n.status)).map(([id])=>id)];},
  sourceId(s){return s.civilization.urban.activeSource || 'dispersed';},
  sourceName(id){return id==='dispersed'?'沿路名册':typeof CivilOriginContent!=='undefined' && CivilOriginContent[id]?.name || '未登记来源';},
  targetId(s){return s.civilization.urban.activeTarget || 'home';},
  hasTarget(s,id){return id==='home' || typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id);},
  canAcceptTarget(s,id){return id==='home' || typeof CivilMunicipal!=='undefined' && CivilMunicipal.canAccept(s,id);},
  targetIds(s){return ['home',...Object.keys(s.civilization.regions?.nodes||{}).filter(id=>this.canAcceptTarget(s,id))];},
  targetName(s,id){return id==='home'?(s.civilization.urban.city?'炉火城':'本地聚落'):typeof CivilRegionContent!=='undefined' && CivilRegionContent[id]?.name || id;},
  setTarget(s,id){
    if(!this.targetIds(s).includes(id))return false;
    s.civilization.urban.activeTarget=id;s.civilization.urban.dispatchClock=0;
    s.civilization.urban.status=this.targetName(s,id)+'等待检查住房与供养';return true;
  },
  targetPopulation(s,id){return id==='home'?s.game.population:s.civilization.regions?.nodes[id]?.population||0;},
  targetCapacity(s,id){return id==='home'?CivilCatalog.capacity(s):this.hasTarget(s,id)?CivilMunicipal.capacity(s,id):0;},
  roadOpen(s,id){
    if(id==='home')return true;
    const route=s.civilization.regions?.routes[id];
    return !!route && route.condition==='open' && (id!=='river' || !!s.game.buildings.road && s.civilization.outpostSupplied===true);
  },
  quote(s,id,max,mode,capacity=mode==='singleton'?1:8){
    if(id==='dispersed'){
      const u=s.civilization.urban;if(!u.registered)return null;
      const cohorts=this.take(u.source.map(c=>({...c})),Math.min(max,this.count(u.source)));return cohorts.length?{originId:id,cohorts,count:this.count(cohorts)}:null;
    }
    return typeof CivilOrigins!=='undefined'?CivilOrigins.quoteParty(s,id,max,{mode,capacity}):null;
  },
  commitSource(s,quote,id,target='home',transport){
    if(quote.originId==='dispersed'){this.take(s.civilization.urban.source,quote.count);return true;}
    return typeof CivilOrigins!=='undefined' && CivilOrigins.commitDeparture(s,quote,id,target,transport);
  },
  receive(s,party){
    const target=party.target,n=this.count(party.cohorts);
    if(!this.canAcceptTarget(s,target) || this.targetPopulation(s,target)+n>this.targetCapacity(s,target))return false;
    if(typeof CivilHeating!=='undefined'&&CivilHeating.handed(s,target)&&!CivilHeating.covered(s,target,this.reservedBeds(s,target)+(s.civilization.urban.parties.includes(party)?0:n))&&!(target==='home'&&n===1&&party.transport===null&&!party.state&&CivilHeating.recoveryReady(s)))return false;
    if(party.source!=='dispersed' && (typeof CivilOrigins==='undefined' || !CivilOrigins.recordArrival(s,party)))return false;
    return this.admit(s,party.cohorts,party.source,target)===n;
  },
  reservedBeds(s,target='home'){return (target==='home'&&typeof CivilFrontier!=='undefined'?CivilFrontier.wounded(s):0)+(s.civilization.urban?.parties||[]).filter(p=>p.target===target && ['outbound','held'].includes(p.state)).reduce((n,p)=>n+this.count(p.cohorts),0);},
  availableBeds(s,target='home'){return Math.max(0,this.targetCapacity(s,target)-this.targetPopulation(s,target)-this.reservedBeds(s,target));},
  reservedTransport(s){return (s.civilization.urban?.parties||[]).reduce((n,p)=>n+(p.transport?.crew||2),0);},
  staffedParties(s){
    if(typeof CivilPassenger!=='undefined')return CivilPassenger.staffedParties(s);
    let left=Math.min(s.game.workers.transporter||0,CivilCatalog.jobCapacity(s,'transporter'));const result=new Set();
    for(const p of [...(s.civilization.urban?.parties||[])].sort((a,b)=>a.id-b.id)){const crew=p.transport?.crew||2;if(left>=crew)result.add(p.id);left=Math.max(0,left-crew);}return result;
  },
  publicServices(s){return !!s.game.buildings.publicclinic && !!s.game.buildings.publicschool && (s.game.workers.medic||0)>0 && (s.game.workers.teacher||0)>0;},
  discovered(s){return typeof CivilRegions!=='undefined'?CivilRegions.discoveredCount(s):Object.values(s.civilization.regions?.nodes||{}).filter(n=>n.discovered).length;},
  register(s){
    const u=s.civilization.urban;if(u.registered || this.discovered(s)<2)return false;
    // Sixty recorded family groups: five adults, two children, one older resident.
    for(let i=0;i<60;i++)u.source.push({age:24+i%16,count:4,identity:'human'},{age:25+i%14,count:1,identity:'mutant'},{age:5+i%8,count:2,identity:i%3?'human':'mutant'},{age:60+i%8,count:1,identity:i%4?'human':'mutant'});
    u.registered=true;u.status='名册已登记，等待接纳安排';return true;
  },
  take(source,number){
    const result=[];for(const cohort of source){if(!number)break;const n=Math.min(number,cohort.count);result.push({...cohort,count:n});cohort.count-=n;number-=n;}
    for(let i=source.length-1;i>=0;i--)if(!source[i].count)source.splice(i,1);return result;
  },
  admit(s,cohorts,source='dispersed',target='home'){
    // Update the ledger and the native total together, before any Society.sync can run.
    let n;
    if(target==='home'){n=this.count(cohorts);s.civilization.society.cohorts.push(...cohorts.map(c=>({...c})));s.game.population+=n;CivilSociety.sync(s);}
    else n=CivilMunicipal.admit(s,target,cohorts);
    if(source==='dispersed')s.civilization.urban.admitted+=n;return n;
  },
  handleArrival(s){
    const u=s.civilization.urban;if(!u)return false;
    const source=this.sourceId(s);if(!u.registered && source==='dispersed')return false;
    if(!this.availableBeds(s) || s.civilization.hunger || (s.game.population>0 && s.civilization.trust<15))return true;
    const quote=this.quote(s,source,1,'singleton');if(!quote)return true;
    if(typeof CivilHeating!=='undefined'&&CivilHeating.handed(s)?!!CivilHeating.growthReason(s,'home',[...this.waiting(s),...quote.cohorts])&&!CivilHeating.recoveryReady(s):s.game.temperature.value<2)return true;
    if(!CivilRules.pay(s,{food:6}))return true;
    const id=u.nextParty;
    if(!this.commitSource(s,quote,id,'home',typeof CivilPassenger!=='undefined'?null:undefined)){s.stores.food+=6;return true;}
    if(source!=='dispersed')u.nextParty++;
    const party={id,source,target:'home',cohorts:quote.cohorts};if(typeof CivilPassenger!=='undefined')party.transport=null;
    if(!this.receive(s,party)){CivilOrigins.returnPeople(s,party);s.stores.food+=6;return true;}
    this.note('一位来自'+this.sourceName(source)+'的居民沿路来到聚落，带来了自己的经历。');return true;
  },
  commitments(s){return typeof CivilRegions==='undefined'?{}:CivilRegions.committedFlow?CivilRegions.committedFlow(s,'home'):CivilRegions.committedHomeFlow?CivilRegions.committedHomeFlow(s):{};},
  // A producing job's inputs stay separate from its outputs and from other jobs.
  // Transport, administration and the requested (possibly unpaid) meal are not maintenance.
  inputEvidence(s,flow){
    const names=new Set([...Object.values(CivilCatalog.jobs),'外站维护','烟尘处理','工区净化']),resources={};
    for(const [name,values]of Object.entries(flow))if(names.has(name))for(const [key,n]of Object.entries(values))if(CivilCatalog.resources.includes(key)&&n<0)resources[key]=(resources[key]||0)-n;
    return {paidInputs:{at:s.civilization.elapsed,resources},treatmentInputs:{at:s.civilization.elapsed,resources:{medicine:Math.max(0,-(flow['诊所治疗']?.medicine||0))}}};
  },
  forecast(s,cohorts=[]){
    const copy=(typeof CivilForecast==='undefined'?JSON.parse(JSON.stringify(s)):CivilForecast.copy(s)),before={...copy.stores};
    copy.civilization.elapsed=typeof CivilServices!=='undefined'?CivilServices.nextSettlementAt(copy,'home'):copy.civilization.elapsed+10-(copy.civilization.productionClock||0);
    copy.game.population+=this.count(cohorts);copy.civilization.society.cohorts.push(...cohorts.map(c=>({...c})));
    const flow=CivilRules.settle(copy).flow;
    const treatment=CivilVillage.treatment(copy);CivilVillage.settle(copy);if(treatment)flow['诊所治疗']={medicine:-treatment};
    Object.assign(flow,CivilSociety.settle(copy),CivilIndustry.settle(copy));
    if(typeof CivilRegions!=='undefined')Object.assign(flow,CivilRegions.settle(copy));
    if(typeof CivilOrigins!=='undefined')Object.assign(flow,CivilOrigins.settle(copy));
    if(typeof CivilFinance!=='undefined'){const paid=CivilFinance.settle(copy);if(Object.keys(paid).length)flow['共同记录']=paid;}
    const deltas={};for(const k of CivilCatalog.resources)deltas[k]=(copy.stores[k]||0)-(before[k]||0);
    return {copy,flow,deltas,...this.inputEvidence(copy,flow)};
  },
  foodReserve(s,cohorts=[]){
    const added=cohorts.reduce((n,c)=>n+c.count*(c.age<18?2/3:1),0),policy=CivilRules.policies[s.civilization.policy]||CivilRules.policies.equal;
    return (CivilSociety.foodPopulation(s)+added)*.12*policy.food*(s.game.buildings.cistern?.9:1)*12;
  },
  waiting(s,target='home'){return s.civilization.urban.parties.filter(p=>p.target===target && ['outbound','held'].includes(p.state)).flatMap(p=>p.cohorts);},
  serviceCheck(s,cohorts){
    if(!this.publicServices(s))return '公共诊疗站和学舍需要实际岗位';
    if(s.civilization.hunger || s.civilization.village.health<60)return '先恢复居民口粮和健康';
    const totalChildren=this.children(s.civilization.society.cohorts)+this.children(cohorts);
    if(totalChildren>Math.min(s.game.workers.teacher||0,CivilCatalog.jobCapacity(s,'teacher'))*20)return '教师尚不能覆盖新增儿童';
    const result=this.forecast(s,cohorts),commit=this.commitments(s);
    if(typeof CivilHeating!=='undefined'){const heat=CivilHeating.growthReason(s,'home',cohorts,result.copy);if(heat)return heat;}
    const teaching=(result.flow['教师']?.knowledge||0)/(.2*CivilIndustry.factor(s));
    if(totalChildren>teaching*20+1e-8)return '教学缺少纸材或实际值守';
    if((result.deltas.medicine||0)+(commit.medicine||0)<-1e-8 || !result.copy.civilization.society.service)return '药品净供给或公共行政不足';
    if((result.flow['医护']?.medicine||0)+(result.flow['药剂师']?.medicine||0)+1e-8<(s.game.population+this.count(cohorts))*.01)return '医护原料不足以完成新增治疗';
    return null;
  },
  housingReady(s){
    const extra=[...this.waiting(s),{age:25,count:8,identity:'human'}];
    return (s.stores.food||0)>=this.foodReserve(s,extra) && !this.serviceCheck(s,extra);
  },
  dispatch(s){
    const u=s.civilization.urban;
    if(!u || !u.enabled)return false;
    const stop=reason=>{u.status=reason;return false;};
    if(typeof CivilPassenger!=='undefined'){
      if(u.dispatchClock>0||s.civilization.elapsed<s.civilization.passenger.legacyReadyAt||s.civilization.passenger.lastDepartureAt!==null&&s.civilization.elapsed-s.civilization.passenger.lastDepartureAt<120)return stop('等待下一批次启程');
      const plan=CivilPassenger.quote(s);if(plan.reason)return stop(plan.reason);
      const source=this.sourceId(s),target=this.targetId(s),cost=Object.fromEntries(Object.entries(plan.cost).filter(([,n])=>n>0));
      if(!CivilPassenger.canDepart(s,plan.transport,u.nextParty,source))return stop('运输班组或装备已经变化');
      const before=Object.fromEntries(Object.keys(cost).map(k=>[k,{had:Object.hasOwn(s.stores,k),value:s.stores[k]}]));
      if(!CivilRules.pay(s,cost))return stop('出发旅费尚未备足');
      if(!this.commitSource(s,plan.sourceQuote,u.nextParty,target,plan.transport)){for(const [k,v]of Object.entries(before)){if(v.had)s.stores[k]=v.value;else delete s.stores[k];}return stop('来源名册已经变化，下一趟重新核对');}
      u.parties.push({id:u.nextParty++,source,target,state:'outbound',remaining:120,heldFor:0,cohorts:plan.sourceQuote.cohorts,rations:plan.sourceQuote.count*6,transport:JSON.parse(JSON.stringify(plan.transport))});
      s.civilization.passenger.lastDepartureAt=s.civilization.elapsed;u.dispatchClock=120;u.status=(plan.fallback?'本次按小队接纳（'+plan.fallback+'）。':'')+plan.sourceQuote.count+'位居民前往'+this.targetName(s,target)+'，住房已预留';return true;
    }
    if(!s.game.buildings.cartdepot || !s.civilization.tech.logistics)return stop('接纳需要车队场与运输组织');
    if(u.parties.length>=2 || typeof CivilRegions==='undefined' || CivilRegions.availableTransport(s)<2)return stop('等待两名运输工与返程车队');
    const target=this.targetId(s);
    if(!this.canAcceptTarget(s,target))return stop('目的地尚未同意接纳安排');
    if(typeof CivilIncidents!=='undefined'&&CivilIncidents.holds(s,target))return stop(this.targetName(s,target)+'暂停新迁居出发，等道路检修');
    if(!this.roadOpen(s,target))return stop(this.targetName(s,target)+'的接纳道路中断或待维护');
    const source=this.sourceId(s),beds=Math.min(8,this.availableBeds(s,target));if(!beds)return stop(this.targetName(s,target)+'等待空余床位');
    const quote=this.quote(s,source,beds,'convoy');if(!quote)return stop(source==='dispersed'?'登记的居民已全部安置':typeof CivilOrigins.quoteReason==='function'?CivilOrigins.quoteReason(s,source,beds,{mode:'convoy'})||'来源暂不能安排这批迁居':'来源需要迁居议约、留守居民与实际供养');
    const n=quote.count,sample=quote.cohorts,all=[...this.waiting(s,target),...sample],cost={food:n*6,medicine:n*.2,tools:n*.2};
    if(!CivilRules.canPay(s,cost))return stop('待备旅费：每人6粮、0.2药品、0.2工具');
    const homeWaiting=target==='home'?all:this.waiting(s);
    if((s.stores.food||0)-cost.food+1e-8<this.foodReserve(s,homeWaiting))return stop('本地支付旅费后须留下120秒居民口粮');
    if(target!=='home' && (s.civilization.regions.nodes[target].stores.food||0)+1e-8<CivilMunicipal.foodReserve(s,target,all))return stop(this.targetName(s,target)+'须自行留下安置后120秒口粮');
    const reason=target==='home'?this.serviceCheck(s,all):CivilMunicipal.serviceCheck(s,target,all);if(reason)return stop(reason);
    CivilRules.pay(s,cost);
    if(!this.commitSource(s,quote,u.nextParty,target)){for(const [key,value]of Object.entries(cost))s.stores[key]+=value;return stop('来源名册已经变化，下一趟重新核对');}
    u.parties.push({id:u.nextParty++,source,target,state:'outbound',remaining:120,heldFor:0,cohorts:quote.cohorts,rations:n*6});u.dispatchClock=120;u.status=n+'位居民前往'+this.targetName(s,target)+'，住房已预留';return true;
  },
  returnParty(s,id){
    const party=s.civilization.urban.parties.find(p=>p.id===id);
    if(!party || !['outbound','held'].includes(party.state))return false;
    // Before reaching a remote settlement, retreat only over the section already travelled.
    // A party already at its destination must wait for that road to reopen before returning.
    if(party.target!=='home'){party.returnNeedsRoad=party.remaining===0;party.remaining=120-party.remaining;}
    else party.remaining=120;
    party.state='returning_people';party.heldFor=0;delete party.holdReason;return true;
  },
  tick(s){
    const u=s.civilization.urban;if(!u)return {populationChanged:false,storesChanged:false};
    const before=s.game.population,year=Math.floor(s.civilization.elapsed/600);
    while(u.year<year){
      u.year++;
      const aged=CivilPopulation.age(u.source);u.source=aged.cohorts;u.deceased+=aged.deceased;
      for(const party of u.parties){
        const agedParty=CivilPopulation.age(party.cohorts);
        if(agedParty.deceased){if(party.source==='dispersed')u.deceased+=agedParty.deceased;else CivilOrigins.recordTransitDeath(s,party,agedParty.deceased);}
        party.cohorts=agedParty.cohorts;
      }
    }
    const staffed=this.staffedParties(s);
    for(const p of [...u.parties]){
      if(!staffed.has(p.id)){u.status='第'+p.id+'支旅队等待完整运输班组，居民与车组留在原处';if(p.rations<=0&&['outbound','held'].includes(p.state))this.returnParty(s,p.id);continue;}
      const remote=p.target!=='home',name=this.targetName(s,p.target);
      if(['outbound','held'].includes(p.state)){
        if(p.remaining>0 && !this.roadOpen(s,p.target)){
          p.state='held';p.holdReason='road';p.heldFor=Math.min(120,p.heldFor+1);u.status='赴'+name+'的道路中断，旅队原地待行';
          if(p.heldFor>=120 || p.rations<=0)this.returnParty(s,p.id);
          continue;
        }
        if(p.state==='held' && p.holdReason==='road'){p.state='outbound';p.heldFor=0;delete p.holdReason;}
        if(p.state==='outbound')p.remaining=Math.max(0,p.remaining-1);
        if(p.remaining>0)continue;
        const n=this.count(p.cohorts);
        let reason=!this.canAcceptTarget(s,p.target)?'acceptance':this.targetPopulation(s,p.target)+n>this.targetCapacity(s,p.target)?'housing':null;
        if(!reason&&n&&typeof CivilHeating!=='undefined'&&CivilHeating.growthReason(s,p.target,this.waiting(s,p.target)))reason='services';
        if(!reason && remote && n && CivilMunicipal.serviceCheck(s,p.target,this.waiting(s,p.target)))reason='services';
        if(reason){
          if(p.state==='held')p.heldFor=Math.min(120,p.heldFor+1);
          p.state='held';p.holdReason=reason;u.status=name+(reason==='housing'?'接纳点候床':'接纳点等待公共服务与安置许可');
          if(p.heldFor>=120 || p.rations<=0)this.returnParty(s,p.id);
          continue;
        }
        if(!this.receive(s,p)){u.status='接纳名册等待核对';continue;}
        p.cohorts=[];p.state='returning';p.remaining=120;p.heldFor=0;p.rations=0;delete p.holdReason;
        if(remote)p.returnNeedsRoad=true;
        u.status=n+'位居民已在'+name+'安置，车队正在返回';if(n)this.note(n+'位居民按名册住进了'+name+'。儿童、成人和老人各自留下了一行。');
        continue;
      }
      // An empty return, or a passenger return started at the destination, cannot cross a closed road.
      if(remote && p.returnNeedsRoad && !this.roadOpen(s,p.target)){u.status=name+'返程道路中断，车队等待修通';continue;}
      p.remaining=Math.max(0,p.remaining-1);if(p.remaining)continue;
      if(p.state==='returning_people'){
        if(p.source==='dispersed')u.source.push(...p.cohorts);else if(!CivilOrigins.returnPeople(s,p)){u.status='返程名册等待核对';continue;}
        u.status='居民已返回原接纳点，旅费不退回';
      }
      u.parties.splice(u.parties.indexOf(p),1);
    }
    u.dispatchClock=Math.max(0,u.dispatchClock-1);let sent=false;
    if(u.enabled && !u.dispatchClock){sent=this.dispatch(s);if(!sent)u.dispatchClock=10;}
    return {populationChanged:s.game.population!==before,storesChanged:sent};
  },
  tradeReady(s){
    const r=s.civilization.regions;
    if(r?.active && typeof CivilRegions!=='undefined' && CivilRegions.tradeReady)return CivilRegions.tradeReady(s);
    if(r?.active)return Object.values(r.routes||{}).some(route=>route.enabled && route.assigned>=2 && route.completedTrips>0 && route.condition==='open');
    return s.civilization.village.routeStatus==='往返正常' && s.civilization.village.convoys>0;
  },
  developmentReady(s,city=false){
    const u=s.civilization.urban,e=u.economy,c=s.civilization,i=c.industry;
    if(typeof CivilHeating!=='undefined'&&!CivilHeating.covered(s))return false;
    if(!e || c.elapsed-e.at>10 || s.game.population<(city?400:80) || s.game.population> CivilCatalog.capacity(s) || !this.publicServices(s) || c.hunger || c.village.health<(city?70:60))return false;
    if(!e.treatment || !e.education || e.medicine<-1e-8 || e.food<-1e-8 || !c.society.service)return false;
    if(!city)return this.tradeReady(s);
    const project=Object.values(c.regions?.nodes||{}).some(n=>n.completedProjects?.publicWorks);
    return u.chartered && c.tech.urbanworks && project && c.regions?.adminService && i.pollution<40 && e.industrial && e.productionPower>=4 && (s.stores.food||0)+1e-8>=this.foodReserve(s) && s.stores.tools>=40 && s.stores.iron>=40 && s.stores.parts>=20;
  },
  settle(s,evidence){
    const u=s.civilization.urban,flow={};if(!u)return flow;
    for(const party of u.parties)if(party.cohorts.length)party.rations=Math.max(0,party.rations-this.count(party.cohorts)*.12);
    if(!evidence)return flow;
    const f=evidence.flow||{},d=evidence.deltas||{},commit=this.commitments(s),i=s.civilization.industry;
    const medicine=(d.medicine||0)+(commit.medicine||0),food=(d.food||0)+(commit.food||0);
    u.economy={at:s.civilization.elapsed,medicine,food,
      treatment:(f['医护']?.medicine||0)+(f['药剂师']?.medicine||0)+1e-8>=s.game.population*.01 && -(f['诊所治疗']?.medicine||0)+1e-8>=s.game.population*.01,
      education:this.children(s.civilization.society.cohorts)<=((f['教师']?.knowledge||0)/(.2*CivilIndustry.factor(s)))*20+1e-8,
      industrial:(f['采矿工']?.ore||0)>0 && (f['采煤工']?.coal||0)>0 && (f['冶炼工']?.iron||0)>0 && (f['机械工']?.parts||0)>0,
      productionPower:i.productionPower||0,...this.inputEvidence(s,f)};
    u.townStable=this.developmentReady(s)?Math.min(180,u.townStable+10):0;
    u.cityStable=this.developmentReady(s,true)?Math.min(300,u.cityStable+10):0;return flow;
  },
  nextEvent(s){const u=s.civilization.urban;if(!u)return null;if(!u.registered && this.discovered(s)>=2)return 'urban_register';if(!u.chartered && u.townStable>=180 && this.developmentReady(s))return 'urban_charter';if(!u.city && u.cityStable>=300 && this.developmentReady(s,true))return 'urban_city';return null;},
  event(id,done){
    const s=State,u=s.civilization.urban;
    if(id==='urban_register')return {title:'沿路的名册',text:['两个聚居地的引路人带来一份散居家庭名册，共四百八十人。人类与变异居民、孩子和老人，都在等一个有床位与公共服务的落脚处。','登记只建立联络。批次接纳须准备车队、旅粮、药品与工具，并留下安置后的口粮；暂停车队后，仍可按名册接纳零星来访者。'],buttons:{register:{text:'登记家庭与接纳条款',nextScene:'end',onChoose:done('所有登记居民享有相同的口粮、诊疗与儿童教育。车队按住房和实际供给分批接纳。',()=>this.register(s))}}};
    if(id==='urban_charter')return {title:'镇的公共职责',text:['八十位居民、诊疗、课堂与往返道路，已经连续稳定运行。居民愿意把住房、供养和公共记录写入镇制。','镇制不会带来额外人口或物资。后续街坊和工业扩容仍需研究、建设与劳动。'],buttons:{charter:{text:'登记镇制',nextScene:'end',onChoose:()=>{const ready=u.townStable>=180 && this.developmentReady(s);return done(ready?'正式镇制写入公共记录。城镇工程可以继续研究。':'供养条件已有变化，恢复稳定后再议镇制。',()=>{if(ready)u.chartered=true;})();}}}};
    if(id==='urban_city')return {title:'第一座城市',text:['四百位实际居住的居民，持续运转的农田、诊疗、课堂、工业和供电，终于支撑起一座城市。邻居的共同服务项目也已经兑现。','居民仍需要下一轮口粮。城市之外还有独立聚居地，地区联合也还没有成为城市群。'],buttons:{city:{text:'登记城市与公共职责',nextScene:'end',onChoose:()=>{const ready=u.cityStable>=300 && this.developmentReady(s,true);return done(ready?'居民把这座家园登记为炉火城。住房、田地、工区与共同职责继续留给下一代。':'供养条件已有变化，恢复稳定后再议城市职责。',()=>{if(ready)u.city=true;})();}}}};
    return null;
  },
  note(text){if(typeof Civilization!=='undefined')Civilization.notify(text);},
  reset(){this.module=null;},
  refresh(){
    const s=State,u=s.civilization.urban;if(!u)return;
    const sources=this.sourceIds(s),current=this.sourceId(s),targets=this.targetIds(s),target=this.targetId(s);
    if(sources.length>1){
      const select=Civilization.button('urbanSource','接纳来源：'+this.sourceName(current),'#roadPanel',()=>{
        const ids=this.sourceIds(s),at=ids.indexOf(this.sourceId(s));u.activeSource=ids[(at+1)%ids.length];u.dispatchClock=0;u.status='等待核对'+this.sourceName(u.activeSource)+'的名册与供养';Engine.saveGame();this.refresh();
      });
      select.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode('接纳来源：'+this.sourceName(current)));
      select.attr('title','切换后续接纳来源；已经启程的居民继续原旅程。新来源保留留守居民，不会重建沿路480人名册。');
    }
    if(!s.civilization.tech.standards)return;
    if(!this.module){const m=this.module={onArrival(diff){document.title='街区';Engine.moveStoresView(null,diff);}};m.tab=Header.addLocation('街区','urban',m);m.panel=$('<div>').attr('id','urbanPanel').addClass('location').appendTo('#locationSlider');$('<div>').attr('id','urbanRecord').css({width:'410px',lineHeight:'1.8',marginBottom:'20px'}).appendTo(m.panel);const cols=$('<div>').css('position','relative').appendTo(m.panel);$('<div>').attr({'id':'urbanBuildBtns','data-legend':'建设：'}).appendTo(cols);$('<div>').attr('id','urbanStructures').css({position:'absolute',left:'160px',top:0,width:'150px'}).appendTo(cols);$('<div>').attr('id','urbanPlans').appendTo(m.panel);Engine.updateSlider();}
    for(const id of Object.keys(this.buildings)){const button=Room.Craftables[id]?.button;if(button?.length && button.parent().attr('id')!=='urbanBuildBtns')button.appendTo('#urbanBuildBtns');$('#building_row_'+id).hide();let row=$('#urban_count_'+id);const n=s.game.buildings[id]||0;if(n && !row.length){row=$('<div>').addClass('storeRow').attr('id','urban_count_'+id).appendTo('#urbanStructures');$('<div>').addClass('row_key').text(_(id)).appendTo(row);$('<div>').addClass('row_val').appendTo(row);$('<div>').addClass('clear').appendTo(row);}row.toggle(n>0).find('.row_val').text(n);}
    const origin=s.civilization.origins?.nodes[current],sourceText=current==='dispersed'?'沿路名册待安置 '+this.count(u.source)+' 人':this.sourceName(current)+'现存 '+this.count(origin?.cohorts||[])+' 人（含留守居民）';
    const destination=target==='home'?'':' 后续批次赴'+this.targetName(s,target)+'：当地居民 '+this.targetPopulation(s,target)+' / '+this.targetCapacity(s,target)+'，预留 '+this.reservedBeds(s,target)+' 床。';
    const e=u.economy;if(typeof CivilInterface!=='undefined')CivilInterface.renderUrban(s);else $('#urbanRecord').text((u.city?'炉火城':u.chartered?'正式镇制':'街区')+' · 居民 '+s.game.population+' / '+CivilCatalog.capacity(s)+'，途中预留 '+this.reservedBeds(s)+' 床。'+(e?'每10秒供养余量：粮 '+Number(e.food.toFixed(2))+'，药 '+Number(e.medicine.toFixed(2))+'；儿童教学'+(e.education?'已覆盖':'不足')+'。':'')+(!u.chartered?' 镇制需要80位居民，供养、课堂与往返道路稳定180秒：'+u.townStable+'/180。':!u.city && s.civilization.tech.urbanworks?' 城市需要400位居民、健康70、低烟尘、工业实际用电4与已兑现的邻地公共项目，口粮和药品持续有余：'+u.cityStable+'/300秒。':'')+(u.registered || current!=='dispersed'?' '+sourceText+'，车队 '+u.parties.length+' 组。'+(u.enabled?u.status:'批次接纳已暂停；已启程旅队继续前行，零星到访仍按所选名册接纳到本地。'):'')+destination);
    if(sources.length>1)$('#urbanSource').appendTo('#urbanPlans');
    if(targets.length>1){
      const select=Civilization.button('urbanTarget','接纳目的地：'+this.targetName(s,target),'#urbanPlans',()=>{const ids=this.targetIds(s),at=ids.indexOf(this.targetId(s));if(this.setTarget(s,ids[(at+1)%ids.length])){Engine.saveGame();this.refresh();}});
      select.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode('接纳目的地：'+this.targetName(s,target)));
      select.attr('title','只切换后续批次；已启程居民保留原目的地，零星到访仍来本地。旅费由本地支付，住房与安置供养由目的地准备。');
    }
    $('#urbanTarget').toggle(targets.length>1);
    $('.urbanReturn').hide();
    for(const party of u.parties.filter(p=>p.target!=='home' && p.state==='held')){
      const button=Civilization.button('urbanReturn_'+party.id,'带回赴'+this.targetName(s,party.target)+'的旅队','#urbanPlans',()=>{if(this.returnParty(s,party.id)){Engine.saveGame();this.refresh();}});
      button.addClass('urbanReturn').show().attr('title','沿已经走过的路返回原来源，旅费不退；已到目的地的旅队须等返程道路修通。');
    }
    if(u.registered || current!=='dispersed'){const btn=Civilization.button('urbanPlan',u.enabled?'暂停批次接纳':'安排批次接纳','#urbanPlans',()=>{u.enabled=!u.enabled;u.dispatchClock=0;Engine.saveGame();this.refresh();});btn.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(u.enabled?'暂停批次接纳':'安排批次接纳'));btn.attr('title','来源直接到选定聚落的接纳旅程，去返各120秒；'+(s.civilization.tech.passenger_transport?'原小队最多8人，建成迁居装备后可安排24人大队，大队另付装备维护；':'每批最多8人；')+'每人6粮、0.2药、0.2工具；共用本地运输工，所有目的地合计最多2组；两端各留足120秒口粮');}
    if(typeof CivilPassenger!=='undefined')CivilPassenger.refresh();
  },
  validate(s){
    const u=s.civilization.urban;if(u===undefined)return;
    const obj=v=>v!==null && typeof v==='object' && !Array.isArray(v),integer=(v,min=0,max=1e8)=>Number.isInteger(v)&&v>=min&&v<=max,number=(v,min=0,max=1e8)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(!obj(u)||u.schema!==1 || !['registered','enabled','chartered','city'].every(k=>typeof u[k]==='boolean') || (u.city&&!u.chartered) || !integer(u.year) || u.year!==Math.floor(s.civilization.elapsed/600))throw Error('城镇状态无效');
    if(u.activeSource!==undefined && !this.sourceIds(s).includes(u.activeSource))throw Error('接纳来源无效');
    if(u.activeTarget!==undefined && (typeof u.activeTarget!=='string' || !this.hasTarget(s,u.activeTarget)))throw Error('接纳目的地无效');
    const cohorts=arr=>Array.isArray(arr)&&arr.length<=480&&arr.every(c=>obj(c)&&integer(c.age,0,79)&&integer(c.count,1,480)&&['human','mutant'].includes(c.identity));
    if(!cohorts(u.source)||!Array.isArray(u.parties)||u.parties.length>2||!integer(u.admitted,0,480)||!integer(u.deceased,0,480)||!integer(u.nextParty,1)||!number(u.dispatchClock,0,120)||typeof u.status!=='string'||u.status.length>200)throw Error('接纳名册无效');
    const ids=new Set();for(const p of u.parties){
      if(!obj(p))throw Error('在途接纳无效');
      if(typeof CivilPassenger!=='undefined')CivilPassenger.validateTransport(s,p.transport,p.id,p.source);
      const capacity=typeof CivilPassenger!=='undefined'?CivilPassenger.capacityFor(s,p):8,rations=p.transport?p.transport.initial*6:48;
      if(!obj(p)||!integer(p.id,1,u.nextParty-1)||ids.has(p.id)||!this.sourceIds(s).includes(p.source)||typeof p.target!=='string'||!this.hasTarget(s,p.target)||!['outbound','held','returning','returning_people'].includes(p.state)||!cohorts(p.cohorts)||this.count(p.cohorts)>capacity||p.transport&&this.count(p.cohorts)>p.transport.initial||!number(p.remaining,0,120)||!integer(p.heldFor,0,120)||!number(p.rations,0,rations)||(p.state==='returning'&&p.cohorts.length))throw Error('在途接纳无效');
      if(p.holdReason!==undefined && (p.state!=='held' || !['road','housing','services','acceptance'].includes(p.holdReason)))throw Error('接纳停留原因无效');
      if(p.state==='held' && p.remaining!==0 && (p.target==='home' || p.holdReason!=='road'))throw Error('候床与道路位置不符');
      if(p.target!=='home' && p.state==='held' && p.holdReason===undefined)throw Error('地方接纳停留记录无效');
      if(p.returnNeedsRoad!==undefined && (p.target==='home' || typeof p.returnNeedsRoad!=='boolean' || !['returning','returning_people'].includes(p.state)))throw Error('接纳返程位置无效');
      if(p.target!=='home' && (p.state==='returning' && p.returnNeedsRoad!==true || p.state==='returning_people' && (typeof p.returnNeedsRoad!=='boolean' || !p.returnNeedsRoad && p.remaining>=120)))throw Error('地方返程不能越过断路');
      ids.add(p.id);
    }
    if(typeof CivilPassenger!=='undefined')CivilPassenger.validate(s);
    const ledger=this.count(u.source)+u.parties.filter(p=>p.source==='dispersed').reduce((n,p)=>n+this.count(p.cohorts),0)+u.admitted+u.deceased;
    if(ledger!==(u.registered?480:0)||(!u.registered && this.sourceIds(s).length===1 && (u.enabled||u.parties.length||u.nextParty!==1)))throw Error('迁徙人口总账不符');
    if(!number(u.townStable,0,180)||!number(u.cityStable,0,300))throw Error('城镇稳定度无效');
    if(u.economy!==null && (!obj(u.economy)||!number(u.economy.at,0,s.civilization.elapsed)||!number(u.economy.food,-1e8)||!number(u.economy.medicine,-1e8)||!number(u.economy.productionPower,0,CivilCatalog.jobCapacity(s,'machinist')*2)||!['treatment','education','industrial'].every(k=>typeof u.economy[k]==='boolean')))throw Error('城市供养记录无效');
    if(u.economy)for(const field of ['paidInputs','treatmentInputs']){
      const paid=u.economy[field];if(paid!==undefined&&(!obj(paid)||paid.at!==u.economy.at||!obj(paid.resources)||Object.entries(paid.resources).some(([key,n])=>!CivilCatalog.resources.includes(key)||!number(n,0,1e8)||field==='treatmentInputs'&&key!=='medicine')))throw Error('城市实际投入记录无效');
    }
    if(s.civilization.pending==='urban_register' && (u.registered || this.discovered(s)<2))throw Error('登记待办无效');
    if(s.civilization.pending==='urban_charter' && u.chartered || s.civilization.pending==='urban_city' && u.city)throw Error('建制待办重复');
  }
};
