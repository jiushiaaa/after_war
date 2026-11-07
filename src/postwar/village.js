/* MPL-2.0 — Village services, first independent neighbour and physical transport. */
var CivilVillage = {
  init(s) {
    const c=s.civilization;
    if(!c.village)c.village={schema:1,health:80,convoyClock:0,convoys:0,routeStatus:'等待互助协定',riverKnown:false,riverAllied:false,riverFood:80,riverTools:0,riverMedicine:0,town:false,townStable:0};
    // Earlier village previews recorded the aid decision but omitted the recipient's inventory.
    if(!c.village.schema){
      const v=c.village;
      if(v.riverAllied || v.aidDelivered){v.riverFood=Math.min(240,v.riverFood+40);v.riverTools+=12;v.aidDelivered=true;}
      v.schema=1;
    }
  },
  buildings:{
    farm:{cost:()=>({wood:80+(State.game.buildings.farm||0)*30,scrap:10}),max:4,gate:()=>State.civilization.tech.agronomy},
    toolshop:{cost:()=>({wood:80,scrap:30}),max:1,gate:()=>State.civilization.tech.handtools},
    longhouse:{cost:()=>({wood:180+(State.game.buildings.longhouse||0)*60,tools:12}),max:4,gate:()=>State.civilization.tech.handtools && State.game.buildings.farm},
    clinic:{cost:()=>State.game.buildings.clinic && State.civilization.tech.mechanics?{wood:180,iron:12,parts:6,tools:12}:{wood:120,scrap:25,tools:10},max:2,gate:()=>State.civilization.tech.sanitation && (!State.game.buildings.clinic || State.civilization.tech.mechanics || CivilVillage.careShortfall(State))},
    schoolhouse:{cost:()=>State.game.buildings.schoolhouse && State.civilization.tech.mechanics?{wood:160,iron:10,parts:5,tools:12}:{wood:120,tools:12},max:2,gate:()=>State.civilization.tech.school && (!State.game.buildings.schoolhouse || CivilCatalog.buildingLimit(State,'schoolhouse')>1)},
    road:{cost:()=>({wood:160,scrap:30,tools:10}),max:1,gate:()=>State.civilization.tech.trails && State.civilization.village.riverKnown}
  },
  journeys:{
    river:{cost:{food:12,tools:4},duration:180,allowed:s=>(s.civilization.tech.trails||typeof CivilSetup!=='undefined'&&CivilSetup.options(s).fast&&s.civilization.tech.water&&s.civilization.tech.records) && s.game.buildings.outpost && !s.civilization.village.riverKnown},
    riverAid:{cost:{food:40,tools:12},duration:180,allowed:s=>s.civilization.village.riverKnown && !s.civilization.village.riverAllied && !s.civilization.village.aidDelivered}
  },
  // Pre-town recovery: once residents outgrow one clinic, medicine can never cover
  // treatment plus convoys, while mechanics (the normal second-clinic route) sits
  // behind the town charter. A paid basic second clinic breaks that loop.
  careShortfall(s){return !s.civilization.village?.town && (s.game.buildings.clinic||0)===1 && s.game.population>=24;},
  treatment(s) {
    const v=s.civilization.village,b=s.game.buildings,j=s.game.workers;
    const need=s.game.population*.01;
    return (s.game.population>=12 || b.clinic) && b.clinic && j.medic>0 && CivilRules.canPay(s,{medicine:need}) ? need : 0;
  },
  settle(s) {
    const v=s.civilization.village,j=s.game.workers,b=s.game.buildings,c=s.civilization;
    if(s.game.population>=12 || b.clinic) {
      const need=this.treatment(s);
      if(need>0 && CivilRules.pay(s,{medicine:need}))v.health=Math.min(100,v.health+.5);
      else v.health=Math.max(0,v.health-(c.hunger ? .5 : .15));
    }
    if(v.riverAllied && !s.civilization.regions?.active) {
      // Twelve remote inhabitants, four tending fields. Production and their meals are settled there.
      v.riverFood=Math.min(240,v.riverFood+3.2-12*.12);
      v.convoyClock+=10;
      if(v.convoyClock>=60){v.convoyClock-=60;this.convoy(s);}
    }
  },
  convoy(s) {
    if(s.civilization.regions?.active)return false;
    const v=s.civilization.village,c=s.civilization;
    const cost={wood:1,food:c.tech.preservation?1:2,tools:1,medicine:.5};
    if(!s.game.buildings.road){v.routeStatus='等待修通道路';return false;}
    if(c.outpostSupplied!==true){v.routeStatus='外站补给中断';return false;}
    if(v.riverFood<24){v.routeStatus='河谷先补足本地口粮';return false;}
    if(!CivilRules.canPay(s,cost)){v.routeStatus='待发：工具 1、药品 0.5、木料 1、食物 '+cost.food;return false;}
    CivilRules.pay(s,cost);v.riverFood-=12;s.stores.food=(s.stores.food||0)+12;
    v.riverTools+=1;v.riverMedicine+=.5;v.convoys++;v.routeStatus='往返正常';return true;
  },
  tick(s) {
    const v=s.civilization.village,b=s.game.buildings,c=s.civilization;
    if(c.tech.mechanics && !c.events.serviceExpansion){c.events.serviceExpansion=true;Civilization.notify('新打的器具够再开一间诊所和学堂了。扩建得备好铁锭与机械零件，也得腾出更多医护和先生。');}
    const ready=s.game.population>=20 && b.clinic && b.schoolhouse && v.health>=60 && v.convoys>=3 && v.riverAllied && c.outpostSupplied===true && v.routeStatus==='往返正常' && c.hunger===0 && (s.stores.food||0)>=40 && (s.stores.tools||0)>=10;
    if(!v.town){v.townStable=ready?v.townStable+1:0;if(v.townStable>=120){v.town=true;Civilization.notify('学堂里传出念书声，车队拉回了河谷的新粮。这里已有小镇的模样。人多了，大家开始商量该由谁来拿主意。');Outside.setTitle();}}
  },
  deliverAid(v) {
    if(v.aidDelivered)return;
    v.riverFood=Math.min(240,v.riverFood+40);v.riverTools+=12;v.aidDelivered=true;
  },
  event(id,done) {
    const v=State.civilization.village;
    if(id==='river')return {title:'河谷的灯',text:['旧公路尽头，有人扯起塑料棚挡住河风。棚下住着十二个人，有几人的皮肤结着成片的硬角质。','领路人说，这副皮囊没夺走他们的舌头和记性。他们开荒种粮，缺工具也缺药，但绝不肯把身家性命交给一个外来的头领。'],buttons:{
      meet:{text:'交换姓名与需要',nextScene:'end',onChoose:done('你们记下了河谷的缺口。先送去工具和口粮，再谈合修道路的事。',()=>{v.riverKnown=true;})},
      leave:{text:'暂时保持距离',nextScene:'end',onChoose:done('小队记下坐标，退回了旧公路。等攒够了物资，随时可以再来。',()=>{v.riverKnown=true;})}
    }};
    if(id==='riverAid')return {title:'同一条路',text:['工具分到了河谷农户手上，送去的口粮也填上了修路期间的亏空。','河谷答应互通有无，但屋舍、田亩和议事仍归他们自己管。车队每 60 秒送去 1 工具、0.5 药品，换回 12 食物；途中另耗木料与旅粮。','这只是一纸互助协定。等往来熟络了，才有资格谈更深的联合。'],buttons:{
      agree:{text:'签下互助协定',nextScene:'end',onChoose:done('河谷成了第一个互助聚居地。只要道路通畅、物资齐备，车队便会按时往返。',()=>{this.deliverAid(v);v.riverAllied=true;})},
      defer:{text:'暂缓协定',nextScene:'end',onChoose:done('东西已经送到。河谷会等你腾出手来，再谈通车的事。',()=>{this.deliverAid(v);})}
    }};
    return null;
  },
  refresh() {
    const c=State.civilization,v=c.village,b=State.game.buildings;
    if((c.tech.trails||typeof CivilSetup!=='undefined'&&CivilSetup.options(State).fast&&c.tech.water&&c.tech.records) && !c.regions?.active) {
      const id=v.riverKnown?'riverAid':'river',r=this.journeys[id];
      const btn=Civilization.button('riverButton',v.riverKnown?'援助河谷':'沿河勘察','#roadPanel',()=>Civilization.depart(v.riverKnown?'riverAid':'river'),r.cost);
      btn.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(v.riverKnown?'援助河谷':'沿河勘察'));
      const tt=btn.find('.tooltip').empty();for(const [key,n]of Object.entries(r.cost)){$('<div>').addClass('row_key').text(_(key)).appendTo(tt);$('<div>').addClass('row_val').text(n).appendTo(tt);}
      Button.setDisabled(btn,v.riverAllied || v.aidDelivered || !!c.journey || !!c.pending || !CivilRules.canPay(State,r.cost));
      if(v.aidDelivered && !v.riverAllied)Civilization.button('riverPact','商议互助','#roadPanel',()=>{if(!Events.activeEvent()){c.pending='riverAid';Civilization.showPending();}});
      $('#riverPact').toggle(!v.riverAllied);
    }
    if(v.riverKnown && !c.regions?.active){
      let note=$('#riverStatus');if(!note.length)note=$('<div>').attr('id','riverStatus').appendTo('#roadPanel');
      note.text(v.riverAllied?'河谷 · 12 位居民 · 粮食 '+Math.floor(v.riverFood)+' · 已收工具 '+v.riverTools+' / 药品 '+v.riverMedicine+' · 往返 '+v.convoys+' 次。'+v.routeStatus:'河谷住着十二位居民，正等着工具与修路援助。');
    }
    if(c.regions?.active)$('#riverStatus,#riverButton,#riverPact').hide();
    if(State.game.population>=12 || b.clinic)$('#socialNote').append(document.createTextNode(' · 健康 '+Math.floor(v.health)+(v.health<30?'（工作减慢）':'')));
  }
};
