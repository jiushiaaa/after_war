/* MPL-2.0 — Existing city inventories, one shared vehicle, and a finite exchange contract. */
var CivilIntercity={
  pendingIds:['intercityFreight'],
  data(s){return s.civilization.intercity;},
  available(s){return Number.isSafeInteger(s.civilization.nation?.foundedAt)&&!!CivilRailway.asset(s)&&!!CivilCommerce.asset(s)&&['rail','river'].every(id=>CivilMunicipal.data(s,id)?.city)&&(s.civilization.commerce?.orders.filter(o=>o.returnedAt!==null).length||0)>=2;},
  active(s){const o=this.data(s)?.orders.at(-1);return o&&o.returnedAt===null?o:null;},
  plan(s){const d=this.data(s),p=d?.plans.at(-1);return p&&p.cancelledAt===null&&d.orders.filter(o=>o.planId===p.id).length<p.limit?p:null;},
  obligation(s){return this.data(s)?1:0;},
  reservedTransport(s){return this.active(s)?2:0;},
  busy(s,id){return !!this.active(s)&&['rail','river'].includes(id);},
  exports(s,id){return this.plan(s)||this.active(s)?id==='rail'?{parts:.5}:id==='river'?{food:2.5}:{}:{};},
  staffed(s){return CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)>=2;},
  canCargo(s,id,cargo){
    const stores=s.civilization.regions.nodes[id].stores,reserve=CivilFinance.reserve(s,id),inputs=CivilMunicipal.data(s,id)?.economy?.paidInputs?.resources||{};
    return Object.entries(cargo).every(([k,n])=>(stores[k]||0)+1e-8>=n+Math.max(reserve[k]||0,(inputs[k]||0)*12));
  },
  reason(s){
    if(!this.available(s))return '请先完成三城建国、建成铁轨转运站并跑完两趟对外贸易';
    if(!CivilNation.operational(s)||!CivilFinance.political(s))return '请先恢复国家共同法与现任行政运转';
    if(!['rail','river'].every(id=>['associated','integrated'].includes(s.civilization.regions.nodes[id].relation)))return '等待铁轨镇与河谷恢复共同约定';
    if(!this.data(s)&&CivilRegions.load(s)+1>CivilSociety.capacity(s)+(s.civilization.regions.archiveOnline||0)*2)return '请先扩建并维系行政档案馆，为换届磨合期留出一份基础协调余量';
    if(CivilRegions.load(s)+(this.data(s)?0:1)>CivilRegions.capacity(s))return '等待腾出一份空闲的协调容量';
    return null;
  },
  sign(s){
    const cost=CivilIntercityContent.signature;if(this.data(s)||this.reason(s)||Object.entries(cost).some(([id,c])=>!CivilFinance.reserveCheck(s,id,c)))return false;
    for(const [id,c]of Object.entries(cost))CivilRegions.debit(CivilFinance.stores(s,id),c);
    s.civilization.intercity={schema:1,agreedAt:s.civilization.elapsed,signature:JSON.parse(JSON.stringify(cost)),plans:[],orders:[],nextId:1,lastTickAt:null};return true;
  },
  schedule(s){const d=this.data(s);if(!d||this.plan(s)||this.reason(s))return false;d.plans.push({id:d.plans.length+1,at:s.civilization.elapsed,limit:CivilIntercityContent.limit,cancelledAt:null});return true;},
  cancel(s){const p=this.plan(s);if(!p)return false;p.cancelledAt=s.civilization.elapsed;return true;},
  roadReason(s,departing=false){
    for(const id of ['rail','river']){if(s.civilization.regions.routes[id].condition!=='open')return '城际道路已封闭，在途货物滞留待修';if(departing&&CivilIncidents.holds(s,id))return '道路正候空车归来后检修，暂停发运新车';}return null;
  },
  dispatchReason(s){
    const reason=this.reason(s);if(reason)return reason;
    if(!this.plan(s))return '暂无待发委托，最多可排入三趟';
    if(this.active(s)||CivilCommerce.active(s)||CivilCommerce.plan(s)||CivilFrontier.active(s))return '请先等原商车归城，并撤销尚未发车的外贸委托';
    if(typeof CivilPartnership!=='undefined'&&CivilPartnership.active(s))return '原商车正在跑地区商约，请候其归城';
    if(!this.staffed(s))return '等待两名空闲的运输工';
    const road=this.roadReason(s,true);if(road)return road;
    if(!CivilFinance.reserveCheck(s,'home',CivilIntercityContent.travelCost))return '本城须备齐沿途旅费，并留足居民保底口粮';
    if(!this.canCargo(s,'rail',CivilIntercityContent.cargo)||!this.canCargo(s,'river',CivilIntercityContent.returnCargo))return '铁轨镇与河谷均须先备齐交换货品并留足自家保底储备';return null;
  },
  dispatch(s){
    if(this.dispatchReason(s))return false;const d=this.data(s),at=s.civilization.elapsed;
    CivilRegions.debit(s.stores,CivilIntercityContent.travelCost);
    d.orders.push({id:d.nextId++,planId:this.plan(s).id,assetId:CivilCommerce.asset(s).id,departedAt:at,pickedAt:null,exchangedAt:null,deliveredAt:null,refundedAt:null,returnedAt:null,withdrawal:null,phase:'outbound',outboundSeconds:0,marketSeconds:0,inboundSeconds:0,homeSeconds:0,lastTickAt:at,paid:{...CivilIntercityContent.travelCost},cargo:{}});return true;
  },
  withdraw(s){
    const o=this.active(s);if(!o||o.withdrawal||o.exchangedAt!==null)return false;
    const source=o.pickedAt===null; o.withdrawal={at:s.civilization.elapsed,from:source?'outbound':'market',after:source?o.outboundSeconds:o.marketSeconds};o.phase=source?'home':'refund';return true;
  },
  duration(o,phase=o.phase){return phase==='outbound'?90:phase==='market'||phase==='source'?150:phase==='refund'?o.withdrawal.after:phase==='home'?(o.withdrawal?.from==='outbound'?o.withdrawal.after:90):0;},
  progress(o){return ({outbound:o.outboundSeconds,market:o.marketSeconds,source:o.inboundSeconds,refund:o.inboundSeconds,home:o.homeSeconds})[o.phase]||0;},
  finish(s,o){o.phase='returned';o.returnedAt=s.civilization.elapsed;Civilization.notify('城际联运商车已空返归城，随车司机重新待命；两地货品已按实际交割或退货记录入账。');},
  tick(s){
    const d=this.data(s),at=s.civilization.elapsed;if(!d||d.lastTickAt!==null&&d.lastTickAt>=at)return;d.lastTickAt=at;
    let o=this.active(s);if(!o){this.dispatch(s);return;}if(o.lastTickAt>=at)return;o.lastTickAt=at;
    if(o.phase==='home'&&this.duration(o)===0){this.finish(s,o);return;}
    if(!this.staffed(s)||this.roadReason(s))return;
    const rail=s.civilization.regions.nodes.rail,river=s.civilization.regions.nodes.river;
    if(o.phase==='outbound'){if(++o.outboundSeconds===90)o.phase='pickup';}
    else if(o.phase==='pickup'){
      if(!this.canCargo(s,'rail',CivilIntercityContent.cargo))return;
      CivilRegions.debit(rail.stores,CivilIntercityContent.cargo);o.cargo={...CivilIntercityContent.cargo};o.pickedAt=at;o.phase='market';
    }else if(o.phase==='market'){if(++o.marketSeconds===150)o.phase='exchange';}
    else if(o.phase==='exchange'){
      if(!this.canCargo(s,'river',CivilIntercityContent.returnCargo))return;
      CivilRegions.debit(river.stores,CivilIntercityContent.returnCargo);CivilRegions.credit(river.stores,o.cargo);o.cargo={...CivilIntercityContent.returnCargo};o.exchangedAt=at;o.phase='source';
    }else if(o.phase==='source'||o.phase==='refund'){
      if(o.inboundSeconds<this.duration(o))o.inboundSeconds++;
      if(o.inboundSeconds===this.duration(o)){CivilRegions.credit(rail.stores,o.cargo);o.cargo={};if(o.phase==='refund')o.refundedAt=at;else o.deliveredAt=at;o.phase='home';}
    }else if(o.phase==='home'){if(++o.homeSeconds===this.duration(o))this.finish(s,o);}
  },
  status(s){
    const o=this.active(s);if(!this.data(s))return this.reason(s)||'铁轨镇拿零件换河谷粮食，三方可支取知识立约';
    if(!o)return this.dispatchReason(s)||'原商车与两地货品均已备妥，候命发车';
    return (this.roadReason(s)||(!this.staffed(s)?'等待两名司机':({outbound:'空车赴铁轨',pickup:'在铁轨镇候装24零件',market:'载24零件赴河谷',exchange:'在河谷候换120粮',source:'载120粮回铁轨',refund:'原零件退回铁轨',home:'空车回本城'})[o.phase]+(this.duration(o)?' · '+this.progress(o)+' / '+this.duration(o)+'秒':'')))+'；随车装载 '+CivilHistory.costText(o.cargo);
  },
  event(id,done){
    if(id!=='intercityFreight')return null;const s=State,d=this.data(s),o=this.active(s),buttons={},finish=(ok,text)=>done(ok?text:'条件已有变动，本次未执行；库内物资与既有运单照旧保留。')();
    if(!d)buttons.sign={text:'三方实付联运议约',nextScene:'end',onChoose:()=>finish(this.sign(s),'本城与两地已各自支取立约知识，城际联运占用一份协调容量。')};
    else if(this.plan(s))buttons.cancel={text:'撤销后续联运',nextScene:'end',onChoose:()=>finish(this.cancel(s),'尚未发车的联运委托已撤销，已在途的商车仍按原单跑完。')};
    else buttons.schedule={text:'委托最多三趟联运',nextScene:'end',onChoose:()=>finish(this.schedule(s),'已排入最多三趟联运委托，每趟实际发车时才支取旅费。')};
    if(o&&o.exchangedAt===null&&!o.withdrawal)buttons.withdraw={text:'未成交原货退回',nextScene:'end',onChoose:()=>finish(this.withdraw(s),'商车按已走路程折返；零件运抵铁轨镇后方退回原仓，已耗旅费不退。')};
    buttons.close={text:'合上联运账册',nextScene:'end',onChoose:done('两地公仓与在途货单继续各自记账。')};
    const text=[this.status(s)];
    if(!d)text.push('立约需支取：本城知识60、铁轨镇30、河谷30，并占用1份协调容量。前提是国家共同法正常运转，且已建成地方城市与铁轨转运站；同时，由基础行政与正常供养的行政档案馆撑起的协调上限须留有余量，以免换届磨合时超额停摆。');
    text.push('铁轨镇出24零件，换取河谷120粮食；全程占用本城原商车与两名司机，与对外贸易及渡口行动无法同时发车。每跑一趟由本城支取旅费：粮8、木2、工具0.2、零件0.1。','空车赴铁轨镇90秒，装零件赴河谷150秒，载粮回铁轨镇150秒，最后空车归城90秒；遇封路候修耗时另计，公路商车不享受铁路列车班次的速度。');
    if(d)text.push('铁轨镇现存零件 '+Number((s.civilization.regions.nodes.rail.stores.parts||0).toFixed(2))+'；河谷现存粮食 '+Number((s.civilization.regions.nodes.river.stores.food||0).toFixed(2))+'。两地均须先留足120秒供养及日常维护底线；缺货时商车就地候装，未交割前可召回退货，一旦交割则继续送抵铁轨镇。累计已跑完归城 '+d.orders.filter(x=>x.returnedAt!==null).length+' 趟。');
    return {title:'铁轨—河谷城际联运',text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#intercityButton,#intercitySummary').hide();return;}
    Civilization.button('intercityButton','铁轨—河谷城际联运','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='intercityFreight';Civilization.showPending();}).show();
    let line=$('#intercitySummary');if(!line.length)line=$('<div>').attr('id','intercitySummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const d=this.data(s),t=s.civilization.elapsed,fail=()=>{throw Error('城际联运、地方货物或原车记录无效');},obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=t,nullable=x=>x===null||time(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(d===undefined){if(s.civilization.pending==='intercityFreight'&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||!time(d.agreedAt)||d.agreedAt<s.civilization.nation.foundedAt||d.agreedAt<CivilRailway.asset(s).completedAt||!same(d.signature,CivilIntercityContent.signature)||!Array.isArray(d.plans)||!Array.isArray(d.orders)||d.nextId!==d.orders.length+1||!nullable(d.lastTickAt)||d.lastTickAt!==null&&d.lastTickAt<d.agreedAt)fail();
    const returns=s.civilization.commerce.orders.filter(o=>o.returnedAt!==null&&o.returnedAt<=d.agreedAt);if(returns.length<2)fail();
    let previous=null;
    for(const [i,p]of d.plans.entries()){
      if(!obj(p)||p.id!==i+1||!time(p.at)||p.at<d.agreedAt||p.limit!==3||!nullable(p.cancelledAt)||p.cancelledAt!==null&&p.cancelledAt<p.at||previous&&p.at<previous.at)fail();
      const orders=d.orders.filter(o=>o.planId===p.id);if(orders.length>3||orders.some(o=>o.departedAt<p.at||p.cancelledAt!==null&&o.departedAt>p.cancelledAt))fail();
      if(previous&&(previous.cancelledAt===null?d.orders.filter(o=>o.planId===previous.id&&o.departedAt<=p.at).length!==3:p.at<previous.cancelledAt))fail();previous=p;
    }
    previous=null;
    for(const [i,o]of d.orders.entries()){
      if(!obj(o)||o.id!==i+1||!Number.isSafeInteger(o.planId)||o.planId<1||o.planId>d.plans.length||o.assetId!==CivilCommerce.asset(s).id||!time(o.departedAt)||o.departedAt<CivilCommerce.asset(s).completedAt||!time(o.lastTickAt)||o.lastTickAt<o.departedAt||d.lastTickAt!==null&&o.lastTickAt>d.lastTickAt||!same(o.paid,CivilIntercityContent.travelCost)||!obj(o.cargo)||!['outbound','pickup','market','exchange','source','refund','home','returned'].includes(o.phase)||previous&&(previous.returnedAt===null||o.departedAt<=previous.returnedAt||o.planId<previous.planId))fail();
      for(const k of ['pickedAt','exchangedAt','deliveredAt','refundedAt','returnedAt'])if(!nullable(o[k])||o[k]!==null&&(o[k]<o.departedAt||o[k]>o.lastTickAt))fail();
      for(const [k,max]of [['outboundSeconds',90],['marketSeconds',150],['inboundSeconds',150],['homeSeconds',90]])if(!Number.isSafeInteger(o[k])||o[k]<0||o[k]>max)fail();
      if(o.lastTickAt-o.departedAt<o.outboundSeconds+o.marketSeconds+o.inboundSeconds+o.homeSeconds)fail();
      const w=o.withdrawal;if(w!==null&&(!obj(w)||!time(w.at)||w.at<o.departedAt||w.at>o.lastTickAt||!['outbound','market'].includes(w.from)||!Number.isSafeInteger(w.after)||w.after<0||w.after!==(w.from==='outbound'?o.outboundSeconds:o.marketSeconds)||o.exchangedAt!==null||w.from==='outbound'&&o.pickedAt!==null||w.from==='market'&&(o.pickedAt===null||w.at<o.pickedAt)))fail();
      if(o.pickedAt!==null&&(o.outboundSeconds!==90||o.pickedAt<o.departedAt+90)||o.pickedAt===null&&(o.marketSeconds||o.inboundSeconds||o.exchangedAt!==null||o.deliveredAt!==null||o.refundedAt!==null))fail();
      if(o.exchangedAt!==null&&(o.pickedAt===null||o.marketSeconds!==150||o.exchangedAt<o.pickedAt+150)||o.deliveredAt!==null&&(o.exchangedAt===null||o.inboundSeconds!==150||o.deliveredAt<o.exchangedAt+150))fail();
      if(o.refundedAt!==null&&(!w||w.from!=='market'||o.inboundSeconds!==w.after||o.refundedAt<w.at+w.after))fail();
      const returning=o.deliveredAt!==null||o.refundedAt!==null||w?.from==='outbound',homeStart=o.deliveredAt??o.refundedAt??w?.at,homeDuration=w?.from==='outbound'?w.after:90;
      if(o.homeSeconds&&(!returning||o.lastTickAt<homeStart+o.homeSeconds)||o.homeSeconds>homeDuration||o.returnedAt!==null&&(!returning||o.phase!=='returned'||o.homeSeconds!==homeDuration||o.returnedAt<homeStart+homeDuration))fail();
      const phase=o.phase;
      if(o.exchangedAt===null&&!w&&o.inboundSeconds||o.refundedAt!==null&&o.deliveredAt!==null||w&&o.deliveredAt!==null)fail();
      if(o.pickedAt!==null&&o.pickedAt<o.departedAt+91||o.exchangedAt!==null&&o.exchangedAt<o.pickedAt+151)fail();
      if(o.exchangedAt!==null&&o.lastTickAt<o.exchangedAt+o.inboundSeconds||w?.from==='market'&&o.lastTickAt<w.at+o.inboundSeconds)fail();
      if(o.deliveredAt!==null&&!['home','returned'].includes(phase)||o.refundedAt!==null&&!['home','returned'].includes(phase)||w?.from==='outbound'&&!['home','returned'].includes(phase))fail();
      if(phase==='outbound'&&(o.outboundSeconds>=90||o.pickedAt!==null||w)||phase==='pickup'&&(o.outboundSeconds!==90||o.pickedAt!==null||w)||['market','exchange'].includes(phase)&&(o.pickedAt===null||o.exchangedAt!==null||w||(phase==='market'?o.marketSeconds>=150:o.marketSeconds!==150))||phase==='source'&&(o.exchangedAt===null||o.deliveredAt!==null||o.inboundSeconds>=150||w)||phase==='refund'&&(!w||w.from!=='market'||o.refundedAt!==null||o.inboundSeconds>w.after)||phase==='home'&&(!returning||o.homeSeconds>=homeDuration&&homeDuration!==0)||phase==='returned'&&o.returnedAt===null||phase!=='returned'&&o.returnedAt!==null)fail();
      const cargo=['market','exchange','refund'].includes(phase)?CivilIntercityContent.cargo:phase==='source'?CivilIntercityContent.returnCargo:{};if(!same(o.cargo,cargo))fail();
      const overlaps=x=>x.departedAt<(o.returnedAt??Infinity)&&o.departedAt<(x.returnedAt??Infinity);
      if(s.civilization.commerce.orders.some(overlaps)||(s.civilization.frontier?.missions||[]).some(overlaps))fail();previous=o;
    }
  }
};
