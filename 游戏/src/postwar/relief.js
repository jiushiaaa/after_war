/* MPL-2.0 — Finite paid relief orders; Regions owns the original vehicle and travel. */
var CivilRelief={
  data(s){return s.civilization.relief;},
  pack(cap){return cap===128?{food:112,tools:12,coal:4}:{food:56,tools:6,coal:2};},
  active(s,id){return this.data(s)?.orders.find(o=>o.target===id&&!['complete','cancelled'].includes(o.status));},
  eligible(s,id){return CivilMunicipal.has(s,id)&&['associated','integrated'].includes(s.civilization.regions.nodes[id]?.relation);},
  request(s,id){
    const r=s.civilization.regions,route=r?.routes[id];if(!route||!this.eligible(s,id)||this.active(s,id))return false;
    const d=this.data(s)||(s.civilization.relief={schema:1,introducedAt:s.civilization.elapsed,nextId:1,orders:[]});
    d.orders.push({id:d.nextId++,target:id,requestedAt:s.civilization.elapsed,requestedCapacity:route.capacity,cargo:this.pack(route.capacity),status:'queued',shipmentId:null,dispatchedAt:null,dispatchCapacity:null,travel:null,preservationAtDispatch:null,paid:null,deliveredAt:null,returnedAt:null,cancelledAt:null,turnedAfter:null,refundAt:null});return true;
  },
  cancel(s,id){const o=this.data(s)?.orders.find(o=>o.id===id);if(o?.status!=='queued')return false;o.status='cancelled';o.cancelledAt=s.civilization.elapsed;return true;},
  launch(s,id){
    const o=this.active(s,id),r=s.civilization.regions,route=r.routes[id];
    if(!r.active||o?.status!=='queued'||!this.eligible(s,id)||!route.enabled||route.condition!=='open'||CivilRegions.routeBusy(s,id)||!CivilRegions.staffedRoutes(s).has(id)||!['trade',undefined].includes(route.lastPurpose)||typeof CivilIncidents!=='undefined'&&CivilIncidents.holds(s,id))return false;
    if(Object.values(o.cargo).reduce((a,b)=>a+b,0)>route.capacity)return false;
    const cost=CivilRegions.dispatchCost(s,id,o.cargo);if(!CivilFinance.reserveCheck(s,'home',cost)){route.status='救济等待主城物资与居民储备';return false;}
    CivilRegions.debit(s.stores,cost);const t=s.civilization.elapsed;
    const p={id:r.nextShipment++,route:id,source:'home',target:id,cargo:{...o.cargo},capacity:route.capacity,remaining:route.travel,phase:'outbound',status:'moving',purpose:'relief',reliefOrderId:o.id,legStartedAt:t,legDuration:route.travel};
    Object.assign(o,{status:'outbound',shipmentId:p.id,dispatchedAt:t,dispatchCapacity:route.capacity,travel:route.travel,preservationAtDispatch:!!s.civilization.tech.preservation,paid:{...cost}});r.shipments.push(p);route.lastPurpose='relief';route.status='救济物资在途';return true;
  },
  order(s,p){return this.data(s)?.orders.find(o=>o.id===p?.reliefOrderId&&o.shipmentId===p.id);},
  same(a,b){return a&&b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>b[k]===v);},
  validShipment(s,p){
    const o=this.order(s,p),t=s.civilization.elapsed;if(!o||p.purpose!=='relief'||p.route!==o.target||p.capacity!==o.dispatchCapacity||!['moving','held'].includes(p.status)||!Number.isSafeInteger(p.legStartedAt)||!Number.isSafeInteger(p.legDuration)||p.legStartedAt>t||p.legDuration<1||p.legDuration>o.travel||!Number.isSafeInteger(p.remaining)||p.remaining<0||p.remaining>p.legDuration||p.legDuration-p.remaining>t-p.legStartedAt)return false;
    if(o.status==='outbound')return p.phase==='outbound'&&p.source==='home'&&p.target===o.target&&this.same(p.cargo,o.cargo)&&p.legStartedAt===o.dispatchedAt&&p.legDuration===o.travel;
    if(o.status==='empty')return p.phase==='empty'&&p.source===o.target&&p.target==='home'&&Object.keys(p.cargo).length===0&&p.legStartedAt===o.deliveredAt&&p.legDuration===o.travel;
    if(o.status==='returning')return p.phase==='returning'&&p.source==='home'&&p.target==='home'&&this.same(p.cargo,o.cargo)&&p.legStartedAt===o.cancelledAt&&p.legDuration===Math.max(1,o.turnedAfter)&&o.turnedAfter<=o.cancelledAt-o.dispatchedAt;
    return false;
  },
  original(s,p){return s.civilization.regions.shipments.includes(p)&&this.validShipment(s,p);},
  requestReturn(s,id){
    const o=this.data(s)?.orders.find(o=>o.id===id),r=s.civilization.regions,p=r.shipments.find(p=>p.id===o?.shipmentId);
    if(o?.status!=='outbound'||!p||!this.original(s,p))return false;
    const duration=Math.max(1,p.legDuration-p.remaining),t=s.civilization.elapsed;
    o.status='returning';o.cancelledAt=t;o.turnedAfter=p.legDuration-p.remaining;Object.assign(p,{phase:'returning',target:'home',remaining:duration,legStartedAt:t,legDuration:duration});p.status=r.routes[p.route].condition==='open'?'moving':'held';return true;
  },
  arrive(s,p){
    if(!this.original(s,p)||p.status!=='moving'||p.remaining!==0||s.civilization.elapsed-p.legStartedAt<p.legDuration)return false;
    const o=this.order(s,p),r=s.civilization.regions,route=r.routes[p.route],t=s.civilization.elapsed;if(route.condition!=='open')return false;
    if(o.status==='outbound'){
      if(!this.eligible(s,o.target)){p.status='held';route.status='救济等待接收许可，可原车退回';return false;}
      CivilRegions.credit(r.nodes[o.target].stores,o.cargo);o.status='empty';o.deliveredAt=t;route.lastSupplyAt=t;
      Object.assign(p,{phase:'empty',source:o.target,target:'home',cargo:{},remaining:o.travel,legStartedAt:t,legDuration:o.travel});route.status='救济已交付，原车空返';return true;
    }
    if(o.status==='returning'){CivilRegions.credit(s.stores,o.cargo);o.status='cancelled';o.refundAt=t;}else if(o.status==='empty')o.status='complete';else return false;
    o.returnedAt=t;r.shipments=r.shipments.filter(x=>x!==p);route.dispatchIn=10;route.status=route.enabled?'等待下一趟':'已暂停';if(!route.enabled)route.assigned=0;return true;
  },
  status(s,id){const o=this.active(s,id);return o?({queued:'救济已排队，等待原车与物资',outbound:'救济物资在途',empty:'救济已入地方仓，原车空返',returning:'未交付救济原车返仓'})[o.status]:'当前没有救济申请';},
  validate(s){
    const d=this.data(s),r=s.civilization.regions,t=s.civilization.elapsed,ships=r?.shipments||[],fail=()=>{throw Error('救济运单或货物记录无效');},int=x=>Number.isSafeInteger(x)&&x>=0&&x<=t,obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
    if(d===undefined){if(ships.some(p=>p.purpose==='relief'||p.reliefOrderId!==undefined)||Object.values(r?.routes||{}).some(p=>p.lastPurpose==='relief'))fail();return;}
    if(!obj(d)||d.schema!==1||!int(d.introducedAt)||!Array.isArray(d.orders)||d.nextId!==d.orders.length+1)fail();const active=new Set(),shipIds=new Set();
    for(const [i,o]of d.orders.entries()){
      if(!obj(o)||o.id!==i+1||!r.nodes[o.target]||!int(o.requestedAt)||o.requestedAt<d.introducedAt||![64,128].includes(o.requestedCapacity)||!this.same(o.cargo,this.pack(o.requestedCapacity))||!['queued','outbound','empty','returning','complete','cancelled'].includes(o.status))fail();
      if(!['complete','cancelled'].includes(o.status)){if(active.has(o.target))fail();active.add(o.target);}
      for(const key of ['dispatchedAt','deliveredAt','returnedAt','cancelledAt','refundAt'])if(o[key]!==null&&(!int(o[key])||o[key]<o.requestedAt))fail();
      const p=ships.filter(p=>p.purpose==='relief'&&p.reliefOrderId===o.id);
      if(o.dispatchedAt===null){if(!['queued','cancelled'].includes(o.status)||['shipmentId','dispatchCapacity','travel','preservationAtDispatch','paid','deliveredAt','returnedAt','turnedAfter','refundAt'].some(k=>o[k]!==null)||p.length||((o.status==='cancelled')!==(o.cancelledAt!==null)))fail();continue;}
      if(o.status==='queued'||!Number.isSafeInteger(o.shipmentId)||o.shipmentId<1||o.shipmentId>=r.nextShipment||![64,128].includes(o.dispatchCapacity)||o.dispatchCapacity<o.requestedCapacity||o.travel!==(typeof CivilRailway!=='undefined'?CivilRailway.travelAt(s,o.target,o.dispatchedAt):CivilRegionContent[o.target].travel)||!obj(o.paid))fail();
      if(shipIds.has(o.shipmentId)||o.dispatchCapacity>r.routes[o.target].capacity||typeof o.preservationAtDispatch!=='boolean'||o.preservationAtDispatch&&!s.civilization.tech.preservation)fail();shipIds.add(o.shipmentId);
      const expected={...o.cargo,food:o.cargo.food+(o.preservationAtDispatch?1:2),wood:1,...(o.dispatchCapacity===128?{parts:.05}:{})};
      if(typeof CivilRailway!=='undefined')for(const [k,n]of Object.entries(CivilRailway.extraAt(s,o.target,o.dispatchedAt)))expected[k]=(expected[k]||0)+n;
      if(![1,2].includes(o.paid.food-o.cargo.food)||!this.same(o.paid,expected))fail();
      if(['returning','cancelled'].includes(o.status)){if(!Number.isSafeInteger(o.turnedAfter)||o.turnedAfter<0||o.turnedAfter>o.travel||o.turnedAfter>o.cancelledAt-o.dispatchedAt||o.returnedAt!==null&&o.returnedAt<o.cancelledAt+Math.max(1,o.turnedAfter))fail();}else if(o.turnedAfter!==null)fail();
      if(o.deliveredAt!==null&&o.deliveredAt<o.dispatchedAt+o.travel||o.returnedAt!==null&&o.returnedAt<o.dispatchedAt+1)fail();
      if(o.status==='outbound'&&['deliveredAt','returnedAt','cancelledAt','refundAt'].some(k=>o[k]!==null)||o.status==='empty'&&(o.deliveredAt===null||['returnedAt','cancelledAt','refundAt'].some(k=>o[k]!==null))||o.status==='complete'&&(o.deliveredAt===null||o.returnedAt===null||o.returnedAt<o.deliveredAt+o.travel||o.cancelledAt!==null||o.refundAt!==null)||o.status==='returning'&&(o.cancelledAt===null||o.deliveredAt!==null||o.returnedAt!==null||o.refundAt!==null)||o.status==='cancelled'&&(o.cancelledAt===null||o.deliveredAt!==null||o.refundAt!==o.returnedAt||o.returnedAt===null||o.returnedAt<o.cancelledAt+1))fail();
      if(['complete','cancelled'].includes(o.status)){if(p.length)fail();}else if(p.length!==1||!this.validShipment(s,p[0]))fail();
    }
    for(const p of ships)if(p.purpose==='relief'?!this.validShipment(s,p):p.reliefOrderId!==undefined)fail();
    for(const [id,route]of Object.entries(r.routes))if(route.lastPurpose==='relief'&&!d.orders.some(o=>o.target===id&&o.dispatchedAt!==null))fail();
  }
};
