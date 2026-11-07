/* MPL-2.0 — National-scale city networks, distinct from the original origin settlements. */
var CivilWorldContent={
  regions:{
    north:{name:'北陆炉城联盟',cities:6,population:26000,trust:30,duration:300,issue:'命脉在于越冬燃料与风雪驿路。六座北方炉城要求落实公共救援，并保住地方预算自主权。'},
    east:{name:'东陆水系共同体',cities:8,population:42000,trust:40,duration:360,issue:'重在蓄洪治水与变异群体的同等待遇。水网沿岸的八座城市要求兑现共同医疗与平等公民权。'},
    west:{name:'西陆城邦联合',cities:7,population:31000,trust:20,duration:420,issue:'重在工业公差互认与城邦自治。七座工业城邦要求各自掌管地方仓库，一切条约须公开表决。'},
    rainforest:{name:'赤道雨带共生议会',cities:12,population:58000,trust:20,duration:480,gate:'ecological_recovery',rights:'equal',issue:'关乎变异生态与雨林栈道。须先掌握大区生态修复技术，并承认变异群体享有同等的公民资格。'},
    desert:{name:'内陆荒漠绿洲协约',cities:9,population:34000,trust:20,duration:540,gate:'ecological_recovery',issue:'命脉在于地下暗河与商队通行权。大区生态修复可提供耐污净水工艺；须等援助团将公共物资实打实送抵绿洲后，方能开启议约。'},
    plateau:{name:'南部高原观测城联会',cities:5,population:18000,trust:40,duration:540,gate:'space_manufacturing',issue:'守着战前的天文台与封存档案库。须先完成航天制造标准互认，方能建立正式的技术与外交往来。'},
    islands:{name:'大洋群岛港城联盟',cities:16,population:62000,trust:20,duration:660,gate:'ocean_navigation',autonomy:true,issue:'扼守远洋航道与港城自治权。须先建成远洋勤务船队，并承诺尊重地方自治。'},
    polar:{name:'极地遗产托管区',cities:4,population:12000,trust:40,duration:720,gate:'closed_ecology',rights:'equal',issue:'看守着冰盖下的避难所与近地轨道遗产。掌握闭环生命保障、落实平等公民资格是联合托管的前提；不得强行独占那些不可再生的战前遗物。'}
  },
  missions:{
    contact:{name:'建立国家联络',cost:{knowledge:120,food:60,parts:10,electronics:4},cargo:{},work:120},
    negotiate:{name:'派出议约与援助团',cost:{knowledge:100,food:180,medicine:24,tools:12,parts:8},cargo:{food:120,medicine:20,tools:10},work:180},
    campaign:{name:'发动机械化战役',cost:{knowledge:80,food:360,medicine:40,steel:120,parts:60,robots:4},cargo:{},work:600},
    rebuild:{name:'运送战后重建物资',cost:{knowledge:60,food:260,medicine:45,tools:40,parts:40},cargo:{food:200,medicine:40,tools:30,parts:30},work:300}
  },
  treasury:{food:1800,medicine:100,tools:300,parts:200,knowledge:2000},
  revenue:{food:5,medicine:.2,tools:.05,parts:.03,knowledge:1},
  services:{food:4,medicine:.1,tools:.03,parts:.02,knowledge:.1},
  membership:{home:{knowledge:300,tools:20,electronics:10},local:{knowledge:120,tools:20}},
  fee:{home:{knowledge:.2,parts:.02},local:{food:.5,medicine:.02,knowledge:.2}}
};
CivilCatalog.resources.push('robots');
Object.assign(CivilText.labels,{robots:'通用机器人',expeditionworker:'远域勤务人员',roboticist:'机器人装配工',expeditiondepot:'国家远域勤务站',roboticsworks:'机器人装配车间'});
Object.assign(CivilServiceContent.jobs,{expeditionworker:'远域勤务人员',roboticist:'机器人装配工'});
Object.assign(CivilCatalog.jobs,CivilServiceContent.jobs);
Object.assign(CivilServiceContent.facilities,{
  expeditiondepot:{name:'国家远域勤务站',homeOnly:true,paidWork:true,requires:['national_logistics'],cost:{steel:160,parts:100,electronics:40,precisionparts:40,tools:40},duration:600,max:1,jobs:{expeditionworker:6},hint:'拨料兴建远域车船与电台设施；须从在册居民中抽调六名勤务人员上岗，方能发出一支国家远域行动队。与近郊跑单的原商车分属两套资产。'},
  roboticsworks:{name:'机器人装配车间',homeOnly:true,paidWork:true,requires:['automation'],cost:{steel:100,precisionparts:60,electronics:60,parts:50},duration:600,max:2,jobs:{roboticist:2},hint:'每名装配工每10秒耗6电、1钢、0.5精密件、0.5电子件、0.2化学品，组装出0.05台通用机器人。'}
});
CivilPrecisionContent.recipes.roboticist={facility:'roboticsworks',tech:'automation',power:6,cost:{steel:1,precisionparts:.5,electronics:.5,chemicals:.2},output:{robots:.05}};
Object.assign(CivilText.research,{
  computing:{name:'国家计算与档案系统',requires:['electronics','standards','records'],discover:s=>typeof CivilWorld!=='undefined'&&CivilWorld.available(s),cost:{knowledge:600,electronics:60,precisionparts:30,glass:20},duration:720,done:'各城账册与户籍均转入可交叉核验的机算格式。工坊现可立项研究国家远程运输与机器人自动控制。'},
  national_logistics:{name:'国家远程运输组织',requires:['computing','logistics','steel'],discover:s=>!!s.civilization.tech.computing,cost:{knowledge:500,steel:100,parts:80,electronics:30},duration:720,done:'跨大区补给线与勤务编制定型。可在街区“加工”分类下拨料兴建国家远域勤务站，抽调六名在册居民当值，正式向远方政体派出联络使团。'},
  automation:{name:'机器人自动控制',requires:['computing','machine_tools','electronics'],discover:s=>!!s.civilization.tech.national_logistics,cost:{knowledge:700,precisionparts:60,electronics:80,steel:50},duration:900,done:'伺服驱动、闭环控制与安全锁死规程试制妥当。现可兴建机器人装配车间；但纸面图纸不能替你打仗，发动远域机械化战役仍须调拨实有机器人与随军补给。'},
  orbital_survey:{name:'近地轨道测绘',requires:['computing','national_logistics'],discover:s=>typeof CivilWorld!=='undefined'&&['north','east','west'].every(id=>CivilWorld.members(s).includes(id)),cost:{knowledge:1200,electronics:120,precisionparts:100,steel:100,robots:6},duration:900,done:'三地观测台联手摸清了近地轨道的残骸带与过顶通信窗口。此后新出发的国家远域行动单程耗时缩短20%（已在途的队伍不变）。航天器制造与闭环生命保障仍有待攻克。'}
});
