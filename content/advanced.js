/* MPL-2.0 — Advanced materials bootstrap from existing iron, coal, tools and machinery. */
var CivilAdvancedContent={
  resources:['minerals','chemicals','steel','glass'],
  jobs:{mineralworker:'矿物采集工',chemist:'化工工',steelworker:'炼钢工',glassworker:'玻璃工',utilityworker:'公用电站值守'},
  facilities:{
    mineralquarry:{name:'矿物采集场',cost:{wood:180,iron:20,parts:8,tools:20},duration:240,max:6,jobs:{mineralworker:4}},
    chemicalworks:{name:'基础化工间',cost:{wood:220,iron:40,parts:12,tools:20},duration:300,max:8,jobs:{chemist:6}},
    steelworks:{name:'炼钢炉',cost:{wood:220,iron:60,parts:16,tools:24},duration:300,max:4,jobs:{steelworker:3}},
    glassworks:{name:'玻璃窑',cost:{wood:180,iron:30,parts:10,tools:16},duration:240,max:4,jobs:{glassworker:4}},
    utilitypower:{name:'公用电站',cost:{wood:300,iron:80,parts:24,tools:30},duration:360,max:6,jobs:{utilityworker:4}},
    mineexpansion:{name:'矿井支护扩建',cost:{wood:240,iron:60,parts:12,tools:30},duration:300,max:3,jobs:{miner:8}},
    coalexpansion:{name:'煤区通风扩建',cost:{wood:220,iron:50,parts:12,tools:30},duration:300,max:3,jobs:{collier:8}},
    filterplant:{name:'工区净化设施',cost:{wood:200,iron:40,parts:12,tools:16},duration:240,max:6}
  }
};
CivilCatalog.resources.push(...CivilAdvancedContent.resources);
Object.assign(CivilCatalog.jobs,CivilAdvancedContent.jobs);
Object.assign(CivilText.labels,{minerals:'矿物料',chemicals:'基础化学品',steel:'钢材',glass:'玻璃',...CivilAdvancedContent.jobs});
for(const [id,facility]of Object.entries(CivilAdvancedContent.facilities)){
  CivilCatalog.limits[id]=facility.max;CivilText.labels[id]=facility.name;
  const job=Object.keys(facility.jobs||{})[0];if(job)CivilCatalog.jobBuildings[id]=job;
}
const beforeAdvancedJobs=CivilCatalog.jobCapacity;
CivilCatalog.jobCapacity=function(s,job){
  let add=0;for(const [id,facility]of Object.entries(CivilAdvancedContent.facilities))add+=(s.game.buildings[id]||0)*(facility.jobs?.[job]||0);
  return Object.hasOwn(CivilAdvancedContent.jobs,job)?add:beforeAdvancedJobs(s,job)+add;
};
Object.assign(CivilText.buildings,{
  mineralquarry:['工匠在旧矿图旁标出了石英砂、黏土和盐类矿层。可以修一处采集场。','采集工带回矿物料，化工与玻璃工序有了新的原料。'],
  chemicalworks:['矿物料已经分选。旧铁罐和耐热炉衬可以先搭起一套小型化工设备。','化工间开了火。电力充足时生产更快，断电后仍可加煤慢慢试制。'],
  steelworks:['铁锭、炉料与净化剂写进了新的工序表。炼钢炉的支架仍可用旧铁和零件搭建。','炉中钢液开始冷却。炼钢工继续需要铁锭、煤、化学品和维护工具。'],
  glassworks:['化工间分离出的矿物料可以交给玻璃工。透明器皿和窗片有了试制办法。','玻璃窑点起炉火。加煤可以维持慢速熔炼，通电则能提高产量。'],
  utilitypower:['更多工坊争用同一条配电线。可以另建一座公用电站。','公用电站开始值守。每名工人燃煤并维护机组，供给十份即时电力。'],
  mineexpansion:['新的炉子需要更多矿料。旧矿井还可以加固支护和运料通道。','矿井支护完工，新增八个采矿岗位。'],
  coalexpansion:['通风和提升设备可以让煤区容纳更多工人。','煤区通风扩建完成，新增八个采煤岗位。'],
  filterplant:['化工工人画出了吸收与过滤的管路。处理烟尘也需要电力和维护。','净化设施接上工区。每轮使用电、化学品、木料和零件，收集炉烟中的残留物。']
});
Object.assign(CivilText.research,{
  chemistry:{name:'基础化工',requires:['furnace','sanitation'],discover:s=>!!s.civilization.urban?.city&&!!s.game.buildings.furnace,cost:{knowledge:90,iron:30,coal:30,parts:12},duration:480,done:'分选、反应与净化写成了可以重复的工序。矿物料和煤火能制成第一批基础化学品。'},
  steel:{name:'炼钢',requires:['furnace','chemistry'],discover:s=>!!s.civilization.advanced?.made.chemicals,cost:{knowledge:110,iron:50,chemicals:12,tools:16},duration:480,done:'试样的韧性通过了检验。炼钢工可以继续改进炉温与配料。'}
});
