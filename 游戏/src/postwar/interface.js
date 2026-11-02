/* MPL-2.0 — Read-only summaries and progressive organization of existing ADR controls. */
var CivilInterface={
  views:{},researchModule:null,
  kinds:{expeditiondepot:'industry',roboticsworks:'industry',railfreight:'industry',precisionworks:'industry',electronicsworks:'industry',windstation:'power',meetinghall:'culture',residential:'housing',blockhousing:'housing',densehousing:'housing',passengerfleet:'migration',publicclinic:'care',publicschool:'care',irrigatedfield:'care',toolworks:'care',pharmacy:'care',heatingplant:'care',waterworks:'care',waterfield:'care',irrigationworks:'care',districtschool:'care',farmland:'care',clinic:'care',school:'care',salvageyard:'materials',woodlot:'materials',mine:'materials',coalpit:'materials',mineralquarry:'materials',mineexpansion:'materials',coalexpansion:'materials',furnace:'industry',machineworks:'industry',chemicalworks:'industry',steelworks:'industry',glassworks:'industry',powerhouse:'power',utilitypower:'power',scrubber:'power',filterplant:'power'},
  labels:{exploration:'遗迹',culture:'社群',overview:'概况',housing:'住房',care:'供养',migration:'迁居',materials:'原料',industry:'加工',power:'能源'},
  number(n){return Number((Number(n)||0).toFixed(2));},
  signed(n){return (n>=0?'+':'')+this.number(n);},
  projectText(s,id='home'){
    const p=typeof CivilServices!=='undefined'?CivilServices.data(s,id)?.project:null;
    if(!p||p.status==='complete')return null;
    const name=CivilServiceContent.facilities[p.type].name;
    return name+' · '+(p.status==='building'?'施工余 '+Math.ceil(p.remaining)+' 秒':'建材运输中');
  },
  urbanSummary(s){
    const u=s.civilization.urban,e=u.economy,source=CivilUrban.sourceId(s),target=CivilUrban.targetId(s),n=s.civilization.origins?.nodes[source];
    const waiting=(u.parties||[]).reduce((sum,p)=>sum+CivilUrban.count(p.cohorts),0),reserved=CivilUrban.reservedBeds(s);
    const cards=[['居民',s.game.population+' / '+CivilCatalog.capacity(s)],['住房',CivilUrban.availableBeds(s)+' 空床 · '+reserved+' 预留']];
    if(e)cards.push(['粮食 / 10秒',this.signed(e.food),e.food<0],['药品 / 10秒',this.signed(e.medicine),e.medicine<0],['儿童教学',e.education?'已覆盖':'待补足',!e.education],['居民治疗',e.treatment?'已覆盖':'待补足',!e.treatment]);
    const notices=[];if(e?.food<0)notices.push('粮食正在消耗储备');if(e?.medicine<0)notices.push('药品正在消耗储备');if(e&&!e.education)notices.push('教师或教材不足');if(s.civilization.hunger)notices.push('居民口粮不足');
    if(typeof CivilHeating!=='undefined'&&CivilHeating.data(s)){const h=CivilHeating;cards.push(['实际供暖',h.capacity(s)+' / '+s.game.population+' 人份',h.handed(s)&&!h.covered(s)]);if(h.handed(s)&&!h.covered(s))notices.push('供暖覆盖不足，新的批次接纳暂停');}
    const project=this.projectText(s);if(project)notices.push('在建：'+project);
    const details=[['粮药口径','近轮净供给已含现有固定合同；出发旅费另付'],['接纳计划',u.enabled?'自动接纳已开启':'新批次已暂停；在途继续'],['来源',CivilUrban.sourceName(source)],['来源居民',source==='dispersed'?CivilUrban.count(u.source)+' 人待安置':(n?.population||0)+' 人，包含留守居民'],['后续目的地',CivilUrban.targetName(s,target)+' · '+CivilUrban.targetPopulation(s,target)+' / '+CivilUrban.targetCapacity(s,target)+' 人'],['目的地预留',CivilUrban.reservedBeds(s,target)+' 床'],['当前安排',u.status]];
    if(!u.city)details.push(['发展准备',u.chartered?'城市稳定 '+u.cityStable+' / 300秒':'镇制稳定 '+u.townStable+' / 180秒']);
    return {title:u.city?'炉火城':u.chartered?'正式镇制':'街区',cards,notices,brief:(u.registered||source!=='dispersed')?CivilUrban.sourceName(source)+' → '+CivilUrban.targetName(s,target)+' · '+u.parties.length+' 队，'+waiting+' 人在途':null,details};
  },
  municipalSummary(s,id){
    const n=CivilMunicipal.node(s,id),m=CivilMunicipal.data(s,id),e=m?.economy;
    const cards=[['居民',n.population+' / '+CivilMunicipal.capacity(s,id)],['健康',Math.floor(n.health)+' / 100']];
    if(e)cards.push(['粮食 / 10秒',this.signed(e.food),e.food<0],['药品 / 10秒',this.signed(e.medicine),e.medicine<0],['儿童教学',e.education?'已覆盖':'待补足',!e.education],['工业用电',this.number(e.productivePower)+' / '+this.number(m.power.generation)]);
    const emptyFood=n.population>0&&(n.stores.food||0)<1e-8;
    // An exhausted warehouse has no further negative stock delta. Zero change
    // is not proof that residents ate; keep the shortage visible at zero stock.
    if(emptyFood){const food=cards.find(row=>row[0]==='粮食 / 10秒');if(food){food[1]=this.signed(e.food)+' · 无储备';food[2]=true;}}
    const notices=[];if(emptyFood)notices.push('粮仓已空，需要补给与生产恢复');else if(e?.food<0)notices.push('当地粮食净供给不足');if(e?.medicine<0)notices.push('当地药品净供给不足');if(m?.pollution>=40)notices.push('烟尘正在影响居民健康');
    if(m?.project?.status==='building'&&n.health<30)notices.push('健康不足30，地方施工暂停');
    if(typeof CivilHeating!=='undefined'&&CivilHeating.data(s,id)){const h=CivilHeating;cards.push(['实际供暖',h.capacity(s,id)+' / '+n.population+' 人份',h.handed(s,id)&&!h.covered(s,id)]);if(h.handed(s,id)&&!h.covered(s,id))notices.push('当地供暖覆盖不足');}
    const project=this.projectText(s,id);if(project)notices.push('在建：'+project);
    if(typeof CivilFinance!=='undefined'){const waiting=CivilFinance.waitingReturn(s,id);if(waiting?.constructionWaiting)notices.push(CivilFinance.waitingText(s,id)+'；议事屋→共同约定可安排返车');}
    return {title:CivilRegionContent[id].name+' · '+(m?.city?'城市':m?.town?'镇':'聚居地'),cards,notices,brief:m&&!m.city?(m.town?'城市准备 '+m.cityStable+' / 300秒':'镇制准备 '+m.townStable+' / 180秒'):null,details:[['住房预留',CivilUrban.reservedBeds(s,id)+' 床'],['当地储备','粮 '+Math.floor(n.stores.food||0)+' · 药 '+this.number(n.stores.medicine)+' · 工具 '+this.number(n.stores.tools)],['烟尘',this.number(m?.pollution)],['仓库原则','当地人口、仓库和供电分别结算；在途尚未入库']]};
  },
  summary(selector,model){
    const root=$(selector);if(!root.length)return;
    root.addClass('civil-summary');
    if(!root.children('.civil-summary-title').length){root.empty();$('<div>').addClass('civil-summary-title').appendTo(root);$('<div>').addClass('civil-metrics').appendTo(root);$('<div>').addClass('civil-brief').appendTo(root);$('<div>').addClass('civil-notices').appendTo(root);const details=$('<details>').addClass('civil-details').appendTo(root);$('<summary>').text('查看明细').appendTo(details);$('<dl>').appendTo(details);}
    root.children('.civil-summary-title').text(model.title);
    const metrics=root.children('.civil-metrics');
    for(let i=0;i<model.cards.length;i++){let row=metrics.children().eq(i);if(!row.length){row=$('<div>').addClass('civil-metric').appendTo(metrics);$('<span>').appendTo(row);$('<strong>').appendTo(row);}const [label,value,bad]=model.cards[i];row.children('span').text(label);row.children('strong').text(value);row.toggleClass('needs-attention',!!bad);}
    metrics.children().slice(model.cards.length).remove();root.children('.civil-brief').text(model.brief||'').toggle(!!model.brief);root.children('.civil-notices').text(model.notices.join(' · ')).toggle(model.notices.length>0);
    const dl=root.find('details > dl');if(dl.children().length!==model.details.length*2){dl.empty();for(const row of model.details){$('<dt>').appendTo(dl);$('<dd>').appendTo(dl);}}
    model.details.forEach(([label,value],i)=>{dl.children().eq(i*2).text(label);dl.children().eq(i*2+1).text(value);});
  },
  renderUrban(s){this.summary('#urbanRecord',this.urbanSummary(s));},
  renderMunicipal(s,id){this.summary('#municipalStatus',this.municipalSummary(s,id));},
  development(s,id,visible){
    let box=$('#civilDevelopment');if(!box.length){box=$('<details>').attr('id','civilDevelopment').addClass('civil-details civil-development').insertAfter('#civilTabs_municipal');$('<summary>').appendTo(box);$('<p>').appendTo(box);$('<div>').addClass('civil-development-missing').appendTo(box);const done=$('<details>').addClass('civil-details').appendTo(box);$('<summary>').appendTo(done);$('<div>').appendTo(done);}
    const m=CivilMunicipal.data(s,id);box.toggle(visible&&!!m&&!m.city);if(!visible||!m||m.city)return;
    const city=m.town,rows=CivilMunicipal.developmentChecks(s,id,city),missing=rows.filter(x=>!x.ready),passed=rows.filter(x=>x.ready),seconds=city?300:180,stable=city?m.cityStable:m.townStable;
    box.children('summary').text('发展条件 · '+(city?'城市':'镇制')+(missing.length?'还差 '+missing.length+' 项':'条件已齐备'));
    box.children('p').text('所有条件须同时保持 '+seconds+' 秒；当前 '+stable+' / '+seconds+' 秒。完成后由地方代表提出登记。');
    const fill=(root,list,detail)=>{while(root.children().length<list.length){const row=$('<div>').addClass('civil-development-row').appendTo(root);$('<strong>').appendTo(row);$('<p>').appendTo(row);}root.children().slice(list.length).remove();list.forEach((r,i)=>{const row=root.children().eq(i);row.children('strong').text(r.label+' · '+r.value);row.children('p').text(detail?r.hint:'').toggle(detail);});};
    fill(box.children('.civil-development-missing'),missing,true);const done=box.children('details');done.children('summary').text('已满足（'+passed.length+'）');fill(done.children('div'),passed,false);
  },
  select(key,view){this.views[key]=view;this.refresh(State);},
  tabs(key,anchor,choices){
    let bar=$('#civilTabs_'+key);if(!bar.length)bar=$('<div>').attr({id:'civilTabs_'+key,role:'group','aria-label':'查看分类'}).addClass('civil-tabs').insertAfter(anchor);
    const active=choices.includes(this.views[key])?this.views[key]:choices[0];this.views[key]=active;
    for(const value of choices){const button=Civilization.button('civilTab_'+key+'_'+value,this.labels[value],bar,()=>this.select(key,value));button.addClass('civil-tab').attr({'aria-pressed':String(value===active)}).toggleClass('selected',value===active).show();}
    bar.children('.civil-tab').each(function(){const value=this.id.split('_').at(-1);$(this).toggle(choices.includes(value));});return active;
  },
  filter(selector,kind,active){$(selector).toggleClass('civil-filtered',kind!==active);},
  serviceGroups(prefix,active){
    const box=$('#services_'+prefix);if(!box.length)return;
    box.toggle(active!=='overview');
    for(const type of Object.keys(CivilServiceContent.facilities))this.filter('#services_'+prefix+'_'+type,this.kinds[type]||'care',active);
    this.filter('#services_'+prefix+'_manual','care',active);
    for(const suffix of ['record','manual','handover'])this.filter('#heating_'+prefix+'_'+suffix,'care',active);
    // A concise facility line replaces the original concatenated catalogue; active projects stay visible above it.
    const id=prefix==='home'?'home':CivilMunicipal.selected,m=CivilServices.data(State,id),count=Object.entries(m?.buildings||{}).filter(([type,n])=>n&&(this.kinds[type]||'care')===active).map(([type,n])=>CivilServiceContent.facilities[type].name+' '+n);
    const p=this.projectText(State,id),e=m?.economy,water=CivilServices.waterCapacity(State,id),population=CivilServices.population(State,id);
    const service=e&&['care','housing'].includes(active)?'实际供水 '+water+' / '+population+' 人份；药剂产出 '+this.number(e.medicine)+'；公用用电 '+this.number(e.used)+' / '+this.number(e.demand)+'。':'';
    $('#services_'+prefix+'_status').text([(p?'在建：'+p:''),service.replace(/。$/,''),count.join(' · '),active==='industry'&&typeof CivilPrecision!=='undefined'?CivilPrecision.describe(State,id):'',active==='power'&&State.civilization.tech.wind_power&&typeof CivilWind!=='undefined'?CivilWind.describe(State,id):''].filter(Boolean).join('。'));
    let details=$('#civilServiceDetails_'+prefix);if(!details.length){details=$('<details>').attr('id','civilServiceDetails_'+prefix).addClass('civil-details').appendTo(box);$('<summary>').text('工程与服务明细').appendTo(details);$('<p>').appendTo(details);}
    const project=m?.project,fmt=values=>Object.entries(values||{}).map(([key,n])=>(CivilText.labels[key]||key)+' '+this.number(n)).join('、');
    details.children('p').text((e?'近轮供水 '+water+' 人份；药剂产出 '+this.number(e.medicine)+'；公用用电 '+this.number(e.used)+' / '+this.number(e.demand)+'。':'')+(project&&project.status!=='complete'?'工程所需：'+fmt(project.required)+'；已到：'+(fmt(project.buffer)||'尚无')+'。需2名实际建设者。':''));details.toggle(!!e||!!p);
  },
  urban(s,renderSummary=true){
    if(!$('#urbanPanel').length)return;
    if(renderSummary)this.renderUrban(s);const choices=['overview','housing','care'];if(s.civilization.tech.machine_tools)choices.push('industry');if(s.civilization.tech.wind_power)choices.push('power');if(s.civilization.urban.registered||CivilUrban.sourceIds(s).length>1)choices.push('migration');const active=this.tabs('urban','#urbanRecord',choices);
    $('#urbanBuildBtns').parent().addClass('civil-build-columns').toggle(['housing','care'].includes(active));
    for(const type of Object.keys(CivilUrban.buildings)){const kind=this.kinds[type]||'care';this.filter('#build_'+type,kind,active);this.filter('#urban_count_'+type,kind,active);}
    $('#urbanPlans').toggle(active==='migration');this.serviceGroups('home',active);
    let jump=$('#civilUrbanJump');if(!jump.length){jump=$('<div>').attr('id','civilUrbanJump').addClass('civil-jump').insertAfter('#civilTabs_urban');Civilization.button('civilUrbanBuild','查看住房','#civilUrbanJump',()=>this.select('urban','housing'));Civilization.button('civilUrbanMigration','安排迁居','#civilUrbanJump',()=>this.select('urban','migration'));}
    jump.toggle(active==='overview');$('#civilUrbanMigration').toggle(s.civilization.urban.registered||CivilUrban.sourceIds(s).length>1);
  },
  municipal(s,renderSummary=true){
    if(!$('#municipalPanel').length)return;
    const id=CivilMunicipal.selected,m=CivilMunicipal.data(s,id);if(!id)return;if(renderSummary)this.renderMunicipal(s,id);
    if(!m){$('#civilTabs_municipal,#civilMunicipalProjectDetails,#civilMunicipalProjectBrief,#civilCultureStatus,#civilDevelopment').hide();$('#municipalBuild').parent().show();return;}
    const available=['overview','housing','care','materials','industry','power','culture','exploration'].filter(group=>group==='exploration'&&id==='river'&&typeof CivilRuins!=='undefined'&&(CivilRuins.eligible(s,id)||!!CivilRuins.data(s))||group==='overview'||group==='culture'&&typeof CivilCulture!=='undefined'&&(CivilCulture.eligible(s,id)||CivilCulture.data(s,id))||Object.keys(CivilMunicipalContent.facilities).some(type=>(this.kinds[type]||'care')===group&&(this.nativeShown('#municipalBuild_'+type)||m.buildings[type]))||Object.keys(CivilServiceContent.facilities).some(type=>this.kinds[type]===group&&(this.nativeShown('#services_local_'+type)||s.civilization.services?.nodes[id]?.buildings[type])));
    $('#civilTabs_municipal').show();const active=this.tabs('municipal','#municipalStatus',available);
    this.development(s,id,active==='overview');
    $('#municipalBuild').parent().addClass('civil-build-columns').toggle(!['overview','exploration'].includes(active));
    $('#cooperativeButton,#civilCooperativeStatus').toggle(active==='industry'&&typeof CivilCooperative!=='undefined'&&(!!CivilCooperative.data(s,id)||CivilCooperative.eligible(s,id)));
    $('#ruinButton,#civilRuinStatus').toggle(active==='exploration'&&id==='river');
    $('#cultureButton').toggle(active==='culture'&&typeof CivilCulture!=='undefined'&&(CivilCulture.eligible(s,id)||!!CivilCulture.data(s,id)));
    let commons=$('#civilCultureStatus');if(!commons.length)commons=$('<div>').attr('id','civilCultureStatus').insertAfter('#civilTabs_municipal');
    commons.toggle(active==='culture');
    if(active==='culture'&&typeof CivilCulture!=='undefined'){
      const u=CivilCulture,d=u.data(s,id),r=u.active(s,id),a=u.agreement(s,id),reason=d?u.reason(s,id):null;
      this.summary('#civilCultureStatus',{title:'公共会堂',cards:[['空间约定',a?u.modes[a.mode]:'尚未议约'],['后续活动',d?(u.enabled(s,id)?'依约筹备':'已停办'):'待议约'],['当前活动',r?u.kinds[r.kind]:'暂无'],['在场成年人',(CivilMunicipal.node(s,id).workers.communityworker||0)+' / 14']],brief:r?'还需 '+r.remaining+' 秒共同在场':d&&u.enabled(s,id)&&s.civilization.elapsed<u.due(s,id)?'下次筹备还有 '+Math.ceil(u.due(s,id)-s.civilization.elapsed)+' 秒':null,notices:reason&&d&&(r||u.enabled(s,id)&&s.civilization.elapsed>=u.due(s,id))?[reason]:[],details:[['议约支出','地方知识 10'],['每次筹备','地方木料 4、食物 6；另保留120秒口粮'],['人员安排','2位组织者与12位参与者，优先保证生产、施工、治疗与教学'],['活动记录','已完成 '+(d?.activities.filter(x=>x.status==='complete').length||0)+' 次；重大决定见右下角发展史']]});
    }
    for(const type of Object.keys(CivilMunicipalContent.facilities)){const kind=this.kinds[type]||'care';this.filter('#municipalBuild_'+type,kind,active);this.filter('#municipalCount_'+type,kind,active);}
    this.serviceGroups('local',active);
    if(!$('#civilMunicipalProjectDetails').length){const details=$('<details>').attr('id','civilMunicipalProjectDetails').addClass('civil-details civil-project-details').insertBefore('#municipalProject');$('<summary>').text('工程与材料明细').appendTo(details);$('#municipalProject').appendTo(details);}
    $('#civilMunicipalProjectDetails,#civilMunicipalProjectBrief').show();const p=m.project;let brief=$('#civilMunicipalProjectBrief');if(!brief.length)brief=$('<div>').attr('id','civilMunicipalProjectBrief').addClass('civil-brief').insertBefore('#civilMunicipalProjectDetails');
    const upgrade=typeof CivilRegions!=='undefined'?CivilRegions.upgrade(State,id):null,service=this.projectText(State,id);
    brief.text(upgrade&&upgrade.status!=='complete'?'货车改装 · '+(upgrade.status==='supplying'?'材料运输中，完成前暂不开新工程':'当地施工余 '+Math.ceil(upgrade.remaining)+' 秒'):p&&p.status!=='complete'?CivilMunicipalContent.facilities[p.type].name+' · '+(p.status==='supplying'?'材料运输中':'施工余 '+Math.ceil(p.remaining)+' 秒'):service||'当前没有在建工程，可选择下一类建设');
    if(active==='exploration')$('#civilMunicipalProjectDetails,#civilMunicipalProjectBrief').hide();
  },
  industry(s){
    if(!$('#industryPanel').length)return;
    const groups=['materials','industry','power'].filter(group=>Object.keys(this.kinds).some(type=>this.kinds[type]===group&&(this.nativeShown('#build_'+type)||s.game.buildings[type])));if(!groups.length)return;const active=this.tabs('industry','#industryStatus',groups);
    for(const type of [...Object.keys(CivilIndustry.buildings),...Object.keys(typeof CivilAdvancedContent!=='undefined'?CivilAdvancedContent.facilities:{})]){const kind=this.kinds[type]||'industry';this.filter('#build_'+type,kind,active);this.filter('#industry_count_'+type,kind,active);}
  },
  nativeShown(selector){const node=$(selector)[0];return !!node&&node.style.display!=='none';},
  construction(s){
    const root=$('#buildBtns');if(!root.length)return;
    if(s.civilization.village?.town){$('#roomPanel').addClass('civil-room-managed');let actions=$('#civilRoomActions');if(!actions.length)actions=$('<div>').attr('id','civilRoomActions').addClass('civil-room-actions').insertBefore(root);for(const id of ['policyButton','civilResearchLink']){const button=$('#'+id);if(button.length&&!button.parent().is(actions))button.appendTo(actions);}}
    let book=$('#civilBuiltBook');if(!book.length){book=$('<details>').attr('id','civilBuiltBook').addClass('civil-details').appendTo(root);$('<summary>').appendTo(book);$('<div>').appendTo(book);}
    // Only capped buildings move out of the construction queue. Repeatable expansions remain actionable.
    let count=0;for(const [id,item]of Object.entries(Room.Craftables)){const button=$('#build_'+id);if(!button.length||(!button.parent().is(root)&&!button.parent().is(book.children('div'))))continue;
      const built=s.game.buildings[id]||0,limit=CivilCatalog.buildingLimit?CivilCatalog.buildingLimit(s,id):item.maximum;
      if(built>=limit&&built>0){if(!button.parent().is(book.children('div')))button.appendTo(book.children('div'));count++;}else if(!button.parent().is(root))button.insertBefore(book);
    }
    book.children('summary').text('已建成 / 已达上限（'+count+'）');book.toggle(count>0);
  },
  councilSummary(s){
    const x=s.civilization.society;
    return {title:'重建 '+x.year+' 年 · 第 '+x.generation+' 任',cards:[['当前代表',x.leader.title+' · '+x.leader.age+'岁'],['公共行政',x.service?'正常':'物资不足',!x.service],['成年劳力',CivilSociety.workforce(s)],['儿童',CivilPopulation.children(x.cohorts)],['退休居民',x.cohorts.filter(v=>v.age>=65).reduce((n,v)=>n+v.count,0)],['制度认可',Math.floor(x.legitimate)+' / 100']],notices:x.training?['继任培养还需 '+Math.ceil(x.training.remaining)+' 秒']:[],brief:Object.entries(x.axes).map(([key,value])=>CivilSociety.axes[key].choices[value].name).join(' · '),details:[['制度基础协调',CivilSociety.capacity(s)+' 份'],...(s.civilization.tech.administration&&typeof CivilRegions!=='undefined'&&CivilRegions.coordinationStatus?[['当前全部协调',CivilRegions.coordinationStatus(s)]]:[]),['当前任期',x.leader.started+' 年至今'],['继任状态',x.leader.alive?'现任在职':'等待交接'],['制度记录','历任与已记录的发展可从右下角“发展史”查阅']]};
  },
  originSummary(s,id){
    const n=s.civilization.origins.nodes[id],cfg=CivilOriginContent[id];
    if(!['contacted','agreed'].includes(n.status))return null;
    const reason=n.status==='agreed'?CivilOrigins.quoteReason(s,id,s.civilization.tech?.passenger_transport?24:8,{mode:'convoy',capacity:s.civilization.tech?.passenger_transport?24:8}):CivilOrigins.agreementReason(s,id);
    return {title:cfg.name,cards:[['来源居民',n.population],['成年劳力',CivilPopulation.workforce(n.cohorts)],['儿童',CivilPopulation.children(n.cohorts)],['健康',Math.floor(n.health)+' / 100']],brief:n.status==='agreed'?'批次协议已登记 · 余量 '+CivilOrigins.remaining(s,id):'已取得联系 · 可逐人到访',notices:reason?[reason]:[],details:[['最低留守',cfg.retained+' 人'],['预留住房',CivilOrigins.reservedBeds(s,id)+' 床'],['教育',CivilOrigins.schoolStatus(s,id)],['迁居费用','实际规模仍由车组、旅费与目的地供养决定；来源居民不会直接计入本城。']]};
  },
  researchRows(s){
    const c=s.civilization,frontier=new Set(Object.keys(CivilText.research).filter(id=>c.tech[id]||CivilCatalog.researchAvailable(s,id)));
    return Object.entries(CivilText.research).filter(([id,r])=>frontier.has(id)||((r.requires||[]).length&&(r.requires||[]).every(key=>frontier.has(key))&&(!r.discover||r.discover(s)))).map(([id,r])=>({id,name:r.name,done:!!c.tech[id],active:c.research?.id===id,available:!!CivilCatalog.researchAvailable(s,id),requires:(r.requires||[]).map(key=>({name:CivilText.research[key]?.name||key,done:!!c.tech[key]})),cost:r.cost,duration:r.duration,detail:r.done}));
  },
  research(s){
    if(!s.game.buildings.workshop)return;
    if(!this.researchModule){const m=this.researchModule={onArrival(diff){document.title='科技';Engine.moveStoresView(null,diff);}};m.tab=Header.addLocation('科技','research',m);m.panel=$('<div>').attr('id','civilResearchPanel').addClass('location').appendTo('#locationSlider');$('<div>').addClass('civil-summary-title').text('科技与工艺').appendTo(m.panel);$('<div>').attr('id','civilResearchIntro').addClass('civil-brief').text('选择可研究的工艺开始试制。展开科技路线可查前置与材料；更远的方向随发展出现。').appendTo(m.panel);Engine.updateSlider();}
    if(!$('#researchBtns').parent().is('#civilResearchPanel'))$('#researchBtns').appendTo('#civilResearchPanel');
    let link=$('#civilResearchLink');if(!link.length)link=Civilization.button('civilResearchLink','打开科技','#roomPanel',()=>Engine.travelTo(this.researchModule));
    let tree=$('#civilResearchTree');if(!tree.length){tree=$('<details>').attr('id','civilResearchTree').addClass('civil-details').appendTo('#civilResearchPanel');$('<summary>').text('展开科技路线与已掌握技术').appendTo(tree);$('<div>').appendTo(tree);}
    const rows=this.researchRows(s),signature=JSON.stringify(rows);if(tree.attr('data-tech')===signature)return;tree.attr('data-tech',signature);const list=tree.children('div').empty();
    for(const r of rows){const item=$('<details>').addClass('civil-tech-row').appendTo(list);$('<summary>').text(r.name+' · '+(r.done?'已掌握':r.active?'试制中':r.available?'可研究':'待前置')).appendTo(item);$('<p>').text('前置：'+(r.requires.length?r.requires.map(x=>x.name+(x.done?' ✓':'（未完成）')).join('、'):'工坊')).appendTo(item);$('<p>').text('投入：'+Object.entries(r.cost).map(([key,n])=>(CivilText.labels[key]||key)+' '+n).join('、')+'；试制 '+r.duration+' 秒').appendTo(item);$('<p>').text(r.detail).appendTo(item);}
  },
  // Whole-page refresh already rendered these summaries in their owning modules.
  // Direct category clicks retain the default immediate summary update.
  refresh(s,{summaries=true}={}){this.urban(s,summaries);this.municipal(s,summaries);this.industry(s);this.research(s);this.construction(s);if(summaries&&$('#councilRecord').length)this.summary('#councilRecord',this.councilSummary(s));},
  reset(){this.views={};this.researchModule=null;}
};
