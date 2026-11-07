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
  mineralquarry:['工匠在旧矿图边缘圈出了石英砂、黏土与盐类矿层。可以在那儿建一处采集场。','采集工背回了分选好的矿物料，化工与烧制玻璃都有了着落。'],
  chemicalworks:['矿物料筛分完毕。用旧铁罐和耐火砖，能先拼起一套粗浅的化工反应釜。','化工间点起了炉火。通电时出料更快；若是断了电，也能添煤慢熬。'],
  steelworks:['生铁、炉料与脱氧剂的配比写进了新工序表。用熟铁和旧零件就能先支起炼钢炉架。','滚烫的钢水在模子里慢慢凝成暗红。炼钢工手头仍不能断了铁锭、乌煤、化学品与维护工具。'],
  glassworks:['化工间提纯出的石英与纯碱送到了玻璃工手上。烧制透明器皿和窗玻璃有了准谱。','玻璃窑烘热了砂料。添煤可维持慢速熔融，接通电力则能大幅增产。'],
  utilitypower:['新开的工坊都在抢同一根电缆里的电。得另起一座公用电站了。','公用电站有人值守了。每名电工添煤看护机组，可向电网稳定输送十份即时电力。'],
  mineexpansion:['新炉子胃口大，矿石渐渐跟不上了。旧矿井还得加固坑木、拓宽运料巷道。','矿井支护扩建完工，井下新增八个采矿工位。'],
  coalexpansion:['加装鼓风机与提升绞车后，煤窑深处就能容下更多矿工。','煤区通风扩建完工，井下新增八个采煤工位。'],
  filterplant:['化工工画出了喷淋吸收与过滤管路。要想滤净炉烟，同样得耗电、耗备件。','工区净化设施并入烟道。每轮耗用电力、化学品、木料与零件，将浓烟里的毒尘洗落下来。']
});
Object.assign(CivilText.research,{
  chemistry:{name:'基础化工',requires:['furnace','sanitation'],discover:s=>!!s.civilization.urban?.city&&!!s.game.buildings.furnace,cost:{knowledge:90,iron:30,coal:30,parts:12},duration:480,done:'筛分、酸洗与提纯定下了可复现的规程。粗鄙的矿砂在煤火中化作了第一批基础化学品。'},
  steel:{name:'炼钢',requires:['furnace','chemistry'],discover:s=>!!s.civilization.advanced?.made.chemicals,cost:{knowledge:110,iron:50,chemicals:12,tools:16},duration:480,done:'试炼钢条在重锤下未见崩裂。炼钢工可以继续摸索炉温与配料了。'}
});
