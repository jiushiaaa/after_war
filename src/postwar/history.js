/* MPL-2.0 — Read-only views of existing records; no saved history or simulation hooks. */
var CivilHistory={
  PAGE_SIZE:6,
  categories:{tenures:'全部任期',policy:'配给抉择',governance:'制度议决',technology:'科技',cities:'城市与镇制',agreements:'来源协议',projects:'竣工工程',budgets:'共同约定',metro:'城市群',incidents:'道路抉择',heating:'供暖交接',relief:'地方救济'},
  unknownDate:'已有成果，原存档未记达成年份',
  available(s){const c=s?.civilization;return !!c&&(c.settled===true||Object.values(c.tech||{}).some(v=>v===true)||(c.society?.history?.length||0)>0);},
  time(s,value){return Number.isFinite(value)&&value>=0&&value<=s.civilization.elapsed?value:null;},
  place(s,id){return id==='home'?(s.civilization.urban?.city?'炉火城':'本地聚落'):(typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.name:null)||id;},
  knownPlace(s,id){return id==='home'||s.civilization.regions?.nodes[id]?.discovered===true;},
  sourceName(id){return (typeof CivilOriginContent!=='undefined'?CivilOriginContent[id]?.name:null)||id;},
  facility(type){return (typeof CivilServiceContent!=='undefined'?CivilServiceContent.facilities[type]?.name:null)||(typeof CivilMunicipalContent!=='undefined'?CivilMunicipalContent.facilities[type]?.name:null)||(typeof CivilAdvancedContent!=='undefined'?CivilAdvancedContent.facilities[type]?.name:null)||type;},
  policyName(value){return value===null?'尚未议定':(typeof CivilRules!=='undefined'?CivilRules.policies[value]?.name:null)||value;},
  axisName(axis,value){return (typeof CivilSociety!=='undefined'?CivilSociety.axes[axis]?.choices[value]?.name:null)||value;},
  costText(cost){
    const labels={food:'粮食',wood:'木料',iron:'铁',steel:'钢材',glass:'玻璃',parts:'零件',tools:'工具',knowledge:'知识',medicine:'药品',coal:'煤'};
    return Object.entries(cost||{}).filter(([,n])=>Number.isFinite(n)&&n>0).map(([id,n])=>(labels[id]||id)+' '+n).join('、');
  },
  snapshot(s){
    const c=s.civilization||{},x=c.society,entries=[],seen=new Set(),year=Math.floor((c.elapsed||0)/600);
    const add=(key,category,title,detail='',at=null,extra={})=>{
      if(seen.has(key))return;seen.add(key);
      entries.push({key,category,title,detail,at:this.time(s,at),...extra});
    };
    for(const h of x?.history||[]){
      const reason={death:'因前任离世而完成交接',retirement:'退休交接',election:'选举交接',regency:'摄政结束后的交接'}[h.reason]||'职责交接';
      add('tenure_'+h.generation,'tenures','第'+h.generation+'任 '+h.title,'交接时'+h.age+'岁；'+reason+'。',null,{generation:h.generation,from:h.from,to:h.to,current:false});
    }
    let current=null;
    if(x?.leader){
      const leader=x.leader,detail=leader.alive?'现任，'+leader.age+'岁。':'已经离世，等待交接；现存记录未记离世年份。';
      current={title:'第'+x.generation+'任 '+leader.title,detail,from:leader.started};
      add('tenure_'+x.generation,'tenures',current.title,detail,null,{generation:x.generation,from:leader.started,to:null,current:true});
    }
    const decisions=c.decisions,baseline=decisions?.baseline||{policy:c.policy||null,axes:x?.axes||{}};
    if(baseline.policy)add('policy_baseline','policy',this.policyName(baseline.policy),'接入时已有的配给；原档未记采纳时间与此前变更。');
    for(const [axis,value]of Object.entries(baseline.axes))add('governance_baseline_'+axis,'governance',this.axisName(axis,value),'接入时已有的制度；原档未记确立时间与此前变更。');
    for(const r of decisions?.records||[]){
      const term='第'+r.generation+'任期间。',key='decision_'+r.id;
      if(r.kind==='policy')add(key,'policy',r.from===null?'初次议定配给':'调整配给',term+this.policyName(r.from)+' → '+this.policyName(r.to)+'。口粮与产出按新配给持续结算。',r.at);
      else {
        const axisTitle=typeof CivilSociety!=='undefined'?CivilSociety.axes[r.axis]?.title:r.axis;
        const previous=this.axisName(r.axis,r.from),next=this.axisName(r.axis,r.to);
        const reference=r.proposalId===0?'承接原存档中已预留的改革；原动议时间未知。':'承接第'+r.proposalId+'号动议。';
        if(r.kind==='founding')add(key,'governance','确立：'+axisTitle,term+'初次采用'+next+'。行政职责按制度持续结算。',r.at);
        if(r.kind==='proposal')add(key,'governance','第'+r.id+'号动议：'+axisTitle,term+'现制为'+previous+'；实际预留'+r.knowledge+'知识，尚未改制。',r.at);
        if(r.kind==='reform')add(key,'governance','改制：'+axisTitle,term+previous+' → '+next+'。'+reference+'预留的'+r.knowledge+'知识转为改制支出，不再次扣款。',r.at);
        if(r.kind==='cancel')add(key,'governance','保留现制：'+axisTitle,term+'继续采用'+previous+'。'+reference+'实际退回'+r.knowledge+'知识。',r.at);
      }
    }
    for(const [id,learned]of Object.entries(c.tech||{}))if(learned===true)add('technology_'+id,'technology',(typeof CivilText!=='undefined'?CivilText.research[id]?.name:null)||id,'已完成研究。');
    if(c.settled)add('settlement_home','cities','聚落形成','炉火、口粮与分工曾达到稳定条件。');
    if(c.urban?.chartered)add('town_home','cities','本地镇制登记','公共职责已经写入镇制。');
    if(c.urban?.city)add('city_home','cities','炉火城登记','第一座城市的公共职责已经登记。');
    for(const [id,m]of Object.entries(c.municipal?.nodes||{})){
      if(!this.knownPlace(s,id))continue;
      if(m.town)add('town_'+id,'cities',this.place(s,id)+'镇制登记');
      if(m.city)add('city_'+id,'cities',this.place(s,id)+'城市登记');
      for(const p of m.completed||[])add('municipal_'+id+'_'+p.id,'projects',this.place(s,id)+' · '+this.facility(p.type),'市政营建竣工记录。',p.completedAt);
    }
    for(const [id,n]of Object.entries(c.origins?.nodes||{})){
      // Unknown societies may already have built classrooms; their private records are
      // not revealed until actual contact has happened.
      if(!['contacted','agreed'].includes(n.status))continue;
      if(n.status==='agreed'&&n.permit?.paid){
        const a=n.agreement,home=this.costText(a?.home),source=this.costText(a?.source);
        add('origin_agreement_'+id,'agreements',this.sourceName(id)+'迁居协议','累计迁居额度'+n.permit.limit+'人；已抵达'+n.admitted+'人。'+(home?'本地实付：'+home+'。':'')+(source?'来源实付：'+source+'。':''),a?.agreedAt);
      }
      for(const [i,p]of (n.schooling?.completed||[]).entries())add('origin_school_'+id+'_'+(i+1),'projects',this.sourceName(id)+' · 第'+(i+1)+'次学舍扩班','来源自付：'+this.costText(p.paid)+'。',p.completedAt);
    }
    for(const [id,m]of Object.entries(c.services?.nodes||{})){
      if(!this.knownPlace(s,id))continue;
      for(const p of m.completed||[])add('services_'+id+'_'+p.id,'projects',this.place(s,id)+' · '+this.facility(p.type),'公用工程竣工记录。'+(p.paid?'实付：'+this.costText(p.paid)+'。':''),p.completedAt);
    }
    for(const [id,p]of Object.entries(c.regions?.projects||{}))if(this.knownPlace(s,id)&&p.status==='complete'){
      const name=(typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.project?.name:null)||this.place(s,id)+'公共工程';
      add('public_project_'+id,'projects',name,'公共工程已完成。',p.completedAt);
    }
    for(const [id,p]of Object.entries(c.regions?.upgrades?.projects||{}))if(this.knownPlace(s,id)&&p.status==='complete')add('freight_upgrade_'+id+'_'+p.id,'projects',this.place(s,id)+' · 加固货车','原货车的付费改装已经完成。',p.completedAt);
    for(const a of c.finance?.agreements||[]){
      const members=a.members.map(id=>this.place(s,id)).join('、'),costs=Object.entries(a.approvals||{}).map(([id,n])=>this.place(s,id)+' '+n+'知识').join('；');
      add('common_agreement_'+a.id,'budgets','第'+a.id+'份诊疗与道路互助约定',members+'。议约实际支出：'+costs+'。各地仍保管自己的仓库。',a.approvedAt);
      if(a.exitedAt!==null)add('common_exit_'+a.id,'budgets','第'+a.id+'份互助约定退出','停止新承诺；旧车队和实付记录按原账保留。',a.exitedAt);
    }
    if(c.metro?.formedAt!==null&&Number.isFinite(c.metro?.formedAt)){
      const members=(c.metro.formedMembers||[]).map(id=>this.place(s,id)).join('、');
      add('metro_charter','metro','城市群共同职责登记',members+'。以连续供养和实付互助共同承担公共职责；仍须维持各城服务。',c.metro.formedAt);
    }
    for(const r of c.incidents?.records||[]){
      const place=this.place(s,r.route);
      add('road_warning_'+r.id,'incidents',place+'道路预警','巡路人员发现松动路基，提出加固或交通安排。',r.createdAt);
      if(r.chosenAt!==null)add('road_choice_'+r.id,'incidents',place+'道路安排',r.choice==='hold'?'暂停新发车，等已有货车与迁居队归来后封路待修。':'维持运输，接受180秒后的封路期限。',r.chosenAt);
      if(r.closedAt!==null)add('road_closed_'+r.id,'incidents',place+'道路封闭',r.choice==='hold'?'原有货车与迁居队归来后，封闭道路等待材料。':'观察期限已过，道路封闭，在途运输等待恢复。',r.closedAt);
      if(r.resolvedAt!==null)add('road_repair_'+r.id,'incidents',place+(r.outcome==='prevented'?'提前加固':'道路修复'),'实际支出：木20、工具4。'+(r.payment.mode==='auto'?'依常设维护安排付款。':'居民决定付款修复。'),r.resolvedAt);
    }
    for(const [id,h]of Object.entries(c.heating?.nodes||{}))if(h.handedOverAt!==null)add('heat_handover_'+id,'heating',this.place(s,id)+'日常供暖交接','实付试运行覆盖'+h.handover.proof.capacity+'人份，接管'+h.handover.population+'位居民与'+h.handover.reserved+'位在途预留。'+(id==='home'?'旧炉自动添柴和工匠固定产木退出，由实际居民承担。':'当地人员与仓库继续承担燃料和维护。'),h.handedOverAt);
    for(const o of c.relief?.orders||[]){
      const place=this.place(s,o.target),key='relief_'+o.id;
      add(key+'_request','relief',place+'救济申请','申请有限物资：'+this.costText(o.cargo)+'。请求本身不扣款，等待原货车与主城储备。',o.requestedAt);
      if(o.dispatchedAt!==null)add(key+'_dispatch','relief',place+'救济出发','主城实付货物与旅费：'+this.costText(o.paid)+'。由原车与实际运输工负责。',o.dispatchedAt);
      if(o.deliveredAt!==null)add(key+'_delivery','relief',place+'救济入库','实际送达：'+this.costText(o.cargo)+'。进入地方原仓，健康与生产仍由实际供养恢复。',o.deliveredAt);
      if(o.cancelledAt!==null)add(key+'_cancel','relief',place+(o.dispatchedAt===null?'取消待发救济':'救济折返'),'未发单不付款；已付货物只在原车返抵后退回，旅费不退。',o.cancelledAt);
      if(o.refundAt!==null)add(key+'_refund','relief',place+'救济退回主城','原车实际返仓，退回：'+this.costText(o.cargo)+'。',o.refundAt);
    }
    const counts=Object.fromEntries(Object.keys(this.categories).map(category=>[category,entries.filter(e=>e.category===category).length]));
    return {year,current,entries,counts};
  },
  date(entry){
    if(entry.category==='tenures')return entry.current?'重建 '+entry.from+' 年起':'重建 '+entry.from+'—'+entry.to+' 年';
    return entry.at===null?this.unknownDate:'重建 '+Math.floor(entry.at/600)+' 年';
  },
  line(entry){return entry.title+' · '+this.date(entry)+(entry.detail?'。'+entry.detail:'');},
  sorted(entries,category){
    return entries.filter(e=>!category||e.category===category).sort((a,b)=>{
      if(category==='tenures')return b.generation-a.generation;
      const time=e=>e.at!==null?e.at:e.category==='tenures'&&!e.current?e.to*600:-1;
      return time(b)-time(a)||a.key.localeCompare(b.key);
    });
  },
  event(s){
    const view=this.snapshot(s),scenes={},go=name=>({1:name}),recent=this.sorted(view.entries.filter(e=>e.at!==null||e.category==='tenures'&&!e.current)).slice(0,this.PAGE_SIZE);
    const intro=['重建 '+view.year+' 年。'+(s.civilization.decisions?'配给与制度议决从重建 '+Math.floor(s.civilization.decisions.introducedAt/600)+' 年起记录；更早的变更与未知日期不补写。':'这里只翻阅现存档案；旧存档的政策与制度改革尚无完整记录。')];
    if(view.current)intro.push(view.current.title+' · 重建 '+view.current.from+' 年起。'+view.current.detail);
    intro.push(recent.length?'近期有年份的记录：':'尚无带年份的完成记录，已有成果可按分类查阅。');
    scenes.start={text:[...intro,...recent.map(e=>this.line(e))],buttons:{}};
    for(const [category,label]of Object.entries(this.categories)){
      const list=this.sorted(view.entries,category);if(!list.length)continue;
      scenes.start.buttons['history_'+category]={text:label+'（'+list.length+'）',nextScene:go(category+'_0')};
      const pageSize=category==='governance'?3:this.PAGE_SIZE,pages=Math.ceil(list.length/pageSize);
      for(let page=0;page<pages;page++){
        const buttons={};if(page>0)buttons.previous={text:'上一页',nextScene:go(category+'_'+(page-1))};
        if(page+1<pages)buttons.next={text:'下一页',nextScene:go(category+'_'+(page+1))};
        buttons.contents={text:'返回目录',nextScene:go('start')};buttons.close={text:'合上记录',nextScene:'end'};
        scenes[category+'_'+page]={text:[label+' · 第'+(page+1)+'/'+pages+'页',...list.slice(page*pageSize,(page+1)*pageSize).map(e=>this.line(e))],buttons};
      }
    }
    scenes.start.buttons.close={text:'合上记录',nextScene:'end'};
    for(const scene of Object.values(scenes))scene.onLoad=()=>{if(typeof $!=='undefined')$('#description',Events.eventPanel()).scrollTop(0);};
    return {title:'发展史',civilHistory:true,scenes};
  },
  open(s=State){
    if(!this.available(s)||typeof Events==='undefined'||Events.activeEvent()||s.civilization.pending)return false;
    const event=this.event(s);Events.startEvent(event,{width:520});
    event.eventPanel?.addClass('civil-history-event');return true;
  },
  refresh(s=State){
    if(typeof $==='undefined'||!s?.civilization)return false;
    if(!this.available(s)){$('#historyMenu').remove();return false;}
    const menu=$('.menu').first();if(!menu.length)return false;
    let button=$('#historyMenu');
    if(!button.length){
      const open=()=>this.open(typeof State!=='undefined'?State:s);
      button=$('<span>').attr({id:'historyMenu',role:'button',tabindex:0}).addClass('menuBtn').text('发展史').appendTo(menu).on('click',open).on('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    }
    const busy=!!s.civilization.pending||(typeof Events!=='undefined'&&!!Events.activeEvent());
    button.attr({'aria-disabled':String(busy),title:busy?'先处理当前事件，再翻阅发展史':'查看任期与现存发展记录'}).toggleClass('history-unavailable',busy);
    return true;
  },
  reset(){if(typeof $!=='undefined')$('#historyMenu').remove();}
};
