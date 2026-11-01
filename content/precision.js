/* MPL-2.0 — Precision industry grows from paid steel, machinery and power. */
var CivilPrecisionContent={
  recipes:{
    precisionworker:{facility:'precisionworks',tech:'machine_tools',power:3,cost:{steel:.4,parts:.2,tools:.02},output:{precisionparts:.25}},
    electronicsworker:{facility:'electronicsworks',tech:'electronics',power:4,cost:{precisionparts:.1,glass:.3,chemicals:.2,parts:.1},output:{electronics:.2}}
  },
  facilities:{
    precisionworks:{name:'精密机床车间',requires:['machine_tools'],paidWork:true,cost:{wood:200,steel:80,parts:40,tools:30},duration:420,max:4,jobs:{precisionworker:4},hint:'每名精密工每10秒耗3电、0.4钢、0.2机械零件、0.02工具，制0.25精密零件；断电停产。'},
    electronicsworks:{name:'电子装配间',requires:['electronics'],paidWork:true,cost:{wood:180,steel:40,glass:30,precisionparts:20,parts:20,tools:20},duration:480,max:4,jobs:{electronicsworker:4},hint:'每名电子工每10秒耗4电、0.1精密零件、0.3玻璃、0.2化学品、0.1机械零件，制0.2电子元件；断电停产。'}
  }
};
CivilCatalog.resources.push('precisionparts','electronics');
Object.assign(CivilServiceContent.facilities,CivilPrecisionContent.facilities);
Object.assign(CivilServiceContent.jobs,{precisionworker:'精密工',electronicsworker:'电子工'});
Object.assign(CivilCatalog.jobs,CivilServiceContent.jobs);
CivilMunicipalContent.jobs.push('precisionworker','electronicsworker');
Object.assign(CivilText.labels,{precisionparts:'精密零件',electronics:'电子元件',precisionworker:'精密工',electronicsworker:'电子工',precisionworks:'精密机床车间',electronicsworks:'电子装配间'});
Object.assign(CivilText.research,{
  machine_tools:{name:'精密机床',requires:['mechanics','standards','steel','power'],discover:s=>!!s.civilization.urban?.city&&(s.stores.steel||0)>=20,cost:{knowledge:240,steel:40,parts:30,tools:20},duration:480,done:'量规、刀具与传动试样通过了检验。街区的加工分类可建精密机床车间，完工后在聚落安排精密工；生产需要持续供电。'},
  electronics:{name:'基础电子工艺',requires:['machine_tools','chemistry','power'],discover:s=>(s.stores.precisionparts||0)>=12,cost:{knowledge:300,precisionparts:12,glass:20,chemicals:20},duration:600,done:'绝缘、接点与控制电路已有可重复的工序。街区或市政的加工分类可建电子装配间；元件仍须实际工人、材料和电力制成。'}
});
