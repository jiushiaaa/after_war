/* MPL-2.0 — Paid city services; population, stores and electricity remain with their existing owners. */
var CivilServiceContent={
  facilities:{
    pharmacy:{name:'药物制备所',requires:['medicine'],cost:{wood:180,iron:40,glass:10,parts:12,tools:12},duration:240,max:8,jobs:{pharmacist:8}},
    waterworks:{name:'公共水务站',requires:['municipal_engineering'],cost:{wood:240,steel:40,glass:12,parts:20,tools:16},duration:300,max:4,jobs:{waterworker:8}},
    waterfield:{name:'水务田片',requires:['municipal_engineering'],cost:{wood:160,iron:12,tools:18},duration:180,max:10,jobs:{farmer:8}},
    irrigationworks:{name:'田片灌溉改造',requires:['municipal_engineering'],cost:{wood:180,steel:12,glass:4,parts:8,tools:20},duration:240,max:1},
    districtschool:{name:'街区学校',requires:['municipal_engineering'],cost:{wood:200,steel:16,glass:12,parts:8,tools:12},duration:240,max:4,jobs:{teacher:12}},
    heatingplant:{name:'供热站',requires:['district_heating'],cost:{wood:200,iron:40,steel:30,parts:16,tools:20},duration:300,max:4,jobs:{heatingworker:4}},
    passengerfleet:{name:'迁居车组装备',requires:['passenger_transport'],homeOnly:true,cost:{wood:180,iron:40,steel:24,parts:16,tools:20},duration:360,max:2,jobs:{transporter:2}},
    densehousing:{name:'密集住区',requires:['municipal_engineering'],cost:{wood:300,steel:90,glass:40,parts:30,tools:20},duration:360,max:6,beds:160}
  },
  jobs:{pharmacist:'药剂师',waterworker:'水务工',heatingworker:'供热工',servicebuilder:'营建工'}
};
Object.assign(CivilCatalog.jobs,CivilServiceContent.jobs);
Object.assign(CivilText.labels,CivilServiceContent.jobs,Object.fromEntries(Object.entries(CivilServiceContent.facilities).map(([id,d])=>[id,d.name])));
Object.assign(CivilText.research,{
  medicine:{name:'药物制备',requires:['sanitation','chemistry'],discover:s=>!!s.civilization.urban?.city && (s.stores.chemicals||0)>0,cost:{chemicals:12,glass:8,knowledge:80},duration:360,done:'药剂的配方、洁净容器与检验步骤写进了手册。制备所需要化学品、食物和持续供电。'},
  municipal_engineering:{name:'公用工程',requires:['urbanworks','steel','chemistry'],discover:s=>!!s.civilization.urban?.city && (s.stores.steel||0)>0 && (s.stores.glass||0)>0,cost:{steel:20,glass:12,parts:12,knowledge:100},duration:420,done:'水泵、管网和住区结构有了统一图纸。工程仍要运来材料，由当地居民逐段建成。'},
  district_heating:{name:'集中供暖',requires:['municipal_engineering','power'],discover:s=>!!s.civilization.urban?.city,cost:{steel:12,parts:8,knowledge:80},duration:300,done:'锅炉、循环泵与热管的图纸已经备齐。供热站建成后还须安排值守、备足燃煤，并试运行后交接供暖。'}
});
const preServiceCapacity=CivilCatalog.capacity,preServiceJobCapacity=CivilCatalog.jobCapacity;
CivilCatalog.capacity=function(s){return preServiceCapacity(s)+(typeof CivilServices!=='undefined'?CivilServices.capacityBonus(s,'home'):0);};
CivilCatalog.jobCapacity=function(s,job){const extra=typeof CivilServices!=='undefined'?CivilServices.jobs(s,'home')[job]||0:0;return Object.hasOwn(CivilServiceContent.jobs,job)?extra:preServiceJobCapacity(s,job)+extra;};
