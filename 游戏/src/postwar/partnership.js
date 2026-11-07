/* MPL-2.0 — Multiple partners, a single real caravan, and paid common-law admission. */
var CivilPartnership={
  pendingIds:['regionalPartners'],
  data(s){return s.civilization.partnership;},
  partners(s){return this.data(s)?.partners||{};},
  available(s){return Number.isSafeInteger(s.civilization.nation?.foundedAt)&&!!CivilMunicipal.data(s,'ford')?.city&&!!CivilCommerce.asset(s);},
  candidates(s){return CivilDiplomacy.candidates(s).filter(id=>id!==CivilCommerce.sourceId(s));},
  source(s,id){return CivilDiplomacy.source(s,id);},
  active(s){const o=this.data(s)?.orders.at(-1);return o&&o.returnedAt===null?o:null;},
  plan(s){const d=this.data(s),p=d?.plans.at(-1);return p&&p.cancelledAt===null&&d.orders.filter(o=>o.planId===p.id).length<3?p:null;},
  obligation(s){return Object.keys(this.partners(s)).length;},
  population(s){return Object.entries(this.partners(s)).reduce((n,[id,p])=>n+(p.joinedAt===null?0:this.source(s,id).population),0);},
  busy(s,id){const o=this.active(s);return !!o&&CivilCommerceContent.routes[o.sourceId].corridor===id;},
  reservedTransport(s){return this.active(s)?2:0;},
  staffed(s){return CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)>=2;},
  staff(s,id){
    if(!this.partners(s)[id])return 0;
    const n=this.source(s,id);if(!n||n.health<60||n.hunger||!CivilDiplomacy.reserve(s,id,{}))return 0;
    const plan=CivilOrigins.plan(n.cohorts),limits=CivilOrigins.jobLimits(s,id);
    const needed=Object.entries(plan).reduce((sum,[k,v])=>sum+Math.min(v,limits[k]),0);
    const other=CivilOrigins.schoolBuilders(s,id)+(s.civilization.origins.contactTrip?.source===id&&!CivilOrigins.contactWorkReason(s,id)?2:0);
    return Math.max(0,Math.min(2,CivilPopulation.workforce(n.cohorts)-needed-other));
  },
  reason(s,id){
    if(!this.available(s))return '请先建成第四座地方城市并造好对外商队装备';
    if(!this.candidates(s).includes(id))return '请先与该聚居圈搭上话；原加盟伙伴仍按原公约操办';
    if(!CivilNation.operational(s)||!CivilFinance.political(s))return '请先恢复国家共同法与现任行政运转';
    const extra=this.partners(s)[id]?0:1;
    if(CivilRegions.load(s)+extra>CivilSociety.capacity(s)+(s.civilization.regions.archiveOnline||0)*2)return '请先为新伙伴留出一份在换届磨合期仍可维系的基础协调容量';
    if(CivilRegions.load(s)+extra>CivilRegions.capacity(s))return '等待腾出一份空闲的协调容量';
    return CivilOrigins.supplyReason(s,id,this.source(s,id).cohorts);
  },
  sourceReserve(s,id,cost){
    if(!CivilDiplomacy.reserve(s,id,cost))return false;
    const n=this.source(s,id),p=CivilOrigins.plan(n.cohorts),limits=CivilOrigins.jobLimits(s,id),staff=k=>Math.min(p[k]||0,limits[k]||0);
    const reserve={scrap:(staff('medic')*.1+staff('smith')*.6)*12,wood:(staff('teacher')*.1+staff('smith')*.2)*12};
    return Object.entries(reserve).every(([k,v])=>(n.stores[k]||0)+1e-8>=v+(cost[k]||0));
  },
  canPay(s,id,cost){return CivilDiplomacy.reserve(s,'home',cost.home)&&this.sourceReserve(s,id,cost.source);},
  pay(s,id,cost){CivilServices.pay(s.stores,cost.home);CivilServices.pay(this.source(s,id).stores,cost.source);},
  sign(s,id){
    const cost=CivilPartnershipContent.signature;if(this.partners(s)[id]||this.reason(s,id)||!this.canPay(s,id,cost))return false;
    this.pay(s,id,cost);
    if(!this.data(s))s.civilization.partnership={schema:1,partners:{},plans:[],orders:[],lastTickAt:null};
    this.data(s).partners[id]={signedAt:s.civilization.elapsed,signature:JSON.parse(JSON.stringify(cost)),joinedAt:null,admission:null,joiningStableSince:null,records:[],lastSettledAt:null,stableSince:null,stableSeconds:0};
    CivilOrigins.assign(s,id);return true;
  },
  fee(s){return CivilAccession.fee(s.civilization.society.axes.devolution,s.civilization.society.axes.charter);},
  settle(s){
    const flow={},at=s.civilization.elapsed;
    for(const [id,p]of Object.entries(this.partners(s))){
      if(p.lastSettledAt!==null&&at-p.lastSettledAt<10)continue;
      const staff=this.staff(s,id),cost=this.fee(s),paid=staff===2&&this.canPay(s,id,cost);
      if(paid){this.pay(s,id,cost);for(const [k,v]of Object.entries(cost.home))flow[k]=(flow[k]||0)-v;}
      p.records.push({at,mode:s.civilization.society.axes.devolution,charter:s.civilization.society.axes.charter,staff,paid,costs:paid?cost:{},service:null});p.lastSettledAt=at;
    }return flow;
  },
  observe(s){
    for(const [id,p]of Object.entries(this.partners(s))){const r=p.records.at(-1);if(!r||r.service!==null||r.at!==s.civilization.elapsed)continue;
      r.service=r.paid&&!this.reason(s,id);const old=p.records.at(-2);
      if(r.service){if(p.stableSince!==null&&old?.service&&r.at-old.at===10&&r.mode===old.mode&&r.charter===old.charter)p.stableSeconds=Math.min(600,p.stableSeconds+10);else {p.stableSince=r.at;p.stableSeconds=0;}}
      else {p.stableSince=null;p.stableSeconds=0;}
    }
  },
  operational(s,id){const p=this.partners(s)[id],last=p?.records.at(-1),r=last?.service===null?(last.paid?p.records.at(-2):null):last;return !!r?.service&&s.civilization.elapsed-r.at>=0&&s.civilization.elapsed-r.at<=10&&!this.reason(s,id);},
  completed(s,id,at=Infinity){return (this.data(s)?.orders||[]).filter(o=>o.sourceId===id&&o.exchange===true&&o.returnedAt!==null&&o.returnedAt<=at).length;},
  join(s,id){
    const p=this.partners(s)[id],cost=CivilPartnershipContent.admission;
    if(!p||p.joinedAt!==null||p.stableSeconds<600||!this.operational(s,id)||this.completed(s,id)<3||!this.canPay(s,id,cost))return false;
    this.pay(s,id,cost);p.joinedAt=s.civilization.elapsed;p.admission=JSON.parse(JSON.stringify(cost));p.joiningStableSince=p.stableSince;return true;
  },
  schedule(s,id){const d=this.data(s);if(!this.partners(s)[id]||this.plan(s)||!this.operational(s,id))return false;d.plans.push({id:d.plans.length+1,sourceId:id,at:s.civilization.elapsed,cancelledAt:null,limit:3});return true;},
  cancel(s){const p=this.plan(s);if(!p)return false;p.cancelledAt=s.civilization.elapsed;return true;},
  duration(id){return CivilCommerceContent.routes[id].duration+120;},
  paid(){const out={...CivilPartnershipContent.cargo};for(const [k,v]of Object.entries(CivilPartnershipContent.travelCost))out[k]=(out[k]||0)+v;return out;},
  roadReason(s,id,departing=false){const corridor=CivilCommerceContent.routes[id]?.corridor,r=s.civilization.regions.routes[corridor];return !r||r.condition!=='open'?'原联络走廊已封闭，在途货物滞留待修':departing&&CivilIncidents.holds(s,corridor)?'原走廊正候空车归来检修，暂停发运新车':null;},
  dispatchReason(s){
    const p=this.plan(s);if(!p)return '暂无未发车的委托';if(!this.operational(s,p.sourceId))return '请先恢复该伙伴的公共记录与国家治理';
    if(this.active(s)||CivilCommerce.active(s)||CivilCommerce.plan(s)||CivilIntercity.active(s)||CivilIntercity.plan(s)||CivilFrontier.active(s))return '请先等原商车归城，并撤销其余未发车的委托';
    if(!this.staffed(s))return '等待两名空闲的运输工';
    return this.roadReason(s,p.sourceId,true)||(!CivilFinance.reserveCheck(s,'home',this.paid())?'本城工具、沿途旅费或保底供养不足':!this.sourceReserve(s,p.sourceId,CivilPartnershipContent.returns[p.sourceId])?'对方须先留足自家供养，再备齐交换现货':null);
  },
  dispatch(s){
    if(this.dispatchReason(s))return false;const d=this.data(s),p=this.plan(s),at=s.civilization.elapsed;CivilServices.pay(s.stores,this.paid());
    d.orders.push({id:d.orders.length+1,planId:p.id,sourceId:p.sourceId,assetId:CivilCommerce.asset(s).id,departedAt:at,arrivedAt:null,returnedAt:null,lastMovedAt:at,outboundSeconds:0,inboundSeconds:0,exchange:null,paid:this.paid(),cargo:{...CivilPartnershipContent.cargo}});return true;
  },
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastTickAt!==null&&at<=d.lastTickAt)return;d.lastTickAt=at;const o=this.active(s);if(!o){this.dispatch(s);return;}
    if(!this.staffed(s)||this.roadReason(s,o.sourceId))return;o.lastMovedAt=at;
    if(o.arrivedAt===null){if(++o.outboundSeconds===this.duration(o.sourceId)){
      const goods=CivilPartnershipContent.returns[o.sourceId],n=this.source(s,o.sourceId);o.arrivedAt=at;o.exchange=this.sourceReserve(s,o.sourceId,goods);
      if(o.exchange){CivilServices.pay(n.stores,goods);CivilRegions.credit(n.stores,o.cargo);o.cargo={...goods};}
      Civilization.notify(CivilDiplomacy.name(o.sourceId)+(o.exchange?'现货交割完毕，原商车装货返程。':'对方须先保住自家口粮，本趟未能成交，原工具随车拉回。'));
    }}else if(++o.inboundSeconds===this.duration(o.sourceId)){CivilRegions.credit(s.stores,o.cargo);o.cargo={};o.returnedAt=at;Civilization.notify('跑地区商约的原商车已归城，换回的货物卸入原仓，两名随车司机重新待命。');}
  },
  status(s,id){
    const p=this.partners(s)[id];if(!p)return this.reason(s,id)||'双方可支取用度签定商约';
    return (p.joinedAt===null?'独立商约':'共同法成员，在册'+this.source(s,id).population+'人照旧在当地安居度日')+'；累计成交归城'+this.completed(s,id)+'趟；连续履约'+p.stableSeconds+'/600秒；'+(this.operational(s,id)?'公共记录运转正常':this.reason(s,id)||'正候当地两名记录员到岗、备齐两地经费并完成下一轮核验');
  },
  event(id,done){
    if(id!=='regionalPartners')return null;const s=State,buttons={},text=['各方独立供养、自管仓库。商队与日常外贸共用同一辆原商车，每次最多排入三趟；新商路需绕行已知走廊外围的远路，单程多走120秒，不享受第一伙伴的护送或驿站缩时。'],finish=(ok,msg)=>done(ok?msg:'条件已有变动，本次未执行；既有约定与库内货物照旧保留。')();
    for(const source of this.candidates(s)){
      const p=this.partners(s)[source],name=CivilDiplomacy.name(source);
      text.push(name+'：'+this.status(s,source)+'。每趟拿工具12换回 '+CivilHistory.costText(CivilPartnershipContent.returns[source])+'，单程耗时'+this.duration(source)+'秒。');
      if(!p)buttons['sign_'+source]={text:name+'实付立约',nextScene:'end',onChoose:()=>finish(this.sign(s,source),'两地已付清立约用度，由当地从在册成年人中抽调两名记录员当值，占用一份协调容量。')};
      else {
        if(!this.plan(s))buttons['trade_'+source]={text:'排入'+name+'三趟商队',nextScene:'end',onChoose:()=>finish(this.schedule(s,source),'已排入三趟商队委托；每趟实际发车时才划扣贸易工具与沿途旅费。')};
        if(p.joinedAt===null&&p.stableSeconds>=600&&this.completed(s,source)>=3)buttons['join_'+source]={text:name+'加入共同法',nextScene:'end',onChoose:()=>finish(this.join(s,source),'双方付清用度，正式完成共同法登记。当地百姓自此纳入共同法，但不搬家、不虚增人口，两地公仓亦不合并；日常记录开支仍须按轮支取。')};
      }
    }
    const o=this.active(s),plan=this.plan(s);if(plan)buttons.cancel={text:'撤销未发地区商队',nextScene:'end',onChoose:()=>finish(this.cancel(s),'尚未发车的委托已撤销，已在途的原商车照常返程。')};
    if(o)text.push('在途：'+CivilDiplomacy.name(o.sourceId)+'，'+(o.arrivedAt===null?'去程 '+o.outboundSeconds:'返程 '+o.inboundSeconds)+'/'+this.duration(o.sourceId)+'秒；随车装载 '+CivilHistory.costText(o.cargo)+'。'+(this.roadReason(s,o.sourceId)||(!this.staffed(s)?'等待两名司机':'')));
    else if(plan)text.push('发车：'+this.dispatchReason(s));
    text.push('每签一份商约：本城出知识80、木10；对方出知识40、木10。每跑一趟另耗旅费粮12、木3、工具0.2、零件0.1；抵站交割、归城入库，若未成交则原货拉回，已耗旅费不退。','每10秒双方的公共记录开支按现行“中央/地方”与“成文/惯例”制度核算：本城 '+CivilHistory.costText(this.fee(s).home)+'；对方 '+CivilHistory.costText(this.fee(s).source)+'。须当地两名记录员在岗且两头用度齐备方才划扣；一旦欠费或国家行政中断，即暂停发运新车并停计履约，但既有的成员名分照旧保留。','接纳其入共同法，需先跑满三趟成交归城的商队、连续600秒有效记录，再由本城出知识150/工具8、对方出知识100/工具8。入法后百姓照旧在原处生活，若要迁居仍须按原协议核验旅费与空床。');
    buttons.close={text:'合上地区商约',nextScene:'end',onChoose:done('各伙伴的公仓、户籍与条约继续各自掌管。')};return {title:'地区商约与共同法',text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;if(!this.available(State)){$('#partnershipButton').hide();return;}
    Civilization.button('partnershipButton','地区商约与共同法','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='regionalPartners';Civilization.showPending();}).show();
  },
  validate(s){
    const d=this.data(s),at=s.civilization.elapsed,fail=()=>{throw Error('地区商约、履约或在途货物无效');},obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=at,nullable=x=>x===null||time(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(d===undefined){if(s.civilization.pending==='regionalPartners'&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||!obj(d.partners)||!Object.keys(d.partners).length||!Array.isArray(d.orders)||!Array.isArray(d.plans)||!nullable(d.lastTickAt))fail();
    for(const [id,p]of Object.entries(d.partners)){
      if(!this.candidates(s).includes(id)||!obj(p)||!time(p.signedAt)||p.signedAt<s.civilization.nation.foundedAt||!same(p.signature,CivilPartnershipContent.signature)||!Array.isArray(p.records)||!nullable(p.joinedAt)||!nullable(p.joiningStableSince)||!nullable(p.lastSettledAt)||!nullable(p.stableSince)||!Number.isSafeInteger(p.stableSeconds)||p.stableSeconds<0||p.stableSeconds>600)fail();
      let old=null,since=null,seconds=0,joined=false;
      for(const r of p.records){
        if(!obj(r)||!time(r.at)||r.at<p.signedAt||old&&r.at-old.at<10||!['central','local'].includes(r.mode)||!Object.hasOwn(CivilNation.charters,r.charter)||![0,1,2].includes(r.staff)||typeof r.paid!=='boolean'||typeof r.service!=='boolean'||r.paid&&r.staff!==2||r.service&&!r.paid||!same(r.costs,r.paid?CivilAccession.fee(r.mode,r.charter):{}))fail();
        if(r.service){if(since!==null&&old?.service&&r.at-old.at===10&&r.mode===old.mode&&r.charter===old.charter)seconds=Math.min(600,seconds+10);else {since=r.at;seconds=0;}}else {since=null;seconds=0;}
        if(p.joinedAt!==null&&r.at<=p.joinedAt&&p.joinedAt-r.at<10&&seconds===600&&since===p.joiningStableSince)joined=true;old=r;
      }
      if(p.lastSettledAt!==(old?.at??null)||p.stableSince!==since||p.stableSeconds!==seconds)fail();
      if(p.joinedAt===null){if(p.admission!==null||p.joiningStableSince!==null)fail();}else if(!joined||p.joinedAt<p.signedAt||!same(p.admission,CivilPartnershipContent.admission)||this.completed(s,id,p.joinedAt)<3)fail();
    }
    let prior=null;
    for(const [i,p]of d.plans.entries()){
      if(!obj(p)||p.id!==i+1||!d.partners[p.sourceId]||!time(p.at)||p.at<d.partners[p.sourceId].signedAt||p.limit!==3||!nullable(p.cancelledAt)||p.cancelledAt!==null&&p.cancelledAt<p.at)fail();
      const orders=d.orders.filter(o=>o.planId===p.id);if(orders.length>3||orders.some(o=>o.sourceId!==p.sourceId||o.departedAt<p.at||p.cancelledAt!==null&&o.departedAt>p.cancelledAt))fail();
      if(prior&&(prior.cancelledAt===null?d.orders.filter(o=>o.planId===prior.id&&o.departedAt<=p.at).length!==3:p.at<prior.cancelledAt))fail();prior=p;
    }
    prior=null;
    for(const [i,o]of d.orders.entries()){
      if(!obj(o)||o.id!==i+1||!Number.isSafeInteger(o.planId)||!d.plans[o.planId-1]||o.sourceId!==d.plans[o.planId-1].sourceId||o.assetId!==CivilCommerce.asset(s).id||!time(o.departedAt)||o.departedAt<CivilCommerce.asset(s).completedAt||!nullable(o.arrivedAt)||!nullable(o.returnedAt)||!time(o.lastMovedAt)||d.lastTickAt===null||d.lastTickAt<o.lastMovedAt||!same(o.paid,this.paid())||![null,true,false].includes(o.exchange)||prior&&(prior.returnedAt===null||o.departedAt<=prior.returnedAt||o.planId<prior.planId))fail();
      const duration=this.duration(o.sourceId);if(![o.outboundSeconds,o.inboundSeconds].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=duration)||o.lastMovedAt-o.departedAt<o.outboundSeconds+o.inboundSeconds)fail();
      if(o.arrivedAt===null){if(o.outboundSeconds>=duration||o.inboundSeconds||o.exchange!==null||o.returnedAt!==null||!same(o.cargo,CivilPartnershipContent.cargo))fail();}
      else {if(o.arrivedAt<o.departedAt+duration||o.outboundSeconds!==duration||typeof o.exchange!=='boolean'||o.lastMovedAt-o.arrivedAt<o.inboundSeconds)fail();if(o.returnedAt===null){if(o.inboundSeconds>=duration||!same(o.cargo,o.exchange?CivilPartnershipContent.returns[o.sourceId]:CivilPartnershipContent.cargo))fail();}else if(o.returnedAt<o.arrivedAt+duration||o.inboundSeconds!==duration||o.lastMovedAt!==o.returnedAt||!same(o.cargo,{}))fail();}
      const overlaps=x=>x.departedAt<(o.returnedAt??Infinity)&&o.departedAt<(x.returnedAt??Infinity);
      if([...s.civilization.commerce.orders,...(s.civilization.intercity?.orders||[]),...(s.civilization.frontier?.missions||[])].some(overlaps))fail();prior=o;
    }
  }
};
