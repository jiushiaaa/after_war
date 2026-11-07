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
  reservedTransport(s){return (this.active(s)?2:0)+(typeof CivilFrontier!=='undefined'?CivilFrontier.reservedTransport(s):0)+(typeof CivilIntercity!=='undefined'?CivilIntercity.reservedTransport(s):0)+(typeof CivilPartnership!=='undefined'?CivilPartnership.reservedTransport(s):0);},
  obligation(s){return this.data(s)?1:0;},
  staffed(s){return CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)>=2&&(typeof CivilSecurity==='undefined'||CivilSecurity.staffed(s,this.active(s)));},
  busy(s,corridor){return !!this.active(s)&&this.route(s)?.corridor===corridor||typeof CivilIntercity!=='undefined'&&CivilIntercity.busy(s,corridor)||typeof CivilPartnership!=='undefined'&&CivilPartnership.busy(s,corridor);},
  paid(profile=null,publicDuties=null,works=null){const cost=this.cargo(publicDuties,false,works);for(const extra of [CivilCommerceContent.travelCost,...(profile?[CivilSecurityContent.modes[profile.mode].homeCost]:[])])for(const [k,v]of Object.entries(extra))cost[k]=(cost[k]||0)+v;return cost;},
  cargo(publicDuties=null,returning=false,works=null){const result={...(returning?CivilCommerceContent.returnCargo:CivilCommerceContent.cargo)};for(const [k,v]of Object.entries((returning?publicDuties?.contribution:publicDuties?.grant)||{}))result[k]=(result[k]||0)+v;if(!returning&&works)for(const [k,v]of Object.entries(works.cargo))result[k]=(result[k]||0)+v;return result;},
  publicProfile(s){return typeof CivilAccession!=='undefined'?CivilAccession.profile(s):null;},
  profile(s){return typeof CivilSecurity!=='undefined'?CivilSecurity.profile(s):null;},
  roadProfile(s){return typeof CivilCorridor!=='undefined'?CivilCorridor.profile(s):null;},
  departureDuration(s){return this.roadProfile(s)?.baseDuration||this.route(s).duration;},
  works(s){return typeof CivilCorridor!=='undefined'?CivilCorridor.next(s):null;},
  duration(s,o){return o?.security?.duration||o?.corridor?.baseDuration||this.route(s).duration;},
  agreementReason(s){
    if(!this.available(s))return '请先立国，并与独立来源地签妥居留公约';
    if(!CivilDiplomacy.operational(s))return '请先恢复国家共同法与居留公约的正常履约';
    if(!CivilFinance.political(s))return '请先完成眼下的换届交接与变法';
    if(!this.source(s)||this.source(s).status!=='agreed')return '请先与对方签妥基础协议';
    if(CivilRegions.load(s)+(this.data(s)?0:1)>CivilRegions.capacity(s))return '等待腾出一份空闲的协调容量';
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
    if(!r||r.condition!=='open')return '联络走廊已封闭，候原道路修通';
    if(departing&&CivilIncidents.holds(s,id))return '联络走廊正候在途车队归来检修，暂停发运新车';
    return null;
  },
  dispatchReason(s){
    const reason=this.agreementReason(s);if(reason)return reason;
    if(!this.asset(s))return '请先拨料建造对外商队装备，并分派两名营建工动工';
    if(!this.plan(s))return '尚无待发委托，每次最多可排入六趟';
    if(this.active(s))return '等待本趟商队返程归城';
    if(typeof CivilFrontier!=='undefined'&&CivilFrontier.active(s))return '原商车正在跑旧渡口，请候其归城';
    if(typeof CivilIntercity!=='undefined'&&CivilIntercity.active(s))return '原商车正在跑城际联运，请候其归城';
    if(typeof CivilPartnership!=='undefined'&&CivilPartnership.active(s))return '原商车正在跑地区商约，请候其归城';
    const profile=this.profile(s),security=typeof CivilSecurity!=='undefined'?CivilSecurity.departureReason(s,profile):null;if(security)return security;
    if(!this.staffed(s))return '等待两名空闲运输工（优先保障地区常设路线与迁居客运）';
    const road=this.roadReason(s,true);if(road)return road;
    if(!CivilFinance.reserveCheck(s,'home',this.paid(profile,this.publicProfile(s),this.works(s))))return '本城须备足贸易工具、沿途旅费及居民保底口粮';
    const sourceCost=this.cargo(this.publicProfile(s),true);for(const [k,v]of Object.entries(profile?.sourcePaid||{}))sourceCost[k]=(sourceCost[k]||0)+v;
    if(!CivilDiplomacy.reserve(s,this.sourceId(s),sourceCost))return '对方须先备足交换粮食、护送用度，并留够自家120秒的口粮';
    return null;
  },
  dispatch(s){
    if(this.dispatchReason(s))return false;const d=this.data(s),at=s.civilization.elapsed,p=this.plan(s),profile=this.profile(s),publicDuties=this.publicProfile(s),works=this.works(s),corridor=this.roadProfile(s),paid=this.paid(profile,publicDuties,works);
    CivilServices.pay(s.stores,paid);
    if(profile)CivilServices.pay(this.source(s).stores,profile.sourcePaid);
    d.orders.push({id:d.nextId++,planId:p.id,assetId:this.asset(s).id,departedAt:at,arrivedAt:null,returnedAt:null,outboundSeconds:0,inboundSeconds:0,lastMovedAt:at,exchange:null,paid:{...paid},cargo:this.cargo(publicDuties,false,works),...(profile?{security:profile}:{}),...(publicDuties?{publicDuties}:{}),...(works?{works}:{}),...(corridor?{corridor}:{})});
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
        const returning=this.cargo(o.publicDuties||null,true);o.arrivedAt=at;if(typeof CivilCorridor!=='undefined')CivilCorridor.receive(s,o);o.exchange=CivilDiplomacy.reserve(s,d.sourceId,returning);
        if(o.exchange){
          const stores=this.source(s).stores;CivilServices.pay(stores,returning);
          for(const [k,v]of Object.entries(o.cargo))stores[k]=(stores[k]||0)+v;
          o.cargo=returning;
          Civilization.notify(CivilDiplomacy.name(d.sourceId)+(o.publicDuties?'收下贸易工具与随车补助，交出交换食物与地方贡献'+returning.food+'。':'收下工具12，交出食物120。')+'食物正随商队返程，抵城后方才入库。');
        }else Civilization.notify(CivilDiplomacy.name(d.sourceId)+'眼下存粮吃紧，本趟未能成交。贸易工具与随车补助原车拉回，已耗用的沿途旅费不退。');
      }
    }else {
      o.inboundSeconds++;
      if(o.inboundSeconds===duration){for(const [k,v]of Object.entries(o.cargo))s.stores[k]=(s.stores[k]||0)+v;o.cargo={};o.returnedAt=at;if(o.security?.sourceGuard)CivilOrigins.assign(s,d.sourceId);Civilization.notify(o.exchange?'商队归城，换回的食物'+this.cargo(o.publicDuties||null,true).food+'已卸入本城原仓。':'商队归城，未成交的工具与随车补助已退回原仓。');}
    }
  },
  status(s){
    const d=this.data(s),o=this.active(s),p=this.plan(s);if(!d)return this.agreementReason(s)||'双方可支取知识登记贸易，各自户籍与仓库照旧独立';
    const base=CivilDiplomacy.name(d.sourceId)+' · 累计归城'+d.orders.filter(x=>x.returnedAt!==null).length+'趟；';
    if(o){const duration=this.duration(s,o),delay=(o.security?.delay||0)-(o.security?.encounterSeconds||0),encounter=delay>0&&o.outboundSeconds===Math.floor(duration/2)&&o.arrivedAt===null;
      return base+(this.roadReason(s)||(!this.staffed(s)?'等待配齐运输与护送班组':encounter?'护送队正在驱离沿途兽群，还需'+delay+'秒':o.arrivedAt===null?'工具运往对方途中，尚余'+(duration-o.outboundSeconds+delay)+'秒':(o.exchange?'食物':'未成交工具')+'返程中，尚余'+(duration-o.inboundSeconds)+'秒'))+'；'+(o.publicDuties?'随车装载 '+CivilHistory.costText(o.cargo)+'；':'')+(p?'本批尚余'+(p.limit-d.orders.filter(x=>x.planId===p.id).length)+'趟未发车':'不再追加发车');}
    const project=CivilServices.data(s,'home')?.project;
    if(!this.asset(s)&&project?.type==='foreigncaravan'&&project.status!=='complete')return base+'商队装备尚余'+project.remaining+'秒施工，请前往炉火城页分派两名营建工';
    return base+(p?'本批尚余'+(p.limit-d.orders.filter(x=>x.planId===p.id).length)+'趟未发车；':'')+(this.dispatchReason(s)||'班组与货品就绪，候命启程');
  },
  event(id,done){
    if(id!=='foreignCommerce')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'条件已有变动，本次未执行；请核对双方供养、在建工程与共同法运转状态。')();
    if(!d)buttons.sign={text:'双方实付登记贸易',nextScene:'end',onChoose:()=>finish(this.sign(s),'贸易约定已登记在册，占用一份协调容量。双方户籍与仓库保持独立。')};
    else if(!this.asset(s)){if(CivilServices.projectAvailable(s,'home')&&CivilServices.facilityGate(s,'home','foreigncaravan'))buttons.build={text:'实付筹办商队装备',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'home','foreigncaravan'),'造车建材已支取，请前往炉火城页分派两名营建工动工。装备落成后方能发车。')};}
    else if(this.plan(s))buttons.cancel={text:'撤销尚未出发的委托',nextScene:'end',onChoose:()=>finish(this.cancel(s),'未发车的剩余委托已撤销。已在途的商队照常跑完往返，已耗旅费不退。')};
    else buttons.schedule={text:'委托最多六趟实物贸易',nextScene:'end',onChoose:()=>finish(this.schedule(s),'已排入六趟商队委托，每趟实际发车时才支取货品与旅费；条件不足时就地候命。')};
    buttons.close={text:'合上贸易账册',nextScene:'end',onChoose:done('两地原仓与在途货单继续各自记账。')};
    const active=this.active(s),publicDuties=active?active.publicDuties:this.publicProfile(s),profile=active?.security||this.profile(s),text=[this.status(s)+'。'];
    if(!d)text.push('立约需支取：本城知识60、对方30；两地照旧自管仓库与户籍。');
    if(!this.asset(s))text.push('打造商队装备需耗木80、钢60、零件20、工具10；由两名营建工动工360秒。');
    text.push('每趟以工具12换回食物120，沿途另耗食物6、木2、工具0.1、零件0.1。需抽调两名空闲运输工，'+(this.route(s)?'原路基础单程'+this.route(s).duration+'秒。':'')+'抵站交割，归城入库；若对方存粮不足以交割，原货随车拉回，已耗旅费不退。');
    if(profile)text.push(CivilSecurityContent.modes[profile.mode].name+'：单程'+profile.duration+'秒，另耗 '+CivilHistory.costText(CivilSecurityContent.modes[profile.mode].homeCost)+(profile.delay?'，去程需在途中停留'+profile.delay+'秒驱离兽群。':'。'));
    if(active?.works)text.push('本趟顺道捎带工程建材 '+CivilHistory.costText(active.works.cargo)+'，运抵后直接划入道路工程保管账。');
    if(active?.corridor)text.push('本趟凭发车时的驿站维护记录通行，基础单程'+active.corridor.baseDuration+'秒；发车后驿站维护若有变动，不更改本趟耗时。');
    if(publicDuties)text.push((active?'本趟按发车约定另捎去 ':'加盟另捎去 ')+CivilHistory.costText(publicDuties.grant)+'；来源地另回交贡献 '+CivilHistory.costText(publicDuties.contribution)+'，随原车运抵后入仓。');
    text[text.length-1]+=' 遇封路或人手缺额则暂停发车；每批最多排入六趟，未发车的委托可随时撤销。已在途的货单照常跑完，若国家治理中断则暂停发运新车。';
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
      if(!obj(o)||o.id!==i+1||!Number.isSafeInteger(o.planId)||o.planId<1||o.planId>d.plans.length||!asset||o.assetId!==asset.id||!time(o.departedAt)||o.departedAt<asset.completedAt||!nullable(o.arrivedAt)||!nullable(o.returnedAt)||!time(o.lastMovedAt)||o.lastMovedAt<o.departedAt||!same(o.paid,this.paid(o.security||null,o.publicDuties||null,o.works||null))||!obj(o.cargo)||![null,true,false].includes(o.exchange)||prior&&(prior.returnedAt===null||o.departedAt<=prior.returnedAt||o.planId<prior.planId))fail();
      if(![o.outboundSeconds,o.inboundSeconds].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=duration)||o.lastMovedAt-o.departedAt<o.outboundSeconds+o.inboundSeconds||d.lastTickAt===null||d.lastTickAt<o.lastMovedAt)fail();
      if(o.arrivedAt===null){if(o.outboundSeconds>=duration||o.inboundSeconds!==0||o.exchange!==null||o.returnedAt!==null||!same(o.cargo,this.cargo(o.publicDuties||null,false,o.works||null)))fail();}
      else {
        if(o.arrivedAt<o.departedAt+duration||o.outboundSeconds!==duration||typeof o.exchange!=='boolean'||o.lastMovedAt<o.arrivedAt||o.lastMovedAt-o.arrivedAt<o.inboundSeconds)fail();
        if(o.returnedAt===null){if(o.inboundSeconds>=duration||!same(o.cargo,this.cargo(o.publicDuties||null,o.exchange)))fail();}
        else if(o.returnedAt<o.arrivedAt+duration||o.inboundSeconds!==duration||o.lastMovedAt!==o.returnedAt||!same(o.cargo,{}))fail();
      }
      prior=o;
    }
  }
};
