/* MPL-2.0 — A second city inside the existing ADR location. No nation menus. */
var CivilConurbationView={
  selected:'home',section:'overview',depot:'yards',mode:'provisions',share:'equal',built:false,lastContract:null,
  reset(){if(typeof CivilDomainView!=='undefined')CivilDomainView.reset();this.selected='home';this.section='overview';this.depot='yards';this.mode='provisions';this.share='equal';this.built=false;this.lastContract=null;if(typeof CivilCityNetworkView!=='undefined')CivilCityNetworkView.reset();if(typeof CivilCityCouncilView!=='undefined')CivilCityCouncilView.reset();},
  select(id){this.selected=id;CivilCityView.refresh(State);CivilCityView.module.body.scrollTop(0);},
  b(id,label,host,reason,action){return CivilCityView.button('metroCity_'+id,label,host,reason,action);},
  ensure(){
    if(this.built&&$('#metroCitySwitch').length)return;this.built=true;
    $('<div>').attr({id:'metroCitySwitch',role:'group','aria-label':'选择城市与城际协作'}).prependTo('#cityBody');
    $('<div>').attr('id','metroCitySurvey').insertBefore('#cityViews');$('<p>').appendTo('#metroCitySurvey');$('<div>').appendTo('#metroCitySurvey');
    const body=$('<div>').attr('id','metroCityBody').appendTo('#cityBody');$('<h3>').attr('id','metroCityTitle').appendTo(body);$('<p>').attr('id','metroCityBrief').appendTo(body);
    $('<div>').attr({id:'metroCityTabs',role:'group','aria-label':'湖滨市信息分类'}).appendTo(body);
    for(const id of ['overview','production','assets','transport']){const section=$('<div>').attr('id','metroCitySection_'+id).appendTo(body);$('<div>').attr('id','metroCitySummary_'+id).appendTo(section);$('<p>').attr('id','metroCityText_'+id).appendTo(section);}
    const transport=$('#metroCitySection_transport');
    this.choice('depot','本城出发仓',Object.fromEntries(Object.entries(CivilCityContent.wards).map(([id,c])=>[id,c.name])),transport);
    const terms=$('<details>').attr('id','metroCityAgreement').addClass('civil-details').appendTo(transport).append($('<summary>').text('协约与公共开支'));
    this.choice('mode','有限协作',Object.fromEntries(Object.entries(CivilConurbation.modes).map(([id,c])=>[id,c.name])),terms);
    this.choice('share','后续公共开支',Object.fromEntries(Object.entries(CivilConurbation.shares).map(([id,c])=>[id,c.name])),terms);
    $('<p>').attr('id','metroCityTerms').appendTo(terms);$('<div>').attr('id','metroCityAgreementActions').appendTo(terms);$('<div>').attr('id','metroCityActions').appendTo(transport);
    $('<details>').attr('id','metroCityLedger').addClass('civil-details').appendTo(transport).append($('<summary>').text('运单与公共开支')).append('<p>');
    $('<details>').attr('id','metroCityHistory').addClass('civil-details').appendTo(body).append($('<summary>').text('两城共同记录')).append('<ol>');
  },
  choice(id,label,options,host){
    const l=$('<label>').addClass('city-setting').attr('id','metroCitySetting_'+id).appendTo(host);$('<span>').text(label).appendTo(l);
    const select=$('<select>').attr({id:'metroCityChoice_'+id,size:Object.keys(options).length,'aria-label':label}).appendTo(l);
    for(const [key,name]of Object.entries(options))$('<option>').val(key).text(name).appendTo(select);
    select.val(this[id]).on('change',()=>{this[id]=select.val();CivilCityView.refresh(State);}).on('keydown keyup',e=>e.stopPropagation());
  },
  locations(s){
    const d=CivilConurbation.data(s),choices={};
    if(CivilDomain.available(s))choices.domain=Number.isSafeInteger(s.civilization.polity?.foundedAt)?'地区与国家概况':'地区与共同责任';
    choices.home='炉火城';if(d?.node)choices.lake='湖滨市';
    if(CivilCityNetwork.data(s)?.node)choices.ridge='矿岭市';
    for(const [id,record]of Object.entries(s.civilization.cityCouncil?.locals||{}))if(record.node)choices[id]=CivilCityCouncil.name(s,id);
    if(d?.node)choices.link='城际协作';
    if(s.civilization.cityCouncil)choices.council='共同事务';
    if(this.selected==='legacy')choices.legacy='湖滨协约';
    let select=$('#civilPlaceSelect');
    if(!select.length){const label=$('<label>').addClass('civil-place-choice').appendTo('#metroCitySwitch');$('<span>').text('查看范围').appendTo(label);select=$('<select>').attr({id:'civilPlaceSelect','aria-label':'查看城市、城际协作或地区概况'}).appendTo(label).on('change',()=>this.select(select.val())).on('keydown',function(e){
      e.stopPropagation();const move={ArrowDown:1,ArrowUp:-1,Home:-Infinity,End:Infinity}[e.key];if(move===undefined||e.altKey||e.ctrlKey||e.metaKey)return;
      e.preventDefault();const next=Math.max(0,Math.min(this.options.length-1,move===-Infinity?0:move===Infinity?this.options.length-1:this.selectedIndex+move));
      if(next!==this.selectedIndex){this.selectedIndex=next;$(this).trigger('change');}
    }).on('keyup',e=>e.stopPropagation());}
    const signature=JSON.stringify(choices);if(select.attr('data-choices')!==signature){select.empty();for(const [id,label]of Object.entries(choices))$('<option>').val(id).text(label).appendTo(select);select.attr('data-choices',signature);}
    select.val(this.selected);
    $('#metroCitySwitch').toggle(Object.keys(choices).length>1);
  },
  refresh(s){
    if(!CivilConurbation.available(s))return false;this.ensure();
    this.locations(s);if(CivilDomainView.refresh(s))return true;
    const d=CivilConurbation.data(s),v=CivilCityView,a=n=>v.amount(n),cost=x=>v.cost(x);
    $('#metroCitySwitch').toggle(!!d?.node);$('#metroCitySurvey').toggle(!d?.node);
    $('#metroCitySurvey > p').text(d?.survey?'湖岸普查在途 · 尚余'+d.survey.remaining+'秒；两名普查员暂离旧厂街区工位，沿途旅粮已付清。':'旧测绘图上标着一条顺湖岸延伸的公路。先摸清另一座城市的人口与家底，再商议有限协作。');
    this.b('survey','沿湖岸普查','#metroCitySurvey > div',CivilConurbation.surveyReason(s),()=>CivilConurbation.survey(State)).toggle(!d);
    if(typeof CivilCityCouncilView!=='undefined'&&CivilCityCouncilView.refresh(s))return true;
    if(typeof CivilCityNetworkView!=='undefined'&&CivilCityNetworkView.refresh(s))return true;
    const away=!!d?.node&&this.selected!=='home';$('#cityBody').children().not('#civilGuide,#metroCitySwitch,#metroCityBody,#cityCouncilBody,#domainBody').toggle(!away);$('#metroCityBody').toggle(away);
    if(!away){$('#cityNetworkBody').hide();$('#metroCitySurvey').toggle(!d?.node&&CivilCityView.view==='overview');return false;}
    const n=d.node,p=CivilCity.count(n),e=n.economy,section=['link','legacy'].includes(this.selected)?'transport':this.section;
    $('#metroCityTitle').text(['link','legacy'].includes(this.selected)?(CivilCityNetwork.data(s)?'湖滨协约':'两城协作'): '湖滨市');
    $('#metroCityBrief').text(['link','legacy'].includes(this.selected)?(d.clusterAt===null?'通路与协约仅限于共担纸面约定的事务。':'两城协作网已成型。')+' 炉火城 '+a(CivilCity.population(s))+'人；湖滨市 '+a(p)+'人，两地各自安居、各自供养。':'靠湖岸沃土与水务撑起的独立城市。当地制器工坊规模有限，从外头运进工具可腾出更多农耕人手；若外运中断，也会退回本地自给制器。');
    $('#metroCityTabs').toggle(this.selected==='lake');
    for(const [id,name]of Object.entries({overview:'概况',production:'生产与预算',assets:'地方资产'}))this.b('tab_'+id,name,'#metroCityTabs',null,()=>{this.section=id;v.refresh(State);return false;}).attr('aria-pressed',section===id).toggleClass('selected',section===id);
    for(const id of ['overview','production','assets','transport'])$('#metroCitySection_'+id).toggle(section===id);
    CivilInterface.summary('#metroCitySummary_overview',{title:'本地服务',cards:[['当地居民',a(p)],['健康',Math.floor(n.health)+' / 100'],['本地空床',a(CivilCity.housing(s,'lake')-p)],['服务稳定',n.stable>=120?'已稳定（'+n.stable+'秒）':n.stable+' / 120秒']],brief:'普查只是探明未知地界；通商协作亦不改变两地管辖权与居民住处。',notices:v.issues(s,n),details:[['人口变化','普查建档时 '+a(d.origin.population)+'；此后出生 '+a(n.born)+'，死亡 '+a(n.dead)+'，净迁居 '+a(CivilCityHomes.delta(s,'lake'))],['公共行政',CivilConurbation.officeReady(s)?'本地公署在职运转，按期支取口粮、木料与记录开支':'公署人员到龄荣休，正候备齐交接物资'],['职责接续','已完成 '+d.office.records.length+' 次实付交接；历任办事员皆出自当地在册适龄人口'] ]});
    $('#metroCityText_overview').text('成年劳力 '+a(CivilCity.workforce(n))+'；孩童 '+a(CivilPopulation.children(n.cohorts))+'；变异居民 '+a(CivilPopulation.count(n.cohorts.filter(c=>c.identity==='mutant')))+'。随车在途的司机仍记在本市户籍名册内，出车期间暂离本地工位并停领家中口粮。');
    const jobs={farmer:'农业',medic:'诊疗',teacher:'教学',smith:'制器',gatherer:'木料',salvager:'回收',waterworker:'水务',driver:'本地运输',publiccourier:'公共接力',publicclerk:'共同事务',regionalcourier:'两区驾驶',regionalclerk:'两区联络',regionclerk:'地区联络',regioncourier:'地区驾驶',steward:'生产办事',publicbuilder:'公共施工',homekeeper:'社区维护',settler:'合作岗位',jobbuilder:'接续施工',jobclerk:'就业办事',joblearner:'岗位学员',jobtutor:'岗位教员',wageworker:'轮班劳务',wagebuilder:'劳务工位安装',courier:'城际驾驶',routebuilder:'道路施工',localbuilder:'工坊施工',clerk:'公署'};
    $('#metroCitySummary_production').text(Object.entries(n.workers).filter(([,v])=>v>0).map(([j,v])=>(jobs[j]||j)+' '+a(v)).join(' · '));
    $('#metroCityText_production').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+' '+a(n.stores[k])+'；近轮 '+CivilInterface.signed(e?.flow[k]||0)).join('\n')+'\n当前在岗制器 '+(e?.worked.smith||0)+' 人，工坊上限为'+(d.workshop?.completedAt!==null&&d.workshop?160:80)+'个工位。若外头工具断供，将自动抽人恢复本地制器，同时守住农田、诊所与水务底线。');
    CivilInterface.summary('#metroCitySummary_assets',{title:'地方资产账',cards:[['家庭住房',a(d.origin.assets.familyBeds)+'床'],['公共水务',d.origin.assets.publicWaterworks+'处'],['本地工坊',(d.workshop?.completedAt!==null&&d.workshop?160:d.origin.assets.workshopSlots)+'岗位']],brief:'当地房舍不归入炉火城名下。湖滨公仓仅支取已议定的共同开支，即便日后解约，家底照旧归湖滨所有。',notices:[],details:[['家底来源','皆为湖岸街坊在失联年间自行维系的房舍、田亩与管网；失联年间按年度定额入账，普查建档后改按实有工位与公仓存量逐轮结算'],['人口来源','自北陆未普查底账核实细分 '+a(d.origin.population)+'人；核实建档不改变全球总人数'],['施工责任',d.route?'两城各自支取路材，并自派人手整修各自管段':'跨城道路尚未合修']]});
    this.b('workshopTimber','木构扩建工坊','#metroCitySection_assets',CivilConurbation.workshopReason(s,'timber'),()=>CivilConurbation.workshop(State,'timber')).toggle(!d.workshop).attr('title','湖滨公仓支取：'+cost(CivilConurbation.workshopCosts.timber));
    this.b('workshopIron','钢架扩建工坊','#metroCitySection_assets',CivilConurbation.workshopReason(s,'iron'),()=>CivilConurbation.workshop(State,'iron')).toggle(!d.workshop&&!!s.civilization.tech.mechanics).attr('title','湖滨公仓支取：'+cost(CivilConurbation.workshopCosts.iron));
    $('#metroCityText_assets').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：建档期初 '+a(d.origin.stores[k])+' + 生产 '+a(n.budget.produced[k])+' + 收货 '+a(n.budget.received[k])+' − 消耗 '+a(n.budget.consumed[k])+' − 发货 '+a(n.budget.sent[k])+' = '+a(n.stores[k])).join('\n')+(d.workshop?'\n地方工坊：'+(d.workshop.completedAt===null?'正在施工，尚需 '+d.workshop.remaining+'工时':'已落成；当地工位上限扩充，未凭空添丁。'):''));
    const r=d.route,pending=CivilConurbation.active(s),m=CivilConurbation.modes[this.mode];
    $('#metroCityText_transport').text(!r?'两城各出 '+cost(CivilConurbation.construction)+'，各派20名本地施工者动工240秒。本城出发仓一经选定，后续来往物资均从该仓实收实支。':r.phase==='building'?'两城道路施工中 · 尚需 '+r.remaining+' 工时。若当地断粮或人手短缺将暂停施工。':(d.contract?CivilConurbation.modes[d.contract].name+' · '+CivilConurbation.shares[d.share].name+'。':'')+'出发仓：'+CivilCity.config(r.depot).name+'；路况 '+r.condition+' / 100。'+(pending?pending.status==='outbound'?(!!pending.reliefVersion?'修复物资在途，':'双向货单在途，')+pending.remaining+'秒后抵站。':pending.status==='recalled'?'载货原车折返中，'+pending.remaining+'秒后归仓。':'已交割卸货，原车返程尚余 '+pending.remaining+'秒。':CivilConurbation.dispatchReason(s)||'条件齐备，将于下一轮调度发车。'));
    if(s.civilization.polishVersion===1&&r?.phase==='ready')$('#metroCityText_transport').append(document.createTextNode(' 电动轨道发车需服务所正常供电且有调度员在岗；新发运单单程缩至45秒，已在途的旧运单维持原耗时。湖滨缺工具时可接收补工具货单，照付运费并优先保住当地粮药。'));
    $('#metroCityAgreement').toggle(r?.phase==='ready');if(r?.phase==='ready'&&this.lastContract!==d.contract){$('#metroCityAgreement').prop('open',!d.contract);this.lastContract=d.contract;}if(r?.phase==='ready'&&!d.contract)$('#metroCityAgreement').prop('open',true);
    $('#metroCitySetting_depot').toggle(!r);$('#metroCitySetting_mode').toggle(r?.phase==='ready'&&!d.contract);$('#metroCitySetting_share').toggle(!!d.contract);
    const restockReady=CivilCityGovernance.office(s,'lake')?.mode==='standard'||d.contract==='restock';$('#metroCityChoice_mode option[value=restock]').prop({hidden:!restockReady,disabled:!restockReady});$('#metroCityChoice_mode').attr('size',restockReady?3:2);
    const active=d.contract?CivilConurbation.modes[d.contract]:m;
    $('#metroCityTerms').addClass('city-net-lines').toggle(r?.phase==='ready').text(active.name+'单批上限：本城最多发 '+cost(active.out)+'；湖滨市最多发 '+cost(active.back)+'。按双方实际缺口作等值交换（折算尺度：工具8、药品4、铁料5、粮食与废料各1）；现货交割，概不赊欠。两城各派6名司机，单程'+CivilConurbation.travelTime(s)+'秒，双向载重各1600；沿途旅粮各备'+a(6*.12*CivilConurbation.travelTime(s)*2/10)+'。每轮另支取运行耗材 '+cost(CivilConurbation.running)+'，每5轮支取道路检修 '+cost(CivilConurbation.maintenance)+'，按“'+CivilConurbation.shares[d.share].name+'”分担。两城均须先留足6轮口粮与4轮医药，不足则停发。');
    if((d.contract||this.mode)==='restock')$('#metroCityTerms').append(document.createTextNode('\n\n“工序补库”会优先将湖滨市的铁料缺口补至600储备线，单趟最多运240铁；本城出发仓备料目标设为300铁、保底留60铁，并会优先抽调持证技术工排满冶炼班，相应压缩制器工位（仍受资格人数、炉位上限与本地供养约束）。交易照旧按双方真实缺口等值互换，不会凭空扩充车组、库存或运行额度。改签协约需两城各出知识12；若湖滨改回其他生产章程，将自动停发新的补库单，已在途货单照常结清。'));
    if(!$('#metroCitySupply').length)$('<p>').attr('id','metroCitySupply').addClass('city-net-lines').insertAfter('#metroCityText_transport');const supply=CivilConurbation.supplyReport(s);$('#metroCitySupply').toggle(CivilCityGovernance.office(s,'lake')?.mode==='standard'||d.contract==='restock').text(supply?'湖滨铁料账 · 实存 '+a(supply.stock)+'；近600秒实耗铁 '+a(supply.used)+' / 实到货 '+a(supply.delivered)+'。\n现行协约单批最多运 '+supply.cap+'铁，往返至少需'+supply.roundTrip+'秒；未抵仓的在途铁料无法上机床。若铁料不济，可退回循环修造，或待原车归仓后改签“工序补库”。':'');
    this.b('build','共同修路','#metroCityActions',CivilConurbation.buildReason(s,this.depot),()=>CivilConurbation.build(State,this.depot)).toggle(!r);
    this.b('sign','议定协作','#metroCityAgreementActions',CivilConurbation.signReason(s,this.mode),()=>CivilConurbation.sign(State,this.mode)).toggle(r?.phase==='ready'&&!d.contract);
    this.b('share','议定分担','#metroCityAgreementActions',!d.contract?'先议定协作方式':this.share===d.share?'当前分担方式':!CivilRules.canPay({stores:CivilCity.node(s,r.depot).stores},{knowledge:6})?'出发仓尚缺6点知识':null,()=>CivilConurbation.setShare(State,this.share)).toggle(!!d.contract);
    this.b('pause',d.suspended?'恢复发运':'暂停发运','#metroCityActions',null,()=>CivilConurbation.suspend(State,!CivilConurbation.data(State).suspended)).toggle(!!d.contract);
    this.b('relief','送一批修复物资','#metroCityActions',CivilConurbation.reliefReason(s),()=>CivilConurbation.relief(State)).toggle(s.civilization.polishVersion===1&&!!d.contract&&!d.workshop).attr('title','由出发仓无偿拨出 '+cost(CivilConurbation.reliefLoad(d.contract))+' 并包揽全部运费；占用同一组车与六名本地司机；不要求回程货物，亦不记作湖滨欠债。');
    this.b('end','结束协约','#metroCityAgreementActions',null,()=>CivilConurbation.end(State)).toggle(!!d.contract);
    const repairBlocked=r?.phase==='ready'&&r.condition<20;this.b('repair','支付道路检修','#metroCityActions',CivilConurbation.repairReason(s),()=>CivilConurbation.repair(State)).toggle(!!repairBlocked);
    $('#metroCityLedger p').text('累计抵站 '+d.trips.filter(x=>x.deliveredAt!==null).length+' 批；原车折返退回 '+d.trips.filter(x=>x.status==='returned').length+' 批。\n'+d.trips.slice(-8).map(x=>'运单 '+x.id+' · '+(!!x.reliefVersion?'无偿修复物资':CivilConurbation.modes[x.mode].name)+' · '+({outbound:'在途',returning:'空车返程',complete:'结清',recalled:'载货折返',returned:'退回结清'}[x.status])+' · 发 '+cost(x.out)+' / 收 '+cost(x.back)+' · '+CivilConurbation.shares[x.share].name+' · 运行实支：本城 '+cost(x.fees.home)+' / 湖滨 '+cost(x.fees.lake)).join('\n')+'\n道路检修 '+d.payments.length+' 次；本城累计出料 '+cost(d.payments.reduce((a,x)=>CivilConurbation.plus(a,x.home),{}))+'，湖滨累计出料 '+cost(d.payments.reduce((a,x)=>CivilConurbation.plus(a,x.lake),{}))+'。');
    const history=d.history.slice(-18),ol=$('#metroCityHistory ol');if(ol.children().length!==history.length){ol.empty();for(const h of history)$('<li>').appendTo(ol);}history.forEach((h,i)=>ol.children().eq(i).text('重建 '+Math.floor(h.at/600)+'年：'+h.text));
    $('#cityNetworkBody').hide();
    if(!$('#metroCityNetworkOffer').length)$('<p>').attr('id','metroCityNetworkOffer').insertBefore('#metroCityActions');
    $('#metroCityNetworkOffer').toggle(!!d.clusterAt&&!CivilCityNetwork.data(s)).text('联合调度所：两城各出 '+cost(CivilCityNetwork.charterCost)+'。将本城既有的一组车辆并入共同调度，两地日常供养照旧独立。');
    this.b('network','筹设联合调度所','#metroCityActions',CivilCityNetwork.formReason(s),()=>CivilCityNetwork.form(State)).toggle(!!d.clusterAt&&!CivilCityNetwork.data(s));
    return true;
  }
};
