/* MPL-2.0 — A second city inside the existing ADR location. No nation menus. */
var CivilConurbationView={
  selected:'home',section:'overview',depot:'yards',mode:'provisions',share:'equal',built:false,lastContract:null,
  reset(){this.selected='home';this.section='overview';this.depot='yards';this.mode='provisions';this.share='equal';this.built=false;this.lastContract=null;if(typeof CivilCityNetworkView!=='undefined')CivilCityNetworkView.reset();if(typeof CivilCityCouncilView!=='undefined')CivilCityCouncilView.reset();},
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
  refresh(s){
    if(!CivilConurbation.available(s))return false;this.ensure();
    const d=CivilConurbation.data(s),v=CivilCityView,a=n=>v.amount(n),cost=x=>v.cost(x);
    $('#metroCitySwitch').toggle(!!d?.node);$('#metroCitySurvey').toggle(!d?.node);
    $('#metroCitySurvey > p').text(d?.survey?'湖岸普查在途 · '+d.survey.remaining+'秒；两名普查员离开旧厂岗位，旅粮已实付。':'旧测绘记录通往湖岸的公路。先了解另一座城市的人口与地方资产，再商议有限合作。');
    this.b('survey','沿湖岸普查','#metroCitySurvey > div',CivilConurbation.surveyReason(s),()=>CivilConurbation.survey(State)).toggle(!d);
    for(const [id,name]of Object.entries({home:'炉火城',lake:'湖滨市',link:'城际协作'}))this.b('select_'+id,name,'#metroCitySwitch',null,()=>{this.select(id);return false;}).attr('aria-pressed',this.selected===id||id==='link'&&['legacy','council'].includes(this.selected)).toggleClass('selected',this.selected===id||id==='link'&&['legacy','council'].includes(this.selected));
    if(typeof CivilCityCouncilView!=='undefined'&&CivilCityCouncilView.refresh(s))return true;
    if(typeof CivilCityNetworkView!=='undefined'&&CivilCityNetworkView.refresh(s))return true;
    const away=!!d?.node&&this.selected!=='home';$('#cityBody').children().not('#metroCitySwitch,#metroCityBody,#cityCouncilBody').toggle(!away);$('#metroCityBody').toggle(away);
    if(!away){$('#cityNetworkBody').hide();$('#metroCitySurvey').toggle(!d?.node&&CivilCityView.view==='overview');return false;}
    const n=d.node,p=CivilCity.count(n),e=n.economy,section=['link','legacy'].includes(this.selected)?'transport':this.section;
    $('#metroCityTitle').text(['link','legacy'].includes(this.selected)?(CivilCityNetwork.data(s)?'湖滨协约':'两城协作'): '湖滨市');
    $('#metroCityBrief').text(['link','legacy'].includes(this.selected)?(d.clusterAt===null?'道路与协约只共同承担约定职责。':'两城协作网已成立。')+' 炉火城 '+a(CivilCity.population(s))+'人；湖滨市 '+a(p)+'人，各自居住和供养。':'湖岸农田与水务支撑的独立城市。工具工坊规模有限，互市可以释放人手；停运时恢复本地制器。');
    $('#metroCityTabs').toggle(this.selected==='lake');
    for(const [id,name]of Object.entries({overview:'概况',production:'生产与预算',assets:'地方资产'}))this.b('tab_'+id,name,'#metroCityTabs',null,()=>{this.section=id;v.refresh(State);return false;}).attr('aria-pressed',section===id).toggleClass('selected',section===id);
    for(const id of ['overview','production','assets','transport'])$('#metroCitySection_'+id).toggle(section===id);
    CivilInterface.summary('#metroCitySummary_overview',{title:'本地服务',cards:[['当地居民',a(p)],['健康',Math.floor(n.health)+' / 100'],['本地空床',a(CivilCity.housing(s,'lake')-p)],['服务稳定',n.stable>=120?'已稳定（'+n.stable+'秒）':n.stable+' / 120秒']],brief:'普查改变已知范围；合作不改变管辖与住所。',notices:v.issues(s,n),details:[['人口变化','普查时 '+a(d.origin.population)+'；其后出生 '+a(n.born)+'，死亡 '+a(n.dead)+'，净迁居 '+a(CivilCityHomes.delta(s,'lake'))],['公共行政',CivilConurbation.officeReady(s)?'本地公署在职，持续付出粮食、木料与记录开支':'公署人员退休，待备齐交接物资'],['职责接续','已实付交接 '+d.office.records.length+' 次；每名任职者都属于现有年龄群体'] ]});
    $('#metroCityText_overview').text('成年劳力 '+a(CivilCity.workforce(n))+'；儿童 '+a(CivilPopulation.children(n.cohorts))+'；变异居民 '+a(CivilPopulation.count(n.cohorts.filter(c=>c.identity==='mutant')))+'。在途驾驶员仍列于本市居民名册，已从当地生产和口粮中扣除。');
    const jobs={farmer:'农业',medic:'诊疗',teacher:'教学',smith:'制器',gatherer:'木料',salvager:'回收',waterworker:'水务',driver:'本地运输',publiccourier:'公共接力',publicclerk:'共同事务',publicbuilder:'公共施工',homekeeper:'社区维护',settler:'接纳合作岗位',courier:'城际驾驶',routebuilder:'道路施工',localbuilder:'工坊施工',clerk:'公署'};
    $('#metroCitySummary_production').text(Object.entries(n.workers).filter(([,v])=>v>0).map(([j,v])=>(jobs[j]||j)+' '+a(v)).join(' · '));
    $('#metroCityText_production').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+' '+a(n.stores[k])+'；近轮 '+CivilInterface.signed(e?.flow[k]||0)).join('\n')+'\n实际制器 '+(e?.worked.smith||0)+' 人，最多'+(d.workshop?.completedAt!==null&&d.workshop?160:80)+'个工坊岗位。工具进口中断时恢复自给，保留粮食、诊疗与水务岗位。');
    CivilInterface.summary('#metroCitySummary_assets',{title:'地方资产账',cards:[['家庭住房',a(d.origin.assets.familyBeds)+'床'],['公共水务',d.origin.assets.publicWaterworks+'处'],['本地工坊',(d.workshop?.completedAt!==null&&d.workshop?160:d.origin.assets.workshopSlots)+'岗位']],brief:'住房不归炉火城公仓。地方公仓只承担已议定的公共职责，协约结束后继续归当地。',notices:[],details:[['来源','湖岸居民在失联年代维持的住房、农田和设施；普查前使用年度粗算，普查后按实际岗位与库存运行'],['人口来源','从北陆未普查名册细分 '+a(d.origin.population)+'人；细分时全球总人数不变'],['施工责任',d.route?'两城各自支付路材并承担当地施工人手':'跨城道路尚未共同修建']]});
    this.b('workshopTimber','木构扩建工坊','#metroCitySection_assets',CivilConurbation.workshopReason(s,'timber'),()=>CivilConurbation.workshop(State,'timber')).toggle(!d.workshop).attr('title','湖滨公仓实付：'+cost(CivilConurbation.workshopCosts.timber));
    this.b('workshopIron','钢架扩建工坊','#metroCitySection_assets',CivilConurbation.workshopReason(s,'iron'),()=>CivilConurbation.workshop(State,'iron')).toggle(!d.workshop&&!!s.civilization.tech.mechanics).attr('title','湖滨公仓实付：'+cost(CivilConurbation.workshopCosts.iron));
    $('#metroCityText_assets').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：普查公仓 '+a(d.origin.stores[k])+' + 生产 '+a(n.budget.produced[k])+' + 收货 '+a(n.budget.received[k])+' − 消耗 '+a(n.budget.consumed[k])+' − 发货 '+a(n.budget.sent[k])+' = '+a(n.stores[k])).join('\n')+(d.workshop?'\n地方工坊：'+(d.workshop.completedAt===null?'实付施工中，尚需 '+d.workshop.remaining+'工时':'已建成；本地岗位增加，未新增人口。'):''));
    const r=d.route,pending=CivilConurbation.active(s),m=CivilConurbation.modes[this.mode];
    $('#metroCityText_transport').text(!r?'双方各付 '+cost(CivilConurbation.construction)+'，各安排20名本地建设者施工240秒。出发仓选定后，物资始终从该仓实收实付。':r.phase==='building'?'双方道路施工 · 尚需 '+r.remaining+' 工时。当地断粮或人手不足会停工。':(d.contract?CivilConurbation.modes[d.contract].name+' · '+CivilConurbation.shares[d.share].name+'。':'')+'出发仓：'+CivilCity.config(r.depot).name+'；路况 '+r.condition+' / 100。'+(pending?pending.status==='outbound'?'双向实物在途，'+pending.remaining+'秒抵达。':pending.status==='recalled'?'载货原车折返，'+pending.remaining+'秒后归仓。':'已交付，原车返程 '+pending.remaining+'秒。':CivilConurbation.dispatchReason(s)||'条件具备，将于下次调度发运。'));
    $('#metroCityAgreement').toggle(r?.phase==='ready');if(r?.phase==='ready'&&this.lastContract!==d.contract){$('#metroCityAgreement').prop('open',!d.contract);this.lastContract=d.contract;}if(r?.phase==='ready'&&!d.contract)$('#metroCityAgreement').prop('open',true);
    $('#metroCitySetting_depot').toggle(!r);$('#metroCitySetting_mode').toggle(r?.phase==='ready'&&!d.contract);$('#metroCitySetting_share').toggle(!!d.contract);
    const active=d.contract?CivilConurbation.modes[d.contract]:m;
    $('#metroCityTerms').toggle(r?.phase==='ready').text(active.name+'限额：本城最多付 '+cost(active.out)+'；湖滨市最多付 '+cost(active.back)+'。按实际缺口等值交换：工具8、药品4、铁料5、粮食与废料各1；按实物结清，不赊账。双方各6名驾驶员，单程180秒，双向各1600载重；旅粮各25.92。每轮另付 '+cost(CivilConurbation.running)+'，每5轮检修 '+cost(CivilConurbation.maintenance)+'，按'+CivilConurbation.shares[d.share].name+'分担。地方至少留6轮口粮、4轮药品；未满足就停发。');
    this.b('build','共同修路','#metroCityActions',CivilConurbation.buildReason(s,this.depot),()=>CivilConurbation.build(State,this.depot)).toggle(!r);
    this.b('sign','议定协作','#metroCityAgreementActions',CivilConurbation.signReason(s,this.mode),()=>CivilConurbation.sign(State,this.mode)).toggle(r?.phase==='ready'&&!d.contract);
    this.b('share','议定分担','#metroCityAgreementActions',!d.contract?'先议定协作':this.share===d.share?'当前分担方式':!CivilRules.canPay({stores:CivilCity.node(s,r.depot).stores},{knowledge:6})?'出发仓尚缺6知识':null,()=>CivilConurbation.setShare(State,this.share)).toggle(!!d.contract);
    this.b('pause',d.suspended?'恢复发运':'暂停发运','#metroCityActions',null,()=>CivilConurbation.suspend(State,!CivilConurbation.data(State).suspended)).toggle(!!d.contract);
    this.b('end','结束协约','#metroCityAgreementActions',null,()=>CivilConurbation.end(State)).toggle(!!d.contract);
    const repairBlocked=r?.phase==='ready'&&r.condition<20;this.b('repair','支付道路检修','#metroCityActions',CivilConurbation.repairReason(s),()=>CivilConurbation.repair(State)).toggle(!!repairBlocked);
    $('#metroCityLedger p').text('已到货 '+d.trips.filter(x=>x.deliveredAt!==null).length+' 批；载货退回 '+d.trips.filter(x=>x.status==='returned').length+' 批。\n'+d.trips.slice(-8).map(x=>'运单 '+x.id+' · '+CivilConurbation.modes[x.mode].name+' · '+({outbound:'在途',returning:'空车返程',complete:'结清',recalled:'载货折返',returned:'退回结清'}[x.status])+' · 发 '+cost(x.out)+' / 收 '+cost(x.back)+' · '+CivilConurbation.shares[x.share].name+' · 本城运行实付 '+cost(x.fees.home)+' / 湖滨 '+cost(x.fees.lake)).join('\n')+'\n道路检修 '+d.payments.length+' 次；本城累计 '+cost(d.payments.reduce((a,x)=>CivilConurbation.plus(a,x.home),{}))+'，湖滨累计 '+cost(d.payments.reduce((a,x)=>CivilConurbation.plus(a,x.lake),{}))+'。');
    const history=d.history.slice(-18),ol=$('#metroCityHistory ol');if(ol.children().length!==history.length){ol.empty();for(const h of history)$('<li>').appendTo(ol);}history.forEach((h,i)=>ol.children().eq(i).text('重建 '+Math.floor(h.at/600)+'年：'+h.text));
    $('#cityNetworkBody').hide();
    if(!$('#metroCityNetworkOffer').length)$('<p>').attr('id','metroCityNetworkOffer').insertBefore('#metroCityActions');
    $('#metroCityNetworkOffer').toggle(!!d.clusterAt&&!CivilCityNetwork.data(s)).text('联合调度所：两城各付 '+cost(CivilCityNetwork.charterCost)+'。既有一组本城车辆共同调度，各地仍独立供养。');
    this.b('network','筹设联合调度所','#metroCityActions',CivilCityNetwork.formReason(s),()=>CivilCityNetwork.form(State)).toggle(!!d.clusterAt&&!CivilCityNetwork.data(s));
    return true;
  }
};
