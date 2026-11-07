/* MPL-2.0 — Read-only views of existing records; no saved history or simulation hooks. */
var CivilHistory={
  PAGE_SIZE:6,
  categories:{archives:'档案',achievements:'里程碑',people:'人物与机构',tenures:'全部任期',policy:'配给抉择',governance:'制度议决',technology:'科技',cities:'城市与镇制',agreements:'来源协议',projects:'竣工工程',budgets:'共同约定',metro:'城市群',nation:'国家共同法',diplomacy:'对外公约',transport:'国家交通',incidents:'道路抉择',heating:'供暖交接',relief:'地方救济',culture:'社群公共空间',cooperative:'作坊经营',ruins:'遗迹探索',expedition:'近郊勘察'},
  unknownDate:'未记年',
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
    if(typeof CivilArchives!=='undefined')for(const e of CivilArchives.history(s))add(e.key,e.category,e.title,e.detail,e.at);
    for(const [i,e]of (c.deliberation?.records||[]).entries()){const a=CivilCivic.agenda(s).find(x=>x.id===e.id),o=a?.options.find(x=>x.value===e.value);add('civic_'+i,'governance',a?.title||e.id,(o?.label||String(e.value))+' · '+({passed:'落实',refused:'未获同意',cancelled:'撤回'}[e.result]||e.result)+'。'+(o?.consequence||'')+' '+(e.reason||''),e.endedAt);}
    for(const [i,e]of (c.deliberation?.pressureHistory||[]).entries())add('pressure_'+i,'governance',e.reason,e.diagnosis,e.at);
    for(const [id,e]of Object.entries(c.modern?.eras||{}))add('era_'+id,'technology',CivilModernContent.eras[id].title,CivilModernContent.eras[id].lines.join('\n')+'\n已交接：'+e.retired.join('、'),e.at);
    for(const [id,at]of Object.entries(c.modern?.learned||{}))add('modern_'+id,'technology',CivilText.research[id].name,CivilText.research[id].done,at);
    for(const [i,e]of (c.generations?.records||[]).entries())add('generations_'+i,'people',e.text,'机构接续记录',e.at);
    for(const [i,e]of (c.city?.history||[]).entries())add('city_district_'+i,e.kind==='project'||e.kind==='complete'?'projects':e.kind==='policy'?'governance':'cities',e.text,'城域记录 · '+(typeof CivilCityContent!=='undefined'?CivilCityContent.wards[e.id]?.name||'原镇':e.id),e.at);
    for(const [i,e]of (c.cityCouncil?.history||[]).entries())add('city_council_'+i,'cities',e.text,'城市共同事务 · 地方承诺与实付工程',e.at);
    for(const [i,e]of (c.polity?.future?.history||[]).entries())add('advanced_society_'+i,e.kind==='technology'?'technology':e.kind==='building'?'projects':e.kind==='echo'?'ruins':'governance','先进共同体 · '+({adoption:'身体与人格',consent:'本人同意',law:'权利议决',society:'持续生活',foundation:'居民迁居',migration:'安居迁居',mandate:'公共委托',workforce:'班组交接',repair:'身份恢复',treatment:'临床恢复',isolation:'可申诉隔离',echo:'旧战场回响',technology:'新能力',building:'工程竣工'}[e.kind]||'共同记录'),e.text,e.at);
    for(const [i,e]of (c.polity?.earth?.history||[]).entries())add('earth_'+i,e.kind==='technology'?'technology':e.kind==='building'||e.kind==='project'?'projects':['launch','return','abort','orbit'].includes(e.kind)?'transport':'nation','地球与首航',e.text,e.at);
    for(const h of x?.history||[]){
      const reason={death:'因前任离世而完成交接',retirement:'退休交接',election:'选举交接',regency:'摄政结束后的交接'}[h.reason]||'职责交接';
      add('tenure_'+h.generation,'tenures','第'+h.generation+'任 '+h.title,'交接时'+h.age+'岁；'+reason+'。',null,{generation:h.generation,from:h.from,to:h.to,current:false});
    }
    let current=null;
    if(x?.leader){
      const leader=x.leader,detail=leader.alive?'现任，'+leader.age+'岁。':'当值者已经离世，等待职权交接；遗存档案未详录卒年。';
      current={title:'第'+x.generation+'任 '+leader.title,detail,from:leader.started};
      add('tenure_'+x.generation,'tenures',current.title,detail,null,{generation:x.generation,from:leader.started,to:null,current:true});
    }
    const decisions=c.decisions,baseline=decisions?.baseline||{policy:c.policy||null,axes:x?.axes||{}};
    if(baseline.policy)add('policy_baseline','policy',this.policyName(baseline.policy),'并入系统时已存之口粮定额；原始底档未载明采纳时点及此前沿革。');
    for(const [axis,value]of Object.entries(baseline.axes))add('governance_baseline_'+axis,'governance',this.axisName(axis,value),'并入系统时既有之规章制度；原始底档未载明确立时点及此前更迭。');
    for(const r of decisions?.records||[]){
      const term='第'+r.generation+'任期间。',key='decision_'+r.id;
      if(r.kind==='policy')add(key,'policy',r.from===null?'初次议定配给':'调整配给',term+this.policyName(r.from)+' → '+this.policyName(r.to)+'。口粮与产出按新配给持续结算。',r.at);
      else {
        const axisTitle=typeof CivilSociety!=='undefined'?CivilSociety.axes[r.axis]?.title:r.axis;
        const previous=this.axisName(r.axis,r.from),next=this.axisName(r.axis,r.to);
        const reference=r.proposalId===0?'承袭旧有存档中既设之改革议案；原始动议发起时点已不可考。':'承接第'+r.proposalId+'号动议。';
        if(r.kind==='founding')add(key,'governance','确立：'+axisTitle,term+'初次采用'+next+'。行政职责按制度持续结算。',r.at);
        if(r.kind==='proposal')add(key,'governance','第'+r.id+'号动议：'+axisTitle,term+'现制为'+previous+'；实际预留'+r.knowledge+'知识，尚未改制。',r.at);
        if(r.kind==='reform')add(key,'governance','改制：'+axisTitle,term+previous+' → '+next+'。'+reference+'预留的'+r.knowledge+'知识转为改制支出，不再次扣款。',r.at);
        if(r.kind==='cancel')add(key,'governance','保留现制：'+axisTitle,term+'继续采用'+previous+'。'+reference+'实际退回'+r.knowledge+'知识。',r.at);
      }
    }
    // A dated research completion already represents this technology; the legacy flag is a fallback.
    for(const [id,learned]of Object.entries(c.tech||{}))if(learned===true&&c.modern?.learned?.[id]===undefined)add('technology_'+id,'technology',(typeof CivilText!=='undefined'?CivilText.research[id]?.name:null)||id,'课题研究已结项。');
    if(c.settled)add('settlement_home','cities','聚落形成','炉火、口粮与基础分工曾达成自持平衡。');
    if(c.urban?.chartered)add('town_home','cities','本地镇制登记','公共治理权责已正式立案入册。');
    if(c.urban?.city)add('city_home','cities','炉火城登记','首座城市的公共职责已登记建档。');
    for(const [id,m]of Object.entries(c.municipal?.nodes||{})){
      if(!this.knownPlace(s,id))continue;
      if(m.town)add('town_'+id,'cities',this.place(s,id)+'镇制登记');
      if(m.city)add('city_'+id,'cities',this.place(s,id)+'城市登记');
      for(const p of m.completed||[])add('municipal_'+id+'_'+p.id,'projects',this.place(s,id)+' · '+this.facility(p.type),'市政基础设施竣工归档。',p.completedAt);
    }
    for(const [id,n]of Object.entries(c.origins?.nodes||{})){
      // Unknown societies may already have built classrooms; their private records are
      // not revealed until actual contact has happened.
      if(!['contacted','agreed'].includes(n.status))continue;
      if(n.status==='agreed'&&n.permit?.paid){
        const a=n.agreement,home=this.costText(a?.home),source=this.costText(a?.source);
        add('origin_agreement_'+id,'agreements',this.sourceName(id)+'迁居协议','累计迁居定额'+n.permit.limit+'人；已如实接纳'+n.admitted+'人。'+(home?'本地实付：'+home+'。':'')+(source?'来源实付：'+source+'。':''),a?.agreedAt);
      }
      for(const [i,p]of (n.schooling?.completed||[]).entries())add('origin_school_'+id+'_'+(i+1),'projects',this.sourceName(id)+' · 第'+(i+1)+'次学舍扩班','来源自付：'+this.costText(p.paid)+'。',p.completedAt);
    }
    for(const [id,m]of Object.entries(c.services?.nodes||{})){
      if(!this.knownPlace(s,id))continue;
      for(const p of m.completed||[])add('services_'+id+'_'+p.id,'projects',this.place(s,id)+' · '+this.facility(p.type),'公用工程竣工记录。'+(p.paid?'实付：'+this.costText(p.paid)+'。':''),p.completedAt);
    }
    for(const [id,p]of Object.entries(c.regions?.projects||{}))if(this.knownPlace(s,id)&&p.status==='complete'){
      const name=(typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.project?.name:null)||this.place(s,id)+'公共工程';
      add('public_project_'+id,'projects',name,'公用工程施工已验收完毕。',p.completedAt);
    }
    for(const [id,p]of Object.entries(c.regions?.upgrades?.projects||{}))if(this.knownPlace(s,id)&&p.status==='complete')add('freight_upgrade_'+id+'_'+p.id,'projects',this.place(s,id)+' · 加固货车','原车付费改装工程已结项交付。',p.completedAt);
    for(const a of c.finance?.agreements||[]){
      const members=a.members.map(id=>this.place(s,id)).join('、'),costs=Object.entries(a.approvals||{}).map(([id,n])=>this.place(s,id)+' '+n+'知识').join('；');
      add('common_agreement_'+a.id,'budgets','第'+a.id+'份诊疗与道路互助约定',members+'。议约实际开销：'+costs+'。各地仍各自管护自备仓库。',a.approvedAt);
      if(a.exitedAt!==null)add('common_exit_'+a.id,'budgets','第'+a.id+'份互助约定退出','停止履行新义务；既往车队调度与核销记录按底账封存。',a.exitedAt);
    }
    if(c.metro?.formedAt!==null&&Number.isFinite(c.metro?.formedAt)){
      const members=(c.metro.formedMembers||[]).map(id=>this.place(s,id)).join('、');
      add('metro_charter','metro','城市群共同职责登记',members+'。以持续供养与实体互助共担公共职责；各城基础公共服务仍须维持。',c.metro.formedAt);
    }
    if(c.nation){
      const n=c.nation;
      for(const [id,p]of Object.entries(n.approvals))add('nation_approval_'+id,'nation',this.place(s,id)+'国家议约','当地实付：'+this.costText(p.cost)+'；尚须三城连续筹备与正式批准。',p.at);
      if(n.foundedAt!==null)add('nation_founded','nation',n.foundingAxes.charter==='custom'?'国家惯例盟约生效':'国家宪章生效',n.members.map(id=>this.place(s,id)).join('、')+'；'+Object.entries(n.foundingAxes).map(([axis,value])=>this.axisName(axis,value)).join(' · ')+'。持续经费与治理仍按当期账册执行。',n.foundedAt);
    }
    if(c.diplomacy){
      const d=c.diplomacy,name=this.sourceName(d.sourceId);
      add('residence_pact','diplomacy',name+'居留公约','双方各自独立建档，本城实付'+this.costText(d.signature.home)+'；对方实付'+this.costText(d.signature.source)+'。来源地人口仍独立核算，获准资格不等于已然迁入。',d.signedAt);
      for(const r of d.records.filter(r=>r.grant))add('residence_grant_'+r.at,'diplomacy','追加居留资格核准',name+'连续履约满600秒，核准24人追加居留资格；实有人口、车辆与住房仍须逐一盘核。',r.at);
      d.revisions.forEach((r,i)=>add('residence_revision_'+i,'diplomacy',r.action==='pause'?'居留公约暂停':'居留公约恢复',name+'；原名册与已在途人员安排保持有效，追加资格不予重复发放。',r.at));
    }
    for(const [i,r]of (c.railway?.changes||[]).entries())add('railway_change_'+i,'transport',r.mode==='rail'?'铁轨支线班次启用':'铁轨支线恢复货车','原车返抵后进行交接；'+(r.mode==='rail'?'4名运输工，单程45秒，单趟据实核销燃料与维保。':'2名运输工，单程90秒；铁路重资产与原运单保持有效。'),r.at);
    if(c.space){
      const u=c.space.unification;if(u)add('earth_charter','nation','地球共同法生效','全球八区连续履约；本城实付 '+this.costText(u.paid)+'。地方名册与公共财政继续独立。',u.at);
      for(const m of c.space.missions){const name=CivilSpaceContent.phases[m.kind].name;add('space_start_'+m.kind,'nation',name+'启动','实付 '+this.costText(m.paid)+'；持续运转仍须人手、供电与不间断维护。',m.startedAt);if(m.completedAt!==null)add('space_done_'+m.kind,'nation',m.kind==='departure'?'地球篇完成：向星空出发':name+'完成',m.kind==='departure'?'无人先遣器点火启程，地球共同体就此迈入太空纪元；远征深空与外轨开拓，留待后世书写。':'物料实存与连续运转日志均已复核。',m.completedAt);}
    }
    if(c.worldstage){
      for(const m of c.worldstage.missions){const name=CivilWorldContent.regions[m.region].name,action=CivilWorld.missionConfig(m).name;
        add('world_depart_'+m.id,'diplomacy',name+'：'+action,'实付 '+this.costText(m.paid)+'；六名在编勤务人员启程。',m.departedAt);
        if(m.completedAt!==null)add('world_complete_'+m.id,m.kind==='campaign'?'governance':'diplomacy',name+'：'+action+'完成',m.kind==='campaign'?(CivilWorld.missionConfig(m).casualties??60)+'名当地战斗人员阵亡，地面设施残存'+(CivilWorld.missionConfig(m).infrastructure??40)+'%。武装占领尚不等于共同法整合。':'运抵现场并完成作业，成效列入所属独立大区账册。',m.completedAt);
        if(m.cancelledAt!==null)add('world_recall_'+m.id,'transport','国家行动撤回','沿已行路程返程；车队旅费不退，仅未交付物资返库冲账。',m.cancelledAt);
      }
      for(const[id,n]of Object.entries(c.worldstage.nodes))if(n.credit?.defaultedAt!==undefined)add('credit_default_'+id,'diplomacy',CivilWorldContent.regions[id].name+'信贷违约','到期未发出还款，抵押工具40划转地方公库，信任下降20；日后清偿后，违约记录仍留在账册中。',n.credit.defaultedAt);
      for(const[i,r]of c.worldstage.ledger.entries())if(r.kind==='statecraft'&&['policy','accord','renew'].includes(r.action))add('statecraft_'+i,'diplomacy',r.action==='policy'?'经济制度：'+CivilStatecraftContent.policies[r.mode].name:CivilWorldContent.regions[r.region].name+'：'+(r.action==='accord'?CivilStatecraftContent.regions[r.region].choices[r.choice].name:'重申地区协约'),'实付 '+this.costText(r.cost)+'；持续性义务按公共财政账册执行。',r.at);
      for(const[i,e]of (c.worldstage.foreign?.events||[]).entries())if(['relation','battle','truce','proposal','credit','policy','alliance','breach','workout','route','passage','recovery','front','market','congress','aftermath'].includes(e.kind))add('foreign_'+i,'diplomacy','地区联席：'+({aftermath:'战争善后与重建',congress:'多边议约与联盟响应',market:'自主供需与清偿',passage:'中转通行',recovery:'治理与信用修复',front:'战线变化',alliance:'联盟承诺',breach:'盟约中断',workout:'债务展期',route:'贸易线路',relation:'关系变化',battle:'边境交火',truce:'停火',proposal:'提案答复',credit:'清算逾期',policy:'授信改议'}[e.kind]),CivilCongress.describe(e.text),e.at);
      for(const r of c.worldstage.ledger)if(r.kind==='join')add('world_join_'+r.region,'diplomacy',CivilWorldContent.regions[r.region].name+'共同法登记','双方据实出资订立公约；既有城市网络居民身份与公共仓库继续保留。',r.at);
    }
    if(c.commerce){
      const d=c.commerce,name=this.sourceName(d.sourceId);
      add('commerce_agreement','diplomacy',name+'贸易约定','本城实付知识60，对方知识30；居民与库存各自独立建账，占用一份协调责任。',d.signedAt);
      for(const p of d.plans){add('commerce_plan_'+p.id,'transport','六趟商队委托',name+'；每次发车均据实扣减货物与沿途旅费。',p.at);if(p.cancelledAt!==null)add('commerce_cancel_'+p.id,'transport','剩余商队委托撤销','已经启程的商队继续完成往返，旅费概不退补。',p.cancelledAt);}
      for(const o of d.orders){
        add('commerce_depart_'+o.id,'transport','对外商队出发',name+'；本城实付 '+this.costText(o.paid)+'，其中工具12为调拨贸易货物。'+(o.publicDuties?'另含公共补助 '+this.costText(o.publicDuties.grant)+'；其余为旅粮与军需。':'其余为旅费与军需。'),o.departedAt);
        if(o.security)add('commerce_security_'+o.id,'transport',CivilSecurityContent.modes[o.security.mode].name,'本城守备'+o.security.homeGuard+'人、来源护路'+o.security.sourceGuard+'人；单程'+o.security.duration+'秒，来源实付 '+this.costText(o.security.sourcePaid)+'。',o.departedAt);
        if(o.security?.delay&&o.arrivedAt!==null)add('commerce_guarded_'+o.id,'transport','护送通行完成','满编班组实际就地警戒'+o.security.encounterSeconds+'秒驱离辐射兽群，商队平安运抵对方。',o.arrivedAt);
        if(o.publicDuties)add('commerce_public_'+o.id,'nation','约定内公共实物收支','本城随车补助 '+this.costText(o.publicDuties.grant)+'；来源贡献 '+this.costText(o.publicDuties.contribution)+'，各自实际到货方验收入仓。',o.departedAt);
        if(o.arrivedAt!==null)add('commerce_exchange_'+o.id,'transport',o.exchange?'对外商队成交':'对方保留供养，商队未成交',o.exchange?'对方实收 '+this.costText(CivilCommerce.cargo(o.publicDuties||null))+'，实付 '+this.costText(CivilCommerce.cargo(o.publicDuties||null,true))+'；食物随车返程。':'原装工具与随车物料据实返库；在途已消耗之旅粮与军需概不退补。',o.arrivedAt);
        if(o.returnedAt!==null)add('commerce_return_'+o.id,'transport','对外商队返城',o.exchange?this.costText(CivilCommerce.cargo(o.publicDuties||null,true))+'进入本城原仓。':'未成交之原装工具与随车物料据实归还本城原仓。',o.returnedAt);
      }
    }
    if(c.security){
      const d=c.security;
      d.changes.forEach((r,i)=>add('security_choice_'+i,'transport',CivilSecurityContent.modes[r.mode].name,'新调配方案仅约束后继启程商队，既有未结运单维持原议不予改写。',r.at));
      if(d.pact)add('security_pact','diplomacy','共同护送约定','本城据实拨付知识120、来源地出资60；双方人口与仓储独立建账，出行仍须驻派实有守备并核销军需。',d.pact.at);
      const trained=d.records.find(r=>r.readiness===300);if(trained)add('security_training','transport','守备训练准备完成','在册居民于实体训练场累计备战300秒；维持战备仍需口粮配给，物料断供或人员脱岗将导致防务状态流失。',trained.at);
    }
    if(c.accession){const d=c.accession;for(const [id,a]of Object.entries(d.approvals))add('accession_approval_'+id,'nation',(id==='home'?'本城':this.sourceName(d.sourceId))+'加盟议约','实付 '+this.costText(a.cost)+'；当地现有人口与仓库保留。',a.at);if(d.joinedAt!==null)add('accession_joined','nation',this.sourceName(d.sourceId)+'共同法加盟','双边议约签署、当值记录员就位及连续履约均已达成；公共调拨补助与地方回馈物资仍须原车实际运抵。',d.joinedAt);d.controls.forEach((x,i)=>add('accession_control_'+i,'nation',x.enabled?'恢复加盟共同行政':'暂缓加盟共同行政','地方人口名簿与历史档案封存留续；已启运之实物调拨承诺继续依约执行。',x.at));}
    if(c.partnership){
      for(const [id,p]of Object.entries(c.partnership.partners)){
        add('partner_sign_'+id,'diplomacy',this.sourceName(id)+'地区商约','双边据实出资登记入册，各自管护自备仓储与户籍名簿，地方推派两名成年居民专职承担公共账册记录。',p.signedAt);
        if(p.joinedAt!==null)add('partner_join_'+id,'nation',this.sourceName(id)+'接纳共同法','三趟商贸实际完成返抵并达成600秒连续履约后，双边据实立约建档；当地居民正式纳编共同法，其日常生存仍由本地独立供养。',p.joinedAt);
      }
      for(const o of c.partnership.orders){
        add('partner_depart_'+o.id,'transport',this.sourceName(o.sourceId)+'商队启程','原装货车据实押运12工具起运，在途旅费另行据实核销。',o.departedAt);
        if(o.arrivedAt!==null)add('partner_exchange_'+o.id,'transport',o.exchange?'地区实物成交':'地区商队未成交',o.exchange?this.costText(CivilPartnershipContent.returns[o.sourceId])+'随车返程，尚未入本城仓库。':'对方保留独立供养储备；原配工具随车折返，已耗旅费概不退补。',o.arrivedAt);
        if(o.returnedAt!==null)add('partner_return_'+o.id,'transport','地区商队实际返城',o.exchange?'交割货物经点验据实验收入库。':'原配工具物归原仓核销。',o.returnedAt);
      }
    }
    if(c.intercity){
      const d=c.intercity;
      add('intercity_agreement','transport','三城实付联运议约','本城出资知识60、铁轨镇出资30、河谷聚落出资30；合用既有货车编制，两地货物账目独立结算。',d.agreedAt);
      for(const o of d.orders){
        add('intercity_depart_'+o.id,'transport','联运原车出发','本城实付旅费 '+this.costText(o.paid)+'。',o.departedAt);
        if(o.pickedAt!==null)add('intercity_pickup_'+o.id,'transport','铁轨零件装车','铁轨镇仓库实扣零件24，调拨物资列入在途。',o.pickedAt);
        if(o.exchangedAt!==null)add('intercity_exchange_'+o.id,'transport','河谷实物成交','河谷聚落实收零件24、据实交付粮食120；粮食随车调往铁轨镇。',o.exchangedAt);
        if(o.deliveredAt!==null)add('intercity_delivery_'+o.id,'transport','铁轨收到联运粮食','粮食120实数验收入库铁轨镇原仓。',o.deliveredAt);
        if(o.refundedAt!==null)add('intercity_refund_'+o.id,'transport','未成交零件退回','未动用之原装零件24退回铁轨镇仓库；本城预付旅费不予退补。',o.refundedAt);
        if(o.returnedAt!==null)add('intercity_return_'+o.id,'transport','联运空车返城','联运货车与两名运输工归队解脱，重新纳入排班调度。',o.returnedAt);
      }
    }
    if(c.corridor){
      const d=c.corridor,name=this.sourceName(d.sourceId);
      add('corridor_agreement','transport',name+'道路筹办','本城实付 '+this.costText(d.signature.home)+'；当地实付 '+this.costText(d.signature.source)+'。工程建材仍须由原货车分批据实运抵。',d.agreedAt);
      for(const r of d.receipts)add('corridor_receipt_'+r.orderId,'transport','道路建材实际到达','原第'+r.orderId+'号商单交入工程保管账 '+this.costText(r.cargo)+'，普通贸易独立结算。',r.at);
      if(d.completedAt!==null)add('corridor_complete','transport',name+'道路驿站竣工','当地连续施工600秒，实耗运抵建材 '+this.costText(d.consumed)+'；此后须双边按期出资维保，新设班次方可缩短通行耗时。',d.completedAt);
    }
    if(c.frontier){
      const d=c.frontier;
      for(const m of d.missions){
        add('ford_depart_'+m.id,'transport',m.kind==='scout'?'旧渡口勘察启程':'四人渡口分队启程','原守备'+m.guards+'人与司机2人，用已有商车携带 '+this.costText(m.paid)+'；消耗与余额分别记账。',m.departedAt);
        if(m.battle)add('ford_battle_'+m.id,'diplomacy','渡口冲突停火','实际交火180秒；本城阵亡'+m.battle.dead.length+'人、负伤'+m.battle.wounded.length+'人，对方阵亡'+m.battle.localDead.length+'人。前沿仅形成停火驻防，绝不直接接管地方仓储或强加公民资格。',m.battle.at);
        if(m.returnedAt!==null)add('ford_return_'+m.id,'transport','渡口原车返城','实际回仓余量：'+this.costText(m.refunded)+'；已消耗军需不退款。',m.returnedAt);
      }
      if(d.peace)add('ford_peace','diplomacy',d.peace.kind==='peace'?'渡口和平议约':'渡口战后自治','本城实付 '+this.costText(d.peace.costs.home)+'；当地实付 '+this.costText(d.peace.costs.local)+'。共同治理仍须实体公民资格与连续履约支撑。',d.peace.at);
      if(d.occupation?.retreatAt!==null&&d.occupation?.retreatAt!==undefined)add('ford_retreat','transport','驻防守备徒步返城','徒步返程尚需180秒，人员编制占用持续至入城结项；核拨开拔给养 '+this.costText(d.occupation.retreatCost)+'。',d.occupation.retreatAt);
      if(d.occupation?.endedAt!==null&&d.occupation?.endedAt!==undefined)add('ford_garrison_return','transport','驻防守备实际返抵','驻防人员走完180秒返程路段，解除两人防务战备职责，归队居民重新纳入口粮与生产排班。',d.occupation.endedAt);
      for(const p of d.patients)if(p.recoveredAt!==null)add('ford_recovery_'+p.missionId,'nation','返城伤员恢复','伤员经120秒针对性医治痊愈，回籍重入定居名簿；全域人口未作虚增。',p.recoveredAt);
    }
    for(const r of c.incidents?.records||[]){
      const place=this.place(s,r.route);
      add('road_warning_'+r.id,'incidents',place+'道路预警','巡路巡护员发现路基塌陷松动，提请就地加固抢修或重新调整路网调度。',r.createdAt);
      if(r.chosenAt!==null)add('road_choice_'+r.id,'incidents',place+'道路安排',r.choice==='hold'?'暂停派发新车次，等待已在途货车与迁徙队伍返抵后封路检修。':'维持运输，接受180秒后的封路期限。',r.chosenAt);
      if(r.closedAt!==null)add('road_closed_'+r.id,'incidents',place+'道路封闭',r.choice==='hold'?'原有货车与迁居队归来后，封闭道路等待材料。':'观察期限已过，道路封闭，在途运输等待恢复。',r.closedAt);
      if(r.resolvedAt!==null)add('road_repair_'+r.id,'incidents',place+(r.outcome==='prevented'?'提前加固':'道路修复'),'实际支出：木20、工具4。'+(r.payment.mode==='auto'?'依常设维护安排付款。':'居民决定付款修复。'),r.resolvedAt);
    }
    for(const [id,h]of Object.entries(c.heating?.nodes||{}))if(h.handedOverAt!==null)add('heat_handover_'+id,'heating',this.place(s,id)+'日常供暖交接','实付试运行覆盖'+h.handover.proof.capacity+'人份，接管'+h.handover.population+'位居民与'+h.handover.reserved+'位在途预留。'+(id==='home'?'旧炉自动添柴和工匠固定产木退出，由实际居民承担。':'当地人员与仓库继续承担燃料和维护。'),h.handedOverAt);
    for(const o of c.relief?.orders||[]){
      const place=this.place(s,o.target),key='relief_'+o.id;
      add(key+'_request','relief',place+'救济申请','申请有限物资：'+this.costText(o.cargo)+'。请求本身不扣料，等待指定货车空闲与主城自留储备足额。',o.requestedAt);
      if(o.dispatchedAt!==null)add(key+'_dispatch','relief',place+'救济出发','主城实付货物与旅费：'+this.costText(o.paid)+'。由原车与在册运输工负责押运。',o.dispatchedAt);
      if(o.deliveredAt!==null)add(key+'_delivery','relief',place+'救济入库','实际送达：'+this.costText(o.cargo)+'。验收入地方原仓，健康与生产自持仍由后续实际供养恢复。',o.deliveredAt);
      if(o.cancelledAt!==null)add(key+'_cancel','relief',place+(o.dispatchedAt===null?'取消待发救济':'救济折返'),'未发单不核扣；已付货物仅在原车返抵入库后销账，在途旅费概不退补。',o.cancelledAt);
      if(o.refundAt!==null)add(key+'_refund','relief',place+'救济退回主城','原车实际返仓，退回：'+this.costText(o.cargo)+'。',o.refundAt);
    }
    for(const [i,r]of (c.expedition?.records||[]).entries())if(r.kind!=='trip'||i<3||i===c.expedition.records.length-1)add('expedition_'+i,'expedition',r.title,r.detail,r.at);
    if(c.ruins){const d=c.ruins;for(const [i,r]of d.stages.entries()){add('ruin_start_'+i,'ruins','河谷旧维护库 · '+CivilRuins.phases[r.kind].name,'实付：'+this.costText(r.paid)+'；4位现有居民轮班作业。',r.startedAt);if(r.endedAt!==null)add('ruin_end_'+i,'ruins',CivilRuins.phases[r.kind].name+'完成',i===2?CivilRuins.status(s):'现场勘察已结项，后续处置走向交由居民自决。',r.endedAt);}for(const [i,x]of d.controls.entries())add('ruin_control_'+i,'ruins',x.enabled?'恢复遗迹勘探':'暂缓遗迹勘探','保留既有勘探进度，已耗损物资不予退补。',x.at);}
    for(const [id,d]of Object.entries(c.cooperative?.nodes||{})){
      const place=this.place(s,id);add('cooperative_found_'+id,'cooperative',place+'设立制器合作社','转交1处已建制器间与木20、废料60、食物24；地方出资20知识。合作社产出归入社仓，原设公共工位核减4名。',d.foundedAt);
      for(const [i,x]of d.controls.entries())add('cooperative_control_'+id+'_'+i,'cooperative',place+(x.enabled?'恢复合作生产':'暂停合作生产'),'设施所有权与现有社仓保留。',x.at);
      for(const [i,x]of (d.standing?.controls||[]).entries())add('cooperative_contract_'+id+'_'+i,'cooperative',place+(x.enabled?'开启持续实物合同':'暂停持续实物合同'),'每30秒至多成交一批工具与一批原料；据实扣付，严守公共口粮与生产自留底线。',x.at);
      for(const kind of ['tools','materials']){const x=d.trades.find(t=>t.kind===kind);if(x)add('cooperative_first_'+id+'_'+kind,'cooperative',place+'首次'+(kind==='tools'?'向合作社采购工具':'向合作社出售原料'),kind==='tools'?'公库实付6食物，社仓据实交付2工具。':'社仓实付6食物，公库据实交付木4、废料12。',x.at);}
    }
    for(const [id,d]of Object.entries(c.culture?.nodes||{})){
      const place=this.place(s,id);
      for(const a of d.agreements)add('culture_agreement_'+id+'_'+a.id,'culture',place+' · 公共空间议约',
        (a.mode==='shared'?'共享轮用：历史档案交流与守灯纪念仪式交替使用会堂。':'公共档案专用：守灯会之公共会堂集会请求未获核准，私人信仰不予干涉。')+'地方实付10知识；不满情绪实际增加'+a.unrestDelta+'。',a.at);
      for(const [index,control]of d.controls.entries())add('culture_control_'+id+'_'+index,'culture',place+(control.enabled?'恢复后续会堂活动':'停止后续会堂活动'),'既有会堂活动、筹备支出及历史台账悉数保留。',control.at);
      const first=new Set();
      for(const r of d.activities){
        if(r.status==='cancelled')add('culture_cancel_'+id+'_'+r.id,'culture',place+'取消会堂活动','木料4、食物6已用于前期筹备，概不退赔；未核发活动成效。',r.endedAt);
        if(r.status!=='complete'||first.has(r.kind))continue;first.add(r.kind);
        add('culture_first_'+id+'_'+r.kind,'culture',place+' · 首次'+(r.kind==='archive'?'口述档案交流':'守灯纪念'),
          '地方实付木料4、食物6；2名发起人与12名成年参与者切实出工180工秒。'+(r.kind==='archive'?'地方公库沉淀6知识。':'地方不满实际减少'+Number(r.benefit.unrest.toFixed(2))+'。'),r.endedAt);
      }
    }
    const counts=Object.fromEntries(Object.keys(this.categories).map(category=>[category,entries.filter(e=>e.category===category).length]));
    return {year,current,entries,counts};
  },
  date(entry){
    if(entry.category==='tenures')return entry.current?'重建 '+entry.from+' 年起':'重建 '+entry.from+'—'+entry.to+' 年';
    return entry.at===null?this.unknownDate:'重建 '+Math.floor(entry.at/600)+' 年';
  },
  detail(entry){
    if(entry.category==='achievements'||entry.key.startsWith('city_district_'))return '';
    const text=entry.detail||'';
    if(['机构接续记录','课题研究已结项。','市政基础设施竣工归档。','公用工程施工已验收完毕。','城市共同事务 · 地方承诺与实付工程','并入系统时已存之口粮定额；原始底档未载明采纳时点及此前沿革。','并入系统时既有之规章制度；原始底档未载明确立时点及此前更迭。'].includes(text)||text===entry.title)return '';
    return text.replace(/^公用工程竣工记录。/,'').replace(/行政职责按制度持续结算。|口粮与产出按新配给持续结算。|按实际公共服务、权利边界和地方同意表决|这次诊断不发资源或人口。/g,'').replace(/，建材与工时均已实付。|，已据实核销全部建材与轮班工时。|；具体效能仍须依托实体设施与轮班工位运转。|；在册居民与已付用度照旧保留。|，材料和工时已经消耗。|，已消耗实际材料与工时。|；能力仍需实际设施与工位。|；既有居民与费用保留。/g,'。').trim();
  },
  line(entry){const detail=this.detail(entry);return this.date(entry)+'　'+entry.title+(detail?(/[。！？；]$/.test(entry.title)?' ':'。')+detail:'');},
  chronicleBody(entry){if(entry.category==='tenures')return entry.title+'，'+this.detail(entry);return entry.key.startsWith('city_district_')?entry.title:this.detail(entry)||entry.title;},
  sorted(entries,category){
    return entries.filter(e=>!category||e.category===category).sort((a,b)=>{
      if(category==='tenures')return a.generation-b.generation;
      const time=e=>e.at!==null?e.at:e.category==='tenures'?e.from*600:Infinity;
      return time(a)-time(b)||a.key.localeCompare(b.key);
    });
  },
  event(s){
    const view=this.snapshot(s),scenes={},go=name=>({1:name}),first=this.sorted(view.entries.filter(e=>e.at!==null||e.category==='tenures')).slice(0,this.PAGE_SIZE);
    const intro=['重建 '+view.year+' 年。'+(s.civilization.decisions?'配给与制度议决从重建 '+Math.floor(s.civilization.decisions.introducedAt/600)+' 年起记录；更早的变更与未知日期不补写。':'这里只翻阅现存档案；旧存档的政策与制度改革尚无完整记录。')];
    if(view.current)intro.push('重建 '+view.current.from+' 年起　'+view.current.title+'。'+view.current.detail);
    intro.push(first.length?'最早有年份的记录：':'尚无编入年份之已结事项，既有成果可依分类索引查阅。');
    scenes.start={text:[...intro,...first.map(e=>this.line(e))],buttons:{}};
    for(const [category,label]of Object.entries(this.categories)){
      const list=this.sorted(view.entries,category);if(!list.length)continue;
      scenes.start.buttons['history_'+category]={text:label+'（'+list.length+'）',nextScene:go(category+'_0')};
      const pageSize=['governance','culture','archives'].includes(category)?3:this.PAGE_SIZE,pages=Math.ceil(list.length/pageSize);
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
