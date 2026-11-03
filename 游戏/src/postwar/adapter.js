/* MPL-2.0 — ADR-native extension. UI primitives and room/forest simulation stay in script/. */
var Civilization = {
  defaults() {
    return {elapsed:0,speed:1,maxSpeed:1,tech:{},events:{},policy:null,policySeen:{},trust:50,hunger:0,stableFor:0,
      populationClock:0,productionClock:0,randomClock:240,policyCooldown:0,residentTime:0,
      research:null,journey:null,pending:null,settled:false,station:false,pump:false,trade:false,visited:{},buildingsSeen:{},courseRule:1};
  },
  initState() {
    State.civilization = State.civilization || this.defaults();
    State.civilization.buildingsSeen = State.civilization.buildingsSeen || {};
    State.game = State.game || {}; State.game.buildings = State.game.buildings || {};
    State.game.population = State.game.population || 0; State.game.workers=State.game.workers || {};
    CivilVillage.init(State);
    if(typeof CivilSociety!=='undefined')CivilSociety.init(State);
    if(typeof CivilIndustry!=='undefined')CivilIndustry.init(State);
    if(typeof CivilRegions!=='undefined')CivilRegions.init(State);
    if(typeof CivilUrban!=='undefined')CivilUrban.init(State);
    if(typeof CivilOrigins!=='undefined')CivilOrigins.init(State);
    if(typeof CivilMunicipal!=='undefined')CivilMunicipal.init(State);
    if(typeof CivilAdvanced!=='undefined')CivilAdvanced.init(State);
    if(typeof CivilServices!=='undefined')CivilServices.init(State);
    if(typeof CivilPassenger!=='undefined')CivilPassenger.init(State);
    if(typeof CivilFinance!=='undefined')CivilFinance.init(State);
    if(typeof CivilMetro!=='undefined')CivilMetro.init(State);
    if(typeof CivilIncidents!=='undefined')CivilIncidents.init(State);
  },
  init() {
    this.resetViewRefresh();
    CivilClock.rate = this.effectiveSpeed();
    const menu=$('<div>').addClass('menu').appendTo('body');
    $('<span>').addClass('menuBtn').attr({id:'saveMenu',role:'button',tabindex:0}).text('存档').click(()=>CivilPlatform.menu()).appendTo(menu);
    $('<span>').attr('id','speedMenu').appendTo(menu);
    this.renderSpeed();
    if(!State.civilization.events.awake) {
      CivilText.opening.forEach(t=>this.notify(t)); State.civilization.events.awake=true;
    } else this.notify('你重新翻开了'+CivilNarrative.community(State)+'的记录。');
    this.refresh();
    Engine.setInterval(()=>this.tick(),1000,false,'civilTick');
  },
  notify(text) { Notifications.notify(null,text); },
  settleEconomy(s) {
    const before={...s.stores}, result=CivilRules.settle(s), flow=result.flow;
    if(typeof CivilCourse!=='undefined'){const coop=CivilCourse.settleCoop(s,flow);if(coop)flow['制器合作社']=coop;}
    const beforeVillage={...s.stores}, care=CivilVillage.treatment(s);
    CivilVillage.settle(s);
    if(care)flow['诊所治疗']={medicine:-care};
    const villageFlow={};
    for(const key of new Set([...Object.keys(beforeVillage),...Object.keys(s.stores)])){
      const n=(s.stores[key]||0)-(beforeVillage[key]||0)+(key==='medicine'?care:0);
      if(Math.abs(n)>1e-8)villageFlow[key]=n;
    }
    if(Object.keys(villageFlow).length)flow['河谷运输']=villageFlow;
    if(typeof CivilSociety!=='undefined')Object.assign(flow,CivilSociety.settle(s));
    if(typeof CivilIndustry!=='undefined')Object.assign(flow,CivilIndustry.settle(s));
    if(typeof CivilRegions!=='undefined')Object.assign(flow,CivilRegions.settle(s));
    if(typeof CivilOrigins!=='undefined')Object.assign(flow,CivilOrigins.settle(s));
    if(typeof CivilFinance!=='undefined'){const paid=CivilFinance.settle(s);if(Object.keys(paid).length)flow['共同记录']=paid;}
    if(typeof CivilNation!=='undefined'){const paid=CivilNation.settle(s);if(Object.keys(paid).length)flow['国家公共记录']=paid;}
    if(typeof CivilDiplomacy!=='undefined'){const paid=CivilDiplomacy.settle(s);if(Object.keys(paid).length)flow['居留公约记录']=paid;}
    if(typeof CivilSecurity!=='undefined'){const paid=CivilSecurity.settle(s);if(Object.keys(paid).length)flow['守备']=paid;}
    if(typeof CivilAccession!=='undefined'){const paid=CivilAccession.settle(s);if(Object.keys(paid).length)flow['加盟共同记录']=paid;}
    if(typeof CivilFrontier!=='undefined'){const paid=CivilFrontier.settle(s);if(Object.keys(paid).length)flow['渡口驻防与伤员']=paid;}
    if(typeof CivilCorridor!=='undefined'){const paid=CivilCorridor.settle(s);if(Object.keys(paid).length)flow['加盟道路维护']=paid;}
    if(typeof CivilPartnership!=='undefined'){const paid=CivilPartnership.settle(s);if(Object.keys(paid).length)flow['地区商约记录']=paid;}
    if(typeof CivilWorld!=='undefined'){const paid=CivilWorld.settle(s);if(Object.keys(paid).length)flow['国家远域公共预算']=paid;}
    if(typeof CivilSpace!=='undefined'){const paid=CivilSpace.settle(s);if(Object.keys(paid).length)flow['航天验证与测控']=paid;}
    const deltas={};
    for(const key of new Set([...Object.keys(before),...Object.keys(s.stores)]))deltas[key]=(s.stores[key]||0)-(before[key]||0);
    if(typeof CivilUrban!=='undefined')Object.assign(flow,CivilUrban.settle(s,{flow,deltas}));
    if(typeof CivilFinance!=='undefined')CivilFinance.observe(s);
    if(typeof CivilMetro!=='undefined')CivilMetro.observe(s);
    return {...result,flow};
  },
  tick() {
    const c=State.civilization; c.elapsed++; c.policyCooldown=Math.max(0,c.policyCooldown-1);
    c.productionClock++; c.populationClock++;
    if(!Events.activeEvent() && !c.pending)c.randomClock=Math.max(0,c.randomClock-1);
    if(State.game.population) c.residentTime++;
    if($SM.get('game.builder.level')===3) {
      $SM.set('game.builder.level',4);
      this.notify('工匠把工具铺在炉边。她能修东西，也愿意帮你收集燃料。');
      Room.updateBuildButtons();
    }
    if(c.productionClock>=10) {
      c.productionClock-=10;
      const before=c.hunger, wasSupplied=c.outpostSupplied; this.settleEconomy(State);
      if(c.outpostSupplied===false && wasSupplied!==false) this.notify('补给外站缺少维护物资。联系暂时中断；备足食物和木料后会恢复。');
      if(c.outpostSupplied===true && wasSupplied===false) this.notify('补给再次送到了外站。管线巡视恢复了。');
      if(c.hunger>=30 && before<30) this.notify('口粮不够了。居民空着肚子工作，动作慢了下来。');
      if(before>0 && c.hunger===0) this.notify('每个人又分到了食物。工作渐渐恢复正常。');
      if(c.hunger>=180 && State.game.population>0) {
        Outside.killVillagers(1); c.hunger=90;
        this.notify('一位居民带走了自己的包裹。这里已经连续太久没有足够的食物。');
      }
      $SM.fireUpdate('stores'); this.updateIncome();
    }
    if(c.populationClock>=60) { c.populationClock-=60; this.arrivals(); }
    if(!c.settled) {
      c.stableFor=CivilRules.stable(State)?c.stableFor+1:0;
      if(c.stableFor>=60) {
        c.settled=true;this.unlockSpeed(false);
        this.notify('粮棚有余粮，炉边有干柴。人们开始把这里叫作聚落。工匠提议收拾一间工坊。');
        this.notify('分工稳定了。现在可以按自己的节奏切换 1× 或 2×。');
        this.renderSpeed();
      }
    }
    if(c.research) {
      c.research.remaining=Math.max(0,c.research.remaining-(typeof CivilSociety!=='undefined'?CivilSociety.researchSpeed(State):1));
      if(c.research.remaining===0) {
        const id=c.research.id;c.tech[id]=true;c.research=null;
        this.notify(CivilText.research[id].done); this.updateIncome();
        this.lastTech=id;
      }
    }
    if(c.journey) {
      c.journey.remaining=Math.max(0,c.journey.remaining-1);
      if(c.journey.remaining===0 && !c.pending) {
        c.pending=c.journey.id; c.journey=null;
      }
    }
    const populationBefore=State.game.population, storesBefore={...State.stores};
    if(typeof CivilSociety!=='undefined')CivilSociety.tick(State);
    this.syncDecisionSpeed();
    if(typeof CivilIndustry!=='undefined')CivilIndustry.tick(State);
    if(typeof CivilFinance!=='undefined')CivilFinance.tick(State);
    if(typeof CivilDiplomacy!=='undefined')CivilDiplomacy.tick(State);
    if(typeof CivilIncidents!=='undefined')CivilIncidents.tick(State,!Events.activeEvent()&&!c.pending);
    if(typeof CivilRailway!=='undefined')CivilRailway.tick(State);
    if(typeof CivilRegions!=='undefined')CivilRegions.tick(State);
    if(typeof CivilOrigins!=='undefined')CivilOrigins.tick(State);
    if(typeof CivilMunicipal!=='undefined')CivilMunicipal.tick(State);
    if(typeof CivilCulture!=='undefined')CivilCulture.tick(State);
    if(typeof CivilRuins!=='undefined')CivilRuins.tick(State);
    if(typeof CivilExpedition!=='undefined'){const r=CivilExpedition.tick(State);if(r==='joined')this.notify('储藏室的老测量员带着两个徒弟搬进了聚落。他记得旧城的道路编号。');if(r==='rested')this.notify('受伤的队员养好了伤，重新回到岗位。');}
    if(typeof CivilServices!=='undefined')CivilServices.tick(State);
    if(typeof CivilPlanning!=='undefined')CivilPlanning.tick(State);
    if(typeof CivilUrban!=='undefined')CivilUrban.tick(State);
    if(typeof CivilMetro!=='undefined'&&CivilMetro.finalize)CivilMetro.finalize(State);
    if(typeof CivilNation!=='undefined')CivilNation.observe(State);
    if(typeof CivilDiplomacy!=='undefined')CivilDiplomacy.observe(State);
    if(typeof CivilAccession!=='undefined')CivilAccession.observe(State);
    if(typeof CivilCommerce!=='undefined')CivilCommerce.tick(State);
    if(typeof CivilFrontier!=='undefined')CivilFrontier.tick(State);
    if(typeof CivilIntercity!=='undefined')CivilIntercity.tick(State);
    if(typeof CivilCorridor!=='undefined')CivilCorridor.tick(State);
    if(typeof CivilPartnership!=='undefined'){CivilPartnership.observe(State);CivilPartnership.tick(State);}
    if(typeof CivilWorld!=='undefined')CivilWorld.tick(State);
    this.unlockSpeed(true);
    // Cohorts, births and arriving parties reconcile before publishing native UI updates.
    if(State.game.population!==populationBefore){Outside.updateVillage();this.updateIncome();}
    if(Object.keys(State.stores).some(k=>State.stores[k]!==storesBefore[k])){$SM.fireUpdate('stores');this.updateIncome();}
    this.refreshSuccessionEvent();
    if(!Events.activeEvent()) {
      if(c.pending) this.showPending();
      else if(!c.policy && State.game.population>=2 && ((State.stores.food || 0)<16 || c.residentTime>=60)) this.policyEvent();
      else if(c.station && !c.events.merchant) {c.pending='merchant';this.showPending();}
      else if(typeof CivilSociety!=='undefined' && CivilSociety.nextEvent(State)){c.pending=CivilSociety.nextEvent(State);this.showPending();}
      else if(typeof CivilCourse!=='undefined' && CivilCourse.nextEvent(State)){c.pending=CivilCourse.nextEvent(State);this.showPending();}
      else if(typeof CivilRegions!=='undefined' && CivilRegions.nextEvent(State)){c.pending=CivilRegions.nextEvent(State);this.showPending();}
      else if(typeof CivilOrigins!=='undefined' && CivilOrigins.nextEvent(State)){c.pending=CivilOrigins.nextEvent(State);this.showPending();}
      else if(typeof CivilMunicipal!=='undefined' && CivilMunicipal.nextEvent(State)){c.pending=CivilMunicipal.nextEvent(State);this.showPending();}
      else if(typeof CivilUrban!=='undefined' && CivilUrban.nextEvent(State)){c.pending=CivilUrban.nextEvent(State);this.showPending();}
      else if(typeof CivilFinance!=='undefined' && CivilFinance.nextEvent(State)){c.pending=CivilFinance.nextEvent(State);this.showPending();}
      else if(typeof CivilMetro!=='undefined' && CivilMetro.nextEvent(State)){c.pending=CivilMetro.nextEvent(State);this.showPending();}
      else if(typeof CivilIncidents!=='undefined' && CivilIncidents.nextEvent(State)){c.pending=CivilIncidents.nextEvent(State);this.showPending();}
      else if(typeof CivilSecurity!=='undefined' && CivilSecurity.nextEvent(State)){c.pending=CivilSecurity.nextEvent(State);this.showPending();}
      else if(c.randomClock<=0 && State.game.population>0) this.randomEvent();
    }
    CivilVillage.tick(State); this.refreshPeriodic(); Engine.saveGame();
  },
  arrivals() {
    const c=State.civilization, p=State.game.population;
    if(typeof CivilUrban!=='undefined' && CivilUrban.handleArrival(State)){
      if(State.game.population!==p){Outside.updateVillage();this.updateIncome();}
      return;
    }
    const beds=typeof CivilUrban!=='undefined'?CivilUrban.availableBeds(State):Outside.getMaxPopulation()-p;
    if(beds<=0 || (typeof CivilHeating!=='undefined'&&CivilHeating.handed(State)?!CivilHeating.covered(State,'home',1)&&!CivilHeating.recoveryReady(State):$SM.get('game.temperature.value',true)<2) || (State.stores.food || 0)<6 || (p>0 && c.trust<15) || c.hunger) return;
    const n=Math.min(p===0?2:1,beds);
    $SM.add('game.population',n); if(typeof CivilSociety!=='undefined')CivilSociety.sync(State); c.populationClock=0;
    this.notify(p===0?'两位拾荒者循着炊烟而来。他们带着空行囊，愿意留下做工。':'一位流浪者走进聚落，问这里是否还有床位。');
    if(p===0) this.notify('添了人口，也添了吃饭的嘴。居民每 10 秒领取口粮；猎棚能让人专门寻找食物。');
  },
  updateIncome() {
    const forecast=(typeof CivilForecast==='undefined'?JSON.parse(JSON.stringify(State)):CivilForecast.copy(State));
    if(typeof CivilServices!=='undefined'&&CivilServices.data(forecast,'home'))forecast.civilization.elapsed=CivilServices.nextSettlementAt(forecast,'home');
    const flow=this.settleEconomy(forecast).flow;
    if(typeof CivilRegions!=='undefined' && State.civilization.regions?.active)flow['车队合同均摊']=CivilRegions.committedHomeFlow(State);
    State.income={};
    for(const [name,stores] of Object.entries(flow)) if(Object.values(stores).some(n=>n!==0)) State.income[name]={delay:10,stores};
    Room.updateIncomeView();
    for(const [job,name] of Object.entries(CivilCatalog.jobs)) {
      const tooltip=$('#workers_row_'+job+' .tooltip');
      if(!tooltip.length)continue;
      tooltip.empty();
      if(['smith','medic','teacher'].includes(job) && State.game.workers[job]>0 && !Object.values(flow[name]||{}).some(n=>n!==0))$('<div>').text('缺少原料，等待补给').appendTo(tooltip);
      for(const [resource,amount] of Object.entries(flow[name] || {})) {
        $('<div>').addClass('row_key').text(_(resource)).appendTo(tooltip);
        $('<div>').addClass('row_val').text(Engine.getIncomeMsg(amount,10)).appendTo(tooltip);
      }
    }
  },
  speedLimit(s=State) {
    const c=s.civilization;
    let limit=c.settled?2:1;
    if(s.game.buildings.outpost)limit=4;
    if(c.urban?.city===true&&c.tech.passenger_transport===true){
      limit=8;
      const cities=1+Object.entries(c.municipal?.nodes||{}).filter(([id,n])=>n.city===true&&Object.hasOwn(c.regions?.nodes||{},id)).length;
      if(cities>=2)limit=16;
    }
    if(limit>=16&&c.tech.orbital_survey)limit=32;
    if(limit>=32&&c.space?.unification)limit=64;
    return limit;
  },
  unlockSpeed(announce=false) {
    const c=State.civilization,limit=this.speedLimit();
    if(limit<=c.maxSpeed)return false;
    c.maxSpeed=limit;
    if(announce){
      if(limit===4)this.notify('补给线有了固定的轮值。4× 已永久开放。');
      if(limit===8)this.notify('城市与迁居车队各有了轮值安排。8× 已永久开放。');
      if(limit===32)this.notify('轨道测绘完成，32× 已永久开放。');
      if(limit===64)this.notify('地球共同法生效，64× 已永久开放。');
      if(limit===16)this.notify('两座城市已经登记了各自的公共职责。16× 已永久开放。');
      this.renderSpeed();
    }
    return true;
  },
  effectiveSpeed() { return State.civilization.society?.succession?1:State.civilization.speed; },
  syncDecisionSpeed() {
    if(typeof CivilClock==='undefined')return;
    const rate=this.effectiveSpeed();if(CivilClock.rate===rate)return;
    CivilClock.rate=rate;this.renderSpeed();
  },
  setSpeed(rate) {
    const c=State.civilization;
    if(![1,2,4,8,16,32,64].includes(rate)||rate>c.maxSpeed)return false;
    c.speed=rate;CivilClock.rate=this.effectiveSpeed();this.renderSpeed();this.updateIncome();Engine.saveGame();return true;
  },
  // Pause is a view-side hold of the shared clock, not saved: reloading resumes at the chosen rate.
  setPaused(value) {
    if(typeof CivilClock==='undefined')return false;
    CivilClock.paused=!!value;this.renderSpeed();
    this.notify(value?'时间暂停了。居民、邻居与在途小队都停在原处，没有额外产出。':'时间继续流动。');return true;
  },
  speedMenu() {
    if(Events.activeEvent()||State.civilization.pending)return false;
    // The speed button is re-rendered by choices; focus returns to it by id.
    if(typeof Events!=='undefined'&&typeof document!=='undefined')Events._returnFocus=document.getElementById?.('speedButton')||null;
    const c=State.civilization,buttons={};
    for(const rate of [1,2,4,8,16,32,64])if(rate<=c.maxSpeed)buttons['speed_'+rate]={text:rate+'×'+(c.speed===rate?'（当前）':''),nextScene:'end',onChoose:()=>this.setSpeed(rate)};
    buttons.pause={text:CivilClock.paused?'继续':'暂停',nextScene:'end',onChoose:()=>this.setPaused(!CivilClock.paused)};
    buttons.close={text:'保持当前速度',nextScene:'end'};
    Events.startEvent({title:'时间流速',scenes:{start:{text:['当前速度 '+c.speed+'×。生产、施工、旅程、居民年龄与冷却都按同一速度前进。','暂停会冻结整个世界，不提供免费的生产或撤退；刷新页面后自动继续。'],buttons}}});return true;
  },
  renderSpeed() {
    const c=State.civilization,box=$('#speedMenu').empty();
    $('<span>').addClass('menuBtn').text(CivilClock?.paused?'已暂停（'+c.speed+'×）':c.society?.succession&&c.speed>1?'速度：1×（换届后恢复'+c.speed+'×）':'速度：'+c.speed+'×').attr({id:'speedButton',role:'button',tabindex:0,'aria-label':'调整时间流速，当前'+this.effectiveSpeed()+'倍'})
      .click(()=>this.speedMenu()).on('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.speedMenu();}}).appendTo(box);
  },
  spend(cost) { const ok=CivilRules.pay(State,cost); if(ok) $SM.fireUpdate('stores'); return ok; },
  policyEvent() {
    const c=State.civilization;
    c.pending='policy';
    const buttons={};
    for(const [key,p] of Object.entries(CivilRules.policies)) buttons['policy_'+key]={
      text:p.name,nextScene:'end',onChoose:()=>{
        if(c.pending!=='policy'||Events.activeEvent()!==event)return false;
        const previous=c.policy||null,changed=previous!==key;
        if(changed && typeof CivilDecisions!=='undefined')CivilDecisions.ensure(State);
        c.policy=key;c.pending=null;c.policyCooldown=120;
        if(!c.policySeen[key]) {c.trust=Math.max(0,Math.min(100,c.trust+p.trust));c.policySeen[key]=true;}
        if(changed && typeof CivilDecisions!=='undefined')CivilDecisions.append(State,'policy',null,previous,key);
        this.notify(CivilNarrative.community(State)+'决定实行'+p.name+'。');this.updateIncome();Engine.saveGame();
      }
    };
    const event={title:'同一口锅',scenes:{start:{text:[
      '拾荒者停在粮棚边。每个人都在工作，食物该怎样分？',
      '均分：正常口粮与产出。压缩：少用四分之一食物，产出减少一成。加厚：多用四分之一食物，产出增加一成。',
      '紧缩会伤害信任。改议后需要 120 秒才能再次调整。'
    ],buttons}}};Events.startEvent(event);
  },
  refreshSuccessionEvent() {
    const active=Events.activeEvent();
    if(State.civilization.pending!=='succession'||active?.civilPending!=='succession'||typeof CivilSociety==='undefined')return false;
    if(active.civilSignature===CivilSociety.successionSignature(State))return false;
    this.showPending(true);return true;
  },
  showPending(refresh=false) {
    const c=State.civilization,id=c.pending;
    if(id==='policy') return this.policyEvent();
    const done=(message,fn)=>()=>{
      const result=fn?.();
      if(id==='succession' && result!==true){this.refreshSuccessionEvent();return false;}
      if(id.startsWith('constitution_') && result!==true)return false;
      c.pending=null;this.syncDecisionSpeed();this.notify(message);
      $SM.fireUpdate('stores');Outside.updateVillage();this.updateIncome();this.refresh();Engine.saveGame();
      return true;
    };
    let title,text,buttons;
    if(id==='station') {
      title='旧交通站';text=['候车厅的墙上挂着地球与火星之间的货运表。最后一班没有注销。','你认得表格上的航运标准。火星上的人曾经也是这里的乘客。维修图背面标着一座泵站。'];
      buttons={recover:{text:'带回资料与零件',nextScene:'end',onChoose:done('带回了泵站路线和 24 份废料。纸上的目的地仍叫火星。',()=>{
        if(!c.station) $SM.add('stores.scrap',24);c.station=true;c.visited.station=true;
      })}};
    } else if(id==='pump') {
      title='锈住的泵站';text=['水从裂开的管道漏进地下。控制柜已经停电，机械旁路还在。','维修队照着工坊的试制记录接好过滤管。必须留下补给与维护，水才不会再次断掉。'];
      buttons={repair:{text:'接通机械旁路',nextScene:'end',onChoose:done('泵轮重新转动。聚落可以沿着旧管线建立补给外站。',()=>{c.pump=true;c.visited.pump=true;})}};
    } else if(id==='salvage') {
      title='空站台';text=['拆下还能用的固定件。轨道尽头只有风。'];buttons={take:{text:'收好零件',nextScene:'end',onChoose:done('带回了 8 份废料。',()=>{$SM.add('stores.scrap',8);})}};
    } else if(id==='merchant') {
      title='河谷来的商队';text=['商队代表看见泵站图，问能否沿你们的路通行。','他们愿意用废料交换粮食。允许通行能换来长期贸易；目前还没有保卫整条商路的能力。'];
      buttons={allow:{text:'允许互助通行',nextScene:'end',onChoose:done('河谷商队记下了聚落的位置。粮食与零件可以在路口交换。',()=>{c.trade=true;c.events.merchant=true;c.trust=Math.min(100,c.trust+3);})},
        decline:{text:'暂不开放',nextScene:'end',onChoose:done('商队在旧公路留下了标记。等准备好，可以再联系他们。',()=>{c.events.merchant=true;})}};
    } else if(id==='cold') {
      title=c.urban?.city?'本城公共仓储检修':'夜里的冷风';text=[c.urban?.city?'本城公共仓储的挡风板需要检修，本轮常设维修未能完成。可以拨出木料更换，或暂停一轮生产安排人工加固。':'粮棚外的挡风板松了。工匠说，补上它要花一些木料；也可以先停下工作，一起加固。'];
      buttons={wood:{text:c.urban?.city?'拨料检修':'换上新木板',cost:{wood:10},nextScene:'end',onChoose:done(c.urban?.city?'本城维修人员更换了仓储挡风板。':'新木板挡住了寒风。')},
        hands:{text:c.urban?.city?'调配人工加固':'一起加固',nextScene:'end',onChoose:done(c.urban?.city?'本城临时调配人员加固仓储，一轮生产随之推迟。':'大家停下手里的活，用绳索把挡板重新绑好。',()=>{c.productionClock=0;})}};
    } else {
      const event=CivilVillage.event(id,done) || (typeof CivilIndustry!=='undefined'?CivilIndustry.event(id,done):null) || (typeof CivilSociety!=='undefined'?CivilSociety.event(id,done):null) || (typeof CivilRegions!=='undefined'?CivilRegions.event(id,done):null) || (typeof CivilUrban!=='undefined'?CivilUrban.event(id,done):null) || (typeof CivilOrigins!=='undefined'?CivilOrigins.event(id,done):null) || (typeof CivilMunicipal!=='undefined'?CivilMunicipal.event(id,done):null) || (typeof CivilFinance!=='undefined'?CivilFinance.event(id,done):null) || (typeof CivilMetro!=='undefined'?CivilMetro.event(id,done):null) || (typeof CivilNation!=='undefined'?CivilNation.event(id,done):null) || (typeof CivilDiplomacy!=='undefined'?CivilDiplomacy.event(id,done):null) || (typeof CivilRailway!=='undefined'?CivilRailway.event(id,done):null) || (typeof CivilCommerce!=='undefined'?CivilCommerce.event(id,done):null) || (typeof CivilSecurity!=='undefined'?CivilSecurity.event(id,done):null) || (typeof CivilAccession!=='undefined'?CivilAccession.event(id,done):null) || (typeof CivilFrontier!=='undefined'?CivilFrontier.event(id,done):null) || (typeof CivilIntercity!=='undefined'?CivilIntercity.event(id,done):null) || (typeof CivilCorridor!=='undefined'?CivilCorridor.event(id,done):null) || (typeof CivilPartnership!=='undefined'?CivilPartnership.event(id,done):null) || (typeof CivilWorld!=='undefined'?CivilWorld.event(id,done):null) || (typeof CivilStatecraft!=='undefined'?CivilStatecraft.event(id,done):null) || (typeof CivilForeign!=='undefined'?CivilForeign.event(id,done):null) || (typeof CivilLeagues!=='undefined'?CivilLeagues.event(id,done):null) || (typeof CivilTransit!=='undefined'?CivilTransit.event(id,done):null) || (typeof CivilMarkets!=='undefined'?CivilMarkets.event(id,done):null) || (typeof CivilCongress!=='undefined'?CivilCongress.event(id,done):null) || (typeof CivilSettlement!=='undefined'?CivilSettlement.event(id,done):null) || (typeof CivilAftermath!=='undefined'?CivilAftermath.event(id,done):null) || (typeof CivilSpace!=='undefined'?CivilSpace.event(id,done):null) || (typeof CivilIncidents!=='undefined'?CivilIncidents.event(id,done):null) || (typeof CivilCulture!=='undefined'?CivilCulture.event(id):null) || (typeof CivilCooperative!=='undefined'?CivilCooperative.event(id):null) || (typeof CivilRuins!=='undefined'?CivilRuins.event(id):null) || (typeof CivilCourse!=='undefined'?CivilCourse.event(id,done):null);
      if(!event){c.pending=null;return;}
      ({title,text,buttons}=event);
    }
    const event={title,scenes:{start:{text,buttons}}};
    if(id==='succession'){
      event.civilPending=id;event.civilSignature=CivilSociety.successionSignature(State);
      const active=Events.activeEvent();
      if(refresh && active?.civilPending===id){
        Object.assign(active,event);
        if(active.eventPanel)active.eventPanel.find('.eventTitle').text(title);
        if(typeof Events.loadScene==='function')Events.loadScene('start');
        return;
      }
    }
    Events.startEvent(event);
    if(id.startsWith('aftermath')||id.startsWith('congress')||id.startsWith('market')||id.startsWith('transit')||id.startsWith('league')||id.startsWith('foreignPair_')||id==='foreignCouncil'||id==='foreignAccounts'||id.startsWith('foreign_')||id==='statecraftCouncil'||id.startsWith('accord_')||id==='spaceCouncil'||id==='worldCouncil'||id.startsWith('world_')||id==='regionalPartners'||id.startsWith('culture_')||id.startsWith('cooperative_')||id.startsWith('ruin_'))event.eventPanel?.addClass('civil-culture-event');
    if(id==='aftermathCouncil'||id==='transitCouncil'||id==='marketCouncil')event.eventPanel?.addClass('civil-transit-overview');
  },
  randomEvent() {
    const c=State.civilization; c.randomClock=180+Math.floor(Math.random()*181);
    if(Math.random()<.5) {
      // Routine shelter work becomes an actual paid municipal duty after town chartering.
      if(c.urban?.chartered && (State.game.workers.smith||0)>0 && this.spend({wood:10,tools:.5})) {
        this.notify(CivilNarrative.maintenance(State));
      } else if(c.tech.weather && !c.urban?.chartered && this.spend({wood:4})) {
        this.notify('寒潮预报提前半天发出。轮值的人用 4 份木料绑紧了粮棚挡板，工作没有停下。');
      } else {c.pending='cold';this.showPending();}
    }
    else this.notify(CivilNarrative.wildlife(State));
  },
  research(id) {
    const c=State.civilization,r=CivilText.research[id],cost=typeof CivilCourse!=='undefined'&&c.course?CivilCourse.researchCost(State,id):r?.cost;
    if(!r || c.research || c.tech[id] || !CivilCatalog.researchAvailable(State,id) || !this.spend(cost)) return;
    c.research={id,remaining:r.duration};this.notify((c.urban?.city?'研究团队开始试制':'工坊开始试制')+r.name+'。');this.refresh();Engine.saveGame();
  },
  depart(id) {
    const c=State.civilization;
    const extra=CivilVillage.journeys[id] || (typeof CivilIndustry!=='undefined'?CivilIndustry.journeys[id]:null) || (typeof CivilRegions!=='undefined'?CivilRegions.journeys[id]:null);
    if(extra && !extra.allowed(State))return;
    if(!extra && !['station','pump','salvage'].includes(id))return;
    if(!extra && typeof CivilExpedition!=='undefined')return; // walked on the near-field map instead
    const cost=extra?extra.cost:id==='pump'?{food:8,wood:20,scrap:12}:{food:id==='salvage'?4:8};
    if(c.journey || c.pending || Events.activeEvent() || (id==='pump' && (!c.station || !c.tech.water || c.pump)) || !State.game.buildings.workshop || !this.spend(cost)) return;
    c.journey={id,remaining:extra?extra.duration:id==='pump'?180:120};
    this.notify(extra?(extra.departure || (id==='geology'?'勘察队带上工具和旧地图，走向山坡下的矿带。':'队伍带上物资，沿旧地图的标记出发。')):id==='pump'?'维修队带上管件，沿着旧管线出发。':'你带上口粮，沿旧公路走向交通站。');
    this.refresh();Engine.saveGame();
  },
  // Read-only: buildings whose existing gate names this tech and is now open.
  techUnlocks(id,s=State) {
    const out=[];
    for(const [key,def] of Object.entries(buildDefs)){
      const src=String(def.gate);if(!new RegExp('tech\\.'+id+'\\b|tech\\?\\.'+id+'\\b').test(src))continue;
      let open=false;try{open=!!def.gate();}catch(e){open=false;}
      if(open)out.push(key);
    }
    // Public-works facilities declare their research in content; they are built on the 街区 page.
    if(typeof CivilServiceContent!=='undefined')for(const [key,f] of Object.entries(CivilServiceContent.facilities))if((f.requires||[]).includes(id)&&(f.requires||[]).every(t=>s.civilization.tech[t]))out.push('services:'+key);
    return out;
  },
  // Where the native build button for a building currently lives.
  placeOf(key) {
    const btn=key.startsWith('services:')?$('#services_home_'+key.slice(9)):$('#build_'+key);if(!btn.length)return null;
    const panel=btn.closest('.location');if(!panel.length)return null;
    const mod=[Room,Outside,this.roadModule,typeof CivilIndustry!=='undefined'?CivilIndustry.module:null,typeof CivilUrban!=='undefined'?CivilUrban.module:null,typeof CivilMunicipal!=='undefined'?CivilMunicipal.module:null].find(m=>m&&m.panel&&m.panel[0]===panel[0]);
    return mod?{module:mod,button:btn}:null;
  },
  goTo(key) {
    const p=this.placeOf(key);if(!p)return false;
    Engine.travelTo(p.module);
    setTimeout(()=>{p.button[0]?.scrollIntoView?.({block:'center'});p.button.attr('tabindex',0).focus?.();p.button.addClass('civil-highlight');setTimeout(()=>p.button.removeClass('civil-highlight'),2400);},350);
    return true;
  },
  button(id,text,parent,handler,cost,cooldown) {
    let button=$('#'+id);
    if(!button.length) button=new Button.Button({id,text,click:handler,cost,cooldown,width:'100px'}).appendTo(parent);
    return button;
  },
  road() {
    if(this.roadModule) return;
    const module=this.roadModule={onArrival(diff){document.title='旧公路';Engine.moveStoresView(null,diff);}};
    module.tab=Header.addLocation('旧公路','road',module);
    module.panel=$('<div>').attr('id','roadPanel').addClass('location').appendTo('#locationSlider');
    $('<div>').attr('id','journeyStatus').appendTo(module.panel);
    Engine.updateSlider();
  },
  viewNow() { return typeof performance!=='undefined'?performance.now():Date.now(); },
  resetViewRefresh() { this.lastViewRefreshAt=undefined; },
  refreshPeriodic() {
    const now=this.viewNow();
    // Presentation follows wall time; every simulation tick and event still runs.
    if(this.lastViewRefreshAt!==undefined && now>=this.lastViewRefreshAt && now-this.lastViewRefreshAt<500)return false;
    this.lastViewRefreshAt=now;
    Outside.updateWorkersView();this.refresh();return true;
  },
  refresh() {
    // User actions call this directly and always receive an immediate fresh view.
    this.lastViewRefreshAt=this.viewNow();
    const c=State.civilization,b=State.game.buildings;
    if($('#outsidePanel').length) {
      if($SM.get('game.builder.level')>=4) this.button('forageButton','采集食物','#outsidePanel',()=>{
        $SM.add('stores.food',6);this.notify('翻过枯叶，找到一些还能食用的根茎。');
      },null,60);
      if(State.game.population>=2) this.button('scrapButton','搜集废料','#outsidePanel',()=>{
        $SM.add('stores.scrap',4);this.notify('从坍塌的护栏下找出几件可用零件。');
      },null,90);
      // Town stage: hand gathering is folded away as an emergency path (never removed).
      if(c.village?.town&&typeof document!=='undefined'&&typeof document.getElementById==='function'&&document.getElementById('outsidePanel')){
        let box=$('#civilManualGather');
        if(!box.length){box=$('<details>').attr('id','civilManualGather').addClass('civil-details civil-manual').appendTo('#outsidePanel');$('<summary>').text('手工采集（应急）').appendTo(box);$('<div>').appendTo(box);}
        for(const id of ['gatherButton','trapsButton','forageButton','scrapButton']){const b=$('#'+id);if(b.length&&!b.parent().is(box.children('div')))b.appendTo(box.children('div'));}
        const low=['wood','food'].some(k=>(State.stores[k]||0)<40);if(low&&!box.attr('open'))box.attr('open','open');
        if(!(typeof Engine!=='undefined'&&Engine.narrow?.()))box.css('top',($('#workers').outerHeight()||0)+56);
      }
      if(State.game.population>0) {
        let social=$('#socialNote');
        if(!social.length) social=$('<div>').attr('id','socialNote').appendTo('#outsidePanel');
        social.css('top',($('#workers').outerHeight()||0)+20);
        social.text('信任 '+Math.floor(c.trust)+(c.hunger>0?' · 口粮短缺':'')+(c.policy?' · '+CivilRules.policies[c.policy].name:''));
      }
    }
    if(c.policy) {
      const button=this.button('policyButton','调整配给','#roomPanel',()=>{if(!c.policyCooldown && !Events.activeEvent()) this.policyEvent();});
      Button.setDisabled(button,c.policyCooldown>0);
      button.attr('title',c.policyCooldown?'还需 '+c.policyCooldown+' 秒':'由居民共同改议口粮制度');
    }
    if(b.workshop) {
      this.road();
      let section=$('#researchBtns');
      if(!section.length) section=$('<div>').attr({id:'researchBtns','data-legend':'研究：'}).appendTo('#roomPanel');
      for(const [id,r] of Object.entries(CivilText.research)) {
        if(!CivilCatalog.researchAvailable(State,id) && !c.tech[id])continue;
        const rc=typeof CivilCourse!=='undefined'&&c.course?CivilCourse.researchCost(State,id):r.cost;
        const btn=this.button('research_'+id,r.name,section,()=>this.research(id),rc);
        if(c.course&&btn.attr('data-cost')!==JSON.stringify(rc)){btn.attr('data-cost',JSON.stringify(rc));const tip=btn.find('.tooltip').empty();for(const [k,n] of Object.entries(rc)){$('<div>').addClass('row_key').text(_(k)).appendTo(tip);$('<div>').addClass('row_val').text(n).appendTo(tip);}}
        Button.setDisabled(btn,!!c.tech[id] || !!c.research || !CivilRules.canPay(State,rc));
        btn.toggle(!c.tech[id]);
        btn.attr('title',c.tech[id]?'已掌握':c.research?.id===id?'试制中，剩余 '+Math.ceil(c.research.remaining)+' 秒':r.duration+' 秒');
      }
      let note=$('#researchStatus'); if(!note.length) note=$('<div>').attr('id','researchStatus').appendTo(section);
      note.text(c.research?CivilText.research[c.research.id].name+'：'+Math.ceil(c.research.remaining)+' 秒':'已掌握 '+Object.keys(c.tech).filter(k=>c.tech[k]).length+' 项技术');
      note.attr('title',Object.keys(c.tech).filter(k=>c.tech[k]).map(k=>CivilText.research[k].name).join('、'));
      // Completed research points to the facility it opened (read-only lookup of existing gates).
      if(typeof document!=='undefined'&&typeof document.getElementById==='function'&&document.getElementById('researchBtns')){
      let done=$('#researchUnlocks');if(!done.length)done=$('<div>').attr('id','researchUnlocks').addClass('civil-brief').appendTo(section);
      const last=this.lastTech&&c.tech[this.lastTech]?this.lastTech:null,opened=last?this.techUnlocks(last).filter(k=>k.startsWith('services:')||(State.game.buildings[k]||0)<(Room.Craftables[k]?.maximum??Infinity)):[];
      const sig=last+':'+opened.join(',');
      if(done.attr('data-sig')!==sig){done.attr('data-sig',sig).empty();
        if(last){$('<span>').text(CivilText.research[last].name+'已掌握'+(opened.length?'，可以建造：':'。')).appendTo(done);
          for(const k of opened){const name=k.startsWith('services:')?CivilServiceContent.facilities[k.slice(9)].name:_(k);this.button('researchGo_'+k.replace(':','_'),'去建 '+name,done,()=>this.goTo(k)).addClass('civil-inline');}
          if(!opened.length&&CivilText.research[last].done)$('<span>').addClass('civil-muted').text(' '+CivilText.research[last].done).appendTo(done);}}
      done.toggle(!!last);}
      // Station, pump and salvage are walked on the near-field map. Timed legacy
      // journeys that were already under way still finish under the old rule.
      const legacyWalk=typeof CivilExpedition==='undefined'||CivilExpedition.legacyJourney(State);
      if(typeof CivilExpedition!=='undefined')CivilExpedition.refresh();
      if(legacyWalk){
      const station=this.button('stationButton',c.station?'回收交通站':'沿路勘察','#roadPanel',()=>this.depart(c.station?'salvage':'station'),{food:c.station?4:8});station.toggle?.(true);
      station.find('.tooltip .row_val').text(c.station?4:8);
      Button.setDisabled(station,!!c.journey || !!c.pending || !CivilRules.canPay(State,{food:c.station?4:8}));
      // Text update preserves the cooldown and cost tooltip children.
      station.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(c.station?'回收交通站':'沿路勘察'));
      } else for(const id of ['#stationButton','#pumpButton'])$(id).toggle?.(false);
      if(c.station && legacyWalk) {
        const pump=this.button('pumpButton','修复泵站','#roadPanel',()=>this.depart('pump'),{food:8,wood:20,scrap:12});
        Button.setDisabled(pump,c.pump || !c.tech.water || !!c.journey || !!c.pending || !CivilRules.canPay(State,{food:8,wood:20,scrap:12}));
        pump.attr('title',c.pump?'泵站已经恢复':!c.tech.water?'需要先掌握净水工艺':'携带维修材料出发');
      }
      const arrivalIds=['station','salvage','pump','river','riverAid','geology',...Object.keys(typeof CivilRegions!=='undefined'?CivilRegions.journeys:{})];
      $('#journeyStatus').toggle(!!c.journey||!!(c.pending&&arrivalIds.includes(c.pending))||legacyWalk).text(c.journey?(c.journey.remaining>0?'途中 · '+Math.ceil(c.journey.remaining)+' 秒':'已经抵达，队伍等待你处理眼前的事。'):c.pending && arrivalIds.includes(c.pending)?'已经抵达，等待处理发现。':c.pump?'泵站已恢复。补给与维护将决定它能运转多久。':'旧公路穿过荒林，通向废弃的交通站。');
      if(c.events.merchant && !c.trade) this.button('contactButton','联系商队','#roadPanel',()=>{if(!Events.activeEvent()){c.pending='merchant';this.showPending();}});
      $('#contactButton').toggle(!c.trade);
      if(c.trade) {
        const trade=this.button('tradeButton','以粮换零件','#roadPanel',()=>{
          if(this.spend({food:10})){$SM.add('stores.scrap',8);this.notify('商队收下 10 份食物，交给你 8 份废料。');}
        },{food:10},60);
        Button.setDisabled(trade,!CivilRules.canPay(State,{food:10}));
      }
    }
    CivilVillage.refresh(); if(typeof CivilSociety!=='undefined')CivilSociety.refresh(); Room.updateBuildButtons(); if(typeof CivilIndustry!=='undefined')CivilIndustry.refresh();
    if(typeof CivilRegions!=='undefined')CivilRegions.refresh();
    if(typeof CivilUrban!=='undefined')CivilUrban.refresh();
    if(typeof CivilOrigins!=='undefined')CivilOrigins.refresh();
    if(typeof CivilMunicipal!=='undefined')CivilMunicipal.refresh();
    if(typeof CivilAdvanced!=='undefined')CivilAdvanced.refresh();
    if(typeof CivilServices!=='undefined')CivilServices.refresh();
    if(typeof CivilPlanning!=='undefined')CivilPlanning.refresh(State,CivilMunicipal.selected);
    if(typeof CivilHeating!=='undefined')CivilHeating.refresh();
    if(typeof CivilInterface!=='undefined')CivilInterface.refresh(State,{summaries:false});
    if(typeof CivilHearth!=='undefined')CivilHearth.refresh(State);
    if(typeof CivilFinance!=='undefined')CivilFinance.refresh(State);
    if(typeof CivilMetro!=='undefined')CivilMetro.refresh();
    if(typeof CivilNation!=='undefined')CivilNation.refresh();
    if(typeof CivilDiplomacy!=='undefined')CivilDiplomacy.refresh();
    if(typeof CivilRailway!=='undefined')CivilRailway.refresh();
    if(typeof CivilCommerce!=='undefined')CivilCommerce.refresh();
    if(typeof CivilSecurity!=='undefined')CivilSecurity.refresh();
    if(typeof CivilAccession!=='undefined')CivilAccession.refresh();
    if(typeof CivilFrontier!=='undefined')CivilFrontier.refresh();
    if(typeof CivilIntercity!=='undefined')CivilIntercity.refresh();
    if(typeof CivilCorridor!=='undefined')CivilCorridor.refresh();
    if(typeof CivilPartnership!=='undefined')CivilPartnership.refresh();
    if(typeof CivilWorld!=='undefined')CivilWorld.refresh();
    if(typeof CivilStatecraft!=='undefined')CivilStatecraft.refresh();
    if(typeof CivilForeign!=='undefined')CivilForeign.refresh();
    if(typeof CivilSpace!=='undefined')CivilSpace.refresh();
    if(typeof CivilIncidents!=='undefined')CivilIncidents.refresh();
    if(typeof CivilHistory!=='undefined')CivilHistory.refresh(State);
    if(typeof CivilGuide!=='undefined'&&$SM.get('game.builder.level')>=4)CivilGuide.refresh(State);
    if(typeof CivilNav!=='undefined')CivilNav.order();
    $('#stores').attr('data-legend',c.urban?.city?'炉火城库存':_('stores'));
  },
  restart(state) {
    this.resetViewRefresh();
    CivilClock.stop(); $('*').stop(true,true);
    Engine.topics={};Engine.activeModule=null;Engine.keyLock=false;Engine.tabNavigation=true;
    Room.buttons={};Room.changed=false;Room.pathDiscovery=false;Outside._popTimeout=undefined;
    for(const item of Object.values(Room.Craftables)) item.button=null;
    this.roadModule=null;if(typeof CivilExpedition!=='undefined')CivilExpedition.reset();if(typeof CivilSociety!=='undefined')CivilSociety.module=null;if(typeof CivilIndustry!=='undefined')CivilIndustry.reset();Notifications.notifyQueue={};
    if(typeof CivilRegions!=='undefined')CivilRegions.reset();
    if(typeof CivilUrban!=='undefined')CivilUrban.reset();
    if(typeof CivilOrigins!=='undefined')CivilOrigins.reset();
    if(typeof CivilMunicipal!=='undefined')CivilMunicipal.reset();
    if(typeof CivilAdvanced!=='undefined')CivilAdvanced.reset();
    if(typeof CivilServices!=='undefined')CivilServices.reset();
    if(typeof CivilInterface!=='undefined')CivilInterface.reset();
    if(typeof CivilRegionMap!=='undefined')CivilRegionMap.reset();
    if(typeof CivilHistory!=='undefined')CivilHistory.reset();
    if(typeof CivilFinance!=='undefined')CivilFinance.reset();
    if(typeof CivilMetro!=='undefined')CivilMetro.reset();
    $('.menu,#notifications,#event,#eventblocker').remove();$('#main').html('<div id="header"></div>');
    Engine.init({state});
  }
};

