/* MPL-2.0 — One paid rail corridor, one original route, conserved cargo and workers. */
var CivilRailway={
  pendingIds:['nationalRailway'],
  surcharge:{coal:2,parts:.1,tools:.05},
  data(s){return s.civilization.railway;},
  available(s){return !!s.civilization.tech.railway_engineering&&Number.isSafeInteger(s.civilization.nation?.foundedAt);},
  asset(s){return s.civilization.services?.nodes.rail?.completed.find(x=>x.type==='railfreight');},
  modeAt(s,id,at=s.civilization.elapsed){if(id!=='rail')return 'road';return this.data(s)?.changes.filter(x=>x.at<=at).at(-1)?.mode||'road';},
  crew(s,id){return this.modeAt(s,id)==='rail'?4:2;},
  travelAt(s,id,at=s.civilization.elapsed){return this.modeAt(s,id,at)==='rail'?45:CivilRegionContent[id].travel;},
  extraAt(s,id,at=s.civilization.elapsed){return this.modeAt(s,id,at)==='rail'?this.surcharge:{};},
  reason(s,mode){
    const route=s.civilization.regions?.routes.rail;
    if(!this.available(s)||!route)return '先完成国家与铁路工程研究';
    if(mode==='rail'&&(!this.asset(s)||CivilRegions.upgrade(s,'rail')?.status!=='complete'))return '先建成铁轨支线与转运站，并保留加固货车';
    if(mode==='rail'&&!CivilNation.operational(s))return '先恢复国家共同法';
    if(CivilRegions.routeBusy(s,'rail'))return '等待本趟原车归来，货物与剩余时间保持不变';
    const crew=mode==='rail'?4:2,extra=route.enabled?crew-route.assigned:0;
    if(extra>CivilRegions.availableTransport(s))return '铁路需要4名运输工，先补足空闲班组或等迁居车组归来';
    if(this.data(s)?.changes.at(-1)?.at===s.civilization.elapsed)return '等待下一秒安排新班次';
    return null;
  },
  request(s,mode){
    if(!['road','rail'].includes(mode)||!this.available(s)||this.data(s)?.request||mode===this.modeAt(s,'rail')||mode==='rail'&&!this.asset(s))return false;
    const d=this.data(s)||(s.civilization.railway={schema:1,changes:[],request:null});d.request={mode,requestedAt:s.civilization.elapsed};this.tick(s);return true;
  },
  cancel(s){const d=this.data(s);if(!d?.request)return false;d.request=null;return true;},
  tick(s){
    const d=this.data(s),q=d?.request;if(!q||this.reason(s,q.mode))return false;
    const route=s.civilization.regions.routes.rail;
    d.changes.push({...q,at:s.civilization.elapsed,assetId:this.asset(s).id});d.request=null;
    route.travel=this.travelAt(s,'rail');route.assigned=route.enabled?this.crew(s,'rail'):0;
    route.status=q.mode==='rail'?'铁路班组已接管，等待下一趟':'原货车恢复，等待下一趟';return true;
  },
  status(s){
    const d=this.data(s),route=s.civilization.regions?.routes.rail,p=CivilServices.data(s,'rail')?.project;
    if(d?.request)return (d.request.mode==='rail'?'铁路接管已排队：':'恢复货车已排队：')+(this.reason(s,d.request.mode)||'等待下一秒交接');
    if(!this.asset(s)){
      if(p?.type==='railfreight'&&p.status!=='complete')return '铁轨支线与转运站：'+(p.status==='supplying'?'建材由原货车逐批运输':'当地施工尚余'+p.remaining+'秒');
      if(!CivilNation.operational(s))return '筹办铁路前先恢复国家共同法；已支付的研究成果保留';
      if(CivilRegions.upgrade(s,'rail')?.status!=='complete')return '先在铁轨镇筹办加固货车，承担工程运材并保留后备运输';
      if(!CivilServices.projectAvailable(s,'rail'))return '等待铁轨镇当前工程竣工，再筹办支线与转运站';
      return '先筹办支线与转运站；工程须由原货车运材和当地居民施工';
    }
    return '炉火城—铁轨镇 · '+(this.modeAt(s,'rail')==='rail'?'铁路':'加固货车')+'，载重'+route.capacity+'，单程'+route.travel+'秒，班组'+this.crew(s,'rail')+'人。'+route.status;
  },
  event(id,done){
    if(id!=='nationalRailway')return null;const s=State,buttons={},d=this.data(s),finish=(ok,text)=>done(ok?text:'条件发生变化，本次未执行；请核对工程、共同法与班组。')();
    if(!this.asset(s)){
      if(CivilServices.projectAvailable(s,'rail')&&CivilServices.facilityGate(s,'rail','railfreight'))buttons.build={text:'筹办铁轨支线与转运站',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'rail','railfreight'),'支线工程已登记。建材随原车逐批运到，尚未形成铁路运力。')};
    }else if(d?.request)buttons.cancel={text:'撤销待执行的班次切换',nextScene:'end',onChoose:()=>finish(this.cancel(s),'未执行的班次切换已撤销，现有运输继续。')};
    else {const mode=this.modeAt(s,'rail')==='rail'?'road':'rail';buttons.switch={text:mode==='rail'?'安排铁路接管':'安排恢复货车',nextScene:'end',onChoose:()=>finish(this.request(s,mode),'切换已登记。等待原车归来、班组与条件齐备后接管，不截短在途时间。')};}
    buttons.close={text:'合上交通记录',nextScene:'end',onChoose:done('现有运单与运输人员继续按班次执行。')};
    return {title:'国家交通：铁轨支线',text:[this.status(s)+'。','工程实耗木200、钢300、机械零件80、精密零件30、电子元件20、工具40；当地两名建设者施工600秒，原车保留作后备。','铁路载重128、单程45秒，固定占用4名现有运输工，与客运共同核对劳力。每趟出发除原旅费外另付煤2、零件0.1、工具0.05，覆盖往返；缺料等待，不免费出发。','加固货车仍为载重128、单程90秒、2名运输工。只有车辆归来后才能切换；施工、互助、救济与贸易仍共用这条线的一辆运载工具和各地原仓。'],buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#railwayButton').hide();$('#railwaySummary').hide();return;}
    Civilization.button('railwayButton','国家交通：铁轨支线','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='nationalRailway';Civilization.showPending();}).show();
    let line=$('#railwaySummary');if(!line.length)line=$('<div>').attr('id','railwaySummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  },
  validate(s){
    const d=this.data(s),asset=this.asset(s),c=s.civilization,fail=()=>{throw Error('国家铁路与班次记录无效');},time=x=>Number.isSafeInteger(x)&&x>=0&&x<=c.elapsed;
    const project=CivilServices.data(s,'rail')?.project,construction=asset||(project?.type==='railfreight'?project:null);
    if(construction&&(!this.available(s)||construction.startedAt<c.nation.foundedAt||CivilRegions.upgrade(s,'rail')?.status!=='complete'||construction.startedAt<CivilRegions.upgrade(s,'rail').completedAt))fail();
    if(d===undefined){if(this.pendingIds.includes(c.pending)&&!this.available(s))fail();return;}
    if(!d||d.schema!==1||!Array.isArray(d.changes)||!this.available(s)||!asset)fail();
    let mode='road',at=-1;
    for(const change of d.changes){
      if(!change||!['road','rail'].includes(change.mode)||change.mode===mode||!time(change.requestedAt)||change.requestedAt<asset.completedAt||change.requestedAt<at||!time(change.at)||change.at<change.requestedAt||change.at<=at||change.assetId!==asset.id)fail();
      for(const o of [...(c.finance?.orders||[]),...(c.relief?.orders||[])])if((o.node||o.target)==='rail'&&o.dispatchedAt!==null&&o.dispatchedAt<change.at&&(o.closedAt??o.returnedAt??c.elapsed+1)>change.at)fail();
      mode=change.mode;at=change.at;
    }
    if(d.request!==null&&(!d.request||!['road','rail'].includes(d.request.mode)||d.request.mode===mode||!time(d.request.requestedAt)||d.request.requestedAt<Math.max(at,asset.completedAt)))fail();
  }
};
