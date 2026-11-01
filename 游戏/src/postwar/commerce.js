/* MPL-2.0 — One real caravan, independent warehouses and bounded trade instructions. */
var CivilCommerce={
  pendingIds:['foreignCommerce'],
  data(s){return s.civilization.commerce;},
  available(s){return Number.isSafeInteger(s.civilization.nation?.foundedAt)&&!!s.civilization.diplomacy;},
  asset(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='foreigncaravan');},
  sourceId(s){return this.data(s)?.sourceId||s.civilization.diplomacy?.sourceId;},
  source(s){return s.civilization.origins?.nodes[this.sourceId(s)];},
  route(s){return CivilCommerceContent.routes[this.sourceId(s)];},
  active(s){const o=this.data(s)?.orders.at(-1);return o&&o.returnedAt===null?o:null;},
  plan(s){const d=this.data(s),p=d?.plans.at(-1);return p&&p.cancelledAt===null&&d.orders.filter(o=>o.planId===p.id).length<p.limit?p:null;},
  reservedTransport(s){return (this.active(s)?2:0)+(typeof CivilFrontier!=='undefined'?CivilFrontier.reservedTransport(s):0);},
  obligation(s){return this.data(s)?1:0;},
  staffed(s){return CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)>=2&&(typeof CivilSecurity==='undefined'||CivilSecurity.staffed(s,this.active(s)));},
  busy(s,corridor){return !!this.active(s)&&this.route(s)?.corridor===corridor;},
  paid(profile=null,publicDuties=null){const cost=this.cargo(publicDuties);for(const extra of [CivilCommerceContent.travelCost,...(profile?[CivilSecurityContent.modes[profile.mode].homeCost]:[])])for(const [k,v]of Object.entries(extra))cost[k]=(cost[k]||0)+v;return cost;},
  cargo(publicDuties=null,returning=false){const result={...(returning?CivilCommerceContent.returnCargo:CivilCommerceContent.cargo)};for(const [k,v]of Object.entries((returning?publicDuties?.contribution:publicDuties?.grant)||{}))result[k]=(result[k]||0)+v;return result;},
  publicProfile(s){return typeof CivilAccession!=='undefined'?CivilAccession.profile(s):null;},
  profile(s){return typeof CivilSecurity!=='undefined'?CivilSecurity.profile(s):null;},
  duration(s,o){return o?.security?.duration||this.route(s).duration;},
  agreementReason(s){
    if(!this.available(s))return '先成立国家并签订独立来源居留公约';
    if(!CivilDiplomacy.operational(s))return '先恢复国家与居留公约的实际履约';
    if(!CivilFinance.political(s))return '先完成现有继任与改制';
    if(!this.source(s)||this.source(s).status!=='agreed')return '先完成对方基础协议';
    if(CivilRegions.load(s)+(this.data(s)?0:1)>CivilRegions.capacity(s))return '等待一份空余协调责任';
    return typeof CivilAccession!=='undefined'?CivilAccession.tradeReason(s):null;
  },
  sign(s){
    const id=this.sourceId(s),cost=CivilCommerceContent.signature;
    if(this.data(s)||this.agreementReason(s)||!CivilDiplomacy.reserve(s,'home',cost.home)||!CivilDiplomacy.reserve(s,id,cost.source))return false;
    CivilServices.pay(s.stores,cost.home);CivilServices.pay(this.source(s).stores,cost.source);
    s.civilization.commerce={schema:1,sourceId:id,signedAt:s.civilization.elapsed,signature:JSON.parse(JSON.stringify(cost)),plans:[],orders:[],nextId:1,lastTickAt:null};return true;
  },
  schedule(s){
    const d=this.data(s);if(!d||this.plan(s)||!this.asset(s)||this.agreementReason(s))return false;
    d.plans.push({id:d.plans.length+1,at:s.civilization.elapsed,limit:6,cancelledAt:null});return true;
  },
  cancel(s){const p=this.plan(s);if(!p)return false;p.cancelledAt=s.civilization.elapsed;return true;},
  roadReason(s,departing=false){
    const id=this.route(s)?.corridor,r=s.civilization.regions?.routes[id];
    if(!r||r.condition!=='open')return '联络走廊封闭，等待原道路修复';
    if(departing&&CivilIncidents.holds(s,id))return '联络走廊正在等待车队归来检修，暂停新发车';
    return null;
  },
  dispatchReason(s){
    const reason=this.agreementReason(s);if(reason)return reason;
    if(!this.asset(s))return '先实付建造对外商队装备，并安排两名营建工施工';
    if(!this.plan(s))return '尚无剩余委托，可安排最多六趟';
    if(this.active(s))return '等待本趟商队返程';
    if(typeof CivilFrontier!=='undefined'&&CivilFrontier.active(s))return '原商车正在渡口往返，等待原车返城';
    const profile=this.profile(s),security=typeof CivilSecurity!=='undefined'?CivilSecurity.departureReason(s,profile):null;if(security)return security;
    if(!this.staffed(s))return '等待两名空闲运输工；地区与客运班组优先';
    const road=this.roadReason(s,true);if(road)return road;
    if(!CivilFinance.reserveCheck(s,'home',this.paid(profile,this.publicProfile(s))))return '本城须备足工具、旅费与居民供养储备';
    const sourceCost=this.cargo(this.publicProfile(s),true);for(const [k,v]of Object.entries(profile?.sourcePaid||{}))sourceCost[k]=(sourceCost[k]||0)+v;
    if(!CivilDiplomacy.reserve(s,this.sourceId(s),sourceCost))return '对方须先备足交换食物、护送费用和自身120秒供养';
    return null;
  },
  dispatch(s){
    if(this.dispatchReason(s))return false;const d=this.data(s),at=s.civilization.elapsed,p=this.plan(s),profile=this.profile(s),publicDuties=this.publicProfile(s),paid=this.paid(profile,publicDuties);
    CivilServices.pay(s.stores,paid);
    if(profile)CivilServices.pay(this.source(s).stores,profile.sourcePaid);
    d.orders.push({id:d.nextId++,planId:p.id,assetId:this.asset(s).id,departedAt:at,arrivedAt:null,returnedAt:null,outboundSeconds:0,inboundSeconds:0,lastMovedAt:at,exchange:null,paid:{...paid},cargo:this.cargo(publicDuties),...(profile?{security:profile}:{}),...(publicDuties?{publicDuties}:{})});
    if(profile?.sourceGuard)CivilOrigins.assign(s,this.sourceId(s));return true;
  },
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastTickAt!==null&&at<=d.lastTickAt)return;
    d.lastTickAt=at;const o=this.active(s);if(!o){this.dispatch(s);return;}
    if(!this.staffed(s)||this.roadReason(s))return;
    o.lastMovedAt=at;const duration=this.duration(s,o);if(typeof CivilSecurity!=='undefined'&&CivilSecurity.delay(s,o))return;
    if(o.arrivedAt===null){
      o.outboundSeconds++;
      if(o.outboundSeconds===duration){
        const returning=this.cargo(o.publicDuties||null,true);o.arrivedAt=at;o.exchange=CivilDiplomacy.reserve(s,d.sourceId,returning);
        if(o.exchange){
          const stores=this.source(s).stores;CivilServices.pay(stores,returning);
          for(const [k,v]of Object.entries(o.cargo))stores[k]=(stores[k]||0)+v;
          o.cargo=returning;
          Civilization.notify(CivilDiplomacy.name(d.sourceId)+(o.publicDuties?'收到贸易工具与约定补助，付出交换食物和地方贡献'+returning.food+'。':'收到工具12，付出食物120。')+'食物仍随商队返程，尚未进入本城仓库。');
        }else Civilization.notify(CivilDiplomacy.name(d.sourceId)+'当前供养储备不足，未成交。原工具与随车补助返回，旅费已经消耗。');
      }
    }else {
      o.inboundSeconds++;
      if(o.inboundSeconds===duration){for(const [k,v]of Object.entries(o.cargo))s.stores[k]=(s.stores[k]||0)+v;o.cargo={};o.returnedAt=at;if(o.security?.sourceGuard)CivilOrigins.assign(s,d.sourceId);Civilization.notify(o.exchange?'商队返城，食物'+this.cargo(o.publicDuties||null,true).food+'已进入本城原仓。':'商队返城，未成交的原工具与随车补助已归还。');}
    }
  },
  status(s){
    const d=this.data(s),o=this.active(s),p=this.plan(s);if(!d)return this.agreementReason(s)||'双方可实付登记贸易，居民与仓库仍各自独立';
    const base=CivilDiplomacy.name(d.sourceId)+' · 已返城'+d.orders.filter(x=>x.returnedAt!==null).length+'趟；';
    if(o){const duration=this.duration(s,o),delay=(o.security?.delay||0)-(o.security?.encounterSeconds||0),encounter=delay>0&&o.outboundSeconds===Math.floor(duration/2)&&o.arrivedAt===null;
      return base+(this.roadReason(s)||(!this.staffed(s)?'等待完整运输与护送班组':encounter?'护送队正在驱离兽群，还需'+delay+'秒':o.arrivedAt===null?'工具运出途中，尚余'+(duration-o.outboundSeconds+delay)+'秒':(o.exchange?'食物':'未成交工具')+'返程，尚余'+(duration-o.inboundSeconds)+'秒'))+'；'+(o.publicDuties?'随车 '+CivilHistory.costText(o.cargo)+'；':'')+(p?'本批尚余'+(p.limit-d.orders.filter(x=>x.planId===p.id).length)+'趟未启程':'不再追加出发');}
    const project=CivilServices.data(s,'home')?.project;
    if(!this.asset(s)&&project?.type==='foreigncaravan'&&project.status!=='complete')return base+'商队装备实际施工剩余'+project.remaining+'秒，请在聚落安排两名营建工';
    return base+(p?'本批尚余'+(p.limit-d.orders.filter(x=>x.planId===p.id).length)+'趟未启程；':'')+(this.dispatchReason(s)||'班组与物资就绪，等待启程');
  },
  event(id,done){
    if(id!=='foreignCommerce')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'条件已经变化，未执行；请核对双方供养、工程和共同法。')();
    if(!d)buttons.sign={text:'双方实付登记贸易',nextScene:'end',onChoose:()=>finish(this.sign(s),'贸易约定已登记，占用一份协调责任。双方人口与仓库保持独立。')};
    else if(!this.asset(s)){if(CivilServices.projectAvailable(s,'home')&&CivilServices.facilityGate(s,'home','foreigncaravan'))buttons.build={text:'实付筹办商队装备',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'home','foreigncaravan'),'商队材料已支付，请在聚落安排两名营建工。完工后才能出发。')};}
    else if(this.plan(s))buttons.cancel={text:'撤销尚未出发的委托',nextScene:'end',onChoose:()=>finish(this.cancel(s),'剩余委托已撤销。已出发的商队照常完成往返，旅费不退。')};
    else buttons.schedule={text:'委托最多六趟实物贸易',nextScene:'end',onChoose:()=>finish(this.schedule(s),'已登记六趟委托，每次实际发车才支付货物与旅费；条件不足时等待。')};
    buttons.close={text:'合上贸易账册',nextScene:'end',onChoose:done('双方的原仓库与在途回执继续记账。')};
    const active=this.active(s),publicDuties=active?active.publicDuties:this.publicProfile(s),profile=active?.security||this.profile(s),text=[this.status(s)+'。'];
    if(!d)text.push('登记实付：本城知识60、对方30；双方保留原仓库与居民。');
    if(!this.asset(s))text.push('商队装备实耗木80、钢60、零件20、工具10；两名营建工施工360秒。');
    text.push('每趟工具12交换食物120，另耗食物6、木2、工具0.1、零件0.1。两名现有空闲运输工，'+(this.route(s)?'基础单程'+this.route(s).duration+'秒。':'')+'到达才交换，返城才入库；对方储备不足，原货返回，旅费不退。');
    if(profile)text.push(CivilSecurityContent.modes[profile.mode].name+'：单程'+profile.duration+'秒，另耗 '+CivilHistory.costText(CivilSecurityContent.modes[profile.mode].homeCost)+(profile.delay?'，去程另停'+profile.delay+'秒驱离。':'。'));
    if(publicDuties)text.push((active?'本趟按出发约定另送 ':'加盟另送 ')+CivilHistory.costText(publicDuties.grant)+'；来源另交 '+CivilHistory.costText(publicDuties.contribution)+'，随原车实际到货。');
    text[text.length-1]+=' 封路或缺员暂停；每批最多六趟，可撤销未发委托。在途承诺保留，治理中断暂停新发车。';
    return {title:typeof CivilAccession!=='undefined'&&CivilAccession.population(s)?'加盟聚居圈贸易与公共收支':'独立聚居圈实物贸易',text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#commerceButton').hide();$('#commerceSummary').hide();return;}
    const label=typeof CivilAccession!=='undefined'&&CivilAccession.population(State)?'聚居圈贸易与公共收支':'对外实物贸易',button=Civilization.button('commerceButton',label,'#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='foreignCommerce';Civilization.showPending();});button.show().contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(label));
    let line=$('#commerceSummary');if(!line.length)line=$('<div>').attr('id','commerceSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const c=s.civilization,d=this.data(s),asset=this.asset(s),project=CivilServices.data(s,'home')?.project,construction=asset||(project?.type==='foreigncaravan'?project:null),fail=()=>{throw Error('对外贸易与在途货物记录无效');};
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=c.elapsed,nullable=x=>x===null||time(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(construction&&(!d||construction.startedAt<d.signedAt))fail();
    if(d===undefined){if(this.pendingIds.includes(c.pending)&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||d.sourceId!==c.diplomacy.sourceId||!Object.hasOwn(CivilCommerceContent.routes,d.sourceId)||!time(d.signedAt)||d.signedAt<c.diplomacy.signedAt||!same(d.signature,CivilCommerceContent.signature)||!Array.isArray(d.plans)||!Array.isArray(d.orders)||d.nextId!==d.orders.length+1||!nullable(d.lastTickAt)||d.lastTickAt!==null&&d.lastTickAt<d.signedAt)fail();
    let prior=null;
    for(const [i,p]of d.plans.entries()){
      if(!obj(p)||p.id!==i+1||!time(p.at)||p.at<d.signedAt||!asset||p.at<asset.completedAt||p.limit!==6||!nullable(p.cancelledAt)||p.cancelledAt!==null&&p.cancelledAt<p.at||prior&&p.at<prior.at)fail();
      const orders=d.orders.filter(o=>o.planId===p.id);if(orders.length>6||orders.some(o=>o.departedAt<p.at||p.cancelledAt!==null&&o.departedAt>p.cancelledAt))fail();
      if(prior&&prior.cancelledAt===null&&d.orders.filter(o=>o.planId===prior.id&&o.departedAt<=p.at).length!==6||prior?.cancelledAt!==null&&prior&&p.at<prior.cancelledAt)fail();prior=p;
    }
    prior=null;
    for(const [i,o]of d.orders.entries()){
      if(typeof CivilSecurity!=='undefined')CivilSecurity.validateOrder(s,o);
      if(typeof CivilAccession!=='undefined')CivilAccession.validateOrder(s,o);
      const duration=this.duration(s,o);
      if(!obj(o)||o.id!==i+1||!Number.isSafeInteger(o.planId)||o.planId<1||o.planId>d.plans.length||!asset||o.assetId!==asset.id||!time(o.departedAt)||o.departedAt<asset.completedAt||!nullable(o.arrivedAt)||!nullable(o.returnedAt)||!time(o.lastMovedAt)||o.lastMovedAt<o.departedAt||!same(o.paid,this.paid(o.security||null,o.publicDuties||null))||!obj(o.cargo)||![null,true,false].includes(o.exchange)||prior&&(prior.returnedAt===null||o.departedAt<=prior.returnedAt||o.planId<prior.planId))fail();
      if(![o.outboundSeconds,o.inboundSeconds].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=duration)||o.lastMovedAt-o.departedAt<o.outboundSeconds+o.inboundSeconds||d.lastTickAt===null||d.lastTickAt<o.lastMovedAt)fail();
      if(o.arrivedAt===null){if(o.outboundSeconds>=duration||o.inboundSeconds!==0||o.exchange!==null||o.returnedAt!==null||!same(o.cargo,this.cargo(o.publicDuties||null)))fail();}
      else {
        if(o.arrivedAt<o.departedAt+duration||o.outboundSeconds!==duration||typeof o.exchange!=='boolean'||o.lastMovedAt<o.arrivedAt||o.lastMovedAt-o.arrivedAt<o.inboundSeconds)fail();
        if(o.returnedAt===null){if(o.inboundSeconds>=duration||!same(o.cargo,this.cargo(o.publicDuties||null,o.exchange)))fail();}
        else if(o.returnedAt<o.arrivedAt+duration||o.inboundSeconds!==duration||o.lastMovedAt!==o.returnedAt||!same(o.cargo,{}))fail();
      }
      prior=o;
    }
  }
};
