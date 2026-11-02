/* MPL-2.0 — Autonomous actors replay from actual world budgets, never wall time. */
var CivilForeign={
  pendingIds:['foreignCouncil','foreignAccounts',...Object.keys(CivilWorldContent.regions).map(id=>'foreign_'+id),...Object.keys(CivilWorldContent.regions).sort().flatMap((a,i,ids)=>ids.slice(i+1).map(b=>'foreignPair_'+a+'-'+b))],
  data(s){return CivilWorld.data(s)?.foreign;},
  available(s){return !!s.civilization.tech.computing&&Object.keys(CivilWorld.data(s)?.nodes||{}).length>=2;},
  pair(a,b){return [a,b].sort().join('-');},
  ids(key){return key.split('-');},
  name(id){return CivilWorldContent.regions[id].name;},
  label(key){return this.ids(key).map(id=>this.name(id)).join(' ↔ ');},
  clamp(n,min,max){return Math.max(min,Math.min(max,n));},
  reserve(){return CivilStatecraft.scale(CivilWorldContent.services,12);},
  canSpend(n,cost){return CivilRegions.canPay(n.stores,CivilStatecraft.add(cost,this.reserve()));},
  addEvent(f,at,kind,text){f.events.push({at,kind,text});},
  sync(d,at=d.foreign?.lastRoundAt){const f=d.foreign;if(!f)return;for(const id of Object.keys(d.nodes).sort())if(!f.actors[id])f.actors[id]={balance:0,debtSince:null,overdueAt:null,decision:'核对地方产业与公共储备'};const ids=Object.keys(f.actors).sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=this.pair(ids[i],ids[j]);if(!f.pairs[key])f.pairs[key]={pressure:0,relation:0,phase:'calm',since:at,truceUntil:0,battles:0,lastProposalAt:null};}},
  fighting(d,id){return Object.entries(d.foreign?.pairs||{}).some(([key,p])=>p.phase==='war'&&this.ids(key).includes(id));},
  blocked(p){return ['embargo','war'].includes(p.phase);},
  target(id){return CivilForeignContent.profiles[id].use*60;},
  shortage(d,id){const p=CivilForeignContent.profiles[id];return (d.nodes[id].stores[p.need]||0)<this.target(id);},
  overdue(f,id,at){const a=f.actors[id];return a.balance<0&&a.debtSince!==null&&at>=CivilLeagues.deadline(f,id);},
  limit(d,id){const f=d.foreign;return Math.max(0,CivilForeignContent.credit[f.creditPolicy].limit+Math.floor(d.nodes[id].trust*2)-(this.fighting(d,id)?100:0)+CivilLeagues.credit(d,id));},
  price(d,seller,item){const p=CivilForeignContent.profiles[seller],stock=d.nodes[seller].stores[item]||0,target=p.need===item?this.target(seller):60;return CivilForeignContent.prices[item]*(stock<target?2:1);},
  rate(d,id){if(!d?.foreign)return undefined;const p=CivilForeignContent.profiles[id],item=Object.keys(CivilStatecraftContent.regions[id].take)[0];let rate=(d.nodes[id].stores[p.need]||0)<this.target(id)/2?125:90;if((d.nodes[id].stores[item]||0)<60)rate-=25;if(this.fighting(d,id))rate-=25;if(d.foreign.actors[id]&&d.foreign.actors[id].overdueAt!==null)rate-=10;return this.clamp(rate,60,150);},
  startReason(s){if(!this.available(s))return '先研究国家计算，并联络至少两个地区';if(this.data(s))return '联席机制已运行';if(!CivilWorld.political(s))return '先恢复国家行政';return CivilFinance.reserveCheck(s,'home',CivilForeignContent.opening)?null:'预留知识180、电子20和本城供养';},
  start(s){if(this.startReason(s))return false;CivilServices.pay(s.stores,CivilForeignContent.opening);CivilWorld.record(CivilWorld.data(s),{kind:'foreign',action:'open',at:s.civilization.elapsed,cost:{...CivilForeignContent.opening}});return true;},
  policyReason(s,mode){const f=this.data(s);if(!f||!Object.hasOwn(CivilForeignContent.credit,mode))return '尚未建立联席清算';if(f.creditPolicy===mode)return '已采用该授信尺度';if(s.civilization.elapsed-f.policyAt<600)return '授信调整须间隔600秒';if(!CivilWorld.political(s))return '先恢复国家行政';return CivilFinance.reserveCheck(s,'home',{knowledge:60})?null:'预留知识60与本城供养';},
  setPolicy(s,mode){if(this.policyReason(s,mode))return false;const cost={knowledge:60};CivilServices.pay(s.stores,cost);CivilWorld.record(CivilWorld.data(s),{kind:'foreign',action:'policy',mode,at:s.civilization.elapsed,cost});return true;},
  score(d,key,kind,political){const f=d.foreign,p=f.pairs[key],[a,b]=this.ids(key),both=d.nodes[a].joinedAt!==null&&d.nodes[b].joinedAt!==null;return 35+Math.floor(p.relation/2)+(both?25:0)+(political?15:-20)+(d.nodes[a].accord&&!d.nodes[a].accord.missed?10:0)+(d.nodes[b].accord&&!d.nodes[b].accord.missed?10:0)+CivilForeignContent.proposals[kind].bonus-Math.floor(p.pressure/2);},
  proposalReason(s,key,kind){const f=this.data(s),p=f?.pairs[key];if(!p||!Object.hasOwn(CivilForeignContent.proposals,kind))return '没有这项地区议题';if(p.pressure===0&&p.phase==='calm')return '双方目前没有争议';if(f.proposals.some(o=>o.pair===key&&o.resolvedAt===null))return '这对地区正在审议原提案';if(p.lastProposalAt!==null&&s.civilization.elapsed-p.lastProposalAt<600)return '同一争议每600秒才可重提';if(!CivilWorld.political(s))return '先恢复国家行政';return CivilFinance.reserveCheck(s,'home',CivilForeignContent.proposals[kind].cost)?null:'备齐提案所需实际经费，并保留本城供养';},
  propose(s,key,kind){if(this.proposalReason(s,key,kind))return false;const cost={...CivilForeignContent.proposals[kind].cost};CivilServices.pay(s.stores,cost);CivilWorld.record(CivilWorld.data(s),{kind:'foreign',action:'proposal',pair:key,proposal:kind,at:s.civilization.elapsed,cost});return true;},
  apply(d,r){
    if(r.action==='open'){d.foreign={schema:1,startedAt:r.at,lastRoundAt:r.at,round:0,creditPolicy:'balanced',policyAt:r.at,actors:{},pairs:{},shipments:[],proposals:[],events:[]};this.sync(d);return;}
    const f=d.foreign;
    if(r.action==='policy'){f.creditPolicy=r.mode;f.policyAt=r.at;this.addEvent(f,r.at,'policy','联区清算采用'+CivilForeignContent.credit[r.mode].name+'；旧账单与货物不改价。');return;}
    f.pairs[r.pair].lastProposalAt=r.at;f.proposals.push({id:f.proposals.length+1,pair:r.pair,kind:r.proposal,at:r.at,paid:{...r.cost},resolvedAt:null,accepted:null,score:null});
  },
  validateRecord(d,r){const fail=()=>{throw Error('国家自主外交记录无效');},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),f=d.foreign;
    if(r.action==='open'){if(f||Object.keys(d.nodes).length<2||!same(r.cost,CivilForeignContent.opening))fail();return;}
    if(!f)fail();
    if(r.action==='policy'){if(!Object.hasOwn(CivilForeignContent.credit,r.mode)||r.mode===f.creditPolicy||r.at-f.policyAt<600||!same(r.cost,{knowledge:60}))fail();return;}
    if(r.action!=='proposal'||!f.pairs[r.pair]||!Object.hasOwn(CivilForeignContent.proposals,r.proposal))fail();const p=f.pairs[r.pair];if(p.pressure===0&&p.phase==='calm'||f.proposals.some(o=>o.pair===r.pair&&o.resolvedAt===null)||p.lastProposalAt!==null&&r.at-p.lastProposalAt<600||!same(r.cost,CivilForeignContent.proposals[r.proposal].cost))fail();
  },
  account(f,id,amount,at){const a=f.actors[id];a.balance+=amount;if(a.balance>=0){a.debtSince=null;a.overdueAt=null;}else if(a.debtSince===null)a.debtSince=at;},
  round(d,r){
    const f=d.foreign;if(!f||r.at-f.lastRoundAt<CivilForeignContent.interval)return;this.sync(d,r.at);f.lastRoundAt=r.at;f.round++;const at=r.at,ids=Object.keys(f.actors).sort();
    // Cargo is reserved at dispatch. An embargo cannot duplicate or seize an
    // already accepted legacy consignment. Opt-in route manifests may return
    // undelivered cargo and reverse its clearing claim without duplication.
    for(const o of f.shipments)if(o.arrivedAt===null&&at>=o.dueAt&&CivilLeagues.arrive(d,o,at)){CivilRegions.credit(d.nodes[o.to].stores,o.cargo);o.arrivedAt=at;const p=f.pairs[this.pair(o.from,o.to)];p.relation=this.clamp(p.relation+8,-100,100);p.pressure=Math.max(0,p.pressure-10);this.addEvent(f,at,'arrival',this.name(o.from)+'向'+this.name(o.to)+'交付'+CivilHistory.costText(o.cargo)+'；清算账额'+o.value+'。');}
    CivilLeagues.beforeRound(d,r);
    for(const o of f.proposals)if(o.resolvedAt===null&&at-o.at>=300){const p=f.pairs[o.pair];o.score=this.score(d,o.pair,o.kind,r.political);o.accepted=o.score>=50;o.resolvedAt=at;if(o.accepted){p.phase='truce';p.since=at;p.truceUntil=at+1800;p.pressure=Math.max(0,p.pressure-45);p.relation=this.clamp(p.relation+15,-100,100);p.battles=0;}else{p.relation=Math.max(-100,p.relation-5);}this.addEvent(f,at,'proposal',this.label(o.pair)+(o.accepted?'接受':'拒绝')+CivilForeignContent.proposals[o.kind].name+'（判断'+o.score+'/50）；'+(o.accepted?'1800秒停火与预算协商期，货物仍须实际采购。':'经费已经使用，须改善利益与关系后再议。'));}
    for(const id of ids){const n=d.nodes[id],p=CivilForeignContent.profiles[id],a=f.actors[id];
      if(this.overdue(f,id,at)&&a.overdueAt===null){a.overdueAt=at;this.addEvent(f,at,'credit',this.name(id)+'清算欠款到期，停止新增赊购；出口回款仍用于偿债。');}
      if(this.fighting(d,id)||n.control==='occupied'){a.decision='冲突或占领中，地方工坊停产';continue;}
      if(n.infrastructure<100){if(d.missions.some(m=>m.region===id&&m.kind==='rebuild'&&m.departedAt<=at&&(m.completedAt===null||at<m.completedAt)&&(m.cancelledAt===null||at<m.cancelledAt))){a.decision='等待已经派出的重建队，避免重复施工';continue;}const repair={food:20,tools:6,parts:6};if(this.canSpend(n,repair)){CivilServices.pay(n.stores,repair);n.infrastructure=Math.min(100,n.infrastructure+5);a.decision='实付公共材料，修复5%设施';}continue;}
      const cost={food:12,[p.need]:p.use};if(p.need==='food')cost.food+=p.use;
      if(this.canSpend(n,cost)){CivilServices.pay(n.stores,cost);CivilRegions.credit(n.stores,p.output);a.decision='公共工坊消耗'+CivilHistory.costText(cost)+'，产出'+CivilHistory.costText(p.output);}else a.decision='缺少'+CivilText.labels[p.need]+'，公共工坊停产';
    }
    // Rotate buyers to avoid a permanent alphabetical priority on scarce goods.
    const buyers=ids.slice(f.round%ids.length).concat(ids.slice(0,f.round%ids.length));
    for(const id of buyers){const n=d.nodes[id],a=f.actors[id],p=CivilForeignContent.profiles[id];if(!this.shortage(d,id)||(!f.leagues&&this.fighting(d,id))||n.control==='occupied'||f.shipments.some(o=>o.arrivedAt===null&&(o.from===id||o.to===id)))continue;
      const qty=p.use*3,cargo={[p.need]:qty};
      const sellers=ids.filter(other=>other!==id&&(f.leagues||!this.fighting(d,other))&&d.nodes[other].control!=='occupied'&&!this.blocked(f.pairs[this.pair(id,other)])&&!f.shipments.some(o=>o.arrivedAt===null&&(o.from===other||o.to===other))&&this.canSpend(d.nodes[other],cargo)&&((CivilForeignContent.profiles[other].need!==p.need)||(d.nodes[other].stores[p.need]||0)>this.target(other)+qty)).sort((x,y)=>this.price(d,x,p.need)-this.price(d,y,p.need)||f.pairs[this.pair(id,y)].relation-f.pairs[this.pair(id,x)].relation||x.localeCompare(y));
      const seller=sellers[0];if(!seller){a.decision+='；正在寻找'+CivilText.labels[p.need]+'供应方';continue;}
      const route=CivilLeagues.route(d,seller,id),fare=route.fare,price=this.price(d,seller,p.need),value=qty*price;if(this.overdue(f,id,at)||a.balance-value< -this.limit(d,id)){a.decision+='；清算信用不足，优先出口偿债';continue;}
      if(!this.canSpend(n,fare)){a.decision+='；运输经费不足';continue;}
      CivilServices.pay(n.stores,fare);CivilServices.pay(d.nodes[seller].stores,cargo);this.account(f,id,-value,at);this.account(f,seller,value,at);
      const order={id:f.shipments.length+1,from:seller,to:id,departedAt:at,dueAt:at+route.duration,arrivedAt:null,cargo,price,value,fare:{...fare},...(route.mode?{route:route.mode}:{})};f.shipments.push(order);a.decision='向'+this.name(seller)+'采购'+CivilHistory.costText(cargo)+'，账额'+value+'；'+route.duration+'秒后到货';this.addEvent(f,at,'trade',this.name(id)+'自主'+a.decision+'。');
    }
    // Creditors can redeem claims against a debtor's actual export stock.
    // This closes the food/knowledge side of the economy instead of leaving
    // exporters permanently indebted because nobody has the same input recipe.
    for(const buyer of buyers){const claim=f.actors[buyer];if(claim.balance<=0||(!f.leagues&&this.fighting(d,buyer))||d.nodes[buyer].control==='occupied'||f.shipments.some(o=>o.arrivedAt===null&&(o.from===buyer||o.to===buyer)))continue;
      const debtors=ids.filter(id=>id!==buyer&&f.actors[id].balance<0&&(f.leagues||!this.fighting(d,id))&&d.nodes[id].control!=='occupied'&&!this.blocked(f.pairs[this.pair(buyer,id)])&&!f.shipments.some(o=>o.arrivedAt===null&&(o.from===id||o.to===id))).sort((a,b)=>f.actors[a].balance-f.actors[b].balance||a.localeCompare(b));
      for(const seller of debtors){const item=Object.keys(CivilForeignContent.profiles[seller].output).find(k=>this.canSpend(d.nodes[seller],{[k]:1}));if(!item)continue;const unit=this.price(d,seller,item),owed=Math.min(claim.balance,-f.actors[seller].balance),qty=Math.max(1,Math.min(item==='food'?36:10,Math.floor(owed/unit))),cargo={[item]:qty},route=CivilLeagues.route(d,seller,buyer),fare=route.fare,value=Math.min(owed,qty*unit);
        if(!this.canSpend(d.nodes[seller],cargo)||!this.canSpend(d.nodes[buyer],fare))continue;
        CivilServices.pay(d.nodes[seller].stores,cargo);CivilServices.pay(d.nodes[buyer].stores,fare);this.account(f,buyer,-value,at);this.account(f,seller,value,at);f.shipments.push({id:f.shipments.length+1,from:seller,to:buyer,departedAt:at,dueAt:at+route.duration,arrivedAt:null,cargo,price:value/qty,value,fare:{...fare},settlement:true,...(route.mode?{route:route.mode}:{})});
        claim.decision='用'+value+'账额回购'+this.name(seller)+'的'+CivilHistory.costText(cargo)+'抵账；'+route.duration+'秒后到货';this.addEvent(f,at,'trade',this.name(buyer)+claim.decision+'。不足一件的尾差双方折价结清。');break;
      }
    }
    for(const[key,p]of Object.entries(f.pairs)){
      const [a,b]=this.ids(key),na=d.nodes[a],nb=d.nodes[b],both=na.joinedAt!==null&&nb.joinedAt!==null,pa=CivilForeignContent.profiles[a],pb=CivilForeignContent.profiles[b];
      if(p.phase==='war'){
        const cost={food:18,medicine:2,tools:2};
        if(both||na.population<3||nb.population<3||p.battles>=3||!this.canSpend(na,cost)||!this.canSpend(nb,cost)||na.control==='occupied'||nb.control==='occupied'){
          p.phase='truce';p.since=at;p.truceUntil=at+1800;p.pressure=25;p.battles=0;this.addEvent(f,at,'truce',this.label(key)+'因共同法或军需与战疲停止交火；进入1800秒停火期。');
        }else{for(const n of [na,nb]){CivilServices.pay(n.stores,cost);const dead=Math.min(2,Math.max(0,n.population-1));n.population-=dead;n.casualties+=dead;n.infrastructure=Math.max(40,n.infrastructure-5);n.stableSeconds=0;}p.battles++;this.addEvent(f,at,'battle',this.label(key)+'发生边境交火；双方实付军需，各死亡2人、设施损失5%。');}continue;
      }
      if(p.phase==='truce'&&at<p.truceUntil)continue;
      const contested=pa.need===pb.need&&this.shortage(d,a)&&this.shortage(d,b);
      const supply=(Object.hasOwn(pa.output,pb.need)&&this.shortage(d,b))||(Object.hasOwn(pb.output,pa.need)&&this.shortage(d,a));
      const transit=f.shipments.some(o=>o.arrivedAt===null&&this.pair(o.from,o.to)===key);
      const broken=(na.accord?.missed||nb.accord?.missed)?8:0;
      const delta=(contested?12+pa.resolve+pb.resolve:supply?8: -8)+broken+(r.political?0:4)-(transit?16:0)-(p.relation>=40?6:0);
      const acute=(na.stores[pa.need]||0)<pa.use*3||(nb.stores[pb.need]||0)<pb.use*3||this.overdue(f,a,at)||this.overdue(f,b,at);
      p.pressure=this.clamp(p.pressure+delta,0,acute?100:60);const previous=p.phase;
      p.phase=both?(p.pressure>=40?'dispute':'calm'):p.pressure>=85?'war':p.pressure>=65?'embargo':p.pressure>=40?'warning':'calm';
      if(previous!==p.phase){p.since=at;if(p.phase==='war')p.battles=0;this.addEvent(f,at,'relation',this.label(key)+'：'+this.phaseName(p.phase)+'；压力'+p.pressure+'，原因：'+(contested?'争夺同类稀缺投入':supply?'供应依赖与交付不足':broken?'政治承诺中断':'关系与公共供给变化')+'。');}
      if(p.phase==='war'||p.phase==='dispute'&&p.pressure>=85){na.stableSeconds=0;nb.stableSeconds=0;}
    }
    CivilLeagues.afterRound(d,r);
  },
  // A player campaign changes third-party assessments as well as local trust.
  campaign(d,m,at){const f=d.foreign;if(!f)return;this.sync(d,at);for(const[key,p]of Object.entries(f.pairs))if(this.ids(key).includes(m.region)){p.pressure=this.clamp(p.pressure+25,0,100);p.relation=Math.max(-100,p.relation-20);}this.addEvent(f,at,'campaign',this.name(m.region)+'的战役使相关政体提高警戒，双边压力+25、关系-20。');},
  stability(d){const f=d.foreign;if(!f)return;for(const[key,p]of Object.entries(f.pairs))if(p.phase==='war'||p.phase==='dispute'&&p.pressure>=85)for(const id of this.ids(key))d.nodes[id].stableSeconds=0;},
  phaseName(phase){return {calm:'正常往来',warning:'外交警告',embargo:'停止新贸易',war:'边境战争',truce:'停火协商',dispute:'共同法内预算争议'}[phase];},
  summary(s){const f=this.data(s);if(!f)return '各方自主采购、清算和局势评估将在建立联席后运行';const issues=Object.values(f.pairs).filter(p=>!['calm','truce'].includes(p.phase)).length,late=Object.values(f.actors).filter(a=>a.overdueAt!==null).length;return '联席第'+f.round+'轮 · 在途'+f.shipments.filter(o=>o.arrivedAt===null).length+'批 · 争议'+issues+'组 · 逾期'+late+'方';},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,d=CivilWorld.data(s),f=d?.foreign,text=[],buttons={},finish=(ok,msg)=>done(ok?msg:'条件已变化，本次没有执行。')();
    if(id==='foreignCouncil'){
      text.push(this.summary(s));if(!f){text.push('建立联席通信与清算：知识180、电子20。此后各方每300秒按实际库存组织公共工坊、采购和局势评估；会发生欠款、供给争议、禁运或有限战争。已接纳成员之间只走预算争议，不重新互相宣战。','地方工坊有实物投入；地区商队使用独立公共运力和当地旅费，不占本城六人行动队。清算账额只是地区间货物债权，不是本城可花的钱。');buttons.open={text:'建立常设联席与清算',available:()=>!this.startReason(s),nextScene:'end',onChoose:()=>finish(this.start(s),'联席已建立。各方开始独立核对产业、信用与关系。')};}
      else{for(const actor of Object.keys(f.actors)){const a=f.actors[actor];text.push(this.name(actor)+'：'+a.decision);buttons[actor]={text:this.name(actor),nextScene:'end',onChoose:()=>{s.civilization.pending='foreign_'+actor;}};}buttons.accounts={text:'查看联区清算与授信',nextScene:'end',onChoose:()=>{s.civilization.pending='foreignAccounts';}};if(f.round>=2)buttons.leagues={text:'联盟与贸易线路',nextScene:'end',onChoose:()=>{s.civilization.pending='leagueCouncil';}};}
    }else if(id==='foreignAccounts'){
      if(!f)return null;text.push('当前'+CivilForeignContent.credit[f.creditPolicy].name+'。账额总和恒为0：正数为已交出或在途货物的债权，负数为待以出口偿还的欠款；不能兑换本城库存。'+(f.leagues?'货物先真实出库，按运单的直达、护航或绕行时间交付；退运反向冲销原账额。':'每笔货物先真实出库，300秒后到货。'),'首次负余额起1800秒到期，继续借款不会刷新期限。逾期停止赊购，出口抵债；债权方也会用账额回购真实出口物资，尾差折价结清。额度随地区信任和战争风险变化。');
      for(const[id,a]of Object.entries(f.actors))text.push(this.name(id)+'：账额'+a.balance+'；信用上限'+this.limit(d,id)+(a.debtSince!==null?'；到期余'+Math.max(0,CivilLeagues.deadline(f,id)-s.civilization.elapsed)+'秒':'')+(a.overdueAt!==null?'；已逾期':'')+'。');
      if(f.leagues)text.push('通商联盟每份另加40授信，失信每点扣3。展期只在债权方同意后生效，本金与费用仍须出口偿还；具体到期日见各地区记录。');
      text.push('授信基础额度120/240/480；另加信任×2，战争扣100。改议知识60、间隔600秒；旧账不改写。额度越大，能周转更多货物，也可能积累更大欠款。');for(const[mode,cfg]of Object.entries(CivilForeignContent.credit))buttons[mode]={text:cfg.name,available:()=>!this.policyReason(s,mode),nextScene:'end',onChoose:()=>finish(this.setPolicy(s,mode),'联区授信尺度已调整，旧债保留。')};
    }else if(id.startsWith('foreignPair_')){
      const key=id.slice(12),p=f?.pairs[key];if(!p)return null;text.push(this.label(key)+'：'+this.phaseName(p.phase)+'；关系'+p.relation+'、压力'+p.pressure+'。');
      for(const actor of this.ids(key)){const cfg=CivilForeignContent.profiles[actor];text.push(this.name(actor)+'：需要'+CivilText.labels[cfg.need]+'，库存'+Math.floor(d.nodes[actor].stores[cfg.need]||0)+' / 目标'+this.target(actor)+'；清算账额'+f.actors[actor].balance+'。'+f.actors[actor].decision);}
      text.push('判断达到50才接受。共同法成员、持续协约和正常行政有利于调停；敌意与高压力降低接受度。至少300秒后按届时局势答复，拒绝也不退已使用经费。');
      for(const kind of Object.keys(CivilForeignContent.proposals)){const cfg=CivilForeignContent.proposals[kind],score=this.score(d,key,kind,CivilWorld.political(s));text.push(cfg.name+'：'+CivilHistory.costText(cfg.cost)+'；当前判断'+score+'/50。'+(this.proposalReason(s,key,kind)||'可以提出'));buttons[kind]={text:cfg.name,available:()=>!this.proposalReason(s,key,kind),nextScene:'end',onChoose:()=>finish(this.propose(s,key,kind),'提案与经费已经提交。各方将独立审议，不保证接受。')};}
      const last=f.proposals.filter(o=>o.pair===key).at(-1);if(last)text.push('最近提案：'+(last.resolvedAt===null?'正在审议':last.accepted?'已接受，停火协商1800秒':'已拒绝')+'。');
    }else{
      const actor=id.slice(8);if(!f?.actors[actor])return null;const profile=CivilForeignContent.profiles[actor];text.push(this.name(actor)+'：'+f.actors[actor].decision,'公共工坊每300秒消耗粮12、'+CivilText.labels[profile.need]+profile.use+'，产出'+CivilHistory.costText(profile.output)+'。当前进口储备'+Math.floor(d.nodes[actor].stores[profile.need]||0)+'，采购目标'+this.target(actor)+'；受损时优先修复，交火或占领时停产。');
      const relevant=Object.entries(f.pairs).filter(([key,p])=>this.ids(key).includes(actor)&&p.phase!=='calm').sort((a,b)=>b[1].pressure-a[1].pressure);
      for(const[key,p]of relevant){const other=this.ids(key).find(x=>x!==actor);text.push(this.name(other)+'：'+this.phaseName(p.phase)+'；关系'+p.relation+'、压力'+p.pressure+(p.phase==='truce'?'；停火余'+Math.max(0,p.truceUntil-s.civilization.elapsed)+'秒':'')+'。');buttons[key]={text:'与'+this.name(other)+'交涉',nextScene:'end',onChoose:()=>{s.civilization.pending='foreignPair_'+key;}};}
      if(!relevant.length)text.push('当前没有外交警告、禁运或预算争议。贸易与信用会改变后续关系。');
      const recent=f.events.filter(e=>e.text.includes(this.name(actor))).slice(-4);for(const e of recent)text.push(e.text);
    }
    buttons.close={text:'合上联席记录',nextScene:'end',onChoose:done('各地继续按实际供给、信用与关系行动。')};return {title:id==='foreignAccounts'?'联区清算与授信':'地区自主外交与局势',text,buttons};
  },
  refresh(){if(typeof $==='undefined'||!$('#councilPanel').length)return;if(!this.available(State)){$('#foreignButton,#foreignSummary').hide();return;}Civilization.button('foreignButton','地区自主外交与局势','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='foreignCouncil';Civilization.showPending();}).show();let line=$('#foreignSummary');if(!line.length)line=$('<div>').attr('id','foreignSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).insertAfter('#foreignButton');line.show().text(this.summary(State));}
};
