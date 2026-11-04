/* MPL-2.0 — Municipal choices within the ADR city page; drafts survive refresh. */
var CivilCityCouncilView={
  built:false,scale:'housing',project:'housing:lake',mode:'equal',city:'home',quota:'normal',
  reset(){this.built=false;this.scale='housing';CivilCityHomesView.reset();CivilCityContinuityView.reset();CivilCityLaborView.reset();this.project='housing:lake';this.mode='equal';this.city='home';this.quota='normal';},
  b(id,label,host,reason,fn){return CivilCityView.button('council_'+id,label,host,reason,fn);},
  choice(id,label,options,host){const box=$('<label>').addClass('city-setting').appendTo(host);$('<span>').text(label).appendTo(box);const select=$('<select>').attr({id:'councilChoice_'+id,'aria-label':label,size:Object.keys(options).length}).appendTo(box);for(const [key,name]of Object.entries(options))$('<option>').val(key).text(name).appendTo(select);select.val(this[id]).on('change',()=>{this[id]=select.val();CivilCityView.refresh(State);}).on('keydown keyup',e=>e.stopPropagation());return select;},
  ensure(){if(this.built&&$('#cityCouncilBody').length)return;this.built=true;const body=$('<div>').attr('id','cityCouncilBody').appendTo('#cityBody');
    $('<h3>').attr('id','councilTitle').appendTo(body);$('<div>').attr('id','councilSummary').appendTo(body);$('<p>').attr('id','councilCurrent').addClass('city-net-lines').appendTo(body);
    $('<div>').attr('id','councilNav').appendTo(body);$('<p>').attr('id','councilNeeds').addClass('city-net-lines').appendTo(body);
    const proposal=$('<details>').attr('id','councilProposal').addClass('civil-details').appendTo(body).append($('<summary>').text('议定下一项共同工程'));
    this.choice('project','工程与受益地',{'housing:home':'炉火城安居','housing:lake':'湖滨市安居','housing:ridge':'矿岭市安居','housing:estuary':'河口市安居','road:cross':'湖滨—矿岭直路','road:river':'湖滨—河口通路'},proposal);
    this.choice('scale','安居规模',{housing:'零散扩容 · 800床',neighborhood:'安居街区 · 3200床',district:'成片社区 · 8000床'},proposal);
    this.choice('mode','材料分担',CivilCityCouncil.modes,proposal);$('<p>').attr('id','councilPreview').addClass('city-net-lines').appendTo(proposal);$('<div>').attr('id','councilProposalActions').appendTo(proposal);
    const mandate=$('<details>').attr('id','councilMandates').addClass('civil-details').appendTo(body).append($('<summary>').text('各城授权与支出限额'));
    this.choice('city','办理城市',{home:'炉火城',lake:'湖滨市',ridge:'矿岭市',estuary:'河口市'},mandate);this.choice('quota','每期支出限额',Object.fromEntries(Object.entries(CivilCityCouncil.quotas).map(([k,v])=>[k,v.name])),mandate);
    $('<p>').attr('id','councilTerms').addClass('city-net-lines').appendTo(mandate);$('<div>').attr('id','councilMandateActions').appendTo(mandate);
    const growth=$('<details>').attr('id','councilGrowth').addClass('civil-details').appendTo(body).append($('<summary>').text('沿河普查与城市登记'));$('<p>').attr('id','councilGrowthText').appendTo(growth);$('<div>').attr('id','councilGrowthActions').appendTo(growth);
    for(const [id,label]of [['Freight','公共运输与待办'],['Ledger','供料、费用与地方账']])$('<details>').attr('id','council'+id).addClass('civil-details').appendTo(body).append($('<summary>').text(label)).append($('<p>').addClass('city-net-lines'));
  },
  title(s,p){return CivilCityCouncil.housingKind(p.kind)?CivilCityCouncil.name(s,p.target)+(CivilCityCouncil.scheme(p.kind)?.name||'安居扩容'):CivilCityCouncil.links[p.target].name;},
  stance(code){return {support:'同意',limitedSupport:'有限支持，仍要求安排本城安居',housingFirst:'要求先安排本城安居，拒绝继续大额出料',suspended:'公用事务未授权或未续办'}[code];},
  refresh(s){const api=CivilCityCouncil,d=api.data(s),cv=CivilConurbationView,v=CivilCityView,a=n=>v.amount(n),cost=x=>v.cost(x)||'无';
    if(!d){$('#cityCouncilBody,#councilLocation').hide();return false;}this.ensure();const estuary=d.locals.estuary?.node;
    if(estuary||d.locals.bridge?.node){
      if(!$('#councilLocation').length){const box=$('<details>').attr('id','councilLocation').appendTo('#metroCitySwitch');$('<summary>').appendTo(box);$('<div>').attr({id:'councilLocations',role:'group','aria-label':'选择城市与城际协作'}).appendTo(box);}
      const current=['council','legacy'].includes(cv.selected)?'link':cv.selected;
      for(const [id,name]of Object.entries({...Object.fromEntries(api.ids(s).map(id=>[id,api.name(s,id)])),link:'城际协作'}))this.b('go_'+id,name,'#councilLocations',null,()=>{cv.select(id);$('#councilLocation').prop('open',false);$('#councilLocation > summary').trigger('focus');return false;}).attr('aria-pressed',current===id).toggleClass('selected',current===id);
      $('#metroCitySwitch > .button').hide();$('#councilLocation').show();$('#councilLocation > summary').text('查看：'+(current==='link'?'城际协作':api.name(s,current)));
    }else $('#councilLocation').hide();
    const show=['council','estuary','bridge'].includes(cv.selected);$('#cityCouncilBody').toggle(show);if(!show)return false;
    $('#cityBody').children().not('#metroCitySwitch,#cityCouncilBody').hide();$('#metroCitySwitch,#cityCouncilBody').show();const local=['estuary','bridge'].includes(cv.selected);
    $('#councilTitle').text(local?'河口市':'共同事务');this.b('back','返回城际概况','#councilNav',null,()=>{cv.select('link');return false;});
    $('#cityLaborDesk').toggle(!local);$('#cityHomesDesk').toggle(!local&&!!CivilCityHomes.data(s));$('#cityContinuityDesk').toggle(!local&&(CivilCityContinuity.available(s)||!!CivilCityContinuity.data(s)));for(const id of ['Proposal','Mandates','Growth','Freight'])$('#council'+id).toggle(!local);$('#councilNeeds').toggle(!local);
    if(cv.selected==='bridge')return CivilCityRegistryView.city(s);
    if(local){const n=estuary,o=d.locals.estuary.origin;
      CivilInterface.summary('#councilSummary',{title:'河口药务与生活',cards:[['居民',a(CivilCity.count(n))],['家庭床位',a(CivilCity.housing(s,'estuary'))],['健康',Math.floor(n.health)],['公共服务',n.stable+'秒']],brief:'河口保留战前药务与水务。临床生产消耗工具和知识，可承担共同工程药品；人口与仓库仍留在当地。',notices:v.issues(s,n),details:[['人口来源','东陆失联名册细分 '+a(o.population)+'；其后出生 '+a(n.born)+'，死亡 '+a(n.dead)+'，净迁居 '+a(CivilCityHomes.delta(s,'estuary'))],['实际岗位','诊疗 '+n.workers.medic+'、农业 '+n.workers.farmer+'、水务 '+n.workers.waterworker],['公用责任',d.offices.estuary?(d.offices.estuary.completedAt===null?'设站施工中':d.offices.estuary.enabled?'已授权':'已暂停'):'尚未登记公用站']]});
      $('#councilCurrent').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+' '+a(n.stores[k])+' · 近轮 '+CivilInterface.signed(n.economy?.flow[k]||0)).join('\n'));
      $('#councilLedger p').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：原有 '+a(o.stores[k])+' + 生产 '+a(n.budget.produced[k])+' + 收货 '+a(n.budget.received[k])+' − 消耗 '+a(n.budget.consumed[k])+' − 发货 '+a(n.budget.sent[k])+' = '+a(n.stores[k])).join('\n'));return true;
    }
    CivilCityHomesView.refresh(s);
    CivilCityContinuityView.refresh(s);
    CivilCityLaborView.refresh(s);
    const members=api.membersAt(s,s.civilization.elapsed),p=d.projects.find(x=>x.completedAt===null),building=Object.entries(d.offices).filter(([,o])=>o.completedAt===null);
    const publicBusy=api.activeLegs(s).length+api.ids(s).filter(id=>CivilCityHomes.busy(s,id)||CivilCityLabor.busy(s,id)).length;
    CivilInterface.summary('#councilSummary',{title:'各城共办，各城实付',cards:[['登记公用站',members.length+' / '+Object.keys(d.offices).length],['公共车组',publicBusy+' / '+members.length+'在途'],['已完成工程',d.projects.filter(x=>x.completedAt!==null).length],['本期剩余',api.period(s)+600-s.civilization.elapsed+'秒']],brief:'委托按已批准工程办理供料和运输。各城保留库存、供养责任与暂停权。本城供料及安居落在出发片区。',notices:building.map(([id,o])=>api.name(s,id)+'：20人设站，尚需'+o.remaining+'工时'),details:[['车辆责任','每城一组勤务车，每段4人，空返前仍占用；中转换用下一城车辆'],['公共额度','每600秒重算，只是实际物资支出上限，不增加库存；议定费另计'],['维护','各站每60秒实付 '+cost(api.serviceCost)+'，超过120秒未续办就停新执行']]});
    let current=p?this.title(s,p)+' · '+api.modes[p.mode]+'\n'+Object.entries(p.sites).map(([id,site])=>api.name(s,id)+'：'+(site.completedAt!==null?'施工完成':api.full(site)?(api.activeOffice(s,id)?'已到料，尚需 '+site.remaining+'工时':'已到料，待恢复当地委托'):'到料 '+a(api.value(site.installed))+' / '+a(api.value(site.required))+'折值；货到即安装')).join('\n'):'暂无进行中的共同工程。先看地方诉求，再议定下一项职责。';
    if(p){const holds=p.pledges.filter(q=>!api.full({required:q.required,installed:q.allocated})).map(q=>api.name(s,q.from)+'：'+(!api.activeOffice(s,q.from)?'等待续办或恢复授权':api.allowance(s,q.from)<20?'本期额度已紧，等待下期或调整限额':'按留足地方储备和车辆次序备料'));current+='\n'+[...new Set(holds)].join('\n');}
    $('#councilCurrent').text(current);
    $('#councilNeeds').text(api.ids(s).map(id=>{const r=api.request(s,id);return api.name(s,id)+' · 空床 '+a(r.beds-r.population)+' · 对外供料 '+a(r.given)+' / 已收 '+a(r.received)+'折值'+(r.due?'\n诉求：先安排本城安居；暂不再承担别城的大额份额。':'');}).join('\n'));
    const known=!!estuary;for(const key of ['housing:estuary','road:river'])$('#councilChoice_project option[value="'+key+'"]').prop({hidden:!known,disabled:!known});$('#councilChoice_project').attr('size',known?6:4);
    $('#councilChoice_city option[value=estuary]').prop({hidden:!d.offices.estuary,disabled:!d.offices.estuary});$('#councilChoice_city').attr('size',d.offices.estuary?4:3);
    const [baseKind,target]=this.project.split(':'),kind=baseKind==='housing'?this.scale:baseKind;$('#councilChoice_scale').closest('label').toggle(baseKind==='housing');const review=api.review(s,kind,target,this.mode),reason=api.reason(s,kind,target,this.mode);
    $('#councilPreview').text((api.housingKind(kind)?'完工增加'+api.beds(kind)+'床；当地'+api.builders(kind)+'人施工'+api.duration(kind)+'秒。'+(api.scheme(kind)?'新社区每800床每60秒付木4、工具0.8、药1、知识0.2；有限接纳岗位和维护班组。每城限一处。':'不增加人口，入住后的供养仍由当地承担。'):'两个端点各20人施工300秒，双方完工才通车。未通路的城市，先由两个端点地方自筹；单程以实际线路为准。')+'\n'+(review?review.stances.map(x=>api.name(s,x.city)+'：'+cost(review.allocations.filter(q=>q.from===x.city).reduce((out,q)=>{api.sum(out,q.required);return out;},{}))+' · '+this.stance(x.code)).join('\n'):'待相关城市公用站完工。')+'\n'+(reason||'提交需本城知识4；未通过的议案也会记入历史和费用。'));
    this.b('propose','提交工程议案','#councilProposalActions',reason,()=>{const [currentKind,currentTarget]=this.project.split(':');const changed=api.propose(State,currentKind==='housing'?this.scale:currentKind,currentTarget,this.mode);if(changed&&api.data(State).proposals.at(-1).accepted){$('#councilProposal').prop('open',false);$('#councilCurrent').attr('tabindex',-1).trigger('focus');}return changed;});
    const o=d.offices[this.city];$('#councilTerms').text(o?api.name(s,this.city)+' · '+(o.enabled?'已授权':'已暂停')+' · 当前'+api.quotas[o.quota].name+'\n本期已付 '+a(api.spent(s,this.city))+' / '+api.quotas[o.quota].value+'折值。选择“'+api.quotas[this.quota].name+'”上限为 '+api.quotas[this.quota].value+'；不清零本期支出。\n折值用于比较责任：木料1、工具8、药品4、知识2。改变额度或暂停/恢复各付当地知识4；不退已付物资，也不撤销旧承诺。':'先完成当地设站。');
    const changeReason=!o||o.completedAt===null?'公用站还未完工':!CivilRules.canPay({stores:api.local(s,this.city).stores},{knowledge:4})?'当地尚缺4知识':null;
    this.b('quota','采用支出限额','#councilMandateActions',changeReason|| (o?.quota===this.quota?'当前额度':null),()=>api.set(State,this.city,'quota',this.quota));
    this.b('toggle',o?.enabled?'暂停当地委托':'恢复当地委托','#councilMandateActions',changeReason,()=>api.set(State,this.city,'enabled',!api.data(State).offices[this.city].enabled));
    const remote=d.locals.estuary;$('#councilGrowthText').text(!remote?'完成一项共同工程后，可由湖滨派2人沿河普查480秒，实付 '+cost(api.surveyCost)+'。':!remote.node?'普查员尚需 '+remote.survey.remaining+'秒，人口仍在失联名册。':'河口市 '+a(CivilCity.count(remote.node))+'人已普查；公用站由当地付 '+cost(api.stationCost)+'，20人施工300秒。之后以地方自筹修通两端通路。');
    this.b('survey','沿河普查','#councilGrowthActions',api.surveyReason(s),()=>api.survey(State)).toggle(!remote&&d.projects.some(x=>x.completedAt!==null));this.b('join','河口实付设站','#councilGrowthActions',api.joinReason(s),()=>api.join(State)).toggle(!!remote?.node&&!d.offices.estuary);
    CivilCityRegistryView.growth(s);
    const shipments=d.shipments.filter(x=>x.deliveredAt===null||x.legs.some(l=>l.finishedAt===null));
    $('#councilFreight p').text(shipments.length?shipments.map(x=>{const last=x.legs.at(-1),held=last.deliveredAt!==null&&x.deliveredAt===null;return '第'+x.id+'批 · '+api.name(s,x.source)+' → '+api.name(s,x.target)+'\n'+cost(x.cargo)+' · '+x.path.ids.map(id=>api.name(s,id)).join(' → ')+'\n'+(x.deliveredAt!==null?'材料已到场，车辆仍在空返':held?'寄存在'+api.name(s,last.to)+'，'+(api.legReason(s,last.to,x.path.legs[x.legs.length].travel)||'等待下次接力发运'):api.name(s,last.from)+'车辆载货，'+last.remaining+'秒到站');}).join('\n\n'):'当前没有公共在途。中转寄存不进入中转城可用库存。');
    $('#councilLedger p').text('近期待办结果\n'+d.proposals.slice(-5).map(x=>this.title(s,x)+' · '+api.modes[x.mode]+' · '+(x.accepted?'通过':'未通过：'+x.stances.filter(r=>['suspended','housingFirst'].includes(r.code)).map(r=>api.name(s,r.city)+' '+this.stance(r.code)).join('；'))).join('\n')+'\n\n最近实付\n'+d.receipts.slice(-10).map(e=>api.name(s,e.city)+' · '+({service:'续办',policy:'授权议定',meeting:'议案',cargo:'供料发出',localMaterials:'本地安装',leg:'分段旅费',homesPolicy:'社区议定',homeMaintenance:'社区维护',movePack:'途中口粮',moveFee:'迁居车费',continuityPolicy:'岗位委托',continuityService:'岗位续办',continuityEnroll:'开班教具',continuityLesson:'岗位课程',continuityInvite:'跨城招工',laborRecognition:'班组资格互认',laborBuild:'劳务工位',laborPolicy:'劳务授权',laborTravel:'通勤车费',laborPack:'封存旅粮',laborEscrow:'封存工资',laborInput:'劳务生产',laborMeals:'驻班口粮',laborLodging:'临住整备',laborLodgingService:'临住维护'}[e.kind])+' · '+cost(e.paid)).join('\n')+'\n\n'+d.history.slice(-5).map(e=>'重建'+Math.floor(e.at/600)+'年：'+e.text).join('\n'));
    return true;
  }
};
