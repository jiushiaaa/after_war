/* MPL-2.0 — Paid foreign caravans exchange existing inventories. */
var CivilCommerceContent={
  signature:{home:{knowledge:60},source:{knowledge:30}},
  cargo:{tools:12},returnCargo:{food:120},travelCost:{food:6,wood:2,tools:.1,parts:.1},
  routes:{river_network:{corridor:'river',duration:120},old_city_fringe:{corridor:'rail',duration:240},mountain_settlements:{corridor:'highland',duration:240}}
};
CivilServiceContent.facilities.foreigncaravan={name:'对外商队装备',homeOnly:true,discover:s=>!!s.civilization.commerce,requires:['logistics','steel'],paidWork:true,cost:{wood:80,steel:60,parts:20,tools:10},duration:360,max:1,hint:'需抽调两名空闲运输工随车押运。在议事屋签下贸易约定后，每批最多可排入六趟；造车建材与随车货品均从本城原仓支取。'};
CivilText.labels.foreigncaravan='对外商队装备';
