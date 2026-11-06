/* MPL-2.0 — Three cities, one existing ADR location; reveal only funded duties. */
var CivilCityNetworkView={
  section:'overview',budgetCity:'home',budgetValue:'regular',priority:'balanced',method:'timber',built:false,
  reset(){this.section='overview';this.budgetCity='home';this.budgetValue='regular';this.priority='balanced';this.method='timber';this.built=false;},
  b(id,label,host,reason,fn){return CivilCityView.button('cityNet_'+id,label,host,reason,fn);},
  choice(id,label,options,host){const l=$('<label>').addClass('city-setting').attr('id','cityNetSetting_'+id).appendTo(host);$('<span>').text(label).appendTo(l);const el=$('<select>').attr({id:'cityNetChoice_'+id,size:Object.keys(options).length,'aria-label':label}).appendTo(l);for(const [value,text]of Object.entries(options))$('<option>').val(value).text(text).appendTo(el);el.val(this[id]).on('change',()=>{this[id]=el.val();CivilCityView.refresh(State);}).on('keydown keyup',e=>e.stopPropagation());},
  ensure(){if(this.built&&$('#cityNetworkBody').length)return;this.built=true;
    const body=$('<div>').attr('id','cityNetworkBody').appendTo('#cityBody');$('<h3>').attr('id','cityNetTitle').appendTo(body);$('<p>').attr('id','cityNetIntro').appendTo(body);
    $('<div>').attr({id:'cityNetTabs',role:'group','aria-label':'城际协作信息分类'}).appendTo(body);
    for(const section of ['overview','transport','budget','ridge']){const el=$('<div>').attr('id','cityNetSection_'+section).appendTo(body);$('<div>').attr('id','cityNetSummary_'+section).appendTo(el);$('<p>').attr('id','cityNetText_'+section).addClass('city-net-lines').appendTo(el);$('<div>').attr('id','cityNetActions_'+section).appendTo(el);}
    const settings=$('<details>').attr('id','cityNetSettings').addClass('civil-details').appendTo('#cityNetSection_transport').append($('<summary>').text('调度与车场'));
    this.choice('priority','车辆让行规则',CivilCityNetwork.priorities,settings);$('<p>').text('优先线路最多连续先发两批。另一条线路也须有真实订单、足够储备和运行预算，才能排队。议定规则另付本城知识4。').appendTo(settings);$('<div>').attr('id','cityNetPriorityActions').appendTo(settings);
    const expansion=$('<div>').attr('id','cityNetExpansion').appendTo(settings);this.choice('method','扩建方式',{timber:'木构车场',steel:'钢架车场'},expansion);$('<p>').attr('id','cityNetExpansionCost').appendTo(expansion);$('<div>').attr('id','cityNetExpansionActions').appendTo(expansion);
    const allocation=$('<details>').attr('id','cityNetAllocation').addClass('civil-details').appendTo('#cityNetSection_budget').append($('<summary>').text('调整地方运行额度'));
    this.choice('budgetCity','付款公仓',{home:'本城出发仓',lake:'湖滨市',ridge:'矿岭市'},allocation);this.choice('budgetValue','运行安排',Object.fromEntries(Object.entries(CivilCityNetwork.budgets).map(([id,b])=>[id,b.name])),allocation);$('<p>').attr('id','cityNetBudgetTerms').appendTo(allocation);$('<div>').attr('id','cityNetBudgetActions').appendTo(allocation);
    $('<details>').attr('id','cityNetLedger').addClass('civil-details').appendTo(body).append($('<summary>').text('核对运单与实付账')).append($('<p>').addClass('city-net-lines'));
    $('<details>').attr('id','cityNetRidgeBook').addClass('civil-details').appendTo('#cityNetSection_ridge').append($('<summary>').text('地方资产与人口来源')).append($('<p>').addClass('city-net-lines'));
  },
  refresh(s){const api=CivilCityNetwork,d=api.data(s),cv=CivilConurbationView,view=CivilCityView,a=n=>view.amount(n),cost=x=>view.cost(x)||'无';
    if(!d){$('#cityNetworkBody').hide();return false;}this.ensure();
    const show=['link','ridge'].includes(cv.selected);$('#cityNetworkBody').toggle(show);if(!show)return false;
    $('#cityBody').children().not('#civilGuide,#metroCitySwitch,#cityNetworkBody').hide();$('#metroCitySwitch,#cityNetworkBody').show();
    const ridge=cv.selected==='ridge',section=ridge?'ridge':this.section;
    $('#cityNetTitle').text(ridge?'矿岭市':'城际协作');$('#cityNetIntro').text(ridge?'回收矿料与旧铸炉支撑的地方工业。基础供养由本城维持；金属生产还需要持续检修。':d.node?'共同承担运输，居民与仓库仍归各城。湖滨供粮，矿岭供工料，本城提供工具与专业服务。':'各城独立供养，共同承担运输。已有车组继续服务湖滨，也可以接洽新的城市。');
    $('#cityNetTabs').toggle(!ridge);for(const [id,label]of Object.entries({overview:'概况',transport:'运输',budget:'公共预算'}))this.b('tab_'+id,label,'#cityNetTabs',null,()=>{this.section=id;view.refresh(State);return false;}).attr('aria-pressed',section===id).toggleClass('selected',section===id);
    if(typeof CivilCityCouncil!=='undefined'){const council=CivilCityCouncil,book=council.data(s);this.b('formCouncil','筹办公用委托','#cityNetActions_overview',council.formReason(s),()=>council.form(State)).toggle(!book&&council.available(s)).attr('title','三城各付 '+cost(council.stationCost)+'，各20人施工300秒；地方承担持续办公和勤务费用。');}
    for(const id of ['overview','transport','budget','ridge'])$('#cityNetSection_'+id).toggle(section===id);
    $('#cityNetLedger').toggle(!ridge);
    const additional=Object.values(s.civilization.cityCouncil?.locals||{}).filter(r=>r.node),known=2+(d.node?1:0)+additional.length,busy=api.occupied(s),fleet=api.capacity(s),total=CivilCity.population(s)+CivilCity.count(CivilConurbation.data(s).node)+(d.node?CivilCity.count(d.node):0)+additional.reduce((sum,r)=>sum+CivilCity.count(r.node),0);
    CivilInterface.summary('#cityNetSummary_overview',{title:'共同职责',cards:[['已知城市',known],['共同车辆',busy+' / '+fleet+'组在途'],['居民合计',a(total)],['运转安排',api.priorities[d.priority]]],brief:'各城继续独立供养。共同车组返程前不能被另一条线路重复使用。',notices:['home','lake',...(d.node?['ridge']:[])].filter(id=>!api.inspected(s,id)).map(id=>api.name(id)+'：交通检修待支付'),details:[['本城出发仓',CivilCity.config(d.depot).name],['基础服务','口粮、诊疗、课堂和水务独立运行；交通预算收紧不会取消这些岗位'],['预算周期','每300秒重计支出额度，已花掉的物资不会补回']]});
    $('#cityNetText_overview').text(!d.survey?'沿旧铁路普查：出发仓实付 '+cost(api.surveyCost)+'，2名居民离岗420秒。先了解地方资产，再决定是否修路。':!d.node?'普查在途，还需 '+d.survey.remaining+' 秒。两名当地居民暂离岗位，旅费已实付。':!d.road?'矿岭已普查。修路由双方各付 '+cost(api.roadCost)+'，各20人施工300秒；先留足当地供养储备。':!d.road.completedAt?'道路施工还需 '+d.road.remaining+' 工时，双方各20人。':'各城保留地方账。运输之外，可以筹办公用委托，按各城住房压力与已出材料议定共同工程。');
    this.b('survey','沿旧铁路普查','#cityNetActions_overview',api.surveyReason(s),()=>api.survey(State)).toggle(!d.survey);
    this.b('build','双方实付修路','#cityNetActions_overview',api.buildReason(s),()=>api.build(State)).toggle(!!d.node&&!d.road).attr('title',api.buildReason(s)||'两城各付 '+cost(api.roadCost)+'；各20人施工300秒');
    if(typeof CivilCityCouncil!=='undefined'&&CivilCityCouncil.available(s)&&!CivilCityCouncil.data(s))$('#cityNetText_overview').append(document.createTextNode('\n筹办公用站：三城各付 '+cost(CivilCityCouncil.stationCost)+'，各20人施工300秒。建成后每城每60秒实付 '+cost(CivilCityCouncil.serviceCost)+'，具体工程另行议定。'));
    const old=CivilConurbation.data(s),lines=[];
    for(const [id,name,trip,reason]of [['lake','湖滨线',CivilConurbation.active(s),CivilConurbation.dispatchReason(s)],['ridge','矿岭线',api.active(s),api.dispatchReason(s)]]){if(id==='ridge'&&!d.node)continue;const waiting=d.waiting[id]===null?'':' · 候车 '+(s.civilization.elapsed-d.waiting[id])+'秒';lines.push(name+'：'+(trip?(trip.status==='outbound'?'载货在途':trip.status==='recalled'?'载货折返':'空车返程')+'，'+trip.remaining+'秒':reason||'待下次调度')+waiting);}
    $('#cityNetSummary_transport').text('共同车组 '+busy+' / '+fleet+' · '+api.priorities[d.priority]);$('#cityNetText_transport').text(lines.join('\n')+'\n湖滨往返360秒；矿岭往返480秒。旅费在出发时实付，在途驾驶员不参加本地生产。');
    if(d.road?.completedAt&&!d.enabled)$('#cityNetText_transport').append(document.createTextNode('\n授权矿岭互市：双方各付知识12。每批另各付 '+cost(api.fees())+'；只按真实缺口换取等值工料。'));
    this.b('enable',d.enabled?'暂停矿岭新订单':'授权矿岭互市','#cityNetActions_transport',d.road?.completedAt?null:'先完成矿岭道路',()=>api.setEnabled(State,!api.data(State).enabled)).toggle(!!d.road?.completedAt);
    this.b('lakeTerms','调整湖滨协约','#cityNetActions_transport',null,()=>{cv.select('legacy');return false;});
    this.b('priority','采用让行规则','#cityNetPriorityActions',this.priority===d.priority?'当前规则':null,()=>api.setPriority(State,this.priority));
    $('#cityNetExpansion').toggle(!!d.road?.completedAt&&!d.expansion);$('#cityNetChoice_method option[value=steel]').prop('disabled',!s.civilization.tech.mechanics||!s.civilization.tech.standards);
    $('#cityNetExpansionCost').text('本城出发仓实付 '+cost(api.expansionCosts[this.method])+'；20人施工300秒。建成后每60秒检修需 '+cost(this.method==='steel'?{food:6,wood:4,tools:2,iron:2,knowledge:1}:{food:6,wood:12,tools:3,knowledge:1})+'。');
    this.b('expand','实付扩建车场','#cityNetExpansionActions',api.expansionReason(s,this.method),()=>api.expand(State,this.method));
    if(d.expansion)$('#cityNetText_transport').append(document.createTextNode('\n车场：'+(d.expansion.completedAt===null?'施工尚需 '+d.expansion.remaining+' 工时':'第二车组已投入，检修费随设施持续支付。')));
    const remaining=api.period(s)+300-s.civilization.elapsed;$('#cityNetSummary_budget').text('本期还剩 '+remaining+'秒 · 额度只限制支出，不是额外库存');
    $('#cityNetText_budget').text(['home','lake',...(d.node?['ridge']:[])].map(id=>{const policy=api.budgets[d.budget[id]],reason=api.canSpend(s,id,api.inspectionCost(s,id));const spent=api.spent(s,id),tight=Object.keys(policy.limit).sort((a,b)=>(spent[b]||0)/policy.limit[b]-(spent[a]||0)/policy.limit[a])[0];return api.name(id)+' · '+policy.name+'\n'+(api.inspected(s,id)?'检修有效':'检修待恢复')+' · '+(reason||'下一轮可实付')+'\n'+(tight?'本期最高占用：'+(CivilText.labels[tight]||tight)+' '+a(spent[tight])+' / '+a(policy.limit[tight]):'已暂停新支出；本期既有费用保留在明细。');}).join('\n\n')+'\n每60秒尝试实付检修；连续120秒未付会停新发运，矿岭铸炉也停工。已付在途货物继续交割。');
    $('#cityNetChoice_budgetCity').attr('size',d.node?3:2);$('#cityNetChoice_budgetCity option[value=ridge]').prop({disabled:!d.node,hidden:!d.node});const bn=api.local(s,this.budgetCity);
    $('#cityNetBudgetTerms').text(api.name(this.budgetCity)+'：选择“'+api.budgets[this.budgetValue].name+'”，每期额度 '+cost(api.budgets[this.budgetValue].limit)+'。议定费另付知识4，不占运行额度，本期已支不清零。'+(bn?'\n本期运行已支：'+cost(api.spent(s,this.budgetCity))+'\n下次检修：'+cost(api.inspectionCost(s,this.budgetCity))+'，2名本地事务人员在岗。\n公仓实存：'+cost(bn.stores):''));
    this.b('budget','议定运行额度','#cityNetBudgetActions',!bn?'尚未普查':d.budget[this.budgetCity]===this.budgetValue?'当前安排':!CivilRules.canPay({stores:bn.stores},{knowledge:4})?'本地尚缺4知识':null,()=>api.setBudget(State,this.budgetCity,this.budgetValue));
    if(d.node){const n=d.node,o=d.origin;
      CivilInterface.summary('#cityNetSummary_ridge',{title:'本地供养与工业',cards:[['居民',a(CivilCity.count(n))],['健康',Math.floor(n.health)+' / 100'],['公共服务',n.stable+'秒'],['铸炉',api.inspected(s,'ridge')?'检修有效':'等待维护']],brief:'金属生产使用本地废料、木料和160个真实岗位。农田、诊疗与课堂有自己的岗位和物资成本。',notices:view.issues(s,n),details:[['上轮实际冶炼',(n.economy?.worked.smelter||0)+'人'],['累计实产铁料',a(n.budget.produced.iron)],['工业维护',cost(api.inspectionCost(s,'ridge'))+' / 60秒']]});
      $('#cityNetText_ridge').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+' '+a(n.stores[k])+' · 近轮 '+CivilInterface.signed(n.economy?.flow[k]||0)).join('\n'));
      $('#cityNetRidgeBook p').text('从西陆名册细分 '+a(o.population)+'人；其后出生 '+a(n.born)+'，死亡 '+a(n.dead)+'，净迁居 '+a(CivilCityHomes.delta(s,'ridge'))+'。原有住房 '+a(o.housing)+'床。\n普查前采用明确的年度自给粗算；普查后按本地岗位与库存结算，未赠送物资给本城。\n'+CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：原有 '+a(o.stores[k])+' + 生产 '+a(n.budget.produced[k])+' + 收货 '+a(n.budget.received[k])+' − 消耗 '+a(n.budget.consumed[k])+' − 发货 '+a(n.budget.sent[k])+' = '+a(n.stores[k])).join('\n'));
    }
    $('#cityNetLedger p').text('矿岭最近运单\n'+d.trips.slice(-5).map(p=>'第'+p.id+'批 · '+({outbound:'在途',returning:'返程',complete:'结清'}[p.status])+' · 付 '+cost(p.out)+' / 收 '+cost(p.back)).join('\n')+'\n\n最近公仓支出（运行与议定，不含施工款）\n'+d.entries.slice(-12).map(e=>api.name(e.city)+' · '+({inspection:'检修',policy:'预算议定',lakeTrip:'湖滨运费',ridgeTrip:'矿岭运费',lakeRepair:'湖滨道路维护',ridgeRepair:'矿岭道路维护'}[e.kind])+' · '+cost(e.paid)).join('\n')+'\n\n近期共同记录\n'+d.history.slice(-6).map(e=>'重建'+Math.floor(e.at/600)+'年：'+e.text).join('\n'));
    return true;
  }
};
