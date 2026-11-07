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
    if(!this.available(s))return '请先登记城市群共同职责';
    if(!this.political(s))return '请先完成眼下的换届交接、变法或互助公示';
    if(!['federation','empire'].includes(s.civilization.society.axes.structure))return '请先在“共同体的边界”议决中改选联邦或帝国架构';
    if(!Object.hasOwn(this.charters,this.charter(s)))return '请先议定“权力的界限”，立下共同法的根基';
    if(this.data(s)&&!this.same(s.civilization.metro.members,this.data(s).members))return '请先恢复签约三城的共同互助成员身份';
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
  population(s){const n=this.data(s);return n?n.members.reduce((sum,id)=>sum+CivilFinance.population(s,id),0)+(typeof CivilAccession!=='undefined'?CivilAccession.population(s):0)+(typeof CivilFrontier!=='undefined'?CivilFrontier.population(s):0)+(typeof CivilPartnership!=='undefined'?CivilPartnership.population(s):0)+(typeof CivilWorld!=='undefined'?CivilWorld.population(s):0):0;},
  status(s){
    const n=this.data(s);if(!n)return this.reason(s)||'三城已具备提出国家共同法与宪章的条件';
    const waiting=n.members.filter(id=>!n.approvals[id]);if(waiting.length)return '正等候'+waiting.map(id=>CivilMetro.name(id)).join('、')+'支取用度完成议约';
    const r=n.records.at(-1);if(r?.missing.length)return r.missing.map(id=>CivilMetro.name(id)).join('、')+'国家经费不足；本轮未划扣其余城市的经费';
    if(n.foundedAt===null)return '连续维持供养与共同记录 '+n.stableSeconds+' / '+this.charters[this.charter(s)].duration+'秒。'+(this.reason(s)||'各项条件平稳维系中');
    const standing='国家合法性 '+Number(n.legitimacy.toFixed(2))+' / 100；';
    if(this.operational(s))return standing+'共同法正常运转，国家协调容量 +'+this.capacityBonus(s)+(typeof CivilAccession!=='undefined'&&CivilAccession.population(s)?'；共同法在册共'+this.population(s)+'人（含由当地自养的加盟居民'+(CivilAccession.population(s)+(typeof CivilPartnership!=='undefined'?CivilPartnership.population(s):0))+'人）':'');
    if(r?.service&&s.civilization.elapsed-r.at<=10&&n.legitimacy<40)return standing+'经费与供养已恢复；待认可度回升至40后即可恢复国家协调加成。正常履约轮次将逐轮回升认可度';
    return standing+'共同法暂缓执行；'+(this.reason(s)||'等候下一轮供养与共同记录核验')+'。待条件恢复后将逐轮重塑认可度';
  },
  event(id,done){
    if(id!=='nationCharter')return null;const s=State,n=this.data(s),mode=this.mode(s),profile=this.charters[this.charter(s)],fee=this.fee(mode,this.charter(s)),fmt=cost=>CivilHistory.costText(cost),buttons={};
    const finish=(ok,text)=>done(ok?text:'条件已有变动，本次未执行。请核对三城账册与经费存量。')();
    if(!n)buttons.propose={text:'提出国家'+(this.charter(s)==='custom'?'盟约':'宪章')+'（本城实付）',nextScene:'end',onChoose:()=>finish(this.propose(s),'本城已付清建档与议事用度。其余两城仍须各自表决同意并从当地公仓支取费用。')};
    else if(n.foundedAt===null){
      for(const member of n.members.filter(x=>!n.approvals[x]))buttons['approve_'+member]={text:CivilMetro.name(member)+'议约并支付',nextScene:'end',onChoose:()=>finish(this.approve(s,member),CivilMetro.name(member)+'赞成国家共同法，已从当地公仓付清建档费用。')};
      if(this.canFound(s))buttons.found={text:'批准国家'+(this.charter(s)==='custom'?'盟约':'宪章'),nextScene:'end',onChoose:()=>finish(this.found(s),'三城正式批准国家共同法。跨城通行、公共账册与城际争端裁决自此纳入国法；各城照旧自管本地供养与家底。国家日常经费仍须按轮支取。')};
    }
    buttons.close={text:'合上国家议约',nextScene:'end',onChoose:done('国家议约与各城账册留存议事屋案头。')};
    const axes=s.civilization.society.axes,system=Object.entries(axes).map(([axis,value])=>CivilSociety.axes[axis].choices[value].name).join(' · ');
    return {title:n?.foundedAt!==null&&n?'国家共同法':'三城的国家'+(this.charter(s)==='custom'?'盟约':'宪章'),text:[this.status(s)+'。','沿用现行制度：'+system+'。可先在议事屋四轴制度处支取知识动议改制；日后的每一次合法变法，亦会联动调整国家的日常职责开支。','立国筹备：本城需出 '+fmt(this.approvalCost('home'))+'；其余两城各出 '+fmt(this.approvalCost('local'))+'。此项为建档与会务实支，不会凭空生出一座中央仓库。','每10秒国家公共记录开支：本城 '+fmt(fee.home)+'；其余两城各 '+fmt(fee.local)+'。须三城公仓皆够支取，当轮方才划扣。',mode==='central'?'中央统筹跨城通行、争端裁决与共同调度，正常运转时增加'+profile.central+'份协调容量；各城自管公仓家底，自担本地粮药、水务、学堂与工坊运转。':'地方自治保留各城公共预算与供养自主权，并分担共同议事开支；中央仅掌管跨城通行、争端裁决与约定内的协调，正常运转时增加'+profile.local+'份协调容量。',profile.name+'：需连续筹备'+profile.duration+'秒；正常运转每轮认可+'+profile.gain+'，停摆-'+profile.loss+'。依惯例治理可省下纸面记录，但会增加实物联络与调停耗材；成文宪章则需更多持续记录，以换取更高的协调上限。','共同法仰仗各城持续供养与履约。一旦欠费、断供或换届交接卡壳，国家治理便会暂缓，认可度逐轮跌落；待补齐缺口后方会逐轮回升。立国历史、各城家底与已签条约不会因换届而抹去。'],buttons};
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
