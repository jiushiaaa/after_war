/* MPL-2.0 — Paid road migration equipment; cargo capacity and railways stay separate. */
var CivilPassengerContent={
  profiles:{road8:{capacity:8,crew:2,maintenance:{wood:0,parts:0,tools:0}},road24:{capacity:24,crew:4,maintenance:{wood:2,parts:.2,tools:.5}}}
};
Object.assign(CivilText.research,{
  passenger_transport:{name:'迁居运输组织',requires:['logistics','standards','steel'],discover:s=>!!s.civilization.urban?.city&&Object.values(s.civilization.origins?.nodes||{}).some(n=>n.status==='agreed'),cost:{knowledge:120,steel:20,parts:12,tools:16},duration:480,done:'行李挂车、老幼坐席与随行队列定下了统一章程。发运迁居大队仍需拨料造好车组装备，并分派四名运输工随车照应。'}
});
