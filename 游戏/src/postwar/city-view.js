/* MPL-2.0 — Native ADR district page, progressively disclosed and read-only until an action. */
var CivilCityView={
  selected:null,view:'overview',module:null,
  reset(){this.selected=null;this.view='overview';this.module=null;if(typeof CivilConurbationView!=='undefined')CivilConurbationView.reset();},
  act(fn){if(fn()){Engine.saveGame();Civilization.updateIncome();Civilization.refresh();}},
  amount(n){return Number((n||0).toFixed(1)).toLocaleString('zh-CN');},
  cost(cost){return Object.entries(cost).map(([k,v])=>(CivilText.labels[k]||k)+' '+this.amount(v)).join('、');},
  button(id,text,host,reason,action){const b=Civilization.button(id,text,host,()=>this.act(action));b.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(text));b.attr('title',reason||'');Button.setDisabled(b,!!reason);return b;},
  ensure(){
    if(this.module)return;const module=this.module={onArrival(diff){document.title='城域';Engine.moveStoresView(null,diff);}};
    module.tab=Header.addLocation('城域','city',module);module.panel=$('<div>').attr('id','cityPanel').addClass('location').appendTo('#locationSlider');
    module.body=$('<div>').attr('id','cityBody').appendTo(module.panel);
    // Desktop city details scroll inside this page. Keep the native header and
    // resource column from scrolling with a focused control in the clipped slider.
    $('#main').off('scroll.civilCity').on('scroll.civilCity',function(){if(Engine.activeModule===module&&!Engine.narrow()&&this.scrollTop)this.scrollTop=0;});
    $('<div>').attr('id','cityOverview').appendTo(module.body);
    $('<p>').attr('id','cityContext').appendTo(module.body);
    $('<div>').attr({'id':'cityViews',role:'group','aria-label':'城域信息分类'}).addClass('civil-tabs').appendTo(module.body);
    $('<div>').attr('id','cityMap').addClass('city-map').appendTo(module.body);
    $('<div>').attr('id','cityMapTitle').text('山谷地图').appendTo('#cityMap');
    $('<div>').attr({'id':'citySketch','aria-label':'山谷字符地图，可选择片区查看经营详情'}).appendTo('#cityMap');
    $('<div>').attr({'id':'cityTerrain','aria-hidden':'true'}).appendTo('#citySketch');
    $('<div>').attr('id','cityMapNodes').appendTo('#citySketch');
    $('<p>').attr('id','cityMapLegend').text('^ 山地　♣ 林地　~ 河渠　# 已通道路').appendTo('#cityMap');
    $('<div>').attr({'id':'cityWardSelect',role:'group','aria-label':'选择片区'}).appendTo('#cityMap');
    $('<div>').attr('id','cityWardSummary').appendTo(module.body);
    $('<p>').attr('id','cityWardBrief').appendTo(module.body);
    for(const key of ['overview','census','production','works','transport'])$('<div>').attr('id','citySection_'+key).addClass('city-section').appendTo(module.body);
    $('<p>').attr('id','cityUnknown').appendTo('#citySection_overview');$('<div>').attr('id','cityContacts').appendTo('#citySection_overview');
    $('<div>').attr('id','cityCensusRows').appendTo('#citySection_census');
    $('<details>').addClass('civil-details').attr('id','cityWorldBook').appendTo('#citySection_census');$('<summary>').text('世界与人口口径').appendTo('#cityWorldBook');$('<p>').appendTo('#cityWorldBook');
    $('<p>').attr('id','cityEmployment').appendTo('#citySection_production');$('<div>').attr('id','cityPriorities').appendTo('#citySection_production');$('<div>').attr('id','cityMethods').appendTo('#citySection_production');
    $('<details>').addClass('civil-details').attr('id','cityBudget').appendTo('#citySection_production');$('<summary>').text('公仓收支与维护明细').appendTo('#cityBudget');$('<dl>').appendTo('#cityBudget');
    $('<p>').attr('id','cityWorkStatus').appendTo('#citySection_works');$('<div>').attr('id','cityWorks').appendTo('#citySection_works');
    $('<p>').attr('id','cityShippingStatus').appendTo('#citySection_transport');$('<div>').attr('id','cityShipping').appendTo('#citySection_transport');
    $('<details>').addClass('civil-details').attr('id','cityHistory').appendTo(module.body);$('<summary>').text('片区发展记录').appendTo('#cityHistory');$('<ol>').appendTo('#cityHistory');
    Engine.updateSlider();
  },
  map(s){
    const d=CivilCity.data(s),cfg=CivilCityContent.map,grid=[],root=$('#cityTerrain');
    // Stable topography from the old survey. Settlement knowledge and usable roads
    // come from the actual district state, never from decorative random rolls.
    for(let y=0;y<cfg.height;y++)for(let x=0;x<cfg.width;x++){
      let glyph='·',kind='plain';const river=22+Math.round(Math.sin(y/3));
      if(y<5&&x<18-y*2||x<3&&y<12){glyph='^';kind='mountain';}
      else if(x>24&&y>10||(x<8&&y>13)){glyph='♣';kind='forest';}
      else if(x>=4&&x<=8&&y>=5&&y<=8){glyph='≡';kind='field';}
      else if(x>=24&&x<=28&&y>=3&&y<=7){glyph='▪';kind='ruins';}
      if(x===river||x===river+1){glyph='~';kind='water';}
      grid.push({glyph,kind});
    }
    for(const [id,points]of Object.entries(cfg.routes)){
      const n=d.wards[id];if(n.contactedAt===null)continue;
      for(let i=1;i<points.length;i++){
        let [x,y]=points[i-1];const [tx,ty]=points[i];
        while(true){grid[y*cfg.width+x]={glyph:n.buildings.road?'#':':',kind:n.buildings.road?'road':'trail'};if(x===tx&&y===ty)break;x+=Math.sign(tx-x);y+=Math.sign(ty-y);}
      }
    }
    const signature=grid.map(c=>c.glyph).join('');
    if(root.attr('data-map')!==signature){root.empty().attr('data-map',signature);for(const cell of grid)$('<span>').addClass('city-ground-'+cell.kind).text(cell.glyph).appendTo(root);}
    const place=(node,[x,y])=>node.css({left:((x+.5)/cfg.width*100)+'%',top:((y+.5)/cfg.height*100)+'%'});
    if(!$('#cityMapHome').length){const home=$('<span>').attr('id','cityMapHome').addClass('city-map-home').appendTo('#cityMapNodes');$('<b>').text('@').appendTo(home);$('<span>').text('原镇').appendTo(home);place(home,cfg.home);}
    for(const [id,n]of Object.entries(d.wards)){
      const item=CivilCityContent.wards[id],known=n.contactedAt!==null;
      let button=$('#cityMapNode_'+id);
      if(!button.length){button=$('<button>').attr({id:'cityMapNode_'+id,type:'button'}).addClass('city-map-node').appendTo('#cityMapNodes');$('<b>').appendTo(button);$('<span>').appendTo(button);button.on('click',()=>{this.selected=id;if(CivilCity.data(State).wards[id].contactedAt===null)this.view='overview';this.refresh(State);});place(button,item.position);}
      button.children('b').text(known?'■':'?');button.children('span').text(known?item.name:'待普查');
      button.attr({'aria-label':item.name+'，'+(known?(n.buildings.road?'道路已通':'道路待修'):'未普查')+'，选择查看','aria-pressed':this.selected===id,title:item.name}).toggleClass('selected',this.selected===id).toggleClass('unknown',!known);
    }
    $('#cityMapTitle').text('山谷地图 · '+Object.values(d.wards).filter(n=>n.contactedAt!==null).length+' / 3 处已普查');
    $('#cityMapLegend').text('^ 山地　♣ 林地　~ 河渠　# 已通道路'+(Object.values(d.wards).some(n=>n.contactedAt!==null&&!n.buildings.road)?'　: 待修通路':''));
  },
  issues(s,n){const e=n.economy;if(!e)return ['等待下一轮供养结算'];const out=[];if(!e.ate)out.push('口粮断供');if(e.water<e.population)out.push('用水不足，田地产量下降');if(!e.treated)out.push('诊疗供给不足');if(!e.educated)out.push('儿童教学不足');if(!e.administered)out.push('公共行政缺物资');if(n.health<60)out.push('健康低于60');if(e.blocked.length)out.push('部分工序缺原料，可切换工序或安排援助');return out;},
  refresh(s){
    if(!CivilCity.available(s)||typeof document==='undefined')return;
    this.ensure();if(typeof CivilConurbationView!=='undefined'&&CivilConurbationView.refresh(s))return;const d=CivilCity.data(s),known=Object.entries(d.wards).filter(([,n])=>n.contactedAt!==null),members=CivilCity.members(s),pop=CivilCity.population(s);
    if(!this.selected&&known.length)this.selected=known[0][0];
    const id=this.selected,n=d.wards[id],cfg=CivilCityContent.wards[id],issues=members.flatMap(([k,x])=>this.issues(s,x).map(t=>CivilCityContent.wards[k].name+'：'+t));
    CivilInterface.summary('#cityOverview',{title:d.cityAt!==null?'炉火城域':'山谷公共服务网络',cards:[['本城居民',this.amount(pop)],['原镇居民',this.amount(s.game.population)],['纳入公共服务的片区',members.length+' / 3'],['已普查片区',known.length+' / 3']],brief:'接纳片区改变公共责任，居民继续住在原处；迁居才改变住所。',notices:[...issues.slice(0,3),...(issues.length>3?['另有 '+(issues.length-3)+' 项，请查看片区明细']:[])],details:[['本轮目标',d.cityAt!==null?'保持供养、优化分工和储备':'原镇完成服务交接；连接至少两片区，居民合计一万且服务稳定'],['公仓原则','原镇与每片区独立记账；援助和调运到货后才入库'],['规模','片区按居民群体和实际岗位容量结算，不逐人点击分工']]});
    $('#cityOverview').toggle(this.view==='overview');$('#cityContext').toggle(this.view!=='overview').text('炉火城域 · '+this.amount(pop)+' 位居民'+(issues.length?' · '+issues.length+' 项供养问题（概况可查）':''));
    const views=known.length?{overview:'概况',census:'普查',production:'生产与预算',works:'公共工程',transport:'运输'}:{overview:'概况'};
    for(const [key,label]of Object.entries(views)){const b=Civilization.button('cityView_'+key,label,'#cityViews',()=>{this.view=key;this.refresh(State);this.module.body.scrollTop(0);});b.attr('aria-pressed',this.view===key).toggleClass('selected',this.view===key);}
    for(const key of ['overview','census','production','works','transport'])$('#citySection_'+key).toggle(this.view===key);
    this.map(s);$('#citySketch,#cityMapTitle,#cityMapLegend').toggle(this.view==='overview'||this.view==='works');
    for(const [key,x]of known){const b=Civilization.button('cityWard_'+key,CivilCityContent.wards[key].name,'#cityWardSelect',()=>{this.selected=key;this.refresh(State);});b.attr('aria-pressed',id===key).toggleClass('selected',id===key);}
    $('#cityUnknown').text(d.contact?'普查队前往'+CivilCityContent.wards[d.contact.id].name+'，还需 '+d.contact.remaining+' 秒。':known.length===3?(members.length===3?'各片区已纳入公共服务，可在生产、工程与运输中调整经营。':'山谷的三处住区已普查，选择片区查看共同治理条件。'):'旧测绘图记着这片山谷中的住区。先普查人数与设施，再决定共同修路、改善水务。');
    for(const [key,x]of Object.entries(d.wards)){const b=this.button('citySurvey_'+key,'普查'+CivilCityContent.wards[key].name,'#cityContacts',CivilCity.contactReason(s,key),()=>CivilCity.contact(State,key));b.toggle(x.contactedAt===null).attr('title',CivilCity.contactReason(s,key)||'旅费：'+this.cost(CivilCityContent.contactCost)+'；两名空闲成人，180秒');}
    $('#cityWardSummary').toggle(!!n&&n.contactedAt!==null&&this.view==='overview');$('#cityWardBrief').toggle(!!n&&n.contactedAt!==null&&this.view!=='overview');$('#cityJoin').toggle(!!n&&n.contactedAt!==null&&n.joinedAt===null);if(!n||n.contactedAt===null)return;
    const p=CivilCity.count(n),e=n.economy,localIssues=this.issues(s,n),children=CivilPopulation.children(n.cohorts),labor=CivilCity.workforce(n);
    $('#cityWardBrief').text(cfg.name+' · '+this.amount(p)+'人 · 健康 '+Math.floor(n.health)+' · '+(localIssues.length?localIssues.slice(0,2).join('；'):'供养正常'));
    CivilInterface.summary('#cityWardSummary',{title:cfg.name+' · '+(n.joinedAt===null?'独立住区':'本城片区'),cards:[['居民',this.amount(p)],['健康',Math.floor(n.health)+' / 100'],['空床',this.amount(CivilCity.housing(s,id)-p)],['用水',e?this.amount(Math.min(e.water,p))+' / '+this.amount(p):'待结算'],['粮食 / 10秒',e?CivilInterface.signed(e.food):'待结算'],['服务稳定',n.stable>=120?'已稳定（'+n.stable+'秒）':n.stable+' / 120秒']],brief:cfg.description,notices:localIssues,details:[['居民总数口径','全为实际住在本片区的人，未合并进原镇住房或劳力'],['原有资产','居住、农田、课堂和工坊来自战前后的持续生活；普查不赠送资产'],['接纳条件',CivilCity.joinReason(s,id)||'已满足，可登记共同公共职责']]});
    this.button('cityJoin','登记共同公共职责','#cityContacts',CivilCity.joinReason(s,id),()=>CivilCity.join(State,this.selected)).toggle(n.joinedAt===null);
    $('#cityCensusRows').text('成年劳力 '+this.amount(labor)+'；儿童 '+this.amount(children)+'；退休居民 '+this.amount(p-labor-children)+'。累计出生 '+n.born+'，累计死亡 '+n.dead+'，净迁居 '+CivilCityHomes.delta(s,this.selected)+'。变异居民 '+this.amount(CivilPopulation.count(n.cohorts.filter(c=>c.identity==='mutant')))+'；他们与其他居民使用同一套供养和服务。');
    $('#cityWorldBook p').text('已知地区：'+CivilCensus.known(s).map(r=>r.name+' '+this.amount(r.count)).join('；')+'。\n八个大区的其他居民尚未普查，不显示后台精确数。普查、加盟、迁徙不改变全球人数，出生和死亡才改变生物人口总量。');
    $('#cityEmployment').text(Object.entries(n.workers).filter(([,v])=>v>0).map(([j,v])=>({waterworker:'取水与水务',farmer:'农业',medic:'诊疗',teacher:'教育',smith:'制器',salvager:'回收',gatherer:'木料',builder:'施工',driver:'运输',smelter:'冶炼',apprentice:'学员',tutor:'专业教员',clerk:'公署记录',publiccourier:'公共接力',publicclerk:'共同事务',steward:'生产办事',publicbuilder:'公共施工',homekeeper:'社区维护',settler:'合作岗位',jobbuilder:'接续施工',jobclerk:'就业办事',joblearner:'岗位学员',jobtutor:'岗位教员',wageworker:'轮班劳务',wagebuilder:'劳务工位安装'}[j]||j)+' '+v).join(' · ')+'。未安排 '+(e?.idle||0)+'。实际产量受库存、工序与用水限制。');
    for(const [key,label]of Object.entries(CivilCityContent.priorities))this.button('cityPriority_'+key,label,'#cityPriorities',n.joinedAt===null?'独立住区保留本地决定':n.priority===key?'当前优先级':null,()=>CivilCity.set(State,this.selected,'priority',key));
    for(const [key,label]of Object.entries(CivilCityContent.methods))this.button('cityMethod_'+key,label,'#cityMethods',n.joinedAt===null?'先取得共同治理授权':n.method===key?'当前工序':key==='standard'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards)?'需要机械传动与标准计量':null,()=>CivilCity.set(State,this.selected,'method',key));
    const rows=CivilCityContent.resources.map(k=>[CivilText.labels[k]||k,'库存 '+this.amount(n.stores[k])+'；近轮 '+CivilInterface.signed(e?.flow[k]||0)+'；累计产出 '+this.amount(n.budget.produced[k])+' / 消耗 '+this.amount(n.budget.consumed[k])+' / 收货 '+this.amount(n.budget.received[k])+' / 发货 '+this.amount(n.budget.sent[k])]);
    const dl=$('#cityBudget dl');if(dl.children().length!==rows.length*2){dl.empty();for(const row of rows){$('<dt>').appendTo(dl);$('<dd>').appendTo(dl);}}rows.forEach(([k,v],i)=>{dl.children().eq(i*2).text(k);dl.children().eq(i*2+1).text(v);});
    $('#cityWorkStatus').text(n.project?CivilCityContent.projects[n.project.type].name+' · '+(n.project.phase==='transport'?'材料运输':'当地建设者施工')+' · 还需 '+n.project.remaining+(n.project.phase==='transport'?'秒':'单位工时')+'；当前施工岗位 '+(n.workers.builder||0)+'。':'当地没有在建工程。建材由原镇公仓实付，当地居民承担施工与持续供养。');
    for(const [type,project]of Object.entries(CivilCityContent.projects))this.button('cityBuild_'+type,project.name+'（'+n.buildings[type]+'/'+project.max+'）','#cityWorks',CivilCity.projectReason(s,id,type),()=>CivilCity.startProject(State,this.selected,type)).attr('title',(CivilCity.projectReason(s,id,type)||'原镇实付：'+this.cost(project.cost))+'。'+project.detail);
    this.button('cityWater',n.waterEnabled?'暂停水务值守':'恢复水务值守','#cityWorks',n.joinedAt===null?'独立住区保留本地调度':null,()=>CivilCity.set(State,this.selected,'waterEnabled',!CivilCity.data(State).wards[this.selected].waterEnabled));
    const trips=d.shipments.filter(p=>p.source===id||p.target===id);
    $('#cityShippingStatus').text('已实际到货 '+d.arrived+' 批。'+(trips.length?trips.map(p=>(p.source==='home'?'原镇':CivilCityContent.wards[p.source].name)+' → '+CivilCityContent.wards[p.target].name+'：'+(p.phase==='outbound'?this.cost(p.cargo)+'在途':'已交付、原车返程')+' '+p.remaining+'秒').join('；'):'此片区暂无在途货物。')+' 公共车队仅在已接纳片区间调拨真实余货，保留来源储备。');
    this.button('cityFreight',n.freightEnabled?'暂停片区公共发货':'恢复片区公共发货','#cityShipping',n.joinedAt===null?'先登记共同公共职责':null,()=>CivilCity.set(State,this.selected,'freightEnabled',!CivilCity.data(State).wards[this.selected].freightEnabled));
    this.button('cityAid','原镇派一车援助','#cityShipping',CivilCity.aidReason(s,id),()=>CivilCity.aid(State,this.selected)).attr('title',CivilCity.aidReason(s,id)||'食物96、药品12、工具12；另付旅粮6、木料1；两名原镇空闲成人驾驶，去返各120秒。');
    const history=d.history.filter(e=>e.id===id||e.kind==='city').slice(-30),ol=$('#cityHistory ol');if(ol.children().length!==history.length){ol.empty();for(const x of history)$('<li>').appendTo(ol);}history.forEach((x,i)=>ol.children().eq(i).text('重建 '+Math.floor(x.at/600)+' 年：'+x.text));
    if(typeof CivilCityInstitutionsView!=='undefined')CivilCityInstitutionsView.refresh(s,id);
  }
};
