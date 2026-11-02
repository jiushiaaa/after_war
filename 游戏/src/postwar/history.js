/* MPL-2.0 — Read-only views of existing records; no saved history or simulation hooks. */
var CivilHistory={
  PAGE_SIZE:6,
  categories:{tenures:'全部任期',policy:'配给抉择',governance:'制度议决',technology:'科技',cities:'城市与镇制',agreements:'来源协议',projects:'竣工工程',budgets:'共同约定',metro:'城市群',nation:'国家共同法',diplomacy:'对外公约',transport:'国家交通',incidents:'道路抉择',heating:'供暖交接',relief:'地方救济',culture:'社群公共空间',cooperative:'作坊经营',ruins:'遗迹探索'},
  unknownDate:'已有成果，原存档未记达成年份',
  available(s){const c=s?.civilization;return !!c&&(c.settled===true||Object.values(c.tech||{}).some(v=>v===true)||(c.society?.history?.length||0)>0);},
  time(s,value){return Number.isFinite(value)&&value>=0&&value<=s.civilization.elapsed?value:null;},
  place(s,id){return id==='home'?(s.civilization.urban?.city?'炉火城':'本地聚落'):(typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.name:null)||id;},
  knownPlace(s,id){return id==='home'||s.civilization.regions?.nodes[id]?.discovered===true;},
  sourceName(id){return (typeof CivilOriginContent!=='undefined'?CivilOriginContent[id]?.name:null)||id;},
  facility(type){return (typeof CivilServiceContent!=='undefined'?CivilServiceContent.facilities[type]?.name:null)||(typeof CivilMunicipalContent!=='undefined'?CivilMunicipalContent.facilities[type]?.name:null)||(typeof CivilAdvancedContent!=='undefined'?CivilAdvancedContent.facilities[type]?.name:null)||type;},
  policyName(value){return value===null?'尚未议定':(typeof CivilRules!=='undefined'?CivilRules.policies[value]?.name:null)||value;},
  axisName(axis,value){return (typeof CivilSociety!=='undefined'?CivilSociety.axes[axis]?.choices[value]?.name:null)||value;},
  costText(cost){
    const labels={spaceparts:'航天组件',lifesupport:'生命保障组件',chemicals:'基础化学品',robots:'通用机器人',electronics:'电子元件',precisionparts:'精密零件',scrap:'废料',food:'粮食',wood:'木料',iron:'铁',steel:'钢材',glass:'玻璃',parts:'零件',tools:'工具',knowledge:'知识',medicine:'药品',coal:'煤'};
    return Object.entries(cost||{}).filter(([,n])=>Number.isFinite(n)&&n>0).map(([id,n])=>(labels[id]||id)+' '+Number(n.toFixed(6))).join('、');
  },
  snapshot(s){
    const c=s.civilization||{},x=c.society,entries=[],seen=new Set(),year=Math.floor((c.elapsed||0)/600);
    const add=(key,category,title,detail='',at=null,extra={})=>{
      if(seen.has(key))return;seen.add(key);
      entries.push({key,category,title,detail,at:this.time(s,at),...extra});
    };
    for(const h of x?.history||[]){
      const reason={death:'因前任离世而完成交接',retirement:'退休交接',election:'选举交接',regency:'摄政结束后的交接'}[h.reason]||'职责交接';
      add('tenure_'+h.generation,'tenures','第'+h.generation+'任 '+h.title,'交接时'+h.age+'岁；'+reason+'。',null,{generation:h.generation,from:h.from,to:h.to,current:false});
    }
    let current=null;
    if(x?.leader){
      const leader=x.leader,detail=leader.alive?'现任，'+leader.age+'岁。':'已经离世，等待交接；现存记录未记离世年份。';
      current={title:'第'+x.generation+'任 '+leader.title,detail,from:leader.started};
      add('tenure_'+x.generation,'tenures',current.title,detail,null,{generation:x.generation,from:leader.started,to:null,current:true});
    }
    const decisions=c.decisions,baseline=decisions?.baseline||{policy:c.policy||null,axes:x?.axes||{}};
    if(baseline.policy)add('policy_baseline','policy',this.policyName(baseline.policy),'接入时已有的配给；原档未记采纳时间与此前变更。');
    for(const [axis,value]of Object.entries(baseline.axes))add('governance_baseline_'+axis,'governance',this.axisName(axis,value),'接入时已有的制度；原档未记确立时间与此前变更。');
    for(const r of decisions?.records||[]){
      const term='第'+r.generation+'任期间。',key='decision_'+r.id;
      if(r.kind==='policy')add(key,'policy',r.from===null?'初次议定配给':'调整配给',term+this.policyName(r.from)+' → '+this.policyName(r.to)+'。口粮与产出按新配给持续结算。',r.at);
      else {
        const axisTitle=typeof CivilSociety!=='undefined'?CivilSociety.axes[r.axis]?.title:r.axis;
        const previous=this.axisName(r.axis,r.from),next=this.axisName(r.axis,r.to);
        const reference=r.proposalId===0?'承接原存档中已预留的改革；原动议时间未知。':'承接第'+r.proposalId+'号动议。';
        if(r.kind==='founding')add(key,'governance','确立：'+axisTitle,term+'初次采用'+next+'。行政职责按制度持续结算。',r.at);
        if(r.kind==='proposal')add(key,'governance','第'+r.id+'号动议：'+axisTitle,term+'现制为'+previous+'；实际预留'+r.knowledge+'知识，尚未改制。',r.at);
        if(r.kind==='reform')add(key,'governance','改制：'+axisTitle,term+previous+' → '+next+'。'+reference+'预留的'+r.knowledge+'知识转为改制支出，不再次扣款。',r.at);
        if(r.kind==='cancel')add(key,'governance','保留现制：'+axisTitle,term+'继续采用'+previous+'。'+reference+'实际退回'+r.knowledge+'知识。',r.at);
      }
    }
    for(const [id,learned]of Object.entries(c.tech||{}))if(learned===true)add('technology_'+id,'technology',(typeof CivilText!=='undefined'?CivilText.research[id]?.name:null)||id,'已完成研究。');
    if(c.settled)add('settlement_home','cities','聚落形成','炉火、口粮与分工曾达到稳定条件。');
    if(c.urban?.chartered)add('town_home','cities','本地镇制登记','公共职责已经写入镇制。');
    if(c.urban?.city)add('city_home','cities','炉火城登记','第一座城市的公共职责已经登记。');
    for(const [id,m]of Object.entries(c.municipal?.nodes||{})){
      if(!this.knownPlace(s,id))continue;
      if(m.town)add('town_'+id,'cities',this.place(s,id)+'镇制登记');
      if(m.city)add('city_'+id,'cities',this.place(s,id)+'城市登记');
      for(const p of m.completed||[])add('municipal_'+id+'_'+p.id,'projects',this.place(s,id)+' · '+this.facility(p.type),'市政营建竣工记录。',p.completedAt);
    }
    for(const [id,n]of Object.entries(c.origins?.nodes||{})){
      // Unknown societies may already have built classrooms; their private records are
      // not revealed until actual contact has happened.
      if(!['contacted','agreed'].includes(n.status))continue;
      if(n.status==='agreed'&&n.permit?.paid){
        const a=n.agreement,home=this.costText(a?.home),source=this.costText(a?.source);
        add('origin_agreement_'+id,'agreements',this.sourceName(id)+'迁居协议','累计迁居额度'+n.permit.limit+'人；已抵达'+n.admitted+'人。'+(home?'本地实付：'+home+'。':'')+(source?'来源实付：'+source+'。':''),a?.agreedAt);
      }
      for(const [i,p]of (n.schooling?.completed||[]).entries())add('origin_school_'+id+'_'+(i+1),'projects',this.sourceName(id)+' · 第'+(i+1)+'次学舍扩班','来源自付：'+this.costText(p.paid)+'。',p.completedAt);
    }
    for(const [id,m]of Object.entries(c.services?.nodes||{})){
      if(!this.knownPlace(s,id))continue;
      for(const p of m.completed||[])add('services_'+id+'_'+p.id,'projects',this.place(s,id)+' · '+this.facility(p.type),'公用工程竣工记录。'+(p.paid?'实付：'+this.costText(p.paid)+'。':''),p.completedAt);
    }
    for(const [id,p]of Object.entries(c.regions?.projects||{}))if(this.knownPlace(s,id)&&p.status==='complete'){
      const name=(typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.project?.name:null)||this.place(s,id)+'公共工程';
      add('public_project_'+id,'projects',name,'公共工程已完成。',p.completedAt);
    }
    for(const [id,p]of Object.entries(c.regions?.upgrades?.projects||{}))if(this.knownPlace(s,id)&&p.status==='complete')add('freight_upgrade_'+id+'_'+p.id,'projects',this.place(s,id)+' · 加固货车','原货车的付费改装已经完成。',p.completedAt);
    for(const a of c.finance?.agreements||[]){
      const members=a.members.map(id=>this.place(s,id)).join('、'),costs=Object.entries(a.approvals||{}).map(([id,n])=>this.place(s,id)+' '+n+'知识').join('；');
      add('common_agreement_'+a.id,'budgets','第'+a.id+'份诊疗与道路互助约定',members+'。议约实际支出：'+costs+'。各地仍保管自己的仓库。',a.approvedAt);
      if(a.exitedAt!==null)add('common_exit_'+a.id,'budgets','第'+a.id+'份互助约定退出','停止新承诺；旧车队和实付记录按原账保留。',a.exitedAt);
    }
    if(c.metro?.formedAt!==null&&Number.isFinite(c.metro?.formedAt)){
      const members=(c.metro.formedMembers||[]).map(id=>this.place(s,id)).join('、');
      add('metro_charter','metro','城市群共同职责登记',members+'。以连续供养和实付互助共同承担公共职责；仍须维持各城服务。',c.metro.formedAt);
    }
    if(c.nation){
      const n=c.nation;
      for(const [id,p]of Object.entries(n.approvals))add('nation_approval_'+id,'nation',this.place(s,id)+'国家议约','当地实付：'+this.costText(p.cost)+'；尚须三城连续筹备与正式批准。',p.at);
      if(n.foundedAt!==null)add('nation_founded','nation',n.foundingAxes.charter==='custom'?'国家惯例盟约生效':'国家宪章生效',n.members.map(id=>this.place(s,id)).join('、')+'；'+Object.entries(n.foundingAxes).map(([axis,value])=>this.axisName(axis,value)).join(' · ')+'。持续经费与治理仍按当期账册执行。',n.foundedAt);
    }
    if(c.diplomacy){
      const d=c.diplomacy,name=this.sourceName(d.sourceId);
      add('residence_pact','diplomacy',name+'居留公约','双方独立建档，本城实付'+this.costText(d.signature.home)+'；对方实付'+this.costText(d.signature.source)+'。来源人口仍独立，资格不等于已经迁入。',d.signedAt);
      for(const r of d.records.filter(r=>r.grant))add('residence_grant_'+r.at,'diplomacy','追加居留资格核准',name+'连续履约600秒，核准24人追加居留资格；实际人口、车辆与住房仍须核对。',r.at);
      d.revisions.forEach((r,i)=>add('residence_revision_'+i,'diplomacy',r.action==='pause'?'居留公约暂停':'居留公约恢复',name+'；原名册与已出发旅客安排保留，追加资格不重发。',r.at));
    }
    for(const [i,r]of (c.railway?.changes||[]).entries())add('railway_change_'+i,'transport',r.mode==='rail'?'铁轨支线班次启用':'铁轨支线恢复货车','原车归来后交接；'+(r.mode==='rail'?'4名运输工，单程45秒，逐趟实付燃料与维护。':'2名运输工，单程90秒；铁路资产和原运单保留。'),r.at);
    if(c.space){
      const u=c.space.unification;if(u)add('earth_charter','nation','地球共同法生效','全球八区连续履约；本城实付 '+this.costText(u.paid)+'。地方名册与公共财政继续独立。',u.at);
      for(const m of c.space.missions){const name=CivilSpaceContent.phases[m.kind].name;add('space_start_'+m.kind,'nation',name+'开始','实付 '+this.costText(m.paid)+'；连续运行仍需人员、电力与维护。',m.startedAt);if(m.completedAt!==null)add('space_done_'+m.kind,'nation',m.kind==='departure'?'地球篇完成：向星空出发':name+'完成',m.kind==='departure'?'无人先遣船出发，地球共同体进入太空时代。载人远征与星际战争不在本版范围。':'实物与连续运行记录已经核对。',m.completedAt);}
    }
    if(c.worldstage){
      for(const m of c.worldstage.missions){const name=CivilWorldContent.regions[m.region].name,action=CivilWorld.missionConfig(m).name;
        add('world_depart_'+m.id,'diplomacy',name+'：'+action,'实付 '+this.costText(m.paid)+'；六名原有勤务人员出发。',m.departedAt);
        if(m.completedAt!==null)add('world_complete_'+m.id,m.kind==='campaign'?'governance':'diplomacy',name+'：'+action+'完成',m.kind==='campaign'?(CivilWorld.missionConfig(m).casualties??60)+'名当地战斗人员死亡，设施余'+(CivilWorld.missionConfig(m).infrastructure??40)+'%。军事占领尚不等于共同法整合。':'实际到达并完成现场工作，结果计入独立地区账册。',m.completedAt);
        if(m.cancelledAt!==null)add('world_recall_'+m.id,'transport','国家行动撤回','沿已行距离返程；旅费不退，仅未交付物资返库。',m.cancelledAt);
      }
      for(const[id,n]of Object.entries(c.worldstage.nodes))if(n.credit?.defaultedAt!==undefined)add('credit_default_'+id,'diplomacy',CivilWorldContent.regions[id].name+'信贷违约','到期未发出还款，抵押工具40转入地方公库，信任下降20；后来清偿也保留此记录。',n.credit.defaultedAt);
      for(const[i,r]of c.worldstage.ledger.entries())if(r.kind==='statecraft'&&['policy','accord','renew'].includes(r.action))add('statecraft_'+i,'diplomacy',r.action==='policy'?'经济制度：'+CivilStatecraftContent.policies[r.mode].name:CivilWorldContent.regions[r.region].name+'：'+(r.action==='accord'?CivilStatecraftContent.regions[r.region].choices[r.choice].name:'重申地区协约'),'实付 '+this.costText(r.cost)+'；持续义务按公共账册执行。',r.at);
      for(const r of c.worldstage.ledger)if(r.kind==='join')add('world_join_'+r.region,'diplomacy',CivilWorldContent.regions[r.region].name+'共同法登记','双方实付议约；原城市网络居民与公共仓库保留。',r.at);
    }
    if(c.commerce){
      const d=c.commerce,name=this.sourceName(d.sourceId);
      add('commerce_agreement','diplomacy',name+'贸易约定','本城实付知识60，对方知识30；居民与库存各自独立，占一份协调责任。',d.signedAt);
      for(const p of d.plans){add('commerce_plan_'+p.id,'transport','六趟商队委托',name+'；每次发车实际扣货物与旅费。',p.at);if(p.cancelledAt!==null)add('commerce_cancel_'+p.id,'transport','剩余商队委托撤销','已经启程的商队继续往返，旅费不退。',p.cancelledAt);}
      for(const o of d.orders){
        add('commerce_depart_'+o.id,'transport','对外商队出发',name+'；本城实付 '+this.costText(o.paid)+'，其中工具12为贸易货物。'+(o.publicDuties?'另含公共补助 '+this.costText(o.publicDuties.grant)+'；其余为旅费与军需。':'其余为旅费与军需。'),o.departedAt);
        if(o.security)add('commerce_security_'+o.id,'transport',CivilSecurityContent.modes[o.security.mode].name,'本城守备'+o.security.homeGuard+'人、来源护路'+o.security.sourceGuard+'人；单程'+o.security.duration+'秒，来源实付 '+this.costText(o.security.sourcePaid)+'。',o.departedAt);
        if(o.security?.delay&&o.arrivedAt!==null)add('commerce_guarded_'+o.id,'transport','护送通行完成','足额班组实际停留'+o.security.encounterSeconds+'秒驱离兽群，商队抵达对方。',o.arrivedAt);
        if(o.publicDuties)add('commerce_public_'+o.id,'nation','约定内公共实物收支','本城随车补助 '+this.costText(o.publicDuties.grant)+'；来源贡献 '+this.costText(o.publicDuties.contribution)+'，各自实际到货才入原仓。',o.departedAt);
        if(o.arrivedAt!==null)add('commerce_exchange_'+o.id,'transport',o.exchange?'对外商队成交':'对方保留供养，商队未成交',o.exchange?'对方实收 '+this.costText(CivilCommerce.cargo(o.publicDuties||null))+'，实付 '+this.costText(CivilCommerce.cargo(o.publicDuties||null,true))+'；食物随车返程。':'原工具与随车补助返回；已消耗旅费与军需不退。',o.arrivedAt);
        if(o.returnedAt!==null)add('commerce_return_'+o.id,'transport','对外商队返城',o.exchange?this.costText(CivilCommerce.cargo(o.publicDuties||null,true))+'进入本城原仓。':'未成交原工具与随车补助归还本城原仓。',o.returnedAt);
      }
    }
    if(c.security){
      const d=c.security;
      d.changes.forEach((r,i)=>add('security_choice_'+i,'transport',CivilSecurityContent.modes[r.mode].name,'方案仅用于此后出发的商队，旧运单不改写。',r.at));
      if(d.pact)add('security_pact','diplomacy','共同护送约定','本城实付知识120、来源60；双方人口与仓库独立，出行仍需真实守备和军需。',d.pact.at);
      const trained=d.records.find(r=>r.readiness===300);if(trained)add('security_training','transport','守备训练准备完成','实际居民在已付费训练场积累300秒准备；继续值勤仍需供给，欠费或缺员会流失准备。',trained.at);
    }
    if(c.accession){const d=c.accession;for(const [id,a]of Object.entries(d.approvals))add('accession_approval_'+id,'nation',(id==='home'?'本城':this.sourceName(d.sourceId))+'加盟议约','实付 '+this.costText(a.cost)+'；当地现有人口与仓库保留。',a.at);if(d.joinedAt!==null)add('accession_joined','nation',this.sourceName(d.sourceId)+'共同法加盟','实际双方议约、当地记录人员和连续履约完成；公共补助与地方贡献仍需原车运输。',d.joinedAt);d.controls.forEach((x,i)=>add('accession_control_'+i,'nation',x.enabled?'恢复加盟共同行政':'暂缓加盟共同行政','人口与历史保留；已启程的实物承诺继续履行。',x.at));}
    if(c.partnership){
      for(const [id,p]of Object.entries(c.partnership.partners)){
        add('partner_sign_'+id,'diplomacy',this.sourceName(id)+'地区商约','双方实付登记，各自保管库存和名册，地方两名成年人承担公共记录。',p.signedAt);
        if(p.joinedAt!==null)add('partner_join_'+id,'nation',this.sourceName(id)+'接纳共同法','三趟实际成交返城及600秒连续履约后双方实付登记；当地居民纳入共同法，仍独立供养。',p.joinedAt);
      }
      for(const o of c.partnership.orders){
        add('partner_depart_'+o.id,'transport',this.sourceName(o.sourceId)+'商队启程','原商车实际携带12工具，旅费另付。',o.departedAt);
        if(o.arrivedAt!==null)add('partner_exchange_'+o.id,'transport',o.exchange?'地区实物成交':'地区商队未成交',o.exchange?this.costText(CivilPartnershipContent.returns[o.sourceId])+'随车返程，尚未入本城仓库。':'对方保留自身供养；原工具返程，旅费不退。',o.arrivedAt);
        if(o.returnedAt!==null)add('partner_return_'+o.id,'transport','地区商队实际返城',o.exchange?'交换货物实际入库。':'原工具实际归还。',o.returnedAt);
      }
    }
    if(c.intercity){
      const d=c.intercity;
      add('intercity_agreement','transport','三城实付联运议约','本城知识60、铁轨30、河谷30；共用原商车，两地货物独立结算。',d.agreedAt);
      for(const o of d.orders){
        add('intercity_depart_'+o.id,'transport','联运原车出发','本城实付旅费 '+this.costText(o.paid)+'。',o.departedAt);
        if(o.pickedAt!==null)add('intercity_pickup_'+o.id,'transport','铁轨零件装车','铁轨仓实扣24零件，货物在途。',o.pickedAt);
        if(o.exchangedAt!==null)add('intercity_exchange_'+o.id,'transport','河谷实物成交','河谷实收24零件、实付120粮；粮食随车回铁轨。',o.exchangedAt);
        if(o.deliveredAt!==null)add('intercity_delivery_'+o.id,'transport','铁轨收到联运粮食','120粮实际进入铁轨原仓。',o.deliveredAt);
        if(o.refundedAt!==null)add('intercity_refund_'+o.id,'transport','未成交零件退回','原24零件实际退回铁轨仓；本城旅费不退。',o.refundedAt);
        if(o.returnedAt!==null)add('intercity_return_'+o.id,'transport','联运空车返城','原商车与两名司机重新可用。',o.returnedAt);
      }
    }
    if(c.corridor){
      const d=c.corridor,name=this.sourceName(d.sourceId);
      add('corridor_agreement','transport',name+'道路筹办','本城实付 '+this.costText(d.signature.home)+'；当地实付 '+this.costText(d.signature.source)+'。工程材料仍须由原商车实运。',d.agreedAt);
      for(const r of d.receipts)add('corridor_receipt_'+r.orderId,'transport','道路建材实际到达','原第'+r.orderId+'号商单交入工程保管账 '+this.costText(r.cargo)+'，普通贸易独立结算。',r.at);
      if(d.completedAt!==null)add('corridor_complete','transport',name+'道路驿站竣工','当地实际施工600秒，消耗已运到材料 '+this.costText(d.consumed)+'；以后须双边持续付费维护，新车才缩短基础路程。',d.completedAt);
    }
    if(c.frontier){
      const d=c.frontier;
      for(const m of d.missions){
        add('ford_depart_'+m.id,'transport',m.kind==='scout'?'旧渡口勘察启程':'四人渡口分队启程','原守备'+m.guards+'人与司机2人，用已有商车携带 '+this.costText(m.paid)+'；消耗与余额分别记账。',m.departedAt);
        if(m.battle)add('ford_battle_'+m.id,'diplomacy','渡口冲突停火','实际行动180秒；本城死亡'+m.battle.dead.length+'、负伤'+m.battle.wounded.length+'，地方死亡'+m.battle.localDead.length+'。仅形成驻防，不取得地方仓库或公民资格。',m.battle.at);
        if(m.returnedAt!==null)add('ford_return_'+m.id,'transport','渡口原车返城','实际回仓余量：'+this.costText(m.refunded)+'；已消耗军需不退款。',m.returnedAt);
      }
      if(d.peace)add('ford_peace','diplomacy',d.peace.kind==='peace'?'渡口和平议约':'渡口战后自治','本城实付 '+this.costText(d.peace.costs.home)+'；当地实付 '+this.costText(d.peace.costs.local)+'。共同治理仍须实际公民资格与连续履约。',d.peace.at);
      if(d.occupation?.retreatAt!==null&&d.occupation?.retreatAt!==undefined)add('ford_retreat','transport','驻防守备徒步返城','返程仍需180秒，占员持续至抵达；准备支出 '+this.costText(d.occupation.retreatCost)+'。',d.occupation.retreatAt);
      if(d.occupation?.endedAt!==null&&d.occupation?.endedAt!==undefined)add('ford_garrison_return','transport','驻防守备实际返抵','已走完180秒返程，释放两人驻防职责，原居民可重新分工。',d.occupation.endedAt);
      for(const p of d.patients)if(p.recoveredAt!==null)add('ford_recovery_'+p.missionId,'nation','返城伤员恢复','原伤员完成120秒实付治疗，回到原居民名册；没有新增人口。',p.recoveredAt);
    }
    for(const r of c.incidents?.records||[]){
      const place=this.place(s,r.route);
      add('road_warning_'+r.id,'incidents',place+'道路预警','巡路人员发现松动路基，提出加固或交通安排。',r.createdAt);
      if(r.chosenAt!==null)add('road_choice_'+r.id,'incidents',place+'道路安排',r.choice==='hold'?'暂停新发车，等已有货车与迁居队归来后封路待修。':'维持运输，接受180秒后的封路期限。',r.chosenAt);
      if(r.closedAt!==null)add('road_closed_'+r.id,'incidents',place+'道路封闭',r.choice==='hold'?'原有货车与迁居队归来后，封闭道路等待材料。':'观察期限已过，道路封闭，在途运输等待恢复。',r.closedAt);
      if(r.resolvedAt!==null)add('road_repair_'+r.id,'incidents',place+(r.outcome==='prevented'?'提前加固':'道路修复'),'实际支出：木20、工具4。'+(r.payment.mode==='auto'?'依常设维护安排付款。':'居民决定付款修复。'),r.resolvedAt);
    }
    for(const [id,h]of Object.entries(c.heating?.nodes||{}))if(h.handedOverAt!==null)add('heat_handover_'+id,'heating',this.place(s,id)+'日常供暖交接','实付试运行覆盖'+h.handover.proof.capacity+'人份，接管'+h.handover.population+'位居民与'+h.handover.reserved+'位在途预留。'+(id==='home'?'旧炉自动添柴和工匠固定产木退出，由实际居民承担。':'当地人员与仓库继续承担燃料和维护。'),h.handedOverAt);
    for(const o of c.relief?.orders||[]){
      const place=this.place(s,o.target),key='relief_'+o.id;
      add(key+'_request','relief',place+'救济申请','申请有限物资：'+this.costText(o.cargo)+'。请求本身不扣款，等待原货车与主城储备。',o.requestedAt);
      if(o.dispatchedAt!==null)add(key+'_dispatch','relief',place+'救济出发','主城实付货物与旅费：'+this.costText(o.paid)+'。由原车与实际运输工负责。',o.dispatchedAt);
      if(o.deliveredAt!==null)add(key+'_delivery','relief',place+'救济入库','实际送达：'+this.costText(o.cargo)+'。进入地方原仓，健康与生产仍由实际供养恢复。',o.deliveredAt);
      if(o.cancelledAt!==null)add(key+'_cancel','relief',place+(o.dispatchedAt===null?'取消待发救济':'救济折返'),'未发单不付款；已付货物只在原车返抵后退回，旅费不退。',o.cancelledAt);
      if(o.refundAt!==null)add(key+'_refund','relief',place+'救济退回主城','原车实际返仓，退回：'+this.costText(o.cargo)+'。',o.refundAt);
    }
    if(c.ruins){const d=c.ruins;for(const [i,r]of d.stages.entries()){add('ruin_start_'+i,'ruins','河谷旧维护库 · '+CivilRuins.phases[r.kind].name,'实付：'+this.costText(r.paid)+'；4位现有居民轮班作业。',r.startedAt);if(r.endedAt!==null)add('ruin_end_'+i,'ruins',CivilRuins.phases[r.kind].name+'完成',i===2?CivilRuins.status(s):'现场工作完成，下一项选择由居民决定。',r.endedAt);}for(const [i,x]of d.controls.entries())add('ruin_control_'+i,'ruins',x.enabled?'恢复遗迹勘探':'暂缓遗迹勘探','保留既有工作进度，不退已使用物资。',x.at);}
    for(const [id,d]of Object.entries(c.cooperative?.nodes||{})){
      const place=this.place(s,id);add('cooperative_found_'+id,'cooperative',place+'设立制器合作社','转交1处已建制器间与木20、废料60、食物24；地方实付20知识。合作产出归社仓，原公共岗位减少4。',d.foundedAt);
      for(const [i,x]of d.controls.entries())add('cooperative_control_'+id+'_'+i,'cooperative',place+(x.enabled?'恢复合作生产':'暂停合作生产'),'设施所有权与现有社仓保留。',x.at);
      for(const [i,x]of (d.standing?.controls||[]).entries())add('cooperative_contract_'+id+'_'+i,'cooperative',place+(x.enabled?'开启持续实物合同':'暂停持续实物合同'),'每30秒至多成交一批工具和一批原料；实际付款，保留公共口粮与生产储备。',x.at);
      for(const kind of ['tools','materials']){const x=d.trades.find(t=>t.kind===kind);if(x)add('cooperative_first_'+id+'_'+kind,'cooperative',place+'首次'+(kind==='tools'?'向合作社采购工具':'向合作社出售原料'),kind==='tools'?'公库实付6食物，社仓交付2工具。':'社仓实付6食物，公库交付木4、废料12。',x.at);}
    }
    for(const [id,d]of Object.entries(c.culture?.nodes||{})){
      const place=this.place(s,id);
      for(const a of d.agreements)add('culture_agreement_'+id+'_'+a.id,'culture',place+' · 公共空间议约',
        (a.mode==='shared'?'共享轮用：档案交流与守灯纪念交替。':'公共档案专用：守灯会的公共空间请求未获满足，私人信仰不受限制。')+'地方实付10知识；不满实际增加'+a.unrestDelta+'。',a.at);
      for(const [index,control]of d.controls.entries())add('culture_control_'+id+'_'+index,'culture',place+(control.enabled?'恢复后续会堂活动':'停止后续会堂活动'),'现有活动、准备费用和过去记录保留。',control.at);
      const first=new Set();
      for(const r of d.activities){
        if(r.status==='cancelled')add('culture_cancel_'+id+'_'+r.id,'culture',place+'取消会堂活动','4木料、6食物已用于筹备，不退款；未发放活动结果。',r.endedAt);
        if(r.status!=='complete'||first.has(r.kind))continue;first.add(r.kind);
        add('culture_first_'+id+'_'+r.kind,'culture',place+' · 首次'+(r.kind==='archive'?'口述档案交流':'守灯纪念'),
          '地方实付4木料、6食物；2位组织者与12位成年参与者实际完成180工秒。'+(r.kind==='archive'?'存入6地方知识。':'地方不满实际减少'+Number(r.benefit.unrest.toFixed(2))+'。'),r.endedAt);
      }
    }
    const counts=Object.fromEntries(Object.keys(this.categories).map(category=>[category,entries.filter(e=>e.category===category).length]));
    return {year,current,entries,counts};
  },
  date(entry){
    if(entry.category==='tenures')return entry.current?'重建 '+entry.from+' 年起':'重建 '+entry.from+'—'+entry.to+' 年';
    return entry.at===null?this.unknownDate:'重建 '+Math.floor(entry.at/600)+' 年';
  },
  line(entry){return entry.title+' · '+this.date(entry)+(entry.detail?'。'+entry.detail:'');},
  sorted(entries,category){
    return entries.filter(e=>!category||e.category===category).sort((a,b)=>{
      if(category==='tenures')return b.generation-a.generation;
      const time=e=>e.at!==null?e.at:e.category==='tenures'&&!e.current?e.to*600:-1;
      return time(b)-time(a)||a.key.localeCompare(b.key);
    });
  },
  event(s){
    const view=this.snapshot(s),scenes={},go=name=>({1:name}),recent=this.sorted(view.entries.filter(e=>e.at!==null||e.category==='tenures'&&!e.current)).slice(0,this.PAGE_SIZE);
    const intro=['重建 '+view.year+' 年。'+(s.civilization.decisions?'配给与制度议决从重建 '+Math.floor(s.civilization.decisions.introducedAt/600)+' 年起记录；更早的变更与未知日期不补写。':'这里只翻阅现存档案；旧存档的政策与制度改革尚无完整记录。')];
    if(view.current)intro.push(view.current.title+' · 重建 '+view.current.from+' 年起。'+view.current.detail);
    intro.push(recent.length?'近期有年份的记录：':'尚无带年份的完成记录，已有成果可按分类查阅。');
    scenes.start={text:[...intro,...recent.map(e=>this.line(e))],buttons:{}};
    for(const [category,label]of Object.entries(this.categories)){
      const list=this.sorted(view.entries,category);if(!list.length)continue;
      scenes.start.buttons['history_'+category]={text:label+'（'+list.length+'）',nextScene:go(category+'_0')};
      const pageSize=['governance','culture'].includes(category)?3:this.PAGE_SIZE,pages=Math.ceil(list.length/pageSize);
      for(let page=0;page<pages;page++){
        const buttons={};if(page>0)buttons.previous={text:'上一页',nextScene:go(category+'_'+(page-1))};
        if(page+1<pages)buttons.next={text:'下一页',nextScene:go(category+'_'+(page+1))};
        buttons.contents={text:'返回目录',nextScene:go('start')};buttons.close={text:'合上记录',nextScene:'end'};
        scenes[category+'_'+page]={text:[label+' · 第'+(page+1)+'/'+pages+'页',...list.slice(page*pageSize,(page+1)*pageSize).map(e=>this.line(e))],buttons};
      }
    }
    scenes.start.buttons.close={text:'合上记录',nextScene:'end'};
    for(const scene of Object.values(scenes))scene.onLoad=()=>{if(typeof $!=='undefined')$('#description',Events.eventPanel()).scrollTop(0);};
    return {title:'发展史',civilHistory:true,scenes};
  },
  open(s=State){
    if(!this.available(s)||typeof Events==='undefined'||Events.activeEvent()||s.civilization.pending)return false;
    const event=this.event(s);Events.startEvent(event,{width:520});
    event.eventPanel?.addClass('civil-history-event');return true;
  },
  refresh(s=State){
    if(typeof $==='undefined'||!s?.civilization)return false;
    if(!this.available(s)){$('#historyMenu').remove();return false;}
    const menu=$('.menu').first();if(!menu.length)return false;
    let button=$('#historyMenu');
    if(!button.length){
      const open=()=>this.open(typeof State!=='undefined'?State:s);
      button=$('<span>').attr({id:'historyMenu',role:'button',tabindex:0}).addClass('menuBtn').text('发展史').appendTo(menu).on('click',open).on('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    }
    const busy=!!s.civilization.pending||(typeof Events!=='undefined'&&!!Events.activeEvent());
    button.attr({'aria-disabled':String(busy),title:busy?'先处理当前事件，再翻阅发展史':'查看任期与现存发展记录'}).toggleClass('history-unavailable',busy);
    return true;
  },
  reset(){if(typeof $!=='undefined')$('#historyMenu').remove();}
};
