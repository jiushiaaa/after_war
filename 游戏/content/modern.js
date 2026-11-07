/* MPL-2.0 — A7: capabilities attach to real production and existing institutions. */
var CivilModernContent={
 tech:{
  localgrid:['地方电网',['water','standards'],{wood:80,scrap:40,tools:12,knowledge:50},240,'水力、风力与生物质皆可驱动小型机组。走地方电网路线，无需下井挖矿或烧煤发电。'],
  electricalSafety:['绝缘与电气安全',['power'],{scrap:24,tools:12,knowledge:40},180,'接地保护、断路器与定期巡检让供电成为可靠的公共服务；完成后可筹建电与通信服务所。'],
  radio:['无线电联络',['electricalSafety','records'],{scrap:24,tools:8,knowledge:60},240,'常设电台接过了信使的脚力。城际发车须有调度员在岗且供电正常，不再靠人工反复催派。'],
  vaccines:['疫苗与无菌诊疗',['sanitation','school'],{medicine:12,food:32,knowledge:60},240,'医护耗用药品与电力，在岗为居民接种疫苗；公共卫生开始从治病转向防病。'],
  precisionFit:['标准配合与电动机床',['electricalSafety','handtools','standards'],{scrap:48,tools:16,knowledge:80},300,'回收的旧铁料经电动机床车削，化作标准规格的机械零件；走公共路线同样能自产零件，无需强行开矿。'],
  traction:['电动轨道运输',['radio','precisionFit','logistics'],{scrap:64,tools:24,knowledge:80},300,'旧车站间架起了电气化货运网与调度台；两城湖岸线的新发运单单程由180秒缩至45秒。货单、旅粮、返程与随车司机仍照章分担。'],
  dispatch:['配电与机构调度',['radio','traction'],{tools:20,knowledge:100},300,'按库存余量与民生保底线调配电力，工坊转入自动配料生产；原镇的日常排班可交由公署代管。'],
  scientificMethod:['实验与公开复核',['school','precisionFit'],{scrap:24,tools:16,knowledge:80},300,'实验班组耗用教具与电力，整理出经得起复核的学问，为日后筹建先进实验共同体铺平道路。'],
  publicHealth:['公共卫生网络',['vaccines','radio','administration'],{medicine:24,tools:16,knowledge:100},300,'接种、看诊与学堂都有了连续归档的名册。跨城公共服务的交接，不再悬于老一辈创始人的寿数。'],
  semiconductor:['半导体与控制器',['scientificMethod','dispatch'],{parts:16,tools:24,knowledge:160},420,'小型控制器产线将零件与知识转化为库存实件，为日后引入受审计的自治机器划好安全边界。'],
  electroalloy:['电热合金',['precisionFit','publicHealth'],{iron:24,tools:20,knowledge:140},360,'电炉熔炼回收铁料以试制特种合金。图纸归图纸，金属还得靠工坊一炉一炉炼出来。'],
  powerstorage:['储能与故障隔离',['semiconductor','electroalloy'],{parts:24,knowledge:160},420,'蓄电池组能顶住短时的断电波动，耗尽后仍会停机；原镇机组可设定优先保民生或保制造。'],
  systemsafety:['复杂系统与公共责任',['powerstorage','publicHealth'],{parts:16,medicine:16,knowledge:180},420,'先进设施的供电、临床、问责与替岗联成一体；在开启新共同生活的同时，保留每个人拒绝改造身体的权利。']
 },
 middle:['electricalSafety','radio','vaccines','precisionFit','traction','dispatch','scientificMethod','publicHealth'],
 late:['semiconductor','electroalloy','powerstorage','systemsafety'],
 grids:{hydro:{name:'小水电',power:10,cost:{tools:.04}},wind:{name:'风力',power:12,cost:{tools:.04}},biomass:{name:'生物质',power:16,cost:{wood:1.2,tools:.04}},industrial:{name:'既有工业电网',power:0,cost:{tools:.02}}},
 modes:{balanced:'生活与缺料优先',materials:'回收与零件优先',care:'诊疗与知识优先'},
 install:{wood:120,scrap:80,tools:20,knowledge:20},
 eras:{
  early:{title:'灯光越过窗沿',lines:['有人合上了那扇总在漏风的破门。','街头的亮光，不再靠某个人添柴守到天明。','打粮、伐木与废料拆解都有了常设班组，应急的手工采集也留着口子。','接下来要拍板的是：电流先送往何处，谁又该先得到照拂。']},
  middle:{title:'远处有人回答',lines:['电台底噪的另一头，传来了不同地方的口音。','修通的旧铁轨上，车皮满载着疫苗、工具与重新誊清的名册。','原镇的排班、学堂补员与例行供料，渐渐移交给了有常设预算的公署。','从今往后，纸面上的每一句承诺，都要拿千里之外的真金白银去兑现。']},
  late:{title:'火光映在舷窗上',lines:['最初替你拨亮炉火的工匠，已经不在这间屋子里了。','诊室、机修间与货运站，依然在后来者的手里一班接一班地转着。','原生人类、改造者与合成人，在公约上落下了同等分量的签名。','地球的万家灯火，第一次成了飞船舷窗外的风景。']}
 }
};
for(const [id,[name,requires,cost,duration,done]]of Object.entries(CivilModernContent.tech))CivilText.research[id]={name,requires,cost,duration,done,discover:s=>s.civilization.polishVersion===1&&!!s.civilization.village?.town&&(id!=='localgrid'||CivilCourse.is(s,'commons'))&&(!CivilModernContent.late.includes(id)||Number.isSafeInteger(s.civilization.city?.cityAt))};
