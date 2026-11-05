/* MPL-2.0 — A7: capabilities attach to real production and existing institutions. */
var CivilModernContent={
 tech:{
  localgrid:['地方电网',['water','standards'],{wood:80,scrap:40,tools:12,knowledge:50},240,'水流、风和生物质可以驱动小型发电组。地方电网不要求采矿或燃煤。'],
  electricalSafety:['绝缘与电气安全',['power'],{scrap:24,tools:12,knowledge:40},180,'接地、断路与轮值检修让供电成为公共服务；开放电与通信服务所。'],
  radio:['无线电联络',['electricalSafety','records'],{scrap:24,tools:8,knowledge:60},240,'固定联络站接续传令。城际启程须有可工作的调度与供电，不靠反复点派遣。'],
  vaccines:['疫苗与无菌诊疗',['sanitation','school'],{medicine:12,food:32,knowledge:60},240,'医护用真实药物、电力和岗位开展接种；公共卫生开始预防疾病。'],
  precisionFit:['标准配合与电动机床',['electricalSafety','handtools','standards'],{scrap:48,tools:16,knowledge:80},300,'回收铁料经电动机床变为标准零件；公共路线也能制造，不强制开矿。'],
  traction:['电动轨道运输',['radio','precisionFit','logistics'],{scrap:64,tools:24,knowledge:80},300,'旧站之间接入电动货运与调度。运单、旅粮、返程和真实驾驶员仍须承担。'],
  dispatch:['配电与机构调度',['radio','traction'],{tools:20,knowledge:100},300,'按库存与生活保留量安排电力，生产可转入自动配料；原镇日常岗位可交给现有公署。'],
  scientificMethod:['实验与公开复核',['school','precisionFit'],{scrap:24,tools:16,knowledge:80},300,'实验班组消耗教具与电力形成可复核知识，随后才能建立先进实验共同体。'],
  publicHealth:['公共卫生网络',['vaccines','radio','administration'],{medicine:24,tools:16,knowledge:100},300,'接种、诊疗、课堂有连续名册。跨城服务交接不再依赖创始人的年龄。'],
  semiconductor:['半导体与控制器',['scientificMethod','dispatch'],{parts:16,tools:24,knowledge:160},420,'小型控制器生产将零件与知识转换为真实库存，为自治机器留出可审计的边界。'],
  electroalloy:['电热合金',['precisionFit','publicHealth'],{iron:24,tools:20,knowledge:140},360,'电炉用回收铁料制造合金。材料要实产，掌握图纸不等于仓库已有金属。'],
  powerstorage:['储能与故障隔离',['semiconductor','electroalloy'],{parts:24,knowledge:160},420,'有限蓄能跨过短暂停电，耗尽仍须停机；原镇机组可选择生活或制造优先。'],
  systemsafety:['复杂系统与公共责任',['powerstorage','publicHealth'],{parts:16,medicine:16,knowledge:180},420,'先进设施的供电、临床、责任和替岗形成整体；开启新的共同生活，保留拒绝改造的权利。']
 },
 middle:['electricalSafety','radio','vaccines','precisionFit','traction','dispatch','scientificMethod','publicHealth'],
 late:['semiconductor','electroalloy','powerstorage','systemsafety'],
 grids:{hydro:{name:'小水电',power:10,cost:{tools:.04}},wind:{name:'风力',power:12,cost:{tools:.04}},biomass:{name:'生物质',power:16,cost:{wood:1.2,tools:.04}},industrial:{name:'既有工业电网',power:0,cost:{tools:.02}}},
 modes:{balanced:'生活与缺料优先',materials:'回收与零件优先',care:'诊疗与知识优先'},
 install:{wood:120,scrap:80,tools:20,knowledge:20},
 eras:{
  early:{title:'灯光越过窗沿',lines:['有人关上了那扇总是漏风的门。','街上的灯不再靠一个人守到天亮。','食物、木料和回收由真实班组接续，紧急手工仍可展开。','接下来需要决定：让电先去哪里，让谁先得到照料。']},
  middle:{title:'远处有人回答',lines:['无线电另一端传来不同的口音。','旧轨道上装着疫苗、工具和重新写好的名册。','原镇岗位、课堂补员和例行供料逐渐交给有预算的机构。','从今天起，每一项承诺都要穿过真实的距离。']},
  late:{title:'火光映在舷窗上',lines:['最初的工匠已经不在这间屋子里。','临床、维修与供料仍按有人承担的职责运行。','普通人、改造者和合成人留下了同样分量的签名。','地球的夜色第一次成为一艘船窗外的景象。']}
 }
};
for(const [id,[name,requires,cost,duration,done]]of Object.entries(CivilModernContent.tech))CivilText.research[id]={name,requires,cost,duration,done,discover:s=>s.civilization.polishVersion===1&&!!s.civilization.village?.town&&(id!=='localgrid'||CivilCourse.is(s,'commons'))&&(!CivilModernContent.late.includes(id)||Number.isSafeInteger(s.civilization.city?.cityAt))};
