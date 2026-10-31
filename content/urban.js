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
  if(['mine','coalpit','furnace','machineworks','powerhouse'].includes(id))return s.civilization.tech.urbanworks?4:2;
  if(['clinic','schoolhouse'].includes(id))return s.civilization.tech.mechanics?2:1;
  return CivilCatalog.limits[id]||0;
};
Object.assign(CivilText.labels,{publicclinic:'公共诊疗站',publicschool:'公共学舍',irrigatedfield:'灌溉田片',toolworks:'制器间',residential:'居住街区',blockhousing:'街坊住宅'});
Object.assign(CivilText.buildings,{
  publicclinic:['统一器具可以供一整组医护使用。先扩诊疗，再接纳新的家庭。','公共诊疗站开门了。增加四个医护岗位，药品仍需食物、废料和实际劳动。'],
  publicschool:['公共学舍为儿童留下课桌，也让教师能整理旧知识。','学舍增加四个教师岗位。每位在岗教师能照顾二十名儿童的学习。'],
  irrigatedfield:['维护好的泵站能把水送到更远的田埂。','田片增加八个农夫岗位。没有农夫就没有收成，泵站断供也会减产。'],
  toolworks:['标准规格让更多制器工共用夹具。','制器间增加四个岗位。木料与废料仍需源源不断地送来。'],
  residential:['诊疗与课堂已有值守的人。现在可以为更多家庭修建住处。','居住街区添了二十四张床。住房不会自行带来居民。'],
  blockhousing:['城镇工程把道路、排水与住房连在一起。下一批居民仍需要足够的粮食和诊疗。','街坊住宅添了九十六张床。接纳车队仍按名册、物资和服务能力分批出发。']
});
Object.assign(CivilText.research,{
  standards:{name:'标准与计量',requires:['school','mechanics'],cost:{knowledge:60,iron:20,parts:8},duration:300,done:'器具、梁柱和货箱终于有了共同的尺度。公共设施可以分批扩建。'},
  urbanworks:{name:'城镇工程',requires:['standards','administration','power'],discover:s=>!!s.civilization.urban?.chartered && s.game.population>=80 && CivilUrban.publicServices(s),cost:{knowledge:100,iron:40,parts:16,tools:20},duration:420,done:'道路、排水、住宅与工区写进同一份工程记录。可以修建街坊住宅，并付费扩建第三、第四座工业设施。'}
});
