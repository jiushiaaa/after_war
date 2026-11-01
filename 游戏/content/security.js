/* MPL-2.0 — Staffed road defense and a civilian detour, unlocked by real trade. */
var CivilSecurityContent={
  signature:{home:{knowledge:120},source:{knowledge:60}},
  modes:{
    detour:{name:'绕行远路',homeGuard:0,sourceGuard:0,extraTime:120,delay:0,homeCost:{food:6,wood:1,tools:.1},sourceCost:{}},
    self:{name:'本城守备护送',homeGuard:4,sourceGuard:0,extraTime:0,delay:30,homeCost:{food:12,tools:.4,medicine:1},sourceCost:{}},
    joint:{name:'共同护送',homeGuard:2,sourceGuard:2,extraTime:0,delay:30,homeCost:{food:6,tools:.2,medicine:.5},sourceCost:{food:6,tools:.2}}
  }
};
CivilServiceContent.facilities.guardpost={name:'守备训练场',homeOnly:true,discover:s=>!!s.civilization.security,requires:['logistics','steel'],paidWork:true,cost:{wood:120,steel:80,tools:30,parts:20},duration:360,max:1,jobs:{guard:4},hint:'增加四个守备岗位，不增加居民。至少两名守备，实际付费训练300秒，才能承担商路护送。'};
CivilServiceContent.jobs.guard='守备';CivilCatalog.jobs.guard='守备';CivilText.labels.guard='守备';CivilText.labels.guardpost='守备训练场';