// ADR catalog remains a native Room.Craftables table, with the same build and inventory rendering.
Room.Craftables={}; Room.TradeGoods={};
const buildDefs={
  trap:{cost:()=>({wood:10+$SM.get('game.buildings.trap',true)*10}),max:5,gate:()=>true},
  cart:{cost:()=>({wood:30}),max:1,gate:()=>true},
  hut:{cost:()=>({wood:100+$SM.get('game.buildings.hut',true)*50}),max:4,gate:()=>true},
  lodge:{cost:()=>({wood:60,food:6}),max:1,gate:()=>State.game.buildings.hut>0},
  granary:{cost:()=>({wood:60}),max:1,gate:()=>State.game.population>=2},
  workshop:{cost:()=>({wood:100,scrap:12}),max:1,gate:()=>State.civilization.settled},
  cistern:{cost:()=>({wood:80,scrap:16}),max:1,gate:()=>State.civilization.tech.water && State.civilization.station},
  outpost:{cost:()=>({wood:120,scrap:20,food:20}),max:1,gate:()=>State.civilization.pump && State.civilization.tech.metal && State.game.buildings.cistern && State.game.population>=8}
};
Object.assign(buildDefs,CivilVillage.buildings,typeof CivilIndustry!=='undefined'?CivilIndustry.buildings:{},typeof CivilRegions!=='undefined'?CivilRegions.buildings:{},typeof CivilUrban!=='undefined'?CivilUrban.buildings:{},typeof CivilAdvanced!=='undefined'?CivilAdvanced.buildings:{});
// A chosen course may build the same facility from different real materials.
for(const [id,def] of Object.entries(buildDefs)){const base=def.cost;def.cost=()=>{const f=typeof CivilCourse!=='undefined'?CivilCourse.costs[CivilCourse.id(State)]?.[id]:null;return f?f():base();};}
for(const [id,def] of Object.entries(buildDefs)) Room.Craftables[id]={name:_(id),button:null,type:'building',maximum:def.max,cost:def.cost,availableMsg:CivilText.buildings[id][0],buildMsg:CivilText.buildings[id][1]};
Room.craftUnlocked=function(id) {
  if(Room.buttons[id] || State.civilization.buildingsSeen?.[id]) {Room.buttons[id]=true;return true;}
  if($SM.get('game.builder.level')<4 || !buildDefs[id].gate()) return false;
  if(State.game.buildings[id]>0) {Room.buttons[id]=true;return true;}
  const cost=buildDefs[id].cost();
  if((State.stores.wood || 0)<cost.wood*.5) return false;
  Room.buttons[id]=true;State.civilization.buildingsSeen[id]=true;Civilization.notify(Room.Craftables[id].availableMsg);return true;
};
const adrBuild=Room.build;
Room.build=function(button) {
  const id=button.attr('buildThing'),before=State.game.buildings[id] || 0;
  if(!buildDefs[id]?.gate())return;
  if(CivilCatalog.buildingLimit)Room.Craftables[id].maximum=CivilCatalog.buildingLimit(State,id);
  adrBuild(button);
  if(id==='granary' && (State.game.buildings[id] || 0)>before) Civilization.notify('工匠估算，四位居民、六十份木料、二十份食物，足以让大家安稳一阵。等储备稳住，再筹备工坊。');
  Civilization.unlockSpeed(true);
  Outside.updateVillage(); Outside.updateWorkersView(); Civilization.refresh(); Civilization.updateIncome();
};
const adrBuildButtons=Room.updateBuildButtons;
Room.updateBuildButtons=function() {
  if(CivilCatalog.buildingLimit)for(const [id,item]of Object.entries(Room.Craftables))item.maximum=CivilCatalog.buildingLimit(State,id);
  adrBuildButtons();
  for(const [id,item] of Object.entries(Room.Craftables)) if(item.button) {
    Button.setDisabled(item.button,!buildDefs[id].gate() || (State.game.buildings[id] || 0)>=item.maximum || !CivilRules.canPay(State,item.cost()) || !(typeof CivilHeating!=='undefined'?CivilHeating.workshopReady(State):$SM.get('game.temperature.value',true)>=2));
  }
};
Outside._INCOME={gatherer:{name:'采木工',delay:10,stores:{wood:1}},hunter:{name:'猎人',delay:10,stores:{food:.8,fur:.3}},salvager:{name:'回收工',delay:10,stores:{scrap:.5}}};
for(const [id,name] of Object.entries(CivilCatalog.jobs))if(!Outside._INCOME[id])Outside._INCOME[id]={name,delay:10,stores:{}};
Outside.getMaxPopulation=function(){return CivilCatalog.capacity(State);};
Outside.increaseWorker=function(event){
  const job=$(this).closest('.workerRow').attr('key');
  const cap=CivilCatalog.jobCapacity(State,job);
  const n=Math.min(Outside.getNumGatherers(),Number(event.data),cap-(State.game.workers[job]||0));
  if(n>0)$SM.add('game.workers.'+job,n);
};
const adrDecreaseWorker=Outside.decreaseWorker;
Outside.decreaseWorker=function(event){
  const job=$(this).closest('.workerRow').attr('key'),floor=typeof CivilFrontier==='undefined'?0:job==='guard'?CivilFrontier.guardFloor(State):job==='transporter'&&CivilFrontier.active(State)?CivilRegions.reservedTransport(State)+CivilUrban.reservedTransport(State)+2:0;
  if(!floor)return adrDecreaseWorker.call(this,event);
  const n=Math.min(Number(event.data),Math.max(0,(State.game.workers[job]||0)-floor));if(n>0)$SM.add('game.workers.'+job,-n);
};
Outside.getNumGatherers=function(){return (typeof CivilSociety!=='undefined'?CivilSociety.workforce(State):Math.max(0,State.game.population-(typeof CivilExpedition!=='undefined'?CivilExpedition.unavailable(State):0)))-Object.values(State.game.workers).reduce((a,b)=>a+b,0);};
const adrWorkersView=Outside.updateWorkersView;
Outside.updateWorkersView=function(){
  adrWorkersView();
  $('#workers_row_gatherer > .row_val > span').text(Outside.getNumGatherers());
  for(const [job,n]of Object.entries(State.game.workers)){
    const cap=CivilCatalog.jobCapacity(State,job);
    $('#workers_row_'+job+' .upBtn,#workers_row_'+job+' .upManyBtn').toggleClass('disabled',n>=cap || Outside.getNumGatherers()<=0);
    const floor=typeof CivilFrontier==='undefined'?0:job==='guard'?CivilFrontier.guardFloor(State):job==='transporter'&&CivilFrontier.active(State)?CivilRegions.reservedTransport(State)+CivilUrban.reservedTransport(State)+2:0;
    if(floor)$('#workers_row_'+job+' .dnBtn,#workers_row_'+job+' .dnManyBtn').toggleClass('disabled',n<=floor);
    $('#workers_row_'+job).attr('title',(Number.isFinite(cap)?'岗位上限 '+cap:'')+(floor?'；在外职责至少占 '+floor+' 人':''));
  }
};
Outside.checkWorker=function(name) {
  const job=CivilCatalog.jobBuildings[name];
  if(job && State.game.buildings[name]>0 && State.game.workers[job]===undefined) {$SM.set('game.workers.'+job,0);return true;}
  return false;
};
Outside.schedulePopIncrease=function() {}; // Migration belongs to the persistent civilization tick.
Outside.updateVillageIncome=function() {Civilization.updateIncome();};
Outside.checkTraps=function() {
  const n=State.game.buildings.trap || 0;$SM.addM('stores',{food:n*2,fur:n});
  Civilization.notify('陷阱带回 '+n*2+' 份食物和 '+n+' 张毛皮。');
};
$SM.collectIncome=function() {}; // Atomic food + production settlement replaces independent ADR jobs.
Events.init=function() { Events.eventStack=[];$.Dispatch('stateUpdate').subscribe(Events.handleStateUpdates); };
// Prevent double choices during the native event fade-out.
const adrEventClick=Events.buttonClick;
Events.buttonClick=function(btn) {
  if(Events._choosing)return;
  if(Events.activeEvent()?.civilPending==='succession'){
    // A stale DOM click must not select a replacement option or close a failed handover.
    if(Civilization.refreshSuccessionEvent())return;
    const info=Events.activeEvent().scenes.start.buttons[btn.attr('id')];if(!info)return;
    Events._choosing=true;
    try{if(info.onChoose()===true)Events.endEvent();}
    finally{setTimeout(()=>{Events._choosing=false;},250);}
    return;
  }
  Events._choosing=true;try{adrEventClick(btn);}finally{setTimeout(()=>{Events._choosing=false;},250);}
};
const adrEventStart=Events.startEvent;
Events.startEvent=function(event,options) {if(Events.activeEvent())return;adrEventStart(event,options);};
// Audio is deliberately absent until this adaptation has its own working sound design.
for(const key of ['playSound','playBackgroundMusic','playEventMusic','stopEventMusic','loadAudioFile']) AudioEngine[key]=function() {};
Notifications.notify=function(module,text,noQueue) {
  if(typeof text!=='string')return;
  if(!/[。！？.!?]$/.test(text))text+='。';
  Notifications.printMessage(text);Engine.saveGame();
};

const adrOutsideTitle=Outside.setTitle;
Outside.setTitle=function() {
  if(State.civilization.settled) {
    const name=State.civilization.urban?.city?'炉火城':State.civilization.urban?.chartered?'河谷镇':State.civilization.village?.town?'河谷小镇':'荒林聚落';
    $('#location_outside').text(name);
    $('#village').attr('data-legend',State.civilization.urban?.city?name+' · 居民与岗位':name);
    if(Engine.activeModule===Outside)document.title=name;
  } else adrOutsideTitle();
};
