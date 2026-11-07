/* MPL-2.0 — A6 on the existing public reducer. Discovery never creates population. */
var CivilEarth={
 data(s){return s.civilization.polity?.earth;},copy:x=>JSON.parse(JSON.stringify(x)),
 available(s){return !!s.civilization.polity?.future?.assets.hall;},
 act(s,op,args={}){return CivilPolity.act(s,'earth',{op,...args});},reason(s,op,args={}){return CivilPolity.reason(s,'earth',{op,...args});},
 attach(s,e){if(!this.data(s)&&e.action!=='earth')return;const c=CivilCensus.data(s);e.earthCensus={ref:c.entries.length,accounts:{...c.accounts}};},
 initial(at){return {schema:1,at,regions:{},survey:null,ships:[],nextShip:1,tech:{},research:null,assets:{},build:null,enabled:true,power:true,production:'balanced',work:null,history:[],unity:null,paid:0,missed:0,stable:0,ground:null,flights:[],ending:null};},
 note(g,at,kind,text){g.history.push({at,kind,text});},
 regionOf(key){if(key==='future_voyage'||key==='future_common')return 'north';if(key.startsWith('reserve_')||key.startsWith('macro_')||key.startsWith('polity_')||key.startsWith('earth_'))return key.slice(key.indexOf('_')+1);if(key==='district_east'||key==='city_estuary')return 'east';if(key==='city_ridge')return 'west';return 'north';},
 population(s,id){if(!this.data(s)?.regions[id])return null;return Object.entries(this.regionalAccounts(CivilCensus.data(s).accounts,id)).filter(([key])=>!key.startsWith('reserve_')).reduce((n,[,v])=>n+v,0);},
 regionalAccounts(accounts,id){return Object.fromEntries(Object.entries(accounts).filter(([key])=>this.regionOf(key)===id));},
 local(d,id){return d.earth.regions[id]?.source==='peer'?d.peers[id].local:d.earth.regions[id]?.local;},
 newRegion(at,source,origin=null){return {at,source,origin,local:origin?CivilDomain.initialNode(origin):null,stock:{},book:{received:{},produced:{},consumed:{},sent:{}},project:null,mode:null,enabled:true,acceptedAt:null,stable:0,paid:0,missed:0,annual:[],last:null};},
 canUse(g,cfg){return (cfg.requires||[]).every(k=>g.tech[k]);},
 activeShip(g){return g.ships.filter(p=>p.at!==null&&p.returnedAt===null).length;},
 dispatch(d,id,goods,direction,at){const g=d.earth,r=g.regions[id],fee=CivilEarthContent.fare;
  if(direction==='in'&&this.activeShip(g)>=2)throw Error('两组公用船车仍在往返');
  if(direction==='out'){CivilPolity.spend(d,fee);if(!CivilRegions.canPay(d.world.nodes.north.stores,goods))throw Error('公共仓待备区域组件：'+CivilFuture.shortageText(d.world.nodes.north.stores,goods));CivilServices.pay(d.world.nodes.north.stores,goods);CivilCity.sum(d.public.sent,goods);}
  else {if(!CivilCity.pay(this.local(d,id),fee))throw Error('地方交通维护不足');if(!CivilRegions.canPay(r.stock,goods))throw Error('地方工料尚未备齐');CivilServices.pay(r.stock,goods);CivilCity.sum(r.book.sent,goods);}
  if(Object.values(goods).reduce((a,b)=>a+b,0)>1200)throw Error('超过单船1200件');g.ships.push({id:g.nextShip++,region:id,direction,queuedAt:at,at:this.activeShip(g)<2?at:null,goods:this.copy(goods),fee:this.copy(fee),arrivedAt:null,returnedAt:null});
 },
 action(d,e,effects){const a=e.args,at=e.at,f=d.future,fail=x=>{throw Error(x);};let g=d.earth;
  if(a.op==='start'){
   if(g)fail('全球议约已经设立');if(!f?.assets.hall||!d.lastService?.paid||d.stable<600||!f.last?.maintained||f.health<90)fail('先完成先进共同生活并恢复公共服务');
   if(!d.peers.west||!d.peers.desert)fail('先在国约中实际联络西陆与绿洲');
   CivilPolity.spend(d,CivilEarthContent.startCost);g=d.earth=this.initial(at);for(const id of ['west','desert'])g.regions[id]=this.newRegion(at,'peer');this.note(g,at,'start','西陆与绿洲的现有名册继续使用。全球议约开始联络其他地区，原债务、制度与仓库不合并。');return '全球联系工作台已在科技页开放。尚未接触的居民保持未知。';
  }
  if(!g)fail('先设立全球议约');
  if(a.op==='survey'){
   const cfg=CivilEarthContent.regions[a.region];if(!cfg||g.regions[a.region])fail('地区无效或已经普查');if(cfg.gate&&!g.tech[cfg.gate])fail('先掌握'+CivilEarthContent.tech[cfg.gate].name);if(g.survey)fail('四人联络队仍在途中');if((e.earthCensus?.accounts['reserve_'+a.region]||0)<1)fail('没有尚待细分的地区名册');if((f.last?.idle||0)<4)fail('共同体须留出4位实际联络人员');CivilPolity.spend(d,CivilEarthContent.surveyCost);g.survey={region:a.region,at,remaining:360,returning:false};return '四位联络员携实付装备出发；完成普查前不显示地区人口。';
  }
  if(a.op==='offer'){
   const r=g.regions[a.region],cfg=CivilEarthContent.regions[a.region]?.options[a.mode],n=this.local(d,a.region);if(!r||!cfg)fail('先普查并选择当地方案');if(r.project||r.mode)fail('该区已有共同工程与议约');if(n.health<90||n.condition<90)fail('先让地方供养与维护恢复90');const conflict=this.conflict(d,a.region,at);if(conflict)fail(conflict);if(!CivilPolity.safe(cfg.local,CivilPolity.inspect(n)))fail('当地要保留基础供养与材料');if(!CivilCity.pay(n,cfg.local))fail('地方共同投资尚未备齐');this.dispatch(d,a.region,cfg.cargo,'out',at);r.project={at,mode:a.mode,remaining:360,startedAt:null,completedAt:null,local:this.copy(cfg.local)};this.note(g,at,'proposal',CivilEarthContent.regions[a.region].name+'提出「'+cfg.name+'」；本地共同投资已付，外来组件仍在途中。');return '已提交当地共同责任方案，收到材料并完成实际工程后再连续履约确认。';
  }
  if(a.op==='research'){
   const cfg=CivilEarthContent.tech[a.id];if(!cfg||!this.canUse(g,cfg)||g.tech[a.id])fail('前置未完成或已有能力');if(g.research)fail('全球研究班组仍在工作');CivilFuture.mustPay(f,cfg.cost);g.research={id:a.id,at,remaining:cfg.duration};return cfg.name+'立项；12名实际研究人员、电力和连续耗材决定进度。';
  }
  if(a.op==='build'){
   const cfg=CivilEarthContent.facilities[a.id];if(!cfg||!this.canUse(g,cfg)||g.assets[a.id])fail('前置未完成或已建成');if(g.build)fail('施工班组仍在工作');CivilFuture.mustPay(f,cfg.cost);g.build={id:a.id,at,remaining:cfg.duration};return cfg.name+'实付施工，不能把同一批工人同时安排到研究和生产。';
  }
  if(a.op==='policy'){
   const allowed={enabled:[true,false],power:[true,false],production:['balanced','space','life','fuel']};if(!allowed[a.key]?.includes(a.value)||g[a.key]===a.value)fail('选择不同的有效委托');CivilFuture.mustPay(f,{knowledge:4});g[a.key]=a.value;this.note(g,at,'mandate','调整'+({enabled:'共同责任',power:'航天地面电力',production:'航天生产顺序'}[a.key])+'；已付费用与在途任务保留。');return '委托已调整，不改变居民身份或替你批准新的首航。';
  }
  if(a.op==='regional'){
   const r=g.regions[a.region];if(!r?.mode||typeof a.enabled!=='boolean'||r.enabled===a.enabled)fail('当地尚未议约或授权没有变化');CivilPolity.spend(d,{knowledge:12});r.enabled=a.enabled;return (a.enabled?'恢复':'暂停')+CivilEarthContent.regions[a.region].name+'共同职责；基础供养与已发物资仍继续。';
  }
  if(a.op==='unity'){
   if(g.unity)fail('地球共同法已有记录');const cfg=CivilEarthContent.charters[a.mode];if(!cfg)fail('未知共同法');const why=this.unityReason(d,at);if(why)fail(why);CivilPolity.spend(d,cfg.cost);g.unity={at,mode:a.mode,accounts:Object.keys(e.earthCensus.accounts).sort(),population:Object.values(e.earthCensus.accounts).reduce((a,b)=>a+b,0),nationalLaws:this.copy(d.laws)};this.note(g,at,'unity',cfg.name+'生效。八区名册完成互认，'+g.unity.population+'位现存主体均已覆盖；没有新增居民，地方制度与旧债保留。');return '地球在共同法与对外代表之下统一；各区仍须持续履行真实公共责任。';
  }
  return CivilEarthFlight.action(d,e,effects);
 },
 conflict(d,id,at){if(d.peers[id]&&CivilForeign.fighting(d.world,id))return '当地要求先停火并恢复生产';if(d.world.foreign?.actors[id]&&CivilForeign.overdue(d.world.foreign,id,at))return '当地须先实际处理逾期债务，旧债不能藏入共同法';return null;},
 unityReason(d,at){const g=d.earth;if(!g)return '先设立全球议约';for(const id of Object.keys(CivilEarthContent.regions)){const r=g.regions[id];if(!r)return '先完成'+CivilCensus.regions[id]+'全域联系';if(!r.enabled)return CivilCensus.regions[id]+'共同职责已暂停';if(r.acceptedAt===null||r.stable<300)return CivilCensus.regions[id]+'须完成工程与连续五期公共履约';const why=this.conflict(d,id,at);if(why)return CivilCensus.regions[id]+'：'+why;}if(!g.enabled||g.stable<300||!d.lastService?.paid)return '先恢复连续共同机构办理';if(g.survey)return '等联络队返回核对完整名册；已有运单将按原约继续交付';return null;},
 // Called within the A5 period, using its SAME finite workforce and power pool.
 reserve(d,f,allocate,power,at){const g=d.earth;if(!g)return;const w={at,office:allocate('earthOffice',8),field:g.survey?allocate('earthField',4):0,research:0,builders:0,manufacturing:0,control:0,power:0,produced:[]};
  const use=(key,amount)=>{if(!g.power||!CivilFuture.usePower(power,amount))return false;w.power+=amount;w[key]=true;return true;};
  if(g.assets.control){w.control=allocate('flightControl',4);if(w.control===4)use('controlPower',12);}
  if(g.research){w.research=allocate('earthResearch',12);if(w.research===12)use('researchPower',18);}
  if(g.build){w.builders=allocate('earthBuild',12);if(w.builders===12)use('buildPower',12);}
  const order={balanced:['spaceparts','lifesupport','shielding','propellant'],space:['spaceparts','shielding','lifesupport','propellant'],life:['lifesupport','shielding','spaceparts','propellant'],fuel:['propellant','spaceparts','lifesupport','shielding']}[g.production];
  const eligible=id=>(f.stock[id]||0)<(id==='propellant'?120:64)&&(id!=='lifesupport'||g.tech.closed)&&CivilRegions.canPay(f.stock,CivilConurbation.plus(CivilEarthContent.recipes[id].input,id==='lifesupport'?{culture:16}:{}));
  if(g.assets.works&&order.some(eligible)){w.manufacturing=allocate('aerospace',16);let batches=Math.floor(w.manufacturing/8);for(const id of order){const recipe=CivilEarthContent.recipes[id];if(!batches||!eligible(id)||!use('manufacturePower',recipe.power))continue;CivilFuture.pay(f,recipe.input);CivilFuture.make(f,recipe.output);w.produced.push(id);batches--;}}
  g.work=w;return w;
 },
 period(d,e,effects){const g=d.earth;if(!g)return;const at=e.at,f=d.future,w=g.work||{},power=g.power&&w.power>0;effects.earthDelta={partitions:[],annual:[]};
  for(const ship of g.ships){if(ship.at===null)continue;if(ship.arrivedAt===null&&at>=ship.at+180){if(ship.direction==='out'){const r=g.regions[ship.region];CivilCity.sum(r.stock,ship.goods);CivilCity.sum(r.book.received,ship.goods);}else{CivilCity.sum(d.world.nodes.north.stores,ship.goods);CivilCity.sum(d.public.received,ship.goods);}ship.arrivedAt=at;}if(ship.returnedAt===null&&at>=ship.at+360)ship.returnedAt=at;}
  for(const ship of g.ships)if(ship.at===null&&this.activeShip(g)<2)ship.at=at;
  if(g.survey&&w.field===4){const q=g.survey;q.remaining-=60;if(q.remaining<=0){if(!q.returning){const count=e.earthCensus.accounts['reserve_'+q.region],origin=CivilPolityForeign.origin(at,count);if(!Number.isSafeInteger(count)||count<1)throw Error('全域普查来源不足');g.regions[q.region]=this.newRegion(at,'reserve',origin);effects.earthDelta.partitions.push({id:q.region,count});this.note(g,at,'survey',CivilEarthContent.regions[q.region].name+'确认'+count+'位腹地居民；细分原名册，未向世界增加人口。');q.returning=true;q.remaining=180;}else g.survey=null;}}
  for(const [id,r]of Object.entries(g.regions)){
   const n=this.local(d,id);if(r.source==='reserve'){if(at%600===0&&at>r.at){const annual=CivilDomain.annual(n);r.annual.push({at,...annual});effects.earthDelta.annual.push({id,...annual});}CivilDomain.settle(n,'care',true,0,CivilEarthContent.regions[id].profile);}
   const staff=n.economy.idle>=24;if(staff){n.economy.idle-=24;n.workers.earthInstitution=24;}const conflict=this.conflict(d,id,at);
   const p=r.project,cfg=CivilEarthContent.regions[id].options[p?.mode||r.mode];
   if(p&&p.completedAt===null&&staff&&!conflict){if(p.startedAt===null&&CivilRegions.canPay(r.stock,cfg.cargo)){CivilServices.pay(r.stock,cfg.cargo);CivilCity.sum(r.book.consumed,cfg.cargo);p.startedAt=at;}if(p.startedAt!==null){p.remaining=Math.max(0,p.remaining-60);if(!p.remaining){p.completedAt=at;r.mode=p.mode;this.note(g,at,'project',CivilEarthContent.regions[id].name+'完成'+cfg.name+'，下一步用持续履约确认共同责任。');}}}
   if(!r.mode)continue;
   if(staff&&r.enabled&&!conflict){let batches=2;for(const product of ['parts',cfg.product]){const recipe=CivilEarthContent.products[product];if(!batches||(r.stock[product]||0)>=64||!CivilCity.pay(n,recipe.input))continue;CivilCity.sum(r.stock,recipe.output);CivilCity.sum(r.book.produced,recipe.output);batches--;}}
   const cost={...cfg.upkeep,food:24},ready=staff&&r.enabled&&g.enabled&&!conflict&&n.health>=90&&n.condition>=90,paid=ready&&CivilCity.pay(n,cost);
   if(paid){r.paid++;r.stable=Math.min(600,r.stable+60);}else{r.missed++;r.stable=0;}r.last={at,paid:!!paid,staff:staff?24:0,cost:paid?cost:{},reason:conflict||(!r.enabled||!g.enabled?'共同职责暂停':!staff?'实际地方人员不足':n.health<90||n.condition<90?'先恢复地方供养与维护':paid?null:'当地维护材料不足')};
   if(r.acceptedAt===null&&r.stable>=300){r.acceptedAt=at;this.note(g,at,'accord',CivilEarthContent.regions[id].name+'以实际工程和连续公共服务确认共同责任，保留当地资产、债权及内部制度。');}
  }
  const active=Object.values(g.regions).filter(r=>r.mode).length,fee={food:active*6,tools:active,knowledge:active*4};if(g.unity)CivilCity.sum(fee,CivilEarthContent.charters[g.unity.mode].fee);
  const paid=g.enabled&&w.office===8&&d.lastService?.paid&&CivilRegions.canPay(d.world.nodes.north.stores,fee);if(paid){CivilPolity.spend(d,fee);g.paid++;g.stable=Math.min(600,g.stable+60);}else{g.missed++;g.stable=0;}g.last={at,paid:!!paid,cost:paid?fee:{},reason:!g.enabled?'共同职责暂停':w.office!==8?'共同体缺少八位实有人手':paid?null:'国家公共份额尚未到仓'};
  // Rotate actual local shipments; two ships compete with construction consignments.
  const ids=Object.keys(g.regions),start=Math.floor(at/60)%Math.max(1,ids.length);for(let i=0;i<ids.length&&this.activeShip(g)<2;i++){const id=ids[(start+i)%ids.length],r=g.regions[id];if(r.acceptedAt===null||!r.last?.paid||g.ships.some(s=>s.region===id&&s.returnedAt===null))continue;const goods={};let room=128;for(const key of ['parts','steel','electronics','medicine','tools','wood']){const qty=Math.min(room,Math.floor(Math.max(0,(r.stock[key]||0)-24)));if(qty){goods[key]=qty;room-=qty;}}if(Object.keys(goods).length&&CivilRegions.canPay(this.local(d,id).stores,CivilEarthContent.fare))this.dispatch(d,id,goods,'in',at);}
  if(g.research&&w.research===12&&w.researchPower&&CivilFuture.pay(f,{knowledge:4,parts:1})){g.research.remaining-=60;if(g.research.remaining<=0){g.tech[g.research.id]=at;this.note(g,at,'technology',CivilEarthContent.tech[g.research.id].name+'完成；能力仍需实际设施与工位。');g.research=null;}}
  if(g.build&&w.builders===12&&w.buildPower){g.build.remaining-=60;if(g.build.remaining<=0){g.assets[g.build.id]=at;this.note(g,at,'building',CivilEarthContent.facilities[g.build.id].name+'完成，已消耗实际材料与工时。');g.build=null;}}

  CivilEarthFlight.period(d,e,effects);
 },
 syncCensus(s,e){const g=this.data(s);if(!g)return;const c=CivilCensus.data(s),delta=e.effects.earthDelta;
  for(const p of delta?.partitions||[])if(!CivilCensus.partition(s,p.count,'earth_'+p.id))throw Error('全域普查重复或来源不足');
  for(const p of delta?.annual||[]){CivilCensus.death(s,'earth_'+p.id,p.dead,'全域地区年度死亡');CivilCensus.birth(s,'earth_'+p.id,p.born);}
  const travel=e.effects.futureTravel;if(travel){if(!Object.hasOwn(c.accounts,'future_voyage')){c.accounts.future_voyage=0;c.entries.push({at:e.at,kind:'account',from:null,to:'future_voyage',count:0,reason:'航天乘员在途名册'});}for(const [kind,from,to]of [['out','future_common','future_voyage'],['back','future_voyage','future_common']]){const count=(travel[kind]||[]).reduce((n,x)=>n+x.count,0);if(count&&!CivilCensus.move(s,from,to,count,kind==='out'?'航天乘员离地':'航天同一乘员返航'))throw Error('航天乘员来源不足');}}
 },
 validate(s){const g=this.data(s);if(!g)return;const c=CivilCensus.data(s),d=s.civilization.polity,fail=x=>{throw Error('地球共同账不符：'+x);};
  const counts={...CivilCensus.initial(c.seed).counts};let index=0;
  for(const e of d.records){const snap=e.earthCensus;if(!snap)continue;if(!Number.isSafeInteger(snap.ref)||snap.ref<index||snap.ref>c.entries.length)fail('名册引用');while(index<snap.ref){const x=c.entries[index++];if(x.kind==='account'||x.kind==='partition')counts[x.to]??=0;if(x.from!==null)counts[x.from]-=x.count;if(x.to!==null)counts[x.to]+=x.count;}if(!CivilPolity.same(snap.accounts,counts))fail('普查或统一人口来源');}
  for(const [id,r]of Object.entries(g.regions)){if(r.source==='reserve'){const entries=c.entries.filter(x=>x.kind==='partition'&&x.to==='earth_'+id);if(entries.length!==1||entries[0].at!==r.at||entries[0].count!==r.origin.population||c.accounts['earth_'+id]!==CivilDomain.count(r.local))fail('地区人口');for(const y of r.annual)for(const [kind,n]of [['birth',y.born],['death',y.dead]]){const rows=c.entries.filter(x=>x.at===y.at&&x.kind===kind&&(kind==='birth'?x.to:x.from)==='earth_'+id);if(n?rows.length!==1||rows[0].count!==n:rows.length)fail('地区出生死亡');}const n=r.local;for(const key of Object.keys(n.stores)){const b=n.budget,expected=(r.origin.stores[key]||0)+(b.produced[key]||0)+(b.received[key]||0)-(b.consumed[key]||0)-(b.sent[key]||0);if(Math.abs(n.stores[key]-expected)>1e-4+((b.produced[key]||0)+(b.consumed[key]||0))*1e-12)fail('地方材料');}}
   for(const key of Object.keys(r.stock)){const b=r.book,want=(b.received[key]||0)+(b.produced[key]||0)-(b.consumed[key]||0)-(b.sent[key]||0);if(!Number.isFinite(r.stock[key])||r.stock[key]<0||Math.abs(r.stock[key]-want)>1e-6)fail('区域项目材料');}
  }
  CivilEarthFlight.validate(s);
 }
};
