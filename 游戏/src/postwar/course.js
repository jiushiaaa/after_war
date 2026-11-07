/* MPL-2.0 — 战后文明: town development course (schema 1).
   Two ways from a town to the first city. Everything keys off an explicit
   civilization.course record, so saves that never made this choice keep their
   original rules, costs and replay. */
var CivilCourse={
  pendingIds:['course_choice','course_issue','course_craftsman','course_coop'],
  choices:{
    commons:{name:'田地与公共服务优先',short:'田地与公共服务',detail:'先扩建灌渠、诊所与学堂，用木料、工具和人手筑起合作联排。不开矿、不建燃煤电站也能立城，金属主要靠废墟拆解与邻里互通。农夫产粮 +15%。'},
    industry:{name:'回收、工业与贸易优先',short:'回收与工业',detail:'先探矿、冶铁、造机器并架设电网，用铁料与零件兴建公用设施和住宅。产出高、步子快，但炉烟伤肺。回收工产出 +25%。'}
  },
  // Research that each course reaches differently. Industry keeps the original table.
  research:{
    commons:{
      standards:{requires:['school','irrigation','records'],cost:{knowledge:60,tools:20,wood:60}},
      logistics:{requires:['trails','preservation','records'],discover:s=>!!s.civilization.village?.riverAllied,cost:{knowledge:50,tools:16,wood:80}},
      administration:{requires:['records','standards'],cost:{knowledge:80,tools:16,wood:80}},
      survey:{requires:['records','handtools'],discover:s=>!!s.civilization.village?.riverAllied&&(!!s.civilization.tech.logistics||s.civilization.expedition?.sites?.cellar?.state==='joined'),cost:{knowledge:40,tools:12}},
      urbanworks:{requires:['standards','administration','preservation'],cost:{knowledge:100,tools:30,food:80}}
    },
    industry:{}
  },
  // Commons builds public facilities from wood, tools and labour instead of iron and parts.
  costs:{
    commons:{
      publicclinic:()=>({wood:240,tools:16,medicine:6}),
      publicschool:()=>({wood:220,tools:14,knowledge:10}),
      irrigatedfield:()=>({wood:200,tools:22}),
      cartdepot:()=>({wood:240,tools:18}),
      archive:()=>({wood:220,tools:12,knowledge:40})
    },
    industry:{}
  },
  data(s){return s.civilization.course||null;},
  id(s){return this.data(s)?.id||null;},
  is(s,id){return this.id(s)===id;},
  // A town that already went down the mine/charter road before this rule existed is not asked again.
  legacy(s){const c=s.civilization;return !!(c.urban?.chartered||c.tech.mining||c.tech.furnace);},
  // Only saves started under this rule (courseRule 1) are offered the choice; older saves keep their history.
  needsChoice(s){const c=s.civilization;return c.courseRule===1&&!!c.village?.town&&!this.data(s)&&!this.legacy(s);},
  override(s,id){return this.research[this.id(s)]?.[id]||null;},
  requires(s,id){return (typeof CivilModern!=='undefined'&&CivilModern.enabled(s)?CivilModern.requires(s,id):null)||this.override(s,id)?.requires||CivilText.research[id]?.requires||[];},
  cost(s,id){return this.override(s,id)?.cost||CivilText.research[id]?.cost||{};},
  discover(s,id){const o=this.override(s,id),r=CivilText.research[id];const fn=o&&o.discover?o.discover:r?.discover;return !fn||!!fn(s);},
  available(s,id){
    const r=CivilText.research[id];if(!r||!s.game.buildings.workshop)return false;
    return this.requires(s,id).every(k=>s.civilization.tech[k])&&this.discover(s,id);
  },
  // Survivors who moved in from the cellar remember the old road numbers.
  surveyDiscount(s){return s.civilization.expedition?.sites?.cellar?.state==='joined'?15:0;},
  researchCost(s,id){
    const cost={...this.cost(s,id)};
    if(id==='survey'&&cost.knowledge&&this.surveyDiscount(s))cost.knowledge=Math.max(0,cost.knowledge-this.surveyDiscount(s));
    return cost;
  },
  // Output modifiers only for an explicitly chosen course.
  bonus(s){const id=s.civilization?.course?.id;return id==='commons'?{farmer:1.15}:id==='industry'?{salvager:1.25}:{};},
  // The founding craftsman: +2 wood until she retires; afterwards an apprentice (needs a working smith) or a rota.
  craftsmanWood(s){
    const k=s.civilization?.course?.craftsman;if(!k)return Number.isInteger(s.civilization.generations?.people.craft?.retired)?1:2;
    return k.mode==='apprentice'?((s.game.workers.smith||0)>0?2:0):1;
  },
  craftsmanTitle(s){const k=s.civilization?.course?.craftsman;return !k?'工匠':k.mode==='apprentice'?'工坊学徒':'轮值的居民';},
  choose(s,id){
    const c=s.civilization;if(!this.needsChoice(s)||!this.choices[id])return false;
    c.course={schema:1,id,chosenAt:c.elapsed,generation:c.society?.generation||1,issue:null,craftsman:null};
    return true;
  },
  // ---- one concrete social issue per course, triggered by real conditions ----
  issueReady(s){
    const d=this.data(s),c=s.civilization;if(!d||d.issue)return false;
    if(d.id==='commons')return (s.game.workers.farmer||0)>=6&&(s.game.workers.teacher||0)>=2&&c.elapsed-d.chosenAt>=300;
    return (c.industry?.pollution||0)>=20;
  },
  resolveIssue(s,option){
    const d=this.data(s),c=s.civilization,w=s.game.workers;if(!d||d.issue)return false;
    if(d.id==='commons'){
      if(option==='harvest'){const n=Math.min(2,w.teacher||0,CivilCatalog.jobCapacity(s,'farmer')-(w.farmer||0));if(n<=0)return false;if(typeof CivilPacing!=='undefined')CivilPacing.stop(s);w.teacher-=n;w.farmer=(w.farmer||0)+n;d.issue={kind:'harvest',option,at:c.elapsed,moved:n};c.trust=Math.max(0,c.trust-2);return true;}
      if(option==='school'){d.issue={kind:'harvest',option,at:c.elapsed,moved:0};c.trust=Math.min(100,c.trust+2);return true;}
    } else {
      if(option==='shift'){const n=Math.min(2,w.smelter||0);if(n<=0)return false;if(typeof CivilPacing!=='undefined'&&CivilPacing.industrial(s))CivilPacing.stop(s);w.smelter-=n;d.issue={kind:'smoke',option,at:c.elapsed,moved:n};c.trust=Math.min(100,c.trust+2);return true;}
      if(option==='medicine'){if(!CivilRules.pay(s,{medicine:4}))return false;c.village.health=Math.min(100,c.village.health+6);d.issue={kind:'smoke',option,at:c.elapsed,moved:0};return true;}
      if(option==='keep'){d.issue={kind:'smoke',option,at:c.elapsed,moved:0};c.trust=Math.max(0,c.trust-6);return true;}
    }
    return false;
  },
  craftsmanReady(s){const d=this.data(s);return !!d&&!d.craftsman&&(s.civilization.society?.year||0)>=15&&!!s.game.buildings.toolshop;},
  retireCraftsman(s,mode){const d=this.data(s);if(!this.craftsmanReady(s)||!['apprentice','rota'].includes(mode))return false;d.craftsman={mode,at:s.civilization.elapsed,year:s.civilization.society?.year||0};return true;},
  // ---- tool bench arrangement: public bench or smiths' cooperative with its own ledger ----
  coopReady(s){const d=this.data(s);return !!d&&!d.coop&&!!s.game.buildings.toolshop&&(s.game.workers.smith||0)>=2;},
  arrange(s,mode){const d=this.data(s);if(!this.coopReady(s)||!['public','coop'].includes(mode))return false;d.coop={mode,at:s.civilization.elapsed,stock:0,kept:0,sold:0,paidFood:0};return true;},
  smithFactor(s){return s.civilization?.course?.coop?.mode==='coop'?1.2:1;},
  // Called once per real settlement with the produced tool flow. A quarter of the bench output stays
  // in the cooperative's own stock; when public tools run low it sells back at 1 food per tool.
  settleCoop(s,flow){
    const k=s.civilization?.course?.coop;if(!k||k.mode!=='coop')return null;
    const made=Math.max(0,flow['制器工']?.tools||0),keep=Math.min(made*.25,s.stores.tools||0),out={};
    if(keep>0){s.stores.tools-=keep;k.stock+=keep;k.kept+=keep;out.tools=-keep;}
    if((s.stores.tools||0)<15&&k.stock>0){const n=Math.min(.5,k.stock,s.stores.food||0);if(n>0){k.stock-=n;s.stores.tools+=n;s.stores.food-=n;k.sold+=n;k.paidFood+=n;out.tools=(out.tools||0)+n;out.food=-n;}}
    for(const key of ['stock','kept','sold','paidFood'])k[key]=Math.round(k[key]*1e6)/1e6;
    return Object.keys(out).length?out:null;
  },
  nextEvent(s){
    if(this.needsChoice(s))return 'course_choice';
    if(this.coopReady(s))return 'course_coop';
    if(this.issueReady(s))return 'course_issue';
    if(this.craftsmanReady(s))return 'course_craftsman';
    return null;
  },
  event(id,done){
    const s=State,d=this.data(s),pacing=typeof CivilPacing!=='undefined'&&CivilPacing.enabled(s);
    if(id==='course_choice'){
      if(!this.needsChoice(s))return null;
      const buttons={};
      for(const [key,ch] of Object.entries(this.choices))buttons['course_'+key]={text:ch.name,nextScene:'end',onChoose:done('小镇定下方略：'+ch.name+'。',()=>this.choose(s,key))};
      return {title:'小镇往哪里去',text:[
        '农户盼着多修灌渠和诊所，回收工想往山坡下探矿，工匠摊开手说两头都缺人。',
        '田地与公共服务：'+this.choices.commons.detail,
        '回收与工业：'+this.choices.industry.detail,
        '这项方针将决定本阶段城镇的研究次序与重心，定下后暂无法改向。'],buttons};
    }
    if(id==='course_issue'){
      if(!this.issueReady(s))return null;
      if(d.id==='commons')return {title:'收获季的课堂',text:['地里的庄稼熟得急，人手跟不上了。农户们找上门，要学堂停课两季，让先生领着半大孩子下地抢收。','先生却摁着课本说，这一停，今年孩子们的功课就全落下了。'],buttons:{
        harvest:{text:'停课帮收（两名教师改去种田）',nextScene:'end',available:()=>(s.game.workers.teacher||0)>0&&(!pacing||CivilCatalog.jobCapacity(s,'farmer')>(s.game.workers.farmer||0)),onChoose:done((pacing?'教师':'两名教师')+'挽起裤腿下了田。学堂里暂且只留识字课。'+(pacing&&CivilPacing.data(s)?.enabled?'轮值分工切回手动，岗位按这次商定的结果保留。':''),()=>this.resolveIssue(s,'harvest'))},
        school:{text:'课照常上',nextScene:'end',onChoose:done('学堂照旧敲钟上课。农户们只得把抢收的班次排得更紧了。',()=>this.resolveIssue(s,'school'))}}};
      return {title:'烟尘与诊所',text:['冶炼炉的黑烟成天压着镇子。诊所里咳喘的人排起了队，医护找来讨个说法。','炉火不停，铁锭才跟得上；可歇上一班，孩子们的肺能好受几天。'],buttons:{
        shift:{text:'冶炼减一班（两名冶炼工改回空闲）',nextScene:'end',available:()=>(s.game.workers.smelter||0)>0,onChoose:done('冶炼炉撤下了一班人手。',()=>this.resolveIssue(s,'shift'))},
        medicine:{text:'多拨药品（药品 4）',nextScene:'end',...(s.civilization.pacingVersion===2?{available:()=>CivilRules.canPay(s,{medicine:4})}:{cost:{medicine:4}}),onChoose:done('诊所多领到了一批止咳与清肺的药。',()=>this.resolveIssue(s,'medicine'))},
        keep:{text:'照常生产',nextScene:'end',onChoose:done('炉火照旧昼夜不息。不少人默默记下了今天这笔账。',()=>this.resolveIssue(s,'keep'))}}};
    }
    if(id==='course_coop'){
      if(!this.coopReady(s))return null;
      return {title:'工具台归谁管',text:['几个制器工联名提议，把工具台包给他们自己管：由他们日夜看顾炉火和夹具，产出能多上两成。','条件是每批工具得留四分之一归合作社自存；等镇上公库工具少于 15 件时，再按每件 1 份食物的价钱回购。若维持公营，则产出一律入公库，快慢照旧。'],buttons:{
        coop:{text:'交给制器合作社',nextScene:'end',onChoose:done('工具台交由制器合作社经营。社仓存量与公库回购单独立账。',()=>this.arrange(s,'coop'))},
        public:{text:'仍由公共工坊经营',nextScene:'end',onChoose:done('工具台仍归公共工坊，打出的器具悉数入公库。',()=>this.arrange(s,'public'))}}};
    }
    if(id==='course_craftsman'){
      if(!this.craftsmanReady(s))return null;
      return {title:'老工匠的工具箱',text:['当年最先倒在炉边的那位工匠，如今手已经推不动刨子了。她把磨得发亮的工具箱推到桌心。','“炉子、门窗、外头的陷阱，这些年都是我盯着。往后，得换双稳当的手接着干了。”'],buttons:{
        apprentice:{text:'交给工坊学徒（需要有制器工在岗）',nextScene:'end',onChoose:done('学徒接过了沉甸甸的工具箱。只要工坊里有制器工当值，炉边每 10 秒仍能多攒下 2 份木料。',()=>this.retireCraftsman(s,'apprentice'))},
        rota:{text:'改由居民轮值',nextScene:'end',onChoose:done('看火与日常修补改由街坊轮流搭手。每 10 秒可多攒下 1 份木料。',()=>this.retireCraftsman(s,'rota'))}}};
    }
    return null;
  },
  // ---- commons city requirement ----
  cityChecks(s){
    const c=s.civilization,b=s.game.buildings,u=c.urban,e=u?.economy,st=s.stores;
    return [
      ['居民 '+s.game.population+'/400',s.game.population>=400],
      ['健康 '+Math.floor(c.village?.health||0)+'/75',(c.village?.health||0)>=75],
      ['研究城镇工程',!!c.tech.urbanworks],
      ['完成一项邻居的共同工程',Object.values(c.regions?.nodes||{}).some(n=>n.completedProjects?.publicWorks)],
      ['地区行政服务',!!c.regions?.adminService],
      ['灌溉田片 '+(b.irrigatedfield||0)+'/2',(b.irrigatedfield||0)>=2],
      ['公共诊疗站 '+(b.publicclinic||0)+'/2',(b.publicclinic||0)>=2],
      ['公共学舍 '+(b.publicschool||0)+'/2',(b.publicschool||0)>=2],
      ['粮食净供给 ≥ +3',!!e&&e.food>=3],
      ['工具 '+Math.floor(st.tools||0)+'/60',(st.tools||0)>=60]
    ];
  },
  validate(state){
    const d=state.civilization.course;if(d===undefined)return;
    const c=state.civilization,int=n=>Number.isSafeInteger(n)&&n>=0,obj=v=>v&&typeof v==='object'&&!Array.isArray(v),fail=()=>{throw Error('发展方针数据无效');};
    if(!obj(d)||d.schema!==1||!this.choices[d.id]||!int(d.chosenAt)||d.chosenAt>c.elapsed||!int(d.generation))fail();
    if(d.issue!==null&&(!obj(d.issue)||!['harvest','smoke'].includes(d.issue.kind)||(d.issue.kind==='harvest')!==(d.id==='commons')||!['harvest','school','shift','medicine','keep'].includes(d.issue.option)||!int(d.issue.at)||!int(d.issue.moved)))fail();
    if(d.coop!==undefined&&(!obj(d.coop)||!['public','coop'].includes(d.coop.mode)||!int(d.coop.at)||['stock','kept','sold','paidFood'].some(k=>typeof d.coop[k]!=='number'||!Number.isFinite(d.coop[k])||d.coop[k]<0)||d.coop.stock>d.coop.kept-d.coop.sold+1e-6))fail();
    if(d.craftsman!==null&&(!obj(d.craftsman)||!['apprentice','rota'].includes(d.craftsman.mode)||!int(d.craftsman.at)||!int(d.craftsman.year)))fail();
  }
};

// Commons housing: built from timber, tools and labour; no iron or power.
CivilCatalog.limits.commonhouse=12;
CivilText.labels.commonhouse='合作联排';
if(typeof CivilUrban!=='undefined')CivilUrban.buildings.commonhouse={cost:()=>({wood:300+(State.game.buildings.commonhouse||0)*40,tools:16}),max:12,gate:()=>CivilCourse.is(State,'commons')&&!!State.civilization.tech.standards&&CivilUrban.publicServices(State)};
CivilText.buildings.commonhouse=['工匠与农户合力画出了夯土联排屋的图样。不费寸铁，全凭木料、工具和街坊的力气。','合作联排落成，屋檐下添了三十二张床位。往后的修缮由住户轮流担待。'];
(function(){
  const preCapacity=CivilCatalog.capacity;
  CivilCatalog.capacity=function(s){return preCapacity(s)+(s.game.buildings.commonhouse||0)*32;};
  const preAvailable=CivilCatalog.researchAvailable;
  CivilCatalog.researchAvailable=function(s,id){return s.civilization.course?CivilCourse.available(s,id):preAvailable.call(this,s,id);};
})();
