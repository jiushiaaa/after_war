/* MPL-2.0 — Real guards, paid training and partner labor; no population or army grants. */
var CivilSecurity={
  pendingIds:['roadDefense'],
  data(s){return s.civilization.security;},
  available(s){return (s.civilization.commerce?.orders.filter(o=>o.returnedAt!==null).length||0)>=5;},
  nextEvent(s){return this.available(s)&&!this.data(s)&&!CivilCommerce.active(s)?'roadDefense':null;},
  asset(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='guardpost');},
  guards(s){return CivilServices.labor(s,'home','guard');},
  sourceStaff(s,id){const o=CivilCommerce.active(s);return o&&CivilCommerce.sourceId(s)===id?(o.security?.sourceGuard||0):0;},
  sourceFree(s){const id=CivilCommerce.sourceId(s),n=CivilCommerce.source(s);return n?Math.max(0,CivilPopulation.workforce(n.cohorts)-Object.values(n.workers).reduce((a,b)=>a+b,0)-CivilOrigins.sourceStaff(s,id)):0;},
  obligation(s){return this.data(s)?.pact?1:0;},
  choose(s,mode){
    if(!Object.hasOwn(CivilSecurityContent.modes,mode)||!this.available(s)||CivilCommerce.active(s))return false;
    let d=this.data(s);if(!d){if(mode!=='detour')return false;d=s.civilization.security={schema:1,introducedAt:s.civilization.elapsed,legacyBeforeOrder:s.civilization.commerce.nextId,sourceId:CivilCommerce.sourceId(s),mode:'detour',changes:[],pact:null,readiness:0,lastSettledAt:null,records:[]};}
    if(mode!=='detour'&&(!this.asset(s)||d.readiness<300||this.guards(s)<CivilSecurityContent.modes[mode].homeGuard||mode==='joint'&&!d.pact))return false;
    if(d.changes.at(-1)?.mode===mode)return false;
    d.mode=mode;d.changes.push({at:s.civilization.elapsed,mode});return true;
  },
  sign(s){
    const d=this.data(s),cost=CivilSecurityContent.signature,id=CivilCommerce.sourceId(s);
    if(!d||d.pact||CivilCommerce.agreementReason(s)||CivilRegions.load(s)+1>CivilRegions.capacity(s)||!CivilDiplomacy.reserve(s,'home',cost.home)||!CivilDiplomacy.reserve(s,id,cost.source))return false;
    CivilServices.pay(s.stores,cost.home);CivilServices.pay(CivilCommerce.source(s).stores,cost.source);d.pact={at:s.civilization.elapsed,costs:JSON.parse(JSON.stringify(cost))};return true;
  },
  cost(staff){return staff?{food:staff*.5,tools:staff*.05,medicine:staff*.01}:{};},
  nextReadiness(value,previous,row){
    if(!row.paid||row.staff<2)return Math.max(0,value-10);
    if(row.away)return value;
    return Math.min(300,value+(previous?.paid&&previous.staff>=2&&!previous.away&&row.at-previous.at===10?10:0));
  },
  settle(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||!this.asset(s)||d.lastSettledAt!==null&&at-d.lastSettledAt<10)return {};
    const staff=this.guards(s),cost=this.cost(staff),paid=staff>0&&CivilFinance.reserveCheck(s,'home',cost),o=CivilCommerce.active(s),away=!!o?.security?.homeGuard||(typeof CivilFrontier!=='undefined'&&CivilFrontier.guardFloor(s)>0);
    if(paid)CivilServices.pay(s.stores,cost);
    const row={at,staff,away,paid,costs:paid?cost:{},readiness:0};row.readiness=this.nextReadiness(d.readiness,d.records.at(-1),row);d.readiness=row.readiness;d.lastSettledAt=at;d.records.push(row);
    return paid?Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,-v])):{};
  },
  profileFor(s,mode){const p=CivilSecurityContent.modes[mode];return {schema:1,mode,homeGuard:p.homeGuard,sourceGuard:p.sourceGuard,duration:CivilCommerce.route(s).duration+p.extraTime,delay:p.delay,sourcePaid:{...p.sourceCost}};},
  profile(s){const d=this.data(s);return d?{...this.profileFor(s,d.mode),encounterSeconds:0}:null;},
  departureReason(s,p){
    if(this.available(s)&&!this.data(s))return '先在议事屋议定商路绕行或护送';
    if(!p)return null;
    if(p.homeGuard&&typeof CivilFrontier!=='undefined'&&CivilSecurity.guards(s)-CivilFrontier.guardFloor(s)<p.homeGuard)return '守备仍承担渡口职责，须先结束驻防或等分队返城';
    const d=this.data(s),r=d.records.at(-1);
    if(p.homeGuard&&(!this.asset(s)||d.readiness<300||!r?.paid||s.civilization.elapsed-r.at>10||this.guards(s)<p.homeGuard))return '先安排足额守备，实付训练至300秒并维持值勤费用';
    if(p.sourceGuard&&(!d.pact||this.sourceFree(s)<p.sourceGuard))return '共同护送须有对方约定和两名空余成年护路人员';
    if(p.sourceGuard&&!CivilDiplomacy.reserve(s,CivilCommerce.sourceId(s),p.sourcePaid))return '对方先备足护送费用与自身供养';
    return null;
  },
  staffed(s,o){
    const p=o?.security;if(!p)return true;
    if(this.guards(s)-(typeof CivilFrontier!=='undefined'?CivilFrontier.guardFloor(s):0)<p.homeGuard)return false;
    if(p.sourceGuard){const n=CivilCommerce.source(s),id=CivilCommerce.sourceId(s);if(CivilPopulation.workforce(n.cohorts)<CivilOrigins.sourceStaff(s,id))return false;}
    return true;
  },
  delay(s,o){
    const p=o.security;if(!p||!p.delay||o.arrivedAt!==null||o.outboundSeconds!==Math.floor(p.duration/2)||p.encounterSeconds>=p.delay)return false;
    p.encounterSeconds++;if(p.encounterSeconds===p.delay)Civilization.notify('护送队用出发时备好的器械与药品驱离了兽群。人员与货物继续沿原路前进。');return true;
  },
  status(s){
    const d=this.data(s);if(!d)return '连续贸易发现联络近道有兽群活动。可绕行继续，或实际筹建守备与共同护送';
    const p=CivilServices.data(s,'home')?.project,base=CivilSecurityContent.modes[d.mode].name+'；';
    if(!this.asset(s))return base+(p?.type==='guardpost'&&p.status!=='complete'?'训练场施工剩余'+p.remaining+'秒，请安排两名营建工':'可实付建设守备训练场，增加四个岗位但不增加居民');
    return base+'实际守备'+this.guards(s)+' / 4，训练准备'+d.readiness+' / 300秒；'+(d.pact?'共同护送约定已登记':'共同护送可由双方实付议约')+'。';
  },
  event(id,done){
    if(id!=='roadDefense')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'当前人员、训练或约定已变化，本次未执行。')();
    if(!d)buttons.detour={text:'先沿远路绕行',nextScene:'end',onChoose:()=>finish(this.choose(s,'detour'),'已记录绕行：以后出发每程增加120秒，另备旅费；已有运单保留。')};
    else {
      if(!this.asset(s)&&CivilServices.projectAvailable(s,'home')&&CivilServices.facilityGate(s,'home','guardpost'))buttons.build={text:'实付筹办守备训练场',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'home','guardpost'),'训练场材料已支付，仍需两名营建工实际施工。')};
      if(!d.pact)buttons.pact={text:'双方议定共同护送',nextScene:'end',onChoose:()=>finish(this.sign(s),'双方知识已实付，共同护送保留对方人口与仓库，新增一份协调责任。')};
      if(!CivilCommerce.active(s))for(const [mode,p]of Object.entries(CivilSecurityContent.modes))if(mode!==d.mode&&(mode==='detour'||this.asset(s)&&d.readiness>=300&&this.guards(s)>=p.homeGuard&&(mode!=='joint'||d.pact)))buttons[mode]={text:'改用'+p.name,nextScene:'end',onChoose:()=>finish(this.choose(s,mode),'新方案只用于以后出发的商队，当前仓库和旧运单不改写。')};
    }
    if(d)buttons.close={text:'合上护路记录',nextScene:'end',onChoose:done('护路人员仍来自原有居民，装备与行动都须付费。')};
    else buttons.hold={text:'先停止后续贸易',nextScene:'end',onChoose:()=>finish(this.choose(s,'detour')&&(CivilCommerce.cancel(s),true),'后续委托已停止。之后可以选择绕行或实际筹备护送，再重新委托商队。')};
    const text=[this.asset(s)?CivilSecurityContent.modes[d.mode].name+'；守备'+this.guards(s)+'/4，准备'+d.readiness+'/300秒。':this.status(s)];
    if(!d)text.push('绕行不需守备：每程多走120秒，每趟另付食物6、木1、工具0.1。原有运单不变。','之后可付费建设训练场，从现有居民中安排守备；也可与对方协防。现在可以绕行继续，或先停下贸易。');
    else if(!this.asset(s))text.push('绕行每程多120秒，每趟另耗食物6、木1、工具0.1。','训练场实付木120、钢80、工具30、零件20；两名营建工施工360秒。完工后再安排居民训练，不赠送守备。');
    else text.push('每10秒每人耗食物0.5、工具0.05、药品0.01；至少2人训练300秒，欠费或缺员流失准备。','本城护送4人：每趟食物12、工具0.4、药品1。共同护送本城2人、对方2人：本城食物6、工具0.2、药品0.5；对方食物6、工具0.2。','护送去程停30秒驱离，缺员暂停。绕行每程多120秒，另耗食物6、木1、工具0.1；返城后才能改方案。');
    if(d&&!d.pact)text[text.length-1]+=' 共同护送议约需本城知识120、对方60；占1协调，人口仓库独立。';
    return {title:'商路上的守备与协防',text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#securityButton').hide();$('#securitySummary').hide();return;}
    Civilization.button('securityButton','商路守备与协防','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='roadDefense';Civilization.showPending();}).show();
    let line=$('#securitySummary');if(!line.length)line=$('<div>').attr('id','securitySummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validateOrder(s,o){
    const d=this.data(s),p=o.security,fail=()=>{throw Error('商路护送运单无效');};
    if(p===undefined){if(d&&o.id>=d.legacyBeforeOrder)fail();return;}
    if(!d||o.id<d.legacyBeforeOrder||!p||!Object.hasOwn(CivilSecurityContent.modes,p.mode)||d.changes.filter(v=>v.at<=o.departedAt).at(-1)?.mode!==p.mode)fail();
    const expected=this.profileFor(s,p.mode);for(const [k,v]of Object.entries(expected))if(JSON.stringify(p[k])!==JSON.stringify(v))fail();
    if(!Number.isSafeInteger(p.encounterSeconds)||p.encounterSeconds<0||p.encounterSeconds>p.delay||p.encounterSeconds&&o.outboundSeconds<Math.floor(p.duration/2)||o.outboundSeconds>Math.floor(p.duration/2)&&p.encounterSeconds!==p.delay||o.lastMovedAt-o.departedAt<o.outboundSeconds+o.inboundSeconds+p.encounterSeconds||o.arrivedAt!==null&&o.arrivedAt<o.departedAt+p.duration+p.delay)fail();
    if(p.homeGuard){const r=d.records.filter(r=>r.at<=o.departedAt).at(-1),asset=this.asset(s);if(!asset||asset.completedAt>o.departedAt||!r?.paid||r.readiness<300||r.staff<p.homeGuard||o.departedAt-r.at>10)fail();}
    if(p.sourceGuard&&(!d.pact||d.pact.at>o.departedAt))fail();
  },
  validate(s){
    const c=s.civilization,d=this.data(s),asset=this.asset(s),project=CivilServices.data(s,'home')?.project,construction=asset||(project?.type==='guardpost'?project:null),fail=()=>{throw Error('商路守备训练与协防记录无效');};
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=c.elapsed,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(construction&&(!d||construction.startedAt<d.introducedAt))fail();
    if(d===undefined){if(c.commerce?.orders.some(o=>o.security!==undefined)||this.pendingIds.includes(c.pending)&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||d.sourceId!==CivilCommerce.sourceId(s)||!time(d.introducedAt)||!Number.isSafeInteger(d.legacyBeforeOrder)||d.legacyBeforeOrder<6||d.legacyBeforeOrder>c.commerce.nextId||c.commerce.orders.filter(o=>o.id<d.legacyBeforeOrder&&o.returnedAt!==null&&o.returnedAt<=d.introducedAt).length<5||!Object.hasOwn(CivilSecurityContent.modes,d.mode)||!Array.isArray(d.changes)||!d.changes.length||!Array.isArray(d.records)||d.lastSettledAt!==null&&!time(d.lastSettledAt))fail();
    if(c.commerce.orders.some(o=>o.id<d.legacyBeforeOrder&&(o.returnedAt===null||o.returnedAt>d.introducedAt)))fail();
    let previous=null;
    for(const change of d.changes){if(!obj(change)||!time(change.at)||change.at<d.introducedAt||!Object.hasOwn(CivilSecurityContent.modes,change.mode)||!previous&&(change.at!==d.introducedAt||change.mode!=='detour')||previous&&(change.at<previous.at||change.mode===previous.mode)||c.commerce.orders.some(o=>o.departedAt<change.at&&(o.returnedAt===null||o.returnedAt>change.at)))fail();previous=change;}
    if(previous.mode!==d.mode)fail();
    if(d.pact!==null&&(!obj(d.pact)||!time(d.pact.at)||d.pact.at<d.introducedAt||!same(d.pact.costs,CivilSecurityContent.signature)))fail();
    previous=null;let readiness=0;
    for(const r of d.records){
      if(!obj(r)||!asset||!time(r.at)||r.at<asset.completedAt||previous&&r.at-previous.at<10||!Number.isSafeInteger(r.staff)||r.staff<0||r.staff>4||typeof r.paid!=='boolean'||typeof r.away!=='boolean'||r.paid&&!r.staff||!same(r.costs,r.paid?this.cost(r.staff):{}))fail();
      // Settlement precedes this second's convoy movement and dispatch.
      const away=c.commerce.orders.some(o=>o.security?.homeGuard&&o.departedAt<r.at&&(o.returnedAt===null||o.returnedAt>=r.at));if(r.away!==(away||(typeof CivilFrontier!=='undefined'&&CivilFrontier.awayAt(s,r.at))))fail();
      readiness=this.nextReadiness(readiness,previous,r);if(r.readiness!==readiness)fail();previous=r;
    }
    if(d.readiness!==readiness||d.lastSettledAt!==(previous?.at??null))fail();
    for(const o of c.commerce.orders)this.validateOrder(s,o);
  }
};
