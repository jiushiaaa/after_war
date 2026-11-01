/* MPL-2.0 — First industrial chain; no power stockpile or late-era placeholder actions. */
CivilCatalog.resources.push('ore','coal','iron','parts');
Object.assign(CivilCatalog.jobs,{miner:'采矿工',collier:'采煤工',smelter:'冶炼工',machinist:'机械工',electrician:'电工'});
Object.assign(CivilCatalog.jobBuildings,{mine:'miner',coalpit:'collier',furnace:'smelter',machineworks:'machinist',powerhouse:'electrician'});
Object.assign(CivilCatalog.limits,{mine:2,coalpit:2,furnace:2,machineworks:2,powerhouse:2,scrubber:1});
const preIndustryJobCapacity=CivilCatalog.jobCapacity;
CivilCatalog.jobCapacity=function(s,job){
  const capacities={miner:['mine',4],collier:['coalpit',4],smelter:['furnace',3],machinist:['machineworks',3],electrician:['powerhouse',2]};
  const def=capacities[job];return def?(s.game.buildings[def[0]]||0)*def[1]:preIndustryJobCapacity(s,job);
};
Object.assign(CivilText.labels,{ore:'铁矿石',coal:'煤',iron:'铁锭',parts:'机械零件',miner:'采矿工',collier:'采煤工',smelter:'冶炼工',machinist:'机械工',electrician:'电工',mine:'浅层矿井',coalpit:'煤窑',furnace:'冶炼炉',machineworks:'机械作坊',powerhouse:'小电站',scrubber:'烟尘处理设施'});
Object.assign(CivilText.buildings,{
 mine:['矿带已经勘过。架起支柱和运料轨道，才能让人安全下井。','矿井竖起了支柱。采矿工消耗工具，从已确认的矿带运回铁矿石。'],
 coalpit:['旧矿图标着一处露头煤层。开采仍需要工具和通风。','煤窑通了风。采煤工能供应炉火与今后的电站。'],
 furnace:['工坊的炉温终于能使矿料熔开。可以修一座专用炉。','冶炼炉开始预热。冶炼工把铁矿石和煤变成铁锭，烟尘也会积累。'],
 machineworks:['铁锭可以加工成齿轮和轴。机械作坊需要受过教育的工人。','机械作坊开门了。机械工能慢速加工零件，通电后同样的材料能做得更好。'],
 powerhouse:['小型发电机试转成功。电站需要煤、零件和实际值守的人。','电站接上了工区。电工持续供煤和检修；发电机停转时，机器也会失去动力。'],
 scrubber:['烟尘留在屋顶和肺里。可以用水洗与过滤把它收集下来。','烟尘处理设施接入管道。有电、有木料和维护零件时，它能降低工区污染。']
});
Object.assign(CivilText.research,{
 mining:{name:'浅层采矿',requires:['handtools'],discover:s=>!!s.civilization.industry?.mineKnown,cost:{wood:60,tools:12,knowledge:20},duration:240,done:'支护和通风方案经过了试验。矿石不必永远来自战前废墟。'},
 furnace:{name:'基础冶炼',requires:['mining','handtools'],cost:{ore:20,wood:40,tools:12,knowledge:25},duration:300,done:'第一块试制铁锭冷却了。原料、燃料和烟尘都写进了工序记录。'},
 mechanics:{name:'机械传动',requires:['furnace','school'],cost:{iron:20,tools:16,knowledge:40},duration:300,done:'齿轮和轴承能相互配合。共同体开始制造自己的机械零件。'},
 power:{name:'发电配电',requires:['mechanics','metal'],cost:{iron:20,parts:8,knowledge:50},duration:360,done:'灯丝亮了起来。电力必须持续生产，机器也必须按负载接入。'}
});
