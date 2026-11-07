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
 mine:['矿脉走向已经摸清。必须先支起坑木、铺好矿车轨，人才能下井。','矿井支起了坑木。采矿工损耗工具，从探明的矿带里源源不断凿出铁矿石。'],
 coalpit:['旧矿图上标着一处露头煤层。要想下镐，同样少不了工具与通风道。','煤窑打通了风眼。采煤工能为炉火与日后的电站供应煤炭。'],
 furnace:['工坊的炉温总算能化开矿石了。是时候砌一座专门的冶炼炉。','冶炼炉烘起了炉膛。冶炼工将铁矿石与煤炭化作铁锭，黑烟也随之聚拢在屋顶。'],
 machineworks:['铁锭能车成咬合的齿轮与传动轴。机械作坊里得用识字、懂图样的工人。','机械作坊开工了。没电时只能靠手摇慢吞吞地挫制零件；一旦接通电力，同样的铁料能出更多精良活计。'],
 powerhouse:['小型发电机试车成功。电站运转离不开乌煤、备件，还有寸步不离的值守电工。','电缆接进了工区。电工日夜添煤检修；一旦机组停转，车床也就跟着歇了火。'],
 scrubber:['煤烟落满屋脊，也呛进人的肺管。可用水幕与滤网把黑灰拦下来。','烟尘处理设施并入了排烟管。只要电力、木料与备件不断，工区的天空就能干净几分。']
});
Object.assign(CivilText.research,{
 mining:{name:'浅层采矿',requires:['handtools'],discover:s=>!!s.civilization.industry?.mineKnown,cost:{wood:60,tools:12,knowledge:20},duration:240,done:'支护与通风法子试妥了。往后的铁料，不必再指望战前废墟里的残羹冷炙。'},
 furnace:{name:'基础冶炼',requires:['mining','handtools'],cost:{ore:20,wood:40,tools:12,knowledge:25},duration:300,done:'第一块试炼铁锭在冷水里激出白气。矿石配比、燃煤消耗与排烟代价，一并写进了工序册。'},
 mechanics:{name:'机械传动',requires:['furnace','school'],cost:{iron:20,tools:16,knowledge:40},duration:300,done:'齿轮与轴承严丝合缝地咬合在一起。共同体终于能车出自己的机械零件。'},
 power:{name:'发电配电',requires:['mechanics','metal'],cost:{iron:20,parts:8,knowledge:50},duration:360,done:'玻璃泡里的灯丝亮了起来。电力仍须持续生产，机器也得按负荷接线。'}
});
