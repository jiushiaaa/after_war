/* MPL-2.0 — Derive passenger assets from paid public projects, never duplicate people or warehouses. */
var CivilPassenger={
  evidence(s){
    const c=s.civilization;
    return !!c.tech.passenger_transport||c.research?.id==='passenger_transport'||Object.values(c.services?.nodes||{}).some(m=>(m.buildings?.passengerfleet||0)>0||m.project?.type==='passengerfleet'||m.completed?.some(p=>p.type==='passengerfleet'))||
      (c.urban?.parties||[]).some(p=>p.transport!==undefined)||Object.values(c.origins?.nodes||{}).some(n=>Object.values(n.departures||{}).some(d=>d.transport!==undefined));
  },
  init(s){
    if(s.civilization.passenger!==undefined)return;
    if(this.evidence(s))throw Error('客运记录缺少接入边界');
    s.civilization.passenger={schema:1,introducedAt:s.civilization.elapsed,legacyBeforePartyId:s.civilization.urban.nextParty,preference:'auto',lastDepartureAt:null,legacyReadyAt:s.civilization.elapsed+s.civilization.urban.dispatchClock};
  },
  legacyParty(s,id){const p=s.civilization.passenger;return Number.isInteger(id)&&id>0&&(p===undefined?!this.evidence(s):p?.schema===1&&id<p.legacyBeforePartyId);},
  assets(s){
    const m=typeof CivilServices!=='undefined'?CivilServices.data(s,'home'):null;
    const cost=typeof CivilServiceContent!=='undefined'?CivilServiceContent.facilities.passengerfleet?.cost:null,t=s.civilization.elapsed;
    return (m?.completed||[]).filter(x=>x.type==='passengerfleet'&&cost&&Number.isInteger(x.id)&&x.id>0&&x.workedSeconds===360&&Number.isFinite(x.startedAt)&&x.startedAt>=0&&x.lastWorkedAt===x.completedAt&&x.completedAt>=x.startedAt+360&&x.completedAt<=t&&x.paid&&Object.keys(x.paid).length===Object.keys(cost).length&&Object.entries(cost).every(([k,n])=>x.paid[k]===n)).map(x=>({id:'service_project_'+x.id,completedAt:x.completedAt,project:x}));
  },
  availableAsset(s){const busy=new Set((s.civilization.urban?.parties||[]).map(p=>p.transport?.assetId).filter(Boolean));return this.assets(s).find(a=>!busy.has(a.id))||null;},
  cost(profile,initial){const p=CivilPassengerContent.profiles[profile];if(!p)throw Error('客运规格无效');return {food:initial*6,medicine:initial*.2,tools:initial*.2+p.maintenance.tools,wood:p.maintenance.wood,parts:p.maintenance.parts};},
  profile(s,party){return party.transport||{profile:'road8',capacity:8,crew:2,assetId:null};},
  capacityFor(s,record){
    if(record.mode==='singleton')return 1;
    if(record.transport)return record.transport.capacity;
    if(record.transport===undefined&&this.legacyParty(s,record.partyId??record.id))return 8;
    throw Error('新批次缺少出发运力记录');
  },
  actualWorkers(s){
    const w=s.game.workers,others=Object.entries(w).filter(([id])=>id!=='transporter').reduce((sum,[,n])=>sum+n,0);
    return Math.max(0,Math.min(w.transporter||0,CivilCatalog.jobCapacity(s,'transporter'),CivilPopulation.workforce(s.civilization.society.cohorts)-others));
  },
  staffedParties(s){
    let left=this.actualWorkers(s);const result=new Set();
    for(const p of [...(s.civilization.urban?.parties||[])].sort((a,b)=>a.id-b.id)){const crew=this.profile(s,p).crew;if(left>=crew)result.add(p.id);left=Math.max(0,left-crew);}
    return result;
  },
  availableWorkers(s){return Math.max(0,this.actualWorkers(s)-CivilUrban.reservedTransport(s)-(typeof CivilRegions!=='undefined'?CivilRegions.reservedTransport(s):0));},
  validateTransport(s,tr,partyId,sourceId){
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),c=s.civilization;
    if(tr===undefined){if(this.legacyParty(s,partyId))return true;throw Error('新批次缺少出发运力记录');}
    if(!obj(tr)||tr.schema!==1||!Object.hasOwn(CivilPassengerContent.profiles,tr.profile))throw Error('客运出发快照无效');
    const d=CivilPassengerContent.profiles[tr.profile],p=c.passenger;
    if(!p||partyId<p.legacyBeforePartyId||tr.capacity!==d.capacity||tr.crew!==d.crew||!Number.isInteger(tr.initial)||tr.initial<(tr.profile==='road24'?9:1)||tr.initial>d.capacity||!Number.isFinite(tr.departedAt)||tr.departedAt<p.legacyReadyAt||tr.departedAt>c.elapsed||!obj(tr.paid))throw Error('客运人数、时间或班组无效');
    const cost=this.cost(tr.profile,tr.initial);if(Object.keys(tr.paid).length!==Object.keys(cost).length||Object.entries(cost).some(([k,n])=>tr.paid[k]!==n))throw Error('客运实付旅费无效');
    if(tr.profile==='road8'){if(tr.assetId!==null)throw Error('小队不能占用扩容装备');}
    else {
      const asset=this.assets(s).find(a=>a.id===tr.assetId);
      if(!c.tech.passenger_transport||!asset||asset.completedAt>tr.departedAt)throw Error('迁居装备未在出发前建成');
    }
    return true;
  },
  canDepart(s,tr,partyId,sourceId){
    try{this.validateTransport(s,tr,partyId,sourceId);}catch(_){return false;}
    const u=s.civilization.urban;
    if(!tr||s.civilization.elapsed<s.civilization.passenger.legacyReadyAt||partyId!==u.nextParty||tr.departedAt!==s.civilization.elapsed||u.parties.length>=2||s.civilization.passenger.lastDepartureAt!==null&&s.civilization.elapsed-s.civilization.passenger.lastDepartureAt<120||this.availableWorkers(s)<tr.crew)return false;
    return tr.profile==='road8'||this.assets(s).some(a=>a.id===tr.assetId)&&!u.parties.some(p=>p.transport?.assetId===tr.assetId);
  },
  quote(s,{source=CivilUrban.sourceId(s),target=CivilUrban.targetId(s),preference=s.civilization.passenger?.preference||'auto'}={}){
    const u=CivilUrban,c=s.civilization,x=c.urban;
    const fail=reason=>({reason}),meta=c.passenger;
    if(!meta||c.elapsed<meta.legacyReadyAt||meta.lastDepartureAt!==null&&c.elapsed-meta.lastDepartureAt<120)return fail('等待下一批次启程');
    if(!s.game.buildings.cartdepot||!c.tech.logistics)return fail('接纳需要车队场与运输组织');
    if(x.parties.length>=2||this.availableWorkers(s)<2)return fail('等待完整运输班组与返程车队');
    if(!u.canAcceptTarget(s,target))return fail('目的地尚未同意接纳安排');
    if(!u.roadOpen(s,target))return fail(u.targetName(s,target)+'的接纳道路中断或待维护');
    const beds=u.availableBeds(s,target);if(!beds)return fail(u.targetName(s,target)+'等待空余床位');
    const asset=this.availableAsset(s),large=preference==='auto'&&!!c.tech.passenger_transport&&!!asset&&this.availableWorkers(s)>=4;
    let reason='来源暂不能安排这批迁居',largeReason=!asset?'扩容装备正忙或尚未建成':this.availableWorkers(s)<4?'尚缺四名空闲运输工':'目的地或来源仅能接纳小家庭';
    const profiles=large?['road24','road8']:['road8'];
    for(const profile of profiles){
      const d=CivilPassengerContent.profiles[profile];
      for(let wanted=Math.min(d.capacity,beds);wanted>=(profile==='road24'?9:1);wanted--){
        const q=u.quote(s,source,wanted,'convoy',d.capacity);
        if(!q){reason=source==='dispersed'?'登记的居民已全部安置':CivilOrigins.quoteReason(s,source,wanted,{mode:'convoy',capacity:d.capacity})||reason;continue;}
        if(q.count>wanted||q.count<(profile==='road24'?9:1))continue;
        const cost=this.cost(profile,q.count),all=[...u.waiting(s,target),...q.cohorts],home=target==='home'?all:u.waiting(s);
        if(!CivilRules.canPay(s,cost)){reason=profile==='road24'?'大队旅费或装备维护尚未备足':'待备旅费：每人6粮、0.2药品、0.2工具';continue;}
        if((s.stores.food||0)-cost.food+1e-8<u.foodReserve(s,home)){reason='本地支付旅费后须留下120秒居民口粮';continue;}
        if(target!=='home'&&(c.regions.nodes[target].stores.food||0)+1e-8<CivilMunicipal.foodReserve(s,target,all)){reason=u.targetName(s,target)+'须自行留下安置后120秒口粮';continue;}
        const paid=JSON.parse(JSON.stringify(s));
        for(const [key,n]of Object.entries(cost))if(n)paid.stores[key]=Math.max(0,(paid.stores[key]||0)-n);
        // Travelling adults cannot produce materials or staff home before they arrive.
        const existing=u.serviceCheck(paid,[]);if(existing){reason='支付旅费后本地'+existing;continue;}
        const services=target==='home'?u.serviceCheck(paid,all):CivilMunicipal.serviceCheck(s,target,all);if(services){reason=services;continue;}
        const transport={schema:1,profile,capacity:d.capacity,crew:d.crew,assetId:profile==='road24'?asset.id:null,departedAt:c.elapsed,initial:q.count,paid:cost};
        return {sourceQuote:q,transport,cost,fallback:profile==='road8'&&preference==='auto'&&this.assets(s).length?largeReason:null};
      }
      if(profile==='road24')largeReason=reason;
    }
    return fail(reason);
  },
  validate(s){
    const c=s.civilization,p=c.passenger,u=c.urban,obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
    if(p===undefined){if(this.evidence(s))throw Error('客运记录缺少接入边界');return;}
    if(!obj(p)||p.schema!==1||!Number.isFinite(p.introducedAt)||p.introducedAt<0||p.introducedAt>c.elapsed||!Number.isInteger(p.legacyBeforePartyId)||p.legacyBeforePartyId<1||p.legacyBeforePartyId>u.nextParty||!['auto','small'].includes(p.preference)||!Number.isFinite(p.legacyReadyAt)||p.legacyReadyAt<p.introducedAt||p.legacyReadyAt>p.introducedAt+120||p.lastDepartureAt!==null&&(!Number.isFinite(p.lastDepartureAt)||p.lastDepartureAt<p.legacyReadyAt||p.lastDepartureAt>c.elapsed))throw Error('客运接入记录无效');
    const departures=new Map();
    for(const row of [...u.parties,...Object.values(c.origins?.nodes||{}).flatMap(n=>Object.values(n.departures||{}))])if(row.transport)departures.set(row.partyId??row.id,row.transport.departedAt);
    const times=[...departures.values()].sort((a,b)=>a-b);
    if(times.length&&(p.lastDepartureAt===null||p.lastDepartureAt<times[times.length-1])||times.some((time,index)=>index>0&&time-times[index-1]<120))throw Error('客运发车间隔记录不符');
    const assets=this.assets(s),used=new Set();
    if(assets.length>2||new Set(assets.map(a=>a.id)).size!==assets.length)throw Error('迁居装备数量无效');
    for(const party of u.parties){
      this.validateTransport(s,party.transport,party.id,party.source);
      if(party.transport?.assetId){if(used.has(party.transport.assetId))throw Error('迁居装备不能同时出动');used.add(party.transport.assetId);}
    }
  },
  reset(){},
  refresh(){
    const s=State,p=s.civilization.passenger,assets=this.assets(s);if(!p||!assets.length||!$('#urbanPlans').length){$('#passengerPreference').hide();$('#passengerStatus').hide();return;}
    const text='规模：'+(p.preference==='auto'?'大队优先':'维持小队');
    const button=Civilization.button('passengerPreference',text,'#urbanPlans',()=>{p.preference=p.preference==='auto'?'small':'auto';Engine.saveGame();this.refresh();});
    button.show().contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(text));
    button.attr('title','大队9—24人占用4名运输工和一套迁居装备；原小队1—8人占用2名运输工。每人旅费6粮、0.2药品、0.2工具；大队另付木2、零件0.2、工具0.5。不足条件时尝试小队；在途安排保持不变。');
    let row=$('#passengerStatus');if(!row.length)row=$('<div>').attr('id','passengerStatus').css({width:'410px',lineHeight:'1.8',marginTop:'12px'}).appendTo('#urbanPlans');
    const busy=new Set(s.civilization.urban.parties.map(x=>x.transport?.assetId).filter(Boolean));
    row.show().text('迁居装备 '+assets.length+' 套，出动 '+busy.size+' 套；旅队承诺运输工 '+CivilUrban.reservedTransport(s)+' 人。'+s.civilization.urban.parties.map(x=>{const d=this.profile(s,x);return '第'+x.id+'队 '+CivilUrban.count(x.cohorts)+' 人，'+d.crew+'名运输工'+(this.staffedParties(s).has(x.id)?'值守':'待补齐')+'，'+(x.state==='returning'?'空车返程':x.state==='returning_people'?'带人返乡':x.state==='held'?'候行':'前往'+CivilUrban.targetName(s,x.target))+'。';}).join(''));
  }
};
