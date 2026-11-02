/* MPL-2.0 — City service budgets and paid construction; no duplicate warehouses, people or power pool. */
var CivilServices={
  init(s){if(s.civilization.services===undefined)s.civilization.services={schema:1,nodes:{}};if(this.data(s,'home'))this.syncWorkers(s,'home');},
  validNode(s,id){return id==='home'||typeof CivilMunicipal!=='undefined'&&CivilMunicipal.has(s,id);},
  permitted(s,id){return id==='home'||typeof CivilMunicipal!=='undefined'&&CivilMunicipal.canAccept(s,id);},
  data(s,id='home'){const nodes=s.civilization.services?.nodes;return nodes&&Object.hasOwn(nodes,id)?nodes[id]:undefined;},
  stores(s,id='home'){return id==='home'?s.stores:s.civilization.regions?.nodes[id]?.stores;},
  workers(s,id='home'){return id==='home'?s.game.workers:s.civilization.regions?.nodes[id]?.workers;},
  cohorts(s,id='home'){return id==='home'?s.civilization.society.cohorts:s.civilization.regions.nodes[id].cohorts;},
  population(s,id='home'){return id==='home'?s.game.population:s.civilization.regions.nodes[id].population;},
  health(s,id='home'){return id==='home'?s.civilization.village.health:s.civilization.regions.nodes[id].health;},
  active(s,id='home'){return ['supplying','building'].includes(this.data(s,id)?.project?.status);},
  projectAvailable(s,id='home'){
    if(this.active(s,id))return false;
    if(id==='home')return true;
    if(typeof id!=='string'||!Object.hasOwn(s.civilization.regions?.nodes||{},id))return false;
    if(['supplying','building'].includes(s.civilization.municipal?.nodes[id]?.project?.status))return false;
    if(['supplying','building'].includes(s.civilization.regions?.projects[id]?.status))return false;
    return !(typeof CivilRegions!=='undefined'&&CivilRegions.upgradeActive&&CivilRegions.upgradeActive(s,id));
  },
  jobs(s,id='home'){
    const m=this.data(s,id),result={};if(!m)return result;
    for(const [type,n]of Object.entries(m.buildings)){const d=CivilServiceContent.facilities[type];if(d.homeOnly&&id!=='home')continue;for(const [job,cap]of Object.entries(d.jobs||{}))result[job]=(result[job]||0)+n*cap;}
    if(m.project?.status==='building')result[id==='home'?'servicebuilder':'builder']=2;
    return result;
  },
  demandCapacity(s,id='home'){const b=this.data(s,id)?.buildings||{};return (b.waterworks||0)*4+(b.pharmacy||0)*8*.5+(b.heatingplant||0);},
  syncWorkers(s,id='home'){
    if(id!=='home')return;const w=s.game.workers,cap=this.jobs(s,id);
    for(const job of ['servicebuilder','waterworker','pharmacist','heatingworker','windworker','precisionworker','electronicsworker','guard','expeditionworker','roboticist','aerospaceworker','biosystemworker','missionworker'])if(cap[job]||Object.hasOwn(w,job))w[job]=Math.min(w[job]||0,cap[job]||0);
  },
  capacityBonus(s,id='home'){return (this.data(s,id)?.buildings.densehousing||0)*160;},
  labor(s,id,job){
    const w=this.workers(s,id)||{},cap=this.jobs(s,id)[job]||0,other=Object.entries(w).filter(([key])=>key!==job).reduce((sum,[,n])=>sum+n,0);
    return Math.max(0,Math.min(w[job]||0,cap,CivilPopulation.workforce(this.cohorts(s,id))-other));
  },
  publicServices(s,id){
    const w=this.workers(s,id)||{},b=id==='home'?s.game.buildings:s.civilization.municipal?.nodes[id]?.buildings||{};
    return !!(id==='home'?b.publicclinic&&b.publicschool:b.clinic&&b.school&&b.farmland)&&(w.medic||0)>0&&(w.teacher||0)>0;
  },
  waterCapacity(s,id='home'){
    const e=this.data(s,id)?.economy,t=s.civilization.elapsed;
    return e&&e.at<=t&&t<=e.at+10?e.waterCapacity:0;
  },
  facilityGate(s,id,type){
    const d=CivilServiceContent.facilities[type],m=this.data(s,id);
    if(!Object.hasOwn(CivilServiceContent.facilities,type)||!d||d.discover&&!d.discover(s)||d.homeOnly&&id!=='home'||d.node&&d.node!==id||!this.validNode(s,id)||!this.permitted(s,id)||(m?.buildings[type]||0)>=d.max||!d.requires.every(k=>s.civilization.tech[k]))return false;
    if(type==='railfreight')return CivilNation.operational(s)&&CivilRegions.upgrade(s,id)?.status==='complete';
    if(type==='foreigncaravan')return !!CivilCommerce.data(s)&&!CivilCommerce.agreementReason(s);
    if(type==='guardpost')return !!CivilSecurity.data(s)&&CivilNation.operational(s);
    if(d.paidWork)return id==='home'?!!s.civilization.urban?.city:!!s.civilization.municipal?.nodes[id]?.town;
    if(type==='pharmacy')return this.publicServices(s,id);
    if(type==='windstation')return id==='home'?!!s.civilization.urban?.city:!!s.civilization.municipal?.nodes[id]?.town;
    if(type==='heatingplant')return this.publicServices(s,id)&&(id==='home'||!!s.civilization.municipal?.nodes[id]?.town);
    if(type==='irrigationworks')return !!m?.buildings.waterfield;
    if(type==='densehousing')return this.publicServices(s,id)&&this.health(s,id)>=60&&this.waterCapacity(s,id)+1e-8>=this.population(s,id)+d.beds;
    return true;
  },
  pay(st,cost){if(Object.entries(cost).some(([k,n])=>(st[k]||0)+1e-8<n))return false;for(const [k,n]of Object.entries(cost))st[k]=Math.max(0,(st[k]||0)-n);return true;},
  startProject(s,id,type){
    if(!this.projectAvailable(s,id)||!this.facilityGate(s,id,type))return false;
    const d=CivilServiceContent.facilities[type];
    if(id==='home'&&!this.pay(s.stores,d.cost))return false;
    this.init(s);const all=s.civilization.services.nodes,m=all[id]||(all[id]={buildings:{},nextProject:1,project:null,completed:[],manualWater:false,economy:null,water:null,irrigation:null});
    m.project={id:m.nextProject++,type,status:id==='home'?'building':'supplying',required:{...d.cost},buffer:{},receipts:[],remaining:id==='home'?d.duration:0,startedAt:s.civilization.elapsed,lastWorkedAt:s.civilization.elapsed};
    if((['passengerfleet','heatingplant','windstation'].includes(type)||d.paidWork)){m.project.paid=id==='home'?{...d.cost}:null;m.project.workedSeconds=0;}
    this.syncWorkers(s,id);return true;
  },
  nextCargo(s,id,capacity){
    const p=this.data(s,id)?.project;if(id==='home'||p?.status!=='supplying'||CivilServiceContent.facilities[p.type]?.homeOnly||!Number.isFinite(capacity)||capacity<=0)return null;
    const inflight={};for(const ship of s.civilization.regions.shipments)if(ship.purpose==='services'&&ship.route===id&&ship.serviceProjectId===p.id&&ship.phase==='outbound')for(const [k,n]of Object.entries(ship.cargo))inflight[k]=(inflight[k]||0)+n;
    let room=Math.min(capacity,s.civilization.regions.routes[id]?.capacity||64);const cargo={};
    for(const [k,required]of Object.entries(p.required)){const n=Math.min(room,Math.max(0,required-(p.buffer[k]||0)-(inflight[k]||0)),s.stores[k]||0);if(n>0){cargo[k]=n;room-=n;}}
    return Object.keys(cargo).length?{projectId:p.id,cargo}:null;
  },
  receiveCargo(s,id,cargo,projectId){
    const p=this.data(s,id)?.project;if(id==='home'||p?.id!==projectId||p.status!=='supplying'||CivilServiceContent.facilities[p.type]?.homeOnly)return false;
    const shipment=s.civilization.regions.shipments.find(x=>x.route===id&&x.serviceProjectId===p.id&&x.purpose==='services'&&x.cargo===cargo&&x.phase==='outbound'&&x.source==='home'&&x.target===id&&x.status==='moving'&&x.remaining===0);
    if(!shipment||p.receipts.includes(shipment.id)||!Object.keys(cargo).length||Object.entries(cargo).some(([k,n])=>!Number.isFinite(n)||n<=0||!Object.hasOwn(p.required,k)||(p.buffer[k]||0)+n>p.required[k]+1e-8))return false;
    for(const [k,n]of Object.entries(cargo))p.buffer[k]=(p.buffer[k]||0)+n;p.receipts.push(shipment.id);
    if(Object.entries(p.required).every(([k,n])=>(p.buffer[k]||0)+1e-8>=n)){this.pay(p.buffer,p.required);if((['heatingplant','windstation'].includes(p.type)||CivilServiceContent.facilities[p.type].paidWork))p.paid={...p.required};p.status='building';p.remaining=CivilServiceContent.facilities[p.type].duration;p.lastWorkedAt=s.civilization.elapsed;}
    return true;
  },
  validShipment(s,ship){
    const m=this.data(s,ship?.route);if(!m||ship.purpose!=='services'||!Number.isInteger(ship.serviceProjectId)||ship.serviceProjectId<1)return false;
    const p=m.project?.id===ship.serviceProjectId?m.project:null,old=m.completed.find(x=>x.id===ship.serviceProjectId),type=p?.type||old?.type;if(!type||CivilServiceContent.facilities[type]?.homeOnly)return false;
    if(ship.phase==='empty')return ship.source===ship.route&&ship.target==='home'&&Object.values(ship.cargo).every(n=>n===0);
    if(!p||p.status!=='supplying'||!['outbound','returning'].includes(ship.phase))return false;
    if(ship.phase==='outbound'&&(ship.source!=='home'||ship.target!==ship.route)||ship.phase==='returning'&&(ship.source!=='home'||ship.target!=='home'))return false;
    const cost=CivilServiceContent.facilities[type].cost;
    return Object.entries(ship.cargo).every(([k,n])=>Object.hasOwn(cost,k)&&Number.isFinite(n)&&n>=0&&n+(p.buffer[k]||0)<=cost[k]+1e-8);
  },
  setManualWater(s,id,value){const m=this.data(s,id);if(!m||typeof value!=='boolean')return false;m.manualWater=value;return true;},
  // One payment produces water for exactly the following 10-second agricultural settlement.
  // Consuming this certificate never reuses the electricity that powered its pump.
  nextSettlementAt(s,id='home'){const t=s.civilization.elapsed,w=this.data(s,id)?.water;if(w&&w.usableAt>t&&w.usableAt<=t+10)return w.usableAt;const clock=s.civilization.productionClock||0;return t+10-(clock>=0&&clock<10?clock:0);},
  begin(s,id='home'){
    const m=this.data(s,id),w=m?.water,t=s.civilization.elapsed;
    if(!w||w.consumed||t!==w.usableAt){if(m&&m.irrigation?.at!==t)m.irrigation={at:t,waterCapacity:0};return {waterCapacity:0,at:t};}
    w.consumed=true;m.irrigation={waterCapacity:w.capacity,at:t};return {...m.irrigation};
  },
  // Pure: repeated rate/tooltips read this settlement's consumed water, even after run issues the next certificate.
  farmRate(s,id='home',service){const m=this.data(s,id),e=service||m?.irrigation;return m?.buildings.irrigationworks&&e?.at===s.civilization.elapsed&&e.waterCapacity>0&&e.waterCapacity>=this.population(s,id)?2:1.4;},
  // The sole power owner supplies a paid-run callback and the remaining instantaneous capacity.
  // Callback output is final (already multiplied by factor); it returns the actual number of paid runs.
  run(s,id,{factor=1,run,powerAvailable=0}){
    const m=this.data(s,id),empty={used:0,demand:0,waterCapacity:0,medicine:0};
    if(!m||!this.permitted(s,id)||typeof run!=='function')return empty;
    const t=s.civilization.elapsed;if(m.economy?.at===t)return empty;
    let power=Math.max(0,powerAvailable),used=0,water=0,demand=0;
    const waterWorkers=this.labor(s,id,'waterworker'),stations=m.buildings.waterworks||0;
    // Manual mode assigns eight actual adults per station, and produces half the water.
    const wanted=Math.min(stations,Math.floor(waterWorkers/(m.manualWater?8:4)));
    demand+=m.manualWater?0:wanted*4;
    const requests=m.manualWater?wanted:Math.min(wanted,Math.floor((power+1e-8)/4));
    const paid=requests?run('waterworker',requests,{chemicals:.2,parts:.02},{}):0;
    water=paid*(m.manualWater?300:600);used=paid*(m.manualWater?0:4);power-=used;
    const pharmacists=this.labor(s,id,'pharmacist');demand+=pharmacists*.5;
    const doses=Math.min(pharmacists,Math.floor((power+1e-8)/.5));
    const made=doses?run('pharmacist',doses,{food:.2,chemicals:.15},{medicine:.4*factor}):0;
    used+=made*.5;power-=made*.5;const medicine=made*.4*factor;
    if(typeof CivilHeating!=='undefined'&&CivilHeating.run){
      const heat=CivilHeating.run(s,id,{run,powerAvailable:power});
      if(!Number.isFinite(heat.used)||heat.used<0||heat.used>power+1e-8||!Number.isFinite(heat.demand)||heat.demand<heat.used||heat.demand>(m.buildings.heatingplant||0))throw Error('供热电力预算无效');
      used+=heat.used;demand+=heat.demand;power-=heat.used;
    }
    m.economy={at:t,waterCapacity:water,medicine,used,demand};
    m.water={issuedAt:t,usableAt:t+10,validUntil:t+10,capacity:water,consumed:false};
    return {used,demand,waterCapacity:water,medicine};
  },
  tick(s){
    for(const [id,m]of Object.entries(s.civilization.services?.nodes||{})){
      this.syncWorkers(s,id);const p=m.project,t=s.civilization.elapsed;if(p?.status!=='building'||p.lastWorkedAt>=t)continue;
      // Even a stalled project records this attempt; loading or calling twice cannot grant work.
      p.lastWorkedAt=t;
      if(!this.permitted(s,id)||this.health(s,id)<30||this.labor(s,id,id==='home'?'servicebuilder':'builder')<2)continue;
      if(p.type==='passengerfleet'&&(id!=='home'||s.civilization.hunger>0))continue;
      if(p.type==='densehousing'&&(!this.publicServices(s,id)||this.waterCapacity(s,id)+1e-8<this.population(s,id)+160))continue;
      p.remaining=Math.max(0,p.remaining-1);
      if((['passengerfleet','heatingplant','windstation'].includes(p.type)||CivilServiceContent.facilities[p.type].paidWork))p.workedSeconds++;
      if(!p.remaining){p.status='complete';m.buildings[p.type]=(m.buildings[p.type]||0)+1;const record={id:p.id,type:p.type,completedAt:t};if((['passengerfleet','heatingplant','windstation'].includes(p.type)||CivilServiceContent.facilities[p.type].paidWork))Object.assign(record,{paid:{...p.paid},workedSeconds:p.workedSeconds,startedAt:p.startedAt,lastWorkedAt:p.lastWorkedAt});if((['heatingplant','windstation'].includes(p.type)||CivilServiceContent.facilities[p.type].paidWork))record.receipts=[...p.receipts];m.completed.push(record);this.syncWorkers(s,id);if(id!=='home'&&typeof CivilMunicipal!=='undefined')CivilMunicipal.planWorkers(s,id);if(p.type==='heatingplant'&&typeof CivilHeating!=='undefined')CivilHeating.ensure(s,id);this.note(CivilServiceContent.facilities[p.type].name+'已经建成。居民接管了新的设施。');}
    }
    return {storesChanged:false,populationChanged:false};
  },
  note(message){if(typeof Civilization!=='undefined'&&Civilization.notify)Civilization.notify(message);},
  reset(){},
  refresh(){
    const s=State,fac=CivilServiceContent.facilities;
    for(const [id,parent]of [['home','#urbanPanel'],[typeof CivilMunicipal!=='undefined'?CivilMunicipal.selected:null,'#municipalPanel']]){
      const prefix=parent==='#urbanPanel'?'home':'local',rootId='services_'+prefix;let box=$('#'+rootId);
      const visible=id&&this.validNode(s,id)&&$(parent).length&&Object.values(fac).some(d=>(!d.discover||d.discover(s))&&(!d.homeOnly||id==='home')&&(!d.node||d.node===id)&&d.requires.every(k=>s.civilization.tech[k]));
      if(!visible){box.hide();continue;}
      if(!box.length){box=$('<div>').attr('id',rootId).css({marginTop:'20px',width:'410px'}).appendTo(parent);$('<div>').attr('id',rootId+'_status').css({lineHeight:'1.8',marginBottom:'12px'}).appendTo(box);$('<div>').attr('id',rootId+'_build').appendTo(box);}
      box.show();const m=this.data(s,id),p=m?.project,e=m?.economy;
      const fmt=cost=>Object.entries(cost).map(([key,n])=>_(key)+' '+Number(n.toFixed(2))).join('、');
      const buildings=Object.entries(m?.buildings||{}).filter(([,n])=>n).map(([type,n])=>fac[type].name+' '+n).join('，');
      $('#'+rootId+'_status').text((buildings?buildings+'。':'')+(e?'近轮供水 '+this.waterCapacity(s,id)+' 人份；药剂产出 '+Number(e.medicine.toFixed(2))+'；公用负载 '+e.used+' / '+e.demand+'。':'')+(p&&p.status!=='complete'?fac[p.type].name+'：'+(p.status==='supplying'?'材料分批运输，已到 '+(fmt(p.buffer)||'暂无')+'；需 '+fmt(p.required):'施工剩余 '+Math.ceil(p.remaining)+' 秒，需要2位'+(id==='home'?'营建工':'当地建设者'))+'。':''));
      for(const [type,d]of Object.entries(fac)){
        const buttonId=rootId+'_'+type;const show=(!d.discover||d.discover(s))&&(!d.homeOnly||id==='home')&&(!d.node||d.node===id)&&d.requires.every(k=>s.civilization.tech[k])&&(m?.buildings[type]||0)<d.max;
        if(!show){$('#'+buttonId).hide();continue;}
        const button=Civilization.button(buttonId,d.name,'#'+rootId+'_build',()=>{const target=prefix==='home'?'home':CivilMunicipal.selected,ok=target!=='home'&&typeof CivilPlanning!=='undefined'?CivilPlanning.request(State,target,'services',type):this.startProject(State,target,type);if(ok){if(target==='home'&&typeof Outside!=='undefined')Outside.updateWorkersView();Engine.saveGame();if(Civilization.refresh)Civilization.refresh();else this.refresh();}});
        const queue=id!=='home'&&typeof CivilPlanning!=='undefined'&&CivilPlanning.queueMode(s,id);if(typeof CivilPlanning!=='undefined')CivilPlanning.caption(button,(queue?'排入：':'')+d.name);
        button.show();Button.setDisabled(button,queue?!CivilPlanning.canQueue(s,id,'services',type):!this.projectAvailable(s,id)||!this.facilityGate(s,id,type)||id==='home'&&!Object.entries(d.cost).every(([k,n])=>(s.stores[k]||0)+1e-8>=n));
        if(type==='heatingplant')button.attr('aria-label',(queue?'排入：供热站':'建设供热站')+'，完工后需安排供热工与持续燃料');
        button.attr('title',fmt(d.cost)+'；2名实际成人施工 '+d.duration+' 秒。'+(id==='home'?'本地先支付全额材料，请在顶栏本地城镇页安排营建工。':'材料由货车分批运到，当地居民负责施工。')+(type==='densehousing'?'完工增加160床；需实际公共诊疗、教学和现人口再加160人的供水。':type==='irrigationworks'?'仅改造水务田片；下一轮实际供水足够时，每位新农夫产2粮，缺水恢复1.4粮。':type==='districtschool'?'完工后可安排12名教师，每人照看20名儿童，教学仍需木料。':type==='passengerfleet'?'完工增加2个运输工岗位；迁居大队每次出动需要4名运输工。施工时需保证居民口粮。':type==='windstation'?'每组2名风机值守，额定12电；每位每10秒维护耗0.04零件，实际出力随当地风况变化，无风停机。须保留备用电源。':type==='heatingplant'?'每站电动2名供热工，10秒实耗1电、0.8煤与0.02零件，供600人；手动4人耗1.2煤与0.02零件，供300人。试运行覆盖全体居民后可交接日常供暖。':''));
        if(d.hint)button.attr('title',button.attr('title')+' '+d.hint);
        if(queue)button.attr('title',button.attr('title')+' 加入后续计划，按顺序启动，不预扣材料。');
      }
      const manualId=rootId+'_manual';
      if(m?.buildings.waterworks){const button=Civilization.button(manualId,m.manualWater?'恢复电动水务':'安排手动水务','#'+rootId+'_build',()=>{const target=prefix==='home'?'home':CivilMunicipal.selected;this.setManualWater(State,target,!this.data(State,target).manualWater);Engine.saveGame();this.refresh();});button.show();button.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(m.manualWater?'恢复电动水务':'安排手动水务'));button.attr('title','每站电动：4水务工、4电，供600人；手动：8水务工，供300人。两种方式每轮都需0.2化学品、0.02零件。');}else $('#'+manualId).hide();
    }
  },
  validate(s){
    const r=s.civilization.services;if(r===undefined)return;
    const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),num=(v,max=1e8)=>Number.isFinite(v)&&v>=0&&v<=max,int=(v,max=1e8)=>Number.isInteger(v)&&num(v,max),t=s.civilization.elapsed,fac=CivilServiceContent.facilities;
    const validPaidWork=(x,complete)=>{
      const d=fac[x.type];
      return obj(x.paid)&&Object.keys(x.paid).length===Object.keys(d.cost).length&&Object.entries(d.cost).every(([k,n])=>x.paid[k]===n)&&int(x.startedAt,t)&&int(x.lastWorkedAt,t)&&x.lastWorkedAt>=x.startedAt&&int(x.workedSeconds,d.duration)&&x.workedSeconds<=x.lastWorkedAt-x.startedAt&&(complete?x.workedSeconds===d.duration&&x.lastWorkedAt===x.completedAt:x.workedSeconds+x.remaining===d.duration);
    };
    const validHeatReceipts=(x,id)=>Array.isArray(x.receipts)&&new Set(x.receipts).size===x.receipts.length&&(id==='home'?x.receipts.length===0:x.receipts.length>0)&&x.receipts.every(n=>int(n)&&n>0&&n<s.civilization.regions.nextShipment);
    if(!obj(r)||r.schema!==1||!obj(r.nodes)||Object.keys(r.nodes).length>4)throw Error('公用服务状态无效');
    for(const [id,m]of Object.entries(r.nodes)){
      if(!this.validNode(s,id)||!obj(m)||!obj(m.buildings)||!Array.isArray(m.completed)||m.completed.length>Object.values(fac).reduce((sum,d)=>sum+d.max,0)||!int(m.nextProject)||m.nextProject<1||typeof m.manualWater!=='boolean')throw Error('公用设施记录无效');
      const counts={},ids=new Set();
      for(const [index,x]of m.completed.entries()){if(!obj(x)||!int(x.id,m.nextProject-1)||x.id<1||ids.has(x.id)||!Object.hasOwn(fac,x.type)||fac[x.type].homeOnly&&id!=='home'||fac[x.type].node&&fac[x.type].node!==id||!num(x.completedAt,t))throw Error('公用工程竣工记录无效');if(x.type==='passengerfleet'&&(!s.civilization.tech.passenger_transport||!validPaidWork(x,true)||index>0&&x.startedAt<m.completed[index-1].completedAt))throw Error('迁居装备缺少实付材料或施工记录');if((['heatingplant','windstation'].includes(x.type)||fac[x.type].paidWork)&&(!fac[x.type].requires.every(k=>s.civilization.tech[k])||!validPaidWork(x,true)||!validHeatReceipts(x,id)||index>0&&x.startedAt<m.completed[index-1].completedAt))throw Error('能源设施缺少实付材料或施工记录');ids.add(x.id);counts[x.type]=(counts[x.type]||0)+1;}
      for(const [type,n]of Object.entries(m.buildings))if(!Object.hasOwn(fac,type)||fac[type].homeOnly&&id!=='home'||fac[type].node&&fac[type].node!==id||!int(n,fac[type].max)||n!==(counts[type]||0))throw Error('公用设施不能凭空增加');
      for(const [type,n]of Object.entries(counts))if(n!==m.buildings[type])throw Error('公用设施缺少竣工记录');
      const p=m.project;
      if(p!==null){
        const d=obj(p)&&Object.hasOwn(fac,p.type)&&fac[p.type];
        if(!d||d.homeOnly&&id!=='home'||d.node&&d.node!==id||!int(p.id,m.nextProject-1)||p.id<1||p.id!==m.nextProject-1||!['supplying','building','complete'].includes(p.status)||!obj(p.required)||!obj(p.buffer)||!Array.isArray(p.receipts)||new Set(p.receipts).size!==p.receipts.length||p.receipts.some(x=>!int(x)||x<1||x>=s.civilization.regions.nextShipment)||!num(p.startedAt,t)||!num(p.lastWorkedAt,t)||p.lastWorkedAt<p.startedAt||!num(p.remaining,d.duration))throw Error('公用工程事务无效');
        if(Object.keys(p.required).length!==Object.keys(d.cost).length||Object.entries(d.cost).some(([k,n])=>p.required[k]!==n)||Object.entries(p.buffer).some(([k,n])=>!Object.hasOwn(d.cost,k)||!num(n,d.cost[k])))throw Error('公用工程材料无效');
        if(p.status==='supplying'&&(id==='home'||p.remaining!==0||ids.has(p.id))||p.status==='building'&&(p.remaining<=0||ids.has(p.id)||Object.values(p.buffer).some(n=>n!==0))||p.status==='complete'&&(p.remaining!==0||!ids.has(p.id)||m.completed.find(x=>x.id===p.id)?.type!==p.type||Object.values(p.buffer).some(n=>n!==0)))throw Error('公用工程进度无效');
        if(id==='home'&&p.receipts.length)throw Error('本地工程不能借用运材回执');
        if(p.type==='passengerfleet'){
          if(!s.civilization.tech.passenger_transport||!validPaidWork(p,false)||Object.keys(p.buffer).length||p.status!=='complete'&&((m.buildings.passengerfleet||0)>=d.max||m.completed.length>0&&p.startedAt<m.completed[m.completed.length-1].completedAt))throw Error('迁居装备施工记录无效');
          if(p.status==='complete'){const x=m.completed.find(x=>x.id===p.id);if(x.startedAt!==p.startedAt||x.lastWorkedAt!==p.lastWorkedAt||x.workedSeconds!==p.workedSeconds||Object.entries(p.paid).some(([k,n])=>x.paid[k]!==n))throw Error('迁居装备与竣工资产不符');}
        }
        if((['heatingplant','windstation'].includes(p.type)||CivilServiceContent.facilities[p.type].paidWork)){
          if(!d.requires.every(k=>s.civilization.tech[k])||(p.status==='supplying'?p.paid!==null||p.workedSeconds!==0:!validPaidWork(p,false)||!validHeatReceipts(p,id)))throw Error('能源设施施工记录无效');
          if(p.status!=='complete'&&((m.buildings[p.type]||0)>=d.max||m.completed.length>0&&p.startedAt<m.completed[m.completed.length-1].completedAt))throw Error('能源设施施工顺序无效');
          if(p.status==='complete'){const x=m.completed.find(x=>x.id===p.id);if(x.startedAt!==p.startedAt||x.lastWorkedAt!==p.lastWorkedAt||x.workedSeconds!==p.workedSeconds||Object.entries(p.paid).some(([k,n])=>x.paid[k]!==n)||JSON.stringify(x.receipts)!==JSON.stringify(p.receipts))throw Error('能源设施与竣工资产不符');}
        }
        if(id!=='home'&&p.status!=='complete'&&([s.civilization.municipal?.nodes[id]?.project,s.civilization.regions?.projects[id]].some(x=>['supplying','building'].includes(x?.status))||typeof CivilRegions!=='undefined'&&CivilRegions.upgradeActive&&CivilRegions.upgradeActive(s,id)))throw Error('地方建设者不能同时施工');
      }
      if(m.nextProject!==m.completed.length+(p&&p.status!=='complete'?1:0)+1||m.completed.some((x,index)=>x.id!==index+1))throw Error('公用工程序号无效');
      if(m.economy!==null){const e=m.economy;if(!obj(e)||!num(e.at,t)||!num(e.waterCapacity,(m.buildings.waterworks||0)*600)||!num(e.medicine,(m.buildings.pharmacy||0)*8*.4*2)||!num(e.used,1000)||!num(e.demand,1000)||e.used>e.demand+1e-8)throw Error('公用服务本轮记录无效');}
      if(m.water!==null){const w=m.water;if(!obj(w)||!num(w.issuedAt,t)||w.usableAt!==w.issuedAt+10||w.validUntil!==w.usableAt||!num(w.capacity,(m.buildings.waterworks||0)*600)||typeof w.consumed!=='boolean'||!m.economy||m.economy.at!==w.issuedAt||m.economy.waterCapacity!==w.capacity||w.consumed&&t<w.usableAt)throw Error('供水凭证无效');}
      if(m.irrigation!==null&&(!obj(m.irrigation)||!num(m.irrigation.at,t)||!num(m.irrigation.waterCapacity,(m.buildings.waterworks||0)*600)))throw Error('农业用水记录无效');
      if((m.economy===null)!==(m.water===null))throw Error('供水与实际运行记录不符');
    }
  }
};
