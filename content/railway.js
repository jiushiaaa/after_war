/* MPL-2.0 — The first paid national freight corridor uses existing construction and transport. */
Object.assign(CivilText.research,{
  railway_engineering:{name:'铁路工程',requires:['logistics','steel','machine_tools','electronics'],discover:s=>Number.isSafeInteger(s.civilization.nation?.foundedAt),cost:{knowledge:400,steel:80,precisionparts:20,electronics:12},duration:600,done:'钢轨、信号灯与机车牵引试样全部核验合格。现可在议事屋立项筹办铁轨支线与转运站；筑路材料仍须由原货车分批拉去，竣工后方能排入列车班次。'}
});
CivilServiceContent.facilities.railfreight={name:'铁轨支线与转运站',node:'rail',requires:['railway_engineering'],paidWork:true,cost:{wood:200,steel:300,parts:80,precisionparts:30,electronics:20,tools:40},duration:600,max:1,hint:'竣工后可在议事屋切为铁路班次：需4名运输工当值、单趟载重128、单程缩至45秒。每跑一趟另耗煤2、零件0.1、工具0.05；亦可等列车归站后切回加固货车。'};
CivilText.labels.railfreight='铁轨支线与转运站';
