/* MPL-2.0 — Local neighbours and paid physical transport; no world-conquest placeholders. */
Object.assign(CivilCatalog.jobs,{transporter:'运输工'});
Object.assign(CivilCatalog.jobBuildings,{cartdepot:'transporter'});
Object.assign(CivilCatalog.limits,{cartdepot:2,archive:3});
const preRegionsJobCapacity=CivilCatalog.jobCapacity;
CivilCatalog.jobCapacity=function(s,job){return job==='transporter'?(s.game.buildings.cartdepot||0)*6:preRegionsJobCapacity(s,job);};
Object.assign(CivilText.labels,{transporter:'运输工',cartdepot:'车队场',archive:'行政档案馆'});
Object.assign(CivilText.buildings,{
  cartdepot:['车轴与货箱有了统一的规格。运到远方的物资需要有人照管。','车队场备好了人力货车。每座可安排六名运输工；一条往返需要两人。'],
  archive:['几地的承诺需要保存在同一本公共账册里。','档案馆开始收存契约。每十秒消耗0.04知识，正常运转时增加两地协调能力。']
});
Object.assign(CivilText.research,{
  survey:{name:'地理测绘',requires:['records','handtools'],discover:s=>!!s.civilization.industry?.mineKnown && !!s.civilization.industry?.announcedPower,cost:{knowledge:40,tools:10,parts:4},duration:240,done:'矿带、河道与旧铁路线连成了地图。远方的灯火有了可以抵达的路径。'},
  logistics:{name:'运输组织',requires:['trails','preservation','records'],discover:s=>!!s.civilization.village?.riverAllied && !!s.civilization.tech.mechanics,cost:{knowledge:50,tools:12,parts:8},duration:300,done:'货物按源仓、在途与收货仓分别记账。建好车队场并安排两名运输工，河谷车队就会按新办法运行。'},
  administration:{name:'公共行政',requires:['records','standards'],discover:s=>typeof CivilRegions!=='undefined' && CivilRegions.discoveredCount(s)>=2,cost:{knowledge:80,parts:12},duration:360,done:'地方代表可以提出共同项目和公民资格。已经签下的承诺会由下一任继续履行。'}
});
var CivilRegionContent={
  river:{name:'河谷',population:12,mutants:3,travel:60,stores:{food:80,tools:0,medicine:0,scrap:20,wood:30},workers:{farmer:4,salvager:2,gatherer:1},service:{medic:2,teacher:1},out:{tools:1,medicine:.5},back:{food:12},project:{name:'河谷公共水务',cost:{wood:80,tools:12,iron:8,medicine:2},duration:240}},
  rail:{name:'铁轨镇',population:32,mutants:4,travel:90,stores:{food:120,coal:20,tools:16,scrap:60,iron:12,parts:4,medicine:8,wood:40},workers:{farmer:5,salvager:4,smelter:2,machinist:2,gatherer:1},service:{medic:3,teacher:1},out:{food:12,coal:2,tools:1},back:{iron:3,parts:1},project:{name:'货场诊疗与水务',cost:{food:80,wood:60,tools:16,parts:6},duration:300}},
  highland:{name:'高地收容所',population:18,mutants:8,travel:120,stores:{food:150,coal:12,tools:12,scrap:25,medicine:12,knowledge:20,wood:60},workers:{farmer:2,salvager:1,medic:2,teacher:1,gatherer:1},service:{},out:{food:24,coal:1,tools:1},back:{medicine:2,knowledge:4},project:{name:'山路与公共课堂',cost:{food:80,iron:10,parts:6,medicine:4},duration:300}}
};
