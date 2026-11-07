/* MPL-2.0 — National diplomacy and reconstruction. Local public treasuries stay separate. */
var CivilWorld={
  pendingIds:['worldCouncil',...Object.keys(CivilWorldContent.regions).map(id=>'world_'+id)],
  data(s){return s.civilization.worldstage;},
  available(s){return Number.isSafeInteger(s.civilization.accession?.joinedAt)&&CivilPartnership.candidates(s).length===2&&CivilPartnership.candidates(s).every(id=>Number.isSafeInteger(CivilPartnership.partners(s)[id]?.joinedAt));},
  asset(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='expeditiondepot');},
  staff(s){return CivilServices.labor(s,'home','expeditionworker');},
  members(s){return Object.entries(this.data(s)?.nodes||{}).filter(([,n])=>n.joinedAt!==null).map(([id])=>id);},
  population(s){return this.members(s).reduce((sum,id)=>sum+this.data(s).nodes[id].population,0);},
  active(s){const m=this.data(s)?.missions.at(-1);return m&&m.returnedAt===null?m:null;},
  init(s){if(!this.data(s))s.civilization.worldstage={schema:1,startedAt:s.civilization.elapsed,nodes:{},missions:[],ledger:[],lastTickAt:null,lastSettledAt:null};return this.data(s);},
  seed(id,at){const p=CivilWorldContent.regions[id];return {contactedAt:at,population:p.population,trust:p.trust,infrastructure:100,control:'independent',joinedAt:null,stableSeconds:0,stores:{...CivilWorldContent.treasury},casualties:0,occupationMissed:0};},
  visible(s,id){return !CivilWorldContent.regions[id]?.gate||!!s.civilization.tech.orbital_survey;},
  accessReason(s,id){const p=CivilWorldContent.regions[id];if(!p?.gate)return null;if(!s.civilization.tech.orbital_survey)return '请先完成近地轨道测绘';if(!s.civilization.tech[p.gate])return '请先研究'+CivilText.research[p.gate].name;if(!this.transport(s))return '请先在街区加工分类建成远洋与全地形勤务船队';return null;},
  transport(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='globalfleet');},
  pledged(id,rights,devolution){const p=CivilWorldContent.regions[id];return (!(id==='east'||p?.rights==='equal')||rights==='equal')&&(!(id==='west'||p?.autonomy)||devolution==='local');},
  duration(s,id){return Math.ceil(CivilWorldContent.regions[id].duration*(s.civilization.tech.orbital_survey ? .8 : 1));},
  political(s){return CivilNation.operational(s)&&CivilFinance.political(s);},
  commitment(s,id){return this.pledged(id,s.civilization.regions.rights,s.civilization.society.axes.devolution);},
  missionConfig(m){return CivilStatecraft.config(m);},
  reason(s,id,kind,doctrine){
    const quote=CivilStatecraft.special(kind)?CivilStatecraft.quote(s,id,kind):{region:id,kind,...(doctrine?{doctrine}:{})},cfg=this.missionConfig(quote),n=this.data(s)?.nodes[id];
    if(doctrine&&(kind!=='campaign'||!Object.hasOwn(CivilStatecraftContent.doctrines,doctrine)))return '未知战役方案';
    if(!this.available(s)||!Object.hasOwn(CivilWorldContent.regions,id)||!Object.hasOwn(CivilWorldContent.missions,kind))return '请先接纳现有三处聚居圈，再开展国家级联络';
    if(this.accessReason(s,id))return this.accessReason(s,id);
    if(!this.asset(s)||!s.civilization.tech.national_logistics)return '请先研究国家远程运输组织并建成国家远域勤务站';
    if(this.active(s))return '已有一支国家行动队在途，须等其返航';
    if(this.staff(s)<6)return '请在炉火城页分派六名远域勤务人员；建站本身不额外添丁';
    if(!this.political(s))return '请先恢复国家认可度与当任行政';
    if(kind==='contact'&&n||kind!=='contact'&&!n)return kind==='contact'?'已建立国家联络':'请先建立国家联络';
    if(!CivilStatecraft.special(kind)&&!(kind==='rebuild'&&this.data(s)?.foreign&&n?.infrastructure<100)&&n?.joinedAt!==null&&n)return '已登记共同法，继续按公共预算履约';
    if(kind==='campaign'&&(!s.civilization.tech.automation||n.control==='occupied'||this.data(s).missions.some(m=>m.region===id&&m.kind==='campaign'&&m.completedAt!==null)))return '发起战役需掌握机器人自动控制；战事收尾后仍须走完重建与地方议约';
    if(kind==='negotiate'&&n.control==='occupied')return '请先修复战后受损设施，再恢复地方议约';
    if(kind==='rebuild'&&n.infrastructure===100)return '唯有战后军事占领区方需执行此项重建';
    if(CivilStatecraft.special(kind)){const reason=CivilStatecraft.reason(s,id,kind);if(reason)return reason;}
    if(!CivilFinance.reserveCheck(s,'home',cfg.cost))return '本城须先留足日常供养，再备齐此行所需物资';
    return null;
  },
  start(s,id,kind,doctrine){
    if(this.reason(s,id,kind,doctrine))return false;
    const quote=CivilStatecraft.special(kind)?CivilStatecraft.quote(s,id,kind):{region:id,kind,...(doctrine?{doctrine}:{})},cfg=this.missionConfig(quote);
    CivilServices.pay(s.stores,cfg.cost);const d=this.init(s),at=s.civilization.elapsed;
    const m={...quote,id:d.missions.length+1,assetId:this.asset(s).id,departedAt:at,duration:this.duration(s,id),orbital:!!s.civilization.tech.orbital_survey,progress:0,completedAt:null,returnedAt:null,cancelledAt:null,paid:{...cfg.cost},cargo:{...cfg.cargo},lastMovedAt:at,...(CivilWorldContent.regions[id].gate?{transportAssetId:this.transport(s).id}:{})};
    d.missions.push(m);CivilStatecraft.dispatched(s,m);return true;
  },
  recall(s){const m=this.active(s);if(!m||m.completedAt!==null||m.cancelledAt!==null)return false;m.cancelledAt=s.civilization.elapsed;m.returnDistance=Math.min(m.progress,m.duration);m.returnProgress=0;return true;},
  joinReason(s,id){
    const n=this.data(s)?.nodes[id];if(!n||n.joinedAt!==null)return '尚未建立联络或已接纳';
    if(this.active(s))return '请先等国家行动队返航，核对完整回执';
    if(!this.political(s))return '请先恢复国家认可度与当任行政';
    if(n.control==='occupied'||n.infrastructure<100||n.trust<60||n.stableSeconds<600)return '须修妥设施、信任达60，并一连600秒付清公共服务用度';
    if(!this.commitment(s,id))return '本地区要求实行平等公民资格或地方自治，请前往地区与议事屋核对';
    if(id==='east'&&s.civilization.regions.rights!=='equal')return '东陆要求变异居民与常人享有同等公民资格';
    if(id==='west'&&s.civilization.society.axes.devolution!=='local')return '西陆城邦要求在现行制度中保留地方自治';
    const fee=CivilWorldContent.membership;
    return !CivilFinance.reserveCheck(s,'home',fee.home)||!CivilRegions.canPay(n.stores,fee.local)?'双方须各自备足议约用度':null;
  },
  join(s,id){if(this.joinReason(s,id))return false;const d=this.data(s),cost=CivilWorldContent.membership;CivilServices.pay(s.stores,cost.home);this.record(d,{kind:'join',region:id,at:s.civilization.elapsed,rights:s.civilization.regions.rights,devolution:s.civilization.society.axes.devolution,costs:JSON.parse(JSON.stringify(cost))});return true;},
  // One deterministic reducer owns each regional public treasury. It is also
  // replayed during import; public contributions are not household production.
  apply(d,r){
    if(r.kind==='settlement'){CivilSettlement.apply(d,r);return;}
    if(r.kind==='aftermath'){CivilAftermath.apply(d,r);return;}
    if(r.kind==='congress'){CivilCongress.apply(d,r);return;}
    if(r.kind==='market'){CivilMarkets.apply(d,r);return;}
    if(r.kind==='network'){CivilTransit.apply(d,r);return;}
    if(r.kind==='league'){CivilLeagues.apply(d,r);return;}
    if(r.kind==='foreign'){CivilForeign.apply(d,r);return;}
    if(r.kind==='statecraft'){CivilStatecraft.apply(d,r);return;}
    if(r.kind==='mission'){
      const m=d.missions[r.mission-1],id=m.region;
      if(m.kind==='contact'){d.nodes[id]=this.seed(id,r.at);return;}
      if(CivilStatecraft.special(m.kind)){CivilStatecraft.deliver(d,m,r.at);return;}
      const n=d.nodes[id],cfg=this.missionConfig(m);CivilRegions.credit(n.stores,cfg.cargo);
      if(m.kind==='negotiate')n.trust=Math.min(100,n.trust+20);
      if(m.kind==='campaign'){
        n.casualties+=cfg.casualties??60;n.population-=cfg.casualties??60;n.infrastructure=Math.min(n.infrastructure,cfg.infrastructure??40);n.trust=cfg.trust??0;n.control='occupied';n.occupationMissed=0;n.stableSeconds=0;
        for(const [other,node]of Object.entries(d.nodes))if(other!==id)node.trust=Math.max(0,node.trust-(cfg.external??10));
        CivilForeign.campaign(d,m,r.at);
      }
      if(m.kind==='rebuild'){n.infrastructure=Math.min(100,n.infrastructure+20);n.trust=Math.min(100,n.trust+20);if(n.infrastructure===100){n.control=n.joinedAt!==null?'member':'independent';n.occupationMissed=0;}}
      return;
    }
    if(r.kind==='withdraw'){const n=d.nodes[r.region];n.control='independent';n.occupationMissed=0;n.stableSeconds=0;return;}
    if(r.kind==='join'){ const n=d.nodes[r.region];CivilServices.pay(n.stores,CivilWorldContent.membership.local);n.joinedAt=r.at;n.control='member';return;}
    if(r.kind==='budget'){for(const [id,n]of Object.entries(d.nodes)){
      if(n.control==='occupied'){n.occupationMissed=r.occupationPaid?0:n.occupationMissed+10;if(n.occupationMissed>=60){n.control='independent';n.occupationMissed=0;}}
      const scale=n.infrastructure/100;
      CivilRegions.credit(n.stores,Object.fromEntries(Object.entries(CivilWorldContent.revenue).map(([k,v])=>[k,v*scale])));
      const service=CivilServices.pay(n.stores,CivilWorldContent.services);
      if(r.fees[id])CivilServices.pay(n.stores,CivilWorldContent.fee.local);
      const okay=service&&n.infrastructure===100&&n.control!=='occupied'&&r.political&&(n.joinedAt===null||r.fees[id]&&this.pledged(id,r.rights,r.devolution));
      n.stableSeconds=okay?Math.min(600,n.stableSeconds+10):0;
    }CivilStatecraft.afterBudget(d,r);CivilSettlement.budget(d,r);CivilForeign.round(d,r);CivilForeign.stability(d);}
  },
  record(d,r){this.apply(d,r);d.ledger.push(r);},
  settle(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastSettledAt!==null&&at-d.lastSettledAt<10)return {};
    const fees={},home={},political=this.political(s);
    for(const [id,n]of Object.entries(d.nodes))if(n.joinedAt!==null){
      const f=CivilWorldContent.fee;fees[id]=CivilFinance.reserveCheck(s,'home',f.home)&&CivilRegions.canPay(n.stores,Object.fromEntries(Object.entries(f.local).map(([k,v])=>[k,v+(CivilWorldContent.services[k]||0)])));
      if(fees[id]){CivilServices.pay(s.stores,f.home);for(const [k,v]of Object.entries(f.home))home[k]=(home[k]||0)-v;}
    }
    // Occupation consumes separate public resources until reconstruction or a
    // deliberate withdrawal; a victory never counts as a legal accession.
    const occupied=Object.values(d.nodes).filter(n=>n.control==='occupied').length,occupation={food:occupied*2,medicine:occupied*.1,tools:occupied*.05};
    const occupationPaid=occupied>0&&CivilFinance.reserveCheck(s,'home',occupation);
    if(occupationPaid){CivilServices.pay(s.stores,occupation);for(const [k,v]of Object.entries(occupation))home[k]=(home[k]||0)-v;}
    const foreignEvents=d.foreign?.events.length||0;
    const accords=CivilStatecraft.budget(s,political);for(const[k,v]of Object.entries(accords.flow))home[k]=(home[k]||0)+v;
    this.record(d,{kind:'budget',at,political,...(Object.keys(accords.payments).length?{accordPayments:accords.payments}:{}),rights:s.civilization.regions.rights,devolution:s.civilization.society.axes.devolution,fees,occupationPaid});d.lastSettledAt=at;
    if(s===State)for(const[id,n]of Object.entries(d.nodes)){if(n.credit?.defaultedAt===at)Civilization.notify(CivilWorldContent.regions[id].name+'：重建信贷已逾期违约，抵押工具被没收；请前往地区协约记录安排还款。');if(n.accord?.missed===60)Civilization.notify(CivilWorldContent.regions[id].name+'：协约承诺或经费已连断60秒，信任扣减10点，请核对现行制度与供养。');}
    if(s===State&&d.foreign)for(const e of d.foreign.events.slice(foreignEvents).filter(e=>['relation','battle','truce','proposal','credit','alliance','breach','workout','route','passage','recovery','front','market','congress','aftermath','settlement'].includes(e.kind)))Civilization.notify(CivilCongress.describe(e.text));
    return home;
  },
  withdraw(s,id){const d=this.data(s),n=d?.nodes[id];if(!n||n.control!=='occupied'||this.active(s))return false;this.record(d,{kind:'withdraw',region:id,at:s.civilization.elapsed});return true;},
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastTickAt!==null&&at<=d.lastTickAt)return;d.lastTickAt=at;
    const m=this.active(s);if(!m||this.staff(s)<6)return;m.lastMovedAt=at;
    if(m.cancelledAt!==null){if(m.returnProgress<m.returnDistance)m.returnProgress++;if(m.returnProgress===m.returnDistance){CivilRegions.credit(s.stores,m.cargo);m.cargo={};m.returnedAt=at;CivilStatecraft.returned(s,m);}return;}
    m.progress++;
    const cfg=this.missionConfig(m),delivery=m.duration+cfg.work;
    if(m.progress===delivery){m.completedAt=at;this.record(d,{kind:'mission',at,mission:m.id});m.cargo={};Civilization.notify(CivilWorldContent.regions[m.region].name+'：'+cfg.name+'已办妥。'+(m.kind==='campaign'?(cfg.casualties??60)+'名当地战斗人员阵亡；设施完好度仅余'+(cfg.infrastructure??40)+'%，后续仍须重建并重新议约。':'交涉结果已载入地区公共账册，随行人员开始返航。'));}
    if(m.progress===delivery+m.duration){m.returnedAt=at;CivilStatecraft.returned(s,m);Civilization.notify('国家行动队已返城，六名远域勤务人员可重新听候调遣。');}
  },
  progressText(s){
    const m=this.active(s);if(!m)return '行动队已就绪';
    const cfg=this.missionConfig(m),phase=m.cancelledAt!==null?'撤回':m.progress<m.duration?'去程':m.progress<m.duration+cfg.work?'现场处置':'返航';
    const left=m.cancelledAt!==null?m.returnDistance-m.returnProgress:m.duration*2+cfg.work-m.progress;
    return CivilWorldContent.regions[m.region].name+' · '+phase+'，距返城尚余'+left+'秒'+(this.staff(s)<6?'；勤务人手不足，已暂停':'');
  },
  summary(s){
    const members=this.members(s),count=Object.keys(CivilWorldContent.regions).filter(id=>this.visible(s,id)).length;
    const nodes=Object.entries(this.data(s)?.nodes||{}),issue=nodes.find(([,n])=>n.accord?.missed||n.credit?.status==='default');
    if(issue)return CivilWorldContent.regions[issue[0]].name+' · '+(issue[1].credit?.status==='default'?'信贷已违约，须安排还款':'协约履约中断，请核对承诺与经费');
    const loan=nodes.filter(([,n])=>n.credit?.status==='open').sort((a,b)=>a[1].credit.dueAt-b[1].credit.dueAt)[0];
    if(loan)return CivilWorldContent.regions[loan[0]].name+' · 信贷距到期尚余'+Math.max(0,loan[1].credit.dueAt-s.civilization.elapsed)+'秒；'+this.progressText(s);
    if(this.active(s))return '共同法 '+members.length+' / '+count+'区 · '+this.progressText(s);
    if(!this.political(s))return '共同法 '+members.length+' / '+count+'区 · 请先办妥换届交接或恢复国家行政';
    const ready=Object.keys(CivilWorldContent.regions).filter(id=>!this.joinReason(s,id));
    if(ready.length)return '可签署共同法：'+ready.map(id=>CivilWorldContent.regions[id].name).join('、');
    if(members.length===8)return '八区均已接纳 · 请在“地球共同法与航天”中核对全球议约';
    return '共同法 '+members.length+' / '+count+'区 · '+(s.civilization.tech.orbital_survey&&!this.transport(s)?'请在科技页研究远洋运输，并在街区加工分类建成勤务船队':'打开远域记录，选择尚未接纳的地区');
  },
  status(s,id){const p=CivilWorldContent.regions[id],n=this.data(s)?.nodes[id];return p.name+' · '+p.cities+'座城市'+(n?' · '+n.population+'人；'+({independent:'独立政体',occupied:'军事占领，尚未整合',member:'共同法成员'}[n.control])+'；信任'+n.trust+'，设施'+n.infrastructure+'%，公共服务'+n.stableSeconds+'/600秒':' · 尚未正式联络');},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,d=this.data(s),buttons={},text=[],finish=(ok,msg)=>done(ok?msg:'条件已有变动：请核对在岗人手、治理状态及实存材料；本次未执行。')();
    if(id==='worldCouncil'){
      text.push('国家远域：此处为原聚落圈以外的远方城市网。各区户籍与公共财政独立建账；居民不会迁入炉火城，地方仓存亦不并入本城。','先同北陆、东陆、西陆确立共同法。接纳三地后即可研究近地轨道测绘，进而联络全球八区；各区仍各自保留城市名册与公共预算。');
      for(const [key,p]of Object.entries(CivilWorldContent.regions)){if(!this.visible(s,key))continue;text.push(this.status(s,key));buttons[key]={text:p.name,nextScene:'end',onChoose:()=>{s.civilization.pending='world_'+key;}};}
      if(!this.asset(s))text.push('推进次序：先研究“国家计算与档案系统”与“国家远程运输组织”，随后在街区加工分类兴建勤务站，并在炉火城页配齐六名勤务人员。机器人自动控制与轨道测绘将随外交进程解锁。');
      const m=this.active(s);if(m){text.push('当前行动：'+CivilWorldContent.regions[m.region].name+' · '+this.missionConfig(m).name+'；'+(m.cancelledAt!==null?'撤回 '+m.returnProgress+'/'+m.returnDistance:m.progress+'/'+(m.duration*2+this.missionConfig(m).work))+'秒；在岗勤务'+this.staff(s)+'/6。');if(m.completedAt===null&&m.cancelledAt===null)buttons.recall={text:'撤回当前行动队',nextScene:'end',onChoose:()=>finish(this.recall(s),'行动队将按已走出的路程折返；仅尚未交割的援助物资可退回原仓，已耗旅费与动员用度概不退还。')};}
    }else{
      const key=id.slice(6),n=d?.nodes[key],p=CivilWorldContent.regions[key];text.push(this.status(s,key),p.issue,'此处留存着远方各城的户籍名册与公共预算。当地百姓照旧在各自城中生息，跨区公共拨款亦不会直接划入本城仓库。');
      if(this.active(s))text.push(this.progressText(s)+'。');
      if(this.accessReason(s,key))text.push(this.accessReason(s,key)+'。');
      if(n)text.push('地方公共储备：'+CivilHistory.costText(n.stores)+'。每10秒按设施完好度收进公共拨款，并支取粮4、药0.1、工具0.03、零件0.02、知识0.1。累计阵亡战斗人员'+n.casualties+'人。');
      for(const [kind,cfg]of Object.entries(CivilWorldContent.missions))if(kind==='contact'?!n:n&&(n.joinedAt===null||kind==='rebuild'&&d.foreign&&n.infrastructure<100)&&(kind==='rebuild'?n.infrastructure<100:kind==='campaign'?n.control!=='occupied'&&!d.missions.some(m=>m.region===key&&m.kind==='campaign'&&m.completedAt!==null)&&s.civilization.tech.automation:kind==='negotiate'&&n.control!=='occupied')){
        text.push(cfg.name+'：'+CivilHistory.costText(cfg.cost)+'；单程'+this.duration(s,key)+'秒，现场处置'+cfg.work+'秒。'+(kind==='campaign'?'此举将导致当地60名战斗人员阵亡、设施完好度跌至40%，并使其他已知政体对我们的信任降低10点。四台通用机器人将在战事中损耗，且无任何战利品可掠。军事占领期间每10秒需另耗粮2、药0.1、工具0.05；若连续断供满60秒将被迫撤军，已造成的创伤与恶感无法抹去。':this.reason(s,key,kind)||'当前可派出。'));
        buttons[kind]={text:cfg.name,available:()=>!this.reason(s,key,kind),nextScene:'end',onChoose:()=>finish(this.start(s,key,kind),'国家行动队已付清用度启程；须待抵埠并办完差事后方见成效。')};
      }
      if(n&&s.civilization.tech.computing)buttons.accord={text:'地区协约、互市与信贷',nextScene:'end',onChoose:()=>{s.civilization.pending='accord_'+key;}};
      if(n&&n.joinedAt===null&&s.civilization.tech.automation&&!d.missions.some(m=>m.region===key&&m.kind==='campaign'&&m.completedAt!==null))for(const[doctrine,cfg]of Object.entries(CivilStatecraftContent.doctrines)){
        text.push(cfg.name+'：'+CivilHistory.costText(cfg.cost)+'；现场处置'+cfg.work+'秒，阵亡'+cfg.casualties+'人，设施仅余'+cfg.infrastructure+'%，其他政体信任降低'+cfg.external+'。战后仍须承担重建、占领维持与重新议约。');
        buttons[doctrine]={text:cfg.name,available:()=>!this.reason(s,key,'campaign',doctrine),nextScene:'end',onChoose:()=>finish(this.start(s,key,'campaign',doctrine),'行动队已按选定方案出征；战事收尾后仍须走完重建与议约。')};
      }
      if(n&&n.joinedAt===null){text.push('共同法接纳：'+(this.joinReason(s,key)||'双方均可签署')+'。本城出 '+CivilHistory.costText(CivilWorldContent.membership.home)+'；地方出 '+CivilHistory.costText(CivilWorldContent.membership.local)+'。此后每10秒由双方各自承担公共经费。');buttons.join={text:'签署地区共同法',available:()=>!this.joinReason(s,key),nextScene:'end',onChoose:()=>finish(this.join(s,key),'两地已付清用度签下共同法。远域城市网继续保留当地居民、自有资产与公共账册。')};}
      if(n?.control==='occupied')buttons.withdraw={text:'解除军事占领',nextScene:'end',onChoose:()=>finish(this.withdraw(s,key),'驻防开支即刻停止，当地恢复独立政体；既往阵亡、设施损毁与外交恶感仍留存于册。')};
    }
    buttons.close={text:'合上国家远域记录',nextScene:'end',onChoose:done('国家远域行动与地方公共账册继续按实际条件运转。')};return {title:id==='worldCouncil'?'国家远域与外交':CivilWorldContent.regions[id.slice(6)].name,text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#worldButton,#worldSummary').hide();return;}
    Civilization.button('worldButton','国家远域与外交','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='worldCouncil';Civilization.showPending();}).show();
    let line=$('#worldSummary');if(!line.length)line=$('<div>').attr('id','worldSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).insertAfter('#worldButton');line.show().text(this.summary(State));
  },
  validate(s){
    const d=this.data(s),at=s.civilization.elapsed,fail=()=>{throw Error('国家远域行动或公共账册无效');},obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=at,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),int=x=>Number.isSafeInteger(x)&&x>=0;
    if(d===undefined){if(CivilSettlement.pendingIds.includes(s.civilization.pending))fail();if(CivilAftermath.pendingIds.includes(s.civilization.pending))fail();if(CivilCongress.pendingIds.includes(s.civilization.pending))fail();if(CivilMarkets.pendingIds.includes(s.civilization.pending))fail();if(CivilTransit.pendingIds.includes(s.civilization.pending))fail();if(CivilLeagues.pendingIds.includes(s.civilization.pending))fail();if(CivilForeign.pendingIds.includes(s.civilization.pending))fail();if(CivilStatecraft.pendingIds.includes(s.civilization.pending)||this.pendingIds.includes(s.civilization.pending)&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||!this.asset(s)||!time(d.startedAt)||!obj(d.nodes)||!Array.isArray(d.missions)||!d.missions.length||!Array.isArray(d.ledger)||d.lastTickAt!==null&&!time(d.lastTickAt)||d.lastSettledAt!==null&&!time(d.lastSettledAt))fail();
    if(CivilStatecraft.pendingIds.includes(s.civilization.pending)&&(!s.civilization.tech.computing||!Object.keys(d.nodes).length||s.civilization.pending.startsWith('accord_')&&!d.nodes[s.civilization.pending.slice(7)]))fail();
    if(CivilForeign.pendingIds.includes(s.civilization.pending)&&(!CivilForeign.available(s)||s.civilization.pending!=='foreignCouncil'&&(!d.foreign||s.civilization.pending.startsWith('foreign_')&&!d.foreign.actors[s.civilization.pending.slice(8)]||s.civilization.pending.startsWith('foreignPair_')&&!d.foreign.pairs[s.civilization.pending.slice(12)])))fail();
    if(CivilSettlement.pendingIds.includes(s.civilization.pending)){const id=s.civilization.pending;if(!CivilSettlement.unlocked(d)||id!=='settlementCouncil'&&(!CivilSettlement.data(d)||(id.startsWith('settlementPair_')?!d.foreign.pairs[id.slice(15)]:!d.nodes[id.slice(id.indexOf('_')+1)])))fail();}
    if(CivilAftermath.pendingIds.includes(s.civilization.pending)){const id=s.civilization.pending;if(!d.foreign?.congress||!CivilAftermath.seenWar(d)||id!=='aftermathCouncil'&&(!d.foreign.aftermath||(id.startsWith('aftermathPact_')?!d.foreign.pairs[id.slice(14)]:!d.nodes[id.slice(10)])))fail();}
    if(CivilCongress.pendingIds.includes(s.civilization.pending)){const id=s.civilization.pending;if(!d.foreign?.markets||Object.keys(d.nodes).length<3||id!=='congressCouncil'&&(!d.foreign.congress||(id.startsWith('congressActor_')?!d.nodes[id.slice(14)]:!d.foreign.pairs[id.slice(13)])))fail();}
    if(CivilMarkets.pendingIds.includes(s.civilization.pending)){const id=s.civilization.pending;if(!d.foreign?.network||id!=='marketCouncil'&&(!d.foreign.markets||!d.nodes[id.slice(7)]))fail();}
    if(CivilTransit.pendingIds.includes(s.civilization.pending)){const id=s.civilization.pending;if(!d.foreign?.leagues||id!=='transitCouncil'&&!d.foreign.network||id.startsWith('transitActor_')&&!d.nodes[id.slice(13)]||id.startsWith('transitPair_')&&!d.foreign.pairs[id.slice(12)])fail();}
    if(CivilLeagues.pendingIds.includes(s.civilization.pending)){const id=s.civilization.pending,l=d.foreign?.leagues;if(!d.foreign||d.foreign.round<2||id!=='leagueCouncil'&&!l||id.startsWith('leagueActor_')&&!d.foreign.actors[id.slice(12)]||id.startsWith('leaguePair_')&&!d.foreign.pairs[id.slice(11)]||id.startsWith('leagueRoute_')&&!d.foreign.pairs[id.slice(12)])fail();}
    let previous=null;
    for(const [i,m]of d.missions.entries()){
      const cfg=this.missionConfig(m),p=CivilWorldContent.regions[m.region];
      if(m.marketRate!==undefined&&(m.kind!=='exchange'||!Number.isInteger(m.marketRate)||m.marketRate<60||m.marketRate>150))fail();
      if(m.doctrine!==undefined&&(m.kind!=='campaign'||!Object.hasOwn(CivilStatecraftContent.doctrines,m.doctrine))||!CivilStatecraft.special(m.kind)&&(m.economy!==undefined||m.returnCargo!==undefined||m.forfeited!==undefined))fail();
      if(CivilStatecraft.special(m.kind)&&(!cfg||!same(m.returnCargo,m.returnedAt===null?cfg.receive:{})||m.kind==='repay'&&typeof m.forfeited!=='boolean'||m.kind!=='repay'&&m.forfeited!==undefined))fail();
      if(p?.gate&&(!this.transport(s)||!s.civilization.tech[p.gate]||!m.orbital||m.transportAssetId!==this.transport(s)?.id||this.transport(s)?.completedAt>m.departedAt))fail();
      if(!obj(m)||!cfg||!p||m.id!==i+1||m.assetId!==this.asset(s).id||!time(m.departedAt)||m.departedAt<this.asset(s).completedAt||m.departedAt<d.startedAt||i===0&&m.departedAt!==d.startedAt||previous&&(previous.returnedAt===null||m.departedAt<previous.returnedAt)||typeof m.orbital!=='boolean'||m.orbital&&!s.civilization.tech.orbital_survey||m.duration!==Math.ceil(p.duration*(m.orbital ? .8 : 1))||!int(m.progress)||m.progress>m.duration*2+cfg.work||!same(m.paid,cfg.cost)||!time(m.lastMovedAt)||m.lastMovedAt<m.departedAt||m.lastMovedAt-m.departedAt<m.progress||m.completedAt!==null&&!time(m.completedAt)||m.returnedAt!==null&&!time(m.returnedAt)||m.cancelledAt!==null&&!time(m.cancelledAt))fail();
      if(m.cancelledAt!==null){if(m.completedAt!==null||m.progress>=m.duration+cfg.work||m.cancelledAt<m.departedAt+m.progress||m.returnDistance!==Math.min(m.progress,m.duration)||!int(m.returnProgress)||m.returnProgress>m.returnDistance||m.lastMovedAt-m.cancelledAt<m.returnProgress||m.returnedAt!==null&&(m.returnProgress!==m.returnDistance||m.returnedAt!==m.lastMovedAt))fail();}
      else if((m.completedAt!==null)!==(m.progress>=m.duration+cfg.work)||m.completedAt!==null&&(m.completedAt<m.departedAt+m.duration+cfg.work||m.completedAt>m.lastMovedAt)||(m.returnedAt!==null)!==(m.progress===m.duration*2+cfg.work)||m.returnedAt!==null&&(m.returnedAt<m.completedAt+m.duration||m.returnedAt!==m.lastMovedAt))fail();
      if(!same(m.cargo,m.completedAt!==null||m.returnedAt!==null?{}:cfg.cargo))fail();previous=m;
    }
    const replay={nodes:{},missions:d.missions},completed=new Set(),dispatched=new Set(),returned=new Set();let last=-1,budget=null;
    for(const r of d.ledger){
      if(!obj(r)||!time(r.at)||r.at<d.startedAt||r.at<last)fail();last=r.at;
      if(r.kind==='settlement'){CivilSettlement.validateRecord(replay,r);}
      else if(r.kind==='aftermath'){CivilAftermath.validateRecord(replay,r);}
      else if(r.kind==='congress'){CivilCongress.validateRecord(replay,r);}
      else if(r.kind==='market'){CivilMarkets.validateRecord(replay,r);}
      else if(r.kind==='network'){CivilTransit.validateRecord(replay,r);}
      else if(r.kind==='league'){CivilLeagues.validateRecord(replay,r);}
      else if(r.kind==='foreign'){if(!s.civilization.tech.computing)fail();CivilForeign.validateRecord(replay,r);}
      else if(r.kind==='statecraft'){
        if(!s.civilization.tech.computing)fail();CivilStatecraft.validateRecord(replay,r,s);
        if(['dispatch','return'].includes(r.action)){const seen=r.action==='dispatch'?dispatched:returned;if(seen.has(r.mission)||r.action==='return'&&!dispatched.has(r.mission))fail();seen.add(r.mission);}
      }else if(r.kind==='mission'){
        const m=d.missions[r.mission-1];if(!m||m.completedAt!==r.at||completed.has(m.id))fail();const n=replay.nodes[m.region];
        if(CivilStatecraft.special(m.kind)){if(!n||n.joinedAt===null||!dispatched.has(m.id))fail();}
        else if(m.kind==='contact'?!!n:!n||n.joinedAt!==null&&!(m.kind==='rebuild'&&replay.foreign)||m.kind==='rebuild'&&n.infrastructure===100||['campaign','negotiate'].includes(m.kind)&&n.control==='occupied'||m.kind==='campaign'&&([...completed].some(id=>d.missions[id-1].kind==='campaign'&&d.missions[id-1].region===m.region)||!s.civilization.tech.automation))fail();completed.add(m.id);
      }else if(r.kind==='join'){
        const n=replay.nodes[r.region];if(!n||n.joinedAt!==null||n.control==='occupied'||n.trust<60||n.infrastructure!==100||n.stableSeconds<600||!this.pledged(r.region,r.rights,r.devolution)||!same(r.costs,CivilWorldContent.membership)||!CivilRegions.canPay(n.stores,CivilWorldContent.membership.local))fail();
      }else if(r.kind==='budget'){
        CivilStatecraft.validateBudget(replay,r);
        if(budget!==null&&r.at-budget<10||typeof r.political!=='boolean'||typeof r.occupationPaid!=='boolean'||!['equal','resident','stratified'].includes(r.rights)||!['local','central'].includes(r.devolution)||!obj(r.fees)||!same(Object.keys(r.fees).sort(),Object.entries(replay.nodes).filter(([,n])=>n.joinedAt!==null).map(([id])=>id).sort())||Object.values(r.fees).some(x=>typeof x!=='boolean'))fail();
        for(const [id,paid]of Object.entries(r.fees))if(paid&&!CivilRegions.canPay(replay.nodes[id].stores,Object.fromEntries(Object.entries(CivilWorldContent.fee.local).map(([k,v])=>[k,v+(CivilWorldContent.services[k]||0)]))))fail();budget=r.at;
      }else if(r.kind==='withdraw'){if(replay.nodes[r.region]?.control!=='occupied')fail();}else fail();
      this.apply(replay,r);
    }
    if(d.missions.some(m=>CivilStatecraft.special(m.kind)&&(!dispatched.has(m.id)||(m.returnedAt!==null)!==returned.has(m.id))))fail();
    if(!same(replay.foreign,d.foreign)||!same(replay.economy,d.economy)||!same(replay.nodes,d.nodes)||budget!==d.lastSettledAt||d.missions.some(m=>m.completedAt!==null&&!completed.has(m.id)))fail();
  }
};
