/* MPL-2.0 — National-scale city networks, distinct from the original origin settlements. */
var CivilWorldContent={
  regions:{
    north:{name:'北陆炉城联盟',cities:6,population:26000,trust:30,duration:300,issue:'燃料与冬季通行。六座炉城要求公共救援与地方预算保障。'},
    east:{name:'东陆水系共同体',cities:8,population:42000,trust:40,duration:360,issue:'洪泛治理与变异人共同资格。八座水系城市要求医疗和公民保障。'},
    west:{name:'西陆城邦联合',cities:7,population:31000,trust:20,duration:420,issue:'工业标准与城邦自治。七座城市要求保留地方仓库和公开议约。'}
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
  expeditiondepot:{name:'国家远域勤务站',homeOnly:true,paidWork:true,requires:['national_logistics'],cost:{steel:160,parts:100,electronics:40,precisionparts:40,tools:40},duration:600,max:1,jobs:{expeditionworker:6},hint:'实付建设远域运输与联络设备；六名现有居民安排勤务后才能执行一项国家行动。与原商车分属不同资产。'},
  roboticsworks:{name:'机器人装配车间',homeOnly:true,paidWork:true,requires:['automation'],cost:{steel:100,precisionparts:60,electronics:60,parts:50},duration:600,max:2,jobs:{roboticist:2},hint:'每名装配工每10秒耗6电、1钢、0.5精密件、0.5电子件、0.2化学品，装配0.05台通用机器人。'}
});
CivilPrecisionContent.recipes.roboticist={facility:'roboticsworks',tech:'automation',power:6,cost:{steel:1,precisionparts:.5,electronics:.5,chemicals:.2},output:{robots:.05}};
Object.assign(CivilText.research,{
  computing:{name:'国家计算与档案系统',requires:['electronics','standards','records'],discover:s=>typeof CivilWorld!=='undefined'&&CivilWorld.available(s),cost:{knowledge:600,electronics:60,precisionparts:30,glass:20},duration:720,done:'城市记录采用可核对的计算格式。可以研究远域勤务和机器人自动控制。'},
  national_logistics:{name:'国家远程运输组织',requires:['computing','logistics','steel'],discover:s=>!!s.civilization.tech.computing,cost:{knowledge:500,steel:100,parts:80,electronics:30},duration:720,done:'远域运输图与勤务定额已经确定。街区加工分类可实付建设国家远域勤务站，安排六名原有居民，开展国家间联络。'},
  automation:{name:'机器人自动控制',requires:['computing','machine_tools','electronics'],discover:s=>!!s.civilization.tech.national_logistics,cost:{knowledge:700,precisionparts:60,electronics:80,steel:50},duration:900,done:'机器人的驱动、控制和安全工序通过试制。可以建设装配车间；远域机械化战役仍需实际机器人与补给，不能凭科技免费出兵。'},
  orbital_survey:{name:'近地轨道测绘',requires:['computing','national_logistics'],discover:s=>typeof CivilWorld!=='undefined'&&CivilWorld.members(s).length>=3,cost:{knowledge:1200,electronics:120,precisionparts:100,steel:100,robots:6},duration:900,done:'三地联合观测站完成了近地残骸与通信窗口测绘。此后出发的国家行动单程减少20%；已有行程不改变。航天制造与生命保障仍待完成。'}
});
