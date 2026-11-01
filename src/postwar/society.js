/* MPL-2.0 — Generational community, constitutional choices and persistent succession. */
var CivilSociety = {
  YEAR:600,
  axes:{
    structure:{title:'共同体的边界',text:'河谷仍按互助协定自治。先决定未来共同体如何组织；名称本身不会吞并邻居。',choices:{city:{name:'城邦',detail:'行政费用低，协调上限2个节点。'},league:{name:'城邦联盟',detail:'协调4个节点，保持地方议事，公共记录开支较高。'},federation:{name:'联邦',detail:'协调6个节点，年度信任增加，公共记录开支更高。'},empire:{name:'帝国',detail:'协调8个节点，集中动员使产出增加5%，年度信任下降。'}}},
    selection:{title:'谁来接过职责',text:'冰封者也会衰老。下一任的权力从哪里来？',choices:{election:{name:'定期选举',detail:'每6年由居民在两套施政方案间选择，交接有短期磨合。'},appointment:{name:'议事会任命',detail:'任期持续到退休或去世，由议事会任命继任者。'},hereditary:{name:'世袭继承',detail:'指定继承家系，成年成员依约接任；未成年时由委员会摄政，未经培养则磨合更久。'}}},
    charter:{title:'权力的界限',text:'制度会约束今后的改革，包括当前领袖。',choices:{custom:{name:'依惯例治理',detail:'每10秒少用公共记录；改革花30知识，年度信任下降1。'},constitution:{name:'成文宪章',detail:'每10秒额外消耗0.04知识，年度信任增加2；改革花60知识并需公议。'}}},
    devolution:{title:'地方能决定什么',text:'修路与口粮已经越过一间屋子的范围。明确中央和地方的责任。',choices:{central:{name:'中央统筹',detail:'正常运转时产出增加8%，年度信任下降1，行政每10秒多耗0.1食物。'},local:{name:'地方自治',detail:'协调上限增加2，年度信任增加1；每10秒多耗0.04知识。'}}}
  },
  init(s){
    if(s.civilization.society){
      const x=s.civilization.society;
      // Earlier previews reused started for the first election term, losing the founding years.
      if(x.leader.termStarted===undefined){
        x.leader.termStarted=x.leader.started;
        if(x.generation===1 && x.leader.title==='冰封者')x.leader.started=0;
        for(const entry of x.history)if(entry.generation===1 && entry.title==='冰封者')entry.from=0;
      }
      if(x.reformPaid===undefined)x.reformPaid=x.reforming?(x.axes.charter==='constitution'?60:30):0;
      this.initHeir(s);
      this.initBirths(s);
      return;
    }
    const year=Math.floor(s.civilization.elapsed/this.YEAR);
    s.civilization.society={schema:1,year,cohorts:Array.from({length:s.game.population},(_,i)=>({age:18+i%30,count:1})),
      leader:{title:'冰封者',age:Math.min(64,28+year),started:0,termStarted:0,trait:'founder',alive:true},generation:1,history:[],axes:{},governed:false,
      legacyAgeGrace:28+year>64,legitimate:60,service:true,transition:0,reformCooldown:0,reforming:null,reformPaid:0,succession:null,training:null,heir:{age:18,trained:false,alive:true},warned:false};
    this.initBirths(s);
  },
  initHeir(s){
    const x=s.civilization.society;
    // A missing flag is a legacy candidate, not a replacement family or a new resident.
    if(x.heir.alive===undefined){x.heir.alive=x.heir.age<85;if(!x.heir.alive)x.training=null;}
  },
  heirAlive(s){const h=s.civilization.society.heir;return h.alive===undefined?h.age<85:h.alive;},
  successionOptions(s){
    const x=s.civilization.society;if(!x.succession)return {};
    if(x.axes.selection!=='hereditary')return {engineer:'支持工程代表',scholar:'支持教师代表'};
    if(!this.heirAlive(s))return {family:'由家系重新推举代表'};
    return x.heir.age<18?{regent:'委员会摄政'}:{heir:'见证继承'};
  },
  successionSignature(s){const x=s.civilization.society;return JSON.stringify([x.generation,x.succession,x.axes.selection,Object.keys(this.successionOptions(s))]);},
  initBirths(s){
    const x=s.civilization.society,c=s.civilization,b=s.game.buildings;
    // Old saves start with no unfulfilled births or retroactive population grants.
    if(x.births===undefined)x.births={scaled:false,credit:0,mutantCredit:0};
    // Preserve the phase through later deaths or housing losses; 80 -> 79 must not reset it.
    if(s.game.population>=80 || c.urban?.chartered || c.tech.standards && b.publicclinic && b.publicschool)x.births.scaled=true;
  },
  newBirths(s,yearStartPopulation){
    const x=s.civilization.society,c=s.civilization;
    const {cohorts,count,cost}=CivilPopulation.births(x.cohorts,x.births,{
      yearStartPopulation,beds:typeof CivilUrban!=='undefined'?CivilUrban.availableBeds(s):CivilCatalog.capacity(s)-s.game.population,
      health:c.village.health,hunger:c.hunger,food:s.stores.food,medicine:s.stores.medicine
    });
    if(!count || !CivilRules.pay(s,cost))return 0;
    x.cohorts.push(...cohorts);
    s.game.population+=count;
    this.note((count===1?'一名孩子':count+'名孩子')+'在聚落出生。口粮与药品已备好，家人把他们记入名册。');
    return count;
  },
  total(x){return CivilPopulation.count(x.cohorts);},
  workforce(s){
    const x=s.civilization.society;if(!x)return s.game.population;
    return CivilPopulation.workforce(x.cohorts)+Math.max(0,s.game.population-this.total(x));
  },
  foodPopulation(s){
    const x=s.civilization.society;if(!x)return s.game.population;
    return CivilPopulation.foodPopulation(x.cohorts)+Math.max(0,s.game.population-this.total(x));
  },
  sync(s){
    const x=s.civilization.society;if(!x)return;
    let d=s.game.population-this.total(x);
    if(d>0)x.cohorts.push({age:22+x.year%14,count:d});
    else if(d<0){for(const c of [...x.cohorts].sort((a,b)=>b.age-a.age)){const n=Math.min(c.count,-d);c.count-=n;d+=n;if(!d)break;}}
    x.cohorts=x.cohorts.filter(c=>c.count>0);this.trimJobs(s);
  },
  trimJobs(s){let over=Object.values(s.game.workers).reduce((n,v)=>n+v,0)-this.workforce(s);for(const key of Object.keys(s.game.workers).sort((a,b)=>({hunter:3,farmer:3,medic:2}[a]||0)-({hunter:3,farmer:3,medic:2}[b]||0))){if(over<=0)break;const n=Math.min(over,s.game.workers[key]);s.game.workers[key]-=n;over-=n;}},
  outputFactor(s){const x=s.civilization.society;if(!x?.governed)return 1;return (x.service?1: .85)*(x.transition>0?.9:1)*(1+(x.axes.structure==='empire'?.05:0)+(x.axes.devolution==='central'?.08:0)+(x.leader.alive && x.leader.trait==='steward' && x.leader.title!=='摄政委员会'?.05:0));},
  researchSpeed(s){const x=s.civilization.society;return x?.leader.alive && x.leader.trait==='scholar'?1.15:1;},
  capacity(s){const a=s.civilization.society?.axes||{};return ({city:2,league:4,federation:6,empire:8}[a.structure]||1)+(a.devolution==='local'?2:0);},
  upkeep(s){const x=s.civilization.society;if(!x?.governed)return {};return {food:.1+(x.axes.structure==='empire'?.1:0)+(x.axes.devolution==='central'?.1:0),knowledge:({city:.02,league:.04,federation:.06,empire:.04}[x.axes.structure]||0)+(x.axes.charter==='constitution'?.04:0)+(x.axes.devolution==='local'?.04:0)};},
  settle(s){const x=s.civilization.society;if(!x?.governed)return {};const cost=this.upkeep(s);x.service=CivilRules.pay(s,cost);return x.service?{'公共行政':Object.fromEntries(Object.entries(cost).map(([k,n])=>[k,-n]))}:{};},
  annual(s,random=Math.random){
    const x=s.civilization.society,c=s.civilization,yearStartPopulation=s.game.population;this.initBirths(s);x.year++;
    const aged=CivilPopulation.age(x.cohorts),lost=aged.deceased;x.cohorts=aged.cohorts;s.game.population-=lost;
    if(lost)this.note(lost+'位年长居民在这一年离世。他们留下的房屋与知识仍属于共同体。');
    this.newBirths(s,yearStartPopulation);
    this.trimJobs(s);this.initHeir(s);
    if(x.heir.alive){x.heir.age++;if(x.heir.age>=85){x.heir.alive=false;x.training=null;this.note('登记的家系代表已经离世。家系的交接规则仍在，下一次交接须由居民确认新的代表。');}}
    const regency=x.leader.title==='摄政委员会';
    if(regency && x.axes.selection==='hereditary' && x.heir.age>=18 && !x.succession)x.succession='regency';
    if(x.leader.alive && !regency){x.leader.age++;
      if(x.leader.age>=65 && !x.warned){x.warned=true;this.note('领袖已经年迈。共同体需要做好交接准备。');}
      if(x.leader.age>=85 || (x.leader.age>=70 && random()<Math.min(.5,(x.leader.age-69)*.025)*(c.village.health>=70?.6:1))){x.leader.alive=false;x.succession='death';this.note('领袖在这一年走到了生命尽头。炉火、田地与共同体还要继续。');}
      else if(x.governed && x.axes.selection==='election' && x.year-x.leader.termStarted>=6 && !x.succession)x.succession='election';
    }
    if(x.governed){const delta=(x.axes.structure==='federation'?1:x.axes.structure==='empire'?-2:0)+(x.axes.charter==='constitution'?2:-1)+(x.axes.devolution==='local'?1:-1)+(x.service?0:-3);x.legitimate=Math.max(0,Math.min(100,x.legitimate+delta));c.trust=Math.max(0,Math.min(100,c.trust+delta));}
  },
  tick(s){
    const x=s.civilization.society;if(!x)return;this.sync(s);this.initBirths(s);
    x.transition=Math.max(0,x.transition-1);x.reformCooldown=Math.max(0,x.reformCooldown-1);
    if(x.training){x.training.remaining=Math.max(0,x.training.remaining-1);if(!x.training.remaining){x.heir.trained=true;x.training=null;this.note('继任培养完成。账册、道路与公共服务已经有人熟悉。');}}
    if(Math.floor(s.civilization.elapsed/this.YEAR)>x.year)this.annual(s);
  },
  note(text){if(typeof Civilization!=='undefined')Civilization.notify(text);},
  nextEvent(s){const x=s.civilization.society;if(!x)return null;if(x.succession)return 'succession';if(!s.civilization.village.town)return null;const axis=Object.keys(this.axes).find(k=>!x.axes[k]);return axis?'constitution_'+axis:null;},
  chooseAxis(s,axis,value){
    const x=s.civilization.society;if(!this.axes[axis]?.choices[value])return false;
    if(x.axes[axis] && x.reforming!==axis)return false;
    const changing=!!x.axes[axis];
    x.axes[axis]=value;x.reforming=null;x.reformPaid=0;x.governed=Object.keys(this.axes).every(k=>!!x.axes[k]);
    if(changing){x.transition=Math.max(x.transition,x.axes.charter==='constitution'?300:180);
      if(axis==='selection' && x.leader.title==='摄政委员会' && value!=='hereditary')x.succession='retirement';
    }
    if(x.governed){x.reformCooldown=600;if(!x.founded){x.founded=true;x.leader.termStarted=x.year;this.note('四项约定写入了公共记录。今后的领袖也要在这些规则下接过职责。');}}
    return true;
  },
  beginReform(s,axis){
    const x=s.civilization.society;
    if(!this.axes[axis] || !x.governed || x.reforming || x.reformCooldown>0 || x.succession || s.civilization.pending)return false;
    const cost=x.axes.charter==='constitution'?60:30;
    if(!CivilRules.pay(s,{knowledge:cost}))return false;
    x.reforming=axis;x.reformPaid=cost;s.civilization.pending='constitution_'+axis;return true;
  },
  cancelReform(s){
    const x=s.civilization.society;if(!x.reforming)return false;
    s.stores.knowledge=(s.stores.knowledge||0)+(x.reformPaid||0);x.reformPaid=0;x.reforming=null;return true;
  },
  succeed(s,kind){
    const x=s.civilization.society;if(!x.succession)return false;
    if(!Object.hasOwn(this.successionOptions(s),kind))return false;
    const reason=x.succession,hereditary=x.axes.selection==='hereditary';
    x.history.push({generation:x.generation,title:x.leader.title,age:x.leader.age,from:x.leader.started,to:x.year,reason});
    const age=kind==='heir'?x.heir.age:kind==='scholar'?34:40;
    x.leader={title:kind==='heir'?'继承人':kind==='family'?'家系代表':kind==='regent'?'摄政委员会':kind==='scholar'?'教师代表':'工程代表',age,started:x.year,termStarted:x.year,trait:kind==='scholar'?'scholar':'steward',alive:true};
    x.transition=kind!=='family'&&this.heirAlive(s)&&x.heir.trained?30:hereditary?180:60;x.generation++;x.succession=null;x.warned=false;
    if(kind!=='regent'){x.heir={age:12,trained:false,alive:true};x.training=null;}
    this.note('第'+x.generation+'任接过了公共记录。技术、条约、库存与居民都继续留在共同体中。');return true;
  },
  event(id,done){
    const s=State,x=s.civilization.society;
    if(id==='succession'){
      const hereditary=x.axes.selection==='hereditary',expired=hereditary&&!this.heirAlive(s),options=this.successionOptions(s);
      return {title:x.succession==='death'?'炉火仍在':'职责的交接',text:[x.succession==='death'?'领袖已经离世。共同体的历史不会在这里结束。':x.succession==='election'?'六年任期已到。居民讨论下一任的施政方案。':x.succession==='regency'?(expired?'登记的家系代表已经离世，摄政委员会等待新的交接确认。':'继承家系的代表已经成年，摄政职责可以结束。'):'领袖决定把职责交给下一任。',expired?'原候选已经离世。家系推举了一位40岁的成年代表，等候共同体确认。新任需要180秒熟悉职责，产出暂减一成。':hereditary?'按继承规则安排交接。成年继承人接任；未成年时由委员会摄政。':'工程代表让劳动产出增加5%；教师代表让研究加快15%。交接后有60秒磨合，产出暂减一成。'],buttons:Object.fromEntries(Object.entries(options).map(([k,text])=>[k,{text,nextScene:'end',onChoose:done('交接记入了共同体的历史。',()=>this.succeed(s,k))}]))};
    }
    if(!id.startsWith('constitution_'))return null;
    const axis=id.slice(13),def=this.axes[axis];if(!def)return null;
    const reform=x.reforming===axis;
    const buttons=Object.fromEntries(Object.entries(def.choices).filter(([k])=>!reform || k!==x.axes[axis]).map(([k,v])=>[k,{text:v.name,nextScene:'end',onChoose:done('采用'+v.name+'。',()=>this.chooseAxis(s,axis,k))}]));
    if(reform)buttons.keep={text:'保留现制',nextScene:'end',onChoose:done('保留现制，退回预留的知识。',()=>this.cancelReform(s))};
    return {title:def.title,text:[def.text,...(reform?['已预留 '+x.reformPaid+' 知识。改制后按新宪章磨合180或300秒，产出减少一成；600秒后可再改议。保留现制会退回预留。']:[]),...Object.values(def.choices).map(v=>v.name+'：'+v.detail)],buttons};
  },
  refresh(){
    const s=State,x=s.civilization.society;if(!x || !s.civilization.village.town)return;
    if(!this.module){const m=this.module={onArrival(diff){document.title='议事屋';Engine.moveStoresView(null,diff);}};m.tab=Header.addLocation('议事屋','council',m);m.panel=$('<div>').attr('id','councilPanel').addClass('location').appendTo('#locationSlider');$('<div>').attr('id','councilRecord').appendTo(m.panel);Engine.updateSlider();}
    const children=CivilPopulation.children(x.cohorts),elders=x.cohorts.filter(v=>v.age>=65).reduce((n,v)=>n+v.count,0);
    if(typeof CivilInterface!=='undefined')CivilInterface.summary('#councilRecord',CivilInterface.councilSummary(s));else $('#councilRecord').text('重建 '+x.year+' 年 · 第'+x.generation+'任 '+x.leader.title+' · '+x.leader.age+'岁'+(x.leader.alive?'':'（待交接）')+'。可工作 '+this.workforce(s)+'，儿童 '+children+'，退休 '+elders+'。'+Object.entries(x.axes).map(([k,v])=>this.axes[k].choices[v].name).join(' · ')+(x.governed?'。认可 '+Math.floor(x.legitimate)+'，协调上限 '+this.capacity(s)+' 节点。'+(x.service?'公共行政正常。':'行政物资不足，产出减慢。'):'')+(x.training?' 继任培养还需 '+Math.ceil(x.training.remaining)+' 秒。':'') );
    if(x.governed){
      const retire=Civilization.button('retireButton','安排退休','#councilPanel',()=>{if(!Events.activeEvent() && !x.succession && x.year>x.leader.started){x.succession='retirement';Engine.saveGame();}});Button.setDisabled(retire,!!x.succession || x.year<=x.leader.started);
      const train=Civilization.button('trainHeir','培养继任者','#councilPanel',()=>{if(this.heirAlive(s) && !x.training && !x.heir.trained && Civilization.spend({knowledge:30,food:15})){x.training={remaining:300};Engine.saveGame();}},{knowledge:30,food:15});Button.setDisabled(train,!this.heirAlive(s) || !!x.training || x.heir.trained || !CivilRules.canPay(s,{knowledge:30,food:15}));
      for(const [axis,def]of Object.entries(this.axes)){const cost={knowledge:x.axes.charter==='constitution'?60:30};const btn=Civilization.button('reform_'+axis,'重议：'+def.title,'#councilPanel',()=>{if(!Events.activeEvent() && this.beginReform(s,axis)){Civilization.showPending();Engine.saveGame();}},cost);
        btn.find('.tooltip .row_val').text(cost.knowledge);btn.attr('title',x.reformCooldown>0?'还需 '+Math.ceil(x.reformCooldown)+' 秒才能重议':'预留 '+cost.knowledge+' 知识；可保留现制并退回');
        Button.setDisabled(btn,x.reformCooldown>0 || !!x.reforming || !!x.succession || !!s.civilization.pending || !CivilRules.canPay(s,cost));}
    }
    let history=$('#councilHistory');if(!history.length)history=$('<div>').attr('id','councilHistory').appendTo('#councilPanel');history.text(x.history.slice(-5).map(h=>'第'+h.generation+'任 '+h.title+'：'+h.from+'—'+h.to+'年，交接时'+h.age+'岁。').join(' '));
  },
  validate(s){const x=s.civilization.society;if(x===undefined)return;
    const integer=(v,min=0,max=1e8)=>Number.isInteger(v)&&v>=min&&v<=max;
    const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
    const reasons=['death','retirement','election','regency'];
    if(!object(x)||x.schema!==1 || !integer(x.year)||!integer(x.generation,1)||!Array.isArray(x.cohorts))throw Error('人口名册无效');
    if(!Number.isFinite(s.civilization.elapsed)||x.year!==Math.floor(s.civilization.elapsed/this.YEAR))throw Error('历史年份与时间不符');
    for(const c of x.cohorts)if(!object(c)||!integer(c.age,0,100)||!integer(c.count,1)||(c.identity!==undefined && !['human','mutant'].includes(c.identity)))throw Error('年龄组无效');
    // Only an absent record is a legacy save; malformed new state must not be rebuilt.
    if(x.births!==undefined && (!object(x.births) || typeof x.births.scaled!=='boolean' || ['credit','mutantCredit'].some(k=>!Number.isFinite(x.births[k]) || x.births[k]<0 || x.births[k]>=1)))throw Error('出生记录无效');
    if(this.total(x)!==s.game.population)throw Error('人口名册与居民数量不符');
    if(!object(x.axes))throw Error('制度无效');
    for(const [k,v]of Object.entries(x.axes))if(!this.axes[k]?.choices[v])throw Error('制度无效');
    if(typeof x.governed!=='boolean'||x.governed!==Object.keys(this.axes).every(k=>!!x.axes[k])||typeof x.service!=='boolean'||typeof x.warned!=='boolean')throw Error('治理状态无效');
    const leader=x.leader;
    if(!object(leader)||typeof leader.title!=='string'||!leader.title.length||leader.title.length>80||!integer(leader.age,0,10000)||!integer(leader.started,0,x.year)||typeof leader.alive!=='boolean'||!['founder','scholar','steward'].includes(leader.trait))throw Error('领袖无效');
    // Missing termStarted is the supported schema-1 preview migration, applied by init after decode.
    if(leader.termStarted!==undefined && !integer(leader.termStarted,leader.started,x.year))throw Error('领袖任期无效');
    for(const [k,max]of [['transition',300],['reformCooldown',600],['legitimate',100]])if(!Number.isFinite(x[k])||x[k]<0||x[k]>max)throw Error('治理数值无效');
    if(!object(x.heir)||!integer(x.heir.age,0,10000)||typeof x.heir.trained!=='boolean'||!Array.isArray(x.history)||x.history.length!==x.generation-1)throw Error('传承记录无效');
    if(x.heir.alive!==undefined && (typeof x.heir.alive!=='boolean'||x.heir.alive!==(x.heir.age<85)||!x.heir.alive&&x.training!==null))throw Error('家系候选状态无效');
    for(const [i,h]of x.history.entries())if(!object(h)||h.generation!==i+1||typeof h.title!=='string'||!h.title.length||h.title.length>80||!integer(h.age,0,10000)||!integer(h.from,0,x.year)||!integer(h.to,h.from,x.year)||!reasons.includes(h.reason))throw Error('历任记录无效');
    if(x.training && (!object(x.training)||!Number.isFinite(x.training.remaining)||x.training.remaining<0||x.training.remaining>300))throw Error('培养进度无效');
    if(![null,...reasons].includes(x.succession)|| !(x.reforming===null || Object.hasOwn(this.axes,x.reforming)))throw Error('交接进度无效');
    if((!leader.alive && x.succession!=='death')||(leader.alive && x.succession==='death')||(s.civilization.pending==='succession' && !x.succession))throw Error('领袖与交接状态不符');
    if(x.reforming){
      if(!x.governed || s.civilization.pending!=='constitution_'+x.reforming || (x.reformPaid!==undefined && ![30,60].includes(x.reformPaid)))throw Error('改革预留与待办不符');
    }else if(x.reformPaid!==undefined && x.reformPaid!==0)throw Error('无改革的预留无效');
    if(typeof s.civilization.pending==='string' && s.civilization.pending.startsWith('constitution_')){
      const axis=s.civilization.pending.slice(13);
      if(!this.axes[axis] || (x.axes[axis] && x.reforming!==axis))throw Error('制度待办无效');
    }
  }
};
