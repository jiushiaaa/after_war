/* MPL-2.0 — A paid common charter over existing cities; no pooled stores or population grants. */
var CivilNation={
  pendingIds:['nationCharter'],
  approvalCost(id){return id==='home'?{knowledge:200,wood:40,tools:20}:{knowledge:60,wood:20,tools:4};},
  fees:{central:{home:{knowledge:.4,wood:.4,tools:.04},local:{knowledge:.02}},local:{home:{knowledge:.2,wood:.2,tools:.01},local:{knowledge:.2,wood:.4,tools:.02}}},
  customFees:{central:{home:{knowledge:.1,wood:.8,tools:.08},local:{knowledge:.01,wood:.2,tools:.02}},local:{home:{knowledge:.05,wood:.4,tools:.02},local:{knowledge:.05,wood:.8,tools:.04}}},
  charters:{constitution:{name:'成文宪章',duration:600,gain:.25,loss:1,central:2,local:4},custom:{name:'惯例盟约',duration:900,gain:.125,loss:1.25,central:1,local:2}},
  charter(s){return s.civilization.society.axes.charter;},
  recordCharter(r){return r.charter===undefined?'constitution':r.charter;},
  fee(mode,charter='constitution'){return Object.hasOwn(this.charters,charter)?(charter==='custom'?this.customFees:this.fees)[mode]:null;},
  data(s){return s.civilization.nation;},
  available(s){return Number.isSafeInteger(s.civilization.metro?.formedAt);},
  stores(s,id){return CivilFinance.stores(s,id);},
  same(a,b){return JSON.stringify(a)===JSON.stringify(b);},
  mode(s){return s.civilization.society.axes.devolution;},
  costs(s){const n=this.data(s),fee=this.fee(this.mode(s),this.charter(s));return n&&fee&&n.members.every(id=>n.approvals[id])?Object.fromEntries(n.members.map(id=>[id,{...(id==='home'?fee.home:fee.local)}])):{};},
  political(s){return CivilFinance.political(s)&&!s.civilization.finance.revision;},
  reason(s){
    if(!this.available(s))return '先登记城市群共同职责';
    if(!this.political(s))return '先完成现有继任、改制或互助公示';
    if(!['federation','empire'].includes(s.civilization.society.axes.structure))return '先在共同体边界议决中选择联邦或帝国结构';
    if(!Object.hasOwn(this.charters,this.charter(s)))return '先议定权力约束，明确共同法的依据';
    if(this.data(s)&&!this.same(s.civilization.metro.members,this.data(s).members))return '恢复签约三城的共同互助成员';
    return CivilMetro.check(s).reason;
  },
  propose(s){
    if(this.data(s)||this.reason(s))return false;
    const m=s.civilization.metro,cost=this.approvalCost('home');if(!CivilFinance.reserveCheck(s,'home',cost))return false;
    CivilServices.pay(s.stores,cost);
    s.civilization.nation={schema:1,proposedAt:s.civilization.elapsed,members:[...m.formedMembers],metroAt:m.formedAt,approvals:{home:{at:s.civilization.elapsed,cost:{...cost}}},foundedAt:null,foundingAxes:null,foundingStableSince:null,lastSettledAt:null,stableSince:null,stableSeconds:0,legitimacy:60,records:[]};return true;
  },
  approve(s,id){
    const n=this.data(s);if(!n||n.foundedAt!==null||!n.members.includes(id)||n.approvals[id]||this.reason(s))return false;
    const cost=this.approvalCost(id);if(!CivilFinance.reserveCheck(s,id,cost))return false;
    CivilServices.pay(this.stores(s,id),cost);n.approvals[id]={at:s.civilization.elapsed,cost:{...cost}};return true;
  },
  settle(s){
    const n=this.data(s),at=s.civilization.elapsed,costs=this.costs(s);if(!n||!Object.keys(costs).length||n.lastSettledAt!==null&&at-n.lastSettledAt<10)return {};
    n.lastSettledAt=at;
    const missing=n.members.filter(id=>!CivilFinance.reserveCheck(s,id,costs[id]));
    const paid=!missing.length;if(paid)for(const id of n.members)CivilServices.pay(this.stores(s,id),costs[id]);
    n.records.push({at,mode:this.mode(s),charter:this.charter(s),costs:paid?costs:{},missing,service:null});
    return paid?Object.fromEntries(Object.entries(costs.home).map(([key,value])=>[key,-value])):{};
  },
  observe(s){
    const n=this.data(s),r=n?.records.at(-1),m=s.civilization.metro;if(!r||r.service!==null||r.at!==s.civilization.elapsed)return false;
    // Metro has completed its same-second freight reconciliation. A later annual
    // census does not erase the service which was actually paid at this boundary.
    r.service=!r.missing.length&&m.lastObservedAt===r.at&&m.stableSince!==null&&this.same(m.members,n.members)&&this.political(s)&&['federation','empire'].includes(s.civilization.society.axes.structure)&&Object.hasOwn(this.charters,this.charter(s));
    const previous=n.records.at(-2),profile=this.charters[this.recordCharter(r)];
    if(r.service){if(n.stableSince!==null&&previous?.service&&r.at-previous.at===10&&this.recordCharter(previous)===this.recordCharter(r))n.stableSeconds=Math.min(profile.duration,n.stableSeconds+10);else {n.stableSince=r.at;n.stableSeconds=0;}}
    else {n.stableSince=null;n.stableSeconds=0;}
    if(n.foundedAt!==null)n.legitimacy=Math.max(0,Math.min(100,n.legitimacy+(r.service?profile.gain:-profile.loss)));
    return r.service;
  },
  canFound(s){const n=this.data(s),r=n?.records.at(-1),profile=this.charters[this.charter(s)];return !!n&&!!profile&&n.foundedAt===null&&r?.service===true&&this.recordCharter(r)===this.charter(s)&&s.civilization.elapsed-r.at<10&&n.stableSeconds>=profile.duration&&n.members.every(id=>n.approvals[id])&&!this.reason(s);},
  found(s){if(!this.canFound(s))return false;const n=this.data(s);n.foundedAt=s.civilization.elapsed;n.foundingAxes={...s.civilization.society.axes};n.foundingStableSince=n.stableSince;return true;},
  operational(s){const n=this.data(s),last=n?.records.at(-1),r=last?.service===null?(!last.missing.length?n.records.at(-2):null):last;return !!n&&n.foundedAt!==null&&n.legitimacy>=40&&r?.service===true&&this.recordCharter(r)===this.charter(s)&&r.mode===this.mode(s)&&s.civilization.elapsed-r.at>=0&&s.civilization.elapsed-r.at<=10;},
  capacityBonus(s){return this.operational(s)?this.charters[this.charter(s)][this.mode(s)]:0;},
  population(s){const n=this.data(s);return n?n.members.reduce((sum,id)=>sum+CivilFinance.population(s,id),0)+(typeof CivilAccession!=='undefined'?CivilAccession.population(s):0)+(typeof CivilFrontier!=='undefined'?CivilFrontier.population(s):0)+(typeof CivilPartnership!=='undefined'?CivilPartnership.population(s):0):0;},
  status(s){
    const n=this.data(s);if(!n)return this.reason(s)||'三城可以提出共同法与国家宪章';
    const waiting=n.members.filter(id=>!n.approvals[id]);if(waiting.length)return '等待'+waiting.map(id=>CivilMetro.name(id)).join('、')+'付费议约';
    const r=n.records.at(-1);if(r?.missing.length)return r.missing.map(id=>CivilMetro.name(id)).join('、')+'国家经费不足；未扣除其他城市的本轮费用';
    if(n.foundedAt===null)return '筹备连续供养与共同记录 '+n.stableSeconds+' / '+this.charters[this.charter(s)].duration+'秒。'+(this.reason(s)||'条件正在维持');
    const standing='国家合法性 '+Number(n.legitimacy.toFixed(2))+' / 100；';
    if(this.operational(s))return standing+'共同法正常运作，国家协调容量 +'+this.capacityBonus(s)+(typeof CivilAccession!=='undefined'&&CivilAccession.population(s)?'；共同法登记'+this.population(s)+'人，含当地自养的加盟居民'+(CivilAccession.population(s)+(typeof CivilPartnership!=='undefined'?CivilPartnership.population(s):0))+'人':'');
    if(r?.service&&s.civilization.elapsed-r.at<=10&&n.legitimacy<40)return standing+'经费与供养已恢复；认可达到40后恢复国家协调。正常轮次持续恢复认可';
    return standing+'共同法暂缓执行；'+(this.reason(s)||'等待下一轮实际供养与共同记录核验')+'。恢复后逐轮重建认可';
  },
  event(id,done){
    if(id!=='nationCharter')return null;const s=State,n=this.data(s),mode=this.mode(s),profile=this.charters[this.charter(s)],fee=this.fee(mode,this.charter(s)),fmt=cost=>CivilHistory.costText(cost),buttons={};
    const finish=(ok,text)=>done(ok?text:'条件已经变化，本次未执行。请核对三城记录和费用。')();
    if(!n)buttons.propose={text:'提出国家'+(this.charter(s)==='custom'?'盟约':'宪章')+'（本城实付）',nextScene:'end',onChoose:()=>finish(this.propose(s),'本城已支付建档与议事费用。另两城仍须各自同意并支付费用。')};
    else if(n.foundedAt===null){
      for(const member of n.members.filter(x=>!n.approvals[x]))buttons['approve_'+member]={text:CivilMetro.name(member)+'议约并支付',nextScene:'end',onChoose:()=>finish(this.approve(s,member),CivilMetro.name(member)+'同意共同法，已从当地仓支付建档费用。')};
      if(this.canFound(s))buttons.found={text:'批准国家'+(this.charter(s)==='custom'?'盟约':'宪章'),nextScene:'end',onChoose:()=>finish(this.found(s),'三城批准国家共同法。共同通行、公共记录与跨城争端进入共同法；各城继续管理自己的供养与资产。国家经费仍需逐轮支付。')};
    }
    buttons.close={text:'合上国家议约',nextScene:'end',onChoose:done('国家议约与各城账册留在议事屋。')};
    const axes=s.civilization.society.axes,system=Object.entries(axes).map(([axis,value])=>CivilSociety.axes[axis].choices[value].name).join(' · ');
    return {title:n?.foundedAt!==null&&n?'国家共同法':'三城的国家'+(this.charter(s)==='custom'?'盟约':'宪章'),text:[this.status(s)+'。','采用当前制度：'+system+'。可先在议事屋四轴入口付费改议；以后的合法改革也会改变持续职责费用。','成立准备：本城 '+fmt(this.approvalCost('home'))+'；另两城各 '+fmt(this.approvalCost('local'))+'。这是实际议事与建档支出，不会生成另一份中央库存。','每10秒国家公共记录费用：本城 '+fmt(fee.home)+'；另两城各 '+fmt(fee.local)+'。三城都能付款才执行当轮支出。',mode==='central'?'中央统筹跨城通行、争端登记与共同调度，正常治理增加'+profile.central+'份协调容量；地方保管资产，承担本地粮药、水务、教学与生产。':'地方自治保留本地公共预算和供养决策，并分担共同议事费用；中央只负责共同通行、争端登记与约定内协调，正常治理增加'+profile.local+'份协调容量。',profile.name+'：连续筹备'+profile.duration+'秒；正常认可每轮+'+profile.gain+'，失效-'+profile.loss+'。惯例减少知识记录，增加实物联络与调停开支；成文宪章提高持续记录和协调能力。','共同法须持续供养和履约。欠费、断供或未完成的制度交接使治理暂缓，认可逐轮下降；恢复后逐轮回升。成立历史、各城资产和既有约定不会因换届清空。'],buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#nationButton').hide();$('#nationSummary').hide();return;}
    Civilization.button('nationButton','国家共同法与职责','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='nationCharter';Civilization.showPending();}).show();
    let line=$('#nationSummary');if(!line.length)line=$('<div>').attr('id','nationSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const n=this.data(s),fail=()=>{throw Error('国家议约与经费记录无效');};if(n===undefined){if(this.pendingIds.includes(s.civilization.pending)&&!this.available(s))fail();return;}
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=s.civilization.elapsed,nullable=x=>x===null||time(x),m=s.civilization.metro;
    if(!obj(n)||n.schema!==1||!this.available(s)||!time(n.proposedAt)||n.proposedAt<m.formedAt||n.metroAt!==m.formedAt||!this.same(n.members,m.formedMembers)||!obj(n.approvals)||!n.approvals.home||!nullable(n.foundedAt)||!nullable(n.lastSettledAt)||!nullable(n.stableSince)||!nullable(n.foundingStableSince)||!Number.isSafeInteger(n.stableSeconds)||n.stableSeconds<0||n.stableSeconds>900||n.stableSeconds%10||!Number.isFinite(n.legitimacy)||n.legitimacy<0||n.legitimacy>100||!Array.isArray(n.records))fail();
    for(const [id,p]of Object.entries(n.approvals))if(!n.members.includes(id)||!obj(p)||!time(p.at)||p.at<n.proposedAt||!this.same(p.cost,this.approvalCost(id))||id==='home'&&p.at!==n.proposedAt)fail();
    let previous=null,stableSince=null,stableSeconds=0,legitimacy=60,foundingRun=false;
    for(const r of n.records){
      if(!obj(r)||!time(r.at)||r.at<n.proposedAt||previous&&r.at-previous.at<10||!Object.hasOwn(this.fees,r.mode)||!Object.hasOwn(this.charters,this.recordCharter(r))||!obj(r.costs)||!Array.isArray(r.missing)||new Set(r.missing).size!==r.missing.length||r.missing.some(id=>!n.members.includes(id))||typeof r.service!=='boolean'||n.members.some(id=>!n.approvals[id]||n.approvals[id].at>r.at))fail();
      const profile=this.charters[this.recordCharter(r)],fee=this.fee(r.mode,this.recordCharter(r)),costs=Object.fromEntries(n.members.map(id=>[id,{...(id==='home'?fee.home:fee.local)}]));
      if(!this.same(r.costs,r.missing.length?{}:costs)||r.missing.length&&r.service)fail();
      if(r.service){if(stableSince!==null&&previous?.service&&r.at-previous.at===10&&this.recordCharter(previous)===this.recordCharter(r))stableSeconds=Math.min(profile.duration,stableSeconds+10);else {stableSince=r.at;stableSeconds=0;}}
      else {stableSince=null;stableSeconds=0;}
      if(n.foundedAt!==null&&r.at<=n.foundedAt&&n.foundedAt-r.at<10&&stableSeconds>=profile.duration&&this.recordCharter(r)===n.foundingAxes?.charter&&stableSince===n.foundingStableSince)foundingRun=true;
      if(n.foundedAt!==null&&r.at>n.foundedAt)legitimacy=Math.max(0,Math.min(100,legitimacy+(r.service?profile.gain:-profile.loss)));
      previous=r;
    }
    if(n.lastSettledAt!==(previous?.at??null)||n.stableSince!==stableSince||n.stableSeconds!==stableSeconds||Math.abs(n.legitimacy-legitimacy)>1e-8)fail();
    if(n.foundedAt===null){if(n.foundingAxes!==null||n.foundingStableSince!==null)fail();}
    else if(!foundingRun||!obj(n.foundingAxes)||Object.keys(n.foundingAxes).length!==4||Object.entries(CivilSociety.axes).some(([id,axis])=>!Object.hasOwn(axis.choices,n.foundingAxes[id]))||!['federation','empire'].includes(n.foundingAxes.structure)||!Object.hasOwn(this.charters,n.foundingAxes.charter))fail();
  }
};
