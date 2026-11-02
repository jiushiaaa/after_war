/* MPL-2.0 — Public industries and autonomous regional diplomacy. */
var CivilForeignContent={
  interval:300,travel:300,term:1800,opening:{knowledge:180,electronics:20},
  credit:{tight:{name:'紧缩授信',limit:120},balanced:{name:'审慎授信',limit:240},open:{name:'扩大授信',limit:480}},
  prices:{food:1,medicine:6,tools:4,parts:5,knowledge:2,coal:2,steel:5,electronics:8},
  profiles:{
    north:{need:'coal',use:6,output:{parts:12},resolve:3},
    east:{need:'medicine',use:4,output:{knowledge:20},resolve:1},
    west:{need:'steel',use:5,output:{tools:16,coal:12},resolve:3},
    rainforest:{need:'tools',use:6,output:{medicine:16},resolve:1},
    desert:{need:'parts',use:6,output:{food:120},resolve:3},
    plateau:{need:'electronics',use:4,output:{knowledge:30,steel:10},resolve:1},
    islands:{need:'tools',use:6,output:{parts:16},resolve:2},
    polar:{need:'parts',use:6,output:{knowledge:35,electronics:8},resolve:2}
  },
  proposals:{arbitrate:{name:'提出停火与预算仲裁',cost:{knowledge:60},bonus:0},observe:{name:'派驻联合观察团',cost:{knowledge:100,medicine:12,tools:12},bonus:25}}
};
