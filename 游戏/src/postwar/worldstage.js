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
  accessReason(s,id){const p=CivilWorldContent.regions[id];if(!p?.gate)return null;if(!s.civilization.tech.orbital_survey)return '先完成近地轨道测绘';if(!s.civilization.tech[p.gate])return '先研究'+CivilText.research[p.gate].name;if(!this.transport(s))return '先在街区加工建成远洋与全地形勤务船队';return null;},
  transport(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='globalfleet');},
  pledged(id,rights,devolution){const p=CivilWorldContent.regions[id];return (!(id==='east'||p?.rights==='equal')||rights==='equal')&&(!(id==='west'||p?.autonomy)||devolution==='local');},
  duration(s,id){return Math.ceil(CivilWorldContent.regions[id].duration*(s.civilization.tech.orbital_survey ? .8 : 1));},
  political(s){return CivilNation.operational(s)&&CivilFinance.political(s);},
  commitment(s,id){return this.pledged(id,s.civilization.regions.rights,s.civilization.society.axes.devolution);},
  missionConfig(m){return CivilStatecraft.config(m);},
  reason(s,id,kind,doctrine){
    const quote=CivilStatecraft.special(kind)?CivilStatecraft.quote(s,id,kind):{region:id,kind,...(doctrine?{doctrine}:{})},cfg=this.missionConfig(quote),n=this.data(s)?.nodes[id];
    if(doctrine&&(kind!=='campaign'||!Object.hasOwn(CivilStatecraftContent.doctrines,doctrine)))return '未知战役方案';
    if(!this.available(s)||!Object.hasOwn(CivilWorldContent.regions,id)||!Object.hasOwn(CivilWorldContent.missions,kind))return '先接纳现有三处聚居圈，再开展国家级联络';
    if(this.accessReason(s,id))return this.accessReason(s,id);
    if(!this.asset(s)||!s.civilization.tech.national_logistics)return '先研究远程运输并建成国家远域勤务站';
    if(this.active(s))return '已有一支国家行动队在途，须待返航';
    if(this.staff(s)<6)return '在炉火城页安排六名远域勤务人员；不会赠送居民';
    if(!this.political(s))return '先恢复国家认可与现任行政';
    if(kind==='contact'&&n||kind!=='contact'&&!n)return kind==='contact'?'已有国家联络':'先建立国家联络';
    if(!CivilStatecraft.special(kind)&&!(kind==='rebuild'&&this.data(s)?.foreign&&n?.infrastructure<100)&&n?.joinedAt!==null&&n)return '已登记共同法，继续按公共预算履约';
    if(kind==='campaign'&&(!s.civilization.tech.automation||n.control==='occupied'||this.data(s).missions.some(m=>m.region===id&&m.kind==='campaign'&&m.completedAt!==null)))return '战役需机器人自动控制；本地区战役结束后须走重建与议约';
    if(kind==='negotiate'&&n.control==='occupied')return '先重建战后设施，恢复地方议约';
    if(kind==='rebuild'&&n.infrastructure===100)return '只有战后占领地区需要重建';
    if(CivilStatecraft.special(kind)){const reason=CivilStatecraft.reason(s,id,kind);if(reason)return reason;}
    if(!CivilFinance.reserveCheck(s,'home',cfg.cost))return '本城须留足供养，再备齐本次行动实物';
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
    const n=this.data(s)?.nodes[id];if(!n||n.joinedAt!==null)return '尚未联络或已接纳';
    if(this.active(s))return '先等国家行动队返航，核对完整回执';
    if(!this.political(s))return '先恢复国家认可与现任行政';
    if(n.control==='occupied'||n.infrastructure<100||n.trust<60||n.stableSeconds<600)return '须恢复设施、信任达到60，并连续600秒实付公共服务';
    if(!this.commitment(s,id))return '本地区要求平等公民资格或地方自治，请在地区与议事屋核对';
    if(id==='east'&&s.civilization.regions.rights!=='equal')return '东陆要求变异人与其他居民享有共同公民资格';
    if(id==='west'&&s.civilization.society.axes.devolution!=='local')return '西陆城邦要求在现有制度中实行地方自治';
    const fee=CivilWorldContent.membership;
    return !CivilFinance.reserveCheck(s,'home',fee.home)||!CivilRegions.canPay(n.stores,fee.local)?'双方须分别备足议约费用':null;
  },
  join(s,id){if(this.joinReason(s,id))return false;const d=this.data(s),cost=CivilWorldContent.membership;CivilServices.pay(s.stores,cost.home);this.record(d,{kind:'join',region:id,at:s.civilization.elapsed,rights:s.civilization.regions.rights,devolution:s.civilization.society.axes.devolution,costs:JSON.parse(JSON.stringify(cost))});return true;},
  // One deterministic reducer owns each regional public treasury. It is also
  // replayed during import; public contributions are not household production.
  apply(d,r){
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
    }CivilStatecraft.afterBudget(d,r);CivilForeign.round(d,r);CivilForeign.stability(d);}
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
    if(s===State)for(const[id,n]of Object.entries(d.nodes)){if(n.credit?.defaultedAt===at)Civilization.notify(CivilWorldContent.regions[id].name+'：重建信贷到期违约，抵押已没收；请在地区协约记录安排还款。');if(n.accord?.missed===60)Civilization.notify(CivilWorldContent.regions[id].name+'：协约承诺或经费中断60秒，信任下降10，请核对制度与供养。');}
    if(s===State&&d.foreign)for(const e of d.foreign.events.slice(foreignEvents).filter(e=>['relation','battle','truce','proposal','credit'].includes(e.kind)))Civilization.notify(e.text);
    return home;
  },
  withdraw(s,id){const d=this.data(s),n=d?.nodes[id];if(!n||n.control!=='occupied'||this.active(s))return false;this.record(d,{kind:'withdraw',region:id,at:s.civilization.elapsed});return true;},
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastTickAt!==null&&at<=d.lastTickAt)return;d.lastTickAt=at;
    const m=this.active(s);if(!m||this.staff(s)<6)return;m.lastMovedAt=at;
    if(m.cancelledAt!==null){if(m.returnProgress<m.returnDistance)m.returnProgress++;if(m.returnProgress===m.returnDistance){CivilRegions.credit(s.stores,m.cargo);m.cargo={};m.returnedAt=at;CivilStatecraft.returned(s,m);}return;}
    m.progress++;
    const cfg=this.missionConfig(m),delivery=m.duration+cfg.work;
    if(m.progress===delivery){m.completedAt=at;this.record(d,{kind:'mission',at,mission:m.id});m.cargo={};Civilization.notify(CivilWorldContent.regions[m.region].name+'：'+cfg.name+'完成。'+(m.kind==='campaign'?(cfg.casualties??60)+'名当地战斗人员死亡；设施余'+(cfg.infrastructure??40)+'%，仍须重建与地方议约。':'结果已写入地区公共账册，人员开始返航。'));}
    if(m.progress===delivery+m.duration){m.returnedAt=at;CivilStatecraft.returned(s,m);Civilization.notify('国家行动队返城，六名勤务人员重新可用。');}
  },
  progressText(s){
    const m=this.active(s);if(!m)return '行动队已就绪';
    const cfg=this.missionConfig(m),phase=m.cancelledAt!==null?'撤回':m.progress<m.duration?'去程':m.progress<m.duration+cfg.work?'现场工作':'返航';
    const left=m.cancelledAt!==null?m.returnDistance-m.returnProgress:m.duration*2+cfg.work-m.progress;
    return CivilWorldContent.regions[m.region].name+' · '+phase+'，距返城'+left+'秒'+(this.staff(s)<6?'；缺少勤务人员，已暂停':'');
  },
  summary(s){
    const members=this.members(s),count=Object.keys(CivilWorldContent.regions).filter(id=>this.visible(s,id)).length;
    const nodes=Object.entries(this.data(s)?.nodes||{}),issue=nodes.find(([,n])=>n.accord?.missed||n.credit?.status==='default');
    if(issue)return CivilWorldContent.regions[issue[0]].name+' · '+(issue[1].credit?.status==='default'?'信贷违约，须安排还款':'协约履约中断，核对承诺与经费');
    const loan=nodes.filter(([,n])=>n.credit?.status==='open').sort((a,b)=>a[1].credit.dueAt-b[1].credit.dueAt)[0];
    if(loan)return CivilWorldContent.regions[loan[0]].name+' · 信贷到期余'+Math.max(0,loan[1].credit.dueAt-s.civilization.elapsed)+'秒；'+this.progressText(s);
    if(this.active(s))return '共同法 '+members.length+' / '+count+'区 · '+this.progressText(s);
    if(!this.political(s))return '共同法 '+members.length+' / '+count+'区 · 先处理换届或恢复国家行政';
    const ready=Object.keys(CivilWorldContent.regions).filter(id=>!this.joinReason(s,id));
    if(ready.length)return '可签署共同法：'+ready.map(id=>CivilWorldContent.regions[id].name).join('、');
    if(members.length===8)return '八区已接纳 · 在“地球共同法与航天”核对全球议约';
    return '共同法 '+members.length+' / '+count+'区 · '+(s.civilization.tech.orbital_survey&&!this.transport(s)?'科技研究远洋运输，在街区加工建勤务船队':'打开远域记录选择尚未接纳地区');
  },
  status(s,id){const p=CivilWorldContent.regions[id],n=this.data(s)?.nodes[id];return p.name+' · '+p.cities+'座城市'+(n?' · '+n.population+'人；'+({independent:'独立政体',occupied:'军事占领，尚未整合',member:'共同法成员'}[n.control])+'；信任'+n.trust+'，设施'+n.infrastructure+'%，公共服务'+n.stableSeconds+'/600秒':' · 尚未正式联络');},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,d=this.data(s),buttons={},text=[],finish=(ok,msg)=>done(ok?msg:'条件已变化：请核对人员、治理及实际材料；未执行。')();
    if(id==='worldCouncil'){
      text.push('国家远域：这些是原聚落圈之外的城市网络。地方居民与公共财政单独记账；不会迁入炉火城，也不会把地方库存合并到本城。','先从北陆、东陆、西陆建立共同法。三地接纳后在科技研究轨道测绘，逐步展开全球八区；各方保留城市名册与公共预算。');
      for(const [key,p]of Object.entries(CivilWorldContent.regions)){if(!this.visible(s,key))continue;text.push(this.status(s,key));buttons[key]={text:p.name,nextScene:'end',onChoose:()=>{s.civilization.pending='world_'+key;}};}
      if(!this.asset(s))text.push('科技入口：国家计算与档案系统 → 国家远程运输组织；街区加工中建勤务站，再在炉火城页安排六名勤务人员。机器人与轨道测绘随外交进展开放。');
      const m=this.active(s);if(m){text.push('当前行动：'+CivilWorldContent.regions[m.region].name+' · '+this.missionConfig(m).name+'；'+(m.cancelledAt!==null?'撤回 '+m.returnProgress+'/'+m.returnDistance:m.progress+'/'+(m.duration*2+this.missionConfig(m).work))+'秒；实际勤务'+this.staff(s)+'/6。');if(m.completedAt===null&&m.cancelledAt===null)buttons.recall={text:'撤回当前行动队',nextScene:'end',onChoose:()=>finish(this.recall(s),'开始沿已经走过的距离返航；仅未交付援助物资可返库，旅费与动员费用不退。')};}
    }else{
      const key=id.slice(6),n=d?.nodes[key],p=CivilWorldContent.regions[key];text.push(this.status(s,key),p.issue,'这里保留各城市的公开名册与共同预算。当地居民继续在自己的城市生活，跨区公共拨款也不会自动进入本城仓库。');
      if(this.active(s))text.push(this.progressText(s)+'。');
      if(this.accessReason(s,key))text.push(this.accessReason(s,key)+'。');
      if(n)text.push('地方公共储备：'+CivilHistory.costText(n.stores)+'。每10秒按设施完整度收取公共拨款，并支付粮4、药0.1、工具0.03、零件0.02、知识0.1。累计战斗死亡'+n.casualties+'人。');
      for(const [kind,cfg]of Object.entries(CivilWorldContent.missions))if(kind==='contact'?!n:n&&(n.joinedAt===null||kind==='rebuild'&&d.foreign&&n.infrastructure<100)&&(kind==='rebuild'?n.infrastructure<100:kind==='campaign'?n.control!=='occupied'&&!d.missions.some(m=>m.region===key&&m.kind==='campaign'&&m.completedAt!==null)&&s.civilization.tech.automation:kind==='negotiate'&&n.control!=='occupied')){
        text.push(cfg.name+'：'+CivilHistory.costText(cfg.cost)+'；单程'+this.duration(s,key)+'秒，现场'+cfg.work+'秒。'+(kind==='campaign'?'将造成60名当地战斗人员死亡、设施降至40%、其他已知政体信任下降10。四台机器人在动员中消耗，没有战利品。占领每10秒另耗粮2、药0.1、工具0.05；连续欠供60秒撤军，损害保留。':this.reason(s,key,kind)||'当前可派出。'));
        buttons[kind]={text:cfg.name,available:()=>!this.reason(s,key,kind),nextScene:'end',onChoose:()=>finish(this.start(s,key,kind),'国家行动队已实际扣款启程；结果须抵达并完成工作后生效。')};
      }
      if(n&&s.civilization.tech.computing)buttons.accord={text:'地区协约、互市与信贷',nextScene:'end',onChoose:()=>{s.civilization.pending='accord_'+key;}};
      if(n&&n.joinedAt===null&&s.civilization.tech.automation&&!d.missions.some(m=>m.region===key&&m.kind==='campaign'&&m.completedAt!==null))for(const[doctrine,cfg]of Object.entries(CivilStatecraftContent.doctrines)){
        text.push(cfg.name+'：'+CivilHistory.costText(cfg.cost)+'；现场'+cfg.work+'秒，死亡'+cfg.casualties+'人，设施余'+cfg.infrastructure+'%，其他政体信任下降'+cfg.external+'。仍需重建、持续占领费用与议约。');
        buttons[doctrine]={text:cfg.name,available:()=>!this.reason(s,key,'campaign',doctrine),nextScene:'end',onChoose:()=>finish(this.start(s,key,'campaign',doctrine),'行动队按所选方案出发；战役结束后仍须重建和议约。')};
      }
      if(n&&n.joinedAt===null){text.push('共同法接纳：'+(this.joinReason(s,key)||'双方可以签署')+'。本城 '+CivilHistory.costText(CivilWorldContent.membership.home)+'；地方 '+CivilHistory.costText(CivilWorldContent.membership.local)+'。以后每10秒分别承担公共经费。');buttons.join={text:'签署地区共同法',available:()=>!this.joinReason(s,key),nextScene:'end',onChoose:()=>finish(this.join(s,key),'两地实付共同法议约。城市网络保留当地居民、资产和公共账册。')};}
      if(n?.control==='occupied')buttons.withdraw={text:'撤销军事占领',nextScene:'end',onChoose:()=>finish(this.withdraw(s,key),'驻防支出停止，地方恢复独立；死伤、设施损害与关系后果保留。')};
    }
    buttons.close={text:'合上国家远域记录',nextScene:'end',onChoose:done('国家行动及地方公共账册继续按实际条件运行。')};return {title:id==='worldCouncil'?'国家远域与外交':CivilWorldContent.regions[id.slice(6)].name,text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#worldButton,#worldSummary').hide();return;}
    Civilization.button('worldButton','国家远域与外交','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='worldCouncil';Civilization.showPending();}).show();
    let line=$('#worldSummary');if(!line.length)line=$('<div>').attr('id','worldSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).insertAfter('#worldButton');line.show().text(this.summary(State));
  },
  validate(s){
    const d=this.data(s),at=s.civilization.elapsed,fail=()=>{throw Error('国家远域行动或公共账册无效');},obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=at,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),int=x=>Number.isSafeInteger(x)&&x>=0;
    if(d===undefined){if(CivilForeign.pendingIds.includes(s.civilization.pending))fail();if(CivilStatecraft.pendingIds.includes(s.civilization.pending)||this.pendingIds.includes(s.civilization.pending)&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||!this.asset(s)||!time(d.startedAt)||!obj(d.nodes)||!Array.isArray(d.missions)||!d.missions.length||!Array.isArray(d.ledger)||d.lastTickAt!==null&&!time(d.lastTickAt)||d.lastSettledAt!==null&&!time(d.lastSettledAt))fail();
    if(CivilStatecraft.pendingIds.includes(s.civilization.pending)&&(!s.civilization.tech.computing||!Object.keys(d.nodes).length||s.civilization.pending.startsWith('accord_')&&!d.nodes[s.civilization.pending.slice(7)]))fail();
    if(CivilForeign.pendingIds.includes(s.civilization.pending)&&(!CivilForeign.available(s)||s.civilization.pending!=='foreignCouncil'&&(!d.foreign||s.civilization.pending.startsWith('foreign_')&&!d.foreign.actors[s.civilization.pending.slice(8)]||s.civilization.pending.startsWith('foreignPair_')&&!d.foreign.pairs[s.civilization.pending.slice(12)])))fail();
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
      if(r.kind==='foreign'){if(!s.civilization.tech.computing)fail();CivilForeign.validateRecord(replay,r);}
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
