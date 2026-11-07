/* MPL-2.0 — Three inhabited districts in the same valley, present at world creation. */
var CivilCityContent={
  wards:{
    terraces:{name:'梯田片区',population:3400,foodRate:2.4,scrapRate:.65,woodRate:1,position:[6,6],description:'顺山坡开垦的梯田养活了不少人家；只是当地废料匮乏，日常工具得靠外头补给。'},
    yards:{name:'旧厂街区',population:4200,foodRate:1.55,scrapRate:1.3,woodRate:.8,position:[25,5],description:'旧厂棚与住区挨在一处，这里的回收工摸透了废墟的门道；但口粮与净水还得搭进更多人手。'},
    canal:{name:'渠口社区',population:3000,foodRate:2,scrapRate:.8,woodRate:1.3,position:[20,16],description:'住区守着旧排水渠与林场。修通水务后能省下挑水的力气，富余的木料也能运往邻里。'}
  },
  map:{width:31,height:19,home:[14,11],routes:{terraces:[[14,11],[10,11],[10,6],[6,6]],yards:[[14,11],[17,11],[17,8],[25,8],[25,5]],canal:[[14,11],[14,14],[20,14],[20,16]]}},
  projects:{
    road:{name:'连接道路与货运站',cost:{wood:180,tools:24,food:40},duration:240,max:1,detail:'接入本城公共服务与货运网络；当地居民仍居原处，不会并入原镇。'},
    water:{name:'修复公共水务',cost:{wood:240,tools:30,medicine:8},duration:300,max:2,detail:'首座设施可令每名值守者供水160人份，第二座增至320人份；一旦停运，田亩收成与居民健康都会受损。'},
    housing:{name:'扩建居住与服务街坊',cost:{wood:400,tools:50,medicine:10},duration:360,max:8,detail:'添置 800 张床位及配套的农田、诊所与学堂工位；新住户来自日常添丁，光盖房不会凭空多出人口。'}
  },
  priorities:{balanced:'均衡供养',care:'保障与储备优先',building:'建材与施工优先'},
  methods:{manual:'手工制器',standard:'标准件生产'},
  resources:['food','wood','scrap','tools','medicine','knowledge','iron'],
  contactCost:{food:24,tools:6,knowledge:12},contactDuration:180,
  charterCost:{food:40,tools:10,knowledge:30},
  aid:{food:96,tools:12,medicine:12},travel:120,freightCapacity:120
};
