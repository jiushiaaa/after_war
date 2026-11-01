/* MPL-2.0 — Physical project cargo, existing local workers and paid road-service receipts. */
var CivilCorridor={
  pendingIds:['nationalCorridor'],
  data(s){return s.civilization.corridor;},
  available(s){return Number.isSafeInteger(s.civilization.accession?.joinedAt)&&!!CivilRailway.asset(s)&&(s.civilization.intercity?.orders.filter(o=>o.deliveredAt!==null&&o.returnedAt!==null).length||0)>=2;},
  reason(s){return !this.available(s)?'先完成共同法加盟、铁轨支线和两趟三城联运':!CivilAccession.operational(s)||!CivilFinance.political(s)?'先恢复国家、加盟的持续履约和现任行政':null;},
  start(s){
    const cost=CivilCorridorContent.signature,id=CivilCommerce.sourceId(s);if(this.data(s)||this.reason(s)||!CivilDiplomacy.reserve(s,'home',cost.home)||!CivilDiplomacy.reserve(s,id,cost.source))return false;
    CivilServices.pay(s.stores,cost.home);CivilServices.pay(CivilCommerce.source(s).stores,cost.source);
    s.civilization.corridor={schema:1,sourceId:id,agreedAt:s.civilization.elapsed,firstOrder:s.civilization.commerce.nextId,signature:JSON.parse(JSON.stringify(cost)),required:{...CivilCorridorContent.materials},buffer:{},receipts:[],startedAt:null,worked:0,work:[],lastWorkedAt:null,completedAt:null,consumed:{},maintenance:[],lastSettledAt:null};return true;
  },
  pack(remaining){const cargo={};let left=CivilCorridorContent.capacity;for(const [k,n]of Object.entries(CivilCorridorContent.materials)){const count=Math.min(left,remaining[k]||0);if(count){cargo[k]=count;left-=count;}}return cargo;},
  next(s){
    const d=this.data(s);if(!d||d.startedAt!==null)return null;const missing={...d.required};
    for(const o of s.civilization.commerce.orders)if(o.works?.agreedAt===d.agreedAt)for(const [k,n]of Object.entries(o.works.cargo))missing[k]-=n;
    const cargo=this.pack(missing);return Object.keys(cargo).length?{agreedAt:d.agreedAt,cargo}:null;
  },
  receive(s,o){
    const d=this.data(s);if(!o.works||!d||d.receipts.some(r=>r.orderId===o.id))return false;
    for(const [k,n]of Object.entries(o.works.cargo)){o.cargo[k]-=n;if(!o.cargo[k])delete o.cargo[k];d.buffer[k]=(d.buffer[k]||0)+n;}
    d.receipts.push({orderId:o.id,at:s.civilization.elapsed,cargo:{...o.works.cargo}});
    if(Object.entries(d.required).every(([k,n])=>d.buffer[k]===n)){d.startedAt=s.civilization.elapsed;d.lastWorkedAt=d.startedAt;CivilOrigins.assign(s,d.sourceId);}
    Civilization.notify('原商车将 '+CivilHistory.costText(o.works.cargo)+' 交入加盟道路工程保管账；普通贸易仍独立结算。');return true;
  },
  staff(s,id=CivilCommerce.sourceId(s)){
    const d=this.data(s);if(!d||d.sourceId!==id||d.startedAt===null)return 0;
    const n=CivilCommerce.source(s);if(n.health<60||n.hunger||!CivilDiplomacy.reserve(s,id,{}))return 0;
    const plan=CivilOrigins.plan(n.cohorts),limits=CivilOrigins.jobLimits(s,id),needed=Object.entries(plan).reduce((sum,[k,v])=>sum+Math.min(v,limits[k]),0);
    const other=CivilSecurity.sourceStaff(s,id)+CivilOrigins.schoolBuilders(s,id)+CivilAccession.staff(s,id)+(s.civilization.origins.contactTrip?.source===id&&!CivilOrigins.contactWorkReason(s,id)?2:0);
    return Math.max(0,Math.min(d.completedAt===null?2:1,CivilPopulation.workforce(n.cohorts)-needed-other));
  },
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.startedAt===null||d.completedAt!==null||d.lastWorkedAt>=at)return;d.lastWorkedAt=at;
    if(this.staff(s)!==2)return;const last=d.work.at(-1);if(last&&last.to===at-1)last.to=at;else d.work.push({from:at,to:at});d.worked++;
    if(d.worked===CivilCorridorContent.work){d.completedAt=at;d.consumed={...d.buffer};d.buffer={};CivilOrigins.assign(s,d.sourceId);Civilization.notify('加盟道路驿站完成实际施工；须有人值守并持续支付两边维护，新发商队才采用修复后的路程。');}
  },
  settle(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.completedAt===null||d.lastSettledAt!==null&&at-d.lastSettledAt<10)return {};
    const cost=CivilCorridorContent.maintenance,staff=this.staff(s),paid=staff===1&&CivilDiplomacy.reserve(s,'home',cost.home)&&CivilDiplomacy.reserve(s,d.sourceId,cost.source);
    if(paid){CivilServices.pay(s.stores,cost.home);CivilServices.pay(CivilCommerce.source(s).stores,cost.source);}
    d.lastSettledAt=at;d.maintenance.push({at,staff,paid,costs:paid?JSON.parse(JSON.stringify(cost)):{}});return paid?Object.fromEntries(Object.entries(cost.home).map(([k,n])=>[k,-n])):{};
  },
  profile(s){
    const d=this.data(s),r=d?.maintenance.at(-1);return d?.completedAt!==null&&d&&r?.paid&&this.staff(s)===1&&s.civilization.elapsed-r.at>=0&&s.civilization.elapsed-r.at<=10?{completedAt:d.completedAt,maintainedAt:r.at,baseDuration:Math.ceil(CivilCommerce.route(s).duration*.75)}:null;
  },
  status(s){
    const d=this.data(s);if(!d)return this.reason(s)||'双方可实付筹办道路驿站，原商车分批运材';
    if(d.startedAt===null)return '工程材料实到 '+CivilHistory.costText(d.buffer)+'；尚需 '+CivilHistory.costText(Object.fromEntries(Object.entries(d.required).map(([k,n])=>[k,n-(d.buffer[k]||0)])))+'。随正常商队每趟最多带32单位，不另派车。';
    if(d.completedAt===null)return '当地建设者 '+this.staff(s)+'/2；实际施工 '+d.worked+'/'+CivilCorridorContent.work+'秒，缺员或供养不足则暂停。';
    const p=this.profile(s);return '当地道路值守 '+this.staff(s)+'/1；'+(p?'两地维护已付，新发商队基础单程 '+p.baseDuration+'秒。':'维护尚未齐备，新发商队暂走原路 '+CivilCommerce.route(s).duration+'秒。')+'在途原单不改时间。';
  },
  event(id,done){
    if(id!=='nationalCorridor')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'条件已变化，本次未执行；原材料与运单保留。')();
    if(!d)buttons.start={text:'双方实付筹办道路',nextScene:'end',onChoose:()=>finish(this.start(s),'本城与当地分别实付筹办，后续材料由原商车分批运送。')};
    else if(d.startedAt===null&&!CivilCommerce.plan(s))buttons.schedule={text:'委托最多六趟运材贸易',nextScene:'end',onChoose:()=>finish(CivilCommerce.schedule(s),'沿用原六趟商队委托；每次出发才扣货物、建材和旅费。')};
    else if(d.startedAt===null&&CivilCommerce.plan(s))buttons.cancel={text:'撤销未发运材商队',nextScene:'end',onChoose:()=>finish(CivilCommerce.cancel(s),'未启程委托已撤销；当前原单继续，实到材料留在工程保管账。')};
    buttons.close={text:'合上道路工程账',nextScene:'end',onChoose:done('原运单与两地仓库分别记账。')};
    return {title:CivilDiplomacy.name(CivilCommerce.sourceId(s))+'道路驿站',text:[this.status(s),'筹办：本城知识100；当地知识80、木60、工具6、粮120。另运木96、钢48、零件24、工具24，原商车每趟随带32，共6趟。','材料到齐，当地2名空闲成人施工600秒，保留供养与教学。建材实到入保管账，不因普通贸易失败退回。','完工后当地1人值守。每10秒本城零件0.02、当地木0.2和工具0.02，双方可付才扣；新车基础单程3/4，原护送费用与额外时间照旧。','共用原车、司机与护送人员。在途原时长不变；维护不足的新车走原路。'],buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;if(!this.available(State)){$('#corridorButton,#corridorSummary').hide();return;}
    Civilization.button('corridorButton','加盟道路驿站','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='nationalCorridor';Civilization.showPending();}).show();
    let line=$('#corridorSummary');if(!line.length)line=$('<div>').attr('id','corridorSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const d=this.data(s),c=s.civilization,t=c.elapsed,fail=()=>{throw Error('加盟道路工程、运材或维护凭据无效');},obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=t,nullable=x=>x===null||time(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const orders=c.commerce?.orders||[];
    if(d===undefined){if(orders.some(o=>o.works!==undefined||o.corridor!==undefined)||c.pending==='nationalCorridor'&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||d.sourceId!==CivilCommerce.sourceId(s)||!time(d.agreedAt)||d.agreedAt<c.accession.joinedAt||d.agreedAt<CivilRailway.asset(s).completedAt||c.intercity.orders.filter(o=>o.deliveredAt!==null&&o.returnedAt!==null&&o.returnedAt<=d.agreedAt).length<2||!Number.isSafeInteger(d.firstOrder)||d.firstOrder<1||d.firstOrder>c.commerce.nextId||!same(d.signature,CivilCorridorContent.signature)||!same(d.required,CivilCorridorContent.materials)||!obj(d.buffer)||!obj(d.consumed)||!Array.isArray(d.receipts)||!Array.isArray(d.work)||!Array.isArray(d.maintenance)||!nullable(d.startedAt)||!nullable(d.lastWorkedAt)||!nullable(d.completedAt)||!nullable(d.lastSettledAt)||!Number.isSafeInteger(d.worked)||d.worked<0||d.worked>CivilCorridorContent.work)fail();
    const remaining={...d.required},received={},receipts=[];
    for(const o of orders){
      const cargo=this.pack(remaining),expected=o.id>=d.firstOrder&&Object.keys(cargo).length?{agreedAt:d.agreedAt,cargo}:undefined;
      if(o.id<d.firstOrder&&o.departedAt>d.agreedAt||o.id>=d.firstOrder&&o.departedAt<d.agreedAt||!same(o.works,expected))fail();
      if(o.works){for(const [k,n]of Object.entries(cargo))remaining[k]-=n;if(o.arrivedAt!==null){receipts.push({orderId:o.id,at:o.arrivedAt,cargo});for(const [k,n]of Object.entries(cargo))received[k]=(received[k]||0)+n;}}
    }
    if(!same(d.receipts,receipts))fail();const full=Object.entries(d.required).every(([k,n])=>received[k]===n);
    if(d.startedAt!==(full?receipts.at(-1).at:null)||!same(d.buffer,d.completedAt===null?received:{})||!same(d.consumed,d.completedAt===null?{}:d.required))fail();
    let prior=null,worked=0;for(const r of d.work){if(!obj(r)||!time(r.from)||!time(r.to)||r.from>r.to||d.startedAt===null||r.from<=d.startedAt||prior&&r.from<=prior.to+1||d.lastWorkedAt===null||r.to>d.lastWorkedAt)fail();worked+=r.to-r.from+1;prior=r;}
    if(worked!==d.worked||d.startedAt===null&&(d.lastWorkedAt!==null||d.worked||d.completedAt!==null)||d.startedAt!==null&&(d.lastWorkedAt===null||d.lastWorkedAt<d.startedAt)||d.completedAt!==null&&(d.worked!==CivilCorridorContent.work||d.completedAt!==prior?.to||d.lastWorkedAt!==d.completedAt)||d.completedAt===null&&d.worked===CivilCorridorContent.work)fail();
    prior=null;for(const r of d.maintenance){if(!obj(r)||d.completedAt===null||!time(r.at)||r.at<d.completedAt||prior&&r.at-prior.at<10||![0,1].includes(r.staff)||typeof r.paid!=='boolean'||r.paid&&r.staff!==1||!same(r.costs,r.paid?CivilCorridorContent.maintenance:{}))fail();prior=r;}
    if(d.lastSettledAt!==(prior?.at??null))fail();
    for(const o of orders)if(o.corridor!==undefined){const p=o.corridor,r=d.maintenance.find(r=>r.at===p?.maintainedAt);if(!obj(p)||Object.keys(p).length!==3||d.completedAt===null||p.completedAt!==d.completedAt||p.baseDuration!==Math.ceil(CivilCommerce.route(s).duration*.75)||!r?.paid||o.departedAt<r.at||o.departedAt-r.at>10||o.departedAt<d.completedAt)fail();}
  }
};
