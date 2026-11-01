/* MPL-2.0 — The first paid national freight corridor uses existing construction and transport. */
Object.assign(CivilText.research,{
  railway_engineering:{name:'铁路工程',requires:['logistics','steel','machine_tools','electronics'],discover:s=>Number.isSafeInteger(s.civilization.nation?.foundedAt),cost:{knowledge:400,steel:80,precisionparts:20,electronics:12},duration:600,done:'轨道、信号与牵引试样通过检验。议事屋可筹办铁轨支线与转运站；材料仍须由原车运到，完工后再安排铁路班次。'}
});
CivilServiceContent.facilities.railfreight={name:'铁轨支线与转运站',node:'rail',requires:['railway_engineering'],paidWork:true,cost:{wood:200,steel:300,parts:80,precisionparts:30,electronics:20,tools:40},duration:600,max:1,hint:'竣工后在议事屋选择铁路班次：4名运输工、载重128、单程45秒。每趟另耗煤2、零件0.1、工具0.05；可等原车归来后切回货车。'};
CivilText.labels.railfreight='铁轨支线与转运站';
