/* MPL-2.0 — Playable village content. Later Earth-era nodes remain design specifications. */
var CivilCatalog = {
  resources:['wood','food','fur','scrap','tools','medicine','knowledge'],
  jobs:{gatherer:'采木工',hunter:'猎人',salvager:'回收工',farmer:'农夫',smith:'制器工',medic:'医护',teacher:'教师'},
  jobBuildings:{lodge:'hunter',workshop:'salvager',farm:'farmer',toolshop:'smith',clinic:'medic',schoolhouse:'teacher'},
  limits:{trap:5,cart:1,hut:4,lodge:1,granary:1,workshop:1,cistern:1,outpost:1,farm:4,toolshop:1,longhouse:4,clinic:2,schoolhouse:2,road:1},
  jobCapacity(s,job){return job==='farmer'?(s.game.buildings.farm||0)*4:job==='smith'?4:job==='medic'?(s.game.buildings.clinic||0)*2:job==='teacher'?(s.game.buildings.schoolhouse||0)*2:Infinity;},
  capacity(s){return (s.game.buildings.hut||0)*4+(s.game.buildings.longhouse||0)*8;},
  researchAvailable(s,id){
    const r=CivilText.research[id];
    return !!r && !!s.game.buildings.workshop && (r.requires||[]).every(k=>s.civilization.tech[k]) && (!r.discover || r.discover(s));
  }
};
Object.assign(CivilText.labels,{tools:'工具',medicine:'药品',knowledge:'知识',farmer:'农夫',smith:'制器工',medic:'医护',teacher:'教师',farm:'试验田',toolshop:'工具台',longhouse:'长屋',clinic:'诊所',schoolhouse:'学堂',road:'河谷道路'});
Object.assign(CivilText.buildings,{
 farm:['泵站边的土样通过了发芽试验。能开出几块干净的田。','种子播进了试验田。可以分派农夫；每块田最多容纳四人。'],
 toolshop:['零件可以重新制成统一规格的手工具。','工具台开始运转。制器工消耗木料和废料制造工具。'],
 longhouse:['工具能锯开更长的梁。几户人家可以住在同一座长屋。','长屋添了八张床。接纳更多人之前，要留足口粮。'],
 clinic:['留下的诊疗手册描述了清洁伤口和配制基础药剂的方法。','诊所开始接诊。医护制作基础药品，治疗也会消耗药品。'],
 schoolhouse:['要让知识留下来，光靠冰封者和工匠的记忆还不够。','学堂摆好了桌椅。教师消耗纸材，积累可以传授的知识。'],
 road:['已经记下河谷的位置。可以先修通连接泵站的道路。','河谷道路通了。车队会带去工具和药品，换回真正运到的粮食。']
});
Object.assign(CivilText.research,{
 agronomy:{name:'土壤辨识',requires:['water'],discover:s=>s.civilization.pump,cost:{wood:30,food:20,scrap:12},duration:180,done:'泵站附近找到了几片污染较轻的土壤。种子的根伸进了灰土。'},
 handtools:{name:'标准手工具',requires:['metal'],discover:s=>!!s.game.buildings.outpost,cost:{wood:30,scrap:30},duration:180,done:'一批斧头与锄头通过了试用。修理不必再寻找独一份的零件。'},
 irrigation:{name:'灌溉',requires:['agronomy'],discover:s=>!!s.game.buildings.farm,cost:{wood:50,scrap:20,tools:5},duration:240,done:'沟渠接上了泵站。外站供给正常时，农夫能收获更多食物。'},
 preservation:{name:'食物保存',requires:['metal'],discover:s=>!!s.game.buildings.farm,cost:{wood:30,food:30,scrap:10},duration:180,done:'食物可以分装封存。运输耗粮减少，远方的聚居地不再那么遥远。'},
 records:{name:'公共记录',requires:[],discover:s=>s.civilization.station && !!s.game.buildings.outpost,cost:{wood:30,scrap:10},duration:120,done:'交通站的纸页装订成了名册。欠下的物资、学到的办法都有了记录。'},
 sanitation:{name:'公共卫生',requires:['water','records'],discover:s=>s.game.population>=12,cost:{wood:40,food:20,scrap:20},duration:180,done:'用水和污物分开处理。公共诊所可以照料更多居民。'},
 school:{name:'基础教育',requires:['records','preservation'],cost:{wood:40,tools:8},duration:240,done:'旧教材被抄成了许多份。聚落能够培养自己的教师。'},
 trails:{name:'道路维护',requires:['handtools'],discover:s=>s.civilization.station,cost:{wood:50,tools:8},duration:180,done:'补给班标出了断桥和安全坡道。可以循着商队的来路寻找河谷聚居地。'}
});
