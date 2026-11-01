/* MPL-2.0 — New adaptation text, distinct from verified novel canon. */
var CivilText = {
  opening: ['金属舱盖从里面推开了。你的呼吸结成白雾。', '记忆停在一场撤离。舱外没有电，只有墙角几根干柴。'],
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
    'the light from the fire spills from the windows, out into the dark':'火光从破窗里透出去。荒林中有什么停了下来',
    'a ragged stranger stumbles through the door and collapses in the corner':'一个背着工具的女人踉跄进门，倒在炉边。她的手冻得握不住东西',
    'the stranger shivers, and mumbles quietly. her words are unintelligible.':'女人指了指工具包。她说自己是个工匠，话还没说完就打起寒战',
    'the stranger in the corner stops shivering. her breathing calms.':'工匠的呼吸平稳了。温度让她重新有了力气',
    'the stranger is standing by the fire. she says she can help. says she builds things.':'工匠把工具铺在炉边。她能修东西，也愿意帮你收集燃料',
    'the sky is grey and the wind blows relentlessly':'灰白的天压着荒林。远处的公路断在半空，路牌上还留着航天港的标志',
    'dry brush and dead branches litter the forest floor':'枯枝从灰里露出来。你把还能烧的拖回去',
    'builder stokes the fire':'工匠拨开炉灰，添了一根木料',
    'builder just shivers':'屋里太冷了，工匠的手指不听使唤',
    'the wind howls outside':'风从舱门裂缝里灌进来', 'the wood is running out':'舱里只剩几根干柴。得去荒林找燃料'
  },
  buildings: {
    trap: ['工匠指着林边的小兽足迹。几根枝条就能做个陷阱。','陷阱藏进了枯叶。它能带回食物和毛皮。'],
    cart: ['工匠从冰封舱旁拆下两个小轮子。可以做一辆推车。','推车吱呀作响。一次能从林里拖回更多木料。'],
    hut: ['工匠见过迁徙的人。暖房以外还需要能挡风的屋子。','木屋立在维修间旁。烟从屋顶升起，远处的人会看见。'],
    lodge: ['有人认得野兽的足迹。给他们一处整理弓具的棚子。','猎人有了落脚处。聚落里可以分派狩猎工作。'],
    granary: ['食物不能一直堆在炉边。工匠提出修一间架空粮棚。','粮棚的地板离开了湿地。大家第一次有了共同的储备。'],
    workshop: ['聚落已经能养活自己。该把收来的零件摆上真正的工作台了。','工坊开门了。工匠把残图、量具和你的旧知识放到了一起。'],
    cistern: ['知道了泵站的位置，工匠能先在聚落架起过滤与集水管。','清水流进了储水槽。处理食物的损耗少了一些。'],
    outpost: ['修好的泵站需要有人照看，也需要沿途补给。','补给外站挂起了灯。聚落第一次能持续照料远处的设施。']
  },
  research: {
    water: {name:'净水工艺', cost:{wood:20,scrap:10}, duration:120, done:'过滤样品不再浑浊。你们找到了可以维修旧泵站的方法。'},
    metal: {name:'金属回收', cost:{wood:10,scrap:20}, duration:180, done:'零件按材质分了堆。回收工能从相同废料里找出更多可用部件。'}
  }
};
var adrTranslate = _;
_ = function(key) {
  if(Object.prototype.hasOwnProperty.call(CivilText.labels,key)) return CivilText.labels[key];
  return adrTranslate.apply(this,arguments);
};
