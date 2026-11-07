/* MPL-2.0 — Paid local capacities; no automatic people, materials or city-cluster grants. */
var CivilMunicipalContent={
  agreementCost:{knowledge:20},
  jobs:['farmer','medic','builder','smith','salvager','gatherer','teacher','miner','collier','smelter','machinist','electrician','communityworker'],
  facilities:{
    meetinghall:{name:'公共会堂',cost:{wood:120,iron:12,tools:8},duration:180,max:1,jobs:{communityworker:14}},
    farmland:{name:'地方田片',cost:{wood:120,iron:6,tools:12},duration:180,max:8,jobs:{farmer:8}},
    clinic:{name:'地方诊疗站',cost:{wood:160,iron:12,parts:6},duration:180,max:10,jobs:{medic:4}},
    school:{name:'地方学舍',cost:{wood:140,iron:8,parts:4},duration:180,max:6,jobs:{teacher:4}},
    toolworks:{name:'地方制器间',cost:{wood:160,iron:20,parts:6},duration:180,max:4,jobs:{smith:4}},
    salvageyard:{name:'地方回收场',cost:{wood:100,iron:8,tools:8},duration:180,max:8,jobs:{salvager:4}},
    woodlot:{name:'地方林场',cost:{wood:80,tools:8},duration:120,max:6,jobs:{gatherer:4}},
    residential:{name:'居住街区',cost:{wood:240,iron:24,parts:8},duration:240,max:8,beds:24},
    blockhousing:{name:'街坊住宅',cost:{wood:500,iron:60,parts:20,tools:20},duration:360,max:4,beds:96},
    mine:{name:'地方矿井',cost:{wood:160,iron:12,tools:15},duration:240,max:4,jobs:{miner:4}},
    coalpit:{name:'地方煤窑',cost:{wood:140,iron:10,tools:12},duration:240,max:4,jobs:{collier:4}},
    furnace:{name:'地方冶炼炉',cost:{wood:180,iron:20,tools:15},duration:240,max:4,jobs:{smelter:3}},
    machineworks:{name:'地方机械坊',cost:{wood:160,iron:40,parts:8,tools:20},duration:240,max:4,jobs:{machinist:3}},
    powerhouse:{name:'地方电站',cost:{wood:200,iron:50,parts:12,tools:20},duration:300,max:4,jobs:{electrician:2}},
    scrubber:{name:'烟尘处理设施',cost:{wood:100,iron:20,parts:10},duration:240,max:2}
  }
};
