/* MPL-2.0 — Independent living sources; contact never grants home residents or stores. */
var CivilOriginContent={
  river_network:{name:'河网散居圈',baseline:1800,housing:2200,retained:720,permit:1080,
    initial:age=>({human:(age<40?23:22)-(age%4===0?5:4),mutant:age%4===0?5:4}),
    discover:s=>!!(s.civilization.urban?.registered || s.civilization.village?.riverKnown || s.civilization.regions?.nodes.river?.discovered),
    fertilityBands:[{min:18,max:29,retained:111},{min:30,max:39,retained:92},{min:40,max:49,retained:88}],
    school:{places:10,max:7,duration:180,cost:{wood:120,tools:12,knowledge:20}},
    contactDuration:240,contactCost:{food:12,tools:1},agreementCost:{knowledge:20},sourceAgreementCost:{},
    limits:{farmer:320,medic:180,smith:16,salvager:40,teacher:40,gatherer:20}},
  old_city_fringe:{name:'旧城外缘',baseline:2000,housing:2400,retained:800,permit:1200,
    initial:()=>({human:20,mutant:5}),
    discover:s=>!!s.civilization.urban?.city && (typeof CivilRegions!=='undefined'?CivilRegions.discoveredCount(s):Object.values(s.civilization.regions?.nodes||{}).filter(n=>n.discovered).length)>=2,
    fertilityBands:[{min:18,max:29,retained:120},{min:30,max:39,retained:100},{min:40,max:49,retained:100}],
    school:{places:10,max:8,duration:180,cost:{wood:120,tools:12,knowledge:20}},
    contactDuration:480,contactCost:{food:12,tools:1},agreementCost:{knowledge:20},sourceAgreementCost:{wood:10,knowledge:10},
    limits:{farmer:320,medic:180,smith:16,salvager:40,teacher:40,gatherer:20}},
  mountain_settlements:{name:'山间聚居圈',baseline:1600,housing:2000,retained:640,permit:960,
    initial:()=>({human:13,mutant:7}),
    discover:s=>!!s.civilization.urban?.city && !!s.civilization.regions?.nodes.highland?.discovered,
    fertilityBands:[{min:18,max:29,retained:96},{min:30,max:39,retained:80},{min:40,max:49,retained:80}],
    school:{places:10,max:6,duration:180,cost:{wood:120,tools:12,knowledge:20}},
    contactDuration:480,contactCost:{food:12,tools:1},agreementCost:{knowledge:20},sourceAgreementCost:{wood:10,knowledge:10},
    limits:{farmer:320,medic:180,smith:16,salvager:40,teacher:40,gatherer:20}}
};
