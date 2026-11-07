/* MPL-2.0 — Negotiated common law; the source keeps its original census and stores. */
var CivilAccession={
  pendingIds:['accessionCharter'],
  data(s){return s.civilization.accession;},
  source(s){return CivilCommerce.source(s);},
  available(s){return !!s.civilization.security?.pact&&!!s.civilization.commerce?.orders.some(o=>o.returnedAt!==null&&o.security?.mode==='joint');},
  mode(s){return CivilNation.mode(s);},
  charter(s){return CivilNation.charter(s);},
  duration(s){return CivilNation.charters[this.charter(s)].duration;},
  fee(mode,charter){const f=JSON.parse(JSON.stringify(CivilAccessionContent.fees[mode]));if(charter==='custom')for(const costs of Object.values(f))for(const k of Object.keys(costs))costs[k]*=k==='knowledge'?.5:2;return f;},
  staff(s,id=CivilCommerce.sourceId(s)){
    const d=this.data(s),n=this.source(s);if(!d?.enabled||!d.approvals.source||d.sourceId!==id||!n)return 0;
    const plan=CivilOrigins.plan(n.cohorts),limits=CivilOrigins.jobLimits(s,id),needed=Object.entries(plan).reduce((sum,[k,v])=>sum+Math.min(v,limits[k]),0);
    const other=CivilSecurity.sourceStaff(s,id)+CivilOrigins.schoolBuilders(s,id)+(s.civilization.origins.contactTrip?.source===id&&!CivilOrigins.contactWorkReason(s,id)?2:0);
    return Math.max(0,Math.min(2,CivilPopulation.workforce(n.cohorts)-needed-other));
  },
  obligation(s){return this.data(s)?.joinedAt!==null&&this.data(s)?1:0;},
  reason(s){
    if(!this.available(s))return '请先跑完一趟双方共同护送并平安归城';
    if(!CivilNation.operational(s)||!CivilDiplomacy.operational(s)||!CivilFinance.political(s))return '请先恢复国家共同法、居留公约与现任行政运转';
    const id=CivilCommerce.sourceId(s),n=this.source(s);return CivilOrigins.supplyReason(s,id,n.cohorts);
  },
  propose(s){
    const cost=CivilAccessionContent.signature.home;if(this.data(s)||this.reason(s)||CivilRegions.load(s)+1>CivilRegions.capacity(s)||!CivilDiplomacy.reserve(s,'home',cost))return false;
    CivilServices.pay(s.stores,cost);const at=s.civilization.elapsed;
    s.civilization.accession={schema:1,sourceId:CivilCommerce.sourceId(s),proposedAt:at,approvals:{home:{at,cost:{...cost}}},enabled:true,controls:[],joinedAt:null,joiningMode:null,joiningCharter:null,joiningStableSince:null,firstPublicOrder:null,lastSettledAt:null,stableSince:null,stableSeconds:0,records:[]};return true;
  },
  approve(s){
    const d=this.data(s),cost=CivilAccessionContent.signature.source;if(!d||d.approvals.source||this.reason(s)||!CivilDiplomacy.reserve(s,d.sourceId,cost))return false;
    CivilServices.pay(this.source(s).stores,cost);d.approvals.source={at:s.civilization.elapsed,cost:{...cost}};CivilOrigins.assign(s,d.sourceId);return true;
  },
  toggle(s,enabled){
    const d=this.data(s);if(!d||!d.approvals.source||typeof enabled!=='boolean'||d.enabled===enabled||!CivilFinance.political(s))return false;
    d.enabled=enabled;d.controls.push({at:s.civilization.elapsed,enabled,afterRecord:d.lastSettledAt,afterOrder:s.civilization.commerce.orders.at(-1)?.id||0});d.stableSince=null;d.stableSeconds=0;CivilOrigins.assign(s,d.sourceId);return true;
  },
  settle(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d?.enabled||!d.approvals.source||d.lastSettledAt!==null&&at-d.lastSettledAt<10)return {};
    const mode=this.mode(s),charter=this.charter(s),costs=this.fee(mode,charter),staff=this.staff(s),paid=staff===2&&CivilDiplomacy.reserve(s,'home',costs.home)&&CivilDiplomacy.reserve(s,d.sourceId,costs.source);
    if(paid){CivilServices.pay(s.stores,costs.home);CivilServices.pay(this.source(s).stores,costs.source);}
    d.lastSettledAt=at;d.records.push({at,mode,charter,staff,paid,costs:paid?costs:{},service:null,stableSeconds:null});return paid?Object.fromEntries(Object.entries(costs.home).map(([k,v])=>[k,-v])):{};
  },
  observe(s){
    const d=this.data(s),r=d?.records.at(-1);if(!r||r.service!==null||r.at!==s.civilization.elapsed)return false;
    r.service=r.paid&&r.staff===2&&!this.reason(s);const previous=d.records.at(-2),control=d.controls.at(-1);
    if(r.service){if(d.stableSince!==null&&previous?.service&&r.at-previous.at===10&&r.mode===previous.mode&&r.charter===previous.charter&&(!control||control.at<=previous.at))d.stableSeconds=Math.min(CivilNation.charters[r.charter].duration,d.stableSeconds+10);else {d.stableSince=r.at;d.stableSeconds=0;}}
    else {d.stableSince=null;d.stableSeconds=0;}r.stableSeconds=d.stableSeconds;return r.service;
  },
  receipt(s){const d=this.data(s),last=d?.records.at(-1);return last?.service===null?(last.paid?d.records.at(-2):null):last;},
  ready(s){
    const d=this.data(s),r=this.receipt(s),control=d?.controls.at(-1);
    return !!d&&d.enabled&&r?.service===true&&r.mode===this.mode(s)&&r.charter===this.charter(s)&&s.civilization.elapsed-r.at>=0&&s.civilization.elapsed-r.at<=10&&d.stableSeconds>=this.duration(s)&&this.staff(s)===2&&(!control||r.at>control.at||r.at===control.at&&control.afterRecord!==r.at)&&!this.reason(s);
  },
  join(s){
    const d=this.data(s);if(!d||d.joinedAt!==null||!this.ready(s)||CivilCommerce.active(s)||CivilRegions.load(s)+1>CivilRegions.capacity(s))return false;
    d.joinedAt=s.civilization.elapsed;d.joiningMode=this.mode(s);d.joiningCharter=this.charter(s);d.joiningStableSince=d.stableSince;d.firstPublicOrder=s.civilization.commerce.nextId;return true;
  },
  operational(s){return this.data(s)?.joinedAt!==null&&!!this.data(s)&&this.ready(s);},
  capacityBonus(s){return this.operational(s)?(this.mode(s)==='local'?2:1):0;},
  population(s){const d=this.data(s);return d?.joinedAt!==null&&d?this.source(s).population:0;},
  migrationLimit(s,id){const d=this.data(s),n=this.source(s);return d&&d.joinedAt!==null&&d.sourceId===id?Math.max(n.permit.limit+CivilDiplomacy.allowance(s,id),n.admitted+n.transitDeaths+CivilOrigins.inTransit(n)+Math.max(0,n.population-CivilOriginContent[id].retained)):null;},
  profile(s){
    if(!this.operational(s))return null;const d=this.data(s),mode=this.mode(s),duties=CivilAccessionContent.duties[mode];
    return {schema:1,sourceId:d.sourceId,joinedAt:d.joinedAt,receiptAt:this.receipt(s).at,mode,charter:this.charter(s),grant:{...duties.grant},contribution:{...duties.contribution}};
  },
  tradeReason(s){const d=this.data(s);return d?.joinedAt!==null&&d&&!this.operational(s)?'请先恢复加盟共同记录、两名当地记录员及连续履约；已在途的商队仍照常跑完':null;},
  status(s){
    const d=this.data(s);if(!d)return this.reason(s)||'可就共同法、地方自治权与实物财政分别立约';
    const name=CivilDiplomacy.name(d.sourceId);if(!d.approvals.source)return name+'正等候当地代表另行表决并从本地仓库支取用度';
    const base=name+(d.joinedAt===null?' · 加盟筹备':' · 已登记入共同法，在册'+this.population(s)+'位居民仍由当地自行供养')+'；';
    if(!d.enabled)return base+'共同行政已暂缓，记录员重回普通劳力池，新增公共收支与新发商队一并暂停';
    const r=d.records.at(-1);if(r&&!r.paid)return base+'记录员缺额或两地经费不足，本轮双方均未扣款';
    return base+'在岗记录员'+this.staff(s)+'/2，连续履约'+d.stableSeconds+'/'+this.duration(s)+'秒；'+(this.reason(s)|| (d.joinedAt!==null?(this.ready(s)?'新发商队将一并捎带约定内的公共补助与地方贡献':'待恢复连续履约后再发新商队'):CivilCommerce.active(s)?'正式登记须等在途的原商车归城':'筹备达标后即可正式登记'));
  },
  event(id,done){
    if(id!=='accessionCharter')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'眼下供养、在岗人手或共同记录已有变动，本次未执行。')();
    if(!d)buttons.propose={text:'本城实付议约',nextScene:'end',onChoose:()=>finish(this.propose(s),'本城已付清议事用度。仍须等来源地另行批准，并从其自家仓库支取份额。')};
    else if(!d.approvals.source)buttons.approve={text:'来源实付批准',nextScene:'end',onChoose:()=>finish(this.approve(s),'来源地已支取用度，并抽调当地居民接手共同记录。当地户籍与仓库照旧留在原处。')};
    else {
      if(d.joinedAt===null&&this.ready(s)&&!CivilCommerce.active(s))buttons.join={text:'登记共同法加盟',nextScene:'end',onChoose:()=>finish(this.join(s),'当地在册居民正式纳入共同法，日常仍靠原有的房舍、田亩与仓库自给自足。此后发出的商队将顺道捎带约定内的公共补助与地方贡献。')};
      buttons.toggle={text:d.enabled?'暂缓共同行政预算':'恢复共同行政预算',nextScene:'end',onChoose:()=>finish(this.toggle(s,!d.enabled),'预算安排已变更，在册人口、加盟历史与已发出的随车物资承诺照旧保留。恢复预算后将重新核算连续履约时间。')};
    }
    buttons.close={text:'合上加盟议约',nextScene:'end',onChoose:done('共同法总册、当地户籍与在途货单继续分立记账。')};
    const f=this.fee(this.mode(s),this.charter(s)),duties=CivilAccessionContent.duties[this.mode(s)],fmt=x=>CivilHistory.costText(x);
    const text=[this.status(s)+'。'];
    if(!d||!d.approvals.source)text.push('立约需支取：本城知识150、木40、工具8；来源地另出知识100、木40、工具8。由当地抽调两名成年人专职记账，连续履约满'+this.duration(s)+'秒后方可正式登记。');
    text.push('每10秒日常开支：本城 '+fmt(f.home)+'；来源地 '+fmt(f.source)+'。任一方不足则当轮两头皆不划扣。'+(this.mode(s)==='local'?'实行地方自治：由地方分担更多记录事务，协调上限+2。':'实行中央统筹：由本城多担行政开支，协调上限+1。')+'加盟需占用1份协调容量。');
    text.push('每趟商车另捎去公共补助 '+fmt(duties.grant)+'，返程带回地方贡献 '+fmt(duties.contribution)+'；货抵原仓方才入账，若中途折返则原货退回。'+(this.mode(s)==='local'?'若改行中央统筹：每趟补助药2/工具1、回交贡献粮24。':'若改行地方自治：每趟补助药4/工具2、回交贡献粮12。'));
    text.push('正常履约期间，当地外迁不再受批次协议总额度限制；但每次发车仍须核验留守底线、旅费、车组、目的地供养与空床。');
    return {title:'聚居圈的共同法加盟',text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#accessionButton').hide();$('#accessionSummary').hide();return;}
    Civilization.button('accessionButton','共同法加盟与实物财政','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='accessionCharter';Civilization.showPending();}).show();
    let line=$('#accessionSummary');if(!line.length)line=$('<div>').attr('id','accessionSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validateOrder(s,o){
    const d=this.data(s),p=o.publicDuties,fail=()=>{throw Error('加盟公共实物运单无效');};
    if(p===undefined){if(d?.joinedAt!==null&&d&&o.id>=d.firstPublicOrder)fail();return;}
    if(!d||d.joinedAt===null||o.id<d.firstPublicOrder||!p||p.schema!==1||p.sourceId!==d.sourceId||p.joinedAt!==d.joinedAt||o.departedAt<d.joinedAt||!Object.hasOwn(CivilAccessionContent.duties,p.mode)||!Object.hasOwn(CivilNation.charters,p.charter))fail();
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),duties=CivilAccessionContent.duties[p.mode],r=d.records.filter(r=>r.at<=o.departedAt).at(-1),control=d.controls.filter(x=>x.at<o.departedAt||x.at===o.departedAt&&x.afterOrder<o.id).at(-1);
    if(!same(p.grant,duties.grant)||!same(p.contribution,duties.contribution)||!r?.service||r.stableSeconds<CivilNation.charters[p.charter].duration||r.at!==p.receiptAt||r.mode!==p.mode||r.charter!==p.charter||o.departedAt-r.at>10||control&&(!control.enabled||control.at>r.at||control.at===r.at&&control.afterRecord===r.at))fail();
  },
  validate(s){
    const c=s.civilization,d=this.data(s),fail=()=>{throw Error('共同法加盟与公共收支记录无效');};
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=c.elapsed,nullable=x=>x===null||time(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(d===undefined){if(c.commerce?.orders.some(o=>o.publicDuties!==undefined)||this.pendingIds.includes(c.pending)&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||d.sourceId!==CivilCommerce.sourceId(s)||!time(d.proposedAt)||!c.commerce.orders.some(o=>o.security?.mode==='joint'&&o.returnedAt!==null&&o.returnedAt<=d.proposedAt)||!obj(d.approvals)||!d.approvals.home||Object.keys(d.approvals).some(id=>!['home','source'].includes(id))||typeof d.enabled!=='boolean'||!Array.isArray(d.controls)||!Array.isArray(d.records)||!nullable(d.joinedAt)||!nullable(d.lastSettledAt)||!nullable(d.stableSince)||!nullable(d.joiningStableSince))fail();
    for(const [id,a]of Object.entries(d.approvals))if(!obj(a)||!time(a.at)||a.at<d.proposedAt||id==='home'&&a.at!==d.proposedAt||!same(a.cost,CivilAccessionContent.signature[id]))fail();
    let enabled=true,controlAt=d.proposedAt;
    for(const x of d.controls){if(!obj(x)||!d.approvals.source||!time(x.at)||x.at<controlAt||x.at<d.approvals.source.at||typeof x.enabled!=='boolean'||x.enabled===enabled||!nullable(x.afterRecord)||x.afterRecord!==null&&x.afterRecord>x.at||!Number.isSafeInteger(x.afterOrder)||x.afterOrder<0||x.afterOrder>=c.commerce.nextId||c.commerce.orders.some(o=>o.id<=x.afterOrder&&o.departedAt>x.at||o.id>x.afterOrder&&o.departedAt<x.at))fail();enabled=x.enabled;controlAt=x.at;}
    if(enabled!==d.enabled)fail();
    let previous=null,stableSince=null,stableSeconds=0,index=0,running=true,joiningRun=false;
    for(const r of d.records){
      while(index<d.controls.length&&(d.controls[index].at<r.at||d.controls[index].at===r.at&&d.controls[index].afterRecord!==r.at)){
        const x=d.controls[index++];if(x.afterRecord!==(previous?.at??null))fail();running=x.enabled;stableSince=null;stableSeconds=0;
      }
      if(!obj(r)||!d.approvals.source||!time(r.at)||r.at<d.approvals.source.at||previous&&r.at-previous.at<10||!running||!Object.hasOwn(CivilAccessionContent.fees,r.mode)||!Object.hasOwn(CivilNation.charters,r.charter)||!Number.isSafeInteger(r.staff)||r.staff<0||r.staff>2||typeof r.paid!=='boolean'||typeof r.service!=='boolean'||r.paid&&r.staff!==2||r.service&&!r.paid||!same(r.costs,r.paid?this.fee(r.mode,r.charter):{}))fail();
      const duration=CivilNation.charters[r.charter].duration;
      if(r.service){if(stableSince!==null&&previous?.service&&r.at-previous.at===10&&r.mode===previous.mode&&r.charter===previous.charter)stableSeconds=Math.min(duration,stableSeconds+10);else {stableSince=r.at;stableSeconds=0;}}
      else {stableSince=null;stableSeconds=0;}
      if(r.stableSeconds!==stableSeconds)fail();
      if(d.joinedAt!==null&&r.at<=d.joinedAt&&d.joinedAt-r.at<=10&&r.mode===d.joiningMode&&r.charter===d.joiningCharter&&stableSince===d.joiningStableSince&&stableSeconds===duration)joiningRun=true;
      previous=r;
    }
    while(index<d.controls.length){if(d.controls[index++].afterRecord!==(previous?.at??null))fail();stableSince=null;stableSeconds=0;}
    if(d.stableSince!==stableSince||d.stableSeconds!==stableSeconds||d.lastSettledAt!==(previous?.at??null))fail();
    if(d.joinedAt===null){if(d.joiningMode!==null||d.joiningCharter!==null||d.joiningStableSince!==null||d.firstPublicOrder!==null)fail();}
    else if(!joiningRun||!Number.isSafeInteger(d.firstPublicOrder)||d.firstPublicOrder<1||d.firstPublicOrder>c.commerce.nextId||c.commerce.orders.some(o=>o.id<d.firstPublicOrder&&(o.returnedAt===null||o.returnedAt>d.joinedAt)))fail();
    for(const o of c.commerce.orders)this.validateOrder(s,o);
  }
};
