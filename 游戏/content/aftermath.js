/* MPL-2.0 — Physical reconstruction, recovery diplomacy and alliance relief. */
var CivilAftermathContent={
 costs:{open:{knowledge:220,electronics:16},conference:{knowledge:160,medicine:20},plan:{knowledge:40},industry:{knowledge:80},downgrade:{knowledge:60},mandate:{knowledge:40}},
 conferenceLocal:{food:30,parts:4,knowledge:20},monitor:{food:6,parts:1,knowledge:2},
 plans:{services:{name:'优先修复公共设施',repair:10,cost:{food:24,tools:8,parts:8}},restart:{name:'边修复边复工',repair:5,cost:{food:16,tools:5,parts:5}}},
 industries:{
  north:{name:'清理旧煤巷',capital:{food:120,tools:24,parts:12,knowledge:80},work:{food:8,tools:2,parts:1},cost:{food:14,tools:2,parts:1,knowledge:1},output:{coal:8}},
  west:{name:'复修小型钢炉',capital:{food:160,tools:30,parts:30,knowledge:120},work:{food:12,parts:2,coal:4},cost:{food:12,coal:6,tools:2,parts:2},output:{steel:6}},
  east:{name:'恢复社区制药线',capital:{food:100,tools:24,parts:16,knowledge:80},work:{food:8,parts:2,knowledge:2},cost:{food:14,tools:2,parts:1,knowledge:2},output:{medicine:6}}
 }
};
