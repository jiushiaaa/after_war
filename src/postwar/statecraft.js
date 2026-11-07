/* MPL-2.0 — All regional inventory writes replay through the world ledger. */
var CivilStatecraft={
  pendingIds:['statecraftCouncil',...Object.keys(CivilStatecraftContent.regions).map(id=>'accord_'+id)],
  special(kind){return ['exchange','credit','repay'].includes(kind);},
  mode(d){return d?.economy?.mode||'mixed';},
  policy(d){return CivilStatecraftContent.policies[this.mode(d)];},
  add(...bundles){const out={};for(const b of bundles)for(const[k,v]of Object.entries(b||{}))out[k]=(out[k]||0)+v;return out;},
  scale(b,n){return Object.fromEntries(Object.entries(b).map(([k,v])=>[k,Math.ceil(v*n)]));},
  choice(n,id){return n?.accord?CivilStatecraftContent.regions[id].choices[n.accord.choice]:null;},
  pledge(cfg,rights,devolution){return (!cfg.equal||rights==='equal')&&(!cfg.local||devolution==='local');},
  config(m){
    if(m.kind==='campaign'&&m.doctrine)return CivilStatecraftContent.doctrines[m.doctrine];
    if(!this.special(m.kind))return CivilWorldContent.missions[m.kind];
    const p=CivilStatecraftContent.policies[m.economy],r=CivilStatecraftContent.regions[m.region];if(!Object.hasOwn(CivilStatecraftContent.policies,m.economy)||!r)return null;
    const name=CivilWorldContent.missions[m.kind].name;
    if(m.kind==='exchange'){const cargo=this.scale(r.give,p.input),receive=this.scale(r.take,p.output*(m.marketRate??100)/100);return {name,cargo,receive,cost:this.add(cargo,CivilStatecraftContent.voyage),work:60};}
    const interest=this.scale(r.loan,p.interest),debt=this.add(r.loan,interest);
    if(m.kind==='credit')return {name,cargo:{...CivilStatecraftContent.collateral},receive:{...r.loan},debt,cost:this.add(CivilStatecraftContent.collateral,CivilStatecraftContent.voyage),work:120};
    const receive=m.forfeited?{}:{...CivilStatecraftContent.collateral};return {name,cargo:debt,receive,debt,cost:this.add(debt,CivilStatecraftContent.voyage),work:60};
  },
  reason(s,id,kind){
    const d=CivilWorld.data(s),n=d?.nodes[id];
    if(!n?.accord||n.joinedAt===null)return '请先接纳本地区并签下特色协约';
    if(n.accord.missed||n.accord.paidCycles<6)return '特色协约须稳定维持至少60秒，请先核对承诺与经费';
    if(kind!=='repay'&&n.credit?.status==='default')return '旧信贷已违约，须先结清欠款';
    if(kind==='exchange'&&n.tradeAt!==undefined&&s.civilization.elapsed-n.tradeAt<600)return '本地区互市每600秒限跑一趟，以免掏空公库';
    if(kind==='credit'&&d.foreign?.actors[id]?.overdueAt!==undefined&&d.foreign.actors[id].overdueAt!==null)return '地方清算欠款已逾期，请先恢复地区出口与信用';
    if(kind==='credit'&&n.credit)return '本地区当期重建信贷已支取，不可无限循环举债';
    if(kind==='repay'&&(!n.credit||!['open','default'].includes(n.credit.status)))return '当前并无待偿还的信贷';
    const m=this.quote(s,id,kind),cfg=this.config(m),reserve=this.scale(CivilWorldContent.services,12);
    if(kind!=='repay'&&!CivilRegions.canPay(n.stores,this.add(cfg.receive,reserve)))return '地方须先留足公共供养，余力方可开展互市或放贷';
    return null;
  },
  quote(s,id,kind){const d=CivilWorld.data(s),n=d?.nodes[id];return {region:id,kind,...(kind==='exchange'&&d?.foreign?{marketRate:CivilForeign.rate(d,id)}:{}),economy:kind==='repay'?n?.credit?.economy:this.mode(d),...(kind==='repay'?{forfeited:n?.credit?.status==='default'}:{})};},
  policyReason(s,mode){const d=CivilWorld.data(s),p=CivilStatecraftContent.policies[mode];if(!Object.hasOwn(CivilStatecraftContent.policies,mode)||!s.civilization.tech.computing||!Object.keys(d?.nodes||{}).length)return '请先研究国家计算并建立国家联络';if(!CivilWorld.political(s)||CivilWorld.active(s))return '请先恢复国家行政并等行动队返城';if(this.mode(d)===mode)return '当前已采用此项制度';if(d.economy&&s.civilization.elapsed-d.economy.changedAt<600)return '制度改议后须满600秒方能再议';if(p.local&&s.civilization.society.axes.devolution!=='local')return '合作互助制度须以地方自治为前提';return CivilFinance.reserveCheck(s,'home',{knowledge:120,electronics:10})?null:'请预留知识120、电子元件10及本城供养';},
  setPolicy(s,mode){if(this.policyReason(s,mode))return false;const cost={knowledge:120,electronics:10};CivilServices.pay(s.stores,cost);CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'policy',mode,at:s.civilization.elapsed,cost,local:s.civilization.society.axes.devolution});return true;},
  accordReason(s,id,index){const n=CivilWorld.data(s)?.nodes[id],cfg=CivilStatecraftContent.regions[id]?.choices[index];if(!n||!cfg||!s.civilization.tech.computing)return '请先建立国家联络并完成国家计算研究';if(n.control==='occupied'||n.infrastructure<100)return '请先解除军事占领并修妥受损设施';if(n.accord)return '已有长期协约；可正常维护或出资重申，不可重复支取首次信任加成';if(CivilWorld.active(s)||!CivilWorld.political(s))return '请先恢复行政并等行动队返城';if(!this.pledge(cfg,s.civilization.regions.rights,s.civilization.society.axes.devolution))return '此方案要求实行平等公民资格或地方自治';return CivilFinance.reserveCheck(s,'home',cfg.cost)?null:'请备足议约投入，并留足本城供养';},
  sign(s,id,index){if(this.accordReason(s,id,index))return false;const cfg=CivilStatecraftContent.regions[id].choices[index];CivilServices.pay(s.stores,cfg.cost);CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'accord',region:id,choice:index,at:s.civilization.elapsed,cost:{...cfg.cost},rights:s.civilization.regions.rights,devolution:s.civilization.society.axes.devolution});return true;},
  renewReason(s,id){const n=CivilWorld.data(s)?.nodes[id];if(CivilWorld.active(s)||!CivilWorld.political(s))return '请先恢复行政并等行动队返城';if(!n?.accord||n.accord.missed)return '请先恢复协约履约';if(n.trust>=100)return '信任已满100';if(s.civilization.elapsed-(n.accord.renewedAt??n.accord.at)<600)return '距上次签署或重申须满600秒';return CivilFinance.reserveCheck(s,'home',{knowledge:80,tools:20})?null:'请预留知识80、工具20及本城供养';},
  renew(s,id){if(this.renewReason(s,id))return false;const cost={knowledge:80,tools:20};CivilServices.pay(s.stores,cost);CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'renew',region:id,at:s.civilization.elapsed,cost});return true;},
  upkeep(d,id){return this.add(this.choice(d.nodes[id],id).upkeep,this.policy(d).upkeep);},
  budget(s,political){const d=CivilWorld.data(s),payments={},flow={};for(const[id,n]of Object.entries(d.nodes))if(n.accord){const cfg=this.choice(n,id),cost=this.upkeep(d,id),okay=political&&n.control!=='occupied'&&this.pledge(cfg,s.civilization.regions.rights,s.civilization.society.axes.devolution)&&(!this.policy(d).local||s.civilization.society.axes.devolution==='local');payments[id]=!!(okay&&CivilFinance.reserveCheck(s,'home',cost));if(payments[id]){CivilServices.pay(s.stores,cost);for(const[k,v]of Object.entries(cost))flow[k]=(flow[k]||0)-v;}}return {payments,flow};},
  afterBudget(d,r){for(const[id,n]of Object.entries(d.nodes)){
    if(n.credit?.status==='open'&&r.at>=n.credit.dueAt){n.credit.status='default';n.credit.defaultedAt=r.at;CivilRegions.credit(n.stores,{tools:n.credit.collateral});n.credit.collateral=0;n.trust=Math.max(0,n.trust-20);}
    if(n.accord){const paid=r.accordPayments?.[id];n.accord.missed=paid?0:Math.min(600,n.accord.missed+10);if(paid)n.accord.paidCycles++;if(!paid&&n.accord.missed===60)n.trust=Math.max(0,n.trust-10);if(!paid||n.credit?.status==='default'||n.credit?.status==='repaying'&&n.credit.defaultedAt!==undefined)n.stableSeconds=0;}
  }},
  apply(d,r){
    if(r.action==='policy'){d.economy={mode:r.mode,changedAt:r.at};return;}
    const n=d.nodes[r.region];
    if(r.action==='accord'){n.accord={choice:r.choice,at:r.at,missed:0,paidCycles:0};n.trust=Math.min(100,n.trust+CivilStatecraftContent.regions[r.region].choices[r.choice].trust);return;}
    if(r.action==='renew'){n.accord.renewedAt=r.at;n.trust=Math.min(100,n.trust+10);return;}
    const m=d.missions[r.mission-1],cfg=this.config(m);
    if(r.action==='dispatch'){
      if(m.kind==='repay'){n.credit.status='repaying';n.credit.collateral=0;}
      else CivilServices.pay(n.stores,cfg.receive);
      if(m.kind==='exchange')n.tradeAt=r.at;
    }
    if(r.action==='return'&&m.cancelledAt!==null){if(m.kind==='repay'){n.credit.status=m.forfeited?'default':'open';n.credit.collateral=cfg.receive.tools||0;}else CivilRegions.credit(n.stores,cfg.receive);}
  },
  deliver(d,m,at){const n=d.nodes[m.region],cfg=this.config(m);if(m.kind==='credit')n.credit={economy:m.economy,loanMission:m.id,openedAt:at,dueAt:at+CivilStatecraftContent.loanTerm,status:'open',collateral:40,closedAt:null};else{CivilRegions.credit(n.stores,cfg.cargo);if(m.kind==='repay'){n.credit.status='repaid';n.credit.closedAt=at;n.trust=Math.min(100,n.trust+10);}}},
  dispatched(s,m){if(!this.special(m.kind))return;m.returnCargo={...this.config(m).receive};CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'dispatch',region:m.region,mission:m.id,at:m.departedAt});},
  returned(s,m){if(!this.special(m.kind))return;if(m.cancelledAt===null)CivilRegions.credit(s.stores,m.returnCargo);CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'return',region:m.region,mission:m.id,at:m.returnedAt});m.returnCargo={};},
  validateRecord(d,r,s){
    const fail=()=>{throw Error('地区协约、互市或信贷记录无效');},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),n=d.nodes[r.region],p=CivilStatecraftContent.policies;
    if(r.action==='policy'){if(!Object.hasOwn(p,r.mode)||this.mode(d)===r.mode||d.economy&&r.at-d.economy.changedAt<600||!same(r.cost,{knowledge:120,electronics:10})||!['local','central'].includes(r.local)||p[r.mode].local&&r.local!=='local')fail();return;}
    if(!n)fail();
    if(r.action==='accord'){const cfg=CivilStatecraftContent.regions[r.region]?.choices[r.choice];if(!Number.isInteger(r.choice)||!cfg||n.accord||n.control==='occupied'||n.infrastructure!==100||!same(r.cost,cfg.cost)||!['equal','resident','stratified'].includes(r.rights)||!['central','local'].includes(r.devolution)||!this.pledge(cfg,r.rights,r.devolution))fail();return;}
    if(r.action==='renew'){if(!n.accord||n.accord.missed||n.trust>=100||r.at-(n.accord.renewedAt||n.accord.at)<600||!same(r.cost,{knowledge:80,tools:20}))fail();return;}
    const m=d.missions[r.mission-1],cfg=m&&this.config(m);if(!m||m.region!==r.region||!this.special(m.kind)||!cfg)fail();
    if(r.action==='dispatch'){
      if(m.kind==='exchange'&&m.marketRate!==CivilForeign.rate(d,m.region))fail();
      if(m.kind==='credit'&&d.foreign?.actors[m.region]?.overdueAt!==undefined&&d.foreign.actors[m.region].overdueAt!==null)fail();
      if(r.at!==m.departedAt||!n.accord||n.accord.missed||n.accord.paidCycles<6||n.joinedAt===null)fail();
      if(m.kind==='repay'){if(!n.credit||!['open','default'].includes(n.credit.status)||m.economy!==n.credit.economy||m.forfeited!==(n.credit.status==='default'))fail();}
      else if(m.economy!==this.mode(d)||n.credit?.status==='default'||!CivilRegions.canPay(n.stores,this.add(cfg.receive,this.scale(CivilWorldContent.services,12)))||m.kind==='credit'&&n.credit||m.kind==='exchange'&&n.tradeAt!==undefined&&r.at-n.tradeAt<600)fail();
      return;
    }
    if(r.action==='return'){if(m.returnedAt!==r.at)fail();return;}
    fail();
  },
  validateBudget(d,r){const ids=Object.keys(d.nodes).filter(id=>d.nodes[id].accord),rows=r.accordPayments??{};if(!rows||typeof rows!=='object'||Array.isArray(rows)||JSON.stringify(Object.keys(rows).sort())!==JSON.stringify(ids.sort())||Object.values(rows).some(v=>typeof v!=='boolean'))throw Error('协约持续预算无效');for(const id of ids)if(rows[id]&&(!r.political||d.nodes[id].control==='occupied'||!this.pledge(this.choice(d.nodes[id],id),r.rights,r.devolution)||this.policy(d).local&&r.devolution!=='local'))throw Error('协约政治承诺无效');},
  status(s,id){const d=CivilWorld.data(s),n=d.nodes[id],cfg=this.choice(n,id);return (cfg?cfg.name+' · '+(n.accord.missed?'承诺或经费已中断'+n.accord.missed+'秒':'持续履约')+'；每10秒耗 '+CivilHistory.costText(this.upkeep(d,id)):'尚未签署地区特色协约')+(n.credit?'；信贷 '+({open:'未偿还',default:'已违约，抵押物已没收',repaying:'还款在途',repaid:'已清偿'}[n.credit.status])+(n.credit.status==='open'?'，距到期尚余'+Math.max(0,n.credit.dueAt-s.civilization.elapsed)+'秒':''):'');},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,d=CivilWorld.data(s),text=[],buttons={},finish=(ok,msg)=>done(ok?msg:'条件已有变动，本次未执行。')();
    if(id==='statecraftCouncil'){
      text.push('国家经济制度：'+this.policy(d).name+'。更易制度将改变后续互市作价、每份协约的行政开支及新信贷利率；已在途运单与既有借贷合同不追溯改价。','公共计划：本城互市投入享八折；每份协约每10秒另耗知识0.4；新借信贷利息8%。','监管市场：地方互市实物输出增加25%；每份协约另耗工具0.08、知识0.05；新借信贷利息15%。','合作互助：保留地方自治；每份协约另耗药0.04、知识0.15；新借信贷利息5%。','混合协约：维持原价、无额外制度开支；新借信贷利息10%。');
      for(const[mode,p]of Object.entries(CivilStatecraftContent.policies))buttons[mode]={text:p.name,available:()=>!this.policyReason(s,mode),nextScene:'end',onChoose:()=>finish(this.setPolicy(s,mode),'国家经济制度已改定，既有合同仍按原价执行。')};
      text.push('每次改议需耗知识120、电子元件10，满600秒后方可再议。地区特色协约、互市与重建信贷将在各区外交记录中陆续开放。');
    }else{
      const region=id.slice(7),n=d?.nodes[region],r=CivilStatecraftContent.regions[region];if(!n)return null;text.push(CivilWorld.status(s,region),this.status(s,region));
      if(!n.accord)for(const[index,cfg]of r.choices.entries()){text.push(cfg.name+'：投入 '+CivilHistory.costText(cfg.cost)+'；信任+'+cfg.trust+'；此后每10秒耗 '+CivilHistory.costText(this.add(cfg.upkeep,this.policy(d).upkeep))+'。'+(cfg.equal?'须持续维持平等公民资格。':'')+(cfg.local?'须持续维持地方自治。':'')+(this.accordReason(s,region,index)||'可以签署'));buttons['choice'+index]={text:cfg.name,available:()=>!this.accordReason(s,region,index),nextScene:'end',onChoose:()=>finish(this.sign(s,region,index),'地区特色协约已签下，后续需有持续经费与相应制度支撑。')};}
      else{
        text.push('协约断供或违背制度承诺会导致公共服务中断，连断60秒将按失信扣减10点信任；恢复供给后可继续履约。每600秒可出资重申一次协约，耗知识80、工具20以挽回10点信任。'+(this.renewReason(s,region)||'可以重申'));buttons.renew={text:'出资重申协约',available:()=>!this.renewReason(s,region),nextScene:'end',onChoose:()=>finish(this.renew(s,region),'已重申协约，当地信任回升10点。')};
        if(n.joinedAt!==null)for(const kind of ['exchange','credit','repay']){
          if(kind==='credit'&&n.credit||kind==='repay'&&!['open','default'].includes(n.credit?.status))continue;
          const q=this.quote(s,region,kind),cfg=this.config(q),reason=CivilWorld.reason(s,region,kind);
          text.push(cfg.name+'：出发时支取 '+CivilHistory.costText(cfg.cost)+'，返航带回 '+CivilHistory.costText(cfg.receive)+'。'+(kind==='credit'?'由地方公库实支放贷；需押下工具40，物资交割后1800秒到期，届时须另派还款队送还 '+CivilHistory.costText(cfg.debt)+'。逾期将没收抵押物、扣减20点信任，并暂停互市与公共履约直至还清；不计复利、亦不抹销旧债。':kind==='exchange'?(q.marketRate!==undefined?'本轮地区作价系数为'+q.marketRate+'%，随进口紧缺度、出口存量、战事及逾期记录浮动；车船出发时即锁定当趟价格。':'')+'双方货物在出发时即行封存预留，抵港交割，待车船返城后方入本城仓；每区每600秒限跑一趟。':'还款队出发后即停止逾期计时，抵港交割后结清债务；未违约的抵押工具将随队带回本城。')+(reason||'可派出'));
          buttons[kind]={text:cfg.name,available:()=>!CivilWorld.reason(s,region,kind),nextScene:'end',onChoose:()=>finish(CivilWorld.start(s,region,kind),'行动队已付清用度启程，货物与抵押物均按实际往返交割。')};
        }
      }
    }
    buttons.close={text:'合上国家协约',nextScene:'end',onChoose:done('各项协约与公库账册继续运转。')};return {title:id==='statecraftCouncil'?'国家经济与制度':CivilWorldContent.regions[id.slice(7)].name+' · 协约',text,buttons};
  },
  refresh(){if(typeof $==='undefined'||!$('#councilPanel').length)return;const d=CivilWorld.data(State);if(!State.civilization.tech.computing||!Object.keys(d?.nodes||{}).length){$('#statecraftButton').hide();return;}Civilization.button('statecraftButton','国家经济与制度','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='statecraftCouncil';Civilization.showPending();}).show();}
};
