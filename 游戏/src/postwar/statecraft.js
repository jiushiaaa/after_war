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
    if(m.kind==='exchange'){const cargo=this.scale(r.give,p.input),receive=this.scale(r.take,p.output);return {name,cargo,receive,cost:this.add(cargo,CivilStatecraftContent.voyage),work:60};}
    const interest=this.scale(r.loan,p.interest),debt=this.add(r.loan,interest);
    if(m.kind==='credit')return {name,cargo:{...CivilStatecraftContent.collateral},receive:{...r.loan},debt,cost:this.add(CivilStatecraftContent.collateral,CivilStatecraftContent.voyage),work:120};
    const receive=m.forfeited?{}:{...CivilStatecraftContent.collateral};return {name,cargo:debt,receive,debt,cost:this.add(debt,CivilStatecraftContent.voyage),work:60};
  },
  reason(s,id,kind){
    const d=CivilWorld.data(s),n=d?.nodes[id];
    if(!n?.accord||n.joinedAt===null)return '先接纳本地区并签署特色协约';
    if(n.accord.missed||n.accord.paidCycles<6)return '特色协约须实际维持至少60秒，先核对承诺与经费';
    if(kind!=='repay'&&n.credit?.status==='default')return '旧信贷已违约，须先清偿欠款';
    if(kind==='exchange'&&n.tradeAt!==undefined&&s.civilization.elapsed-n.tradeAt<600)return '本地区互市每600秒开放一趟，避免抽空公库';
    if(kind==='credit'&&n.credit)return '本地区一期重建信贷已使用；不是无限循环借贷';
    if(kind==='repay'&&(!n.credit||!['open','default'].includes(n.credit.status)))return '当前没有待偿还的信贷';
    const m=this.quote(s,id,kind),cfg=this.config(m),reserve=this.scale(CivilWorldContent.services,12);
    if(kind!=='repay'&&!CivilRegions.canPay(n.stores,this.add(cfg.receive,reserve)))return '地方须保留公共供养，再提供实物或信贷';
    return null;
  },
  quote(s,id,kind){const d=CivilWorld.data(s),n=d?.nodes[id];return {region:id,kind,economy:kind==='repay'?n?.credit?.economy:this.mode(d),...(kind==='repay'?{forfeited:n?.credit?.status==='default'}:{})};},
  policyReason(s,mode){const d=CivilWorld.data(s),p=CivilStatecraftContent.policies[mode];if(!Object.hasOwn(CivilStatecraftContent.policies,mode)||!s.civilization.tech.computing||!Object.keys(d?.nodes||{}).length)return '先研究国家计算并建立国家联络';if(!CivilWorld.political(s)||CivilWorld.active(s))return '先恢复国家行政并等待行动队返城';if(this.mode(d)===mode)return '已采用这一制度';if(d.economy&&s.civilization.elapsed-d.economy.changedAt<600)return '制度调整后须运行600秒再改议';if(p.local&&s.civilization.society.axes.devolution!=='local')return '合作互助要求地方自治';return CivilFinance.reserveCheck(s,'home',{knowledge:120,electronics:10})?null:'预留知识120、电子元件10和城市供养';},
  setPolicy(s,mode){if(this.policyReason(s,mode))return false;const cost={knowledge:120,electronics:10};CivilServices.pay(s.stores,cost);CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'policy',mode,at:s.civilization.elapsed,cost,local:s.civilization.society.axes.devolution});return true;},
  accordReason(s,id,index){const n=CivilWorld.data(s)?.nodes[id],cfg=CivilStatecraftContent.regions[id]?.choices[index];if(!n||!cfg||!s.civilization.tech.computing)return '先建立国家联络与国家计算';if(n.control==='occupied'||n.infrastructure<100)return '先结束占领并重建受损设施';if(n.accord)return '已有长期协约；可维护或付费重申，不重复领取信任';if(CivilWorld.active(s)||!CivilWorld.political(s))return '先恢复行政并等行动队返城';if(!this.pledge(cfg,s.civilization.regions.rights,s.civilization.society.axes.devolution))return '本方案要求平等资格或地方自治';return CivilFinance.reserveCheck(s,'home',cfg.cost)?null:'备足议约投入，并保留本城供养';},
  sign(s,id,index){if(this.accordReason(s,id,index))return false;const cfg=CivilStatecraftContent.regions[id].choices[index];CivilServices.pay(s.stores,cfg.cost);CivilWorld.record(CivilWorld.data(s),{kind:'statecraft',action:'accord',region:id,choice:index,at:s.civilization.elapsed,cost:{...cfg.cost},rights:s.civilization.regions.rights,devolution:s.civilization.society.axes.devolution});return true;},
  renewReason(s,id){const n=CivilWorld.data(s)?.nodes[id];if(CivilWorld.active(s)||!CivilWorld.political(s))return '先恢复行政并等行动队返城';if(!n?.accord||n.accord.missed)return '先恢复协约履约';if(n.trust>=100)return '信任已经达到100';if(s.civilization.elapsed-(n.accord.renewedAt??n.accord.at)<600)return '距上次签署或重申须满600秒';return CivilFinance.reserveCheck(s,'home',{knowledge:80,tools:20})?null:'预留知识80、工具20与供养';},
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
      if(r.at!==m.departedAt||!n.accord||n.accord.missed||n.accord.paidCycles<6||n.joinedAt===null)fail();
      if(m.kind==='repay'){if(!n.credit||!['open','default'].includes(n.credit.status)||m.economy!==n.credit.economy||m.forfeited!==(n.credit.status==='default'))fail();}
      else if(m.economy!==this.mode(d)||n.credit?.status==='default'||!CivilRegions.canPay(n.stores,this.add(cfg.receive,this.scale(CivilWorldContent.services,12)))||m.kind==='credit'&&n.credit||m.kind==='exchange'&&n.tradeAt!==undefined&&r.at-n.tradeAt<600)fail();
      return;
    }
    if(r.action==='return'){if(m.returnedAt!==r.at)fail();return;}
    fail();
  },
  validateBudget(d,r){const ids=Object.keys(d.nodes).filter(id=>d.nodes[id].accord),rows=r.accordPayments??{};if(!rows||typeof rows!=='object'||Array.isArray(rows)||JSON.stringify(Object.keys(rows).sort())!==JSON.stringify(ids.sort())||Object.values(rows).some(v=>typeof v!=='boolean'))throw Error('协约持续预算无效');for(const id of ids)if(rows[id]&&(!r.political||d.nodes[id].control==='occupied'||!this.pledge(this.choice(d.nodes[id],id),r.rights,r.devolution)||this.policy(d).local&&r.devolution!=='local'))throw Error('协约政治承诺无效');},
  status(s,id){const d=CivilWorld.data(s),n=d.nodes[id],cfg=this.choice(n,id);return (cfg?cfg.name+' · '+(n.accord.missed?'承诺或经费中断'+n.accord.missed+'秒':'持续履约')+'；每10秒 '+CivilHistory.costText(this.upkeep(d,id)):'未签署地区特色协约')+(n.credit?'；信贷 '+({open:'未偿还',default:'已违约，抵押已没收',repaying:'还款在途',repaid:'已清偿'}[n.credit.status])+(n.credit.status==='open'?'，到期余'+Math.max(0,n.credit.dueAt-s.civilization.elapsed)+'秒':''):'');},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,d=CivilWorld.data(s),text=[],buttons={},finish=(ok,msg)=>done(ok?msg:'条件已变化，本次没有执行。')();
    if(id==='statecraftCouncil'){
      text.push('国家经济制度：'+this.policy(d).name+'。改变制度会改变新互市的价格、每个协约的行政成本和新信贷利息；原运单与债务合同不追溯改价。','公共计划：本城互市投入八折；每协约每10秒另耗知识0.4；新贷利息8%。','监管市场：地方实物输出增加25%；每协约另耗工具0.08、知识0.05；新贷利息15%。','合作互助：维持自治；每协约另耗药0.04、知识0.15；新贷利息5%。','混合协约：原价、无额外制度费；新贷利息10%。');
      for(const[mode,p]of Object.entries(CivilStatecraftContent.policies))buttons[mode]={text:p.name,available:()=>!this.policyReason(s,mode),nextScene:'end',onChoose:()=>finish(this.setPolicy(s,mode),'国家经济制度已改议。已有合同保留原价格。')};
      text.push('改议实付知识120、电子元件10，600秒后方可再次调整。地区特色协约、互市与信贷在各区外交记录中逐步开放。');
    }else{
      const region=id.slice(7),n=d?.nodes[region],r=CivilStatecraftContent.regions[region];if(!n)return null;text.push(CivilWorld.status(s,region),this.status(s,region));
      if(!n.accord)for(const[index,cfg]of r.choices.entries()){text.push(cfg.name+'：投入 '+CivilHistory.costText(cfg.cost)+'；信任+'+cfg.trust+'；以后每10秒 '+CivilHistory.costText(this.add(cfg.upkeep,this.policy(d).upkeep))+'。'+(cfg.equal?'须持续平等公民资格。':'')+(cfg.local?'须持续地方自治。':'')+(this.accordReason(s,region,index)||'可以签署'));buttons['choice'+index]={text:cfg.name,available:()=>!this.accordReason(s,region,index),nextScene:'end',onChoose:()=>finish(this.sign(s,region,index),'地区特色协约已签署。承诺需要持续经费与制度支持。')};}
      else{
        text.push('协约欠供或违背承诺会中断公共服务，连续60秒失信扣10信任；恢复供给后继续履约。重申协约每600秒一次，知识80、工具20换取10信任。'+(this.renewReason(s,region)||'可以重申'));buttons.renew={text:'付费重申协约',available:()=>!this.renewReason(s,region),nextScene:'end',onChoose:()=>finish(this.renew(s,region),'协约已重申，信任提高10。')};
        if(n.joinedAt!==null)for(const kind of ['exchange','credit','repay']){
          if(kind==='credit'&&n.credit||kind==='repay'&&!['open','default'].includes(n.credit?.status))continue;
          const q=this.quote(s,region,kind),cfg=this.config(q),reason=CivilWorld.reason(s,region,kind);
          text.push(cfg.name+'：出发扣 '+CivilHistory.costText(cfg.cost)+'，返航带回 '+CivilHistory.costText(cfg.receive)+'。'+(kind==='credit'?'地方公库真实出借；抵押工具40，交付后1800秒到期，须另派还款队偿还 '+CivilHistory.costText(cfg.debt)+'。逾期没收抵押、信任-20，暂停互市及公共履约直到还款；不滚利、不抹债。':kind==='exchange'?'双方货物出发即预留，抵达交付，返城才入本城仓；每区600秒一趟。':'还款出发后停止逾期判定，交付后清偿；未违约的抵押随原队返城。')+(reason||'可派出'));
          buttons[kind]={text:cfg.name,available:()=>!CivilWorld.reason(s,region,kind),nextScene:'end',onChoose:()=>finish(CivilWorld.start(s,region,kind),'原行动队实付启程，货物与抵押按实际往返结算。')};
        }
      }
    }
    buttons.close={text:'合上国家协约',nextScene:'end',onChoose:done('协约与公库记录继续运行。')};return {title:id==='statecraftCouncil'?'国家经济与制度':CivilWorldContent.regions[id.slice(7)].name+' · 协约',text,buttons};
  },
  refresh(){if(typeof $==='undefined'||!$('#councilPanel').length)return;const d=CivilWorld.data(State);if(!State.civilization.tech.computing||!Object.keys(d?.nodes||{}).length){$('#statecraftButton').hide();return;}Civilization.button('statecraftButton','国家经济与制度','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='statecraftCouncil';Civilization.showPending();}).show();}
};
