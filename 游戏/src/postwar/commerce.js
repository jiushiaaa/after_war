/* MPL-2.0 — One real caravan, independent warehouses and bounded trade instructions. */
var CivilCommerce={
  pendingIds:['foreignCommerce'],
  data(s){return s.civilization.commerce;},
  available(s){return Number.isSafeInteger(s.civilization.nation?.foundedAt)&&!!s.civilization.diplomacy;},
  asset(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='foreigncaravan');},
  sourceId(s){return this.data(s)?.sourceId||s.civilization.diplomacy?.sourceId;},
  source(s){return s.civilization.origins?.nodes[this.sourceId(s)];},
  route(s){return CivilCommerceContent.routes[this.sourceId(s)];},
  active(s){const o=this.data(s)?.orders.at(-1);return o&&o.returnedAt===null?o:null;},
  plan(s){const d=this.data(s),p=d?.plans.at(-1);return p&&p.cancelledAt===null&&d.orders.filter(o=>o.planId===p.id).length<p.limit?p:null;},
  reservedTransport(s){return this.active(s)?2:0;},
  obligation(s){return this.data(s)?1:0;},
  staffed(s){return CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)>=2;},
  busy(s,corridor){return !!this.active(s)&&this.route(s)?.corridor===corridor;},
  paid(){const cost={...CivilCommerceContent.cargo};for(const [k,v]of Object.entries(CivilCommerceContent.travelCost))cost[k]=(cost[k]||0)+v;return cost;},
  agreementReason(s){
    if(!this.available(s))return '先成立国家并签订独立来源居留公约';
    if(!CivilDiplomacy.operational(s))return '先恢复国家与居留公约的实际履约';
    if(!CivilFinance.political(s))return '先完成现有继任与改制';
    if(!this.source(s)||this.source(s).status!=='agreed')return '先完成对方基础协议';
    if(CivilRegions.load(s)+(this.data(s)?0:1)>CivilRegions.capacity(s))return '等待一份空余协调责任';
    return null;
  },
  sign(s){
    const id=this.sourceId(s),cost=CivilCommerceContent.signature;
    if(this.data(s)||this.agreementReason(s)||!CivilDiplomacy.reserve(s,'home',cost.home)||!CivilDiplomacy.reserve(s,id,cost.source))return false;
    CivilServices.pay(s.stores,cost.home);CivilServices.pay(this.source(s).stores,cost.source);
    s.civilization.commerce={schema:1,sourceId:id,signedAt:s.civilization.elapsed,signature:JSON.parse(JSON.stringify(cost)),plans:[],orders:[],nextId:1,lastTickAt:null};return true;
  },
  schedule(s){
    const d=this.data(s);if(!d||this.plan(s)||!this.asset(s)||this.agreementReason(s))return false;
    d.plans.push({id:d.plans.length+1,at:s.civilization.elapsed,limit:6,cancelledAt:null});return true;
  },
  cancel(s){const p=this.plan(s);if(!p)return false;p.cancelledAt=s.civilization.elapsed;return true;},
  roadReason(s,departing=false){
    const id=this.route(s)?.corridor,r=s.civilization.regions?.routes[id];
    if(!r||r.condition!=='open')return '联络走廊封闭，等待原道路修复';
    if(departing&&CivilIncidents.holds(s,id))return '联络走廊正在等待车队归来检修，暂停新发车';
    return null;
  },
  dispatchReason(s){
    const reason=this.agreementReason(s);if(reason)return reason;
    if(!this.asset(s))return '先实付建造对外商队装备，并安排两名营建工施工';
    if(!this.plan(s))return '尚无剩余委托，可安排最多六趟';
    if(this.active(s))return '等待本趟商队返程';
    if(!this.staffed(s))return '等待两名空闲运输工；地区与客运班组优先';
    const road=this.roadReason(s,true);if(road)return road;
    if(!CivilFinance.reserveCheck(s,'home',this.paid()))return '本城须备足工具、旅费与居民供养储备';
    if(!CivilDiplomacy.reserve(s,this.sourceId(s),CivilCommerceContent.returnCargo))return '对方须先备足交换食物和自身120秒供养';
    return null;
  },
  dispatch(s){
    if(this.dispatchReason(s))return false;const d=this.data(s),at=s.civilization.elapsed,p=this.plan(s),paid=this.paid();
    CivilServices.pay(s.stores,paid);
    d.orders.push({id:d.nextId++,planId:p.id,assetId:this.asset(s).id,departedAt:at,arrivedAt:null,returnedAt:null,outboundSeconds:0,inboundSeconds:0,lastMovedAt:at,exchange:null,paid:{...paid},cargo:{...CivilCommerceContent.cargo}});return true;
  },
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastTickAt!==null&&at<=d.lastTickAt)return;
    d.lastTickAt=at;const o=this.active(s);if(!o){this.dispatch(s);return;}
    if(!this.staffed(s)||this.roadReason(s))return;
    o.lastMovedAt=at;const duration=this.route(s).duration;
    if(o.arrivedAt===null){
      o.outboundSeconds++;
      if(o.outboundSeconds===duration){
        o.arrivedAt=at;o.exchange=CivilDiplomacy.reserve(s,d.sourceId,CivilCommerceContent.returnCargo);
        if(o.exchange){
          const stores=this.source(s).stores;CivilServices.pay(stores,CivilCommerceContent.returnCargo);
          for(const [k,v]of Object.entries(o.cargo))stores[k]=(stores[k]||0)+v;
          o.cargo={...CivilCommerceContent.returnCargo};
          Civilization.notify(CivilDiplomacy.name(d.sourceId)+'收到工具12，付出食物120。食物仍随商队返程，尚未进入本城仓库。');
        }else Civilization.notify(CivilDiplomacy.name(d.sourceId)+'当前供养储备不足，未成交。工具随原车返回，旅费已经消耗。');
      }
    }else {
      o.inboundSeconds++;
      if(o.inboundSeconds===duration){for(const [k,v]of Object.entries(o.cargo))s.stores[k]=(s.stores[k]||0)+v;o.cargo={};o.returnedAt=at;Civilization.notify(o.exchange?'商队返城，食物120已进入本城原仓。':'商队返城，未成交的工具12已归还。');}
    }
  },
  status(s){
    const d=this.data(s),o=this.active(s),p=this.plan(s);if(!d)return this.agreementReason(s)||'双方可实付登记贸易，居民与仓库仍各自独立';
    const base=CivilDiplomacy.name(d.sourceId)+' · 已返城'+d.orders.filter(x=>x.returnedAt!==null).length+'趟；';
    if(o)return base+(this.roadReason(s)||(!this.staffed(s)?'等待完整运输班组':o.arrivedAt===null?'工具运出途中，尚余'+(this.route(s).duration-o.outboundSeconds)+'秒':(o.exchange?'食物':'未成交工具')+'返程，尚余'+(this.route(s).duration-o.inboundSeconds)+'秒'))+'；'+(p?'本批尚余'+(p.limit-d.orders.filter(x=>x.planId===p.id).length)+'趟未启程':'不再追加出发');
    const project=CivilServices.data(s,'home')?.project;
    if(!this.asset(s)&&project?.type==='foreigncaravan'&&project.status!=='complete')return base+'商队装备实际施工剩余'+project.remaining+'秒，请在聚落安排两名营建工';
    return base+(p?'本批尚余'+(p.limit-d.orders.filter(x=>x.planId===p.id).length)+'趟未启程；':'')+(this.dispatchReason(s)||'班组与物资就绪，等待启程');
  },
  event(id,done){
    if(id!=='foreignCommerce')return null;const s=State,d=this.data(s),buttons={},finish=(ok,text)=>done(ok?text:'条件已经变化，未执行；请核对双方供养、工程和共同法。')();
    if(!d)buttons.sign={text:'双方实付登记贸易',nextScene:'end',onChoose:()=>finish(this.sign(s),'贸易约定已登记，占用一份协调责任。双方人口与仓库保持独立。')};
    else if(!this.asset(s)){if(CivilServices.projectAvailable(s,'home')&&CivilServices.facilityGate(s,'home','foreigncaravan'))buttons.build={text:'实付筹办商队装备',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'home','foreigncaravan'),'商队材料已支付，请在聚落安排两名营建工。完工后才能出发。')};}
    else if(this.plan(s))buttons.cancel={text:'撤销尚未出发的委托',nextScene:'end',onChoose:()=>finish(this.cancel(s),'剩余委托已撤销。已出发的商队照常完成往返，旅费不退。')};
    else buttons.schedule={text:'委托最多六趟实物贸易',nextScene:'end',onChoose:()=>finish(this.schedule(s),'已登记六趟委托，每次实际发车才支付货物与旅费；条件不足时等待。')};
    buttons.close={text:'合上贸易账册',nextScene:'end',onChoose:done('双方的原仓库与在途回执继续记账。')};
    return {title:'独立聚居圈实物贸易',text:[this.status(s)+'。','登记实付：本城知识60，对方知识30。商队装备实耗木80、钢60、零件20、工具10；两名营建工施工360秒。','每趟携工具12，另付食物6、木2、工具0.1、零件0.1旅费。到达后换对方食物120，实际返程才入本城仓。对方储备不足会拒绝成交，工具运回，旅费不退。','独立装备占两名现有空闲运输工；'+(this.route(s)?'沿'+CivilRegionContent[this.route(s).corridor].name+'联络道，单程'+this.route(s).duration+'秒。':'')+'封路或缺员暂停；已出发货物保留。每批最多六趟，可撤销剩余委托，公约或国家治理中断则暂停新发车。'],buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#commerceButton').hide();$('#commerceSummary').hide();return;}
    Civilization.button('commerceButton','对外实物贸易','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='foreignCommerce';Civilization.showPending();}).show();
    let line=$('#commerceSummary');if(!line.length)line=$('<div>').attr('id','commerceSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const c=s.civilization,d=this.data(s),asset=this.asset(s),project=CivilServices.data(s,'home')?.project,construction=asset||(project?.type==='foreigncaravan'?project:null),fail=()=>{throw Error('对外贸易与在途货物记录无效');};
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=c.elapsed,nullable=x=>x===null||time(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(construction&&(!d||construction.startedAt<d.signedAt))fail();
    if(d===undefined){if(this.pendingIds.includes(c.pending)&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||d.sourceId!==c.diplomacy.sourceId||!Object.hasOwn(CivilCommerceContent.routes,d.sourceId)||!time(d.signedAt)||d.signedAt<c.diplomacy.signedAt||!same(d.signature,CivilCommerceContent.signature)||!Array.isArray(d.plans)||!Array.isArray(d.orders)||d.nextId!==d.orders.length+1||!nullable(d.lastTickAt)||d.lastTickAt!==null&&d.lastTickAt<d.signedAt)fail();
    let prior=null;
    for(const [i,p]of d.plans.entries()){
      if(!obj(p)||p.id!==i+1||!time(p.at)||p.at<d.signedAt||!asset||p.at<asset.completedAt||p.limit!==6||!nullable(p.cancelledAt)||p.cancelledAt!==null&&p.cancelledAt<p.at||prior&&p.at<prior.at)fail();
      const orders=d.orders.filter(o=>o.planId===p.id);if(orders.length>6||orders.some(o=>o.departedAt<p.at||p.cancelledAt!==null&&o.departedAt>p.cancelledAt))fail();
      if(prior&&prior.cancelledAt===null&&d.orders.filter(o=>o.planId===prior.id&&o.departedAt<=p.at).length!==6||prior?.cancelledAt!==null&&prior&&p.at<prior.cancelledAt)fail();prior=p;
    }
    prior=null;const duration=this.route(s).duration;
    for(const [i,o]of d.orders.entries()){
      if(!obj(o)||o.id!==i+1||!Number.isSafeInteger(o.planId)||o.planId<1||o.planId>d.plans.length||!asset||o.assetId!==asset.id||!time(o.departedAt)||o.departedAt<asset.completedAt||!nullable(o.arrivedAt)||!nullable(o.returnedAt)||!time(o.lastMovedAt)||o.lastMovedAt<o.departedAt||!same(o.paid,this.paid())||!obj(o.cargo)||![null,true,false].includes(o.exchange)||prior&&(prior.returnedAt===null||o.departedAt<=prior.returnedAt||o.planId<prior.planId))fail();
      if(![o.outboundSeconds,o.inboundSeconds].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=duration)||o.lastMovedAt-o.departedAt<o.outboundSeconds+o.inboundSeconds||d.lastTickAt===null||d.lastTickAt<o.lastMovedAt)fail();
      if(o.arrivedAt===null){if(o.outboundSeconds>=duration||o.inboundSeconds!==0||o.exchange!==null||o.returnedAt!==null||!same(o.cargo,CivilCommerceContent.cargo))fail();}
      else {
        if(o.arrivedAt<o.departedAt+duration||o.outboundSeconds!==duration||typeof o.exchange!=='boolean'||o.lastMovedAt<o.arrivedAt||o.lastMovedAt-o.arrivedAt<o.inboundSeconds)fail();
        if(o.returnedAt===null){if(o.inboundSeconds>=duration||!same(o.cargo,o.exchange?CivilCommerceContent.returnCargo:CivilCommerceContent.cargo))fail();}
        else if(o.returnedAt<o.arrivedAt+duration||o.inboundSeconds!==duration||o.lastMovedAt!==o.returnedAt||!same(o.cargo,{}))fail();
      }
      prior=o;
    }
  }
};
