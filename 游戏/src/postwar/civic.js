/* MPL-2.0 — One public agenda over existing rule owners, not a second law simulator. */
var CivilCivic={
 groups:{producers:'生产与工艺',care:'照护与保障',local:'地方自治',knowledge:'知识与技术',trade:'经营与通行',homes:'家庭与安居',ecology:'环境与记忆'},
 enabled(s){return CivilGenerations.enabled(s);},data(s){return s.civilization.deliberation;},
 init(s){if(this.enabled(s)&&this.data(s)===undefined)s.civilization.deliberation={schema:1,proposal:null,records:[],seen:{},support:Object.fromEntries(Object.keys(this.groups).map(k=>[k,50])),samples:[],era:0,eraAt:0,pressure:null,pressureHistory:[],lastPressure:-6000};},
 stage(s){const c=s.civilization;return c.polity?.earth?'earth':c.polity?.future?'advanced':c.polity?.foundedAt?'nation':c.cityCouncil?'cluster':Number.isSafeInteger(c.city?.cityAt)?'city':c.village?.town?'town':'early';},
 agenda(s){const c=s.civilization,d=c.polity,f=d?.future,inst=c.city?.institutions,home=inst?Object.keys(inst.wards)[0]:null,defs=[],pace=typeof CivilPacing!=='undefined'&&CivilPacing.enabled(s);
  const add=(id,stage,title,text,owner,key,options,ready)=>defs.push({id,stage,title,text,owner,key,options:options.map(([value,label,groups,consequence])=>({value,label,groups,consequence})),ready:!!ready});
  if(pace)add('opening_work','early','轮到谁记下明天的工作','新来的人不断加入。有人想多留余粮，有人等着修工具；同一双手不能同时去打猎和捡废料。','roster','mode',[
   ['reserves','先留供养余量',['care','homes'],'多派人供养，少派人制器；一名成人轮值协调，每60秒实付木料2、食物1。'],
   ['workshop','先补修造材料',['producers','knowledge'],'少留食物余量，多回收和制器；占用同一名协调员、付相同开支。']
  ],CivilPacing.available(s)&&!CivilPacing.data(s)?.changes.length);
  if(c.pacingVersion===2){
   add('town_work','town','熔炉旁，还是学徒桌前','第一座熔炉能开工了。工匠想备足下一轮工程材料，老师希望把学徒留在课堂；生产和教学争用同一批成人。','roster','mode',[
    ['industry','先备投产材料',['producers','trade'],'受托安排五项工业岗位，先补较大的矿煤铁与零件缓冲；余力再教书。仍付原料与轮值费。'],
    ['learning','先教下一批学徒',['knowledge','care'],'先安排实际教师，工业只补较小的维修缓冲；研究较快，但扩建材料积累较慢。']
   ],CivilPacing.available(s)&&CivilPacing.industrialReady(s)&&!CivilPacing.data(s)?.changes.some(r=>CivilPacing.industrial(s,r.mode)));
   add('town_intake','town','空床之外，还要留下什么','车队带回的新家庭需要工具、药品和课堂。空床已经有了，但同一批工具也在等待公共工程。','intake','enabled',[
    [false,'先缓接纳，补公共服务',['care','knowledge'],'停止新批次出发，保留在途家庭与床位；把工具和药品留给现有居民。以后在迁居页恢复。'],
    [true,'继续有保障地接纳',['homes','trade'],'继续原有接纳检查与实付旅费；现有人口供养仍优先，工程可能等待材料。']
   ],!Number.isSafeInteger(c.city?.cityAt)&&c.urban?.registered&&c.urban.enabled&&s.game.population>=200&&(s.stores.tools||0)<100);
  }
  add('city_food','city','城市化，还是保留粮作','工坊希望集中熟练工，农田与诊疗班组要求留住人手。选择改变首片区实际岗位，不改变居民人数。','institution','profile',[['provisioning','粮作与公共服务',['care','ecology','homes'],'保留农田和医护，减少制器岗位。'],['workshop','集中回收与制器',['producers','trade'],'增加回收制器与物料库存目标，挤占其他可用工位。']],home);
  add('city_care','city','治疗工位的下一步','医护要求临床教具，工艺社希望先留工具。这是持续消耗与产药能力的取舍。','institution','careMethod',[['clinical','临床配药',['care','knowledge'],pace?'用工具与知识换实际临床产药；需按本片区人口备齐受训医护。':'用工具与知识换实际临床产药；需要两名受训医护。'],['basic','维持基础配药',['producers','homes'],'保留教具与工具，维持原配方和产能。']],home);
  add('city_school','city','谁来接替退休的老师','学堂希望按退休预测持续招生，经营者希望把培训支出留在手中。','school','schoolEnabled',[[true,'委托提前补员',['knowledge','care'],'机构按真实缺口招收学员，持续支付教具与口粮。'],[false,'按需手动开班',['producers','trade'],'不自动承担新课程；退休出现空缺时需自己恢复。']],home);
  add('grid_land','city','风、水与燃料的账','风力少用燃料但有低谷，水轮较稳；生物质占用民用木料。','modern','grid',[['hydro','小水电',['care','homes'],'每期10电与工具维护。'],['wind','风力',['ecology','knowledge'],'每期6或12电，低谷可能挤掉工序。'],['biomass','生物质',['producers','trade'],'每期16电，持续耗木1.2与维护工具。']],c.tech.localgrid&&c.modern?.installedAt!==null&&c.modern?.installedAt!==undefined);
  add('cluster_budget','cluster','先接新订单，还是先教新人','各城同意维护必须先付，余下额度仍不足以同时完成全部任务。','budget','all',[['learning','培训优先',['knowledge','care'],'维护后先留课程预算，可能延后发货。'],['delivery','供料优先',['producers','trade'],'维护后先履行运单，培训需等待空余额度。'],['balanced','逐期轮换',['local','homes'],'按现有轮值规则切换机会，不增加公共额度。']],CivilCityBudget.available(s));
  add('cluster_production','cluster','统一工序，还是当地修造','地方工坊要保障常用工具；协作企业需要更多制式产品与跨城铁料。','governance','all',[['repair','循环修造',['local','ecology'],'采用真实废料与木料配方，外供承诺较低。'],['standard','标准加工',['producers','trade'],'用更多铁料与维修投入生产，缺铁自动退回修造。'],['manual','各城自定生产',['local','homes'],'停止机构安排新生产，已签供料照付；各城继续原有工序。']],CivilCityGovernance.available(s));
  add('cluster_homes','cluster','新社区为谁生产','迁居家庭的合作岗位已经存在。把同一批工作时间用于粮作，还是制器？','homes','mode',[['food','粮作合作',['homes','care'],'安居合作岗位产粮，照顾当地供养。'],['tools','制器合作',['producers','trade'],'同一批合作居民使用实际原料制器。']],!!CivilCityHomes.estate(s,'home'));
  add('nation_local','nation','谁承担跨区承诺','共同机构要求便于协调的授权，地方代表要求保留自身决定。两种安排都必须持续付款。','national','devolution',[['local','地方自治',['local','homes'],'地方保留决定权，公共记录负担较高。'],['central','中央统筹',['producers','knowledge'],'统一调度仍受公民资格和地方供养约束。']],d?.foundedAt);
  add('nation_rights','nation','迁居之后，谁仍是公民','地方惯例与共同身份正在碰面。新居民、经营者与公共服务人员的立场并不一致。','national','rights',[['equal','平等公民资格',['care','homes','trade'],'使跨区共同法与自愿加入具备资格基础。'],['custom','保留地方身份惯例',['local','producers'],'保留地方身份条件，其他地区可能拒绝加入或集中授权。']],d?.foundedAt);
  add('nation_work','nation','公共工坊先承担什么','照护人员与制造工人都能说明缺口。公共仓只有真实材料，工位不能重复用。','national','priority',[['care','民生共同责任',['care','homes'],'公共制造工位较少，保留地方余力。'],['industry','公共工业优先',['producers','trade'],'更多实际工位和原料投入公用制造。']],d?.foundedAt);
  add('advanced_body','advanced','辅助身体先服务什么','长期照护者希望先治疗受损身体，工程人员希望开放自愿增强。改造不会替代同意和安全随访。','body','care',[['treatment','治疗优先',['care','homes'],'保留基本临床边界与较低监测负担。'],['enhancement','开放自愿增强',['producers','knowledge'],'提高改造群体修复能力，同时增加随访药物与培养物消耗。']],f?.tech.genetics);
  add('advanced_machine','advanced','合成人能否参与代表','维修所要求明确责任，合成人与同事要求共同政治资格。支持者与反对者不限于一种身体。','body','citizenship',[['equal','平等公民与代表权',['homes','knowledge'],'取得代表资格，真实合成人可承担公共办事岗位；不得事后追夺。'],['residence','先保障居留与财产',['local','producers'],'计入人口与供养，不自动授予代表权；以后可再立法。']],f?.tech.autonomy);
  add('advanced_work','advanced','留给农园，还是制造间','普通居民和改造者都需要日常生活。两条路线都可抵达首航。','body','work',[['ecological','生态与公共供养',['ecology','care'],'更多农园工位，制造间较少；真实材料照付。'],['industrial','先进制造优先',['producers','trade'],'减少农园，扩大制造岗位；健康不足会被公议拒绝。'],['mixed','混合轮换',['homes','knowledge'],'在现有有限工位间折中。']],f?.assets.hall);
  add('earth_public','earth','向外代表一个地球','八区已经相互承担职责。共同对外代表是否由统一联邦法，还是约束各地的共同议约确立？','earth','mode',[['federal','联邦共同法',['knowledge','homes'],'共同公民与对外代表，地方仍保留日常制度和资产。'],['covenant','地球共同议约',['local','trade'],'保留内部政体，以具有约束力的共同法、仲裁与代表统一。']],d?.earth&&!d.earth.unity&&Object.values(d.earth.regions).filter(r=>r.acceptedAt!==null).length===8);
  if(pace){
   const local=home&&CivilCityInstitutions.local(s,home);
   defs.find(a=>a.id==='city_food').ready=!!local&&local.profile==='balanced';
   defs.find(a=>a.id==='city_care').ready=!!local&&local.careMethod!=='clinical'&&CivilCityInstitutions.skillLimit(s,home,'care')>=Math.max(2,Math.ceil(CivilCity.count(CivilCity.node(s,home))*.01/.3));
   defs.find(a=>a.id==='city_school').ready=!!local&&!local.schoolEnabled&&!!CivilCityInstitutions.schoolNeed(s,home);
   add('city_exchange','city','两座城先交换什么','湖滨有田地和木料，出发仓有工具。药品与铁料各有去处，不能把同一批物资许诺两遍。','exchange','contract',[
    ['provisions','粮医互济',['care','homes'],'每批约定工具96、药品48换食物1200、废料160，仍须双方留足口粮。'],
    ['industry','工料协作',['producers','trade'],'每批工具160、铁料24换食物1400、废料80；占用本可修造的铁料。']
   ],c.conurbation?.route?.phase==='ready'&&!c.conurbation.contract&&!c.conurbation.policies.some(p=>p.kind==='sign'));
   add('city_burden','city','道路的维修谁多出一份','湖滨还要修自己的工坊。道路照常运行就要消耗木料和工具，帮它多付一些，会挤占本城的工程储备。','exchangeShare','share',[
    ['host','本城承担四分之三',['care','trade'],'降低湖滨持续维护负担，本城承担更多真实路材与运费；议定需本城知识6。'],
    ['equal','双方继续各半',['local','homes'],'保留本城工程储备；湖滨也必须持续支付自己的一半，缺料时两城会停运。']
   ],!!c.conurbation?.contract&&!c.conurbation.policies.some(p=>p.kind==='share'));
   add('cluster_freight','cluster','先让哪一批货上车','湖滨的粮医和矿岭的工料共用有限车辆。扩大车场也要材料与维护，先议定现有车辆让谁先走。','freight','priority',[
    ['food','粮医优先',['care','homes'],'两条线均可出发时，先保粮医；另一条最多让行两次，仍需真实订单。'],
    ['industry','工料优先',['producers','trade'],'优先铁料与工具，粮医可能晚到；另一条最多让行两次。'],
    ['balanced','轮流调度',['local','ecology'],'保留轮流调度；不增加车辆，也不提前占用另一城物资。']
   ],!!c.cityNetwork?.enabled&&!c.cityNetwork.policies.some(p=>p.kind==='priority'));
  }
  return defs;
 },
 support(s){const d=this.data(s),c=s.civilization,base=d?.support||Object.fromEntries(Object.keys(this.groups).map(k=>[k,50])),healthy=(c.village?.health||0)>=80,fed=c.hunger===0;return Object.fromEntries(Object.entries(base).map(([k,n])=>[k,Math.max(0,Math.min(100,n+(k==='care'||k==='homes'?(fed?8:-20)+(healthy?5:-12):k==='local'&&c.society?.axes.devolution==='local'?5:0)))]));},
 home(s){return Object.keys(s.civilization.city?.institutions?.wards||{})[0];},
 owner(s,a,value,perform=false){const c=s.civilization,home=this.home(s),d=c.polity,f=d?.future,go=(reason,run)=>perform?!reason&&run():reason;
  if(a.owner==='institution'){const current=CivilCityInstitutions.local(s,home)?.[a.key];if(current===value)return perform?true:null;return go(CivilCityInstitutions.settingReason(s,home,a.key,value),()=>CivilCityInstitutions.set(s,home,a.key,value));}
  if(a.owner==='school'){if(!!CivilCityInstitutions.local(s,home)?.schoolEnabled===value)return perform?true:null;return go(home?null:'先登记城市公署',()=>CivilCityInstitutions.delegateSchool(s,home,value));}
  if(a.owner==='roster'){if(CivilPacing.data(s)?.enabled&&CivilPacing.data(s).mode===value)return perform?true:null;return go(CivilPacing.reason(s,value),()=>CivilPacing.set(s,value));}
  if(a.owner==='intake'){if(c.urban.enabled===value)return perform?true:null;return go(c.urban.registered?null:'先登记接纳协议',()=>CivilUrban.setEnabled(s,value));}
  if(a.owner==='exchange'){if(c.conurbation?.contract===value)return perform?true:null;return go(CivilConurbation.signReason(s,value),()=>CivilConurbation.sign(s,value));}
  if(a.owner==='exchangeShare'){if(c.conurbation?.share===value)return perform?true:null;return go(CivilRules.canPay({stores:CivilCity.node(s,c.conurbation.route.depot).stores},{knowledge:6})?null:'出发仓还需知识6',()=>CivilConurbation.setShare(s,value));}
  if(a.owner==='freight'){if(c.cityNetwork?.priority===value)return perform?true:null;return go(CivilRules.canPay({stores:CivilCityNetwork.local(s,'home').stores},{knowledge:4})?null:'出发仓还需知识4',()=>CivilCityNetwork.setPriority(s,value));}
  if(a.owner==='modern'){if(c.modern.grid===value)return perform?true:null;return go(CivilModern.reason(s,'grid',value),()=>CivilModern.act(s,'grid',value));}
  if(a.owner==='budget'){if(CivilCityCouncil.membersAt(s,c.elapsed).every(id=>CivilCityBudget.mode(s,id)===value))return perform?true:null;return go(CivilCityBudget.applyReason(s,'all',value),()=>CivilCityBudget.apply(s,'all',value));}
  if(a.owner==='governance'){if(CivilCityCouncil.membersAt(s,c.elapsed).every(id=>CivilCityGovernance.office(s,id)?.mode===value))return perform?true:null;return go(CivilCityGovernance.reason(s,'all',value),()=>CivilCityGovernance.apply(s,'all',value));}
  if(a.owner==='homes'){if(CivilCityHomes.estate(s,'home')?.mode===value)return perform?true:null;return go(CivilRules.canPay({stores:CivilCityCouncil.local(s,'home').stores},{knowledge:2})?null:'首城社区需要知识2',()=>CivilCityHomes.set(s,'home','mode',value));}
  if(a.owner==='national'){if(d.laws[a.key]===value)return perform?true:null;const args={laws:{...d.laws,[a.key]:value}};return go(CivilPolity.reason(s,'law',args),()=>CivilPolity.act(s,'law',args)&&'pending');}
  if(a.owner==='body'){if(f.laws[a.key]===value)return perform?true:null;const args={key:a.key,value};return go(CivilFuture.reason(s,'law',args),()=>CivilFuture.act(s,'law',args)&&'pending');}
  if(a.owner==='earth')return go(CivilEarth.reason(s,'unity',{mode:value}),()=>CivilEarth.act(s,'unity',{mode:value}));
  return perform?false:'相关机构尚未形成';
 },
 propose(s,id,value){this.init(s);const d=this.data(s),a=this.agenda(s).find(x=>x.id===id),option=a?.options.find(o=>o.value===value);if(!this.enabled(s)||d.proposal||!a?.ready||!option||this.owner(s,a,value))return false;
  const support=this.support(s),score=option.groups.reduce((n,k)=>n+support[k],0)/option.groups.length,duration=60+Math.ceil(Math.max(0,60-score))*3;
  d.proposal={id,value,at:s.civilization.elapsed,remaining:duration,duration,support,ownerStarted:null};d.seen[id]=true;return true;
 },
 finish(s,result,reason=''){const d=this.data(s),p=d.proposal,a=this.agenda(s).find(x=>x.id===p.id),o=a.options.find(x=>x.value===p.value);d.records.push({...p,endedAt:s.civilization.elapsed,result,reason});if(result==='passed')for(const k of Object.keys(d.support))d.support[k]=Math.max(10,Math.min(90,d.support[k]+(o.groups.includes(k)?8:-3)));d.proposal=null;},
 cancel(s){if(!this.data(s)?.proposal)return false;this.finish(s,'cancelled','撤回议题；已发生的机构支出和法定议案仍按原记录处理');return true;},
 tick(s){if(!this.enabled(s))return;this.init(s);const c=s.civilization,d=this.data(s),p=d.proposal;
  if(p){const a=this.agenda(s).find(x=>x.id===p.id);if(p.ownerStarted!==null){const owner=a.owner==='body'?c.polity.future:c.polity;if(!owner.proposal)this.finish(s,owner.laws[a.key]===p.value?'passed':'refused','按实际公共服务、权利边界和地方同意表决');}else if(p.remaining>0)p.remaining--;else if(!this.owner(s,a,p.value)){const result=this.owner(s,a,p.value,true);if(result==='pending')p.ownerStarted=c.elapsed;else if(result)this.finish(s,'passed');}}
  if(c.elapsed%600===0&&d.samples.at(-1)?.year!==c.elapsed/600){const year=c.elapsed/600,pop=CivilReadable.population(s)?.total||s.game.population;d.samples.push({year,pop});const era=c.polity?.earth?.ending?3:c.polity?.future?2:c.tech.electricalSafety?1:0;if(era>d.era){d.era=era;d.eraAt=c.elapsed;}
   const old=d.samples.find(x=>x.year===year-40),stalled=c.elapsed-d.eraAt>=36000,slow=old?.pop>0&&pop<old.pop*1.05;
   if((stalled||slow)&&!d.pressure&&c.elapsed-d.lastPressure>=6000){d.lastPressure=c.elapsed;d.pressure={at:c.elapsed,reason:stalled?'六十年未进入新时代':'四十年已知共同体人口增长不足5%',diagnosis:this.diagnosis(s)};for(const k of ['homes','knowledge'])d.support[k]=Math.max(10,d.support[k]-5);}
  }
 },
 diagnosis(s){const c=s.civilization,out=[];if(c.hunger)out.push('先恢复口粮，缺粮会影响健康与出生');const modern=CivilModern.gate(s,c.polity?'future':'city');if(modern)out.push(modern);if(Number.isSafeInteger(c.city?.cityAt))out.push('查看普查：空床、儿童课堂、医护和实际迁居来源都限制人口');if(c.research)out.push('当前研究尚在进行，观察实际余时');if(!out.length)out.push('查看科技前置、地方供养与联络范围；长期稳定经营也可以保留现状');return out.join('。')+'。这次诊断不发资源或人口。';},
 pending(s){const d=this.data(s);return this.agenda(s).filter(a=>a.ready&&!d?.seen[a.id]&&!d?.records.some(x=>x.id===a.id));},
 nextEvent(s){if(!this.enabled(s))return null;const d=this.data(s);if(d?.pressure)return 'civic_pressure';if(d&&!d.proposal&&this.pending(s).length)return 'civic_issue';return null;},
 event(id,done){const s=State,d=this.data(s);if(!this.enabled(s))return null;if(id==='civic_pressure'&&d.pressure){const p=d.pressure;return {title:'有人问起这些年',text:[p.reason+'。','记录员把空床、缺料与停下的研究摆上桌面。',p.diagnosis],buttons:{read:{text:'保留诊断，查看法律与诉求',nextScene:'end',onChoose:done('停滞诊断已入发展史。',()=>{d.pressureHistory.push(p);d.pressure=null;})}}};}if(id!=='civic_issue')return null;const a=this.pending(s)[0];if(!a)return null;const buttons={};for(const o of a.options)buttons['civic_'+String(o.value)]={text:o.label,nextScene:'end',available:()=>!this.owner(s,a,o.value),onChoose:done('议题已进入讨论，实付条件仍由原机构核算。',()=>this.propose(s,a.id,o.value))};buttons.later={text:'先保留诉求',nextScene:'end',onChoose:done('诉求保留在法律页。',()=>{d.seen[a.id]=true;})};return {title:a.title,text:[a.text,...a.options.map(o=>o.label+'：'+o.consequence+' 支持：'+o.groups.map(k=>this.groups[k]).join('、')+'。'+(this.owner(s,a,o.value)||''))],buttons};},
 laws(s){const c=s.civilization,d=c.polity,f=d?.future,x=c.society;return [
  ['公共权力与交接',Object.entries(x?.axes||{}).filter(([k])=>k!=='devolution').map(([k,v])=>CivilSociety.axes[k].choices[v].name).join(' · ')||'共同约定尚在形成','society.axes；历次改制和任期保留'],
  ['中央地方责任',d?CivilPolity.laws.devolution[d.laws.devolution]:x?.axes.devolution?CivilSociety.axes.devolution.choices[x.axes.devolution].name:'尚未形成地方共同责任','现有四轴与共同国约分别生效，不混成同一政体标签'],
  ['经营、财产与公共分配',(c.course?.coop?.mode==='coop'?'制器合作经营':c.course?.coop?'公共制器':'公共仓与现有家庭财产')+' · '+(CivilRules.policies[c.policy]?.name||'尚无固定配给'),'原合作社、工资与当地仓库，不增发货币或把公仓当家庭财富'],
  ['劳动、教育与保障',c.city?.institutions?'城市机构与持续培训'+(c.city.institutions.home.enabled?' · 原镇委托中':' · 原镇自行安排'):'现有分工与儿童课堂','实际岗位、学员和退休群体来源于同一人口'],
  ['居住、公民与迁徙',d?CivilPolity.laws.rights[d.laws.rights]:'迁居须真实空床与供养；来源保留最低留守','地方名册与在途名册不重复计人'],
  ['身体自主与连续身份',f?CivilFutureContent.laws.care.values[f.laws.care]+' · '+CivilFutureContent.laws.ownership.values[f.laws.ownership]:'相关能力尚未出现','改造仍需本人同意，身体转换不增加主体'],
  ['机器人格与政治资格',f?.tech.autonomy?CivilFutureContent.laws.citizenship.values[f.laws.citizenship]:'现有机器按设备登记','只有真实自治人格创建才增加主体；普通机器不计人口'],
  ['环境、信息与公共安全',f?.echo?.choice?'回响：'+CivilFutureContent.echoes[f.echo.choice].name:c.modern?.grid?CivilModernContent.grids[c.modern.grid].name+' · 保留公共维护':'近郊档案、巡护与地方公共空间','信仰和文化由现有公共空间约定体现，不按身体推定立场']];},
 validate(s){
  const d=this.data(s),now=s.civilization.elapsed,fail=x=>{throw Error('法律诉求账无效：'+x);};
  if(!this.enabled(s)){if(d!==undefined)fail('版本');return;}
  if(!d||d.schema!==1||!Array.isArray(d.records)||!Array.isArray(d.samples)||!Array.isArray(d.pressureHistory)||!d.seen||!d.support)fail('结构');
  const defs=this.agenda(s),byId=Object.fromEntries(defs.map(a=>[a.id,a])),keys=Object.keys(this.groups),integer=n=>Number.isSafeInteger(n)&&n>=0;
  if(Object.keys(d.support).length!==keys.length||Object.keys(d.seen).some(k=>!byId[k]||d.seen[k]!==true))fail('领域');
  let last=0;const events=[];
  for(const r of [...d.records,...(d.proposal?[d.proposal]:[])]){
   const a=byId[r.id],o=a?.options.find(o=>o.value===r.value);
   if(!o||!integer(r.at)||r.at<last||r.at>now||!integer(r.remaining)||r.remaining>r.duration||!integer(r.duration)||r.duration<60||r.duration>240||!r.support||Object.keys(r.support).length!==keys.length||keys.some(k=>!Number.isFinite(r.support[k])||r.support[k]<0||r.support[k]>100))fail('议题');last=r.at;
   const score=o.groups.reduce((n,k)=>n+r.support[k],0)/o.groups.length;
   if(r.duration!==60+Math.ceil(Math.max(0,60-score))*3||r.ownerStarted!==null&&(!integer(r.ownerStarted)||r.ownerStarted<r.at||r.ownerStarted>now))fail('讨论');
   if(r!==d.proposal){if(!['passed','refused','cancelled'].includes(r.result)||!integer(r.endedAt)||r.endedAt<r.at||r.endedAt>now)fail('结果');if(r.result==='passed')events.push({at:r.endedAt,groups:o.groups});}
  }
  last=-1;for(const row of d.samples){if(!integer(row.year)||row.year<=last||row.year*600>now||!integer(row.pop))fail('人口诊断');last=row.year;}
  last=-1;for(const p of [...d.pressureHistory,...(d.pressure?[d.pressure]:[])]){if(!integer(p.at)||p.at<=last||p.at>now||typeof p.reason!=='string'||typeof p.diagnosis!=='string')fail('停滞');last=p.at;events.push({at:p.at,pressure:true});}
  if(!integer(d.era)||d.era>3||!integer(d.eraAt)||d.eraAt>now||d.lastPressure!==(last===-1?-6000:last))fail('时代时序');
  const expected=Object.fromEntries(keys.map(k=>[k,50]));for(const e of events.sort((a,b)=>a.at-b.at)){if(e.pressure)for(const k of ['homes','knowledge'])expected[k]=Math.max(10,expected[k]-5);else for(const k of keys)expected[k]=Math.max(10,Math.min(90,expected[k]+(e.groups.includes(k)?8:-3)));}
  if(keys.some(k=>d.support[k]!==expected[k]))fail('支持来源');
 },
 open(d,e){if(e.equipmentVersion===1)d.world.routineRenewals=true;},
 renewalAction(d,e){if(e.equipmentVersion!==1||typeof d.world.routineRenewals!=='boolean'||typeof e.args.enabled!=='boolean'||d.world.routineRenewals===e.args.enabled)throw Error('选择不同的通行续办授权');CivilPolity.spend(d,{knowledge:4});d.world.routineRenewals=e.args.enabled;return e.args.enabled?'委托续办原通行授权；每次知识60、局势和公共余粮仍须合格。':'停止自动续办；已经批准的预约和在途货物继续履约。';},
 renew(w,p,at){if(!w.routineRenewals||!CivilForeign.ids(p.pair).includes('north')||!CivilTransit.access(w,p.pair,p.via)||!CivilForeign.ids(p.pair).every(id=>w.foreign.pairs[CivilForeign.pair(id,p.via)].relation>=-10))return false;const cost=CivilTransitContent.costs.permit;if(!CivilForeign.canSpend(w.nodes.north,cost))return false;CivilServices.pay(w.nodes.north.stores,cost);p.renewals??=[];p.renewals.push({at,paid:{...cost},until:at+3600});p.expiresAt=at+3600;CivilTransit.log(w,at,'passage','既有中转授权实付续办；原对象、通行边界和退出权不变。');return true;},
 refresh(s){if(!$('#councilPanel').length)return;let box=$('#civilLawPage');if(!box.length){box=$('<section>').attr('id','civilLawPage').prependTo('#councilPanel');$('<h3>').text('法律与诉求').appendTo(box);$('<p>').attr('id','civicCurrent').appendTo(box);$('<div>').attr('id','civicNeeds').appendTo(box);$('<div>').attr('id','civicActions').appendTo(box);$('<details>').attr('id','civicLaws').addClass('civil-details').append($('<summary>').text('八个领域的现行安排'),$('<div>')).appendTo(box);$('<details>').attr('id','civicGroups').addClass('civil-details').append($('<summary>').text('利益集团与支持来源'),$('<div>')).appendTo(box);}
  $('#location_council').text('法律与诉求');CivilReadable.rows('#civicLaws > div',this.laws(s));const enabled=this.enabled(s),d=this.data(s),p=d?.proposal;$('#civicCurrent').text(p?this.agenda(s).find(a=>a.id===p.id).title+' · '+(p.ownerStarted!==null?'等待原机构实际表决':p.remaining?'公开讨论还需 '+p.remaining+'秒':this.owner(s,this.agenda(s).find(a=>a.id===p.id),p.value)||'条件具备，待办理'):'现行约定与地方责任继续。议案会改变真实岗位、供料或权利；常规履约仍由原机构办理。');
  let details=$('#civicConstitution');if(!details.length)details=$('<details>').attr('id','civicConstitution').addClass('civil-details').append($('<summary>').text('权力交接、改制与原记录')).appendTo('#councilPanel');$('#councilPanel > .button,#councilRecord,#councilHistory').appendTo(details);
  let renew=$('#civicRenewals');if(!renew.length)renew=$('<div>').attr('id','civicRenewals').appendTo(box);renew.toggle(enabled&&!!s.civilization.polity);if(enabled&&s.civilization.polity){const on=s.civilization.polity.world.routineRenewals;CivilCityView.button('civic_renewals',on?'停止通行续办委托':'委托通行续办',renew,CivilPolity.reason(s,'renewals',{enabled:!on}),()=>{CivilPolity.act(State,'renewals',{enabled:!on});Civilization.refresh();});}
  const score=this.support(s);CivilReadable.rows('#civicGroups > div',Object.keys(this.groups).map(k=>[this.groups[k],enabled?score[k]+' / 100':'原档没有新支持度记录','议题立场，非人数或选票；职业、身体、文化身份不重复累加。历史选择基础 '+(d?.support[k]??'未记')+'，实际供养、健康与地方制度影响当前立场。']));
  const pending=enabled?this.agenda(s).filter(a=>a.ready&&!d.records.some(r=>r.id===a.id&&r.result==='passed')):[];CivilReadable.alerts('#civicNeeds',pending.map(a=>({text:a.title,go:()=>{this.selected=a.id;this.refresh(State);CivilReadable.focus('#civicActions');}})));const host=$('#civicActions');
  if(!enabled){host.text('旧档沿用已有法律，详情与改议仍在下方原入口；不启用新支持度规则。');return;}const opts=Object.fromEntries(pending.map(a=>[a.id,a.title]));if(!Object.keys(opts).length){host.empty();return;}
  if(!$('#civicTopic').length){host.empty();CivilPolityView.select('civicTopic','当前议题',host,()=>{this.selected=$('#civicTopic').val();this.value=null;this.refresh(State);});CivilPolityView.select('civicOption','拟议方案',host,()=>{this.value=$('#civicOption').val();this.refresh(State);});$('<p>').attr('id','civicTerms').appendTo(host);$('<div>').attr('id','civicCommit').appendTo(host);}
  this.selected=CivilPolityView.choices('civicTopic',opts,this.selected);const a=pending.find(a=>a.id===this.selected);this.value=CivilPolityView.choices('civicOption',Object.fromEntries(a.options.map(o=>[String(o.value),o.label])),this.value);const o=a.options.find(o=>String(o.value)===this.value);$('#civicTerms').text(a.text+' '+o.consequence+' 支持团体：'+o.groups.map(k=>this.groups[k]).join('、')+'。原机构费用和资格照常，反对越多，讨论越长；不随机判输。');CivilCityView.button('civic_submit','提交讨论','#civicCommit',p?'已有讨论中的提案':this.owner(s,a,o.value),()=>{this.propose(State,a.id,o.value);Civilization.refresh();});CivilCityView.button('civic_cancel','撤回讨论','#civicCommit',p?null:'目前没有提案',()=>{this.cancel(State);Civilization.refresh();}).toggle(!!p);

 }
};
