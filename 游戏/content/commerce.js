/* MPL-2.0 — Paid foreign caravans exchange existing inventories. */
var CivilCommerceContent={
  signature:{home:{knowledge:60},source:{knowledge:30}},
  cargo:{tools:12},returnCargo:{food:120},travelCost:{food:6,wood:2,tools:.1,parts:.1},
  routes:{river_network:{corridor:'river',duration:120},old_city_fringe:{corridor:'rail',duration:240},mountain_settlements:{corridor:'highland',duration:240}}
};
CivilServiceContent.facilities.foreigncaravan={name:'对外商队装备',homeOnly:true,discover:s=>!!s.civilization.commerce,requires:['logistics','steel'],paidWork:true,cost:{wood:80,steel:60,parts:20,tools:10},duration:360,max:1,hint:'两名空闲运输工驾驶商队。议事屋签订贸易约定，每次最多委托六趟；材料和货物都由原仓库实付。'};
CivilText.labels.foreigncaravan='对外商队装备';
