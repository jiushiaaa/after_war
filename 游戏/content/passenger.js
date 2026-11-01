/* MPL-2.0 — Paid road migration equipment; cargo capacity and railways stay separate. */
var CivilPassengerContent={
  profiles:{road8:{capacity:8,crew:2,maintenance:{wood:0,parts:0,tools:0}},road24:{capacity:24,crew:4,maintenance:{wood:2,parts:.2,tools:.5}}}
};
Object.assign(CivilText.research,{
  passenger_transport:{name:'迁居运输组织',requires:['logistics','standards','steel'],discover:s=>!!s.civilization.urban?.city&&Object.values(s.civilization.origins?.nodes||{}).some(n=>n.status==='agreed'),cost:{knowledge:120,steel:20,parts:12,tools:16},duration:480,done:'行李车、老幼乘用车具与家庭队列有了统一安排。迁居车组仍需付材料、完成施工，并安排四名运输工。'}
});
