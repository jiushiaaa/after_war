/* MPL-2.0 — New adaptation text, distinct from verified novel canon. */
var CivilText = {
  opening: ['记忆停在撤离那刻。舱外断了电，墙角只剩几根干柴。', '金属舱盖从内推开。每一次呼吸都结成白雾。'],
  labels: {
    'A Dark Room':'冰冷的维修间', 'A Firelit Room':'温暖的维修间',
    'A Silent Forest':'灰白荒林', 'A Lonely Hut':'林边木屋', 'A Tiny Village':'荒林聚落',
    'A Modest Village':'荒林聚落', 'A Large Village':'荒林聚落', 'A Raucous Village':'荒林聚落',
    'wood':'木料', 'food':'食物', 'scrap':'废料', 'fur':'毛皮',
    'gatherer':'采木工', 'builder':'工匠', 'hunter':'猎人', 'salvager':'回收工',
    'hut':'木屋', 'trap':'陷阱', 'cart':'手推车', 'lodge':'猎棚', 'granary':'粮棚',
    'workshop':'工坊', 'cistern':'集水设施', 'outpost':'补给外站',
    'gather wood':'采木', 'light fire':'生火', 'stoke fire':'添火', 'check traps':'检查陷阱',
    'forest':'林地', 'village':'聚落', 'pop ':'居民 ',
    'the light from the fire spills from the windows, out into the dark':'火光漫出破窗。荒林深处，有什么东西停下了脚步。',
    'a ragged stranger stumbles through the door and collapses in the corner':'一个背工具包的女人跌撞进门，瘫在炉边。她的手冻僵了，什么都握不住。',
    'the stranger shivers, and mumbles quietly. her words are unintelligible.':'女人指了指工具包，说自己是个工匠。话没说完，又抖成一团。',
    'the stranger in the corner stops shivering. her breathing calms.':'工匠的呼吸平缓下来。暖意让她攒回了一点力气。',
    'the stranger is standing by the fire. she says she can help. says she builds things.':'工匠在炉边摊开工具。她懂修补，也愿意帮忙拾柴。',
    'the sky is grey and the wind blows relentlessly':'灰白的天压着荒林。远处的高架路断在半空，锈蚀的路牌上还留着航天港的箭头。',
    'dry brush and dead branches litter the forest floor':'枯枝从冷灰里刺出来。你挑出还能烧的，拖回屋里。',
    'builder stokes the fire':'工匠拨开炉灰，添上一根木料。',
    'builder just shivers':'屋里太冷，工匠的手指冻得不听使唤。',
    'the wind howls outside':'冷风顺着舱门裂缝往里灌。', 'the wood is running out':'舱内只剩几根干柴。得去荒林里找点烧的。'
  },
  buildings: {
    trap: ['工匠指了指林边的兽迹。拗几根枝条，就能支起一个陷阱。','陷阱埋进了枯叶下。它能替你们扣下肉和毛皮。'],
    cart: ['工匠从休眠舱底座卸下两个滚轮，能拼一辆手推车。','推车轧过冻土，吱呀作响。现在一趟能从林子里拉回更多木料。'],
    hut: ['工匠在路上见过迁徙的流民。除了这间暖房，还得搭几间挡风的屋子。','木屋紧挨着维修间立了起来。炊烟漫过屋顶，远处的人能看见。'],
    lodge: ['有人认得野兽的脚印。给他们搭座棚子，好整修弓弦。','猎人有了落脚处。聚落可以派人外出狩猎了。'],
    granary: ['吃食不能总堆在炉边受潮。工匠提议搭一间离地的粮棚。','粮棚的木板架在湿泥之上。你们第一次有了过冬的余粮。'],
    workshop: ['聚落总算能喂饱自己了。是时候把捡来的零件摆上工作台了。','工坊推开了门。残缺的图纸、旧量具，还有你脑子里的旧时代常识，终于凑到了一处。'],
    cistern: ['摸清泵站的方位后，工匠就能先在聚落里支起滤芯与集水管道。','清水注入水槽。清洗和备餐的损耗降了下来。'],
    outpost: ['修好的泵站得有人盯着，沿途也少不了补给。','补给外站亮起了灯。聚落的手，第一次够到了远处的旧设施。']
  },
  research: {
    water: {name:'净水工艺', cost:{wood:20,scrap:10}, duration:120, done:'滤出的水样不再浑浊。你们摸清了修复旧泵站的路子。'},
    metal: {name:'金属回收', cost:{wood:10,scrap:20}, duration:180, done:'金属件按材质分堆归类。回收工能从同样的废铁里挑出更多可用零件。'}
  }
};
var adrTranslate = _;
_ = function(key) {
  if(Object.prototype.hasOwnProperty.call(CivilText.labels,key)) return CivilText.labels[key];
  return adrTranslate.apply(this,arguments);
};

// Stage-aware language uses attained institutions, never the player's chosen
// political title alone. Local demographic figures remain explicitly local.
var CivilNarrative={
  stage(s){const c=s.civilization||{};return Number.isSafeInteger(c.space?.unification?.at)?'earth':(Number.isSafeInteger(c.nation?.foundedAt)||Number.isSafeInteger(c.polity?.foundedAt))?'nation':(c.ruleset===2?c.city?.cityAt!==null&&c.city?.cityAt!==undefined:c.urban?.city)?'city':c.urban?.chartered||c.village?.town?'town':'village';},
  home(s){if(s.civilization.ruleset===2)return s.civilization.city?.cityAt!==null&&s.civilization.city?.cityAt!==undefined?'炉火城原镇':s.civilization.village?.town?'河谷镇':'聚落';return s.civilization.urban?.city?'炉火城':s.civilization.urban?.chartered?'河谷镇':s.civilization.village?.town?'河谷小镇':'聚落';},
  community(s){const stage=this.stage(s);return stage==='earth'?'地球共同体':stage==='nation'?'国家共同体':this.home(s);},
  birth(s,count){return (count===1?'一名孩子':count+'名孩子')+'在'+this.home(s)+'降生。口粮与药品都已备妥，'+(s.civilization.urban?.city?'本城公共名册添上了这些新生儿的名字。':'家人将他们的名字记入名册。');},
  death(s,count){return (s.civilization.urban?.city?this.home(s)+'：':'')+count+'位年长居民在这一年走完了人生。他们留下的屋舍与手艺仍留在共同体里。';},
  maintenance(s){return this.stage(s)==='village'?'轮值工匠换下了粮棚破损的挡风板。耗用的木料与工具已记入公共开支。':this.home(s)+'的公共仓储完成了门窗检修。木料与工具损耗已记入本地公共开支。';},
  wildlife(s){const stage=this.stage(s);return stage==='village'?'林边多了一串陌生的兽印。猎人把方位刻在木板上，让大家绕开那片洼地。':stage==='town'?this.home(s)+'的巡路员记下了郊外兽群的踪迹，提醒居民避开那片洼地。':this.home(s)+'生态巡护记录：郊外发现变异生物活动痕迹。巡护员已通知居民绕行。';}
};
