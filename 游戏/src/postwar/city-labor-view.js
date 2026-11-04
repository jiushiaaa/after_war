/* MPL-2.0 — An ADR disclosure, not a second management dashboard. */
var CivilCityLaborView={
  built:false,city:'ridge',source:'home',size:'24',
  reset(){this.built=false;this.city='ridge';this.source='home';this.size='24';},
  choice(key,title,items,host){const label=$('<label>').addClass('city-setting').appendTo(host);$('<span>').text(title).appendTo(label);const select=$('<select>').attr({id:'laborChoice_'+key,'aria-label':title,size:Math.max(2,Math.min(3,Object.keys(items).length))}).appendTo(label);for(const [id,text]of Object.entries(items))$('<option>').val(id).text(text).appendTo(select);select.val(this[key]).on('change',()=>{this[key]=select.val();CivilCityView.refresh(State);}).on('keydown keyup',e=>e.stopPropagation());},
  ensure(s){if(this.built&&$('#cityLaborDesk').length)return;this.built=true;
    const box=$('<details>').attr('id','cityLaborDesk').addClass('civil-details').insertAfter('#cityContinuityDesk').append($('<summary>').text('就业、通勤与家庭收入'));
    $('<p>').attr('id','laborIntro').appendTo(box);
    const table=$('<table>').attr({id:'laborCities','aria-label':'各城岗位与住房'}).addClass('city-labor-table').appendTo(box);
    $('<caption>').text('机动劳力仍需供养；空闲不等于无住房或失业。').appendTo(table);
    $('<thead>').html('<tr><th scope="col">城市</th><th scope="col">机动劳力</th><th scope="col">在班 / 需工</th><th scope="col">可用空床</th></tr>').appendTo(table);$('<tbody>').appendTo(table);
    const choose=$('<details>').attr('id','laborOffer').appendTo(box).append($('<summary>').text('查看一城，安排用工'));
    const cities=Object.fromEntries(CivilCityCouncil.ids(s).map(id=>[id,CivilCityCouncil.name(s,id)]));this.choice('city','雇用城市',cities,choose);
    $('<p>').attr('id','laborCityStatus').addClass('city-net-lines').appendTo(choose);$('<div>').attr('id','laborBuildActions').appendTo(choose);
    const draft=$('<div>').attr('id','laborDraft').appendTo(choose);this.choice('source','居民来源（同城为本地用工）',cities,draft);this.choice('size','每班人数',{'24':'24人 · 小班','60':'60人 · 中班','120':'120人 · 满班'},draft);
    $('<p>').attr('id','laborPreview').addClass('city-net-lines').appendTo(draft);$('<div>').attr('id','laborOrderActions').appendTo(draft);
    $('<p>').attr('id','laborCurrent').addClass('city-net-lines').appendTo(choose);$('<div>').attr('id','laborManageActions').appendTo(choose);
    const ledger=$('<details>').attr('id','laborLedger').appendTo(box).append($('<summary>').text('工资、食宿与返程账'));$('<p>').addClass('city-net-lines').appendTo(ledger);
  },
  refresh(s){const api=CivilCityLabor,a=CivilCityCouncil,d=api.data(s),v=CivilCityView,n=x=>v.amount(x),cost=x=>Object.entries(x).filter(([,value])=>value>0).map(([key,value])=>(CivilText.labels[key]||key)+' '+value.toLocaleString('zh-CN',{maximumFractionDigits:3})).join('、')||'无';if(!api.available(s)&&!d){$('#cityLaborDesk').hide();return;}this.ensure(s);$('#cityLaborDesk').show();
    $('#laborIntro').text('保留住所也能到另一城工作。工位接替部分现有生产排班；车辆、临住床位、工资和供养分别记账。需工按库存缺口或课堂人数计算，储备充足暂不发班。原镇和其他片区仍由原有机构办理，本城用工在出发片区。');
    const ids=a.ids(s),rows=ids.map(id=>{const active=api.shifts(s).find(p=>p.to===id),o=api.office(s,id);return {id,staff:api.idle(s,id),jobs:!o?'未设工位':!api.ready(s,id)?'安装中':o.enabled?(active?.count||0)+' / '+api.demand(s,id):'暂停',beds:CivilCityHomes.freeBeds(s,id)};});
    const tbody=$('#laborCities tbody');for(const r of rows){let tr=$('#laborCity_'+r.id);if(!tr.length){tr=$('<tr>').attr('id','laborCity_'+r.id).appendTo(tbody);$('<th>').attr('scope','row').text(a.name(s,r.id)).appendTo(tr);for(let i=0;i<3;i++)$('<td>').appendTo(tr);}tr.find('td').eq(0).text(n(r.staff));tr.find('td').eq(1).text(r.jobs);tr.find('td').eq(2).text(n(r.beds));}
    for(const key of ['city','source'])for(const id of ids)if(!$('#laborChoice_'+key+' option[value="'+id+'"]').length)$('<option>').val(id).text(a.name(s,id)).appendTo('#laborChoice_'+key);
    const city=this.city,o=api.office(s,city),ready=api.ready(s,city),contract=api.contract(s,city),p=api.shifts(s).find(p=>p.to===city),trade=api.trades[city],b=(id,label,host,why,fn)=>v.button('labor_'+id,label,host,why,fn);
    $('#laborCityStatus').text(a.name(s,city)+' · '+trade.name+'\n原址居民 '+n(CivilCity.count(a.local(s,city)))+' · 外出轮班 '+api.away(s,city)+' · 来城驻班 '+api.guests(s,city)+' · 临住预留 '+api.beds(s,city)+'\n'+(!o?'120个有限工位；实付 '+cost(api.cost)+'，20名本地居民安装120秒。':!ready?'安装中，剩余 '+o.remaining+' 工时。':(o.enabled?'劳务委托已授权':'劳务委托已暂停')+'；其中'+api.schoolPlaces(s,city)+'个工位调作补充课堂，可用劳务工位'+api.slots(s,city)+'。公用站'+(a.activeOffice(s,city)?'正常':'待恢复')+'。本期剩余 '+n(a.allowance(s,city))+'折值。')+'\n每人每10秒投入 '+cost(trade.input)+'，产出 '+cost(trade.output)+(trade.job==='teacher'?'，兼顾20名儿童课堂；知识储备足额时不凭空堆积。':'。'));
    $('#laborBuildActions').toggle(!o);b('build','实付筹办工位','#laborBuildActions',api.buildReason(s,city),()=>api.build(State,this.city));$('#laborDraft').toggle(ready&&!contract);$('#laborManageActions').toggle(ready);
    const draft={from:this.source,to:city,count:Number(this.size)},q=api.quote(s,draft),why=api.orderReason(s,draft.from,draft.to,draft.count);
    $('#laborPreview').text((this.source===city?'本地就业，不用车、不另占床。':'单程 '+(q.distance??'未通')+'秒；4名驾驶员随车，全班回家前不能承担其他运输。预留 '+this.size+' 张临住床，原址住房保留。临住整备 '+cost(api.lodgingCost(draft.count))+'；每60秒维护 '+cost(api.lodgingFee(draft.count))+'，委托结束前持续留床。')+'\n先封存本班工资 '+cost(q.escrow)+'；每人每轮实际工作挣粮0.24，最多30轮。'+(q.distance?'来源公仓另备旅粮 '+n(q.pack.food)+' 与车费 '+cost(q.fee)+'；雇用城逐轮返还驻班口粮，随车带回。':'')+'\n雇用城逐轮实付原料和食宿，占共同事务额度；停办、缺料会提前结束。未挣工资退还，已挣工资归居民，返乡后抵扣家庭口粮。\n'+(why||'条件满足；签约后按实际车辆、空床、预算复核，至少每600秒一班。'));
    b('order','签订用工委托','#laborOrderActions',why,()=>api.order(State,this.source,this.city,Number(this.size)));
    $('#laborCurrent').text(contract?'当前来源：'+a.name(s,contract.from)+' · 每班'+contract.count+'人\n'+(p?(p.phase==='outbound'?'去程，'+p.remaining+'秒到岗':p.phase==='working'?'驻班 '+p.rounds.length+' / 30轮，已挣粮 '+n(p.earned):'返乡，'+p.remaining+'秒；工资粮 '+n(p.earned)+' 随车'):'下一班：'+(api.departureReason(s,contract)||'条件满足，等待排班')):'当前没有后续用工委托。'+(p?'已出发班次仍按旧约结清。':''));
    b('toggle',o?.enabled?'暂停劳务委托':'恢复劳务委托','#laborManageActions',!ready?'先完成工位':a.local(s,city).stores.knowledge<2?'当地尚缺知识2':null,()=>api.set(State,this.city,!api.office(State,this.city).enabled));
    b('cancel','结束后续用工','#laborManageActions',null,()=>api.cancel(State,this.city)).toggle(!!contract);
    $('#laborLedger p').text((d?Object.entries(d.households).map(([id,h])=>a.name(s,id)+'家庭：已收粮酬 '+n(h.received)+'，已用于口粮 '+n(h.consumed)+'，家庭留粮 '+n(h.food)).join('\n'):'尚无家庭粮酬。')+'\n\n'+(d?.shifts||[]).slice(-6).map(p=>'第'+p.id+'班 · '+a.name(s,p.from)+' → '+a.name(s,p.to)+' · '+p.count+'人\n'+p.rounds.length+'轮实际劳动，粮酬 '+n(p.earned)+' / 封存 '+n(p.escrow)+'；公仓食宿返还 '+n(p.hospitality)+'\n'+(p.finishedAt!==null?'已结清，未挣退回 '+n(p.refunded)+'，来源公仓收回 '+n(p.received)+'。':p.leftAt!==null?'已返还未挣工资，车辆仍在返乡。':'班次未结清，工资与旅粮仍在各自账上。')+(p.reason?' '+p.reason:'')).join('\n\n'));
  }
};
