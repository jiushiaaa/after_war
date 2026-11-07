/* MPL-2.0 — Paid public services, housing and the first city. */
Object.assign(CivilCatalog.limits,{publicclinic:8,publicschool:4,irrigatedfield:6,toolworks:2,residential:8,blockhousing:4});
Object.assign(CivilCatalog.jobBuildings,{publicclinic:'medic',publicschool:'teacher',irrigatedfield:'farmer',toolworks:'smith'});
const preUrbanCapacity=CivilCatalog.capacity,preUrbanJobCapacity=CivilCatalog.jobCapacity;
CivilCatalog.capacity=function(s){return preUrbanCapacity(s)+(s.game.buildings.residential||0)*24+(s.game.buildings.blockhousing||0)*96;};
CivilCatalog.jobCapacity=function(s,job){
  const add={medic:['publicclinic',4],teacher:['publicschool',4],farmer:['irrigatedfield',8],smith:['toolworks',4]}[job];
  return preUrbanJobCapacity(s,job)+(add?(s.game.buildings[add[0]]||0)*add[1]:0);
};
CivilCatalog.buildingLimit=function(s,id){
  // A long-lived town must be able to pay for additional care before city-only pharmacy research.
  if(id==='publicclinic'&&[1,2].includes(s.civilization.pacingVersion)&&s.civilization.tech.publicHealth)return 12;
  if(['mine','coalpit','furnace','machineworks','powerhouse'].includes(id))return s.civilization.tech.urbanworks?4:2;
  if(['clinic','schoolhouse'].includes(id))return s.civilization.tech.mechanics||id==='schoolhouse'&&s.civilization.pacingVersion===2&&s.civilization.village?.town&&s.civilization.tech.school||id==='clinic'&&typeof CivilVillage!=='undefined'&&(CivilVillage.careShortfall(s)||(s.game.buildings.clinic||0)>=2)?2:1;
  return CivilCatalog.limits[id]||0;
};
Object.assign(CivilText.labels,{publicclinic:'公共诊疗站',publicschool:'公共学舍',irrigatedfield:'灌溉田片',toolworks:'制器间',residential:'居住街区',blockhousing:'街坊住宅'});
Object.assign(CivilText.buildings,{
  publicclinic:['标准化的医疗器械足够支起一整班医护。先把诊疗底子打牢，再迎新的家庭进城。','公共诊疗站开诊了。新增四个医护岗位，制药仍需耗用食物、废料与在岗人力。'],
  publicschool:['公共学舍给适龄孩童留出了课桌，也让先生们有地方整理旧时代的学问。','学舍新增四个教师岗位。每位在岗先生可照看二十名孩童的功课。'],
  irrigatedfield:['检修妥当的泵站，能把活水引向更远的田垄。','新辟的田片添了八个农夫岗位。田要人种才有收成，泵站断供同样会让庄稼减产。'],
  toolworks:['统一的量规与夹具，让更多制器工得以同台干活。','制器间添了四个工位。木料与废料还得源源不断供上。'],
  residential:['诊所与学堂都有人当值了。现在可以动工为更多家庭盖房。','居住街区落成，添了二十四张床位。但空房子不会自己生出居民。'],
  blockhousing:['城镇工程把路面、暗渠与屋舍连成了一片。迎接下一批流民前，仍得备足口粮与医药。','街坊住宅落成，添了九十六张床位。接纳车队仍将按名册、路费与公共服务承载力分批启程。']
});
Object.assign(CivilText.research,{
  standards:{name:'标准与计量',requires:['school','mechanics'],cost:{knowledge:60,iron:20,parts:8},duration:300,done:'器具、梁木与货箱总算用上了同一把尺子。公共设施可以分批扩建了。'},
  urbanworks:{name:'城镇工程',requires:['standards','administration','power'],discover:s=>!!s.civilization.urban?.chartered && s.game.population>=80 && CivilUrban.publicServices(s),cost:{knowledge:100,iron:40,parts:16,tools:20},duration:420,done:'道路、排水渠、住宅与工区绘入了同一张总图。现可兴建街坊住宅，并拨料扩建第三、第四座工业设施。'}
});
