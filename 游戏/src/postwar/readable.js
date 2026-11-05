/* MPL-2.0 — Read-only ADR ledgers. Formatting never changes saved quantities. */
var CivilReadable={
  opened:new Set(),
  number(value,unit=''){
    const n=Number(value)||0,a=Math.abs(n),scale=a>=1e8?1e8:a>=1e4?1e4:1;
    return Number((n/scale).toFixed(scale===1?2:2)).toLocaleString('zh-CN')+(scale===1e8?'亿':scale===1e4?'万':'')+unit;
  },
  quantity(n,unit){return this.number(n,unit);},
  rows(selector,rows){
    const host=$(selector);if(!host.length)return;const signature=JSON.stringify(rows);
    if(host.attr('data-readable')===signature&&host.children('.civil-kv').length)return;
    host.attr('data-readable',signature).css('white-space','normal');let dl=host.children('.civil-kv');if(!dl.length){host.empty();dl=$('<dl>').addClass('civil-kv').appendTo(host);}
    while(dl.children().length<rows.length*2){$('<dt>').appendTo(dl);$('<dd>').appendTo(dl);}dl.children().slice(rows.length*2).remove();
    rows.forEach(([label,value,source],i)=>{
      dl.children().eq(i*2).text(label);const dd=dl.children().eq(i*2+1);
      if(source){const key=selector+'_'+i;let details=dd.children('details');if(!details.length){dd.empty();details=$('<details>').addClass('civil-source').prop('open',this.opened.has(key)).appendTo(dd);$('<summary>').appendTo(details);$('<p>').appendTo(details);details.on('toggle',()=>{if(details.prop('open'))this.opened.add(key);else this.opened.delete(key);});}details.children('summary').text(value).attr('aria-label',label+'：'+value+'，展开来源');details.children('p').text(source);}
      else dd.text(value);
    });
  },
  masses:['food','wood','scrap','ore','coal','iron','steel','glass'],
  resource(n,id,mass=false){if(mass&&this.masses.includes(id))return Math.abs(n)>=1000?this.quantity(n/1000,'吨'):this.number(n,'千克');return this.number(n);},
  ledger(stock,book={},initial={},mass=false){
    return [...new Set([...Object.keys(stock),...Object.keys(initial)])].map(id=>{
      const label=(typeof CivilFutureContent!=='undefined'?CivilFutureContent.labels[id]:null)||CivilText.labels[id]||id;
      const val=n=>(Number(n)||0).toLocaleString('zh-CN',{maximumFractionDigits:6});
      return [label,this.resource(stock[id],id,mass),(mass&&this.masses.includes(id)?'本局质量单位：每份为1千克，1000千克为1吨；配方、运力按原始份数结算。':'原始账目单位，未折算为重量。')+['期初 '+val(initial[id]),'收货 '+val(book.received?.[id]),'生产 '+val(book.produced?.[id]),'外部净变化 '+val(book.external?.[id]),'消耗 −'+val(book.consumed?.[id]),'发货 −'+val(book.sent?.[id]),'当前 '+val(stock[id])].join('；')+'。在途货物未入库。'];
    });
  },
  population(s){
    const c=s.civilization,d=c.census;if(!d)return null;
    const known=CivilCensus.known(s),global=!!c.polity?.earth?.unity,ids=new Set(global?Object.keys(d.accounts):known.map(r=>r.id));
    // Transit accounts are a separate residence, not a second copy in their destination.
    for(const id of ['transit','patients','future_voyage'])if(d.accounts[id]>0)ids.add(id);
    const names=Object.fromEntries(known.map(r=>[r.id,r.name]));
    const namesExtra={transit:'迁居途中',patients:'康复离岗',future_voyage:'航天乘员在途'};
    const rows=[...ids].filter(id=>Object.hasOwn(d.accounts,id)).map(id=>({id,name:names[id]||namesExtra[id]||(id.startsWith('reserve_')?CivilCensus.regions[id.slice(8)]+'其余名册':'其余已覆盖名册 · '+id),count:d.accounts[id]}));
    const year=Math.floor(c.elapsed/600),first=Math.max(0,year-9),years=Array.from({length:year-first+1},(_,i)=>({year:first+i,birth:0,death:0,arrival:0,departure:0,contact:0,created:0}));
    for(let i=d.entries.length-1;i>=0;i--){const e=d.entries[i],y=Math.floor(e.at/600);if(y<first)break;const row=years[y-first];if(!row)continue;
      if(e.kind==='birth'&&ids.has(e.to))row.birth+=e.count;
      if(e.kind==='death'&&ids.has(e.from))row.death+=e.count;
      if(e.kind==='create'&&ids.has(e.to))row.created+=e.count;
      if(e.kind==='partition'&&ids.has(e.to))row.contact+=e.count;
      if(e.kind==='move'){if(ids.has(e.to))row.arrival+=e.count;if(ids.has(e.from))row.departure+=e.count;}
    }
    return {global,rows,total:rows.reduce((v,r)=>v+r.count,0),years,initial:d.initial,born:d.born,dead:d.dead,created:d.created||0};
  },
  census(s,selector){
    const p=this.population(s),host=$(selector);if(!p||!host.length)return;
    const sig=JSON.stringify([p,s.civilization.polity?.future?.converted]);if(host.attr('data-census')===sig&&host.children('details').length)return;
    const censusKey='census_'+selector;host.attr('data-census',sig);const f=s.civilization.polity?.future;let details=host.children('details');
    if(!details.length){host.empty();$('<p>').appendTo(host);details=$('<details>').attr('id','a7CensusSources_'+host.parent().attr('id')).prop('open',this.opened.has(censusKey)).appendTo(host).on('toggle',()=>{if(details.prop('open'))this.opened.add(censusKey);else this.opened.delete(censusKey);});$('<summary>').text('展开人口来源与近十年变化').appendTo(details);$('<dl>').addClass('civil-kv').appendTo(details);$('<p>').addClass('civil-census-equation').appendTo(details);const wrap=$('<div>').addClass('civil-table-scroll').appendTo(details),table=$('<table>').addClass('civil-table').appendTo(wrap);$('<caption>').text('近十年来源（当前已知名册；迁入/迁出含名册内搬家，须成对阅读）').appendTo(table);const tr=$('<tr>').appendTo($('<thead>').appendTo(table));for(const name of ['年','出生','死亡','普查接触','迁入','迁出','新人格'])$('<th>').attr('scope','col').text(name).appendTo(tr);$('<tbody>').appendTo(table);$('<p>').addClass('civil-secondary').appendTo(details);}
    host.children('p').first().text((p.global?'地球现存主体':'目前已知居住名册')+' '+this.number(p.total,'人')+'。居民、在途、公民和身体是不同口径，不相加。');
    const dl=details.children('dl');while(dl.children().length<p.rows.length*2){$('<dt>').appendTo(dl);$('<dd>').appendTo(dl);}dl.children().slice(p.rows.length*2).remove();p.rows.forEach((r,i)=>{dl.children().eq(i*2).text(r.name);dl.children().eq(i*2+1).text(this.number(r.count,'人')).attr('title',r.count.toLocaleString()+'人 · 独立居住账户 '+r.id);});
    details.children('.civil-census-equation').toggle(p.global).text('世界主体 = 初始 '+this.number(p.initial)+' + 出生 '+this.number(p.born)+' + 新人格 '+this.number(p.created)+' − 死亡 '+this.number(p.dead)+'。联络、接纳、迁徙和身体转换不生成新人。');
    const body=details.find('tbody');while(body.children().length<p.years.length){const row=$('<tr>').appendTo(body);$('<th>').attr('scope','row').appendTo(row);for(let i=0;i<6;i++)$('<td>').appendTo(row);}body.children().slice(p.years.length).remove();p.years.forEach((y,i)=>{const row=body.children().eq(i);row.children('th').text(y.year);['birth','death','contact','arrival','departure','created'].forEach((k,j)=>row.children('td').eq(j).text(this.number(y[k])).attr('title',String(y[k])));});
    details.children('.civil-secondary').text('医疗改善通过实际存活与死亡记录体现，不另算“医疗新增人口”。身体转换 '+(f?Object.entries(f.converted).map(([k,n])=>(CivilFutureContent.bodies[k]||k)+' '+this.number(n,'人')).join('、')||'尚无':'尚无')+'；同一主体持续登记。');
  },
  alerts(selector,items){
    const root=$(selector);if(!root.length)return;root.toggle(items.length>0);let first=root.children('.civil-alerts');if(!first.length){root.empty();first=$('<ol>').addClass('civil-alerts').attr('aria-label','需要决定').appendTo(root);}
    const fill=(list,rows)=>{while(list.children().length<rows.length)$('<li>').appendTo(list);list.children().slice(rows.length).remove();rows.forEach((item,i)=>{const li=list.children().eq(i);if(item.go){let a=li.children('a');if(!a.length){li.empty();a=$('<a>').attr({href:'#',role:'button'}).appendTo(li).on('click',e=>{e.preventDefault();$(e.currentTarget).data('action')?.();});}a.text('！'+item.text+' · 办理').data('action',item.go);}else{let strong=li.children('strong');if(!strong.length){li.empty();strong=$('<strong>').appendTo(li);}strong.text('！'+item.text);}});};
    fill(first,items.slice(0,3));let more=root.children('details');if(items.length>3){if(!more.length){more=$('<details>').appendTo(root);$('<summary>').appendTo(more);$('<ol>').appendTo(more);}more.children('summary').text('另外 '+(items.length-3)+' 项待办');fill(more.children('ol'),items.slice(3));}else more.remove();
  },
  focus(selector){const el=$(selector);el.parents('details').prop('open',true);el.prop('open',true);const node=el[0];node?.scrollIntoView({block:'center'});if(node){node.tabIndex=-1;node.focus({preventScroll:true});}},
  metricSources(selector,sources){
    const root=$(selector);if(!root.length)return;let box=root.children('.civil-metric-sources');if(!box.length){box=$('<details>').addClass('civil-metric-sources civil-details').append($('<summary>').text('汇总数来源'),$('<div>')).appendTo(root);}
    this.rows(selector+' > .civil-metric-sources > div',sources);
    root.find('.civil-metrics .civil-metric > strong').each((i,node)=>{const el=$(node),text=el.text();let a=el.children('a');if(!a.length){el.empty();a=$('<a>').attr('href','#').appendTo(el).on('click',e=>{e.preventDefault();box.prop('open',true);box[0].scrollIntoView({block:'nearest'});});}a.attr('aria-label',text+'，查看汇总来源').text(text);});
  },
  earth(s){
    const d=s.civilization.polity,g=d?.earth;if(!g||!$('#earthDesk').length)return;
    this.metricSources('#earthSummary',[
      ['已联络地区',Object.keys(g.regions).map(id=>CivilCensus.regions[id]).join('、')],
      ['已承担共同责任',Object.entries(g.regions).filter(([,r])=>r.acceptedAt!==null).map(([id])=>CivilCensus.regions[id]).join('、')||'尚无'],
      ['连续履约',g.stable+'秒','以连续实付期计算；历史已付 '+g.paid+'期，延后 '+g.missed+'期。'],
      ['实际运单',g.ships.filter(v=>v.at!==null&&v.returnedAt===null).map(v=>'第'+v.id+'班 · '+CivilCensus.regions[v.region]).join('、')||'无在途船组']]);
    $('#earthSummary > .civil-brief').text(g.unity?'共同法覆盖 '+this.number(CivilCensus.total(s),'人')+'；出生、死亡与新人格登记可查。':'先确认现有地区名册，再承担共同责任。');
    const alerts=[];if(g.last&&!g.last.paid)alerts.push({text:g.last.reason,go:()=>CivilEarthView.go('mandates')});for(const [id,r]of Object.entries(g.regions))if(r.last&&!r.last.paid)alerts.push({text:CivilCensus.regions[id]+'：'+r.last.reason,go:()=>CivilEarthView.go('regions',id)});if(g.ground&&!g.ground.completedAt)alerts.push({text:'闭环试验 '+g.ground.progress+'/300 秒，检查供料与测控',go:()=>CivilEarthView.go('flight')});this.alerts('#earthSummary > .civil-notices',alerts);
    if($('#earthAccounts').prop('open')){
      this.rows('#earthAccounts > div',Object.entries(CivilEarthContent.regions).flatMap(([id,cfg])=>{const r=g.regions[id];if(!r)return [[CivilCensus.regions[id],'未普查']];const n=CivilEarth.local(d,id);return [[CivilCensus.regions[id],this.number(CivilDomain.count(n),'人'),(r.source==='reserve'?'来自该区开局底账的普查细分':'沿用原有地方名册')+'；出生 '+this.number(n.born)+'，死亡 '+this.number(n.dead)+'。'],['共同责任',r.mode?cfg.options[r.mode].name:'尚未议定'],['健康 / 维护',n.health+' / '+n.condition],['已付 / 延后',r.paid+' / '+r.missed+'期','每期按实际地方材料与公共维护结算，历史延付保留。']];}));
      if(!$('#a7EarthCensus').length)$('<div>').attr('id','a7EarthCensus').appendTo('#earthAccounts > div');this.census(s,'#a7EarthCensus');
    }
    if($('#earthCargo').prop('open'))this.rows('#earthCargo > div',[
      ['当前船组',CivilEarth.activeShip(g)+' / 2组','只统计尚未返程的实付船组。工程排队不算新船。'],['航天实耗电',this.number(g.work?.power||0),'来自当前真实航天岗位与测控需求。'],
      ...this.ledger(d.world.nodes.north.stores,d.public,{},s.civilization.polishVersion===1),...g.ships.slice(-8).map(v=>[CivilCensus.regions[v.region]+'第'+v.id+'班',v.returnedAt?'已返回':v.arrivedAt?'返程':v.at===null?'待装船':'在途',CivilFuture.costText(v.goods)+'。实付运单，未到货不加入目标仓。'])]);
  },
  future(s){
    const f=s.civilization.polity?.future;if(!f)return;
    const counts=CivilFuturePeople.counts(f);
    this.metricSources('#futureSummary',[
      ['居民主体',this.number(counts.total,'人'),'迁居 '+f.migrated+' + 出生 '+f.born+' + 新人格 '+f.created+' − 寿终 '+f.dead+' − 在途 '+CivilFuturePeople.away(f)+'；身体转换不产生新人。'],
      ['身体',counts.bio+' 生物 / '+counts.mechanical+' 完整机械 / '+counts.synthetic+' 合成','生物含基因与义体居民，身份与公民资格另列。'],
      ['储能',this.number(f.charge),'产生 '+f.energy.generated+' − 实耗 '+f.energy.used+' − 溢出 '+f.energy.spill],
      ['住房',f.assets.housing*240+'床','每处住房240床；现住 '+counts.total+'，在途预留 '+CivilFuturePeople.away(f)+'。'],
      ['连续服务',Math.floor(f.stable/60)+'期','已结算 '+f.rounds+'期；连续时间仅在口粮、诊疗、电力和公共维护均实付时累计，中断后重算。']]);
    if($('#futureLedger').prop('open'))this.rows('#futureLedger > div',[...this.ledger(f.stock,f.book,{},s.civilization.polishVersion===1),['当前储电',this.number(f.charge),'累计产生 '+f.energy.generated+' − 实耗 '+f.energy.used+' − 溢出 '+f.energy.spill],['身体安全',f.geneSafety+' / 100'],['机械磨损',f.machineWear+' / 100'],['公共设施',f.condition+' / 100']]);
    if($('#futureLife').prop('open')){const n=CivilFuturePeople.counts(f);this.rows('#futureLife > div',[
      ['现住 / 在途',this.number(n.total)+' / '+this.number(CivilFuturePeople.away(f))+'人','迁居 '+f.migrated+' + 出生 '+f.born+' + 新人格 '+f.created+' − 寿终 '+f.dead+' = 持续主体 '+CivilFuturePeople.total(f)],
      ['生物 / 完整机械 / 合成',n.bio+' / '+n.mechanical+' / '+n.synthetic+'人','身体分类互斥；基因和义体仍属于生物身体，不再重复加到总人口。'],['公民',n.citizens+'人','按已生效的居住、公民资格与人格法律统计，不因身体材料自动剥夺身份。'],['当前劳力',n.workers+'人'],['实际退休',Math.max(0,n.total-n.workers-n.children)+'人'],['公共权利',Object.entries(f.laws).map(([k,v])=>CivilFutureContent.laws[k].values[v]).join(' · ')]
    ]);}
    const issues=[];
    if(f.careMandate&&counts.bio*.06+counts.gene*.03+(f.tech.ecology?1:0)>(f.assets.clinic||0)*16)issues.push({text:'药物日耗超过本站配制能力：扩容临床或承担持续进口',section:f.careMandate.version===1?'mandate':'construction',task:f.careMandate.version===1?'clinical_upgrade':'build_clinic'});
    if(f.last&&!f.last.treated)issues.push({text:'诊疗缺药或缺员',section:'people'});
    if(f.last&&!f.last.maintained)issues.push({text:'公共维护缺料或缺电',section:'production'});
    if(f.quarantined)issues.push({text:'人格系统隔离中',section:'people'});
    if(f.echo?.stage==='choice')issues.push({text:'调查队等待现场决定',section:'echo'});
    for(const [field,job,min,text]of [['research','research',12,'研究缺少12名实际人员'],['adoption','adoption',8,'临床登记缺少8名实际人员'],['project','construction',12,'施工缺少12名实际人员']])if(f.last&&f[field]&&f[field].at<f.last.at&&(f.last.workers[job]||0)<min)issues.push({text,section:'mandate'});
    if(f.last&&!f.last.fed)issues.push({text:'共同体口粮未覆盖',section:'production'});if(f.last&&!f.last.powered)issues.push({text:'电力与身体供养不足',section:'production'});if(f.machineWear>=30)issues.push({text:'机械身体需要维修',section:'people'});if(f.geneSafety<90)issues.push({text:'基因随访需要恢复',section:'people'});
    this.alerts('#futureSummary > .civil-notices',issues.map(x=>({text:x.text,go:()=>{CivilFutureView.section=x.section;CivilFutureView.task=x.task||'';CivilFutureView.refresh(State);Engine.travelTo(CivilInterface.researchModule);this.focus('#futureDesk');}})));
  },
  polity(s){const d=s.civilization.polity;if(!d)return;
    const pop=[['北岸',this.number(CivilDomain.known(s),'人')],['东原',this.number(CivilRegional.known(s),'人')],...Object.entries(d.peers).filter(([id])=>d.world.nodes[id].joinedAt!==null).map(([id,p])=>[CivilCensus.regions[id],this.number(CivilDomain.count(p.local),'人')])];if(d.future)pop.push(['先进共同体（含在途）',this.number(CivilFuturePeople.total(d.future),'人')]);
    this.metricSources('#politySummary',[...pop,['口径','上述名册相加；原城市居民另列，不重复并入地区。'],['履约 / 认可',d.stable+'秒 / '+d.legitimacy+'','按共同份额、地方同意与公共支出实际结算。'],['公共在途',d.cargo.filter(v=>v.arrivedAt===null).length+'班','未抵达的地方分担运单。实到后才入公共仓。']]);
    if($('#polityBook').prop('open'))this.rows('#polityBook > p',this.ledger(d.world.nodes.north.stores,d.public,{},s.civilization.polishVersion===1));
    if(CivilPolityView.section==='institutions')this.rows('#polityDetail',[['本期责任',d.lastService?.paid?'已实付':d.lastService?.reason||'待结算'],['实付 / 延后',d.paid+' / '+d.missed+'期','过去未付不抹去；恢复只承担未来与明确的旧承诺。'],['现行国约',Object.entries(d.laws).map(([k,v])=>CivilPolity.laws[k][v]).join(' · ')],['正在审议',d.proposal?'剩余 '+Math.max(0,d.proposal.at+600-s.civilization.elapsed)+' 秒':'无']]);
    const issues=[],go=section=>()=>{CivilConurbationView.select('domain');CivilPolityView.section=section;CivilPolityView.refresh(State);this.focus('#polityDesk');};
    if(d.lastService&&!d.lastService.paid)issues.push({text:d.lastService.reason,go:go('institutions')});const f=d.world.foreign;if(f){for(const [id,a]of Object.entries(f.actors))if(a.overdueAt!==null)issues.push({text:(CivilCensus.regions[id]||'共同机构')+'清算逾期',go:go('trade')});if(Object.values(f.pairs).some(p=>p.phase==='war'))issues.push({text:'边境战争影响生产和供给',go:go('conflict')});}this.alerts('#politySummary > .civil-notices',issues);
  },
  domain(s){const d=s.civilization.domain,n=d?.node;if(!n)return;
    this.metricSources('#domainSummary',[
      ['当地居民',this.number(CivilDomain.count(n),'人'),'普查 '+d.origin.population+' + 出生 '+n.born+' − 死亡 '+n.dead+' − 迁居 '+(s.civilization.polity?.future?.migrated||0)+'。原城市另有名册。'],
      ['共同责任',this.number(CivilDomain.governed(s),'人'),d.mode==='shared'?'依据共同服务协约涵盖当地居民；签约不生成或迁移人口。':'互市/未签约不纳入共同服务。'],
      ['健康与维护',n.health+' / '+n.condition,'最近实际供养：'+(n.economy?.fed?'粮已付':'粮待恢复')+'，'+(n.economy?.treated?'诊疗已付':'诊疗待恢复')+'，'+(n.economy?.maintained?'维护已付':'维护待恢复')+'。']]);
    if($('#domainAccounts').prop('open'))this.rows('#domainAccounts > p',[
      ['北岸现住人口',this.number(CivilDomain.count(n),'人'),'普查 '+d.origin.population+' + 出生 '+n.born+' − 死亡 '+n.dead+' − 迁往共同体 '+(s.civilization.polity?.future?.migrated||0)+'；不含原城市重复人口。'],
      ['实际劳力',this.number(CivilPopulation.workforce(n.cohorts),'人')],...this.ledger(n.stores,n.budget,d.origin.stores,s.civilization.polishVersion===1)]);
  },
  refresh(s){
    if(typeof document==='undefined')return;
    this.earth(s);this.future(s);this.polity(s);this.domain(s);
    if($('#citySection_census').is(':visible'))this.census(s,'#cityWorldBook > p');
    const national=!!s.civilization.polity?.foundedAt;$('#location_city').text(national?'地区与国家':'城域');
    if(national&&CivilCityView.module&&this.arrivedWorld!==s.civilization){this.arrivedWorld=s.civilization;CivilConurbationView.select('domain');if(Engine.activeModule===Room)Engine.travelTo(CivilCityView.module);}
  }
};
