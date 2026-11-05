/* MPL-2.0 — Regional scale in the existing text-first city location. */
var CivilDomainView={
  reset(){if(typeof CivilRegionalView!=='undefined')CivilRegionalView.reset();this.built=false;this.mode='trade';this.priority='care';this.good='iron';this.signature=null;},
  built:false,mode:'trade',priority:'care',good:'iron',signature:null,
  b(id,label,host,reason,fn){return CivilCityView.button('domain_'+id,label,host,reason,fn);},
  entry(s){
    if(!CivilDomain.available(s)){$('#domainEntry,#domainBody').hide();return;}
    if(!$('#domainEntry').length)$('<a>').attr({id:'domainEntry',href:'#',role:'button'}).text('地区与共同责任').appendTo('#metroCitySwitch').on('click',e=>{e.preventDefault();CivilConurbationView.select('domain');});$('#domainEntry').show();
  },
  choice(id,label,items,host){const l=$('<label>').addClass('city-setting').appendTo(host);$('<span>').text(label).appendTo(l);const el=$('<select>').attr({id:'domainChoice_'+id,size:Object.keys(items).length,'aria-label':label}).appendTo(l);for(const [key,name]of Object.entries(items))$('<option>').val(key).text(name).appendTo(el);el.val(this[id]).on('change',()=>{this[id]=el.val();CivilCityView.refresh(State);}).on('keydown keyup',e=>e.stopPropagation());},
  ensure(){if(this.built&&$('#domainBody').length)return;this.built=true;
    const box=$('<div>').attr('id','domainBody').appendTo('#cityBody');$('<h3>').text('越过城市边界').appendTo(box);$('<p>').attr('id','domainIntro').appendTo(box);$('<div>').attr('id','domainSummary').appendTo(box);
    const map=$('<details>').attr('id','domainMap').addClass('civil-details').appendTo(box).append($('<summary>').text('已知地区图'));$('<p>').text('旧世界方位示意。接触范围不等于疆界；未普查部分不显示人口。').appendTo(map);
    const grid=$('<div>').addClass('domain-map').attr({role:'list','aria-label':'八区联系状态'}).appendTo(map);for(const [id,name]of Object.entries(CivilCensus.regions))$('<div>').attr({id:'domainMap_'+id,role:'listitem'}).addClass('domain-map-'+id).append($('<strong>').text(name),$('<span>')).appendTo(grid);
    $('<div>').attr('id','domainStart').appendTo(box);$('<p>').attr('id','domainNext').addClass('city-net-lines').appendTo(box);
    const treaty=$('<details>').attr('id','domainTreaty').addClass('civil-details').appendTo(box).append($('<summary>').text('协约与公共责任'));
    this.choice('mode','拟议协作范围',CivilDomain.modes,treaty);$('<p>').attr('id','domainTerms').addClass('city-net-lines').appendTo(treaty);$('<div>').attr('id','domainAgreementActions').appendTo(treaty);
    const economy=$('<details>').attr('id','domainEconomy').addClass('civil-details').appendTo(box).append($('<summary>').text('地方生产与外供'));this.choice('priority','地方机构委托',CivilDomain.priorities,economy);this.choice('good','湖滨进口',Object.fromEntries(Object.entries(CivilDomain.goods).map(([k,v])=>[k,v.name])),economy);$('<p>').attr('id','domainProduction').addClass('city-net-lines').appendTo(economy);$('<div>').attr('id','domainPolicyActions').appendTo(economy);
    for(const [id,label]of [['Transport','船期与货物'],['Accounts','人口、地方资产与账目']])$('<details>').attr('id','domain'+id).addClass('civil-details').appendTo(box).append($('<summary>').text(label)).append($('<p>').addClass('city-net-lines'));
  },
  refresh(s){
    if(CivilConurbationView.selected!=='domain'||!CivilDomain.available(s)){$('#domainBody').hide();return false;}this.ensure();$('#cityBody').children().not('#metroCitySwitch,#domainBody').hide();$('#metroCitySwitch,#domainBody').show();$('#councilLocation').hide();$('#metroCitySwitch > .button').show();
    const f=CivilDomain,d=f.data(s),n=d?.node,a=x=>CivilCityView.amount(x),cost=x=>CivilCityView.cost(x),flight=f.active(s);
    $('#domainIntro').text('城市之外仍有自己的农田、工场和居民。普查确认人口，协约分担职责；合作不合并仓库，也不会把居民搬进本城。');
    for(const id of Object.keys(CivilCensus.regions))$('#domainMap_'+id+' span').text(id==='north'?(n?'北岸已普查 · 其余失联':d?'北岸普查在途':'北岸有旧水路记录'):(id==='west'?'矿岭已接触 · 腹地未普查':id==='east'&&s.civilization.cityCouncil?.locals.estuary?'河口已接触 · 腹地未普查':'未建立地区联系'));
    this.b('survey','派出北岸普查队','#domainStart',f.startReason(s),()=>f.start(State)).toggle(!d);
    $('#domainTreaty,#domainEconomy,#domainTransport,#domainAccounts').toggle(!!n);$('#domainSummary').toggle(!!n);
    if(!n){$('#domainNext').text(d?'两名普查员在途，尚需 '+d.survey.remaining+' 秒；已实付 '+cost(d.survey.paid)+'。':'三城机构已能接续日常事务，可以沿旧水路普查北岸。出发仓实付 '+cost(f.surveyCost)+'；两名普查员离岗420秒。'+(f.startReason(s)?'\n暂不能出发：'+f.startReason(s):''));return true;}
    const notices=[];if(f.city(s,'home').economy?.educated===false)notices.push('出发片区的课堂不足：城际协作中的就业与课堂设施可以补足容量，但需要实付建材和维护。');if(n.condition<80)notices.push('码头维护 '+n.condition+'，新发运暂缓；恢复维护后继续。');if(!n.economy?.fed||!n.economy?.treated)notices.push('地方供养尚未稳定，先留足粮药。');if(d.mode&&f.serviceReason(s))notices.push(f.serviceReason(s));
    CivilInterface.summary('#domainSummary',{title:f.name,cards:[['当地居民',a(f.known(s))],['共同责任人口',a(f.governed(s))],['地方健康',n.health+' / 100'],['设施维护',n.condition+' / 100']],brief:d.mode?f.modes[d.mode]+' · 地方资产独立 · 尚未建国':'已知独立地区；尚未约定共同职责。',notices:notices.slice(0,3),details:[['居住与管辖','普查和签约都不迁居。共同服务只涵盖约定公共事务，不等于中央接管。'],['机构','地区按有限职业组办理生产，联络处由本城2名居民值守；其他城市日常职责继续。']]});
    $('#domainNext').text(!d.mode?'下一步：展开「协约与公共责任」，比较互市通行与共同服务。':flight?'双向货物在途，船队返航前不会重复发货。':f.tradeReason(s)||'条件具备，将在下次60秒结算时发运。');
    const reason=f.agreementReason(s,this.mode);$('#domainTerms').text((this.mode==='trade'?'互市通行：只约定湖滨与北岸通商，每班最多80件。北岸自行维护，居民不列共同服务覆盖。':'共同服务：民生委托每班可外供320药、80铁；工料委托可外供320铁、80药。工料委托的维护木料、工具翻倍。')+'\n议定：本城 '+cost(f.charterCost)+'；湖滨 木120、工具24；北岸 木1200、工具240。每60秒本城联络处 '+cost(f.fees(this.mode))+'，从出发片区实付，单独列账。'+(reason?'\n'+reason:''));
    this.b('agree','议定协约','#domainAgreementActions',reason,()=>f.agree(State,this.mode));this.b('pause',d.enabled?'暂停共同委托':'恢复共同委托','#domainAgreementActions',!d.mode?'尚无协约':null,()=>f.change(State,'enabled',!d.enabled)).toggle(!!d.mode);this.b('withdraw','结束协约','#domainAgreementActions',flight?'先等待在途交付并返航':null,()=>f.withdraw(State)).toggle(!!d.mode);
    const signature=[d.priority,d.good].join();if(this.signature!==signature){this.signature=signature;this.priority=d.priority;this.good=d.good;$('#domainChoice_priority').val(this.priority);$('#domainChoice_good').val(this.good);}$('#domainChoice_priority option[value=works]').prop('disabled',d.mode!=='shared'||n.condition<80);
    const e=n.economy;$('#domainProduction').text('地区保有 '+a(n.housing)+' 床、地方水务和工坊，一组修复后可用的旧船队。基础农业、医疗和学校优先分工。\n'+(e?'近60秒：粮 '+CivilInterface.signed(e.flow.food)+'，药 '+CivilInterface.signed(e.flow.medicine)+'，铁 '+CivilInterface.signed(e.flow.iron)+'；维护'+(e.maintained?'已实付':'待恢复')+'。':'等待首期生产核算。')+'\n工料外供使用更多真实冶炼岗位、废料与木料；每期地方维护的木与工具翻倍；码头也转向铁料外供，药品外供降回80。断供会先停码头。改委托各付本城知识4。');
    this.b('priority','调整地方委托','#domainPolicyActions',!d.mode?'先议定协约':this.priority===d.priority?'已按此安排':this.priority==='works'&&(d.mode!=='shared'||n.condition<80)?'共同服务并恢复维护80后可委托':null,()=>f.change(State,'priority',this.priority));this.b('good','调整进口货物','#domainPolicyActions',!d.mode?'先议定协约':this.good===d.good?'已按此货物办理':null,()=>f.change(State,'good',this.good));
    $('#domainTransport p').text('湖滨与北岸各4名驾驶员，一组船队，单向最多2048件；360秒抵达，720秒完成往返。旅粮一次付清，离岗者不重复领取家中口粮。\n铁1换粮6；药1换粮4。双方每班另付 '+cost(f.freightFees())+'。地方保留粮药18轮；外供药品由本期空余诊疗岗位实付备料，不挪用保留量。\n'+(flight?'第'+flight.id+'班：湖滨 '+cost(flight.out)+' ⇄ 北岸 '+cost(flight.back)+'；'+(flight.deliveredAt===null?'待抵达 '+(flight.startedAt+f.travel-s.civilization.elapsed):'已交割，返航 '+(flight.startedAt+2*f.travel-s.civilization.elapsed))+'秒。':'船队空闲：'+(f.tradeReason(s)||'待下次调度'))+'\n累计已交付 '+d.trips.filter(p=>p.deliveredAt!==null).length+'班；暂停不撤回已装船货物。');
    if($('#domainAccounts').prop('open'))$('#domainAccounts p').text('普查从北陆名册细分 '+a(d.origin.population)+'人；此后出生 '+a(n.born)+'、死亡 '+a(n.dead)+'，现 '+a(f.known(s))+'人。原城市不计入北岸。\n居民职业总数 '+a(Object.values(n.workers).reduce((x,y)=>x+y,0))+' / 劳动力 '+a(CivilPopulation.workforce(n.cohorts))+'。\n'+CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：原有 '+a(d.origin.stores[k])+' + 生产 '+a(n.budget.produced[k]||0)+' + 收货 '+a(n.budget.received[k]||0)+' − 消耗 '+a(n.budget.consumed[k]||0)+' − 发货 '+a(n.budget.sent[k]||0)+' = '+a(n.stores[k])).join('\n')+'\n联络处续办 '+d.ledger.filter(e=>e.kind==='service'&&e.paid).length+'期实付 / '+d.ledger.filter(e=>e.kind==='service'&&!e.paid).length+'期待付；失联年代为年度粗算，不是精确历史流水。');
    CivilRegionalView.refresh(s);
    return true;
  }
};
