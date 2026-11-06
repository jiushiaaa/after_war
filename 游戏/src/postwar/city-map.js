/* MPL-2.0 — Read-only city geography. Symbols describe recorded uses, not new assets. */
var CivilCityMap={
  selected:{},
  profiles:{
    lake:{name:'湖滨市',terrain:'lake',industry:'工坊区',job:'smith',resource:'tools'},
    ridge:{name:'矿岭市',terrain:'ridge',industry:'冶炼区',job:'smelter',resource:'iron'},
    estuary:{name:'河口市',terrain:'delta',industry:'药务区',job:'medic',resource:'medicine'},
    bridge:{name:'桥原市',terrain:'bridge',industry:'校舍区',job:'teacher',resource:'knowledge'}
  },
  patch(grid,width,height,x,y,rx,ry,glyph,kind){
    for(let yy=Math.max(0,y-ry);yy<=Math.min(height-1,y+ry);yy++)for(let xx=Math.max(0,x-rx);xx<=Math.min(width-1,x+rx);xx++){
      const i=yy*width+xx;if(grid[i].kind!=='water')grid[i]={glyph,kind};
    }
  },
  // The original valley keeps its surveyed sites and paid roads. Uses appear only
  // after contact, and extensions only after the actual construction completes.
  valley(s,grid){
    const cfg=CivilCityContent.map;
    for(const [id,n]of Object.entries(CivilCity.data(s).wards)){
      if(n.contactedAt===null)continue;
      const [x,y]=CivilCityContent.wards[id].position;
      this.patch(grid,cfg.width,cfg.height,x,y,2,1,'▫','housing');
      this.patch(grid,cfg.width,cfg.height,x,y-2,2,0,id==='terraces'?'≡':id==='yards'?'▥':'+',id==='terraces'?'field':id==='yards'?'industry':'service');
      if(n.buildings.housing)this.patch(grid,cfg.width,cfg.height,x-2,y+2,Math.min(3,n.buildings.housing),0,'▫','housing');
      if(n.buildings.water)this.patch(grid,cfg.width,cfg.height,x+2,y+1,0,0,'+','service');
      if(n.project)this.patch(grid,cfg.width,cfg.height,x-2,y+1,0,0,'◇','building');
    }
  },
  road(s,id){
    if(id==='lake'){
      const r=s.civilization.conurbation?.route;
      return !r?'尚未修通':r.phase!=='ready'?'道路施工中':r.condition<20?'道路待检修':'已连通';
    }
    const r=id==='ridge'?s.civilization.cityNetwork?.road:s.civilization.cityCouncil?.projects.find(p=>p.kind==='road'&&p.target===(id==='bridge'?'academy':'river'));
    return !r?'尚未修通':r.completedAt===null?'道路施工中':'已连通';
  },
  projects(s,id){
    const out=[],n=CivilCity.node(s,id),c=s.civilization;
    if(n?.project)out.push({zone:n.project.type==='housing'?'housing':n.project.type==='water'?'services':'transport',text:CivilCityContent.projects[n.project.type].name});
    for(const p of c.cityCouncil?.projects||[]){
      if(p.completedAt!==null||!p.sites[id])continue;
      out.push({zone:p.kind==='road'?'transport':'housing',text:p.kind==='road'?CivilCityCouncil.links[p.target].name:CivilCityHomes.schemes[p.kind]?.name||'安居扩容'});
    }
    if(id==='lake'&&c.conurbation.workshop?.completedAt===null)out.push({zone:'industry',text:'地方工坊扩建'});
    const office=c.cityCouncil?.offices[id];if(office?.completedAt===null)out.push({zone:'services',text:'公用站筹办'});
    const depot=c.cityDispatch?.depots?.[id];if(depot?.completedAt===null)out.push({zone:'transport',text:'货场施工'});
    return out;
  },
  model(s,id){
    const cfg=this.profiles[id],n=CivilCity.node(s,id);
    if(!cfg||!n||n.contactedAt===null)return null;
    const pop=CivilCity.count(n),beds=CivilCity.housing(s,id),w=n.workers||{},e=n.economy,stock=n.stores,projects=this.projects(s,id),road=this.road(s,id);
    const flow=key=>e?e.flow[key]||0:null,waiting=zone=>projects.filter(p=>p.zone===zone).map(p=>p.text),transport=['driver','courier','publiccourier','regionalcourier','regioncourier'].reduce((a,k)=>a+(w[k]||0),0);
    const zones=[
      {id:'housing',name:'居住街区',glyph:'▫',kind:'housing',position:[9,4],rows:[['当地居民',pop,'人'],['家庭床位',beds,'床'],['空床',Math.max(0,beds-pop),'床']],note:'住房包含原有家庭资产和已完工的安居工程；修建住房不会自动增加居民。',alert:pop>=beds},
      {id:'fields',name:'粮作田地',glyph:'≡',kind:'field',position:[23,4],rows:[['农业岗位',w.farmer||0,'人'],['粮食储备',stock.food||0,''],['近轮粮食净变化',flow('food'),' / 10秒']],note:'农田由当地岗位维持，用水、工具和口粮共同影响持续供给。',alert:!!e&&!e.ate},
      {id:'industry',name:cfg.industry,glyph:cfg.job==='teacher'?'+':'▥',kind:cfg.job==='teacher'?'service':'industry',position:[23,14],rows:[['安排岗位',w[cfg.job]||0,'人'],['上轮实际作业',e?.worked[cfg.job]??null,'人'],[(CivilText.labels[cfg.resource]||cfg.resource)+'储备',stock[cfg.resource]||0,'']],note:{lake:'工具工坊与回收岗位留在湖滨；扩建、用工和材料以本地账为准。',ridge:'铸炉把当地回收料变成铁料，原料与检修不足都会影响生产。',estuary:'临床药务消耗工具和知识，并与当地家庭共享供养。',bridge:'旧校舍和档案支撑教学与知识生产，教师仍要持续消耗教材。'}[id],alert:!!e&&e.blocked.includes(cfg.job)},
      {id:'services',name:'公共服务区',glyph:'+',kind:'service',position:[9,14],rows:[['实际供水',e?e.water:null,'人份'],['医护岗位',w.medic||0,'人'],['教学岗位',w.teacher||0,'人'],['当地健康',n.health,' / 100']],note:'水务、诊疗和课堂持续消耗本地材料；公共服务覆盖以实际结算为准。',alert:!!e&&(!e.treated||!e.educated||e.water<(e.population||pop))},
      {id:'transport',name:'车站与仓场',glyph:'#',kind:'freight',position:[16,9],rows:[['对外通路',road],['运输岗位',transport,'人'],['本地公用站',!s.civilization.cityCouncil?.offices[id]?'尚未登记':CivilCityCouncil.activeOffice(s,id)?'持续服务':'待施工或续办']],note:'仓场归本地所有；各城调拨仍受真实车辆、通路与运费约束。',alert:road==='道路待检修'}
    ];
    for(const zone of zones)zone.projects=waiting(zone.id);
    return {id,name:cfg.name,terrain:cfg.terrain,population:pop,zones,projects,road};
  },
  terrain(model){
    const width=31,height=19,grid=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let glyph='·',kind='plain';
      if(model.terrain==='lake'&&x<4+Math.round(Math.sin(y/4))||model.terrain==='delta'&&(x>27-y/3||y>15&&x<4)||model.terrain==='bridge'&&Math.abs(y-9)<=1){glyph='~';kind='water';}
      else if(model.terrain==='ridge'&&(y<3&&x>17||x<4&&y<14)){glyph='^';kind='mountain';}
      else if(y>15&&x<7||x>27&&y<7){glyph='♣';kind='forest';}
      grid.push({glyph,kind});
    }
    // Inner streets are a diagram of existing uses, not extra transport capacity.
    for(const zone of model.zones){
      const [x,y]=zone.position;this.patch(grid,width,height,x,y,3,1,zone.glyph,zone.kind);
      let xx=x,yy=y;while(xx!==16||yy!==9){grid[yy*width+xx]={glyph:':',kind:'street'};if(xx!==16)xx+=Math.sign(16-xx);else yy+=Math.sign(9-yy);}
    }
    for(let x=17;x<width;x++)grid[9*width+x]={glyph:model.road==='已连通'?'#':':',kind:model.road==='已连通'?'road':'trail'};
    return {width,height,grid};
  },
  refresh(s){
    const id=CivilConurbationView.selected,model=this.model(s,id);
    let root=$('#cityLocalMap');
    if(!model||id==='lake'&&CivilConurbationView.section!=='overview'){root.hide();return;}
    const anchor=id==='lake'?'#metroCityText_overview':id==='ridge'?'#cityNetSummary_ridge':'#councilSummary';
    if(!root.length){
      root=$('<section>').attr({id:'cityLocalMap','aria-label':'城市用途地图'}).addClass('city-local-map');
      $('<p>').addClass('city-local-title').appendTo(root);
      const sketch=$('<div>').addClass('city-local-sketch').appendTo(root);
      $('<div>').addClass('city-local-terrain').attr('aria-hidden','true').appendTo(sketch);
      $('<div>').addClass('city-local-nodes').appendTo(sketch);
      $('<p>').addClass('city-local-legend').text('▫ 居住　≡ 农田　▥ 生产　+ 公共服务　# 对外通路　: 街巷 / 待修路　◇ 施工　! 待处理').appendTo(root);
      const detail=$('<div>').addClass('city-local-detail').appendTo(root);$('<strong>').appendTo(detail);$('<dl>').appendTo(detail);$('<p>').appendTo(detail);
    }
    if(root.prev()[0]!==$(anchor)[0])root.insertAfter(anchor);root.show();
    root.children('.city-local-title').text(model.name+' · 城区用途图');
    const map=this.terrain(model),terrain=root.find('.city-local-terrain'),signature=map.grid.map(c=>c.glyph+c.kind).join('');
    if(terrain.attr('data-map')!==signature){terrain.empty().attr('data-map',signature);for(const cell of map.grid)$('<span>').addClass('city-ground-'+cell.kind).text(cell.glyph).appendTo(terrain);}
    const selected=this.selected[id]||'housing';
    for(const zone of model.zones){
      let node=root.find('#cityZone_'+zone.id);
      if(!node.length){node=$('<button type="button">').attr('id','cityZone_'+zone.id).addClass('city-map-node').appendTo(root.find('.city-local-nodes'));$('<b>').appendTo(node);$('<span>').appendTo(node);node.on('click',()=>{this.selected[CivilConurbationView.selected]=zone.id;this.refresh(State);});}
      node.css({left:((zone.position[0]+.5)/map.width*100)+'%',top:((zone.position[1]+.5)/map.height*100)+'%'});
      node.children('b').text(zone.alert?'!':zone.projects.length?'◇':zone.glyph);node.children('span').text(zone.name);
      node.attr({'aria-pressed':selected===zone.id,'aria-label':model.name+'，'+zone.name+(zone.alert?'，需处理':'')+(zone.projects.length?'，工程进行中':'')+'，查看详情'}).toggleClass('selected',selected===zone.id);
    }
    const zone=model.zones.find(z=>z.id===selected)||model.zones[0],detail=root.children('.city-local-detail');
    detail.children('strong').text(zone.name+(zone.projects.length?' · '+zone.projects.join('、')+'进行中':''));
    const dl=detail.children('dl');while(dl.children().length<zone.rows.length*2){$('<dt>').appendTo(dl);$('<dd>').appendTo(dl);}dl.children().slice(zone.rows.length*2).remove();
    zone.rows.forEach(([label,value,unit=''],i)=>{dl.children().eq(i*2).text(label);dl.children().eq(i*2+1).text(value===null?'待结算':(typeof value==='number'?CivilCityView.amount(value):value)+unit);});
    detail.children('p').text(zone.note+' 功能片区为示意，人口和仓库按当地总账统计。');
  }
};
