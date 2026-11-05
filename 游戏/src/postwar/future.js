/* MPL-2.0 — Advanced society inside the existing public ledger. Explicit opt-in only.
 * Public goods leave that warehouse, travel, then enter this one. No imported progress.
 */
var CivilFuture={
 account:'future_common',data(s){return s.civilization.polity?.future;},copy(x){return JSON.parse(JSON.stringify(x));},
 available(s){return !!s.civilization.polity?.foundedAt;},
 initial(at){return {schema:1,at,year:Math.floor(at/600),cohorts:[],nextIdentity:1,terminated:[],migrated:0,born:0,dead:0,created:0,birthCredit:0,converted:{},stock:{},book:{received:{},consumed:{},produced:{},sent:{}},assets:{housing:1},tech:{},research:null,project:null,adoption:null,proposal:null,cargo:[],shipments:0,enabled:true,budget:1600,method:'balanced',power:'auto',monitor:true,audit:true,robots:0,laws:{care:'treatment',ownership:'personal',citizenship:'residence',work:'mixed'},condition:100,health:100,soil:50,geneSafety:100,machineWear:0,auditRisk:0,quarantined:false,charge:0,energy:{generated:0,used:0,spill:0},last:null,rounds:0,stable:0,qualified:{bio:0,mechanical:0,synthetic:0,ecological:0},recovered:{bio:0,mechanical:0,synthetic:0,ecological:0},hadFailure:{},history:[],lawsHistory:[],echo:null,exports:0,exportPolicy:'reserve',income:{earnedFood:0,consumedFood:0},trained:0};},
 count(f){return CivilFuturePeople.count(f);},
 costText(cost){return Object.entries(cost).filter(([,v])=>v>.0001).map(([k,v])=>(CivilFutureContent.labels[k]||CivilText.labels[k]||k)+' '+Math.round(v*100)/100).join('、')||'无';},
 pay(f,cost){if(!CivilRegions.canPay(f.stock,cost))return false;CivilServices.pay(f.stock,cost);CivilCity.sum(f.book.consumed,cost);return true;},
 mustPay(f,cost){if(!this.pay(f,cost))throw Error('共同体仓不足：'+this.costText(cost));},
 make(f,goods){CivilCity.sum(f.stock,goods);CivilCity.sum(f.book.produced,goods);},
 note(f,at,kind,text){f.history.push({at,kind,text});},
 reason(s,op,args={}){return CivilPolity.reason(s,'future',{op,...args});},
 act(s,op,args={}){return CivilPolity.act(s,'future',{op,...args});},
 publicTransfer(d,f,goods){if(!CivilRegions.canPay(d.world.nodes.north.stores,goods))throw Error('公共仓须先备齐：'+this.costText(goods));CivilServices.pay(d.world.nodes.north.stores,goods);CivilCity.sum(d.public.sent,goods);CivilCity.sum(f.stock,goods);CivilCity.sum(f.book.received,goods);},
 initialSupplies:{food:720,medicine:60,wood:100,tools:30,iron:100,knowledge:180,parts:60,electronics:20},
 startCost:{wood:360,tools:60,parts:20,knowledge:120},
 bodyCost(body,n){return body==='gene'?{culture:n*1.5,medicine:n*.5,knowledge:n*.25}:body==='prosthetic'?{parts:n*1.5,electronics:n*.25,medicine:n*.25}:body==='mechanical'?{body:n,medicine:n*.5,knowledge:n*.5,cell:n*.2}:{body:n,electronics:n*.5,knowledge:n*2,cell:n*.5};},
 canUse(f,cfg){return cfg.any?cfg.any.some(k=>f.tech[k]):(cfg.requires||[]).every(k=>f.tech[k]);},
 facilityLimit(f,id){return id==='clinic'&&f.careMandate?.version===2?4:CivilFutureContent.facilities[id]?.limit;},
 action(d,e,effects){const a=e.args,at=e.at,fail=x=>{throw Error(x);};let f=d.future;if(!d.foundedAt)fail('先确认共同国约');
  if(a.op==='start'){
   if(f)fail('先进共同体已存在');if(!d.lastService?.paid||d.stable<600)fail('先恢复连续公共履约');const rows=e.volunteers;if(!rows||rows.reduce((n,c)=>n+c.count,0)!==240||e.sources.north.idle<240)fail('北岸须有240位可迁居的成年志愿者');
   CivilPolity.spend(d,this.startCost);f=d.future=this.initial(at);this.publicTransfer(d,f,this.initialSupplies);CivilFuturePeople.add(f,rows);f.migrated=240;effects.north.moved=this.copy(rows);this.note(f,at,'foundation','240位北岸居民自愿迁入共同体。姓名、原身份与已有权利连续保留；这不是新增人口。');return '共同体以实际居民和公共材料设立。科技页已开放共同生活工作台。';
  }
  if(!f)fail('先实付建立先进共同体');
  if(a.op==='research'){
   const cfg=CivilFutureContent.tech[a.id];if(!cfg||!this.canUse(f,cfg)||f.tech[a.id])fail('尚无前置能力，或已掌握');if(f.research)fail('先完成当前研究；同一研究班组不能同时占用');if(!f.assets.laboratory)fail('先建设临床与研究楼');this.mustPay(f,cfg.cost);f.research={id:a.id,at,remaining:cfg.time,paid:this.copy(cfg.cost)};return cfg.name+'已立项；实际研究员与电力决定进度。';
  }
  if(a.op==='build'){
   const cfg=CivilFutureContent.facilities[a.id];if(!cfg||!this.canUse(f,cfg)||(f.assets[a.id]||0)>=this.facilityLimit(f,a.id))fail('设施尚未开放或已达承载上限');if(f.project)fail('建设班组仍在施工');this.mustPay(f,cfg.cost);f.project={id:a.id,at,remaining:cfg.time,paid:this.copy(cfg.cost)};return cfg.name+'实付施工，12名居民离开其他生产岗位。';
  }
  if(a.op==='migrate'){
   const n=240;if(f.assets.housing*240-CivilFuturePeople.total(f)<n)fail('先预留240床');if(!f.last?.fed||!f.last?.treated||f.condition<90)fail('先恢复真实供养与维护');if(!e.volunteers||e.volunteers.reduce((n,c)=>n+c.count,0)!==240||e.sources.north.idle<240)fail('来源自愿居民不足');this.mustPay(f,{food:240,medicine:24,tools:12});CivilFuturePeople.add(f,e.volunteers);f.migrated+=n;effects.north.moved=this.copy(e.volunteers);this.note(f,at,'migration','240位北岸居民携带原有身份迁入，来源相应减员。');return '240位居民迁入已建住房；未增加世界总人口。';
  }
  if(a.op==='adopt'){
   const id=a.body,n=a.count,need={gene:'genetics',prosthetic:'interface',mechanical:'continuity',synthetic:'autonomy'}[id];if(!need||!f.tech[need]||![12,24,48].includes(n))fail('尚无此能力或批次无效');if(f.adoption)fail('临床与人格登记班组仍有队列');if(!f.assets.clinic||id!=='gene'&&!f.assets.repair)fail('先建随访站，义体和载体还须维修所');if(!f.last?.fed||!f.last?.treated||!f.last?.powered||f.condition<90)fail('先恢复供养、医疗、电力与维护');if(id==='gene'&&(f.geneSafety<80||!f.monitor))fail('先恢复随访与基因安全');if(['mechanical','synthetic'].includes(id)&&(!f.tech.repairnet||f.laws.ownership!=='personal'))fail('先建立维修网络与本人身体所有权');if(id==='synthetic'&&(!f.audit||f.quarantined||f.assets.housing*240-CivilFuturePeople.total(f)<n))fail('人格登记需要审计、空床和正常服务');
   const participants=id==='synthetic'?[]:CivilFuturePeople.plan(f,id,n);this.mustPay(f,this.bodyCost(id,n));f.adoption={body:id,count:n,at,remaining:240,consent:true,participants};this.note(f,at,'consent',id==='synthetic'?'批准实际制造与训练'+n+'个新人格；完成前空载体不是居民。':n+'位成年居民逐一同意'+CivilFutureContent.bodies[id]+'，保留身份与既有责任。');return '费用已付，临床/训练队列开始；完成后按同一身份或新人格分别入账。';
  }
  if(a.op==='law'){
   const cfg=CivilFutureContent.laws[a.key];if(!cfg||!Object.hasOwn(cfg.values,a.value)||f.laws[a.key]===a.value)fail('选择不同的有效制度');if(f.proposal)fail('先完成现有议案');if(a.key==='citizenship'&&!f.tech.autonomy||a.key==='care'&&!f.tech.genetics||a.key==='ownership'&&!f.tech.interface)fail('相关社会问题尚未出现');this.mustPay(f,{knowledge:60,food:30});f.proposal={at,key:a.key,value:a.value,remaining:300};return '议案开始公开审议；实际供养、身体安全和各岗位利益决定能否通过。';
  }
  if(a.op==='policy'){
   if(a.reserveVersion!==undefined&&(a.key!=='budget'||a.reserveVersion!==2))fail('未知供料规格');
   const allowed={enabled:[true,false],monitor:[true,false],audit:[true,false],budget:[800,1600,3200],method:['balanced','clinical','mechanical','energy','ecological'],power:['auto','off','renewable'],exportPolicy:['reserve','contribute']};if(!allowed[a.key]?.includes(a.value)||f[a.key]===a.value)fail('委托没有变化');if(a.key==='method'&&a.value==='ecological'&&!f.tech.ecology||a.key==='power'&&a.value==='renewable'&&!f.assets.solar)fail('先建立对应生产能力');this.mustPay(f,{knowledge:4});f[a.key]=a.value;if(a.key==='budget'&&a.reserveVersion===2)f.supplyVersion=2;this.note(f,at,'mandate','调整'+({enabled:'公共供料',monitor:'临床随访',audit:'人格审计',budget:'运输额度',method:'生产取舍',power:'能源调度',exportPolicy:'公共余料'}[a.key])+'；既有居民与费用保留。');return '委托已调整；在途继续履约，不自动批准身体转换或权利变化。';
  }
  if(a.op==='robots'){
   if(!f.tech.automation||f.robots>=16)fail('先掌握自动化，或设备已达16台');this.mustPay(f,{parts:12,electronics:8});f.robots+=4;return '4台受限设备投入生产，未创建人格，不计人口。';
  }
  if(a.op==='commission'){
   if(a.version!==undefined&&a.version!==2)fail('未知临床委托规格');
   if(a.version===2){if(f.careMandate?.version!==1)fail('先完成基础临床委托，或已完成扩容交接');this.mustPay(f,{parts:24,knowledge:60,tools:12});f.careMandate.version=2;f.careMandate.expandedAt=at;this.note(f,at,'mandate','临床机构实付完成扩容交接：最多四座随访站另行施工，新增工位仍须居民承担；承担外供时配制超过生活储备的余药。');return '临床扩容与余药配制已交接；设施、医护、培养物和运费仍逐项实付。';}
   if(!f.assets.clinic||!f.tech.clinical)fail('先完成临床研究并建随访站');if(f.careMandate)fail('临床生产与保底供料已委托');this.mustPay(f,{parts:12,knowledge:40,food:40});f.careMandate={at,version:1,rounds:0,produced:0};this.note(f,at,'mandate','临床班组实付接管药物培养与配制；运输先补四期生活保留量，再发余料。');return '临床生产与保底供料正式接管：使用实际医护岗位、培养物、粮食、工具和电力，不免除成本。';
  }
  if(a.op==='workforce'){
   if(!f.assets.hall||!f.assets.workshop)fail('先建成共同议事厅与制造间');if(f.laborMandate)fail('混合用工已进入公共委托');this.mustPay(f,{knowledge:48,food:24,tools:8});f.laborMandate={at,version:1,remaining:180};this.note(f,at,'mandate','实际教师与班组开始身体适配：医疗采纳者离岗，改造、机械和合成居民按能力进入共同岗位。普通居民的工作与权利保留。');return '混合用工实付交接：180秒实际教育与班组调整，不增加人口或工位。';
  }
  if(a.op==='repair'){
   if(!f.assets.repair)fail('先建设身体维修所');if(!f.last?.powered){if(e.sources.north.idle<4)fail('北岸须有4位实到抢修人员');CivilPolity.spend(d,{wood:40,parts:12,tools:4,food:24});effects.north.futureStaff=4;const stored=Math.min(120,400+(f.assets.solar||0)*400+(f.tech.repairnet?800:0)-f.charge);f.charge+=stored;f.energy.generated+=stored;}if(!f.machineWear&&!f.quarantined&&!f.auditRisk)fail('目前没有待修身体或隔离系统');this.mustPay(f,{parts:24,electronics:8,knowledge:16});f.machineWear=Math.max(0,f.machineWear-60);f.auditRisk=0;f.quarantined=false;this.note(f,at,'repair','维修员完成线路核验；原身份恢复活动，未重建第二个主体。');return '身体修复、隔离复核完成；下一期按实际电力恢复工作。';
  }
  if(a.op==='treat'){
   if(!f.assets.clinic||!f.monitor||!f.last?.powered)fail('先恢复临床随访、电力和医疗站');if(f.geneSafety===100&&f.health===100)fail('目前无需额外治疗');this.mustPay(f,{medicine:48,culture:24});f.geneSafety=Math.min(100,f.geneSafety+50);f.health=Math.min(100,f.health+30);this.note(f,at,'treatment','临床团队补足随访与治疗，既有改造不撤销，也不新增居民。');return '并发症治疗已实付，恢复效果进入下期生活与岗位。';
  }
  if(a.op==='echo')return CivilFutureEcho.action(d,e);
  fail('未知先进社会行动');
 },
 reserveNeeds(f){const n=CivilFuturePeople.counts(f),assets=Object.values(f.assets).reduce((a,b)=>a+b,0);return {food:n.bio*.72*8,medicine:n.bio*.06*8,tools:(n.total*.002+assets*.2+(f.assets.garden||0)*.32+(f.assets.clinic||0)+(f.assets.workshop||0)*2+(f.tech.ecology?2:0)+.25)*8,parts:(assets*.15+n.machine*.02+f.robots*.03)*8+24};},
 targets(f){const n=CivilFuturePeople.counts(f),out={food:Math.max(720,n.bio*.72*12),medicine:Math.max(120,n.bio*.06*12),wood:240,tools:120,iron:300,knowledge:360,parts:120,electronics:64,steel:80,culture:Math.max(80,n.gene*.2*10),body:64,cell:Math.max(100,n.machine*.1*10)};if(f.supplyVersion===2){const reserve=this.reserveNeeds(f);out.tools=Math.max(out.tools,Math.ceil(reserve.tools*1.5));out.parts=Math.max(out.parts,Math.ceil(reserve.parts*1.5));}return out;},
 transport(d,f,at,workers){
  for(const p of f.cargo){if(p.arrivedAt===null&&at>=p.at+120){const target=p.direction==='in'?f.stock:d.world.nodes.north.stores;CivilCity.sum(target,p.goods);CivilCity.sum(p.direction==='in'?f.book.received:d.public.received,p.goods);p.arrivedAt=at;}if(p.returnedAt===null&&at>=p.at+240)p.returnedAt=at;}
  if(workers<4||f.cargo.some(p=>p.returnedAt===null))return;
  const fee={food:8,tools:1},targets=this.targets(f);let goods={},left=f.budget;
  const people=CivilFuturePeople.counts(f),urgent=f.supplyVersion===2?Object.entries(this.reserveNeeds(f)).some(([k,v])=>(f.stock[k]||0)<v):f.careMandate&&((f.stock.food||0)<people.bio*.72*4||(f.stock.medicine||0)<people.bio*.06*4||(f.stock.tools||0)<16||(f.stock.parts||0)<16);
  if(f.exportPolicy==='contribute'&&!urgent)for(const k of ['food','medicine','parts','electronics','steel']){const n=Math.floor(Math.max(0,(f.stock[k]||0)-targets[k]*1.15));const take=Math.min(left,n);if(take){goods[k]=take;left-=take;}}
  if(Object.keys(goods).length&&this.pay(f,fee)){CivilServices.pay(f.stock,goods);CivilCity.sum(f.book.sent,goods);f.cargo.push({id:++f.shipments,at,direction:'out',goods,fee,arrivedAt:null,returnedAt:null});f.exports++;return;}
  if(!f.enabled)return;goods={};left=f.budget;const source=d.world.nodes.north.stores;
  for(const k of ['food','medicine','wood','tools','iron','parts','knowledge','electronics','steel']){const protectedStock={food:300,tools:24,knowledge:120,parts:16},available=Math.max(0,(source[k]||0)-(protectedStock[k]||0)-(fee[k]||0)),take=Math.min(left,Math.floor(available),Math.ceil(Math.max(0,(targets[k]||0)-(f.stock[k]||0))));if(take){goods[k]=take;left-=take;}}
  if(!Object.keys(goods).length||!CivilRegions.canPay(source,CivilConurbation.plus(goods,fee)))return;CivilPolity.spend(d,fee);CivilServices.pay(source,goods);CivilCity.sum(d.public.sent,goods);f.cargo.push({id:++f.shipments,at,direction:'in',goods,fee,arrivedAt:null,returnedAt:null});
 },
 // Every power unit is generated once, used once, stored within capacity, or explicitly spilled.
 generation(f,at,workers){let generated=0;const cap=400+(f.assets.solar||0)*400+(f.tech.repairnet?800:0),n=CivilFuturePeople.counts(f),target=Math.min(cap,n.bio*.08+n.machine*.6+100+(f.assets.workshop||0)*60+cap*.25),sources={renewable:0,thermal:0,fusion:0};if(f.power!=='off'&&workers>=4){
   if(f.assets.solar&&this.pay(f,{parts:.15*f.assets.solar,tools:.2*f.assets.solar})){sources.renewable=f.assets.solar*[100,180,140][Math.floor(at/600)%3];generated+=sources.renewable;}
   if(f.power==='auto'&&f.charge+generated<target&&this.pay(f,{wood:10,tools:.2})){generated+=120;sources.thermal=120;}
   if(f.power==='auto'&&f.assets.reactor&&workers>=12&&f.charge+generated<target&&this.pay(f,{cell:2,parts:2,tools:.5})){generated+=900;sources.fusion=900;}
  }
  const total=f.charge+generated;f.energy.generated+=generated;return {generated,available:total,cap,heat:Math.min(1200,240+(f.assets.solar||0)*160+(f.assets.reactor?600:0)),used:0,sources};
 },
 usePower(power,amount){if(power.available-power.used+1e-8<amount||power.used+amount>power.heat)return false;power.used+=amount;return true;},
 period(d,e){const f=d.future;if(!f)return;const at=e.at;f.rounds++;const old={born:f.born,dead:f.dead,created:f.created};
  let awayDead=0;if(Math.floor(at/600)>f.year){awayDead=CivilFuturePeople.annual(f).awayDead||0;f.year=Math.floor(at/600);}
  const n=CivilFuturePeople.counts(f),foodAtStart=CivilPopulation.foodPopulation(f.cohorts.filter(c=>CivilFuturePeople.isBio(c)))*.72,workers={},assignments={},pool={organic:0,prosthetic:0,gene:0,mechanical:0,synthetic:0};for(const c of f.cohorts)if(CivilFuturePeople.isBio(c)&&c.age>=18&&c.age<65&&(c.body!=='gene'||f.geneSafety>=60))pool[c.body]+=c.count;
  const bioWorkers=Object.values(pool).reduce((a,b)=>a+b,0);let left=bioWorkers;
  let patients=0;if(f.laborMandate&&f.adoption?.body!=='synthetic')for(const c of f.adoption?.participants||[]){const take=Math.min(pool[c.body]||0,c.count);pool[c.body]-=take;patients+=take;}const delegated=f.laborMandate?.remaining===0;
  const allocate=(key,count,preferred=[])=>{let need=Math.max(0,Math.ceil(count)),got=0;const assigned={};for(const body of [...new Set([...preferred,...Object.keys(pool)])]){const n=Math.min(pool[body],need);if(n){pool[body]-=n;need-=n;got+=n;assigned[body]=n;}}workers[key]=got;assignments[key]=assigned;left=Object.values(pool).reduce((a,b)=>a+b,0);return got;};
  if(!Object.values(pool).reduce((a,b)=>a+b,0)&&f.charge>=12&&f.machineWear<60){pool.mechanical=n.mechanical;pool.synthetic=f.quarantined?0:n.synthetic;}const electric=allocate('energy',f.assets.reactor?12:4),power=this.generation(f,at,electric),life=n.bio*.08+n.machine*.6+8;
  const powered=this.usePower(power,life),machineActive=powered&&f.machineWear<60,syntheticActive=machineActive&&!f.quarantined;
  pool.mechanical=machineActive?n.mechanical-(assignments.energy.mechanical||0):0;pool.synthetic=syntheticActive?n.synthetic-(assignments.energy.synthetic||0):0;left=Object.values(pool).reduce((a,b)=>a+b,0);
  const drivers=allocate('courier',4);this.transport(d,f,at,drivers);
  const carers=allocate('care',Math.ceil(n.total/40)+(f.assets.clinic||0)*8),maintainers=allocate('maintenance',Math.ceil(n.total/60)+(f.assets.repair||0)*8,delegated?['mechanical','synthetic']:[]),clerks=allocate('clerk',f.assets.hall?6:2,delegated&&f.laws.citizenship==='equal'?['synthetic','mechanical']:[]),teachers=allocate('teacher',Math.ceil(n.children/20)+4);
  if(f.laborMandate?.remaining>0&&teachers>=4&&powered&&this.pay(f,{knowledge:2})){f.laborMandate.remaining=Math.max(0,f.laborMandate.remaining-60);if(!f.laborMandate.remaining)this.note(f,at,'workforce','混合班组完成交接。身体适配进入真实岗位，临床采纳者离岗期间由剩余劳力承担生产。');}
  const neededUpkeep={tools:n.total*.002+Object.values(f.assets).reduce((a,b)=>a+b,0)*.2,parts:Object.values(f.assets).reduce((a,b)=>a+b,0)*.15+n.machine*.02};
  const maintained=maintainers>=Math.ceil(n.total/60)&&powered&&this.pay(f,neededUpkeep);f.condition=Math.max(20,Math.min(100,f.condition+(maintained?4:-4)));
  f.machineWear=Math.max(0,Math.min(100,f.machineWear+(n.machine?(maintained?-3:8):0)));if(n.machine&&(!machineActive||f.machineWear>=60))f.hadFailure.mechanical=true;if(n.synthetic&&!syntheticActive)f.hadFailure.synthetic=true;
  const monitoring=f.monitor&&powered&&carers>=Math.ceil(n.total/40)&&this.pay(f,{medicine:n.gene*.03*(f.laws.care==='enhancement'?1.5:1),culture:n.gene*.02*(f.laws.care==='enhancement'?1.5:1)});f.geneSafety=Math.max(0,Math.min(100,f.geneSafety+(n.gene?(monitoring?2:-8):0)));if(n.gene&&f.geneSafety<60)f.hadFailure.bio=true;
  const audited=f.audit&&powered&&this.pay(f,{knowledge:n.synthetic*.015,electronics:n.synthetic*.005});f.auditRisk=Math.max(0,Math.min(100,f.auditRisk+(n.synthetic?(audited?-4:10):0)));if(f.auditRisk>=60){if(!f.quarantined)this.note(f,at,'isolation','自治系统出现无法归责的指令，合成人启动可申诉的隔离；居民身份与财产仍在。');f.quarantined=true;f.hadFailure.synthetic=true;}
  if(d.earth)CivilEarth.reserve(d,f,allocate,power,at);
  const construction=f.project&&powered?allocate('construction',12):0;if(f.project&&construction===12&&this.usePower(power,12)){f.project.remaining-=60;if(f.project.remaining<=0){const id=f.project.id;f.assets[id]=(f.assets[id]||0)+1;this.note(f,at,'building',CivilFutureContent.facilities[id].name+'建成，材料和工时已经消耗。');f.project=null;}}
  const research=f.research&&powered?allocate('research',12):0;if(f.research&&research===12&&this.usePower(power,18)&&this.pay(f,{knowledge:2,medicine:1})){f.research.remaining-=60;if(f.research.remaining<=0){const id=f.research.id;f.tech[id]=at;this.note(f,at,'technology',CivilFutureContent.tech[id].name+'完成。'+CivilFutureContent.tech[id].life);f.research=null;}}
  const train=f.adoption&&powered?allocate('adoption',8):0;if(f.adoption&&train===8&&this.usePower(power,16)&&carers>=8){f.adoption.remaining-=60;if(f.adoption.remaining<=0){const a=f.adoption;if(a.body==='synthetic'){if(f.assets.housing*240-CivilFuturePeople.total(f)>=a.count){CivilFuturePeople.add(f,[{count:a.count,age:0,identity:'synthetic'}],'created','synthetic');f.created+=a.count;}else{f.adoption.remaining=60;}}
    else CivilFuturePeople.convert(f,a.body,a.count,a.participants);
    if(f.adoption.remaining<=0){this.note(f,at,'adoption',a.count+'位'+CivilFutureContent.bodies[a.body]+(a.body==='synthetic'?'完成独立人格登记，新增主体已入账。':'完成自愿采纳，原身份与财产责任连续保留。'));f.adoption=null;}}
  }
  if(f.echo)CivilFutureEcho.period(f,at,allocate,power);
  // Qualified human institutions remain available on every route, including no augmentation.
  const gardens=allocate('gardener',(f.assets.garden||0)*(f.laws.work==='industrial'?8:16),['gene']),boost=f.tech.restoration?2.2:1.8,adapted=f.tech.adaptation&&f.geneSafety>=80?(assignments.gardener.gene||0):0;
  if(gardens&&powered&&this.usePower(power,gardens*.2)&&this.pay(f,{tools:gardens*.02})){const units=gardens*(f.soil>=60?boost:1)*6+adapted*(f.laws.care==='enhancement'?3:2);this.make(f,{food:units});}
  const restore=f.tech.ecology&&maintained&&gardens>=8&&this.pay(f,{tools:2,medicine:1});f.soil=Math.max(0,Math.min(100,f.soil+(restore?(f.tech.adaptation&&n.gene?6:4):-2)));if(f.tech.restoration&&f.soil<40)f.hadFailure.ecological=true;
  const manufacturing=allocate('manufacturing',(f.assets.workshop||0)*(f.laws.work==='industrial'?24:f.laws.work==='ecological'?12:16),delegated?['prosthetic','synthetic','mechanical']:['prosthetic']),robotLabor=powered&&f.robots&&this.usePower(power,f.robots*2)&&this.pay(f,{parts:f.robots*.03})?f.robots*2:0;let batches=Math.floor((manufacturing+(assignments.manufacturing.prosthetic||0)*.25+robotLabor)/8),targets=this.targets(f);
  const orders={balanced:['parts','electronics','steel','culture','body','cell'],clinical:['culture','parts','electronics','steel','body','cell'],mechanical:['body','parts','steel','electronics','cell','culture'],energy:['cell','parts','electronics','steel','body','culture'],ecological:['culture','parts','electronics','steel','cell','body']};let produced=[];
  for(let pass=0;pass<4&&batches;pass++)for(const id of orders[f.method]){const r=CivilFutureContent.recipes[id];if(!batches||r.requires&&!f.tech[r.requires]||(f.stock[id]||0)>=(targets[id]||80)*(f.exportPolicy==='contribute'&&['parts','electronics','steel'].includes(id)?1.5:1)||!CivilRegions.canPay(f.stock,r.input)||!this.usePower(power,r.power))continue;this.pay(f,r.input);this.make(f,r.output);batches--;produced.push(id);}
  const current=CivilFuturePeople.counts(f),fieldBio=Object.entries(assignments.earthField||{}).filter(([k])=>!['mechanical','synthetic'].includes(k)).reduce((v,[,n])=>v+n,0),food=foodAtStart-fieldBio*.72,meal={food},med={medicine:n.bio*.06};
  if(f.careMandate&&powered){const medicineTarget=targets.medicine*(f.careMandate.version===2&&f.exportPolicy==='contribute'?1.5:1);let batches=Math.floor(Math.max(0,carers-Math.ceil(n.total/40))/4);while(batches--&&(f.stock.medicine||0)<medicineTarget&&CivilRegions.canPay(f.stock,{culture:2,food:8,tools:.5})&&this.usePower(power,8)){this.pay(f,{culture:2,food:8,tools:.5});this.make(f,{medicine:8});f.careMandate.produced+=8;f.careMandate.rounds++;}}
  const fed=this.pay(f,meal),treated=carers>=Math.ceil(current.total/40)&&this.pay(f,med);if(fed){f.income.earnedFood+=food;f.income.consumedFood+=food;}f.trained+=teachers>=4&&powered?1:0;
  f.health=Math.max(0,Math.min(100,f.health+(fed&&treated&&powered?2:-4)));const healthy=fed&&treated&&powered&&maintained&&f.health>=90;
  f.stable=healthy?f.stable+60:0;
  const used=power.used,remaining=power.available-used;f.charge=Math.min(power.cap,remaining);f.energy.used+=used;f.energy.spill+=Math.max(0,remaining-power.cap);
  f.last={at,fed,treated,powered,maintained,monitoring:!!monitoring,audited:!!audited,machineActive,syntheticActive,workers,assignments,idle:left,produced,energy:{generated:power.generated,used,stored:f.charge,capacity:power.cap,heat:power.heat,sources:power.sources},food,upkeep:maintained?neededUpkeep:{},dormant:(machineActive?0:current.machine)+(machineActive&&!syntheticActive?current.synthetic:0)};
  if(f.laborMandate)f.last.patients=patients;
  if(f.proposal){f.proposal.remaining-=60;if(f.proposal.remaining<=0){const p=f.proposal,reason=this.vote(f,p);const accepted=!reason;if(accepted)f.laws[p.key]=p.value;f.lawsHistory.push({at,key:p.key,value:p.value,accepted,reason});this.note(f,at,'law',CivilFutureContent.laws[p.key].name+(accepted?'通过：'+CivilFutureContent.laws[p.key].values[p.value]:'未通过：'+reason));f.proposal=null;}}
  const qualify={bio:!!(f.tech.adaptation&&current.gene>=24&&f.geneSafety>=80&&f.monitor&&f.assets.hall),mechanical:!!(f.tech.repairnet&&current.mechanical>=24&&f.machineWear<30&&f.laws.ownership==='personal'&&f.assets.hall),synthetic:!!(f.tech.society&&current.synthetic>=24&&!f.quarantined&&f.laws.citizenship==='equal'&&f.assets.hall),ecological:!!(f.tech.restoration&&f.soil>=80&&f.assets.garden&&f.assets.hall)};
  for(const [key,ok]of Object.entries(qualify)){f.qualified[key]=healthy&&ok?f.qualified[key]+1:0;if(healthy&&ok&&f.hadFailure[key]){f.recovered[key]++;delete f.hadFailure[key];}if(f.qualified[key]===10)this.note(f,at,'society',({bio:'适应性生物社会',mechanical:'连续身份机械社会',synthetic:'平等合成人社会',ecological:'普通生态社会'}[key])+'连续十期承担住房、供养、维护和公共责任。');}
  return {born:f.born-old.born,dead:f.dead-old.dead-awayDead,created:f.created-old.created,...(awayDead?{awayDead}:{})};
 },
 vote(f,p){if(!f.last?.fed||!f.last?.treated||f.condition<80)return '生活与公共服务尚未恢复';if(p.key==='ownership'&&p.value==='custody'&&CivilFuturePeople.counts(f).machine)return '既有机械居民拒绝把本人身体重新交给公共代管';if(p.key==='care'&&p.value==='enhancement'&&(f.geneSafety<80||f.stock.medicine<60))return '临床与普通家庭要求先保安全和基本医疗';if(p.key==='citizenship'&&p.value==='residence'&&f.laws.citizenship==='equal')return '共同体拒绝追夺已经取得的公民权';if(p.key==='citizenship'&&p.value==='equal'&&(!f.tech.society||!f.assets.hall||f.quarantined))return '先建立共同议事、人格责任和可申诉审计';if(p.key==='work'&&p.value==='industrial'&&f.health<95)return '公共服务人员要求先恢复居民健康';return null;},
 syncCensus(s,e){const f=this.data(s);if(!f)return;const c=CivilCensus.data(s),moved=e.effects.north.moved?.reduce((n,c)=>n+c.count,0)||0;
  if(moved){if(!Object.hasOwn(c.accounts,this.account)){c.accounts[this.account]=0;c.entries.push({at:e.at,kind:'account',from:null,to:this.account,count:0,reason:'先进共同体居民名册'});}if(!CivilCensus.move(s,'district_north',this.account,moved,'先进共同体自愿迁居'))throw Error('迁居来源不足');}
  const delta=e.effects.futureDelta;if(delta){if(delta.born)CivilCensus.birth(s,this.account,delta.born);if(delta.dead)CivilCensus.death(s,this.account,delta.dead,'先进共同体生物寿终');if(delta.awayDead)CivilCensus.death(s,'future_voyage',delta.awayDead,'航天乘员生物寿终');if(delta.created){c.created=(c.created||0)+delta.created;c.accounts[this.account]+=delta.created;c.entries.push({at:e.at,kind:'create',from:null,to:this.account,count:delta.created,reason:'实付制造训练后新人格登记'});}}
 },
 validateCensus(s){const f=this.data(s);if(!f)return;CivilFuturePeople.validate(f);const c=CivilCensus.data(s);if(c.accounts[this.account]!==this.count(f)||(c.created||0)!==f.created)throw Error('先进主体名册不符');const entries=c.entries.filter(r=>r.to===this.account||r.from===this.account),expected=[{at:f.at,kind:'account',from:null,to:this.account,count:0,reason:'先进共同体居民名册'}];for(const e of s.civilization.polity.records){const moved=e.effects.north.moved?.reduce((n,c)=>n+c.count,0)||0;if(moved)expected.push({at:e.at,kind:'move',from:'district_north',to:this.account,count:moved,reason:'先进共同体自愿迁居'});if(e.effects.futureDelta)for(const [k,kind,reason]of [['born','birth','出生'],['dead','death','先进共同体生物寿终'],['created','create','实付制造训练后新人格登记']])if(e.effects.futureDelta[k])expected.push({at:e.at,kind,from:kind==='death'?this.account:null,to:kind==='death'?null:this.account,count:e.effects.futureDelta[k],reason});if(e.effects.futureTravel)for(const [key,from,to,reason]of [['out',this.account,'future_voyage','航天乘员离地'],['back','future_voyage',this.account,'航天同一乘员返航']]){const count=e.effects.futureTravel[key].reduce((n,c)=>n+c.count,0);if(count)expected.push({at:e.at,kind:'move',from,to,count,reason});}}if(!CivilPolity.same(entries,expected))throw Error('人格与出生死亡流水不符');
  for(const k of new Set([...Object.keys(f.stock),...Object.keys(f.book.received),...Object.keys(f.book.produced)])){const want=(f.book.received[k]||0)+(f.book.produced[k]||0)-(f.book.consumed[k]||0)-(f.book.sent[k]||0);if(!Number.isFinite(f.stock[k])||f.stock[k]<-1e-7||Math.abs(f.stock[k]-want)>1e-6+Math.abs(want)*1e-11)throw Error('先进物资不守恒：'+k);}if(Math.abs(f.energy.generated-f.energy.used-f.energy.spill-f.charge)>1e-5)throw Error('先进电能不守恒');
 }
};
