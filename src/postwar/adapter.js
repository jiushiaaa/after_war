/* MPL-2.0 — ADR-native extension. UI primitives and room/forest simulation stay in script/. */
var Civilization = {
  defaults() {
    return {elapsed:0,speed:1,maxSpeed:1,tech:{},events:{},policy:null,policySeen:{},trust:50,hunger:0,stableFor:0,
      populationClock:0,productionClock:0,randomClock:240,policyCooldown:0,residentTime:0,
      research:null,journey:null,pending:null,settled:false,station:false,pump:false,trade:false,visited:{},buildingsSeen:{}};
  },
  initState() {
    State.civilization = State.civilization || this.defaults();
    State.civilization.buildingsSeen = State.civilization.buildingsSeen || {};
    State.game = State.game || {}; State.game.buildings = State.game.buildings || {};
    State.game.population = State.game.population || 0; State.game.workers=State.game.workers || {};
    CivilVillage.init(State);
  },
  init() {
    CivilClock.rate = State.civilization.speed;
    const menu=$('<div>').addClass('menu').appendTo('body');
    $('<span>').addClass('menuBtn').attr({id:'saveMenu',role:'button',tabindex:0}).text('存档').click(()=>CivilPlatform.menu()).appendTo(menu);
    $('<span>').attr('id','speedMenu').appendTo(menu);
    this.renderSpeed();
    if(!State.civilization.events.awake) {
      CivilText.opening.forEach(t=>this.notify(t)); State.civilization.events.awake=true;
    } else this.notify('你重新翻开了聚落的记录。');
    this.refresh();
    Engine.setInterval(()=>this.tick(),1000,false,'civilTick');
  },
  notify(text) { Notifications.notify(null,text); },
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
      const before=c.hunger, wasSupplied=c.outpostSupplied; CivilRules.settle(State); CivilVillage.settle(State);
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
        c.settled=true;c.maxSpeed=2;
        this.notify('粮棚有余粮，炉边有干柴。人们开始把这里叫作聚落。工匠提议收拾一间工坊。');
        this.notify('分工稳定了。现在可以按自己的节奏切换 1× 或 2×。');
        this.renderSpeed();
      }
    }
    if(c.research) {
      c.research.remaining=Math.max(0,c.research.remaining-1);
      if(c.research.remaining===0) {
        const id=c.research.id;c.tech[id]=true;c.research=null;
        this.notify(CivilText.research[id].done); this.updateIncome();
      }
    }
    if(c.journey) {
      c.journey.remaining=Math.max(0,c.journey.remaining-1);
      if(c.journey.remaining===0 && !c.pending) {
        c.pending=c.journey.id; c.journey=null;
      }
    }
    if(!Events.activeEvent()) {
      if(c.pending) this.showPending();
      else if(!c.policy && State.game.population>=2 && ((State.stores.food || 0)<16 || c.residentTime>=60)) this.policyEvent();
      else if(c.station && !c.events.merchant) {c.pending='merchant';this.showPending();}
      else if(c.randomClock<=0 && State.game.population>0) this.randomEvent();
    }
    CivilVillage.tick(State); this.refresh(); Engine.saveGame();
  },
  arrivals() {
    const c=State.civilization, capacity=Outside.getMaxPopulation(), p=State.game.population;
    if(p>=capacity || $SM.get('game.temperature.value',true)<2 || (State.stores.food || 0)<6 || (p>0 && c.trust<15) || c.hunger) return;
    const n=Math.min(p===0?2:1,capacity-p);
    $SM.add('game.population',n); c.populationClock=0;
    this.notify(p===0?'两位拾荒者循着炊烟而来。他们带着空行囊，愿意留下做工。':'一位流浪者走进聚落，问这里是否还有床位。');
    if(p===0) this.notify('添了人口，也添了吃饭的嘴。居民每 10 秒领取口粮；猎棚能让人专门寻找食物。');
  },
  updateIncome() {
    const forecast=JSON.parse(JSON.stringify(State));
    const flow=CivilRules.settle(forecast).flow;
    const care=CivilVillage.treatment(forecast);
    if(care)flow['诊所治疗']={medicine:-care};
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
  renderSpeed() {
    const c=State.civilization, box=$('#speedMenu').empty();
    if(c.maxSpeed===1) return;
    for(const n of [1,2,4]) if(n<=c.maxSpeed) {
      $('<span>').text(n+'×').attr({role:'button',tabindex:0,'aria-label':n+'倍速'})
        .toggleClass('selected',c.speed===n).click(()=>{
          c.speed=n;CivilClock.rate=n;this.renderSpeed();this.updateIncome();Engine.saveGame();
        }).appendTo(box);
    }
  },
  spend(cost) { const ok=CivilRules.pay(State,cost); if(ok) $SM.fireUpdate('stores'); return ok; },
  policyEvent() {
    const c=State.civilization;
    c.pending='policy';
    const buttons={};
    for(const [key,p] of Object.entries(CivilRules.policies)) buttons['policy_'+key]={
      text:p.name,nextScene:'end',onChoose:()=>{
        c.policy=key;c.pending=null;c.policyCooldown=120;
        if(!c.policySeen[key]) {c.trust=Math.max(0,Math.min(100,c.trust+p.trust));c.policySeen[key]=true;}
        this.notify('聚落决定实行'+p.name+'。');this.updateIncome();Engine.saveGame();
      }
    };
    Events.startEvent({title:'同一口锅',scenes:{start:{text:[
      '拾荒者停在粮棚边。每个人都在工作，食物该怎样分？',
      '均分：正常口粮与产出。压缩：少用四分之一食物，产出减少一成。加厚：多用四分之一食物，产出增加一成。',
      '紧缩会伤害信任。改议后需要 120 秒才能再次调整。'
    ],buttons}}});
  },
  showPending() {
    const c=State.civilization,id=c.pending;
    if(id==='policy') return this.policyEvent();
    const done=(message,fn)=>()=>{fn?.();c.pending=null;this.notify(message);Engine.saveGame();};
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
      title='夜里的冷风';text=['粮棚外的挡风板松了。工匠说，补上它要花一些木料；也可以先停下工作，一起加固。'];
      buttons={wood:{text:'换上新木板',cost:{wood:10},nextScene:'end',onChoose:done('新木板挡住了寒风。')},
        hands:{text:'一起加固',nextScene:'end',onChoose:done('大家停下手里的活，用绳索把挡板重新绑好。',()=>{c.productionClock=0;})}};
    } else {
      const event=CivilVillage.event(id,done);
      if(!event){c.pending=null;return;}
      ({title,text,buttons}=event);
    }
    Events.startEvent({title,scenes:{start:{text,buttons}}});
  },
  randomEvent() {
    const c=State.civilization; c.randomClock=180+Math.floor(Math.random()*181);
    if(Math.random()<.5) { c.pending='cold'; this.showPending(); }
    else this.notify('林边出现一串陌生的兽足。猎人把足迹记在木板上，避开了那片洼地。');
  },
  research(id) {
    const c=State.civilization,r=CivilText.research[id];
    if(!r || c.research || c.tech[id] || !CivilCatalog.researchAvailable(State,id) || !this.spend(r.cost)) return;
    c.research={id,remaining:r.duration};this.notify('工坊开始试制'+r.name+'。');this.refresh();Engine.saveGame();
  },
  depart(id) {
    const c=State.civilization;
    const extra=CivilVillage.journeys[id];
    if(extra && !extra.allowed(State))return;
    if(!extra && !['station','pump','salvage'].includes(id))return;
    const cost=extra?extra.cost:id==='pump'?{food:8,wood:20,scrap:12}:{food:id==='salvage'?4:8};
    if(c.journey || c.pending || Events.activeEvent() || (id==='pump' && (!c.station || !c.tech.water || c.pump)) || !State.game.buildings.workshop || !this.spend(cost)) return;
    c.journey={id,remaining:extra?extra.duration:id==='pump'?180:120};
    this.notify(extra?'队伍带上物资，沿河谷的路标出发。':id==='pump'?'维修队带上管件，沿着旧管线出发。':'你带上口粮，沿旧公路走向交通站。');
    this.refresh();Engine.saveGame();
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
  refresh() {
    const c=State.civilization,b=State.game.buildings;
    if($('#outsidePanel').length) {
      if($SM.get('game.builder.level')>=4) this.button('forageButton','采集食物','#outsidePanel',()=>{
        $SM.add('stores.food',6);this.notify('翻过枯叶，找到一些还能食用的根茎。');
      },null,60);
      if(State.game.population>=2) this.button('scrapButton','搜集废料','#outsidePanel',()=>{
        $SM.add('stores.scrap',4);this.notify('从坍塌的护栏下找出几件可用零件。');
      },null,90);
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
        const btn=this.button('research_'+id,r.name,section,()=>this.research(id),r.cost);
        Button.setDisabled(btn,!!c.tech[id] || !!c.research || !CivilRules.canPay(State,r.cost));
        btn.toggle(!c.tech[id]);
        btn.attr('title',c.tech[id]?'已掌握':c.research?.id===id?'试制中，剩余 '+Math.ceil(c.research.remaining)+' 秒':r.duration+' 秒');
      }
      let note=$('#researchStatus'); if(!note.length) note=$('<div>').attr('id','researchStatus').appendTo(section);
      note.text(c.research?CivilText.research[c.research.id].name+'：'+Math.ceil(c.research.remaining)+' 秒':'已掌握 '+Object.keys(c.tech).filter(k=>c.tech[k]).length+' 项技术');
      note.attr('title',Object.keys(c.tech).filter(k=>c.tech[k]).map(k=>CivilText.research[k].name).join('、'));
      const station=this.button('stationButton',c.station?'回收交通站':'沿路勘察','#roadPanel',()=>this.depart(c.station?'salvage':'station'),{food:c.station?4:8});
      station.find('.tooltip .row_val').text(c.station?4:8);
      Button.setDisabled(station,!!c.journey || !!c.pending || !CivilRules.canPay(State,{food:c.station?4:8}));
      // Text update preserves the cooldown and cost tooltip children.
      station.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(c.station?'回收交通站':'沿路勘察'));
      if(c.station) {
        const pump=this.button('pumpButton','修复泵站','#roadPanel',()=>this.depart('pump'),{food:8,wood:20,scrap:12});
        Button.setDisabled(pump,c.pump || !c.tech.water || !!c.journey || !!c.pending || !CivilRules.canPay(State,{food:8,wood:20,scrap:12}));
        pump.attr('title',c.pump?'泵站已经恢复':!c.tech.water?'需要先掌握净水工艺':'携带维修材料出发');
      }
      $('#journeyStatus').text(c.journey?(c.journey.remaining>0?'途中 · '+Math.ceil(c.journey.remaining)+' 秒':'已经抵达，队伍等待你处理眼前的事。'):c.pending && ['station','salvage','pump','river','riverAid'].includes(c.pending)?'已经抵达，等待处理发现。':c.pump?'泵站已恢复。补给与维护将决定它能运转多久。':'旧公路穿过荒林，通向废弃的交通站。');
      if(c.events.merchant && !c.trade) this.button('contactButton','联系商队','#roadPanel',()=>{if(!Events.activeEvent()){c.pending='merchant';this.showPending();}});
      $('#contactButton').toggle(!c.trade);
      if(c.trade) {
        const trade=this.button('tradeButton','以粮换零件','#roadPanel',()=>{
          if(this.spend({food:10})){$SM.add('stores.scrap',8);this.notify('商队收下 10 份食物，交给你 8 份废料。');}
        },{food:10},60);
        Button.setDisabled(trade,!CivilRules.canPay(State,{food:10}));
      }
    }
    CivilVillage.refresh(); Room.updateBuildButtons();
  },
  restart(state) {
    CivilClock.stop(); $('*').stop(true,true);
    Engine.topics={};Engine.activeModule=null;Engine.keyLock=false;Engine.tabNavigation=true;
    Room.buttons={};Room.changed=false;Room.pathDiscovery=false;Outside._popTimeout=undefined;
    for(const item of Object.values(Room.Craftables)) item.button=null;
    this.roadModule=null;Notifications.notifyQueue={};
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
Object.assign(buildDefs,CivilVillage.buildings);
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
  adrBuild(button);
  if(id==='granary' && (State.game.buildings[id] || 0)>before) Civilization.notify('工匠估算，四位居民、六十份木料、二十份食物，足以让大家安稳一阵。等储备稳住，再筹备工坊。');
  if(State.game.buildings.outpost && State.civilization.maxSpeed<4) {
    State.civilization.maxSpeed=4;Civilization.renderSpeed();
    Civilization.notify('补给线有了固定的轮值。4× 已永久开放。远处还有更多聚居地，但这条路才刚开始。');
  }
  Outside.updateVillage(); Outside.updateWorkersView(); Civilization.refresh(); Civilization.updateIncome();
};
const adrBuildButtons=Room.updateBuildButtons;
Room.updateBuildButtons=function() {
  adrBuildButtons();
  for(const [id,item] of Object.entries(Room.Craftables)) if(item.button) {
    Button.setDisabled(item.button,(State.game.buildings[id] || 0)>=item.maximum || !CivilRules.canPay(State,item.cost()) || $SM.get('game.temperature.value',true)<2);
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
const adrWorkersView=Outside.updateWorkersView;
Outside.updateWorkersView=function(){
  adrWorkersView();
  for(const [job,n]of Object.entries(State.game.workers)){
    const cap=CivilCatalog.jobCapacity(State,job);
    $('#workers_row_'+job+' .upBtn,#workers_row_'+job+' .upManyBtn').toggleClass('disabled',n>=cap || Outside.getNumGatherers()<=0);
    $('#workers_row_'+job).attr('title',Number.isFinite(cap)?'岗位上限 '+cap:'');
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
Events.buttonClick=function(btn) {if(Events._choosing)return;Events._choosing=true;try{adrEventClick(btn);}finally{setTimeout(()=>{Events._choosing=false;},250);}};
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
    const name=State.civilization.village?.town?'河谷小镇':'荒林聚落';
    $('#location_outside').text(name);
    if(Engine.activeModule===Outside)document.title=name;
  } else adrOutsideTitle();
};
