/* MPL-2.0 — Source-preserving migration, reserved beds and sustained local urban economy. */
var CivilUrban = {
  pendingIds:['urban_register','urban_charter','urban_city'],
  init(s){
    if(s.civilization.urban!==undefined)return;
    s.civilization.urban={schema:1,registered:false,enabled:false,source:[],parties:[],nextParty:1,admitted:0,deceased:0,year:Math.floor(s.civilization.elapsed/600),dispatchClock:0,status:'等待地区名册',chartered:false,city:false,townStable:0,cityStable:0,economy:null};
  },
  buildings:{
    publicclinic:{cost:()=>({wood:200,iron:20,parts:8}),max:8,gate:()=>State.civilization.tech.standards && State.civilization.tech.sanitation && State.game.buildings.clinic},
    publicschool:{cost:()=>({wood:180,iron:12,parts:6}),max:4,gate:()=>State.civilization.tech.standards && State.civilization.tech.school},
    irrigatedfield:{cost:()=>({wood:160,iron:6,tools:18}),max:6,gate:()=>State.civilization.tech.standards && State.civilization.tech.irrigation && State.civilization.pump && State.civilization.outpostSupplied===true},
    toolworks:{cost:()=>({wood:160,iron:20,parts:6}),max:2,gate:()=>State.civilization.tech.standards && State.game.buildings.toolshop},
    residential:{cost:()=>({wood:400,iron:40,parts:10}),max:8,gate:()=>State.civilization.tech.standards && State.civilization.industry?.announcedPower && CivilUrban.publicServices(State)},
    blockhousing:{cost:()=>({wood:650,iron:70,parts:20,tools:20}),max:4,gate:()=>State.civilization.tech.urbanworks && CivilUrban.publicServices(State) && CivilUrban.housingReady(State)}
  },
  count(cohorts){return cohorts.reduce((n,c)=>n+c.count,0);},
  children(cohorts){return cohorts.filter(c=>c.age<18).reduce((n,c)=>n+c.count,0);},
  sourceIds(s){return ['dispersed',...Object.entries(s.civilization.origins?.nodes||{}).filter(([,n])=>['contacted','agreed'].includes(n.status)).map(([id])=>id)];},
  sourceId(s){return s.civilization.urban.activeSource || 'dispersed';},
  sourceName(id){return id==='dispersed'?'沿路名册':typeof CivilOriginContent!=='undefined' && CivilOriginContent[id]?.name || '河网散居圈';},
  quote(s,id,max,mode){
    if(id==='dispersed'){
      const u=s.civilization.urban;if(!u.registered)return null;
      const cohorts=this.take(u.source.map(c=>({...c})),Math.min(max,this.count(u.source)));return cohorts.length?{originId:id,cohorts,count:this.count(cohorts)}:null;
    }
    return typeof CivilOrigins!=='undefined'?CivilOrigins.quoteParty(s,id,max,{mode}):null;
  },
  commitSource(s,quote,id){
    if(quote.originId==='dispersed'){this.take(s.civilization.urban.source,quote.count);return true;}
    return typeof CivilOrigins!=='undefined' && CivilOrigins.commitDeparture(s,quote,id);
  },
  receive(s,party){
    if(party.source!=='dispersed' && (typeof CivilOrigins==='undefined' || !CivilOrigins.recordArrival(s,party)))return false;
    this.admit(s,party.cohorts,party.source);return true;
  },
  reservedBeds(s){return (s.civilization.urban?.parties||[]).filter(p=>['outbound','held'].includes(p.state)).reduce((n,p)=>n+this.count(p.cohorts),0);},
  availableBeds(s){return Math.max(0,CivilCatalog.capacity(s)-s.game.population-this.reservedBeds(s));},
  reservedTransport(s){return (s.civilization.urban?.parties.length||0)*2;},
  publicServices(s){return !!s.game.buildings.publicclinic && !!s.game.buildings.publicschool && (s.game.workers.medic||0)>0 && (s.game.workers.teacher||0)>0;},
  discovered(s){return typeof CivilRegions!=='undefined'?CivilRegions.discoveredCount(s):Object.values(s.civilization.regions?.nodes||{}).filter(n=>n.discovered).length;},
  register(s){
    const u=s.civilization.urban;if(u.registered || this.discovered(s)<2)return false;
    // Sixty recorded family groups: five adults, two children, one older resident.
    for(let i=0;i<60;i++)u.source.push({age:24+i%16,count:4,identity:'human'},{age:25+i%14,count:1,identity:'mutant'},{age:5+i%8,count:2,identity:i%3?'human':'mutant'},{age:60+i%8,count:1,identity:i%4?'human':'mutant'});
    u.registered=true;u.status='名册已登记，等待接纳安排';return true;
  },
  take(source,number){
    const result=[];for(const cohort of source){if(!number)break;const n=Math.min(number,cohort.count);result.push({...cohort,count:n});cohort.count-=n;number-=n;}
    for(let i=source.length-1;i>=0;i--)if(!source[i].count)source.splice(i,1);return result;
  },
  admit(s,cohorts,source='dispersed'){
    // Update the ledger and the native total together, before any Society.sync can run.
    const n=this.count(cohorts);s.civilization.society.cohorts.push(...cohorts.map(c=>({...c})));s.game.population+=n;if(source==='dispersed')s.civilization.urban.admitted+=n;CivilSociety.sync(s);return n;
  },
  handleArrival(s){
    const u=s.civilization.urban;if(!u)return false;
    const source=this.sourceId(s);if(!u.registered && source==='dispersed')return false;
    if(!this.availableBeds(s) || s.civilization.hunger || s.game.temperature.value<2 || (s.game.population>0 && s.civilization.trust<15))return true;
    const quote=this.quote(s,source,1,'singleton');if(!quote || !CivilRules.pay(s,{food:6}))return true;
    const id=u.nextParty;
    if(!this.commitSource(s,quote,id)){s.stores.food+=6;return true;}
    if(source!=='dispersed')u.nextParty++;
    const party={id,source,target:'home',cohorts:quote.cohorts};
    if(!this.receive(s,party)){CivilOrigins.returnPeople(s,party);s.stores.food+=6;return true;}
    this.note('一位来自'+this.sourceName(source)+'的居民沿路来到聚落，带来了自己的经历。');return true;
  },
  commitments(s){return typeof CivilRegions!=='undefined' && CivilRegions.committedHomeFlow?CivilRegions.committedHomeFlow(s):{};},
  forecast(s,cohorts=[]){
    const copy=JSON.parse(JSON.stringify(s)),before={...copy.stores};
    copy.game.population+=this.count(cohorts);copy.civilization.society.cohorts.push(...cohorts.map(c=>({...c})));
    const flow=CivilRules.settle(copy).flow;
    const treatment=CivilVillage.treatment(copy);CivilVillage.settle(copy);if(treatment)flow['诊所治疗']={medicine:-treatment};
    Object.assign(flow,CivilSociety.settle(copy),CivilIndustry.settle(copy));
    if(typeof CivilRegions!=='undefined')Object.assign(flow,CivilRegions.settle(copy));
    if(typeof CivilOrigins!=='undefined')Object.assign(flow,CivilOrigins.settle(copy));
    const deltas={};for(const k of CivilCatalog.resources)deltas[k]=(copy.stores[k]||0)-(before[k]||0);
    return {copy,flow,deltas};
  },
  foodReserve(s,cohorts=[]){
    const added=cohorts.reduce((n,c)=>n+c.count*(c.age<18?2/3:1),0),policy=CivilRules.policies[s.civilization.policy]||CivilRules.policies.equal;
    return (CivilSociety.foodPopulation(s)+added)*.12*policy.food*(s.game.buildings.cistern?.9:1)*12;
  },
  waiting(s){return s.civilization.urban.parties.filter(p=>['outbound','held'].includes(p.state)).flatMap(p=>p.cohorts);},
  serviceCheck(s,cohorts){
    if(!this.publicServices(s))return '公共诊疗站和学舍需要实际岗位';
    if(s.civilization.hunger || s.civilization.village.health<60)return '先恢复居民口粮和健康';
    const totalChildren=this.children(s.civilization.society.cohorts)+this.children(cohorts);
    if(totalChildren>Math.min(s.game.workers.teacher||0,CivilCatalog.jobCapacity(s,'teacher'))*20)return '教师尚不能覆盖新增儿童';
    const result=this.forecast(s,cohorts),commit=this.commitments(s);
    const teaching=(result.flow['教师']?.knowledge||0)/(.2*CivilIndustry.factor(s));
    if(totalChildren>teaching*20+1e-8)return '教学缺少纸材或实际值守';
    if((result.deltas.medicine||0)+(commit.medicine||0)<-1e-8 || !result.copy.civilization.society.service)return '药品净供给或公共行政不足';
    if((result.flow['医护']?.medicine||0)+1e-8<(s.game.population+this.count(cohorts))*.01)return '医护原料不足以完成新增治疗';
    return null;
  },
  housingReady(s){
    const extra=[...this.waiting(s),{age:25,count:8,identity:'human'}];
    return (s.stores.food||0)>=this.foodReserve(s,extra) && !this.serviceCheck(s,extra);
  },
  dispatch(s){
    const u=s.civilization.urban;
    if(!u || !u.enabled)return false;
    const stop=reason=>{u.status=reason;return false;};
    if(!s.game.buildings.cartdepot || !s.civilization.tech.logistics)return stop('接纳需要车队场与运输组织');
    if(u.parties.length>=2 || typeof CivilRegions==='undefined' || CivilRegions.availableTransport(s)<2)return stop('等待两名运输工与返程车队');
    const source=this.sourceId(s),beds=Math.min(8,this.availableBeds(s));if(!beds)return stop('等待空余床位');
    const quote=this.quote(s,source,beds,'convoy');if(!quote)return stop(source==='dispersed'?'登记的居民已全部安置':'来源需要迁居议约、留守居民与实际供养');
    const n=quote.count,sample=quote.cohorts,all=[...this.waiting(s),...sample],cost={food:n*6,medicine:n*.2,tools:n*.2};
    if(!CivilRules.canPay(s,cost))return stop('待备旅费：每人6粮、0.2药品、0.2工具');
    if((s.stores.food||0)-cost.food+1e-8<this.foodReserve(s,all))return stop('安置后须留下120秒居民口粮');
    const reason=this.serviceCheck(s,all);if(reason)return stop(reason);
    CivilRules.pay(s,cost);
    if(!this.commitSource(s,quote,u.nextParty)){for(const [key,value]of Object.entries(cost))s.stores[key]+=value;return stop('来源名册已经变化，下一趟重新核对');}
    u.parties.push({id:u.nextParty++,source,target:'home',state:'outbound',remaining:120,heldFor:0,cohorts:quote.cohorts,rations:n*6});u.dispatchClock=120;u.status=n+'位居民已经启程，住房已预留';return true;
  },
  returnParty(s,id){
    const party=s.civilization.urban.parties.find(p=>p.id===id);
    if(!party || !['outbound','held'].includes(party.state))return false;
    party.state='returning_people';party.remaining=120;party.heldFor=0;return true;
  },
  tick(s){
    const u=s.civilization.urban;if(!u)return {populationChanged:false,storesChanged:false};
    const before=s.game.population,year=Math.floor(s.civilization.elapsed/600);
    while(u.year<year){
      u.year++;
      const aged=CivilPopulation.age(u.source);u.source=aged.cohorts;u.deceased+=aged.deceased;
      for(const party of u.parties){
        const agedParty=CivilPopulation.age(party.cohorts);
        if(agedParty.deceased){if(party.source==='dispersed')u.deceased+=agedParty.deceased;else CivilOrigins.recordTransitDeath(s,party,agedParty.deceased);}
        party.cohorts=agedParty.cohorts;
      }
    }
    for(const p of [...u.parties]){
      if(p.state==='held')p.heldFor++;else p.remaining=Math.max(0,p.remaining-1);
      if(['outbound','held'].includes(p.state) && !p.remaining){
        const n=this.count(p.cohorts);
        if(s.game.population+n<=CivilCatalog.capacity(s)){
          if(!this.receive(s,p)){u.status='接纳名册等待核对';continue;}
          p.cohorts=[];p.state='returning';p.remaining=120;p.heldFor=0;p.rations=0;u.status=n+'位居民已安置，车队正在返回';this.note(n+'位居民按名册住进了聚落。儿童、成人和老人各自留下了一行。');
        }else {p.state='held';u.status='接纳点候床，居民仍有途中补给';if(p.heldFor>=120 || p.rations<=0)this.returnParty(s,p.id);}
      }else if(['returning','returning_people'].includes(p.state) && !p.remaining){
        if(p.state==='returning_people'){
          if(p.source==='dispersed')u.source.push(...p.cohorts);else if(!CivilOrigins.returnPeople(s,p)){u.status='返程名册等待核对';continue;}
          u.status='居民已返回原接纳点，旅费不退回';
        }
        u.parties.splice(u.parties.indexOf(p),1);
      }
    }
    u.dispatchClock=Math.max(0,u.dispatchClock-1);let sent=false;
    if(u.enabled && !u.dispatchClock){sent=this.dispatch(s);if(!sent)u.dispatchClock=10;}
    return {populationChanged:s.game.population!==before,storesChanged:sent};
  },
  tradeReady(s){
    const r=s.civilization.regions;
    if(r?.active && typeof CivilRegions!=='undefined' && CivilRegions.tradeReady)return CivilRegions.tradeReady(s);
    if(r?.active)return Object.values(r.routes||{}).some(route=>route.enabled && route.assigned>=2 && route.completedTrips>0 && route.condition==='open');
    return s.civilization.village.routeStatus==='往返正常' && s.civilization.village.convoys>0;
  },
  developmentReady(s,city=false){
    const u=s.civilization.urban,e=u.economy,c=s.civilization,i=c.industry;
    if(!e || c.elapsed-e.at>10 || s.game.population<(city?400:80) || s.game.population> CivilCatalog.capacity(s) || !this.publicServices(s) || c.hunger || c.village.health<(city?70:60))return false;
    if(!e.treatment || !e.education || e.medicine<-1e-8 || e.food<-1e-8 || !c.society.service)return false;
    if(!city)return this.tradeReady(s);
    const project=Object.values(c.regions?.nodes||{}).some(n=>n.completedProjects?.publicWorks);
    return u.chartered && c.tech.urbanworks && project && c.regions?.adminService && i.pollution<40 && e.industrial && e.productionPower>=4 && (s.stores.food||0)+1e-8>=this.foodReserve(s) && s.stores.tools>=40 && s.stores.iron>=40 && s.stores.parts>=20;
  },
  settle(s,evidence){
    const u=s.civilization.urban,flow={};if(!u)return flow;
    for(const party of u.parties)if(party.cohorts.length)party.rations=Math.max(0,party.rations-this.count(party.cohorts)*.12);
    if(!evidence)return flow;
    const f=evidence.flow||{},d=evidence.deltas||{},commit=this.commitments(s),i=s.civilization.industry;
    const medicine=(d.medicine||0)+(commit.medicine||0),food=(d.food||0)+(commit.food||0);
    u.economy={at:s.civilization.elapsed,medicine,food,
      treatment:(f['医护']?.medicine||0)+1e-8>=s.game.population*.01 && -(f['诊所治疗']?.medicine||0)+1e-8>=s.game.population*.01,
      education:this.children(s.civilization.society.cohorts)<=((f['教师']?.knowledge||0)/(.2*CivilIndustry.factor(s)))*20+1e-8,
      industrial:(f['采矿工']?.ore||0)>0 && (f['采煤工']?.coal||0)>0 && (f['冶炼工']?.iron||0)>0 && (f['机械工']?.parts||0)>0,
      productionPower:Math.max(0,i.used-(f['烟尘处理']?1:0))};
    u.townStable=this.developmentReady(s)?Math.min(180,u.townStable+10):0;
    u.cityStable=this.developmentReady(s,true)?Math.min(300,u.cityStable+10):0;return flow;
  },
  nextEvent(s){const u=s.civilization.urban;if(!u)return null;if(!u.registered && this.discovered(s)>=2)return 'urban_register';if(!u.chartered && u.townStable>=180 && this.developmentReady(s))return 'urban_charter';if(!u.city && u.cityStable>=300 && this.developmentReady(s,true))return 'urban_city';return null;},
  event(id,done){
    const s=State,u=s.civilization.urban;
    if(id==='urban_register')return {title:'沿路的名册',text:['两个聚居地的引路人带来一份散居家庭名册，共四百八十人。人类与变异居民、孩子和老人，都在等一个有床位与公共服务的落脚处。','登记只建立联络。批次接纳须准备车队、旅粮、药品与工具，并留下安置后的口粮；暂停车队后，仍可按名册接纳零星来访者。'],buttons:{register:{text:'登记家庭与接纳条款',nextScene:'end',onChoose:done('所有登记居民享有相同的口粮、诊疗与儿童教育。车队按住房和实际供给分批接纳。',()=>this.register(s))}}};
    if(id==='urban_charter')return {title:'镇的公共职责',text:['八十位居民、诊疗、课堂与往返道路，已经连续稳定运行。居民愿意把住房、供养和公共记录写入镇制。','镇制不会带来额外人口或物资。后续街坊和工业扩容仍需研究、建设与劳动。'],buttons:{charter:{text:'登记镇制',nextScene:'end',onChoose:()=>{const ready=u.townStable>=180 && this.developmentReady(s);return done(ready?'正式镇制写入公共记录。城镇工程可以继续研究。':'供养条件已有变化，恢复稳定后再议镇制。',()=>{if(ready)u.chartered=true;})();}}}};
    if(id==='urban_city')return {title:'第一座城市',text:['四百位实际居住的居民，持续运转的农田、诊疗、课堂、工业和供电，终于支撑起一座城市。邻居的共同服务项目也已经兑现。','居民仍需要下一轮口粮。城市之外还有独立聚居地，地区联合也还没有成为城市群。'],buttons:{city:{text:'登记城市与公共职责',nextScene:'end',onChoose:()=>{const ready=u.cityStable>=300 && this.developmentReady(s,true);return done(ready?'居民把这座家园登记为炉火城。住房、田地、工区与共同职责继续留给下一代。':'供养条件已有变化，恢复稳定后再议城市职责。',()=>{if(ready)u.city=true;})();}}}};
    return null;
  },
  note(text){if(typeof Civilization!=='undefined')Civilization.notify(text);},
  reset(){this.module=null;},
  refresh(){
    const s=State,u=s.civilization.urban;if(!u)return;
    const sources=this.sourceIds(s),current=this.sourceId(s);
    if(sources.length>1){
      const select=Civilization.button('urbanSource','接纳来源：'+this.sourceName(current),'#roadPanel',()=>{
        const ids=this.sourceIds(s),at=ids.indexOf(this.sourceId(s));u.activeSource=ids[(at+1)%ids.length];u.dispatchClock=0;Engine.saveGame();this.refresh();
      });
      select.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode('接纳来源：'+this.sourceName(current)));
      select.attr('title','切换后续接纳来源；已经启程的居民继续原旅程。新来源保留留守居民，不会重建沿路480人名册。');
    }
    if(!s.civilization.tech.standards)return;
    if(!this.module){const m=this.module={onArrival(diff){document.title='街区';Engine.moveStoresView(null,diff);}};m.tab=Header.addLocation('街区','urban',m);m.panel=$('<div>').attr('id','urbanPanel').addClass('location').appendTo('#locationSlider');$('<div>').attr('id','urbanRecord').css({width:'410px',lineHeight:'1.8',marginBottom:'20px'}).appendTo(m.panel);const cols=$('<div>').css('position','relative').appendTo(m.panel);$('<div>').attr({'id':'urbanBuildBtns','data-legend':'建设：'}).appendTo(cols);$('<div>').attr('id','urbanStructures').css({position:'absolute',left:'160px',top:0,width:'150px'}).appendTo(cols);$('<div>').attr('id','urbanPlans').appendTo(m.panel);Engine.updateSlider();}
    for(const id of Object.keys(this.buildings)){const button=Room.Craftables[id]?.button;if(button?.length && button.parent().attr('id')!=='urbanBuildBtns')button.appendTo('#urbanBuildBtns');$('#building_row_'+id).hide();let row=$('#urban_count_'+id);const n=s.game.buildings[id]||0;if(n && !row.length){row=$('<div>').addClass('storeRow').attr('id','urban_count_'+id).appendTo('#urbanStructures');$('<div>').addClass('row_key').text(_(id)).appendTo(row);$('<div>').addClass('row_val').appendTo(row);$('<div>').addClass('clear').appendTo(row);}row.toggle(n>0).find('.row_val').text(n);}
    const origin=s.civilization.origins?.nodes[current],sourceText=current==='dispersed'?'沿路名册待安置 '+this.count(u.source)+' 人':this.sourceName(current)+'现存 '+this.count(origin?.cohorts||[])+' 人（含留守居民）';
    const e=u.economy;$('#urbanRecord').text((u.city?'炉火城':u.chartered?'正式镇制':'街区')+' · 居民 '+s.game.population+' / '+CivilCatalog.capacity(s)+'，途中预留 '+this.reservedBeds(s)+' 床。'+(e?'每10秒供养余量：粮 '+Number(e.food.toFixed(2))+'，药 '+Number(e.medicine.toFixed(2))+'；儿童教学'+(e.education?'已覆盖':'不足')+'。':'')+(!u.chartered?' 镇制需要80位居民，供养、课堂与往返道路稳定180秒：'+u.townStable+'/180。':!u.city && s.civilization.tech.urbanworks?' 城市需要400位居民、健康70、低烟尘、工业实际用电4与已兑现的邻地公共项目，口粮和药品持续有余：'+u.cityStable+'/300秒。':'')+(u.registered || current!=='dispersed'?' '+sourceText+'，车队 '+u.parties.length+' 组。'+(u.enabled?u.status:'批次接纳已暂停；已启程旅队继续前行，零星到访仍按所选名册接纳。'):''));
    if(sources.length>1)$('#urbanSource').appendTo('#urbanPlans');
    if(u.registered || current!=='dispersed'){const btn=Civilization.button('urbanPlan',u.enabled?'暂停批次接纳':'安排批次接纳','#urbanPlans',()=>{u.enabled=!u.enabled;u.dispatchClock=0;Engine.saveGame();this.refresh();});btn.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(u.enabled?'暂停批次接纳':'安排批次接纳'));btn.attr('title','每批最多8人，每人6粮、0.2药、0.2工具；占2运输工往返240秒，最多2组；须预留住房和120秒口粮');}
  },
  validate(s){
    const u=s.civilization.urban;if(u===undefined)return;
    const obj=v=>v!==null && typeof v==='object' && !Array.isArray(v),integer=(v,min=0,max=1e8)=>Number.isInteger(v)&&v>=min&&v<=max,number=(v,min=0,max=1e8)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(!obj(u)||u.schema!==1 || !['registered','enabled','chartered','city'].every(k=>typeof u[k]==='boolean') || (u.city&&!u.chartered) || !integer(u.year) || u.year!==Math.floor(s.civilization.elapsed/600))throw Error('城镇状态无效');
    if(u.activeSource!==undefined && !this.sourceIds(s).includes(u.activeSource))throw Error('接纳来源无效');
    const cohorts=arr=>Array.isArray(arr)&&arr.length<=480&&arr.every(c=>obj(c)&&integer(c.age,0,79)&&integer(c.count,1,480)&&['human','mutant'].includes(c.identity));
    if(!cohorts(u.source)||!Array.isArray(u.parties)||u.parties.length>2||!integer(u.admitted,0,480)||!integer(u.deceased,0,480)||!integer(u.nextParty,1)||!number(u.dispatchClock,0,120)||typeof u.status!=='string'||u.status.length>200)throw Error('接纳名册无效');
    const ids=new Set();for(const p of u.parties){if(!obj(p)||!integer(p.id,1,u.nextParty-1)||ids.has(p.id)||!this.sourceIds(s).includes(p.source)||p.target!=='home'||!['outbound','held','returning','returning_people'].includes(p.state)||!cohorts(p.cohorts)||this.count(p.cohorts)>8||!number(p.remaining,0,120)||!integer(p.heldFor,0,120)||!number(p.rations,0,48)||(p.state==='returning'&&p.cohorts.length)||(p.state==='held'&&p.remaining!==0))throw Error('在途接纳无效');ids.add(p.id);}
    const ledger=this.count(u.source)+u.parties.filter(p=>p.source==='dispersed').reduce((n,p)=>n+this.count(p.cohorts),0)+u.admitted+u.deceased;
    if(ledger!==(u.registered?480:0)||(!u.registered && this.sourceIds(s).length===1 && (u.enabled||u.parties.length||u.nextParty!==1)))throw Error('迁徙人口总账不符');
    if(!number(u.townStable,0,180)||!number(u.cityStable,0,300))throw Error('城镇稳定度无效');
    if(u.economy!==null && (!obj(u.economy)||!number(u.economy.at,0,s.civilization.elapsed)||!number(u.economy.food,-1e8)||!number(u.economy.medicine,-1e8)||!number(u.economy.productionPower,0,100)||!['treatment','education','industrial'].every(k=>typeof u.economy[k]==='boolean')))throw Error('城市供养记录无效');
    if(s.civilization.pending==='urban_register' && (u.registered || this.discovered(s)<2))throw Error('登记待办无效');
    if(s.civilization.pending==='urban_charter' && u.chartered || s.civilization.pending==='urban_city' && u.city)throw Error('建制待办重复');
  }
};
