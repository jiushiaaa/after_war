/* MPL-2.0 — A paid residence pact with an independent, existing source society. */
var CivilDiplomacy={
  pendingIds:['residencePact'],
  signature:{home:{knowledge:120,wood:20,tools:4},source:{knowledge:60,wood:20,tools:4}},
  fees:{home:{knowledge:.08,wood:.1},source:{knowledge:.04,wood:.1}},
  data(s){return s.civilization.diplomacy;},
  available(s){return Number.isSafeInteger(s.civilization.nation?.foundedAt);},
  name(id){return CivilOriginContent[id]?.name||'独立聚居圈';},
  same(a,b){return JSON.stringify(a)===JSON.stringify(b);},
  source(s,id){return s.civilization.origins?.nodes[id];},
  candidates(s){return Object.keys(CivilOriginContent).filter(id=>this.source(s,id)?.status==='agreed');},
  reserve(s,id,cost){
    if(id==='home')return CivilFinance.reserveCheck(s,'home',cost);
    const n=this.source(s,id);if(!n)return false;
    const reserve={food:CivilPopulation.foodPopulation(n.cohorts)*.12*12,medicine:n.population*.01*12,tools:40,wood:CivilOrigins.plan(n.cohorts).teacher*.1*12};
    return [...new Set([...Object.keys(cost),...Object.keys(reserve)])].every(k=>(n.stores[k]||0)+1e-8>=(cost[k]||0)+(reserve[k]||0));
  },
  reason(s,id){
    if(!this.available(s))return '先完成国家宪章';
    if(!CivilNation.operational(s))return '先恢复国家共同法与认可';
    if(!CivilFinance.political(s))return '先处理现有继任或制度议决';
    const n=this.source(s,id);if(n?.status!=='agreed')return '先完成与该聚居圈的联络及基础迁居协议';
    return CivilOrigins.supplyReason(s,id,n.cohorts);
  },
  sign(s,id){
    if(this.data(s)||this.reason(s,id)||!this.reserve(s,'home',this.signature.home)||!this.reserve(s,id,this.signature.source))return false;
    CivilServices.pay(s.stores,this.signature.home);CivilServices.pay(this.source(s,id).stores,this.signature.source);
    s.civilization.diplomacy={schema:1,sourceId:id,nationAt:s.civilization.nation.foundedAt,signedAt:s.civilization.elapsed,signature:JSON.parse(JSON.stringify(this.signature)),active:true,revisions:[],revision:null,lastSettledAt:null,stableSince:null,stableSeconds:0,granted:0,records:[]};return true;
  },
  allowance(s,id){const d=this.data(s);return d?.sourceId===id&&Number.isInteger(d.granted)&&d.granted>=0&&d.granted<=480?d.granted:0;},
  usableAllowance(s,id){return this.operational(s)?this.allowance(s,id):0;},
  operational(s){const d=this.data(s),last=d?.records.at(-1),r=last?.service===null?(last.paid?d.records.at(-2):null):last,v=d?.revisions.at(-1);return !!d&&d.active&&CivilNation.operational(s)&&r?.service===true&&(!v||r.at>v.at||r.at===v.at&&v.afterRecord!==r.at)&&s.civilization.elapsed-r.at>=0&&s.civilization.elapsed-r.at<=10;},
  revise(s,action){
    const d=this.data(s);if(!d||d.revision||!CivilFinance.political(s)||!['pause','resume'].includes(action)||d.active===(action==='resume'))return false;
    const at=s.civilization.elapsed;d.revision={action,requestedAt:at,effectiveAt:at+(s.civilization.society.axes.charter==='constitution'?60:0)};this.tick(s);return true;
  },
  tick(s){
    const d=this.data(s),v=d?.revision;if(!v||s.civilization.elapsed<v.effectiveAt||!CivilFinance.political(s))return false;
    d.active=v.action==='resume';d.revisions.push({...v,at:s.civilization.elapsed,afterRecord:d.lastSettledAt});d.revision=null;
    d.stableSince=null;d.stableSeconds=0;return true;
  },
  settle(s){
    this.tick(s);const d=this.data(s),at=s.civilization.elapsed;if(!d||!d.active||d.lastSettledAt!==null&&at-d.lastSettledAt<10)return {};
    d.lastSettledAt=at;const paid=this.reserve(s,'home',this.fees.home)&&this.reserve(s,d.sourceId,this.fees.source);
    if(paid){CivilServices.pay(s.stores,this.fees.home);CivilServices.pay(this.source(s,d.sourceId).stores,this.fees.source);}
    d.records.push({at,paid,costs:paid?JSON.parse(JSON.stringify(this.fees)):{},service:null,grant:0});
    return paid?Object.fromEntries(Object.entries(this.fees.home).map(([k,v])=>[k,-v])):{};
  },
  observe(s){
    const d=this.data(s),r=d?.records.at(-1);if(!r||r.service!==null||r.at!==s.civilization.elapsed)return false;
    r.service=r.paid&&d.active&&!this.reason(s,d.sourceId);const previous=d.records.at(-2),revision=d.revisions.at(-1);
    if(r.service){
      if(d.stableSince!==null&&previous?.service&&r.at-previous.at===10&&(!revision||revision.at<=previous.at))d.stableSeconds+=10;
      else {d.stableSince=r.at;d.stableSeconds=0;}
      if(d.stableSeconds>=600){if(d.granted<480){r.grant=24;d.granted+=24;this.source(s,d.sourceId).revision++;}d.stableSince=r.at;d.stableSeconds=0;}
    }else {d.stableSince=null;d.stableSeconds=0;}
    return r.service;
  },
  status(s){
    const d=this.data(s);if(!d)return '可以与已登记来源商议居留公约，双方继续独立供养和管理居民';
    const base=this.name(d.sourceId)+' · 追加居留额度 '+d.granted+' / 480；';
    if(d.revision)return base+'修订公示尚余 '+Math.max(0,d.revision.effectiveAt-s.civilization.elapsed)+' 秒';
    if(!d.active)return base+'公约已暂停，未使用的追加额度冻结，已出发旅客照常行进';
    const r=d.records.at(-1);if(r&&!r.paid)return base+'双方公共记录费用或供养储备不足；本轮两边均未扣费';
    const reason=this.reason(s,d.sourceId);if(reason)return base+reason+'；已有额度与迁居历史保留';
    return base+(d.granted>=480?'本公约额度已核准完毕，使用未用额度仍须维持履约':'连续有效记录 '+d.stableSeconds+' / 600秒，下一批核准24人')+'。实际迁居仍需目的地住房、供养、客运和旅费';
  },
  event(id,done){
    if(id!=='residencePact')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'当前条件已变化，公约未执行；请核对共同法、来源供养和双方费用。')();
    if(!d)for(const source of this.candidates(s))buttons['sign_'+source]={text:'与'+this.name(source)+'议约',nextScene:'end',onChoose:()=>finish(this.sign(s,source),'双方实付建档费用，居留公约开始核对持续履约。人口和库存仍各自保管。')};
    else if(!d.revision){const action=d.active?'pause':'resume';buttons[action]={text:d.active?'暂停公约与追加居留':'恢复公约履约',nextScene:'end',onChoose:()=>finish(this.revise(s,action),'公约修订已登记；公示后生效，已出发旅客继续按原安排前行。')};}
    buttons.close={text:'合上居留公约',nextScene:'end',onChoose:done('双方保留自己的居民名册和公共账册。')};
    return {title:'独立聚居圈的居留公约',text:[this.status(s)+'。',
      '议约各自实付：本城知识120、木20、工具4；对方知识60、木20、工具4。每10秒本城知识0.08、木0.1，对方知识0.04、木0.1；任一方不足则本轮两边均不扣费。',
      '每连续600秒有效履约核准24人的追加居留资格，累计最多480。资格不生成居民，留守年龄结构、旅费、车辆和床位仍按原规则核对。',
      '暂停后停止费用与核准，未用追加资格冻结；恢复不重发已用资格。'+(typeof CivilAccession!=='undefined'&&CivilAccession.population(s)?'该聚居圈已另按加盟公约登记共同法；新迁居须核对加盟履约和原有留守、车辆及床位。':'来源保持独立，不算国家领土或人口。')],buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#diplomacyButton').hide();$('#diplomacySummary').hide();return;}
    const label=typeof CivilAccession!=='undefined'&&CivilAccession.population(State)?'加盟聚居圈居留公约':'独立聚居圈公约',button=Civilization.button('diplomacyButton',label,'#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='residencePact';Civilization.showPending();});button.show().contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(label));
    let line=$('#diplomacySummary');if(!line.length)line=$('<div>').attr('id','diplomacySummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const d=this.data(s),fail=()=>{throw Error('居留公约与追加资格记录无效');};if(d===undefined){if(this.pendingIds.includes(s.civilization.pending)&&!this.available(s))fail();return;}
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=s.civilization.elapsed,nullable=x=>x===null||time(x);
    if(!obj(d)||d.schema!==1||!this.available(s)||d.nationAt!==s.civilization.nation.foundedAt||!time(d.signedAt)||d.signedAt<d.nationAt||!this.candidates(s).includes(d.sourceId)||!this.same(d.signature,this.signature)||typeof d.active!=='boolean'||!Array.isArray(d.records)||!Array.isArray(d.revisions)||!nullable(d.lastSettledAt)||!nullable(d.stableSince)||!Number.isInteger(d.stableSeconds)||d.stableSeconds<0||d.stableSeconds>=600||d.stableSeconds%10||!Number.isInteger(d.granted)||d.granted<0||d.granted>480||d.granted%24)fail();
    let active=true,lastRevision=d.signedAt;
    const validRevision=v=>obj(v)&&['pause','resume'].includes(v.action)&&time(v.requestedAt)&&v.requestedAt>=lastRevision&&Number.isSafeInteger(v.effectiveAt)&&[0,60].includes(v.effectiveAt-v.requestedAt)&&active!==(v.action==='resume');
    for(const v of d.revisions){if(!validRevision(v)||!time(v.at)||v.at<v.effectiveAt||!nullable(v.afterRecord)||v.afterRecord!==null&&v.afterRecord>v.at)fail();lastRevision=v.at;active=v.action==='resume';}
    if(active!==d.active||d.revision!==null&&!validRevision(d.revision))fail();
    let previous=null,stableSince=null,stableSeconds=0,granted=0,revisionIndex=0,running=true;
    for(const r of d.records){
      while(revisionIndex<d.revisions.length&&(d.revisions[revisionIndex].at<r.at||d.revisions[revisionIndex].at===r.at&&d.revisions[revisionIndex].afterRecord!==r.at)){
        const v=d.revisions[revisionIndex++];if(v.afterRecord!==(previous?.at??null))fail();running=v.action==='resume';stableSince=null;stableSeconds=0;
      }
      if(!obj(r)||!time(r.at)||r.at<d.signedAt||previous&&r.at-previous.at<10||!running||typeof r.paid!=='boolean'||typeof r.service!=='boolean'||r.service&&!r.paid||!this.same(r.costs,r.paid?this.fees:{})||![0,24].includes(r.grant))fail();
      if(r.service){if(stableSince!==null&&previous?.service&&r.at-previous.at===10)stableSeconds+=10;else {stableSince=r.at;stableSeconds=0;}}
      else {stableSince=null;stableSeconds=0;}
      const grant=stableSeconds>=600&&granted<480?24:0;if(r.grant!==grant)fail();granted+=grant;
      if(stableSeconds>=600){stableSince=r.at;stableSeconds=0;}previous=r;
    }
    while(revisionIndex<d.revisions.length){if(d.revisions[revisionIndex++].afterRecord!==(previous?.at??null))fail();stableSince=null;stableSeconds=0;}
    if(d.granted!==granted||d.stableSince!==stableSince||d.stableSeconds!==stableSeconds||d.lastSettledAt!==(previous?.at??null))fail();
  }
};
