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
    if(!this.available(s)||!route)return '请先完成立国与铁路工程研究';
    if(mode==='rail'&&(!this.asset(s)||CivilRegions.upgrade(s,'rail')?.status!=='complete'))return '请先建成铁轨支线与转运站，并保留原有的加固货车';
    if(mode==='rail'&&!CivilNation.operational(s))return '请先恢复国家共同法运转';
    if(CivilRegions.routeBusy(s,'rail'))return '请等本趟在途车辆归站，随车货物与剩余路程保持不变';
    const crew=mode==='rail'?4:2,extra=route.enabled?crew-route.assigned:0;
    if(extra>CivilRegions.availableTransport(s))return '铁路班次需抽调4名运输工，请先补足空闲人手或等迁居车组归来';
    if(this.data(s)?.changes.at(-1)?.at===s.civilization.elapsed)return '正候下一秒排入新班次';
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
    route.status=q.mode==='rail'?'铁路班组已接管该线，候下一趟发车':'已切回原加固货车，候下一趟发车';return true;
  },
  status(s){
    const d=this.data(s),route=s.civilization.regions?.routes.rail,p=CivilServices.data(s,'rail')?.project;
    if(d?.request)return (d.request.mode==='rail'?'铁路接管已排队：':'切回货车已排队：')+(this.reason(s,d.request.mode)||'正候下一秒完成交接');
    if(!this.asset(s)){
      if(p?.type==='railfreight'&&p.status!=='complete')return '铁轨支线与转运站：'+(p.status==='supplying'?'筑路建材正由原货车分批拉去':'当地施工尚余'+p.remaining+'秒');
      if(!CivilNation.operational(s))return '立项筹办铁路前请先恢复国家共同法；已掌握的研究成果照旧保留';
      if(CivilRegions.upgrade(s,'rail')?.status!=='complete')return '请先在铁轨镇完成“加固货车”改装，以承接筑路运材并留作后备运力';
      if(!CivilServices.projectAvailable(s,'rail'))return '请等铁轨镇眼下的工程竣工后，再筹办铁轨支线与转运站';
      return '请先立项筹办支线与转运站；建材须由原货车分批运抵，再由当地居民动工';
    }
    return '炉火城—铁轨镇 · 当前：'+(this.modeAt(s,'rail')==='rail'?'铁路列车':'加固货车')+'，单趟载重'+route.capacity+'，单程'+route.travel+'秒，随车班组'+this.crew(s,'rail')+'人。'+route.status;
  },
  event(id,done){
    if(id!=='nationalRailway')return null;const s=State,buttons={},d=this.data(s),finish=(ok,text)=>done(ok?text:'条件已有变动，本次未执行；请核对工程进度、共同法状态与运输工人数。')();
    if(!this.asset(s)){
      if(CivilServices.projectAvailable(s,'rail')&&CivilServices.facilityGate(s,'rail','railfreight'))buttons.build={text:'筹办铁轨支线与转运站',nextScene:'end',onChoose:()=>finish(CivilServices.startProject(s,'rail','railfreight'),'铁轨支线工程已立项。筑路建材将随原货车分批拉去，竣工前尚无法开行列车。')};
    }else if(d?.request)buttons.cancel={text:'撤销排队中的班次切换',nextScene:'end',onChoose:()=>finish(this.cancel(s),'尚未交接的班次切换已撤销，当前车辆照旧运行。')};
    else {const mode=this.modeAt(s,'rail')==='rail'?'road':'rail';buttons.switch={text:mode==='rail'?'安排铁路接管':'安排切回货车',nextScene:'end',onChoose:()=>finish(this.request(s,mode),'班次切换已排入队列。待在途车辆归站、人手与条件齐备后即行交接，不会半路截短在途耗时。')};}
    buttons.close={text:'合上交通记录',nextScene:'end',onChoose:done('在途运单与随车班组继续按既定班次跑完。')};
    return {title:'国家交通：铁轨支线',text:[this.status(s)+'。','全线工程需耗木200、钢300、机械零件80、精密零件30、电子元件20、工具40；建材运齐后由铁轨镇两名施工者动工600秒，原有的加固货车将留作后备车辆。','铁路列车单趟载重128、单程耗时45秒，需常设4名运输工随车当值（与迁居客运共用运输工池）。每趟发车除原定旅费外，另耗乌煤2、零件0.1、工具0.05以保往返；若煤料或备件不足则停发候料，不会白跑。','加固货车仍为单趟载重128、单程90秒、配2名运输工。须等在途车辆归站后方可切换班次；工程运材、三仓互助、地方救济与日常贸易仍共用这条线上的同一趟车与两地原仓。'],buttons};
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
