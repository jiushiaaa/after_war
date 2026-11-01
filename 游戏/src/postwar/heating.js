/* MPL-2.0 — Paid local heat, explicit civic handover and a bounded emergency workshop. */
var CivilHeating={
  data(s,id='home'){return s.civilization.heating?.nodes[id];},
  stations(s,id='home'){return CivilServices.data(s,id)?.buildings.heatingplant||0;},
  ensure(s,id='home'){
    if(!this.stations(s,id))return null;
    const c=s.civilization;if(c.heating===undefined)c.heating={schema:1,nodes:{}};
    return c.heating.nodes[id]||(c.heating.nodes[id]={introducedAt:c.elapsed,manual:false,handedOverAt:null,handover:null,economy:null,emergency:null});
  },
  handed(s,id='home'){return this.data(s,id)?.handedOverAt!=null;},
  manual(s,id='home'){return this.data(s,id)?.manual===true;},
  setManual(s,id,value){const d=this.data(s,id);if(!d||typeof value!=='boolean')return false;d.manual=value;return true;},
  recipe(manual){return {crew:manual?4:2,capacity:manual?300:600,coal:manual?1.2:.8,power:manual?0:1};},
  run(s,id,{run,powerAvailable=0}){
    const empty={used:0,demand:0,capacity:0},stations=this.stations(s,id);if(!stations||typeof run!=='function')return empty;
    const d=this.ensure(s,id),at=s.civilization.elapsed;if(d.economy?.at===at)return empty;
    const mode=d.manual?'manual':'electric',recipe=this.recipe(d.manual),workers=CivilServices.labor(s,id,'heatingworker');
    const wanted=Math.min(stations,Math.floor(workers/recipe.crew)),demand=wanted*recipe.power;
    const requests=d.manual?wanted:Math.min(wanted,Math.floor(Math.max(0,powerAvailable)+1e-8));
    const paid=requests?run('heatingworker',requests,{coal:recipe.coal,parts:.02},{}):0;
    if(!Number.isInteger(paid)||paid<0||paid>requests)throw Error('供暖付款次数无效');
    const capacity=paid*recipe.capacity,used=paid*recipe.power;
    d.economy={at,mode,stations,workers,requested:wanted,paidStations:paid,capacity,used,demand,cost:{coal:paid*recipe.coal,parts:paid*.02}};
    return {used,demand,capacity};
  },
  capacity(s,id='home'){
    const e=this.data(s,id)?.economy,t=s.civilization.elapsed;
    return e&&e.at<=t&&t<=e.at+10?e.capacity:0;
  },
  covered(s,id='home',extra=0){return !this.handed(s,id)||this.capacity(s,id)>=CivilServices.population(s,id)+extra;},
  forecast(s,id,extra=0,retire=false){
    let source=s;
    if(retire&&id==='home'){source=JSON.parse(JSON.stringify(s));source.civilization.heating.nodes.home.handedOverAt=s.civilization.elapsed;}
    // Known families retain their actual ages; count-only estimates never invent new workers.
    const cohorts=Array.isArray(extra)?extra:extra>0?[{age:17,count:extra,identity:'human'}]:[];
    return id==='home'?CivilUrban.forecast(source,cohorts):CivilMunicipal.forecast(source,id,cohorts);
  },
  growthReason(s,id='home',extra=0,forecastCopy){
    if(!this.handed(s,id))return null;
    const total=CivilServices.population(s,id)+(Array.isArray(extra)?CivilPopulation.count(extra):extra);
    if(this.capacity(s,id)<total)return '实际供暖尚未覆盖现有与待接纳居民';
    const copy=forecastCopy||this.forecast(s,id,extra).copy;
    if(!copy||this.capacity(copy,id)<total)return '下一轮供暖需要补足人员、煤、零件或电力';
    return null;
  },
  handoverReason(s,id='home'){
    const d=this.data(s,id);if(!d)return '先建设供热站并安排试运行';
    if(this.handed(s,id))return '日常供暖已经交接';
    const population=CivilServices.population(s,id),reserved=CivilUrban.reservedBeds(s,id),total=population+reserved;
    if(population<1||this.capacity(s,id)<total)return '试运行的实际供热须覆盖居民与在途预留';
    if(id==='home'){
      const gatherers=CivilSociety.workforce(s)-Object.values(s.game.workers).reduce((n,v)=>n+v,0);
      if(gatherers<2)return '至少保留2位真实采木工，接替工匠原有燃料收集';
    }
    const f=this.forecast(s,id,CivilUrban.waiting(s,id),true);
    if(!f.copy||this.capacity(f.copy,id)<total)return '下一轮供热尚不能持续，请补足班组、煤、零件或电力';
    const e=this.data(s,id).economy,stores=CivilServices.stores(s,id);
    if((stores.coal||0)+1e-8<e.cost.coal*3||(stores.parts||0)+1e-8<e.cost.parts*3)return '交接前至少留下三轮供热煤与零件';
    return null;
  },
  handover(s,id='home'){
    if(this.handoverReason(s,id))return false;
    const d=this.data(s,id);d.handedOverAt=s.civilization.elapsed;
    d.handover={population:CivilServices.population(s,id),reserved:CivilUrban.reservedBeds(s,id),proof:JSON.parse(JSON.stringify(d.economy))};return true;
  },
  emergencyActive(s){const e=this.data(s,'home')?.emergency;return !!e&&s.civilization.elapsed>=e.at&&s.civilization.elapsed<e.until;},
  workshopReady(s){return this.handed(s)?this.capacity(s)>=20||this.emergencyActive(s):(s.game.temperature?.value||0)>=2;},
  recoveryReady(s,extra=1){return this.handed(s)&&this.emergencyActive(s)&&s.game.population+CivilUrban.reservedBeds(s)+extra<=20;},
  emergency(s){
    if(!this.handed(s)||this.workshopReady(s)||!CivilRules.pay(s,{wood:5}))return false;
    const t=s.civilization.elapsed;this.data(s).emergency={at:t,until:t+120,capacity:20,cost:{wood:5}};return true;
  },
  status(s,id='home'){
    const d=this.data(s,id);if(!d)return '';
    const capacity=this.capacity(s,id),population=CivilServices.population(s,id),e=d.economy;
    return (this.handed(s,id)?'日常供暖':'供暖试运行')+'：'+capacity+' / '+population+' 人份；'+(d.manual?'手动轮值':'电动循环')+(e?'，近轮实付煤 '+Number(e.cost.coal.toFixed(2))+'、零件 '+Number(e.cost.parts.toFixed(2))+'，用电 '+e.used:'，等待人员与下一轮运行')+'。'+(this.handed(s,id)&&capacity<population?'覆盖不足，新的批次接纳暂停。':'');
  },
  refresh(){
    if(typeof $!=='function')return;const s=State;
    for(const [id,prefix]of [['home','home'],[typeof CivilMunicipal!=='undefined'?CivilMunicipal.selected:null,'local']]){
      const parent='#services_'+prefix+'_build',d=id&&this.data(s,id),key='heating_'+prefix;
      if(!d||!$(parent).length){$('#'+key+'_record,#'+key+'_manual,#'+key+'_handover').hide();continue;}
      let record=$('#'+key+'_record');if(!record.length)record=$('<div>').attr('id',key+'_record').css({lineHeight:'1.8',marginBottom:'12px'}).insertBefore(parent);record.show().text(this.status(s,id));
      const selected=()=>prefix==='home'?'home':CivilMunicipal.selected;
      const manual=Civilization.button(key+'_manual',d.manual?'恢复电动供暖':'安排手动供暖',parent,()=>{const target=selected();this.setManual(State,target,!this.manual(State,target));if(target!=='home')CivilMunicipal.planWorkers(State,target);Civilization.refresh();Engine.saveGame();});
      manual.show().contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(d.manual?'恢复电动供暖':'安排手动供暖'));
      manual.attr('title','每站每10秒：电动2人、1电、煤0.8、零件0.02供600人；手动4人、煤1.2、零件0.02供300人。请安排真实供热工。');
      const button=Civilization.button(key+'_handover','交接日常供暖',parent,()=>{
        const target=selected(),reason=this.handoverReason(State,target);
        if(reason){Civilization.notify(reason);return;}
        if(this.handover(State,target)){if(target==='home'&&typeof CivilHearth!=='undefined')CivilHearth.stopLegacy();Civilization.notify((target==='home'?'炉火城':CivilRegionContent[target].name)+'把日常供暖交给供热站。'+(target==='home'?'旧炉不再自动添柴，工匠固定产木退出，由实际居民接管。':''));Civilization.refresh();Civilization.updateIncome();Engine.saveGame();}
      });button.toggle(!this.handed(s,id));Button.setDisabled(button,!!this.handoverReason(s,id));
      button.attr('title','需实际供热覆盖居民与预留旅客，下一轮仍可运行，并留三轮煤与零件。'+(id==='home'?'确认后停止旧炉自动添柴与工匠每10秒2木料收入；至少保留2位实际采木工。':''));
    }
  },
  validate(s){
    const h=s.civilization.heating,t=s.civilization.elapsed,fail=()=>{throw Error('供暖服务或交接记录无效');};
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),int=(x,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=0&&x<=max,num=x=>Number.isFinite(x)&&x>=0;
    const builtIds=Object.keys(s.civilization.services?.nodes||{}).filter(id=>this.stations(s,id)>0);
    if(h===undefined){if(builtIds.length)fail();return true;}
    if(!obj(h)||h.schema!==1||!obj(h.nodes)||Object.keys(h.nodes).length!==builtIds.length)fail();
    for(const [id,d]of Object.entries(h.nodes)){
      const completed=CivilServices.data(s,id)?.completed.filter(p=>p.type==='heatingplant')||[];
      if(!builtIds.includes(id)||!obj(d)||!int(d.introducedAt,t)||d.introducedAt!==Math.min(...completed.map(p=>p.completedAt))||typeof d.manual!=='boolean'||d.handedOverAt!==null&&(!int(d.handedOverAt,t)||d.handedOverAt<d.introducedAt))fail();
      const validReceipt=e=>{
        if(!obj(e)||!int(e.at,t)||e.at<d.introducedAt||!['electric','manual'].includes(e.mode)||!int(e.stations,this.stations(s,id))||e.stations<1||e.stations<completed.filter(p=>p.completedAt<e.at).length||e.stations>completed.filter(p=>p.completedAt<=e.at).length||!int(e.workers,e.stations*4)||!int(e.requested,e.stations)||!int(e.paidStations,e.requested)||!num(e.capacity)||!num(e.used)||!num(e.demand)||!obj(e.cost)||Object.keys(e.cost).length!==2)return false;
        const recipe=this.recipe(e.mode==='manual');return e.requested===Math.min(e.stations,Math.floor(e.workers/recipe.crew))&&e.capacity===e.paidStations*recipe.capacity&&e.used===e.paidStations*recipe.power&&e.demand===e.requested*recipe.power&&Math.abs(e.cost.coal-e.paidStations*recipe.coal)<1e-8&&Math.abs(e.cost.parts-e.paidStations*.02)<1e-8;
      };
      if(d.economy!==null&&!validReceipt(d.economy))fail();
      if(d.handedOverAt===null){if(d.handover!==null||d.emergency!==null)fail();}
      else {const p=d.handover;if(!obj(p)||!int(p.population)||p.population<1||!int(p.reserved)||!validReceipt(p.proof)||p.proof.at>d.handedOverAt||d.handedOverAt-p.proof.at>10||p.proof.capacity<p.population+p.reserved)fail();}
      if(d.emergency!==null){const e=d.emergency;if(id!=='home'||!obj(e)||!int(e.at,t)||e.at<d.handedOverAt||e.until!==e.at+120||e.capacity!==20||!obj(e.cost)||Object.keys(e.cost).length!==1||e.cost.wood!==5)fail();}
    }
    return true;
  }
};
