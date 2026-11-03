/* MPL-2.0 — Three inhabited districts in the same valley, present at world creation. */
var CivilCityContent={
  wards:{
    terraces:{name:'梯田片区',population:3400,foodRate:2.4,scrapRate:.65,woodRate:1,position:[6,6],description:'沿坡的田地养活了许多家庭；回收料不足，工具需要从外面补进。'},
    yards:{name:'旧厂街区',population:4200,foodRate:1.55,scrapRate:1.3,woodRate:.8,position:[25,5],description:'旧厂棚与住区相连，回收工熟悉废墟；粮食与清洁水需要更多人手。'},
    canal:{name:'渠口社区',population:3000,foodRate:2,scrapRate:.8,woodRate:1.3,position:[20,16],description:'住区守着旧排水渠和林场。水务修复后能减轻取水负担，木料也可运给邻里。'}
  },
  map:{width:31,height:19,home:[14,11],routes:{terraces:[[14,11],[10,11],[10,6],[6,6]],yards:[[14,11],[17,11],[17,8],[25,8],[25,5]],canal:[[14,11],[14,14],[20,14],[20,16]]}},
  projects:{
    road:{name:'连接道路与货运站',cost:{wood:180,tools:24,food:40},duration:240,max:1,detail:'连通本城公共服务和货物运输；不会把当地居民搬进原镇。'},
    water:{name:'修复公共水务',cost:{wood:240,tools:30,medicine:8},duration:300,max:2,detail:'第一处设施让每名值守者供水160人份，第二处增至320人份；停运会降低产粮与健康。'},
    housing:{name:'扩建居住与服务街坊',cost:{wood:400,tools:50,medicine:10},duration:360,max:8,detail:'新增 800 张床和对应农田、诊疗、课堂岗位；新居民来自实际出生，扩建不会自动增加人口。'}
  },
  priorities:{balanced:'均衡供养',care:'保障与储备优先',building:'建材与施工优先'},
  methods:{manual:'手工制器',standard:'标准件生产'},
  resources:['food','wood','scrap','tools','medicine','knowledge','iron'],
  contactCost:{food:24,tools:6,knowledge:12},contactDuration:180,
  charterCost:{food:40,tools:10,knowledge:30},
  aid:{food:96,tools:12,medicine:12},travel:120,freightCapacity:120
};
