/* MPL-2.0 — Paid postwar institutions; no retrospective changes. */
var CivilSettlementContent={
 costs:{open:{knowledge:180,electronics:12},project:{knowledge:60},orientation:{knowledge:40},treaty:{knowledge:80}},
 projects:{
  granary:{name:'恢复地方粮食生产',capital:{food:80,tools:40,parts:20},work:{food:6,tools:2,parts:1},cost:{tools:2,parts:1,knowledge:1},output:{food:40}},
  depot:{name:'扩建公共货运站',capital:{food:80,tools:20,parts:20},work:{food:6,tools:1,parts:1},cost:{food:2,parts:0.25}}
 },
 orientations:{commerce:'商贸优先',defense:'审慎共同防卫',neutral:'武装中立'},
 treaties:{
  trade:{name:'限期互市和约',local:{food:8,knowledge:12},upkeep:{food:2,knowledge:1}},
  memory:{name:'平等自治与共同纪念',local:{food:12,knowledge:20},upkeep:{food:3,knowledge:3}},
  restitution:{name:'分期实物修复协定',local:{food:6,knowledge:12},upkeep:{knowledge:1}}
 },
 restitution:{food:12,parts:2,medicine:2},term:6000
};
