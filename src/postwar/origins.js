/* MPL-2.0 — Permanent source census, bounded emigration and source-owned support. */
var CivilOrigins={
  pendingIds:Object.keys(CivilOriginContent).flatMap(id=>['originContact','originAgreement'].map(kind=>kind+(id==='river_network'?'':'_'+id))),
  init(s){
    let r=s.civilization.origins;
    if(r!==undefined){
      // Only a valid one-source legacy save can introduce additional societies. A damaged
      // schema-2 save is never repaired by reissuing residents, assets or permits.
      if(r?.schema!==1)return;
      this.validate(s);const n=r.nodes.river_network;
      this.initSchool(n);this.initHousing(n);n.introducedAt=r.introducedAt;
      for(const d of Object.values(n.departures))if(d.target===undefined)d.target='home';
      if(r.contactTrip)r.contactTrip.lastWorkedAt=s.civilization.elapsed;
      for(const id of Object.keys(CivilOriginContent))if(id!=='river_network')r.nodes[id]=this.createNode(s,id);
      r.schema=2;for(const id of Object.keys(CivilOriginContent))if(id!=='river_network')this.assign(s,id);return;
    }
    r=s.civilization.origins={schema:2,introducedAt:s.civilization.elapsed,contactTrip:null,warned:false,nodes:{}};
    for(const id of Object.keys(CivilOriginContent))r.nodes[id]=this.createNode(s,id);
    for(const id of Object.keys(r.nodes))this.assign(s,id);
  },
  createNode(s,id){
    const cfg=CivilOriginContent[id];
    const year=Math.floor(s.civilization.elapsed/600),cohorts=[];
    for(let age=0;age<80;age++)for(const [identity,count]of Object.entries(cfg.initial(age)))if(count)cohorts.push({cohortId:id+'_initial_'+age+'_'+identity,age,count,identity,originId:id});
    const population=CivilPopulation.count(cohorts),meal=CivilPopulation.foodPopulation(cohorts)*.12;
    return {status:'unknown',introducedAt:s.civilization.elapsed,baselinePopulation:cfg.baseline,year,revision:0,cohorts,population,housing:cfg.housing,
      stores:{food:meal*12+1000,medicine:population*.01*12+50,tools:120,scrap:300,wood:200,knowledge:0},workers:{},health:80,hunger:0,
      births:{scaled:true,credit:0,mutantCredit:0},born:0,sourceDeaths:0,transitDeaths:0,admitted:0,
      permit:{limit:cfg.permit,paid:false},agreement:null,departures:{},announced:false,discarded:{},schooling:{schema:1,completed:[],project:null},legacyHousingOverflow:0};
  },
  discoverable(s,id='river_network'){return !!CivilOriginContent[id]?.discover(s);},
  visibleIds(s){return Object.keys(CivilOriginContent).filter(id=>s.civilization.origins?.nodes[id] && (s.civilization.origins.nodes[id].status!=='unknown' || this.discoverable(s,id)));},
  introducedAt(s,id){return s.civilization.origins.nodes[id].introducedAt ?? s.civilization.origins.introducedAt;},
  reservedLabor(){return 0;}, // Contact staff belong to the source; a town with no working adults can still answer.
  initSchool(n){if(n.schooling===undefined)n.schooling={schema:1,completed:[],project:null};},
  schoolCapacity(s,id){return CivilOriginContent[id].limits.teacher+(s.civilization.origins.nodes[id].schooling?.completed.length||0)*CivilOriginContent[id].school.places;},
  jobLimits(s,id){return {...CivilOriginContent[id].limits,teacher:this.schoolCapacity(s,id)};},
  schoolWorkReason(s,id){
    const n=s.civilization.origins.nodes[id],plan=this.plan(n.cohorts),limits=this.jobLimits(s,id),needed=Object.entries(plan).reduce((sum,[k,v])=>sum+Math.min(v,limits[k]),0),contact=s.civilization.origins.contactTrip?.source===id?2:0;
    if(n.health<60||n.hunger)return '先恢复来源居民的健康与口粮';
    if(CivilPopulation.workforce(n.cohorts)<needed+contact+2)return '来源先维持供养与教学，尚缺2名空余成年建设者';
    if((n.stores.food||0)+1e-8<CivilPopulation.foodPopulation(n.cohorts)*.12*12||(n.stores.medicine||0)+1e-8<n.population*.01*12)return '来源先备足120秒粮药，扩班暂缓';
    return null;
  },
  schoolBuilders(s,id){return s.civilization.origins.nodes[id].schooling?.project&&!this.schoolWorkReason(s,id)?2:0;},
  sourceStaff(s,id){return (s.civilization.origins?.contactTrip?.source===id && !this.contactWorkReason(s,id)?2:0)+this.schoolBuilders(s,id);},
  startSchool(s,id){
    const n=s.civilization.origins.nodes[id],cfg=CivilOriginContent[id].school;this.initSchool(n);const e=n.schooling;
    if(e.project||e.completed.length>=cfg.max||this.plan(n.cohorts).teacher<=this.schoolCapacity(s,id)||this.schoolWorkReason(s,id)||!this.pay(n.stores,cfg.cost))return false;
    e.project={startedAt:s.civilization.elapsed,lastWorkedAt:s.civilization.elapsed,remaining:cfg.duration,paid:{...cfg.cost}};this.assign(s,id);return true;
  },
  tickSchool(s,id){
    const n=s.civilization.origins.nodes[id],e=n.schooling;this.initSchool(n);
    if(!e?.project){this.startSchool(s,id);return;}
    const p=e.project,t=s.civilization.elapsed;if(p.lastWorkedAt>=t)return;p.lastWorkedAt=t;
    if(this.schoolBuilders(s,id)!==2)return;
    p.remaining=Math.max(0,p.remaining-1);
    if(!p.remaining){e.completed.push({startedAt:p.startedAt,completedAt:t,paid:{...p.paid}});e.project=null;this.assign(s,id);if(['contacted','agreed'].includes(n.status))this.note(CivilOriginContent[id].name+'用自己的材料建成了新课堂，增加10个教师岗位。');}
  },
  schoolStatus(s,id){
    const n=s.civilization.origins.nodes[id],e=n.schooling,cfg=CivilOriginContent[id].school,capacity=this.schoolCapacity(s,id),need=this.plan(n.cohorts).teacher;
    let text='学舍教师 '+(n.workers.teacher||0)+' / '+capacity+' 席，'+CivilPopulation.children(n.cohorts)+' 名儿童需要 '+need+' 位教师。';
    if(e?.project)return text+(this.schoolWorkReason(s,id)||'2名来源建设者正在扩班，还需 '+e.project.remaining+' 秒。');
    if(need>capacity&&(!e||e.completed.length<cfg.max)){const reason=this.schoolWorkReason(s,id);return text+(reason||(!this.canPay(n.stores,cfg.cost)?'扩班待备来源木料120、工具12、知识20。':'来源正在筹办扩班。'));}
    return text;
  },
  plan(cohorts){
    const p=CivilPopulation.count(cohorts),medic=Math.ceil(p*.01/.15)+2,teacher=Math.ceil(CivilPopulation.children(cohorts)/20);
    const farmer=Math.ceil((CivilPopulation.foodPopulation(cohorts)*.12+medic*.2)*1.15/1.4);
    const smith=Math.ceil(farmer*.01/.25)+1,salvager=Math.ceil((medic*.1+smith*.6)/.8)+1;
    return {farmer,medic,smith,salvager,teacher,gatherer:Math.ceil(teacher*.1+smith*.2)+1};
  },
  assign(s,id){
    const n=s.civilization.origins.nodes[id],plan=this.plan(n.cohorts),limits=this.jobLimits(s,id);
    let left=Math.max(0,CivilPopulation.workforce(n.cohorts)-this.sourceStaff(s,id));n.workers={};
    for(const job of ['farmer','medic','smith','salvager','gatherer','teacher']){const count=Math.min(left,limits[job],plan[job]);n.workers[job]=count;left-=count;}
  },
  canPay(stores,cost){return Object.entries(cost).every(([k,v])=>(stores[k]||0)+1e-8>=v);},
  pay(stores,cost){if(!this.canPay(stores,cost))return false;for(const [k,v]of Object.entries(cost))stores[k]=Math.max(0,(stores[k]||0)-v);return true;},
  settle(s){
    this.init(s);
    for(const [id,n]of Object.entries(s.civilization.origins.nodes)){
      this.assign(s,id);const st=n.stores,w=n.workers,factor=(n.health<30?.75:1)*(n.hunger>=30?.65:1);
      const run=(count,cost,output)=>{
        let batches=count;for(const [k,v]of Object.entries(cost))batches=Math.min(batches,Math.floor(((st[k]||0)+1e-8)/v));
        this.pay(st,Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,v*batches])));
        for(const [k,v]of Object.entries(output))st[k]=(st[k]||0)+v*batches*factor;
      };
      run(w.gatherer,{}, {wood:1});run(w.salvager,{}, {scrap:.8});
      run(w.smith,{wood:.2,scrap:.6},{tools:.25});run(w.farmer,{tools:.01},{food:1.4});
      const meal=CivilPopulation.foodPopulation(n.cohorts)*.12,ate=this.pay(st,{food:meal});
      if(!ate)st.food=0;n.hunger=ate?Math.max(0,n.hunger-20):n.hunger+10;
      run(w.medic,{food:.2,scrap:.1},{medicine:.15});run(w.teacher,{wood:.1},{knowledge:.2});
      const treated=w.medic>0 && this.pay(st,{medicine:n.population*.01});
      n.health=Math.max(0,Math.min(100,n.health+(ate && treated?.25:ate?-.15:-.5)));
      const caps={food:Math.max(100,meal*120),medicine:Math.max(20,n.population*.01*120),tools:5000,scrap:10000,wood:10000,knowledge:10000};
      for(const [k,cap]of Object.entries(caps))if((st[k]||0)>cap){n.discarded[k]=(n.discarded[k]||0)+st[k]-cap;st[k]=cap;}
    }
    return {}; // No source material or income is available to the home inventory.
  },
  contactWorkReason(s,id){
    const n=s.civilization.origins?.nodes[id];if(!n)return '尚未取得这条来源线索';
    if(n.health<60 || n.hunger)return '来源人员先恢复健康与口粮，联络暂缓';
    const needed=Object.values(this.plan(n.cohorts)).reduce((a,b)=>a+b,0);
    if(CivilPopulation.workforce(n.cohorts)<needed+2+this.schoolBuilders(s,id))return '来源须先维持供养与教学，联络尚缺2名空余成人';
    if((n.stores.food||0)+1e-8<CivilPopulation.foodPopulation(n.cohorts)*.12*12 || (n.stores.medicine||0)+1e-8<n.population*.01*12)return '来源先备足120秒粮药，联络暂缓';
    return null;
  },
  contactReason(s,id='river_network'){
    const r=s.civilization.origins,n=r?.nodes[id],cfg=CivilOriginContent[id];
    if(!n || !cfg || !this.discoverable(s,id))return '尚未取得这条来源线索';
    if(r.contactTrip)return r.contactTrip.source===id?this.contactWorkReason(s,id)||'联络人员仍在途中':'等待上一支联络队回来';
    if(n.status!=='unknown')return '这条来源已经取得联系';
    return this.contactWorkReason(s,id) || (!this.canPay(n.stores,cfg.contactCost)?'来源先备足联络旅粮和工具':null);
  },
  beginContact(s,id='river_network'){
    this.init(s);const r=s.civilization.origins,n=r.nodes[id],d=CivilOriginContent[id];
    if(this.contactReason(s,id) || !this.pay(n.stores,d.contactCost))return false;
    r.contactTrip={source:id,remaining:d.contactDuration,lastWorkedAt:s.civilization.elapsed};n.status='contacting';this.assign(s,id);return true;
  },
  agreementReason(s,id='river_network'){
    const n=s.civilization.origins?.nodes[id],d=CivilOriginContent[id];
    if(!n || !d || n.status!=='contacted' || n.permit.paid)return '来源尚未完成联络，或协议已经登记';
    if(!this.canPay(s.stores,d.agreementCost))return '本地尚缺登记知识';
    if(!this.canPay(n.stores,d.sourceAgreementCost))return d.name+'尚缺自己的名册木料或知识';
    return null;
  },
  agree(s,id='river_network'){
    const n=s.civilization.origins?.nodes[id],d=CivilOriginContent[id];
    if(this.agreementReason(s,id))return false;
    // Check both independent inventories before either is charged; no asynchronous step
    // can intervene between this check and these two payments.
    this.pay(s.stores,d.agreementCost);this.pay(n.stores,d.sourceAgreementCost);
    n.agreement={agreedAt:s.civilization.elapsed,home:{...d.agreementCost},source:{...d.sourceAgreementCost}};
    n.status='agreed';n.permit.paid=true;n.revision++;return true;
  },
  inTransit(n){return Object.values(n.departures).filter(d=>d.status==='travel').reduce((sum,d)=>sum+d.alive,0);},
  initHousing(n){
    // Old saves may have spent travellers' beds on births. Preserve that real population,
    // but record only the existing squeeze; it can shrink and can never create new beds.
    if(n.legacyHousingOverflow===undefined && Number.isInteger(n.population) && Number.isInteger(n.housing) && n.departures && typeof n.departures==='object' && Object.values(n.departures).every(d=>d && Number.isInteger(d.alive)))
      n.legacyHousingOverflow=Math.max(0,n.population+this.inTransit(n)-n.housing);
  },
  reservedBeds(s,id){const n=s.civilization.origins?.nodes[id];return n?this.inTransit(n):0;},
  availableBeds(s,id){const n=s.civilization.origins?.nodes[id];return n?Math.max(0,n.housing-n.population-this.reservedBeds(s,id)):0;},
  releaseHousing(n){
    if(Number.isInteger(n.legacyHousingOverflow) && n.legacyHousingOverflow>0)
      n.legacyHousingOverflow=Math.min(n.legacyHousingOverflow,Math.max(0,n.population+this.inTransit(n)-n.housing));
  },
  remaining(s,id){const n=s.civilization.origins?.nodes[id];return n?Math.max(0,n.permit.limit-n.admitted-n.transitDeaths-this.inTransit(n)):0;},
  sustainabilityReason(s,id,cohorts){
    const n=s.civilization.origins.nodes[id],d=CivilOriginContent[id],p=CivilPopulation.count(cohorts),plan=this.plan(cohorts),limits=this.jobLimits(s,id);
    if(p<d.retained)return '来源至少需要留守'+d.retained+'位居民';
    for(const b of d.fertilityBands)if(CivilPopulation.count(cohorts.filter(c=>c.age>=b.min&&c.age<=b.max))<b.retained)return '来源'+b.min+'—'+b.max+'岁居民须至少留守'+b.retained+'人';
    if(n.health<60||n.hunger)return '来源居民尚需恢复健康与口粮';
    if(plan.teacher>limits.teacher)return '来源学舍现有'+limits.teacher+'个教师席，安置后'+CivilPopulation.children(cohorts)+'名儿童仍需'+plan.teacher+'席；'+(n.schooling?.project?'扩班施工还需'+n.schooling.project.remaining+'秒':'等待来源自费扩班');
    if(Object.entries(plan).some(([k,v])=>v>limits[k]))return '来源的实际生产岗位尚不能覆盖留守居民';
    if(Object.values(plan).reduce((sum,v)=>sum+v,0)+this.sourceStaff(s,id)>CivilPopulation.workforce(cohorts))return '来源须留下足够成年居民维持生产、教学与施工';
    if((n.stores.food||0)+1e-8<CivilPopulation.foodPopulation(cohorts)*.12*12)return '来源须自行备足安置后120秒口粮';
    if((n.stores.medicine||0)+1e-8<p*.01*12)return '来源须自行备足安置后120秒药品';
    if((n.stores.wood||0)+1e-8<plan.teacher*.1)return '来源课堂尚缺本轮教材木料';
    return null;
  },
  sustainable(s,id,cohorts){return this.sustainabilityReason(s,id,cohorts)===null;},
  chooseFamily(cohorts,limit,mode,id='river_network'){
    const remaining=cohorts.map(c=>({...c})),selected=[];
    if(!CivilOriginContent[id]||!Number.isInteger(limit)||limit<1||limit>8||!['singleton','convoy'].includes(mode))return {selected,remaining};
    const bands=CivilOriginContent[id].fertilityBands;
    const excess=b=>Math.max(0,CivilPopulation.count(remaining.filter(c=>c.age>=b.min&&c.age<=b.max))-b.retained);
    const take=(test,count)=>{
      while(count>0){
        const candidates=remaining.filter(c=>test(c)&&c.count).map(c=>({c,b:bands.find(b=>c.age>=b.min&&c.age<=b.max)}))
          .filter(x=>!x.b||excess(x.b)>0).sort((a,b)=>!a.b&&!b.b?0:(b.b?excess(b.b):Infinity)-(a.b?excess(a.b):Infinity)||b.c.count-a.c.count||a.c.age-b.c.age);
        if(!candidates.length)break;
        const {c,b}=candidates[0],n=Math.min(count,c.count,b?excess(b):Infinity),old=selected.find(x=>x.cohortId===c.cohortId);
        if(old)old.count+=n;else selected.push({...c,count:n});c.count-=n;count-=n;
      }
      return count;
    };
    if(mode==='singleton')take(c=>c.age>=18&&c.age<=49,1);
    else{
      // Keep two real young adults when seats permit; a one-seat batch contains one adult.
      const adults=Math.min(limit,5,Math.max(2,limit-3));take(c=>c.age>=18&&c.age<=49,Math.min(2,adults));
      take(c=>c.age>=50&&c.age<65,adults-CivilPopulation.count(selected));
      take(c=>c.age>=18&&c.age<=49,adults-CivilPopulation.count(selected));
      const got=CivilPopulation.count(selected);if(got<Math.min(2,limit))return {selected:[],remaining};
      let room=limit-got;
      const children=Math.min(2,Math.max(0,room-1));take(c=>c.age<18,children);
      room=limit-CivilPopulation.count(selected);if(room>0)take(c=>c.age>=65,1);
      room=limit-CivilPopulation.count(selected);if(room>0)take(c=>c.age>=18&&c.age<65,room);
    }
    return {selected,remaining:remaining.filter(c=>c.count>0)};
  },
  choose(cohorts,limit,mode,id='river_network'){
    const original=cohorts.map(c=>({...c})),selected=[];let remaining=original;
    if(!CivilOriginContent[id] || !Number.isInteger(limit) || limit<1 || limit>24 || !['singleton','convoy'].includes(mode))return {selected,remaining};
    if(mode==='singleton')return this.chooseFamily(cohorts,1,mode,id);
    // Larger convoys carry up to three ordinary family groups. Apply each selection to
    // the same diminishing census so fertility floors are never spent three times.
    for(let left=limit;left>0;){
      const seats=Math.min(8,left),group=this.chooseFamily(remaining,seats,'convoy',id);
      if(CivilPopulation.count(group.selected)!==seats)return {selected:[],remaining:original};
      for(const c of group.selected){const old=selected.find(x=>x.cohortId===c.cohortId);if(old)old.count+=c.count;else selected.push({...c});}
      remaining=group.remaining;left-=seats;
    }
    return {selected,remaining};
  },
  quoteCapacity(options){
    if(!options || !['singleton','convoy'].includes(options.mode))return null;
    const capacity=options.capacity===undefined?(options.mode==='singleton'?1:8):options.capacity;
    return options.mode==='singleton'?(capacity===1?1:null):[8,24].includes(capacity)?capacity:null;
  },
  quoteParty(s,id,maxPeople,options={mode:'convoy'}){
    const n=s.civilization.origins?.nodes[id],mode=options?.mode,capacity=this.quoteCapacity(options);
    if(!n || !capacity || !['contacted','agreed'].includes(n.status) || mode==='convoy' && n.status!=='agreed' || !Number.isInteger(maxPeople)||maxPeople<1)return null;
    const max=Math.min(capacity,maxPeople,this.remaining(s,id),n.population-CivilOriginContent[id].retained);
    for(let count=max;count>0;count--){
      const {selected,remaining}=this.choose(n.cohorts,count,mode,id),actual=CivilPopulation.count(selected);
      if(!actual || actual!==count || !this.sustainable(s,id,remaining))continue;
      return {originId:id,revision:n.revision,mode,capacity,cohorts:selected,count:actual,cost:mode==='singleton'?{food:actual*6}:{food:actual*6,medicine:actual*.2,tools:actual*.2}};
    }
    return null;
  },
  quoteReason(s,id,maxPeople=8,options={mode:'convoy'}){
    const n=s.civilization.origins?.nodes[id],mode=options?.mode,capacity=this.quoteCapacity(options);
    if(!n)return '尚未取得来源名册';
    if(!capacity||!Number.isInteger(maxPeople)||maxPeople<1)return '接纳人数、方式或运力无效';
    if(!['contacted','agreed'].includes(n.status))return '来源联络尚未完成';
    if(mode==='convoy'&&n.status!=='agreed')return '来源尚未登记批次迁居协议';
    if(this.quoteParty(s,id,maxPeople,options))return null;
    if(this.remaining(s,id)<=0)return '来源的累计迁居额度已经用完';
    const max=Math.min(capacity,maxPeople,this.remaining(s,id),n.population-CivilOriginContent[id].retained);
    if(max<=0)return '来源至少需要留守'+CivilOriginContent[id].retained+'位居民';
    for(let count=max;count>0;count--){const choice=this.choose(n.cohorts,count,mode,id);if(CivilPopulation.count(choice.selected)===count){const reason=this.sustainabilityReason(s,id,choice.remaining);if(reason)return reason.replace(/^来源/,CivilOriginContent[id].name);}}
    return '来源须保留各年龄段的育龄居民，暂不能组成迁居家庭';
  },
  target(d){return d.target===undefined?'home':d.target;},
  validTarget(s,target){return target==='home' || typeof target==='string' && typeof CivilMunicipal!=='undefined' && CivilMunicipal.has(s,target);},
  receiptCapacity(s,d,sourceId){
    const passenger=typeof CivilPassenger!=='undefined'?CivilPassenger:null,legacy=!passenger || passenger.legacyParty(s,d.partyId);
    if(d.mode==='singleton'){
      if(d.transport!==null && !(d.transport===undefined && legacy))throw Error('单人到访不能占用客运装备');
      return 1;
    }
    if(!passenger){if(d.transport!==undefined)throw Error('客运快照缺少校验模块');return 8;}
    passenger.validateTransport(s,d.transport,d.partyId,sourceId);
    const capacity=passenger.capacityFor(s,d);
    if(![8,24].includes(capacity) || d.transport && (d.transport.initial!==d.initial || Math.floor(d.transport.departedAt/600)!==d.startedYear))throw Error('来源与客运出发快照不符');
    return capacity;
  },
  sameTransport(a,b){
    if(a===undefined || b===undefined || a===null || b===null)return a===b;
    const canonical=x=>x && typeof x==='object' && !Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,k==='paid'?canonical(x[k]):x[k]])):x;
    return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  },
  matchesTransport(s,party,d){
    // A standalone legacy caller did not carry a vehicle field on its immediate singleton.
    if(typeof CivilPassenger==='undefined' && d.mode==='singleton' && d.transport===null && party.transport===undefined)return true;
    return this.sameTransport(party.transport,d.transport);
  },
  commitDeparture(s,quote,partyId,target='home',transport){
    const n=s.civilization.origins?.nodes[quote?.originId];
    if(!n || !Number.isInteger(partyId)||partyId<1 || Object.values(s.civilization.origins.nodes).some(node=>node.departures['p'+partyId]) || quote.revision!==n.revision)return false;
    if(!this.validTarget(s,target) || target!=='home' && (quote.mode==='singleton' || !CivilMunicipal.canAccept(s,target)))return false;
    const startedYear=s.civilization.urban?.year ?? n.year,storedTransport=quote.mode==='singleton'?null:transport;
    if(quote.mode==='singleton' && transport!==undefined && transport!==null)return false;
    let capacity;
    try{capacity=this.receiptCapacity(s,{partyId,initial:quote.count,mode:quote.mode,transport:storedTransport,startedYear},quote.originId);}catch{return false;}
    if(quote.capacity!==undefined && quote.capacity!==capacity || quote.count>capacity)return false;
    if(quote.mode==='convoy' && typeof CivilPassenger!=='undefined' && !CivilPassenger.canDepart(s,transport,partyId,quote.originId))return false;
    const fresh=this.quoteParty(s,quote.originId,quote.count,{mode:quote.mode,capacity});
    if(!fresh || JSON.stringify(fresh.cohorts)!==JSON.stringify(quote.cohorts) || fresh.count!==quote.count)return false;
    const next=n.cohorts.map(c=>({...c}));
    for(const item of quote.cohorts){const c=next.find(c=>c.cohortId===item.cohortId);if(!c || c.age!==item.age || c.identity!==item.identity || c.count<item.count)return false;c.count-=item.count;}
    n.cohorts=next.filter(c=>c.count>0);n.population=CivilPopulation.count(n.cohorts);n.revision++;
    n.departures['p'+partyId]={partyId,target,status:'travel',initial:quote.count,alive:quote.count,dead:0,mode:quote.mode,deathsByYear:{},
      cohorts:quote.cohorts.map(c=>({...c})),startedYear,closedYear:null};
    if(storedTransport!==undefined)n.departures['p'+partyId].transport=storedTransport===null?null:JSON.parse(JSON.stringify(storedTransport));
    this.assign(s,quote.originId);return true;
  },
  departure(s,party){
    const n=s.civilization.origins?.nodes[party?.source],d=n?.departures['p'+party?.id];
    if(!n || !d || !this.validTarget(s,this.target(d)) || party.target!==this.target(d) || !this.matchesTransport(s,party,d))return null;
    try{this.receiptCapacity(s,d,party.source);}catch{return null;}return {n,d};
  },
  expected(d,year){return d.cohorts.map(c=>({...c,age:c.age+year-d.startedYear})).filter(c=>c.age<80);},
  sameCohorts(a,b){
    const signature=cs=>cs.map(c=>[c.cohortId,c.age,c.count,c.identity,c.originId]).sort((x,y)=>x[0].localeCompare(y[0]));
    return JSON.stringify(signature(a))===JSON.stringify(signature(b));
  },
  matchesParty(s,party,d){return this.sameCohorts(party.cohorts,this.expected(d,s.civilization.urban?.year ?? Math.floor(s.civilization.elapsed/600)));},
  recordArrival(s,party){
    const found=this.departure(s,party);if(!found)return false;const {n,d}=found;
    if(d.status!=='travel' || CivilPopulation.count(party.cohorts)!==d.alive || !this.matchesParty(s,party,d))return false;
    d.status='arrived';d.closedYear=s.civilization.urban?.year ?? n.year;n.admitted+=d.alive;n.revision++;this.releaseHousing(n);return true;
  },
  returnPeople(s,party){
    const found=this.departure(s,party);if(!found)return false;const {n,d}=found;
    if(d.status!=='travel' || CivilPopulation.count(party.cohorts)!==d.alive || !this.matchesParty(s,party,d))return false;
    for(const c of party.cohorts){const old=n.cohorts.find(x=>x.cohortId===c.cohortId);if(old && (old.age!==c.age || old.identity!==c.identity))return false;}
    for(const c of party.cohorts){const old=n.cohorts.find(x=>x.cohortId===c.cohortId);if(old)old.count+=c.count;else n.cohorts.push({...c});}
    d.status='returned';d.closedYear=s.civilization.urban?.year ?? n.year;n.population=CivilPopulation.count(n.cohorts);n.revision++;this.releaseHousing(n);this.assign(s,party.source);return true;
  },
  recordTransitDeath(s,party,count){
    const found=this.departure(s,party);if(!found || !Number.isInteger(count)||count<=0)return false;const {n,d}=found;
    const year=s.civilization.urban?.year ?? Math.floor(s.civilization.elapsed/600),key='y'+year;
    if(d.status!=='travel' || d.deathsByYear[key]!==undefined || count>d.alive)return false;
    const aged=CivilPopulation.age(party.cohorts).deceased;
    if(aged!==count || !this.sameCohorts(party.cohorts,this.expected(d,year-1)))return false;
    d.deathsByYear[key]=count;d.alive-=count;d.dead+=count;n.transitDeaths+=count;n.revision++;this.releaseHousing(n);return true;
  },
  annual(s,id){
    const n=s.civilization.origins.nodes[id],target=Math.floor(s.civilization.elapsed/600);
    while(n.year<target){
      const populationStart=n.population,aged=CivilPopulation.age(n.cohorts);n.year++;n.cohorts=aged.cohorts;n.sourceDeaths+=aged.deceased;n.population=CivilPopulation.count(n.cohorts);
      const birth=CivilPopulation.births(n.cohorts,n.births,{yearStartPopulation:populationStart,beds:this.availableBeds(s,id),health:n.health,hunger:n.hunger,food:n.stores.food,medicine:n.stores.medicine});
      if(birth.count && this.pay(n.stores,birth.cost)){
        for(const c of birth.cohorts)n.cohorts.push({...c,cohortId:id+'_born_'+n.year+'_'+c.identity,originId:id});
        n.born+=birth.count;n.population+=birth.count;
      }
      this.releaseHousing(n);n.revision++;this.assign(s,id);
    }
  },
  tick(s){
    this.init(s);const r=s.civilization.origins;
    for(const id of Object.keys(r.nodes)){this.annual(s,id);this.tickSchool(s,id);}
    if(r.contactTrip && r.contactTrip.lastWorkedAt<s.civilization.elapsed){
      const trip=r.contactTrip,id=trip.source;trip.lastWorkedAt=s.civilization.elapsed;
      if(!this.contactWorkReason(s,id))trip.remaining=Math.max(0,trip.remaining-1);
      if(!trip.remaining){r.nodes[id].status='contacted';r.nodes[id].revision++;r.contactTrip=null;}
      this.assign(s,id);
    }
    const u=s.civilization.urban;
    if(u?.registered && !r.warned && (CivilPopulation.count(u.source)===0 || u.source.filter(c=>c.age>=18&&c.age<=49).reduce((a,c)=>a+c.count,0)<16)){
      r.warned=true;this.note('原有接纳名册正在衰老。河谷之外还有散居家庭；沿河网联络后，可按真实粮食与床位接纳新居民。');
    }
    return {storesChanged:false,populationChanged:false};
  },
  eventId(kind,id){return 'origin'+kind+(id==='river_network'?'':'_'+id);},
  eventSource(eventId){return Object.keys(CivilOriginContent).find(id=>['Contact','Agreement'].some(kind=>this.eventId(kind,id)===eventId));},
  nextEvent(s){const id=Object.keys(CivilOriginContent).find(id=>{const n=s.civilization.origins?.nodes[id];return n && ['contacted','agreed'].includes(n.status) && !n.announced;});return id?this.eventId('Contact',id):null;},
  costText(cost){const labels={food:'粮食',tools:'工具',wood:'木料',knowledge:'知识',medicine:'药品'};return Object.entries(cost).map(([id,n])=>n+(labels[id]||id)).join('、');},
  event(id,done){
    const s=State,source=this.eventSource(id),n=s.civilization.origins?.nodes[source],cfg=CivilOriginContent[source];if(!n || !cfg)return null;
    if(id===this.eventId('Contact',source) && ['contacted','agreed'].includes(n.status))return {title:cfg.name+'的名册',text:[
      cfg.name+'的联络人员用自己的旅粮确认了这条路。名册上现有'+n.population+'位居民，孩子会长大，老人也会离世。',
      '这次联系不会给聚落增加任何居民。已联系的来源可逐人到访，每人实际支付6食物；即使本地已没有成年劳动力，也可先手动备粮恢复。',
      '批次接纳由本地支付'+this.costText(cfg.agreementCost)+(Object.keys(cfg.sourceAgreementCost).length?'，对方自己支付'+this.costText(cfg.sourceAgreementCost):'')+'登记。最多迁出'+cfg.permit+'人，并保证来源至少留下'+cfg.retained+'人及必要供养岗位。'
    ],buttons:{record:{text:'记录来源与接纳条件',nextScene:'end',onChoose:done(cfg.name+'的名册已记录。居民按真实费用、住房与供养逐步安置。',()=>{n.announced=true;})}}};
    if(id===this.eventId('Agreement',source) && n.status==='contacted')return {title:cfg.name+'迁居登记',text:[
      '本地支付'+this.costText(cfg.agreementCost)+(Object.keys(cfg.sourceAgreementCost).length?'，'+cfg.name+'自己支付'+this.costText(cfg.sourceAgreementCost):'')+'。双方材料齐备才一起登记；协议总额'+cfg.permit+'，不随出生或换任重新分配。',
      '登记后每人仍需6食物、0.2药品、0.2工具和已预留床位。小队需要两名实际运输工'+(s.civilization.tech.passenger_transport?'，扩容大队需要四人及装备维护':'')+'。逐人到访不要求先签这份批次协议。'
    ],buttons:{agree:{text:'登记批次协议（'+this.costText(cfg.agreementCost)+'）',nextScene:'end',onChoose:()=>{const reason=this.agreementReason(s,source),ok=!reason && this.agree(s,source);return done(ok?cfg.name+'的批次迁居协议已经登记。':(reason||'登记条件已变化')+'，本次未扣款。')();}},later:{text:'先维持逐人到访',nextScene:'end',onChoose:done('保留逐人到访，稍后再商议批次接纳。')}}};
    return null;
  },
  note(message){if(typeof Civilization!=='undefined' && Civilization.notify)Civilization.notify(message);},
  reset(){this.panelReady=false;this.selection=null;},
  selected(s){const ids=this.visibleIds(s);return ids.includes(this.selection)?this.selection:ids[0];},
  refresh(){
    const s=State,r=s.civilization.origins,ids=this.visibleIds(s),id=this.selected(s);if(!r || !id || !$('#roadPanel').length)return;
    const n=r.nodes[id],cfg=CivilOriginContent[id];
    const select=Civilization.button('originSourceButton','来源线索：'+cfg.name,'#roadPanel',()=>{const available=this.visibleIds(State),current=this.selected(State);this.selection=available[(available.indexOf(current)+1)%available.length];this.refresh();});
    select.text('来源线索：'+cfg.name+'（'+(ids.indexOf(id)+1)+'/'+ids.length+'）').toggle(ids.length>1);select.attr('title','切换已经发现的来源线索；在途旅队仍按原来源和目的地行进');
    const start=Civilization.button('originContactButton','派出联络信使','#roadPanel',()=>{if(this.beginContact(State,this.selected(State))){Engine.saveGame();this.refresh();}});
    start.toggle(n.status==='unknown' || n.status==='contacting');Button.setDisabled(start,!!this.contactReason(s,id));start.attr('title',cfg.name+'自己承担2名联络人员、'+this.costText(cfg.contactCost)+'；'+cfg.contactDuration+'个实际工作秒后取得联系');
    let info=$('#originSourceInfo');if(!info.length)info=$('<div>').attr('id','originSourceInfo').css({width:'410px',lineHeight:'1.8',marginTop:'15px'}).appendTo('#roadPanel');
    info.text(n.status==='contacting'?cfg.name+'的人员正在联络，还需 '+Math.ceil(r.contactTrip.remaining)+' 秒。'+(this.contactWorkReason(s,id)||''):n.status==='unknown'?cfg.name+'留下了可以联络的线索。由当地人员自备旅粮勘路，取得联系后再核对真实名册。'+(this.contactReason(s,id)||''):
      cfg.name+'：现有 '+n.population+' 人，成年劳动力 '+CivilPopulation.workforce(n.cohorts)+'，儿童 '+CivilPopulation.children(n.cohorts)+'；健康 '+Math.floor(n.health)+'。'+(this.reservedBeds(s,id)?'为未安置旅客保留 '+this.reservedBeds(s,id)+' 床。':'')+(n.legacyHousingOverflow?'原有住房仍挤缺 '+n.legacyHousingOverflow+' 床，新生家庭须等空床。':'')+'协议余量 '+this.remaining(s,id)+'；至少留守'+cfg.retained+'人。'+(n.status==='agreed'?(this.quoteReason(s,id,s.civilization.tech.passenger_transport?24:8,{mode:'convoy',capacity:s.civilization.tech.passenger_transport?24:8})||'来源可安排迁居家庭；实际规模仍由车组、旅费与目的地供养决定。'):'已可逐人到访，每人6粮；批次需登记。'+(this.agreementReason(s,id)||''))+' '+this.schoolStatus(s,id));
    const agree=Civilization.button('originAgreementButton','商议批次接纳','#roadPanel',()=>{const selected=this.selected(State);if(!Events.activeEvent() && !State.civilization.pending && State.civilization.origins.nodes[selected].status==='contacted'){State.civilization.pending=this.eventId('Agreement',selected);Civilization.showPending();}});
    Button.setDisabled(agree,!!this.agreementReason(s,id));agree.attr('title','本地：'+this.costText(cfg.agreementCost)+(Object.keys(cfg.sourceAgreementCost).length?'；来源：'+this.costText(cfg.sourceAgreementCost):''));
    $('#originAgreementButton').toggle(n.status==='contacted');
  },
  validateSchool(s,id,n){
    const e=n.schooling;if(e===undefined)return;
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),cfg=CivilOriginContent[id].school,t=s.civilization.elapsed;
    const time=x=>Number.isFinite(x)&&x>=this.introducedAt(s,id)&&x<=t;
    const paid=x=>obj(x)&&Object.keys(x).length===Object.keys(cfg.cost).length&&Object.entries(cfg.cost).every(([k,v])=>x[k]===v);
    if(!obj(e)||e.schema!==1||!Array.isArray(e.completed)||e.completed.length>cfg.max)throw Error('来源扩班记录无效');
    let last=this.introducedAt(s,id);
    for(const x of e.completed){if(!obj(x)||!time(x.startedAt)||!time(x.completedAt)||x.startedAt<last||x.completedAt-x.startedAt<cfg.duration||!paid(x.paid))throw Error('来源学舍竣工记录无效');last=x.completedAt;}
    const p=e.project;
    if(p!==null&&(!obj(p)||e.completed.length>=cfg.max||!time(p.startedAt)||p.startedAt<last||!time(p.lastWorkedAt)||p.lastWorkedAt<p.startedAt||!Number.isInteger(p.remaining)||p.remaining<1||p.remaining>cfg.duration||p.lastWorkedAt-p.startedAt<cfg.duration-p.remaining||!paid(p.paid)))throw Error('来源扩班施工无效');
  },
  validate(s){
    const r=s.civilization.origins;if(r===undefined)return;
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),int=(x,max=1e9)=>Number.isInteger(x)&&x>=0&&x<=max,num=(x,max=1e12)=>Number.isFinite(x)&&x>=0&&x<=max;
    const year=Math.floor(s.civilization.elapsed/600),u=s.civilization.urban;
    if(!obj(r)||![1,2].includes(r.schema)||!num(r.introducedAt,s.civilization.elapsed)||typeof r.warned!=='boolean'||!obj(r.nodes))throw Error('来源总账无效');
    const ids=r.schema===1?['river_network']:Object.keys(CivilOriginContent),keys=Object.keys(r.nodes),partyIds=new Set();
    if(keys.length!==ids.length || ids.some(id=>!obj(r.nodes[id])) || keys.some(id=>!ids.includes(id)))throw Error('来源节点缺失或未知');
    if(r.contactTrip!==null && (!obj(r.contactTrip)||!ids.includes(r.contactTrip.source)||!int(r.contactTrip.remaining,CivilOriginContent[r.contactTrip.source].contactDuration)||r.schema===2&&(!num(r.contactTrip.lastWorkedAt,s.civilization.elapsed)||r.contactTrip.lastWorkedAt<this.introducedAt(s,r.contactTrip.source))))throw Error('来源联络无效');
    for(const [id,n]of Object.entries(r.nodes)){
      const cfg=CivilOriginContent[id];
      // A pre-fix save can already contain returned passengers. At most two eight-seat
      // parties caused this legacy squeeze; the full population/receipt ledger still applies.
      const allowance=r.schema===1 && n.legacyHousingOverflow===undefined?16:Number.isInteger(n.legacyHousingOverflow)?n.legacyHousingOverflow:0;
      if(!cfg||!obj(n)||!['unknown','contacting','contacted','agreed'].includes(n.status)||n.baselinePopulation!==cfg.baseline||n.housing!==cfg.housing||n.year!==year||!int(n.revision)||!Array.isArray(n.cohorts)||n.cohorts.length>400||!int(n.population,n.housing+allowance)||!obj(n.stores)||!obj(n.workers)||!num(n.health,100)||!num(n.hunger)||!obj(n.departures)||typeof n.announced!=='boolean'||!obj(n.discarded))throw Error('来源状态无效');
      if(r.schema===2 && (!num(n.introducedAt,s.civilization.elapsed)||n.introducedAt<r.introducedAt||id==='river_network'&&n.introducedAt!==r.introducedAt||n.schooling===undefined||n.legacyHousingOverflow===undefined))throw Error('来源建模时间或记录缺失');
      if(id!=='river_network' && n.legacyHousingOverflow!==0)throw Error('新来源没有历史住房挤压');
      if(r.schema===1 && n.introducedAt!==undefined && n.introducedAt!==r.introducedAt)throw Error('旧来源建模时间无效');
      if((n.status==='contacting')!==(r.contactTrip?.source===id) || !obj(n.permit)||n.permit.limit!==cfg.permit||typeof n.permit.paid!=='boolean'||(n.status==='agreed')!==n.permit.paid)throw Error('来源协议无效');
      const agreement=n.agreement,paid=(x,cost)=>obj(x)&&Object.keys(x).length===Object.keys(cost).length&&Object.entries(cost).every(([k,v])=>x[k]===v);
      if(agreement===undefined){if(id!=='river_network')throw Error('来源议约记录缺失');}
      else if(agreement===null){if(n.permit.paid)throw Error('来源议约付款缺失');}
      else if(!obj(agreement)||!n.permit.paid||!num(agreement.agreedAt,s.civilization.elapsed)||agreement.agreedAt<this.introducedAt(s,id)||!paid(agreement.home,cfg.agreementCost)||!paid(agreement.source,cfg.sourceAgreementCost))throw Error('来源议约付款无效');
      if(!obj(n.births)||n.births.scaled!==true||['credit','mutantCredit'].some(k=>!num(n.births[k],1)||n.births[k]>=1))throw Error('来源出生记录无效');
      const cohortIds=new Set();
      for(const c of n.cohorts){if(!obj(c)||typeof c.cohortId!=='string'||!c.cohortId.startsWith(id+'_')||cohortIds.has(c.cohortId)||!int(c.age,79)||!int(c.count,n.housing)||!c.count||!['human','mutant'].includes(c.identity)||c.originId!==id)throw Error('来源年龄名册无效');cohortIds.add(c.cohortId);}
      if(CivilPopulation.count(n.cohorts)!==n.population)throw Error('来源人口不符');
      for(const [k,v]of Object.entries(n.stores))if(!['food','medicine','tools','scrap','wood','knowledge'].includes(k)||!num(v))throw Error('来源库存无效');
      for(const [k,v]of Object.entries(n.discarded))if(!['food','medicine','tools','scrap','wood','knowledge'].includes(k)||!num(v))throw Error('来源弃置记录无效');
      this.validateSchool(s,id,n);const limits=this.jobLimits(s,id);
      if(Object.entries(n.workers).some(([k,v])=>!Object.hasOwn(limits,k)||!int(v,limits[k]))||Object.values(n.workers).reduce((a,b)=>a+b,0)+this.sourceStaff(s,id)>CivilPopulation.workforce(n.cohorts))throw Error('来源岗位无效');
      for(const key of ['born','sourceDeaths','transitDeaths','admitted'])if(!int(n[key]))throw Error('来源流量无效');
      let arrived=0,dead=0,travel=0,returned=0;
      for(const [key,d]of Object.entries(n.departures)){
        if(!obj(d)||!int(d.partyId)||d.partyId<1||partyIds.has(d.partyId)||!u||!int(u.nextParty)||d.partyId>=u.nextParty||key!=='p'+d.partyId||!['travel','arrived','returned'].includes(d.status)||!int(d.initial,24)||!d.initial||!int(d.alive,24)||!int(d.dead,24)||d.alive+d.dead!==d.initial||!['singleton','convoy'].includes(d.mode)||d.mode==='singleton'&&d.initial!==1||!obj(d.deathsByYear)||!int(d.startedYear,year)||d.startedYear<Math.floor(this.introducedAt(s,id)/600)||!Array.isArray(d.cohorts)||!d.cohorts.length||r.schema===2&&d.target===undefined)throw Error('来源迁出记录无效');
        partyIds.add(d.partyId);
        const capacity=this.receiptCapacity(s,d,id);
        if(d.initial>capacity || d.alive>capacity || d.dead>capacity || d.cohorts.length>capacity)throw Error('来源回执超出原客运容量');
        const target=this.target(d);
        if(!this.validTarget(s,target) || d.mode==='singleton' && target!=='home')throw Error('来源迁出目的地无效');
        const originals=new Set();
        for(const c of d.cohorts){if(!obj(c)||typeof c.cohortId!=='string'||!c.cohortId.startsWith(id+'_')||originals.has(c.cohortId)||!int(c.age,79)||!int(c.count,capacity)||!c.count||!['human','mutant'].includes(c.identity)||c.originId!==id)throw Error('迁出原始名册无效');originals.add(c.cohortId);}
        if(CivilPopulation.count(d.cohorts)!==d.initial || d.status==='travel' && d.closedYear!==null || d.status!=='travel' && (!int(d.closedYear,year)||d.closedYear<d.startedYear))throw Error('迁出时间记录无效');
        const censusYear=d.status==='travel'?u.year:d.closedYear,expected=this.expected(d,censusYear);
        if(!int(censusYear,year)||censusYear<d.startedYear||CivilPopulation.count(expected)!==d.alive)throw Error('迁出年龄总账不符');
        let perYear=0;for(const [k,v]of Object.entries(d.deathsByYear)){
          const deathYear=Number(k.slice(1));
          if(!/^y\d+$/.test(k)||deathYear>d.startedYear+80||deathYear>censusYear||deathYear<=d.startedYear||!int(v,capacity)||!v||CivilPopulation.count(d.cohorts.filter(c=>c.age+deathYear-d.startedYear===80))!==v)throw Error('在途死亡记录无效');perYear+=v;
        }
        if(perYear!==d.dead)throw Error('在途死亡计数不符');
        const parties=(u.parties||[]).filter(p=>p.source===id&&p.id===d.partyId);
        if(parties.some(p=>!this.matchesTransport(s,p,d)))throw Error('来源与在途客运快照不符');
        if(d.status==='travel' && (d.mode!=='convoy'||parties.length!==1||!['outbound','held','returning_people'].includes(parties[0].state)||parties[0].target!==target||!this.sameCohorts(parties[0].cohorts,expected)) ||
          d.status==='arrived' && (parties.length>1||parties.some(p=>d.mode!=='convoy'||p.state!=='returning'||p.target!==target||p.cohorts.length)) ||
          d.status==='returned' && parties.length)throw Error('来源与在途名册不符');
        dead+=d.dead;if(d.status==='arrived')arrived+=d.alive;if(d.status==='travel')travel+=d.alive;if(d.status==='returned')returned+=d.alive;
      }
      if(arrived!==n.admitted||dead!==n.transitDeaths||n.admitted+n.transitDeaths+travel>n.permit.limit||n.baselinePopulation+n.born!==n.population+n.sourceDeaths+n.transitDeaths+n.admitted+travel)throw Error('来源人口总账不符');
      const overflow=Math.max(0,n.population+travel-n.housing);
      if(overflow>Math.min(16,travel+returned) || n.legacyHousingOverflow!==undefined && (!int(n.legacyHousingOverflow,16)||n.legacyHousingOverflow!==overflow))throw Error('来源返乡床位记录无效');
      if((u?.parties||[]).some(p=>p.source===id&&!n.departures['p'+p.id]))throw Error('在途居民没有来源记录');
    }
    const pendingSource=this.eventSource(s.civilization.pending);
    if(pendingSource){const n=r.nodes[pendingSource],contact=s.civilization.pending===this.eventId('Contact',pendingSource);
      if(!n || (contact? !['contacted','agreed'].includes(n.status)||n.announced : n.status!=='contacted'))throw Error('来源待办与联络状态不符');}
  }
};
