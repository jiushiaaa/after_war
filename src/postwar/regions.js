/* MPL-2.0 — Independent node inventories, conserved shipments and consensual local integration. */
var CivilRegions={
  pendingIds:['railSurvey','highlandSurvey','regionRights','regionRiver','regionRail','regionHighland'],
  buildings:{
    cartdepot:{cost:()=>({wood:180,iron:20,parts:8,tools:10}),max:2,gate:()=>!!State.civilization.tech.logistics},
    archive:{cost:()=>({wood:180,iron:20,parts:10,knowledge:40}),max:3,gate:()=>!!State.civilization.tech.administration}
  },
  journeys:{
    railSurvey:{cost:{food:24,tools:8,knowledge:8},duration:240,allowed:s=>!!s.civilization.tech.survey && !s.civilization.regions?.nodes.rail},
    highlandSurvey:{cost:{food:30,tools:10,knowledge:10},duration:300,allowed:s=>!!s.civilization.tech.survey && !!s.civilization.regions?.nodes.rail && !s.civilization.regions?.nodes.highland}
  },
  init(s){
    if(s.civilization.regions===undefined)s.civilization.regions={schema:1,active:false,nextShipment:1,nodes:{},routes:{},shipments:[],projects:{},rights:null,rightsSince:0,archiveOnline:0,adminService:true,announced:false};
    for(const n of Object.values(s.civilization.regions?.nodes||{}))this.initBirths(n);
  },
  initBirths(n){
    if(n.births===undefined)n.births={scaled:false,credit:0,mutantCredit:0};
    if(n.population>=80 || n.completedProjects.publicWorks)n.births.scaled=true;
  },
  node(id,s){return id==='home'?{stores:s.stores,population:s.game.population}:s.civilization.regions?.nodes[id];},
  discoveredCount(s){const r=s.civilization.regions;return Object.keys(r?.nodes||{}).length+(!r?.nodes.river && s.civilization.village?.riverKnown?1:0);},
  workforce(n){return CivilPopulation.workforce(n.cohorts);},
  foodPopulation(n){return CivilPopulation.foodPopulation(n.cohorts);},
  reservedTransport(s){return Object.values(s.civilization.regions?.routes||{}).reduce((n,r)=>n+r.assigned,0);},
  availableTransport(s){
    const total=Math.min(s.game.workers.transporter||0,CivilCatalog.jobCapacity(s,'transporter'));
    const urban=typeof CivilUrban!=='undefined' && CivilUrban.reservedTransport?CivilUrban.reservedTransport(s):0;
    return Math.max(0,total-this.reservedTransport(s)-urban);
  },
  staffedRoutes(s){
    const result=new Set(),r=s.civilization.regions;
    let left=Math.min(s.game.workers.transporter||0,CivilCatalog.jobCapacity(s,'transporter'));
    if(typeof CivilUrban!=='undefined' && CivilUrban.reservedTransport)left-=CivilUrban.reservedTransport(s);
    for(const [id,route]of Object.entries(r.routes))if(route.assigned>=2 && left>=2){left-=2;result.add(id);}
    return result;
  },
  capacity(s){return (typeof CivilSociety!=='undefined'?CivilSociety.capacity(s):1)+(s.civilization.regions?.archiveOnline||0)*2;},
  load(s){return 1+Object.values(s.civilization.regions?.nodes||{}).filter(n=>['associated','integrated'].includes(n.relation)).length;},
  upgrade(s,id){return s.civilization.regions?.upgrades?.projects[id];},
  upgradeActive(s,id){const p=this.upgrade(s,id);return !!p && p.status!=='complete';},
  upgradeEligible(s,id){
    const c=s.civilization,n=c.regions?.nodes[id];
    return !!(c.regions?.active && c.urban?.city && c.tech.urbanworks && n?.completedProjects.publicWorks &&
      (['associated','integrated'].includes(n.relation) || typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id)));
  },
  canUpgrade(s,id){
    const r=s.civilization.regions,mp=s.civilization.municipal?.nodes[id]?.project;
    return this.upgradeEligible(s,id) && !this.upgrade(s,id) && r.routes[id]?.capacity===64 &&
      (!r.projects[id] || r.projects[id].status==='complete') && (!mp || mp.status==='complete') &&
      (typeof CivilServices==='undefined' || CivilServices.projectAvailable(s,id));
  },
  startUpgrade(s,id){
    if(!this.canUpgrade(s,id))return false;
    const r=s.civilization.regions;if(r.upgrades===undefined)r.upgrades={nextId:1,projects:{}};
    r.upgrades.projects[id]={id:r.upgrades.nextId++,status:'supplying',required:{...CivilRouteUpgradeContent.cost},buffer:{},remaining:0,receipts:[],startedAt:s.civilization.elapsed,completedAt:null,refitShipmentId:null};
    return true;
  },
  nextUpgradeCargo(s,id,capacity){
    const p=this.upgrade(s,id);if(!p || p.status!=='supplying' || !Number.isFinite(capacity) || capacity<=0)return null;
    const inflight={};for(const shipment of s.civilization.regions.shipments)if(shipment.purpose==='upgrade' && shipment.route===id && shipment.upgradeId===p.id && shipment.phase==='outbound')
      for(const [key,n]of Object.entries(shipment.cargo))inflight[key]=(inflight[key]||0)+n;
    const cargo={};let room=Math.min(capacity,s.civilization.regions.routes[id].capacity);
    for(const [key,required]of Object.entries(p.required)){
      const count=Math.min(room,Math.max(0,required-(p.buffer[key]||0)-(inflight[key]||0)),s.stores[key]||0);
      if(count>0){cargo[key]=count;room-=count;}
    }
    return Object.keys(cargo).length?{projectId:p.id,cargo}:null;
  },
  receiveUpgradeCargo(s,id,cargo,upgradeId){
    const r=s.civilization.regions,p=this.upgrade(s,id);if(!p || p.id!==upgradeId || p.status!=='supplying')return false;
    const shipment=r.shipments.find(x=>x.route===id && x.upgradeId===upgradeId && x.purpose==='upgrade' && x.cargo===cargo && x.phase==='outbound' && x.source==='home' && x.target===id && x.status==='moving' && x.remaining===0);
    if(!shipment || p.receipts.some(x=>x.shipmentId===shipment.id) || !Object.keys(cargo).length || Object.entries(cargo).some(([key,n])=>!Number.isFinite(n)||n<=0||!Object.hasOwn(p.required,key)||(p.buffer[key]||0)+n>p.required[key]+1e-8))return false;
    this.credit(p.buffer,cargo);p.receipts.push({shipmentId:shipment.id,cargo:{...cargo},at:s.civilization.elapsed});
    if(Object.entries(p.required).every(([key,n])=>(p.buffer[key]||0)+1e-8>=n)){
      this.debit(p.buffer,p.required);p.status='building';p.remaining=CivilRouteUpgradeContent.duration;p.refitShipmentId=shipment.id;this.planWorkers(s,id,r.nodes[id]);
    }
    return true;
  },
  validUpgradeShipment(s,p){
    const upgrade=this.upgrade(s,p?.route);if(!upgrade || p.purpose!=='upgrade' || p.upgradeId!==upgrade.id)return false;
    if(p.phase==='empty')return p.source===p.route && p.target==='home' && Object.values(p.cargo).every(n=>n===0) && upgrade.receipts.some(x=>x.shipmentId===p.id);
    return upgrade.status==='supplying' && ['outbound','returning'].includes(p.phase) && !upgrade.receipts.some(x=>x.shipmentId===p.id) &&
      Object.keys(p.cargo).length>0 && Object.entries(p.cargo).every(([key,n])=>Object.hasOwn(upgrade.required,key)&&Number.isFinite(n)&&n>0&&n+(upgrade.buffer[key]||0)<=upgrade.required[key]+1e-8);
  },
  tradeReady(s){const r=s.civilization.regions;if(!r?.active)return false;const staffed=this.staffedRoutes(s);return Object.entries(r.routes).some(([id,p])=>p.enabled && p.condition==='open' && staffed.has(id) && p.completedTrips>0 && p.lastDeliveredAt!==null && s.civilization.elapsed-p.lastDeliveredAt<=Math.max(180,p.travel*2+30));},
  serviceReady(s,id){
    const route=s.civilization.regions?.routes[id];
    if(!route?.enabled || route.condition!=='open' || !this.staffedRoutes(s).has(id) || !route.completedTrips)return false;
    // A locally supplied town still uses its road while the same cart carries building
    // materials. Count actual deliveries, never departure, empty return or forecast.
    const times=[route.lastDeliveredAt,route.lastSupplyAt].filter(t=>Number.isFinite(t));
    return times.length>0 && s.civilization.elapsed-Math.max(...times)<=Math.max(180,route.travel*2+30);
  },
  committedFlow(s,nodeId='home'){
    const flow={};
    for(const [id,route]of Object.entries(s.civilization.regions?.routes||{}))if(route.enabled && route.assigned>=2){
      if(nodeId!=='home' && nodeId!==id)continue;
      const plan=typeof CivilFinance!=='undefined' && CivilFinance.transportPlan?CivilFinance.transportPlan(s,id):null;
      const total=10/(route.travel*2+10),common=plan?Math.min(total,10/plan.period):0;
      const trade=nodeId==='home'?this.dispatchCost(s,id,CivilRegionContent[id].out):CivilRegionContent[id].back;
      const budget=plan?(nodeId==='home'?this.dispatchCost(s,id,plan.out):plan.back):{};
      // One physical cart replaces a trade slot with the budget trip. Upkeep is
      // charged at the original total frequency, never once per parallel plan.
      for(const [k,v]of Object.entries(trade))flow[k]=(flow[k]||0)-v*(total-common);
      for(const [k,v]of Object.entries(budget))flow[k]=(flow[k]||0)-v*common;
    }
    return flow;
  },
  committedHomeFlow(s){return this.committedFlow(s,'home');},
  createNode(s,id){
    this.init(s);const r=s.civilization.regions;if(r.nodes[id])return r.nodes[id];
    const d=CivilRegionContent[id];if(!d)return null;
    const n=r.nodes[id]={discovered:true,control:'independent',relation:'contacted',population:d.population,cohorts:[],workers:{},stores:{...d.stores},health:80,trust:50,unrest:0,integration:0,autonomy:'local',rights:'resident',rightsSince:s.civilization.elapsed,promises:{},completedProjects:{},year:Math.floor(s.civilization.elapsed/600),stableSeconds:0};
    for(let i=0;i<d.population;i++)n.cohorts.push({age:20+i%24,count:1,identity:i<d.mutants?'mutant':'human'});
    this.initBirths(n);
    this.planWorkers(s,id,n);
    r.routes[id]={node:id,enabled:false,assigned:0,travel:d.travel,capacity:64,condition:'open',dispatchIn:10,completedTrips:0,lastDeliveredAt:null,status:'尚未订约'};
    return n;
  },
  activate(s){
    this.init(s);const c=s.civilization,r=c.regions;
    if(r.active || !c.tech.logistics || !s.game.buildings.cartdepot || this.availableTransport(s)<2)return false;
    // Existing village migration must run first; it alone owns preview-era aid reimbursement.
    CivilVillage.init(s);const v=c.village;
    if(v.riverKnown){
      const n=this.createNode(s,'river'),route=r.routes.river;
      n.stores={food:v.riverFood,tools:v.riverTools,medicine:v.riverMedicine};
      n.relation=v.riverAllied?'trade':'contacted';n.trust=50+Math.min(20,v.convoys*2);
      n.completedProjects.initialAid=!!v.aidDelivered;
      route.completedTrips=v.convoys;route.dispatchIn=Math.max(0,60-v.convoyClock);
      route.lastDeliveredAt=v.convoys?c.elapsed:null;
      if(v.riverAllied){route.enabled=true;route.assigned=2;route.status='等待发车';}
    }
    r.active=true;return true;
  },
  planWorkers(s,id,n){
    if(typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id))return CivilMunicipal.planWorkers(s,id);
    const d=CivilRegionContent[id],desired={...d.workers,...(n.completedProjects.publicWorks?d.service:{})};
    if(n.completedProjects.publicWorks){
      // The paid water/service project opens local plots and care places; actual adult workers still staff them.
      desired.medic=Math.max(desired.medic||0,Math.ceil((n.population*.01+(d.back.medicine||0)*10/(d.travel*2+10))/.15));
      desired.farmer+=Math.ceil(Math.max(0,(this.foodPopulation(n)-d.population)*.12+(desired.medic-(d.service.medic||d.workers.medic||0))*.2)/.8);
    }
    if(s.civilization.regions.projects[id]?.status==='building' || this.upgrade(s,id)?.status==='building')desired.builder=2;
    let left=this.workforce(n);n.workers={};
    // Local governments protect subsistence before filling processing and teaching roles.
    for(const job of ['farmer','medic','builder','salvager','gatherer','teacher','smelter','machinist']){
      const count=Math.min(left,desired[job]||0);if(count)n.workers[job]=count;left-=count;
    }
  },
  canPay(stores,cost,reserve=0){return (stores.food||0)+1e-8>=reserve+(cost.food||0) && Object.entries(cost).every(([k,v])=>(stores[k]||0)+1e-8>=v);},
  debit(stores,cost){for(const [k,v]of Object.entries(cost))stores[k]=Math.max(0,(stores[k]||0)-v);},
  credit(stores,cargo){for(const [k,v]of Object.entries(cargo))stores[k]=(stores[k]||0)+v;},
  settle(s){
    this.init(s);const r=s.civilization.regions,flow={};if(!r.active)return flow;
    r.archiveOnline=0;
    for(let i=0;i<(s.game.buildings.archive||0);i++)if(CivilRules.pay(s,{knowledge:.04})){r.archiveOnline++;flow['地区档案']={knowledge:-.04*r.archiveOnline};}
    const excess=Math.max(0,this.load(s)-this.capacity(s)),cost={knowledge:excess*.04};
    r.adminService=!excess || CivilRules.pay(s,cost);
    if(excess && r.adminService)flow['协调超额']={knowledge:-cost.knowledge};
    for(const [id,n]of Object.entries(r.nodes))this.settleNode(s,id,n);
    return flow;
  },
  settleNode(s,id,n){
    if(typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id))return CivilMunicipal.settleNode(s,id);
    this.planWorkers(s,id,n);const w=n.workers,st=n.stores;
    const hungry=(st.food||0)<this.foodPopulation(n)*.12;
    const f=(n.health<30?.75:1)*(hungry?.65:1);
    st.food=(st.food||0)+(w.farmer||0)*.8*f;st.scrap=(st.scrap||0)+(w.salvager||0)*.8*f;st.wood=(st.wood||0)+(w.gatherer||0)*.5*f;
    const meal=this.foodPopulation(n)*.12,ate=(st.food||0)+1e-8>=meal;st.food=Math.max(0,(st.food||0)-meal);
    const run=(count,cost,out,reserve={})=>{
      let runs=count;for(const [k,v]of Object.entries(cost))runs=Math.min(runs,Math.floor((Math.max(0,(st[k]||0)-(reserve[k]||0))+1e-8)/v));
      this.debit(st,Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,v*runs])));
      this.credit(st,Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v*runs*f])));return runs;
    };
    run(w.medic||0,{food:.2,scrap:.1,...(id==='highland'?{coal:.01}:{})},{medicine:.15});
    run(w.teacher||0,{wood:.1},{knowledge:.2});
    run(w.smelter||0,{scrap:1,coal:.2,tools:.01},{iron:.6});
    // Keep the promised raw-iron shipment available before local machining consumes the rest.
    run(w.machinist||0,{iron:.5,scrap:.2,tools:.01},{parts:.3},{iron:CivilRegionContent[id].back.iron||0});
    const care=n.population*.01;
    if(n.population && this.canPay(st,{medicine:care}) && (w.medic||0)>0){this.debit(st,{medicine:care});n.health=Math.min(100,n.health+.25);}
    else n.health=Math.max(0,n.health-(ate?.02:.4));
    if(!ate)n.unrest=Math.min(100,n.unrest+.1);
    if(['associated','integrated'].includes(n.relation) && this.load(s)>this.capacity(s))n.unrest=Math.min(100,n.unrest+.1);
    else if(ate)n.unrest=Math.max(0,n.unrest-.02);
  },
  dispatchCost(s,id,cargo){const cost={...cargo};cost.wood=(cost.wood||0)+1;cost.food=(cost.food||0)+(s.civilization.tech.preservation?1:2);if(this.upgrade(s,id)?.status==='complete')cost.parts=(cost.parts||0)+CivilRouteUpgradeContent.partsPerTrip;return cost;},
  routeBusy(s,id){return s.civilization.regions.shipments.some(p=>p.route===id);},
  setRoute(s,id,enabled){
    const r=s.civilization.regions,route=r?.routes[id],n=r?.nodes[id];
    if(!r?.active || !route || !['trade','associated','integrated'].includes(n.relation))return false;
    if(enabled && !route.assigned){if(this.availableTransport(s)<2)return false;route.assigned=2;}
    route.enabled=!!enabled;
    if(!enabled && !this.routeBusy(s,id))route.assigned=0;
    route.status=enabled?'等待发车':this.routeBusy(s,id)?'本趟完成后停发':'已暂停';return true;
  },
  signTrade(s,id){const r=s.civilization.regions,n=r?.nodes[id];if(!r?.active || !n || n.relation!=='contacted')return false;n.relation='trade';return true;},
  launch(s,id){
    const r=s.civilization.regions,route=r.routes[id];
    if(!r.active || !route?.enabled || route.condition!=='open' || this.routeBusy(s,id) || !this.staffedRoutes(s).has(id))return false;
    if(id==='river' && (!s.game.buildings.road || s.civilization.outpostSupplied!==true)){route.status='道路或外站待维护';return false;}
    const project=r.projects[id],mayBuild=route.lastPurpose===undefined || route.lastPurpose==='trade';
    const common=mayBuild && typeof CivilFinance!=='undefined'?CivilFinance.nextCargo(s,id,route.capacity):null;
    if(common){
      const cargo={...common.cargo},cost=this.dispatchCost(s,id,cargo),shipment={id:r.nextShipment++,route:id,source:'home',target:id,cargo,capacity:route.capacity,remaining:route.travel,phase:'outbound',status:'moving',purpose:'common',commonOrderId:common.orderId,agreementId:common.agreementId,periodIndex:common.periodIndex,legStartedAt:s.civilization.elapsed,legDuration:route.travel};
      r.shipments.push(shipment);
      // Finance is the sole owner of common-plan payments and receipts. Its
      // failed transaction leaves no debit; do not consume a vehicle or ID.
      if(!CivilFinance.dispatch(s,shipment,cost)){
        r.shipments=r.shipments.filter(p=>p!==shipment);r.nextShipment--;
        route.status='共同预算待补足物资与本地储备';return false;
      }
      route.lastPurpose='common';route.status='共同预算物资在途';return true;
    }
    let purpose='trade',cargo={...CivilRegionContent[id].out},projectId,upgradeId,serviceProjectId,next;
    if(mayBuild && project?.status==='supplying'){
      const materials={};let room=route.capacity;
      for(const [k,need]of Object.entries(project.required)){
        const amount=Math.min(room,Math.max(0,need-(project.buffer[k]||0)),s.stores[k]||0);
        if(amount>0){materials[k]=amount;room-=amount;}
      }
      if(Object.keys(materials).length)next={purpose:'project',cargo:materials};
    }else if(mayBuild){
      const upgrade=this.nextUpgradeCargo(s,id,route.capacity);
      if(upgrade)next={...upgrade,purpose:'upgrade'};
      else if(typeof CivilServices!=='undefined'){
        const service=CivilServices.nextCargo(s,id,route.capacity);if(service)next={...service,purpose:'services'};
      }
      if(!next && typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id)){
        const municipal=CivilMunicipal.nextCargo(s,id,route.capacity);if(municipal)next={...municipal,purpose:'municipal'};
      }
    }
    if(next){
      const trimmed={...next.cargo},reserve=(typeof CivilSociety!=='undefined'?CivilSociety.foodPopulation(s):s.game.population)*.24;
      const upkeep=this.dispatchCost(s,id,{});upkeep.food+=reserve;
      for(const [key,kept]of Object.entries(upkeep))if(trimmed[key]){
        trimmed[key]=Math.min(trimmed[key],Math.max(0,(s.stores[key]||0)-kept));if(!trimmed[key])delete trimmed[key];
      }
      if(Object.keys(trimmed).length){
        purpose=next.purpose;cargo=trimmed;
        if(purpose==='municipal')projectId=next.projectId;
        if(purpose==='upgrade')upgradeId=next.projectId;
        if(purpose==='services')serviceProjectId=next.projectId;
      }
    }
    const cost=this.dispatchCost(s,id,cargo);
    if(!this.canPay(s.stores,cost,(typeof CivilSociety!=='undefined'?CivilSociety.foodPopulation(s):s.game.population)*.24)){route.status='待补足货物与本地口粮';return false;}
    this.debit(s.stores,cost);
    r.shipments.push({id:r.nextShipment++,route:id,source:'home',target:id,cargo,capacity:route.capacity,remaining:route.travel,phase:'outbound',status:'moving',purpose,...(projectId===undefined?{}:{projectId}),...(upgradeId===undefined?{}:{upgradeId}),...(serviceProjectId===undefined?{}:{serviceProjectId})});
    route.lastPurpose=purpose;
    route.status={project:'项目材料在途',municipal:'市政材料在途',upgrade:'改装材料在途',services:'公用工程材料在途',trade:'货物在途'}[purpose];return true;
  },
  arrive(s,p){
    const r=s.civilization.regions;
    if(!p || !r.shipments.some(x=>x===p) || p.status!=='moving' || p.remaining!==0)return false;
    const route=r.routes[p.route],n=r.nodes[p.route];
    if(p.purpose==='common'){
      if(typeof CivilFinance==='undefined')return false;
      // Never let common cargo fall through the ordinary barter credit paths.
      // Existing paid trips keep their contract even while new orders pause.
      if(p.phase==='outbound'){
        if(route.condition!=='open' || !CivilFinance.receive(s,p))return false;
        p.cargo={};p.phase='inbound';p.source=p.route;p.target='home';p.remaining=0;p.status='loading';p.legStartedAt=s.civilization.elapsed;p.legDuration=0;
        route.lastSupplyAt=s.civilization.elapsed;route.status='共同预算已交付，等待地方贡献';return true;
      }
      if(p.phase==='inbound'){
        if(route.condition!=='open' || !CivilFinance.receive(s,p))return false;
      }else if(!CivilFinance.recordReturn(s,p))return false;
      if(p.target!=='home'){
        p.cargo={};p.phase='empty';p.source=p.route;p.target='home';p.remaining=route.travel;p.legStartedAt=s.civilization.elapsed;p.legDuration=route.travel;
        p.status=route.condition==='open'?'moving':'held';route.status='共同贡献退回地方仓，空车等待通路';return true;
      }
      r.shipments=r.shipments.filter(x=>x!==p);route.dispatchIn=10;route.status=route.enabled?'等待下一趟':'已暂停';
      if(!route.enabled)route.assigned=0;return true;
    }
    if(p.phase==='outbound'){
      if(route.condition!=='open')return false;
      const supplied=Object.values(p.cargo).some(value=>Number.isFinite(value)&&value>0);
      if(p.purpose==='upgrade'){
        if(!this.receiveUpgradeCargo(s,p.route,p.cargo,p.upgradeId))return false;
        p.cargo={};p.phase='empty';p.source=p.route;p.target='home';p.remaining=route.travel;
        p.status=this.upgrade(s,p.route).status==='building'?'refitting':'moving';route.status=p.status==='refitting'?'货车留在地方改装':'改装车队返程';
      }else if(p.purpose==='services'){
        if(typeof CivilServices==='undefined' || !CivilServices.receiveCargo(s,p.route,p.cargo,p.serviceProjectId))return false;
        p.cargo={};p.phase='empty';p.source=p.route;p.target='home';p.remaining=route.travel;p.status='moving';route.status='公用工程车队返程';
      }else if(p.purpose==='municipal'){
        if(!CivilMunicipal.receiveCargo(s,p.route,p.cargo,p.projectId))return false;
        p.cargo={};p.phase='empty';p.source=p.route;p.target='home';p.remaining=route.travel;p.status='moving';route.status='市政车队返程';
      }else if(p.purpose==='project'){
        const project=r.projects[p.route];this.credit(project.buffer,p.cargo);
        if(Object.entries(project.required).every(([k,v])=>(project.buffer[k]||0)+1e-8>=v)){
          this.debit(project.buffer,project.required);project.status='building';project.remaining=CivilRegionContent[p.route].project.duration;this.planWorkers(s,p.route,n);
        }
        p.cargo={};p.phase='empty';p.source=p.route;p.target='home';p.remaining=route.travel;p.status='moving';route.status='项目车队返程';
      }else{
        this.credit(n.stores,p.cargo);p.cargo={};p.phase='inbound';p.source=p.route;p.target='home';p.remaining=0;p.status='loading';route.status='等待对方备货';
      }
      if(supplied)route.lastSupplyAt=s.civilization.elapsed;
      return true;
    }
    // A blocked incoming convoy may turn back to its remote source, never teleport through the blockage.
    if(p.target!=='home'){
      this.credit(n.stores,p.cargo);p.cargo={};p.phase='empty';p.source=p.route;p.target='home';p.remaining=route.travel;
      p.status=route.condition==='open'?'moving':'held';route.status='货物退回地方仓，空车等待通路';return true;
    }
    this.credit(s.stores,p.cargo);
    if(p.phase==='inbound'){
      route.completedTrips++;route.lastDeliveredAt=s.civilization.elapsed;n.trust=Math.min(100,n.trust+2);
      if(p.route==='river'){const v=s.civilization.village;v.convoys=route.completedTrips;v.routeStatus='往返正常';}
    }
    r.shipments=r.shipments.filter(x=>x.id!==p.id);route.dispatchIn=10;route.status=route.enabled?'等待下一趟':'已暂停';
    if(!route.enabled)route.assigned=0;
    return true;
  },
  loadReturn(s,p){
    const r=s.civilization.regions;
    if(!p || !r.shipments.some(x=>x===p) || p.status!=='loading' || p.phase!=='inbound')return false;
    const n=r.nodes[p.route],route=r.routes[p.route],cargo=CivilRegionContent[p.route].back;
    if(route.condition!=='open'){route.status='道路受阻，等待返程';return false;}
    if(p.purpose==='common'){
      if(typeof CivilFinance==='undefined')return false;
      const contribution=CivilFinance.returnCargo(s,p);
      if(!contribution || !CivilFinance.loadReturn(s,p)){route.status='共同预算等待地方贡献与储备';return false;}
      p.cargo={...contribution};p.status='moving';p.remaining=route.travel;p.legStartedAt=s.civilization.elapsed;p.legDuration=route.travel;route.status='共同贡献返程在途';return true;
    }
    if(!this.canPay(n.stores,cargo,this.foodPopulation(n)*.24))return false;
    this.debit(n.stores,cargo);p.cargo={...cargo};p.status='moving';p.remaining=route.travel;route.status='返程货物在途';return true;
  },
  returnShipment(s,id){
    const r=s.civilization.regions,p=r.shipments.find(x=>x.id===id);if(!p || !['held','loading'].includes(p.status) || !['outbound','inbound'].includes(p.phase))return false;
    if(p.purpose==='common' && (typeof CivilFinance==='undefined' || !CivilFinance.validShipment(s,p)))return false;
    const route=r.routes[p.route];
    if(p.phase==='outbound'){p.remaining=Math.max(1,route.travel-p.remaining);p.phase='returning';p.target='home';}
    else if(p.status==='loading'){p.remaining=route.travel;p.phase='empty';p.target='home';}
    else {p.remaining=Math.max(1,route.travel-p.remaining);p.phase='returning';p.target=p.route;}
    if(p.purpose==='common'){p.legStartedAt=s.civilization.elapsed;p.legDuration=p.remaining;}
    p.status='moving';route.status='带货返航';route.enabled=false;return true;
  },
  setRoad(s,id,open){const r=s.civilization.regions.routes[id];if(!r)return false;r.condition=open?'open':'closed';return true;},
  repairRoad(s,id){const route=s.civilization.regions.routes[id];if(!route || route.condition!=='closed' || !CivilRules.pay(s,{wood:20,tools:4}))return false;route.condition='open';return true;},
  startProject(s,id){
    const r=s.civilization.regions,n=r.nodes[id],route=r.routes[id];
    if(!r.active || !s.civilization.tech.administration || !n || r.projects[id] || !['trade','associated','integrated'].includes(n.relation) || route.completedTrips<3 || n.trust<60 || !CivilRules.pay(s,{knowledge:10}))return false;
    r.projects[id]={status:'supplying',required:{...CivilRegionContent[id].project.cost},buffer:{},remaining:0};n.promises.publicWorks=true;return true;
  },
  chooseRights(s,value){
    const r=s.civilization.regions;if(!s.civilization.tech.administration || !['equal','resident','stratified'].includes(value))return false;
    if(r.rights && r.rights!==value && !CivilRules.pay(s,{knowledge:30}))return false;
    if(r.rights!==value){r.rights=value;r.rightsSince=s.civilization.elapsed;for(const n of Object.values(r.nodes)){
      n.rights=value;n.rightsSince=s.civilization.elapsed;n.stableSeconds=0;
      if(value==='stratified' && n.relation==='integrated'){n.relation='associated';n.integration=0;}
    }}
    return true;
  },
  associate(s,id){
    const r=s.civilization.regions,n=r.nodes[id];
    if(!n || n.relation!=='trade' || !s.civilization.tech.administration || !r.rights || !n.completedProjects.publicWorks || n.trust<60 || this.load(s)>=this.capacity(s) || !CivilRules.pay(s,{knowledge:20}))return false;
    n.control='shared';n.relation='associated';n.rights=r.rights;n.rightsSince=s.civilization.elapsed;n.autonomy=s.civilization.society?.axes.devolution==='central'?'coordinated':'local';n.promises.citizenship=true;n.stableSeconds=0;return true;
  },
  annual(s,n){
    const year=Math.floor(s.civilization.elapsed/600);
    const id=Object.keys(s.civilization.regions.nodes).find(id=>s.civilization.regions.nodes[id]===n);
    this.initBirths(n);
    while(n.year<year){
      const yearStartPopulation=n.population;n.year++;
      n.cohorts=CivilPopulation.age(n.cohorts).cohorts;n.population=CivilPopulation.count(n.cohorts);
      const cap=typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id)?CivilMunicipal.capacity(s,id):CivilRegionContent[id].population+(n.completedProjects.publicWorks?12:0);
      const reserved=typeof CivilUrban!=='undefined' && CivilUrban.reservedBeds?CivilUrban.reservedBeds(s,id):0;
      const birth=CivilPopulation.births(n.cohorts,n.births,{
        yearStartPopulation,beds:cap-n.population-reserved,health:n.health,
        hunger:(n.stores.food||0)<this.foodPopulation(n)*.12,food:n.stores.food,medicine:n.stores.medicine
      });
      if(birth.count && this.canPay(n.stores,birth.cost)){
        this.debit(n.stores,birth.cost);n.cohorts.push(...birth.cohorts);n.population+=birth.count;
      }
    }
    this.planWorkers(s,id,n);
  },
  tick(s){
    this.init(s);const changed={storesChanged:false,populationChanged:false};this.activate(s);
    const c=s.civilization,r=c.regions;if(!r.active)return changed;
    if(!r.announced){r.announced=true;this.note('车队改用分仓账册。货物离开本地后，将在真正抵达时记入对方仓库。');}
    for(const [id,n]of Object.entries(r.nodes)){
      this.annual(s,n);
      const p=r.projects[id];if(p?.status==='building' && n.health>=30 && n.workers.builder>=2){p.remaining=Math.max(0,p.remaining-1);if(!p.remaining){p.status='complete';n.completedProjects.publicWorks=true;n.trust=Math.min(100,n.trust+10);this.planWorkers(s,id,n);this.note(CivilRegionContent[id].project.name+'建成。当地可以安排新的公共服务岗位。');}}
      const upgrade=this.upgrade(s,id);
      if(upgrade?.status==='building'){
        const vehicle=r.shipments.find(p=>p.id===upgrade.refitShipmentId && p.route===id && p.purpose==='upgrade' && p.upgradeId===upgrade.id && p.status==='refitting');
        if(vehicle && this.upgradeEligible(s,id) && n.health>=30 && n.workers.builder>=2){
          upgrade.remaining=Math.max(0,upgrade.remaining-1);
          if(!upgrade.remaining){upgrade.status='complete';upgrade.completedAt=c.elapsed;r.routes[id].capacity=CivilRouteUpgradeContent.capacity;vehicle.status='moving';this.planWorkers(s,id,n);this.note(CivilRegionContent[id].name+'的原货车已加固。每趟可载128份材料，仍由两名运输工照管，出发另耗0.05零件。');}
        }
      }
      if(n.relation==='associated'){
        const route=r.routes[id],qualified=r.rights==='equal' || r.rights==='resident' && c.elapsed-n.rightsSince>=600;
        const ready=qualified && this.load(s)<=this.capacity(s) && r.adminService && n.health>=60 && n.unrest<40 && (n.stores.food||0)>=this.foodPopulation(n)*.24 && route.enabled && route.condition==='open' && this.staffedRoutes(s).has(id) && route.completedTrips>=3 && route.lastDeliveredAt!==null && c.elapsed-route.lastDeliveredAt<=Math.max(180,route.travel*2+30);
        n.stableSeconds=ready?n.stableSeconds+1:Math.max(0,n.stableSeconds-1);n.integration=Math.min(100,n.stableSeconds/6);
        if(n.stableSeconds>=600){n.relation='integrated';n.integration=100;this.note(CivilRegionContent[id].name+'的代表确认了共同治理。当地库存、住房和名册仍单独保存。');}
      }
    }
    for(const p of [...r.shipments]){
      const route=r.routes[p.route];
      if(p.status==='refitting'){route.status='货车留在地方改装，还需'+Math.ceil(this.upgrade(s,p.route).remaining)+'秒';continue;}
      if(p.status==='loading'){this.loadReturn(s,p);continue;}
      if(p.phase!=='returning' && route.condition==='closed'){p.status='held';route.status='道路受阻，货物仍在车上';continue;}
      if(p.status==='held')p.status='moving';
      p.remaining=Math.max(0,p.remaining-1);
      if(!p.remaining){const toHome=p.target==='home';this.arrive(s,p);if(toHome)changed.storesChanged=true;}
    }
    for(const [id,route]of Object.entries(r.routes)){
      if(this.routeBusy(s,id))continue;
      if(!route.enabled){route.assigned=0;continue;}
      if(!this.staffedRoutes(s).has(id)){route.status='运输工不足，暂停发车';continue;}
      route.dispatchIn=Math.max(0,route.dispatchIn-1);
      if(!route.dispatchIn && this.launch(s,id))changed.storesChanged=true;
    }
    if(r.routes.river){const route=r.routes.river;const v=c.village;v.routeStatus=route.status;v.convoys=route.completedTrips;}
    return changed;
  },
  nextEvent(s){const r=s.civilization.regions;return r?.active && s.civilization.tech.administration && this.discoveredCount(s)>=2 && !r.rights?'regionRights':null;},
  note(text){if(typeof Civilization!=='undefined' && Civilization.notify)Civilization.notify(text);},
  event(id,done){
    const s=State,r=s.civilization.regions;
    if(id==='railSurvey' || id==='highlandSurvey'){
      const node=id==='railSurvey'?'rail':'highland',d=CivilRegionContent[node];
      return {title:d.name,text:node==='rail'?['废弃货场里还有三十二位居民。机修棚可以从废料中炼出铁料，却缺少稳定的粮食与燃煤。','守备人要求先记录互惠的货单。没有得到同意，就不能替他们调换岗位。']:['十八位居民围着净水池生活，其中八位有明显的变异特征。医护和教师仍在使用战前留下的教材。','他们愿意交换药品与抄本，也要求道路上的人被当作同样的居民。'],buttons:{meet:{text:'登记居民与需求',nextScene:'end',onChoose:done('地图上记下了'+d.name+'。对方保留自己的库存和议事。',()=>this.createNode(s,node))}}};
    }
    if(id==='regionRights'){
      const names={equal:'平等公民',resident:'居住资格',stratified:'分层资格'};
      return {title:'谁属于共同体',text:['公民资格适用于人类和变异居民。食物、基本医疗与保护不能因外貌而取消。','平等公民直接共享代表资格；居住资格在连续登记600秒后转正；分层资格可保留附属关系，但不会完成平等整合。','以后可花30知识重议资格。既有仓库和已送出的公共物资不会因改制而重置。'],buttons:Object.fromEntries(Object.entries(names).map(([k,text])=>[k,{text,nextScene:'end',onChoose:done('共同体采用'+text+'。',()=>this.chooseRights(s,k))}]))};
    }
    const key={regionRiver:'river',regionRail:'rail',regionHighland:'highland'}[id],n=r?.nodes[key];if(!n)return null;
    const d=CivilRegionContent[key],route=r.routes[key],p=r.projects[key],upgrade=this.upgrade(s,key),buttons={};
    if(r.active && n.relation==='contacted')buttons.trade={text:'签订互惠货单',nextScene:'end',onChoose:done('货单已登记。安排运输工后才能启运。',()=>this.signTrade(s,key))};
    if(r.active && n.relation!=='contacted' && (route.enabled || route.assigned>=2 || this.availableTransport(s)>=2))buttons.route={text:route.enabled?'完成本趟后停发':'安排两人启运',nextScene:'end',onChoose:done(route.enabled?'车队将在本趟结束后停发。':'车队按可用运输岗位安排。',()=>this.setRoute(s,key,!route.enabled))};
    if(civilCanProject())buttons.project={text:'筹办'+d.project.name,nextScene:'end',onChoose:done('筹办公共项目。材料由下一趟车队逐批实际运到。',()=>this.startProject(s,key))};
    if(this.canUpgrade(s,key))buttons.upgrade={text:'筹办货车改装',nextScene:'end',onChoose:()=>{const ok=this.startUpgrade(s,key);return done(ok?'货车改装已筹办。木120、铁20、零件8、工具8由原车逐批运到，再由当地两人施工180秒。':'改装条件已有变化，等待现有工程结束或恢复地方议约。')();}};
    if(n.relation==='trade' && n.completedProjects.publicWorks && r.rights && this.load(s)<this.capacity(s) && CivilRules.canPay(s,{knowledge:20}))buttons.associate={text:'议约加盟（20知识）',nextScene:'end',onChoose:done('代表签下共同服务与公民资格条款。持续履约后才能完成整合。',()=>this.associate(s,key))};
    for(const shipment of r.shipments.filter(x=>x.route===key && ['held','loading'].includes(x.status) && ['outbound','inbound'].includes(x.phase)))buttons['return'+shipment.id]={text:'带车货返回',nextScene:'end',onChoose:done('车队带着尚未交付的物资返回出发仓。已交付或已消耗的物资不会重复退回。',()=>this.returnShipment(s,shipment.id))};
    if(route.condition==='closed' && CivilRules.canPay(s,{wood:20,tools:4}))buttons.repair={text:'修路（木20工具4）',nextScene:'end',onChoose:done('修路队恢复了通行。',()=>this.repairRoad(s,key))};
    buttons.close={text:'暂不改变',nextScene:'end',onChoose:done('对方继续按现有约定生活。')};
    const fmt=obj=>Object.entries(obj).map(([k,v])=>_(k)+' '+Number(v.toFixed(2))).join('、');
    return {title:d.name,text:[n.population+'居民 · 健康'+Math.floor(n.health)+' · 信任'+Math.floor(n.trust)+' · '+({contacted:'独立接触',trade:'互惠贸易',associated:'加盟履约',integrated:'共同治理'}[n.relation]),'本地送出：'+fmt(d.out)+'；到达后，对方备货：'+fmt(d.back)+'。单程'+route.travel+'秒，载重'+route.capacity+'，每趟另耗木1与旅粮'+(route.capacity===128?'、零件0.05':'')+'。','地方库存：'+fmt(n.stores)+'。',...(typeof CivilFinance!=='undefined'&&CivilFinance.agreement(s)?.members.includes(key)?['共同约定：'+CivilFinance.routeStatus(s,key)+'。']:[]),'车队：'+route.status+'。已完成'+route.completedTrips+'趟。'+(!route.enabled && !route.assigned && this.availableTransport(s)<2?' 还需两名空闲运输工才能启运。':''),...(p?['公共项目：'+({supplying:'材料运输中',building:'施工 '+Math.ceil(p.remaining)+'秒',complete:'已经建成'}[p.status])+'。']:s.civilization.tech.administration?['共同项目需要：'+fmt(d.project.cost)+'；另花10知识筹办，材料运到后施工。']:[]),...(this.canUpgrade(s,key)?['改装计划：木120、铁20、零件8、工具8，由原车运到；当地两人施工180秒后载重变为128，每趟另耗0.05零件。']:[]),...(upgrade?['货车改装：'+({supplying:'已运到 '+(fmt(upgrade.buffer)||'尚无材料')+'；需要 '+fmt(upgrade.required),building:'原车留在当地，由两名施工者改装，还需'+Math.ceil(upgrade.remaining)+'秒',complete:'已完成，仍是一辆车、两名运输工'}[upgrade.status])+'。']:[]),...(n.relation==='associated'?['整合 '+Math.floor(n.integration)+'%；需要持续供养、通行、行政容量与公民资格。'+(n.rights==='resident'?' 该地资格登记还需 '+Math.max(0,600-(s.civilization.elapsed-n.rightsSince))+' 秒。':n.rights==='stratified'?' 分层资格维持加盟关系，暂不完成共同公民权整合。':'')]:[])],buttons};
    function civilCanProject(){return r.active && s.civilization.tech.administration && n.relation!=='contacted' && !p && route.completedTrips>=3 && n.trust>=60 && CivilRules.canPay(s,{knowledge:10});}
  },
  reset(){this.module=null;},
  refresh(){
    const s=State,c=s.civilization,r=c.regions;if(!r || !c.tech.survey && !c.tech.logistics)return;
    if(!this.module){
      const m=this.module={onArrival(diff){document.title='地区';Engine.moveStoresView(null,diff);}};m.tab=Header.addLocation('地区','regions',m);m.panel=$('<div>').attr('id','regionsPanel').addClass('location').appendTo('#locationSlider');
      $('<div>').attr('id','regionStatus').css({width:'420px',lineHeight:'1.8',marginBottom:'20px'}).appendTo(m.panel);
      const columns=$('<div>').css({position:'relative',minHeight:'60px',marginBottom:'20px'}).appendTo(m.panel);
      $('<div>').attr('id','regionBuildBtns').appendTo(columns);$('<div>').attr('id','regionStructures').css({position:'absolute',left:'160px',top:0,width:'150px'}).appendTo(columns);
      $('<div>').attr('id','regionNodes').appendTo(m.panel);Engine.updateSlider();
    }
    for(const id of Object.keys(this.buildings)){
      const button=Room.Craftables[id]?.button;if(button?.length && button.parent().attr('id')!=='regionBuildBtns')button.appendTo('#regionBuildBtns');$('#building_row_'+id).hide();
      let row=$('#region_count_'+id);const n=s.game.buildings[id]||0;
      if(n && !row.length){row=$('<div>').addClass('storeRow').attr('id','region_count_'+id).appendTo('#regionStructures');$('<div>').addClass('row_key').text(_(id)).appendTo(row);$('<div>').addClass('row_val').appendTo(row);$('<div>').addClass('clear').appendTo(row);}
      row.toggle(n>0).find('.row_val').text(n);
    }
    $('#regionStatus').text(r.active?'运输工 '+(s.game.workers.transporter||0)+'，路线已占 '+this.reservedTransport(s)+'，可用 '+this.availableTransport(s)+'。'+(c.tech.administration?'协调责任 '+this.load(s)+' / '+this.capacity(s)+'。':''):'旧河谷运输继续运行。建好车队场并安排两名运输工后，才改用在途账册。');
    for(const [id,j]of Object.entries(this.journeys))if(j.allowed(s)){const b=Civilization.button(id+'Button',id==='railSurvey'?'沿铁轨勘察':'踏勘高地山路','#regionsPanel',()=>Civilization.depart(id),j.cost);Button.setDisabled(b,!!c.journey || !!c.pending || !CivilRules.canPay(s,j.cost));}
    $('#railSurveyButton').toggle(!r.nodes.rail && !!c.tech.survey);$('#highlandSurveyButton').toggle(!!r.nodes.rail && !r.nodes.highland && !!c.tech.survey);
    for(const [id,n]of Object.entries(r.nodes)){
      const pending={river:'regionRiver',rail:'regionRail',highland:'regionHighland'}[id];
      const button=Civilization.button('regionNode_'+id,CivilRegionContent[id].name,'#regionNodes',()=>{if(!Events.activeEvent() && !c.pending){c.pending=pending;Civilization.showPending();}});
      button.attr('title',n.population+'居民；'+r.routes[id].status+'；'+(n.relation==='integrated'?'共同治理':'各自保有库存'));
    }
    if(r.rights && c.tech.administration){const b=Civilization.button('regionRightsButton','重议公民资格','#regionsPanel',()=>{if(!Events.activeEvent() && !c.pending){c.pending='regionRights';Civilization.showPending();}},{knowledge:30});Button.setDisabled(b,!CivilRules.canPay(s,{knowledge:30}));}
    if(typeof CivilRegionMap!=='undefined')CivilRegionMap.refresh(s);
    if(Engine.activeModule===Outside && $('#village').length)$('#storesContainer').css('top',($('#village').height()+26+Outside._STORES_OFFSET)+'px');
  },
  validate(s){
    const r=s.civilization.regions;if(r===undefined)return;
    const obj=x=>x!==null && typeof x==='object' && !Array.isArray(x),num=(x,max=1e12)=>Number.isFinite(x) && x>=0 && x<=max,int=(x,max=1e8)=>Number.isInteger(x)&&num(x,max);
    const cargo=x=>obj(x) && Object.entries(x).every(([k,v])=>CivilCatalog.resources.includes(k)&&num(v));
    if(!obj(r)||r.schema!==1 || typeof r.active!=='boolean' || !int(r.nextShipment) || r.nextShipment<1 || !obj(r.nodes)||!obj(r.routes)||!Array.isArray(r.shipments)||!obj(r.projects)||![null,'equal','resident','stratified'].includes(r.rights)||!num(r.rightsSince,s.civilization.elapsed)||!int(r.archiveOnline,3)||typeof r.adminService!=='boolean'||typeof r.announced!=='boolean')throw Error('地区账册无效');
    if(r.active && !s.civilization.tech.logistics)throw Error('地区运输尚未研究');
    if(r.upgrades!==undefined){
      const u=r.upgrades;if(!obj(u)||!obj(u.projects)||!int(u.nextId)||u.nextId!==Object.keys(u.projects).length+1)throw Error('货车改装总账无效');
      const ids=new Set(),receipts=new Set(),cfg=CivilRouteUpgradeContent;
      for(const [id,p]of Object.entries(u.projects)){
        if(!Object.hasOwn(r.routes,id)||!obj(p)||!int(p.id)||p.id<1||p.id>=u.nextId||ids.has(p.id)||!['supplying','building','complete'].includes(p.status)||!cargo(p.required)||JSON.stringify(p.required)!==JSON.stringify(cfg.cost)||!cargo(p.buffer)||!num(p.remaining,cfg.duration)||!Array.isArray(p.receipts)||!num(p.startedAt,s.civilization.elapsed))throw Error('货车改装工程无效');
        ids.add(p.id);const delivered={};
        for(const receipt of p.receipts){
          if(!obj(receipt)||!int(receipt.shipmentId)||receipt.shipmentId<1||receipt.shipmentId>=r.nextShipment||receipts.has(receipt.shipmentId)||!cargo(receipt.cargo)||!Object.keys(receipt.cargo).length||Object.entries(receipt.cargo).some(([key,n])=>!Object.hasOwn(cfg.cost,key)||n<=0)||Object.values(receipt.cargo).reduce((a,b)=>a+b,0)>64+1e-8||!num(receipt.at,s.civilization.elapsed)||receipt.at<p.startedAt)throw Error('改装收货回执无效');
          const active=r.shipments.find(x=>x.id===receipt.shipmentId);
          if(active && (active.route!==id||active.purpose!=='upgrade'||active.upgradeId!==p.id||active.phase!=='empty'))throw Error('改装回执与车辆不符');
          receipts.add(receipt.shipmentId);this.credit(delivered,receipt.cargo);
        }
        if(Object.entries(p.buffer).some(([key,n])=>!Object.hasOwn(cfg.cost,key)||n>cfg.cost[key]+1e-8)||Object.entries(cfg.cost).some(([key,n])=>(delivered[key]||0)>n+1e-8||Math.abs((delivered[key]||0)-(p.status==='supplying'?(p.buffer[key]||0):n))>1e-8))throw Error('改装材料与回执不符');
        const refit=r.shipments.find(x=>x.id===p.refitShipmentId);
        if(p.status==='supplying' && (p.remaining!==0||p.completedAt!==null||p.refitShipmentId!==null) ||
          p.status!=='supplying' && (Object.values(p.buffer).some(Boolean)||!p.receipts.length||p.refitShipmentId!==p.receipts.at(-1).shipmentId) ||
          p.status==='building' && (!p.remaining||p.completedAt!==null||!refit||refit.route!==id||refit.purpose!=='upgrade'||refit.upgradeId!==p.id||refit.phase!=='empty'||refit.status!=='refitting') ||
          p.status==='complete' && (p.remaining!==0||!num(p.completedAt,s.civilization.elapsed)||p.completedAt<p.receipts.at(-1).at+cfg.duration))throw Error('货车改装进度无效');
        if(p.status!=='complete' && [r.projects[id],s.civilization.municipal?.nodes[id]?.project,s.civilization.services?.nodes[id]?.project].some(x=>x && x.status!=='complete'))throw Error('地方施工重复占用');
      }
    }
    for(const [id,n]of Object.entries(r.nodes)){
      if(!CivilRegionContent[id] || !obj(n) || n.discovered!==true || !['independent','shared'].includes(n.control) || !['contacted','trade','associated','integrated'].includes(n.relation)||!int(n.population)||!Array.isArray(n.cohorts)||!cargo(n.stores)||!obj(n.workers)||!obj(n.promises)||!obj(n.completedProjects)||!['local','coordinated'].includes(n.autonomy)||!['equal','resident','stratified'].includes(n.rights)||!num(n.rightsSince,s.civilization.elapsed)||!int(n.year)||n.year>Math.floor(s.civilization.elapsed/600))throw Error('地方节点无效');
      for(const cohort of n.cohorts)if(!obj(cohort)||!int(cohort.age,100)||!int(cohort.count)||cohort.count<1||!['human','mutant'].includes(cohort.identity))throw Error('地方年龄名册无效');
      if(CivilPopulation.count(n.cohorts)!==n.population)throw Error('地方人口与名册不符');
      if(n.births!==undefined && (!obj(n.births) || typeof n.births.scaled!=='boolean' || ['credit','mutantCredit'].some(k=>!num(n.births[k],1) || n.births[k]>=1)))throw Error('地方出生记录无效');
      for(const key of ['health','trust','unrest','integration'])if(!num(n[key],100))throw Error('地方民情无效');
      if(!num(n.stableSeconds,600) || Object.entries(n.workers).some(([k,v])=>!(typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id)?CivilMunicipalContent.jobs:['farmer','medic','builder','salvager','gatherer','teacher','smelter','machinist']).includes(k)||!int(v)) || Object.values(n.workers).reduce((a,b)=>a+b,0)>this.workforce(n))throw Error('地方劳动分配无效');
      if(typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,id)){const caps=CivilMunicipal.jobCapacity(s,id);if(Object.entries(n.workers).some(([job,count])=>count>(caps[job]||0)))throw Error('地方岗位超过设施容量');}
      if(['associated','integrated'].includes(n.relation)!==(n.control==='shared') || n.relation==='integrated' && (n.integration!==100 || !n.completedProjects.publicWorks || n.rights==='stratified'))throw Error('地方治理状态无效');
      for(const v of Object.values(n.promises).concat(Object.values(n.completedProjects)))if(typeof v!=='boolean')throw Error('地方承诺无效');
    }
    for(const [id,route]of Object.entries(r.routes))if(!r.nodes[id]||!obj(route)||route.node!==id||typeof route.enabled!=='boolean'||![0,2].includes(route.assigned)||route.travel!==CivilRegionContent[id].travel||route.capacity!==(this.upgrade(s,id)?.status==='complete'?CivilRouteUpgradeContent.capacity:64)||!['open','closed'].includes(route.condition)||!num(route.dispatchIn,60)||!int(route.completedTrips)||(route.lastDeliveredAt!==null&&!num(route.lastDeliveredAt,s.civilization.elapsed))||typeof route.status!=='string'||route.status.length>100||route.lastPurpose!==undefined && !['trade','project','municipal','upgrade','services','common'].includes(route.lastPurpose))throw Error('运输路线无效');
    for(const [id,route]of Object.entries(r.routes))if(route.lastPurpose==='common' && (typeof CivilFinance==='undefined' || !obj(s.civilization.finance) || !CivilFinance.hasRouteOrder(s,id)))throw Error('共同运输缺少预算订单');
    for(const route of Object.values(r.routes))if(route.lastSupplyAt!==undefined&&!num(route.lastSupplyAt,s.civilization.elapsed))throw Error('地方实际交付时间无效');
    if(Object.keys(r.routes).length!==Object.keys(r.nodes).length)throw Error('地方缺少路线');
    const ids=new Set(),routes=new Set();
    for(const p of r.shipments){
      const route=r.routes[p.route];
      const dispatchedCapacity=p?.capacity===undefined?64:p.capacity;
      if(!obj(p)||!route||!int(p.id)||p.id<1||p.id>=r.nextShipment||ids.has(p.id)||routes.has(p.route)||!['home',p.route].includes(p.source)||!['home',p.route].includes(p.target)||!cargo(p.cargo)||![64,128].includes(dispatchedCapacity)||dispatchedCapacity>route.capacity||Object.values(p.cargo).reduce((a,b)=>a+b,0)>dispatchedCapacity+1e-8||!num(p.remaining,route.travel)||!['outbound','inbound','returning','empty'].includes(p.phase)||!['moving','held','loading','refitting'].includes(p.status)||!['trade','project','municipal','upgrade','services','common'].includes(p.purpose)||route.assigned!==2)throw Error('在途货物无效');
      if(p.phase==='outbound' && (p.source!=='home'||p.target!==p.route)||['inbound','empty'].includes(p.phase) && (p.target!=='home'||p.source!==p.route)||p.phase==='returning' && p.target!==p.source||p.phase==='empty' && Object.values(p.cargo).some(Boolean)||p.status==='loading' && (p.phase!=='inbound'||Object.keys(p.cargo).length)||p.purpose==='project' && !r.projects[p.route])throw Error('货物方向无效');
      if(p.purpose==='municipal' && (typeof CivilMunicipal==='undefined' || !CivilMunicipal.validShipment(s,p)))throw Error('市政材料无效');
      if(p.purpose==='services' && (typeof CivilServices==='undefined' || !CivilServices.validShipment(s,p)))throw Error('公用工程材料无效');
      if(p.purpose==='upgrade' && (!this.validUpgradeShipment(s,p)||dispatchedCapacity!==64))throw Error('改装材料无效');
      if(p.purpose==='common' && (typeof CivilFinance==='undefined' || !obj(s.civilization.finance) || !num(p.legStartedAt,s.civilization.elapsed) || !num(p.legDuration,route.travel) || p.remaining>p.legDuration || p.legDuration-p.remaining>s.civilization.elapsed-p.legStartedAt+1e-8 || (p.status==='loading'?p.legDuration!==0:p.legDuration<1) || !CivilFinance.validShipment(s,p)))throw Error('共同预算货物无效');
      if(p.status==='refitting' && (p.purpose!=='upgrade'||p.phase!=='empty'||this.upgrade(s,p.route)?.status!=='building'||this.upgrade(s,p.route).refitShipmentId!==p.id||p.remaining!==route.travel))throw Error('改装车辆位置无效');
      if(p.purpose!=='municipal' && p.projectId!==undefined)throw Error('货运工程编号无效');
      if(p.purpose!=='services' && p.serviceProjectId!==undefined || p.purpose!=='upgrade' && p.upgradeId!==undefined)throw Error('扩建货运编号无效');
      if(p.purpose!=='common' && ['commonOrderId','agreementId','periodIndex','legStartedAt','legDuration'].some(key=>p[key]!==undefined))throw Error('共同预算货运编号无效');
      ids.add(p.id);routes.add(p.route);
    }
    for(const [id,p]of Object.entries(r.projects)){
      if(!r.nodes[id]||!obj(p)||!['supplying','building','complete'].includes(p.status)||!cargo(p.required)||!cargo(p.buffer)||!num(p.remaining,CivilRegionContent[id].project.duration)||JSON.stringify(p.required)!==JSON.stringify(CivilRegionContent[id].project.cost))throw Error('公共项目无效');
      if(Object.entries(p.buffer).some(([k,v])=>v>(p.required[k]||0)+1e-8)||p.status!=='supplying' && Object.values(p.buffer).some(v=>v!==0)||p.status==='complete' && !r.nodes[id].completedProjects.publicWorks)throw Error('公共材料无效');
    }
    // Retirements can leave commitments short staffed; dispatch pauses instead of rejecting that valid save.
  }
};
