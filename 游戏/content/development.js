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
 farm:['泵站边的土样冒出了绿芽。总算能垦出几分干净的田地了。','种子撒进了试验田。现在可以分派农夫了；每块田最多容四个人伺候。'],
 toolshop:['挑拣出来的旧零件，可以回炉重打成统一尺寸的手工具。','工具台支起来了。制器工耗用木料与废料，打造趁手的工具。'],
 longhouse:['有了好工具，就能锯出长梁。好几户人家可以住进同一座长屋里。','长屋里添了八张床铺。招揽更多人住进来之前，得先掂量锅里的余粮。'],
 clinic:['旧诊疗手册上，还留着清创消毒和熬制基础药剂的方子。','诊所挂牌接诊。医护在此配制基础药品，日常看诊治病也需消耗药材。'],
 schoolhouse:['要想把本事传下去，单靠你和老工匠脑子里的这点记忆可不够。','学堂里摆齐了桌椅。先生耗用木料纸张，把零散的学问攒成可传授的知识。'],
 road:['河谷的方位已经摸准。眼下可以先修通连接泵站与河谷的路。','通往河谷的道路夯实了。车队送去工具和药品，拉回实打实的粮食。']
});
Object.assign(CivilText.research,{
 agronomy:{name:'土壤辨识',requires:['water'],discover:s=>s.civilization.pump,cost:{wood:30,food:20,scrap:12},duration:180,done:'泵站周边筛出了几片毒素消退的泥土。嫩根终于扎进了灰土里。'},
 handtools:{name:'标准手工具',requires:['metal'],discover:s=>!!s.game.buildings.outpost,cost:{wood:30,scrap:30},duration:180,done:'第一批同尺寸的斧头与锄头试手合格。往后坏了家伙，不必再漫山遍野找独一份的零件了。'},
 irrigation:{name:'灌溉',requires:['agronomy'],discover:s=>!!s.game.buildings.farm,cost:{wood:50,scrap:20,tools:5},duration:240,done:'水渠引来了泵站的活水。只要外站补给不断，田里的收成就能再厚几分。'},
 preservation:{name:'食物保存',requires:['metal'],discover:s=>!!s.game.buildings.farm,cost:{wood:30,food:30,scrap:10},duration:180,done:'干粮得以分装封存。路途上的耗损降下来，远处的聚居地也不再遥不可及。'},
 records:{name:'公共记录',requires:[],discover:s=>s.civilization.station && !!s.game.buildings.outpost,cost:{wood:30,scrap:10},duration:120,done:'从交通站搜集来的废纸背面装订成册。欠下的物资、摸索出的手艺，都有了白纸黑字的底账。'},
 sanitation:{name:'公共卫生',requires:['water','records'],discover:s=>s.game.population>=12,cost:{wood:40,food:20,scrap:20},duration:180,done:'饮水与秽物分沟流走。诊所能护住更多街坊的性命了。'},
 school:{name:'基础教育',requires:['records','preservation'],cost:{wood:40,tools:8},duration:240,done:'孤本旧教材被手抄成许多份。聚落总算能带出自己的先生了。'},
 trails:{name:'道路维护',requires:['handtools'],discover:s=>s.civilization.station,cost:{wood:50,tools:8},duration:180,done:'补给班标出了沿途的断桥与缓坡。现在可以顺着商队的车辙，去寻访河谷的聚居地了。'}
});
