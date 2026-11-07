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
  profileFor(s,mode,baseDuration=CivilCommerce.route(s).duration){const p=CivilSecurityContent.modes[mode];return {schema:1,mode,homeGuard:p.homeGuard,sourceGuard:p.sourceGuard,duration:baseDuration+p.extraTime,delay:p.delay,sourcePaid:{...p.sourceCost}};},
  profile(s){const d=this.data(s);return d?{...this.profileFor(s,d.mode,CivilCommerce.departureDuration?CivilCommerce.departureDuration(s):CivilCommerce.route(s).duration),encounterSeconds:0}:null;},
  departureReason(s,p){
    if(this.available(s)&&!this.data(s))return '请先在议事屋议定商路绕行或护送方案';
    if(!p)return null;
    if(p.homeGuard&&typeof CivilFrontier!=='undefined'&&CivilSecurity.guards(s)-CivilFrontier.guardFloor(s)<p.homeGuard)return '守备正担负渡口防务，须先撤防或等分队返城';
    const d=this.data(s),r=d.records.at(-1);
    if(p.homeGuard&&(!this.asset(s)||d.readiness<300||!r?.paid||s.civilization.elapsed-r.at>10||this.guards(s)<p.homeGuard))return '请先配足守备，付清用度训满300秒，并维持日常值勤开支';
    if(p.sourceGuard&&(!d.pact||this.sourceFree(s)<p.sourceGuard))return '共同护送须与对方立约，并由对方腾出两名空闲成年护路人';
    if(p.sourceGuard&&!CivilDiplomacy.reserve(s,CivilCommerce.sourceId(s),p.sourcePaid))return '对方须先备足护送用度与本地供养';
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
    p.encounterSeconds++;if(p.encounterSeconds===p.delay)Civilization.notify('护送队凭随车带出的器械与伤药驱散了兽群，人货继续顺原路前行。');return true;
  },
  status(s){
    const d=this.data(s);if(!d)return '商队往来频繁，发现联络近道有兽群出没。可改走远路绕行，或出资筹建守备、与对方共同护路';
    const p=CivilServices.data(s,'home')?.project,base=CivilSecurityContent.modes[d.mode].name+'；';
    if(!this.asset(s))return base+(p?.type==='guardpost'&&p.status!=='complete'?'训练场施工尚余'+p.remaining+'秒，请分派两名营建工':'可出资兴建守备训练场，新增四个岗位，不额外添丁');
    return base+'在岗守备'+this.guards(s)+' / 4，操演进度'+d.readiness+' / 300秒；'+(d.pact?'共同护送已立约登记':'共同护送可由双方出资立约')+'。';
  },
  event(id,done){
    if(id!=='roadDefense')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'人手、操演进度或约定已有变动，本次未执行。')();
    if(!d)buttons.detour={text:'先沿远路绕行',nextScene:'end',onChoose:()=>finish(this.choose(s,'detour'),'已改记绕行：此后发车单程多走120秒，需另备旅费；已在途运单照旧。')};
    else {
      if(!this.asset(s)&&CivilServices.projectAvailable(s,'home')&&CivilServices.facilityGate(s,'home','guardpost'))buttons.build={text:'出资筹办守备训练场',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'home','guardpost'),'训练场建材已付清，还需两名营建工动工兴建。')};
      if(!d.pact)buttons.pact={text:'双方议定共同护送',nextScene:'end',onChoose:()=>finish(this.sign(s),'双方知识已付清。共同护送不归并对方人口与仓库，另占一份协调责任。')};
      if(!CivilCommerce.active(s))for(const [mode,p]of Object.entries(CivilSecurityContent.modes))if(mode!==d.mode&&(mode==='detour'||this.asset(s)&&d.readiness>=300&&this.guards(s)>=p.homeGuard&&(mode!=='joint'||d.pact)))buttons[mode]={text:'改用'+p.name,nextScene:'end',onChoose:()=>finish(this.choose(s,mode),'新方案仅对往后发出的商队生效，现有库存与旧运单概不改动。')};
    }
    if(d)buttons.close={text:'合上护路记录',nextScene:'end',onChoose:done('护路人手仍从在册居民中抽调，器械与出勤均需照付用度。')};
    else buttons.hold={text:'先停止后续贸易',nextScene:'end',onChoose:()=>finish(this.choose(s,'detour')&&(CivilCommerce.cancel(s),true),'后续发车委托已停。可先改道绕行或备妥护送人手，再重新委派商队。')};
    const text=[this.asset(s)?CivilSecurityContent.modes[d.mode].name+'；守备'+this.guards(s)+'/4，操演'+d.readiness+'/300秒。':this.status(s)];
    if(!d)text.push('绕行无需派驻守备：单程多走120秒，每趟另耗食物6、木1、工具0.1。已在途运单照旧。','日后可出资兴建训练场，从在册居民中抽调守备，也能与对方联手协防。眼下可先绕道跑车，或暂且停发商队。');
    else if(!this.asset(s))text.push('绕行单程多走120秒，每趟另耗食物6、木1、工具0.1。','兴建训练场需耗木120、钢80、工具30、零件20，由两名营建工施工360秒。竣工后需自行抽调居民参训，不会凭空多出守备。');
    else text.push('守备每人每10秒耗食物0.5、工具0.05、药品0.01；至少需2人训满300秒，断供或缺员会使操演进度倒退。','本城独力护送需派4人：每趟耗食物12、工具0.4、药品1。双方共同护送则各派2人：本城出食物6、工具0.2、药品0.5；对方出食物6、工具0.2。','护送去程需停驻30秒驱散兽群，人手不足则暂停。绕行单程多走120秒，另耗食物6、木1、工具0.1；商队返城后方可更改方案。');
    if(d&&!d.pact)text[text.length-1]+=' 共同护送立约需耗本城知识120、对方60；占1份协调责任，双方人口与仓库保持独立。';
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
    const expected=this.profileFor(s,p.mode,o.corridor?.baseDuration||CivilCommerce.route(s).duration);for(const [k,v]of Object.entries(expected))if(JSON.stringify(p[k])!==JSON.stringify(v))fail();
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
