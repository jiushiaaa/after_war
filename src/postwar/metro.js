/* MPL-2.0 — Observed, locally supplied cities; no pooled inventory or registration bonus. */
var CivilMetro={
  pendingIds:['metroCharter','metroStatus'],
  init(s){if(s.civilization.metro!==undefined)return;if(this.pendingIds.includes(s.civilization.pending))throw Error('城市群议题缺少观察记录');s.civilization.metro={schema:1,introducedAt:s.civilization.elapsed,agreementId:null,members:[],samples:[],lastObservedAt:null,stableSince:null,stableSeconds:0,formedAt:null,formedAgreementId:null,formedMembers:[],formedStableSince:null,offered:false};},
  pendingFinal:new WeakMap(),
  data(s){return s.civilization.metro;},
  name(id){return id==='home'?'炉火城':CivilRegionContent[id]?.name||'地方';},
  agreement(s){return typeof CivilFinance!=='undefined'?CivilFinance.agreement(s):null;},
  economy(s,id){return id==='home'?s.civilization.urban?.economy:s.civilization.municipal?.nodes[id]?.economy;},
  stores(s,id){return id==='home'?s.stores:s.civilization.regions?.nodes[id]?.stores;},
  population(s,id){return id==='home'?s.game.population:s.civilization.regions?.nodes[id]?.population||0;},
  census(s,id){const groups=id==='home'?s.civilization.society.cohorts:s.civilization.regions.nodes[id].cohorts;return {population:this.population(s,id),foodPopulation:CivilPopulation.foodPopulation(groups),children:CivilPopulation.children(groups),workforce:CivilPopulation.workforce(groups)};},
  same(a,b){return !!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>Object.hasOwn(b,k)&&Math.abs(v-b[k])<1e-7);},
  sameMembers(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((id,i)=>id===b[i]);},
  coordinated(s,p,at,complete=false){
    if(!p||!Array.isArray(p.adminPayments))return false;
    const payments=p.adminPayments.filter(x=>x.at<=at),end=complete?p.endsAt:at+1;
    if(complete&&(p.closedAt!==p.endsAt||p.endsAt-p.startedAt!==600||payments.length!==60))return false;
    if(!payments.length)return !complete&&at<p.startedAt;
    const first=payments[0].at,last=payments.at(-1).at;
    // Actual production phase is independent of the period's approval second.
    if(first<p.startedAt||first>=p.startedAt+10||last>=end)return false;
    if(complete?last<p.endsAt-10:last!==at)return false;
    return payments.every((pay,i)=>!i||pay.at-payments[i-1].at===10);
  },
  previousFulfilled(s,a,at){
    const f=s.civilization.finance,index=Math.floor((at-a.approvedAt)/600),p=f.periods.find(p=>p.agreementId===a.id&&p.index===index-1);
    return !!p&&this.coordinated(s,p,p.endsAt-1,true)&&p.endsAt<=at&&!p.missed.length&&a.members.slice(1).every(id=>{const o=f.orders.find(o=>o.id===p.routeOrders[id]);return o?.status==='complete'&&o.returnedAt<=p.endsAt&&f.receipts.some(r=>r.orderId===o.id&&r.leg==='out'&&r.deliveredAt===o.deliveredAt)&&f.receipts.some(r=>r.orderId===o.id&&r.leg==='back'&&r.deliveredAt===o.returnedAt);});
  },
  financeCheck(s,at){
    const a=this.agreement(s),f=s.civilization.finance;if(!a||a.paused||a.exitedAt!==null)return '互助约定当前未运行';
    const current=CivilFinance.period(s,a);if(!current)return '当前互助周期尚待记录';
    const previous=f.periods.find(p=>p.agreementId===a.id&&p.index===current.index-1);
    if(!previous||!this.coordinated(s,previous,previous.endsAt-1,true))return '上一完整互助周期仍待连续记录';
    for(const id of a.members.slice(1)){
      const o=f.orders.find(o=>o.id===previous.routeOrders[id]);
      if(!o||o.status!=='complete'||o.returnedAt>previous.endsAt||!f.receipts.some(r=>r.orderId===o.id&&r.leg==='out'&&r.deliveredAt===o.deliveredAt)||!f.receipts.some(r=>r.orderId===o.id&&r.leg==='back'&&r.deliveredAt===o.returnedAt))return this.name(id)+'上一周期尚未按期履约';
    }
    if(previous.missed.length)return '上一周期仍有未履约事项';
    if(f.lastSettledAt!==at||!this.coordinated(s,current,at))return '本周期共同记录曾中断，等待下一完整周期';
    return null;
  },
  birthReserve(s,id){
    if(600-s.civilization.elapsed%600>300)return {food:0,medicine:0};
    const home=id==='home',owner=home?s.civilization.society:s.civilization.regions.nodes[id],cohorts=CivilPopulation.age(owner.cohorts).cohorts;
    const cap=home?CivilCatalog.capacity(s):CivilMunicipal.capacity(s,id),reserved=CivilUrban.reservedBeds(s,id),health=home?s.civilization.village.health:owner.health;
    return CivilPopulation.births(cohorts,{...(owner.births||{scaled:false,credit:0,mutantCredit:0})},{yearStartPopulation:this.population(s,id),beds:Math.max(0,cap-CivilPopulation.count(cohorts)-reserved),health,hunger:0,food:Number.MAX_SAFE_INTEGER,medicine:Number.MAX_SAFE_INTEGER}).cost;
  },
  reserve(s,id,forecast){
    const m=this.data(s),gross=forecast.paidInputs.resources,need={},exports=CivilRegions.committedFlow(s,id),birth=this.birthReserve(s,id);
    need.food=(id==='home'?CivilUrban.foodReserve(s):CivilMunicipal.foodReserve(s,id))*2.5+(birth.food||0);
    need.medicine=this.population(s,id)*.01*30+(birth.medicine||0);
    for(const key of ['tools','coal','parts','chemicals'])need[key]=Math.max(gross[key]||0,...m.samples.map(sample=>sample.nodes[id].resources[key]||0))*30;
    // Contract and travel obligations cannot spend the same protected stock.
    for(const [key,n]of Object.entries(exports))if(n<0)need[key]=(need[key]||0)-n*30;
    need.tools=Math.max(40,need.tools);need.iron=Math.max(40,need.iron||0);need.parts=Math.max(20,need.parts);
    return need;
  },
  forecastReady(s,id,f){
    if(typeof CivilHeating!=='undefined'&&f.copy&&!CivilHeating.covered(f.copy,id))return false;
    const home=id==='home',next=f.paidInputs?.at,copy=f.copy,e=home?null:copy.civilization.municipal.nodes[id].economy,service=copy.civilization.services?.nodes[id],power=home?copy.civilization.industry:copy.civilization.municipal.nodes[id].power;
    if(!Number.isFinite(next)||next<=s.civilization.elapsed||!power||power.used>power.generation+1e-8||service?.irrigation?.at!==next||service.irrigation.waterCapacity<this.population(s,id))return false;
    if(!home)return f.food>=-1e-8&&f.medicine>=-1e-8&&f.education&&f.treatment&&f.industry&&f.productivePower>=4&&e.treatmentInputs.resources.medicine+1e-8>=this.population(s,id)*.01;
    const commit=CivilRegions.committedFlow(s,'home'),flow=f.flow,pop=s.game.population,teachers=(flow['教师']?.knowledge||0)/(.2*CivilIndustry.factor(copy));
    return (f.deltas.food||0)+(commit.food||0)>=-1e-8&&(f.deltas.medicine||0)+(commit.medicine||0)>=-1e-8&&teachers*20+1e-8>=CivilPopulation.children(s.civilization.society.cohorts)&&f.treatmentInputs.resources.medicine+1e-8>=pop*.01&&(flow['医护']?.medicine||0)+(flow['药剂师']?.medicine||0)+1e-8>=pop*.01&&copy.civilization.society.service&&copy.civilization.regions.adminService&&power.productionPower>=4&&(flow['采矿工']?.ore||0)>0&&(flow['采煤工']?.coal||0)>0&&(flow['冶炼工']?.iron||0)>0;
  },
  check(s){
    const c=s.civilization,m=this.data(s),a=this.agreement(s),members=a?[...a.members]:[...(m?.formedMembers||[])],issues=[],reserves={},at=this.economy(s,'home')?.at;
    const result=()=>({ok:issues.length===0,reason:issues[0]?.message||null,reasons:issues.map(x=>x.message),issues,members,total:members.reduce((n,id)=>n+this.population(s,id),0),at:at??null,agreementId:a?.id??null,reserves});
    const fail=(code,message,nodeId)=>issues.push({code,message,...(nodeId?{nodeId}:{})});
    if(!m||!a||a.paused||a.exitedAt!==null){fail('agreement','先维持三地共同互助约定');return result();}
    if(members.length!==3||members[0]!=='home'||members.slice(1).some(id=>!CivilMunicipal.has(s,id))){fail('members','三地成员尚未登记齐全');return result();}
    if(!this.sameMembers(m.members,members)||m.agreementId!==a.id){fail('observations','新的互助成员正在等待生产记录');return result();}
    for(const id of members){const home=id==='home',node=home?null:c.regions.nodes[id],registered=home?c.urban.city:c.municipal.nodes[id].city;
      if(!registered)fail('city',this.name(id)+'尚未登记城市职责',id);
      if(this.population(s,id)<400)fail('population',this.name(id)+'尚未达到400位定居居民',id);
      const cap=home?CivilCatalog.capacity(s):CivilMunicipal.capacity(s,id);if(this.population(s,id)+CivilUrban.reservedBeds(s,id)>cap)fail('housing',this.name(id)+'的住房已预留不足',id);
      if(!home&&(!['associated','integrated'].includes(node.relation)||!(node.rights==='equal'||node.rights==='resident'&&c.elapsed-node.rightsSince>=600)))fail('rights',this.name(id)+'的共同资格仍待落实',id);
    }
    if(members.reduce((n,id)=>n+this.population(s,id),0)<3000)fail('total','三城实际定居人口尚未达到3000');
    if(issues.length)return result();
    if(!Number.isSafeInteger(at)||at>c.elapsed||c.elapsed-at>=10||members.some(id=>this.economy(s,id)?.at!==at)){fail('boundary','三城等待同一轮生产核验');return result();}
    if(m.samples.length!==3||m.samples.at(-1).at!==at||m.samples.some((x,i)=>i&&x.at-m.samples[i-1].at!==10)){fail('samples','正在收集连续三轮维护记录');return result();}
    for(const id of members)if(!this.same(m.samples.at(-1).nodes[id]?.census,this.census(s,id)))fail('census',this.name(id)+'的居民名册已变化，等待下一轮供养核验',id);
    if(issues.length)return result();
    const finance=this.financeCheck(s,at);if(finance)fail('budget',finance);
    if(!c.society.service||!c.regions.adminService||CivilRegions.load(s)>CivilRegions.capacity(s))fail('administration','三地公共行政或协调容量不足');
    const committedCrew=CivilRegions.reservedTransport(s)+CivilUrban.reservedTransport(s),actualCrew=Math.min(s.game.workers.transporter||0,CivilCatalog.jobCapacity(s,'transporter'));
    if(committedCrew>actualCrew)fail('crew','货运与客运的共同运输岗位尚有缺额');
    for(const id of members.slice(1))if(!CivilRegions.serviceReady(s,id)||id==='river'&&(!s.game.buildings.road||c.outpostSupplied!==true))fail('route',this.name(id)+'路线等待班组、通路或近期实到',id);
    for(const id of members){
      const home=id==='home',e=this.economy(s,id),service=c.services?.nodes[id],power=home?c.industry:c.municipal.nodes[id].power,pop=this.population(s,id);
      if(!e.paidInputs||e.paidInputs.at!==at||!e.treatmentInputs||e.treatmentInputs.at!==at||!Number.isFinite(e.treatmentInputs.resources.medicine)||e.treatmentInputs.resources.medicine+1e-8<pop*.01||!home&&(e.mealInputs?.at!==at||!Number.isFinite(e.mealInputs.resources.food)||e.mealInputs.resources.food+1e-8<this.census(s,id).foodPopulation*.12)){fail('treatment',this.name(id)+'本轮口粮或治疗付款尚不足',id);continue;}
      if(!(home?CivilUrban.developmentReady(s,true):CivilMunicipal.developmentReady(s,id,true))){fail('supply',this.name(id)+'本轮粮药、教学或工业供养尚未稳定',id);continue;}
      if(!service||service.economy?.at!==at||service.irrigation?.at!==at||service.irrigation.waterCapacity+1e-8<pop){fail('water',this.name(id)+'本轮实际供水尚未覆盖居民',id);continue;}
      const production=home?e.productionPower:e.productivePower;
      if(!power||!Number.isFinite(power.generation)||!Number.isFinite(power.used)||power.used<0||power.used>power.generation+1e-8||!Number.isFinite(production)||production<4||power.used+1e-8<production||service.economy.used>power.used+1e-8){fail('power',this.name(id)+'本地供电或实际机械用电不足',id);continue;}
      const f=home?CivilUrban.forecast(s):CivilMunicipal.forecast(s,id);
      if(!f.paidInputs?.resources||!this.forecastReady(s,id,f)){fail('forecast',this.name(id)+'下一轮粮药、水务或工业投入不足',id);continue;}
      const need=reserves[id]=this.reserve(s,id,f),store=this.stores(s,id);
      for(const [key,amount]of Object.entries(need))if((store[key]||0)+1e-8<amount){fail('reserve',this.name(id)+'须留下300秒'+_(key)+'与已承诺支出',id);break;}
    }
    return result();
  },
  observe(s){
    this.init(s);const m=this.data(s),a=this.agreement(s),at=s.civilization.elapsed;
    if(!a){m.agreementId=null;m.members=[];m.samples=[];m.lastObservedAt=null;m.stableSince=null;m.stableSeconds=0;return false;}
    if(m.agreementId!==a.id||!this.sameMembers(m.members,a.members)){m.agreementId=a.id;m.members=[...a.members];m.samples=[];m.lastObservedAt=null;m.stableSince=null;m.stableSeconds=0;}
    if(m.lastObservedAt!==null&&at<=m.lastObservedAt)return false;
    this.pendingFinal.delete(s);const previous=m.lastObservedAt,nodes={};
    for(const id of m.members){const e=this.economy(s,id);if(!e||e.at!==at||e.paidInputs?.at!==at){m.samples=[];m.lastObservedAt=at;m.stableSince=null;m.stableSeconds=0;return false;}nodes[id]={census:this.census(s,id),resources:{...e.paidInputs.resources}};}
    if(previous!==null&&at-previous!==10){m.samples=[];m.stableSince=null;m.stableSeconds=0;}
    m.samples.push({at,nodes});m.samples=m.samples.slice(-3);m.lastObservedAt=at;
    const state=this.check(s),ready=state.ok;
    if(!ready&&state.issues.length&&state.issues.every(x=>x.code==='budget'))this.pendingFinal.set(s,{at,agreementId:a.id,previous,stableSince:m.stableSince,stableSeconds:m.stableSeconds});
    if(!ready){m.stableSince=null;m.stableSeconds=0;}
    else if(m.stableSince!==null&&previous!==null&&at-previous===10)m.stableSeconds=Math.min(600,m.stableSeconds+10);
    else {m.stableSince=at;m.stableSeconds=0;}
    return ready;
  },
  finalize(s){
    const pending=this.pendingFinal.get(s);if(!pending)return false;this.pendingFinal.delete(s);
    const m=this.data(s),a=this.agreement(s);if(pending.at!==s.civilization.elapsed||!m||!a||a.id!==pending.agreementId||a.paused||m.lastObservedAt!==pending.at||this.financeCheck(s,pending.at))return false;
    if(pending.stableSince!==null&&pending.previous!==null&&pending.at-pending.previous===10){m.stableSince=pending.stableSince;m.stableSeconds=Math.min(600,pending.stableSeconds+10);}
    else {m.stableSince=pending.at;m.stableSeconds=0;}return true;
  },
  canRegister(s){const m=this.data(s),x=s.civilization.society;return !!m&&m.formedAt===null&&m.stableSeconds>=600&&!!x?.governed&&!x.succession&&!x.reforming&&!s.civilization.finance?.revision&&this.check(s).ok;},
  register(s){if(!this.canRegister(s))return false;const m=this.data(s);m.formedAt=s.civilization.elapsed;m.formedAgreementId=m.agreementId;m.formedMembers=[...m.members];m.formedStableSince=m.stableSince;return true;},
  nextEvent(s){return !this.data(s)?.offered&&this.canRegister(s)?'metroCharter':null;},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,m=this.data(s);if(!m)return null;const state=this.check(s);
    if(id==='metroCharter')return {title:'三城的共同职责',text:['三城的诊疗、课堂、田地与工坊，已连续维持了共同约定。道路上的物资按仓交付，代表们带来了各自的公共记录。','他们准备把城市群的共同职责写入这一代与下一代都能查阅的账册。'],buttons:{register:{text:'登记城市群共同职责',nextScene:'end',onChoose:()=>{const ok=this.register(s);m.offered=true;return done(ok?'三城登记了城市群的共同职责。居民、仓库与地方议事仍由原有记录继续管理。':'供养或议事条件已有变化，下一轮核验后再商议。')();}},later:{text:'继续核对账册',nextScene:'end',onChoose:()=>{m.offered=true;return done('代表们继续核对三城的供养与运输记录。')();}}}};
    return {title:'三城公共记录',text:[state.members.length?state.members.map(id=>this.name(id)+' '+this.population(s,id)+'人').join('；')+'。':'先建立三地互助约定。','定居人口 '+state.total+' / 3000；连续稳定 '+m.stableSeconds+' / 600秒。',m.formedAt!==null?'共同职责已登记，三城仍须继续维持日常供养。':state.ok?'当前供养正常，代表继续观察。':state.reason||'等待下一轮核验。'],buttons:{close:{text:'合上记录',nextScene:'end',onChoose:done('公共记录留在议事屋，供下一次核对。')}}};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;const s=State,m=this.data(s),a=this.agreement(s),visible=!!m&&(m.formedAt!==null||a&&a.members.slice(1).some(id=>s.civilization.municipal?.nodes[id]?.city));
    if(!visible){$('#metroButton').hide();$('#metroSummary').hide();return;}
    const status=this.check(s),button=Civilization.button('metroButton','核对三城职责','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending=this.canRegister(State)?'metroCharter':'metroStatus';Civilization.showPending();});button.show();
    let summary=$('#metroSummary');if(!summary.length)summary=$('<div>').attr('id','metroSummary').css({lineHeight:'1.8',width:'420px',maxWidth:'100%',marginTop:'12px'}).appendTo('#councilPanel');summary.show().text('三城定居 '+status.total+' / 3000，连续稳定 '+m.stableSeconds+' / 600秒。'+(status.ok?'各地供养正在维持。':status.reason||'等待下一轮核验。'));
  },
  reset(){this.pendingFinal=new WeakMap();},
  validate(s){
    const m=this.data(s);if(m===undefined){if(this.pendingIds.includes(s.civilization.pending))throw Error('城市群议题缺少观察记录');return true;}
    const fail=()=>{throw Error('城市群观察记录无效');},obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),at=s.civilization.elapsed,time=x=>Number.isSafeInteger(x)&&x>=0&&x<=at,nullable=x=>x===null||time(x),members=x=>Array.isArray(x)&&(x.length===0||x.length===3&&x[0]==='home'&&new Set(x).size===3&&x.slice(1).every(id=>typeof id==='string'&&Object.hasOwn(s.civilization.regions?.nodes||{},id))),resources=x=>obj(x)&&Object.entries(x).every(([k,n])=>CivilCatalog.resources.includes(k)&&Number.isFinite(n)&&n>=0&&n<=1e8);
    if(!obj(m)||m.schema!==1||!time(m.introducedAt)||typeof m.offered!=='boolean'||!members(m.members)||!Array.isArray(m.samples)||m.samples.length>3||!nullable(m.lastObservedAt)||!nullable(m.stableSince)||!Number.isSafeInteger(m.stableSeconds)||m.stableSeconds<0||m.stableSeconds>600||m.stableSeconds%10||!nullable(m.formedAt)||!nullable(m.formedStableSince)||!members(m.formedMembers))fail();
    const agreement=id=>s.civilization.finance?.agreements.find(a=>a.id===id),a=m.agreementId===null?null:agreement(m.agreementId);
    if(m.agreementId!==null&&(!a||!this.sameMembers(m.members,a.members))||m.agreementId===null&&(m.members.length||m.samples.length||m.lastObservedAt!==null||m.stableSince!==null||m.stableSeconds))fail();
    if(m.lastObservedAt!==null&&m.lastObservedAt<m.introducedAt||m.stableSince!==null&&(m.lastObservedAt===null||m.stableSince<m.introducedAt+20||m.stableSince>m.lastObservedAt||m.stableSeconds!==Math.min(600,m.lastObservedAt-m.stableSince)||m.samples.length!==3||!this.previousFulfilled(s,a,m.stableSince))||m.stableSince===null&&m.stableSeconds)fail();
    for(let i=0;i<m.samples.length;i++){
      const sample=m.samples[i];if(!obj(sample)||!time(sample.at)||sample.at<m.introducedAt||i&&sample.at-m.samples[i-1].at!==10||!obj(sample.nodes)||!this.sameMembers(Object.keys(sample.nodes),m.members))fail();
      for(const id of m.members){const n=sample.nodes[id],c=n?.census;if(!obj(n)||!obj(c)||!Number.isSafeInteger(c.population)||c.population<0||!Number.isFinite(c.foodPopulation)||Math.abs(c.foodPopulation-(c.population-c.children/3))>1e-6||!Number.isSafeInteger(c.children)||c.children<0||c.children>c.population||!Number.isSafeInteger(c.workforce)||c.workforce<0||c.workforce>c.population-c.children||!resources(n.resources))fail();const e=this.economy(s,id);if(e?.at===sample.at&&e.paidInputs&&!this.same(n.resources,e.paidInputs.resources))fail();}
    }
    if(m.samples.length&&m.samples.at(-1).at!==m.lastObservedAt)fail();
    if(m.formedAt===null){if(m.formedAgreementId!==null||m.formedMembers.length||m.formedStableSince!==null)fail();}
    else {const formed=agreement(m.formedAgreementId);if(!formed||!this.sameMembers(m.formedMembers,formed.members)||m.formedStableSince===null||m.formedStableSince<m.introducedAt+20||m.formedAt-m.formedStableSince<600||!this.previousFulfilled(s,formed,m.formedStableSince)||formed.exitedAt!==null&&m.formedAt>formed.exitedAt)fail();}
    return true;
  }
};
