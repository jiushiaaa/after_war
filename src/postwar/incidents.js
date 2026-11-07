/* MPL-2.0 — Persistent road warnings. Cargo, passengers and repairs stay with their owners. */
var CivilIncidents={
  pendingIds:['roadIncident'],
  cost:{wood:20,tools:4},
  seed(at){return ((at^0x6d2b79f5)>>>0)||1;},
  init(s){
    const c=s.civilization;if(c.incidents!==undefined)return;
    if(this.pendingIds.includes(c.pending))throw Error('道路事件缺少原始记录');
    c.incidents={schema:1,introducedAt:c.elapsed,rng:this.seed(c.elapsed),rolls:0,nextRollAt:c.elapsed+600,lastTickAt:null,nextId:1,activeId:null,autoRoads:false,records:[]};
  },
  data(s){return s.civilization.incidents;},
  active(s){const d=this.data(s);return d?.records.find(r=>r.id===d.activeId)||null;},
  route(s,id){return s.civilization.regions?.routes[id];},
  name(id){return CivilRegionContent[id]?.name||id;},
  random(d){d.rng=(Math.imul(d.rng,1664525)+1013904223)>>>0;d.rolls++;return d.rng/4294967296;},
  expectedRng(seed,rolls){
    let multiplier=1664525,increment=1013904223,result=seed;
    while(rolls){if(rolls%2)result=(Math.imul(result,multiplier)+increment)>>>0;increment=(Math.imul(increment,multiplier)+increment)>>>0;multiplier=Math.imul(multiplier,multiplier)>>>0;rolls=Math.floor(rolls/2);}
    return result;
  },
  eligible(s){
    const r=s.civilization.regions;if(!r?.active||!s.civilization.tech.logistics)return [];
    return Object.keys(r.routes).filter(id=>r.nodes[id]?.discovered&&this.route(s,id).condition==='open'&&CivilRegions.serviceReady(s,id)).sort();
  },
  holds(s,id){const r=this.active(s);return !!r&&r.route===id&&r.phase==='holding';},
  busy(s,id){return !!s.civilization.regions?.shipments.some(p=>p.route===id)||!!s.civilization.urban?.parties.some(p=>p.target===id)||(typeof CivilCommerce!=='undefined'&&CivilCommerce.busy(s,id));},
  note(text){if(typeof Civilization!=='undefined')Civilization.notify(text);},
  tick(s,allowNew=true){
    this.init(s);const d=this.data(s),at=s.civilization.elapsed;if(d.lastTickAt!==null&&at<=d.lastTickAt)return;
    d.lastTickAt=at;const current=this.active(s);
    if(current){
      if(current.phase==='watch'&&at>=current.dueAt||current.phase==='holding'&&!this.busy(s,current.route)){
        this.route(s,current.route).condition='closed';this.route(s,current.route).status='道路封闭，等待修复';current.phase='closed';current.closedAt=at;
        this.note(this.name(current.route)+'的道路已封闭。已在途的货物与旅队仍按原路线结算，备齐木20、工具4后即可修复。');
      }
      return;
    }
    if(!allowNew||at<d.nextRollAt)return;
    d.nextRollAt=at+600;const ids=this.eligible(s);if(!ids.length)return;
    const roll=this.random(d);if(roll>=.5)return;
    const route=ids[Math.min(ids.length-1,Math.floor(roll*2*ids.length))],owner=this.route(s,route);
    const record={id:d.nextId++,type:'road_warning',route,createdAt:at,cause:{completedTrips:owner.completedTrips,lastDeliveredAt:owner.lastDeliveredAt},phase:'warning',choice:null,chosenAt:null,dueAt:null,closedAt:null,resolvedAt:null,outcome:null,payment:null,offered:false};
    d.records.push(record);d.activeId=record.id;d.nextRollAt=at+1800;
    if(d.autoRoads&&CivilRegions.repairRoad(s,route,{incidentId:record.id,mode:'auto'})){
      this.note(this.name(route)+'巡路员按常设安排支取木20、工具4，提前加固了松动的路基。');return;
    }
    this.note(this.name(route)+'巡路员发现路基松动。请前往“地区”页面查看预警；封路倒计时在你拍板后才会开始。');
  },
  canRepair(s,id,incidentId){
    const r=this.active(s);return !!r&&r.route===id&&(incidentId===undefined||r.id===incidentId)&&['warning','watch','holding','closed'].includes(r.phase);
  },
  // Called only inside Regions' successful paid repair transaction.
  recordRepair(s,id,mode){
    const r=this.active(s);if(!r||r.route!==id)return;
    const at=s.civilization.elapsed;r.payment={at,cost:{...this.cost},mode};r.resolvedAt=at;r.outcome=r.closedAt===null?'prevented':'repaired';r.phase='resolved';
    this.data(s).activeId=null;this.data(s).nextRollAt=Math.max(this.data(s).nextRollAt,at+1800);
  },
  choose(s,id,choice){
    const r=this.active(s);if(!r||r.id!==id)return false;
    if(choice==='repair'||choice==='automatic'){
      const ok=CivilRegions.repairRoad(s,r.route,{incidentId:id,mode:'manual'});
      if(ok&&choice==='automatic')this.data(s).autoRoads=true;return ok;
    }
    if(r.phase!=='warning'||!['watch','hold'].includes(choice))return false;
    r.choice=choice;r.chosenAt=s.civilization.elapsed;r.phase=choice==='watch'?'watch':'holding';
    if(choice==='watch')r.dueAt=r.chosenAt+180;
    return true;
  },
  acknowledge(s,id){const r=this.active(s);if(r?.id===id)r.offered=true;},
  nextEvent(s){const r=this.active(s);return r?.phase==='warning'&&!r.offered?'roadIncident':null;},
  status(s){
    const r=this.active(s);if(!r)return '当前没有待处理的道路预警';
    const phase=r.phase==='warning'?'等待决定；尚未开始封路倒计时':r.phase==='watch'?'还有'+Math.max(0,r.dueAt-s.civilization.elapsed)+'秒封路':r.phase==='holding'?'新货车与新迁居队停发，等原有车队归来':r.choice==='hold'?'原有车队均已归来，道路封闭待修':'道路已封闭，等待修复';
    return this.name(r.route)+'：'+phase;
  },
  event(id,done){
    if(id!=='roadIncident')return null;const s=State,d=this.data(s),r=this.active(s);if(!d)return null;
    const buttons={},finish=(ok,text)=>{if(r)this.acknowledge(s,r.id);return done(ok?text:'路况或材料存量已有变动，本次未扣料。备齐材料后，可在“地区”页面的道路预警入口继续处理。')();};
    if(r){
      const key=r.id;
      buttons.repair={text:'加固修复（木20工具4）',nextScene:'end',onChoose:()=>finish(this.choose(s,key,'repair'),'修路材料已付清，道路恢复通行。')};
      if(!d.autoRoads)buttons.automatic={text:'修复并授权各路自动维护',nextScene:'end',onChoose:()=>finish(this.choose(s,key,'automatic'),'本次修复已付清。往后各条道路每次触发预警，仍需足额扣除木20、工具4；若库存不足，会再次请你定夺。')};
      if(r.phase==='warning'){
        buttons.hold={text:'停新发车，旧车归来后封路',nextScene:'end',onChoose:()=>finish(this.choose(s,key,'hold'),'此路暂停发运新的货车与迁居队。等在途车辆与旅队全部归来后，即行封路，待料整修。')};
        buttons.watch={text:'继续运输（180秒后封路）',nextScene:'end',onChoose:()=>finish(this.choose(s,key,'watch'),'暂且维持通行。180秒内仍可拨料加固；逾期未修将正式封路。')};
        buttons.later={text:'先去准备材料',nextScene:'end',onChoose:()=>{this.acknowledge(s,key);return done('预警留存“地区”页面，暂不启动封路倒计时。备齐材料后再来拍板。')();}};
      }else buttons.close={text:'先去准备材料',nextScene:'end',onChoose:done('道路记录留存“地区”页面，备齐材料后可随时回来抢修。')};
    }else buttons.close={text:'合上道路记录',nextScene:'end',onChoose:done('巡路记录已合上。')};
    if(d.autoRoads)buttons.stopAuto={text:'取消今后的自动维护',nextScene:'end',onChoose:()=>{d.autoRoads=false;if(r)this.acknowledge(s,r.id);return done('往后的道路预警重新交回居民定夺，当前已在处理的路段仍按原决定执行。')();}};
    const advice=!r?'巡路照常进行。常设维护仅在发现路基隐患时支取材料；若库存不足，仍会报请你定夺。':r.phase==='warning'?'选择停发，会等在途货车与迁居队全部归来后再封路待修；选择继续通行，则从拍板那刻起倒计180秒。':r.choice==='hold'?'在途车辆归来后即行封路。等路面修通，原有的运输安排会自动恢复发车。':'封路期间，在途车队就地停靠。可在“地区”页面安排原路撤回，或拨料修通道路后继续前行。';
    const budget=r&&typeof CivilFinance!=='undefined'&&CivilFinance.agreement(s)?.members.includes(r.route)?['签下的共同约定仍须兑现，延期交货会记作本期欠供。']:[];
    return {title:r?'旧路的预警':'道路维护记录',text:[this.status(s)+'。','每次加固或抢修需消耗木料20、工具4。',advice,...budget,'各路常设维护：'+(d.autoRoads?'已授权，每次抢修均须足额支取材料。':'尚未授权。')],buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#regionsPanel').length)return;const s=State,d=this.data(s);
    if(!d?.records.length){$('#incidentButton,#incidentSummary').hide();return;}
    Civilization.button('incidentButton','查看道路预警','#regionsPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='roadIncident';Civilization.showPending();}).show();
    let note=$('#incidentSummary');if(!note.length)note=$('<div>').attr('id','incidentSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#regionsPanel');note.show().text(this.status(s));
  },
  validate(s){
    const d=this.data(s),at=s.civilization.elapsed,fail=()=>{throw Error('道路事件记录无效');};
    if(d===undefined){if(this.pendingIds.includes(s.civilization.pending))fail();return true;}
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),int=x=>Number.isSafeInteger(x)&&x>=0,time=x=>int(x)&&x<=at,nullable=x=>x===null||time(x);
    if(!obj(d)||d.schema!==1||!time(d.introducedAt)||!int(d.rng)||d.rng>4294967295||!int(d.rolls)||d.rolls>Math.floor((at-d.introducedAt)/600)||!int(d.nextRollAt)||d.nextRollAt<d.introducedAt+600||d.nextRollAt>at+1800||!nullable(d.lastTickAt)||d.lastTickAt!==null&&d.lastTickAt<d.introducedAt||!int(d.nextId)||d.nextId<1||typeof d.autoRoads!=='boolean'||!Array.isArray(d.records)||d.records.length!==d.nextId-1||d.records.length>d.rolls||d.activeId!==null&&(!int(d.activeId)||d.activeId<1||d.activeId>=d.nextId))fail();
    if(d.rng!==this.expectedRng(this.seed(d.introducedAt),d.rolls)||d.lastTickAt===null&&(d.rolls!==0||d.records.length!==0||d.nextRollAt!==d.introducedAt+600))fail();
    let previous=null,unresolved=0;
    for(let i=0;i<d.records.length;i++){
      const r=d.records[i],route=this.route(s,r?.route);
      if(!obj(r)||r.id!==i+1||r.type!=='road_warning'||!route||!time(r.createdAt)||r.createdAt<d.introducedAt+600||previous&&r.createdAt<Math.max(previous.createdAt,previous.resolvedAt||0)+1800||!obj(r.cause)||!int(r.cause.completedTrips)||r.cause.completedTrips<1||r.cause.completedTrips>route.completedTrips||!time(r.cause.lastDeliveredAt)||r.cause.lastDeliveredAt>r.createdAt||!['warning','watch','holding','closed','resolved'].includes(r.phase)||![null,'watch','hold'].includes(r.choice)||!nullable(r.chosenAt)||!nullable(r.closedAt)||!nullable(r.resolvedAt)||r.dueAt!==null&&!int(r.dueAt))fail();
      if(d.lastTickAt===null||r.createdAt>d.lastTickAt||r.offered!==undefined&&typeof r.offered!=='boolean')fail();
      if(r.choice===null&&(r.chosenAt!==null||r.dueAt!==null||r.closedAt!==null)||r.choice!==null&&(r.chosenAt===null||r.chosenAt<r.createdAt)||r.choice==='watch'&&r.dueAt!==r.chosenAt+180||r.choice!=='watch'&&r.dueAt!==null||r.closedAt!==null&&(r.closedAt<r.chosenAt||r.choice==='watch'&&r.closedAt<r.dueAt))fail();
      if(r.phase==='resolved'){
        const p=r.payment;if(d.activeId===r.id||r.resolvedAt===null||r.resolvedAt<r.createdAt||r.chosenAt!==null&&r.resolvedAt<r.chosenAt||r.closedAt!==null&&r.resolvedAt<r.closedAt||!['prevented','repaired'].includes(r.outcome)||r.outcome!==(r.closedAt===null?'prevented':'repaired')||!obj(p)||p.at!==r.resolvedAt||!['manual','auto'].includes(p.mode)||!obj(p.cost)||Object.keys(p.cost).length!==2||p.cost.wood!==20||p.cost.tools!==4)fail();
      }else{
        unresolved++;if(d.activeId!==r.id||i!==d.records.length-1||r.resolvedAt!==null||r.payment!==null||r.outcome!==null||r.phase==='warning'&&r.choice!==null||r.phase==='watch'&&(r.choice!=='watch'||r.closedAt!==null)||r.phase==='holding'&&(r.choice!=='hold'||r.closedAt!==null)||r.phase==='closed'&&(r.closedAt===null||route.condition!=='closed'))fail();
      }
      previous=r;
    }
    if(previous&&d.nextRollAt<Math.max(previous.createdAt,previous.resolvedAt||0)+1800||unresolved!==(d.activeId===null?0:1)||d.autoRoads&&!d.records.some(r=>r.phase==='resolved')||s.civilization.pending==='roadIncident'&&!d.records.length)fail();
    return true;
  }
};
