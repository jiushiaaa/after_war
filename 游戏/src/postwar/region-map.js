/* MPL-2.0 — Read-only regional relationships on the native ADR page. */
var CivilRegionMap={
  selected:'home',signature:null,
  number(n){return Number.isFinite(n)?Number(n.toFixed(2)):0;},
  snapshot(s){
    const c=s.civilization,r=c.regions,shown=Object.entries(r?.nodes||{}).filter(([,n])=>n.discovered===true);
    if(!r||!shown.length)return null;
    const labels={contacted:'独立接触',trade:'互惠贸易',associated:'加盟履约',integrated:'共同治理'};
    const staffed=typeof CivilRegions!=='undefined'?CivilRegions.staffedRoutes(s):new Set();
    const makeNode=(id,n)=>{
      const home=id==='home',m=home?null:c.municipal?.nodes[id],e=home?c.urban?.economy:m?.economy;
      const cohorts=home?c.society?.cohorts:n.cohorts,population=home?s.game.population:n.population,stores=home?s.stores:n.stores;
      const weighted=typeof CivilPopulation!=='undefined'&&cohorts?CivilPopulation.foodPopulation(cohorts):population;
      const capacity=home?(typeof CivilCatalog!=='undefined'?CivilCatalog.capacity(s):null):(typeof CivilMunicipal!=='undefined'?CivilMunicipal.capacity(s,id):((typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.population:n.population)+(n.completedProjects?.publicWorks?12:0)));
      const health=home?c.village?.health:n.health,issues=[];
      if(capacity!==null&&population>=capacity)issues.push('住房已满');
      if(health<60)issues.push('健康需要恢复');
      const reserve=home&&typeof CivilUrban!=='undefined'?CivilUrban.foodReserve(s):typeof CivilMunicipal!=='undefined'&&m?CivilMunicipal.foodReserve(s,id):weighted*.12*12;
      if((stores?.food||0)+1e-8<reserve)issues.push('现有居民口粮储备不足120秒');
      if(e&&c.elapsed-e.at<=10){
        if(e.food<-1e-8)issues.push('本轮粮食供养有缺口');
        if(e.medicine<-1e-8||!e.treatment)issues.push('本轮医疗供给不足');
        if(!e.education)issues.push('儿童教学未覆盖');
      }else if(e||m)issues.push('尚无近期供养记录');
      if(home?c.society?.service===false:r.adminService===false)issues.push('公共行政物资不足');
      const projects=[];
      for(const [kind,p]of [['公共项目',r.projects?.[id]],['货车改装',r.upgrades?.projects[id]],['市政营建',m?.project],['公用工程',c.services?.nodes[id]?.project]]){
        if(!p||p.status==='complete')continue;
        const facility=p.type&&(typeof CivilServiceContent!=='undefined'?CivilServiceContent.facilities[p.type]:null)||p.type&&(typeof CivilMunicipalContent!=='undefined'?CivilMunicipalContent.facilities[p.type]:null);
        const missing=Object.entries(p.required||{}).filter(([key,value])=>value>(p.buffer?.[key]||0)+1e-8).map(([key,value])=>({resource:key,amount:this.number(value-(p.buffer?.[key]||0))}));
        projects.push({name:facility?.name||kind,status:p.status,remaining:Math.ceil(p.remaining||0),missing});
      }
      return {id,name:home?(c.urban?.city?'炉火城':c.urban?.chartered?'炉火镇':'本地聚落'):(typeof CivilRegionContent!=='undefined'?CivilRegionContent[id]?.name:id)||id,population,capacity,health:this.number(health),workforce:typeof CivilPopulation!=='undefined'&&cohorts?CivilPopulation.workforce(cohorts):population,relation:home?'共同体所在地':labels[n.relation]||'已知聚居地',stores:Object.fromEntries(Object.entries(stores||{}).map(([k,v])=>[k,this.number(v)])),economy:e&&c.elapsed-e.at<=10?{food:this.number(e.food),medicine:this.number(e.medicine)}:null,projects,issues};
    };
    const nodes=[makeNode('home',null),...shown.map(([id,n])=>makeNode(id,n))],known=new Set(nodes.map(n=>n.id)),routes=[];
    for(const [id,route]of Object.entries(r.routes||{})){
      if(!known.has(id))continue;
      let state=route.condition==='closed'?'道路受阻':!route.enabled?'已停发':!staffed.has(id)?'运输工不足':'通路启用';
      if(id==='river'&&route.condition==='open'&&route.enabled&&(!s.game.buildings.road||c.outpostSupplied!==true))state='道路或外站待维护';
      const shipments=(r.shipments||[]).filter(p=>p.route===id).map(p=>({id:p.id,source:p.source,target:p.target,status:p.status,phase:p.phase,remaining:Math.ceil(p.remaining),purpose:p.purpose,cargo:Object.fromEntries(Object.entries(p.cargo||{}).map(([k,v])=>[k,this.number(v)]))}));
      routes.push({id,from:'home',to:id,travel:route.travel,capacity:route.capacity,state,closed:route.condition==='closed',status:route.status,shipments});
    }
    return {nodes,routes};
  },
  escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  label(key){return typeof CivilText!=='undefined'?CivilText.labels[key]||key:key;},
  cargo(values){return Object.entries(values).filter(([,n])=>n>0).map(([key,n])=>this.label(key)+' '+n).join('、')||'空车';},
  markup(view,selected='home',expanded=true){
    const esc=this.escape,node=view.nodes.find(n=>n.id===selected)||view.nodes[0],others=view.nodes.slice(1),height=Math.max(130,others.length*112),middle=height/2;
    const button=(n,y)=>'<button type="button" class="region-map-node'+(n.id===node.id?' selected':'')+'" id="regionMapNode_'+esc(n.id)+'" data-region="'+esc(n.id)+'" aria-pressed="'+(n.id===node.id)+'" style="top:'+y+'px;left:'+(n.id==='home'?0:280)+'px"><strong>'+esc(n.name)+'</strong><span>'+n.population+' 位居民</span><small>'+esc(n.relation)+'</small></button>';
    let lines='',branches='';
    for(let index=0;index<others.length;index++){
      const n=others[index],y=index*112+56,route=view.routes.find(p=>p.to===n.id);
      if(route){lines+='<path class="'+(route.closed?'closed':'')+'" d="M 100 '+middle+' H 112 V '+y+' H 280" />';branches+='<div class="region-map-route" style="top:'+(y-39)+'px"><span>'+esc(route.state)+'</span><small>单程 '+route.travel+' 秒 · 载重 '+route.capacity+'</small></div><div class="region-map-traffic" style="top:'+(y+8)+'px">'+esc(route.shipments.length?(route.shipments[0].status==='held'?'货车受阻':route.shipments[0].status==='loading'?'等待返程备货':route.shipments[0].status==='refitting'?'原车改装中':'货车在途 · '+route.shipments[0].remaining+'秒'):'暂无在途货车')+'</div>';}
      else branches+='<div class="region-map-route" style="top:'+(y-15)+'px">尚未记录运输路线</div>';
      branches+=button(n,y-38);
    }
    let details='<dl><dt>居民与住房</dt><dd>'+node.population+' / '+(node.capacity??'—')+'，成年劳力 '+node.workforce+'</dd><dt>健康</dt><dd>'+node.health+'</dd><dt>公共库存</dt><dd>'+esc(this.cargo(node.stores))+'</dd>';
    if(node.economy)details+='<dt>每10秒供养余量</dt><dd>粮 '+node.economy.food+'，药 '+node.economy.medicine+'</dd>';
    details+='<dt>当前缺口</dt><dd>'+esc(node.issues.join('；')||'未见已记录的供养缺口')+'</dd>';
    const route=view.routes.find(p=>p.to===node.id);
    if(route){details+='<dt>路线</dt><dd>'+esc(route.state+'；'+route.status)+'</dd>';for(const p of route.shipments){const purpose={trade:'互惠贸易',project:'公共项目',municipal:'市政营建',upgrade:'货车改装',services:'公用工程',common:'共同预算'}[p.purpose]||'运输';const source=view.nodes.find(n=>n.id===p.source)?.name||p.source,target=view.nodes.find(n=>n.id===p.target)?.name||p.target;details+='<dt>'+esc(purpose)+'</dt><dd>'+esc(source+' → '+target+'；'+this.cargo(p.cargo)+'；'+({moving:'行进',held:'受阻等待',loading:'等待备货',refitting:'改装施工'}[p.status]||p.status)+'，剩余 '+p.remaining+' 秒')+'</dd>';}}
    for(const p of node.projects)details+='<dt>'+esc(p.name)+'</dt><dd>'+esc(p.status==='supplying'?'材料待交付：'+p.missing.map(x=>this.label(x.resource)+' '+x.amount).join('、'):'施工剩余 '+p.remaining+' 秒')+'</dd>';
    details+='</dl>';
    return '<div class="region-map-title">地区关系图</div><div id="regionMapScroll" class="region-map-scroll" tabindex="0" aria-label="已知地区与通路"><div class="region-map-graph" style="height:'+height+'px"><svg viewBox="0 0 405 '+height+'" aria-hidden="true">'+lines+'</svg>'+button(view.nodes[0],middle-38)+branches+'</div></div><details id="regionMapDetails"'+(expanded?' open':'')+'><summary id="regionMapDetailsToggle">'+esc(node.name)+' · 名册与供养</summary>'+details+'</details>';
  },
  select(s,id){
    const view=this.snapshot(s);if(!view?.nodes.some(n=>n.id===id))return false;
    this.selected=id;this.signature=null;this.refresh(s);
    if(id!=='home')$('#regionNode_'+id).trigger('click');return true;
  },
  refresh(s){
    const panel=$('#regionsPanel');if(!panel.length)return;
    const view=this.snapshot(s);if(!view){$('#regionMap').hide();return;}
    let root=$('#regionMap');if(!root.length){root=$('<section>').attr({id:'regionMap','aria-label':'地区关系图'}).addClass('region-map').insertBefore('#regionNodes');this.signature=null;root.on('click','button[data-region]',event=>this.select(State,$(event.currentTarget).attr('data-region')));}
    root.show();if(!view.nodes.some(n=>n.id===this.selected))this.selected='home';
    const signature=JSON.stringify([view,this.selected]);if(signature===this.signature)return;
    const details=$('#regionMapDetails'),expanded=!!details.length&&details.prop('open'),scroll=root.find('.region-map-scroll').scrollLeft()||0;
    const focused=typeof document!=='undefined'&&document.activeElement?.id;
    root.html(this.markup(view,this.selected,expanded));root.find('.region-map-scroll').scrollLeft(scroll);this.signature=signature;
    if(typeof focused==='string'&&focused.startsWith('regionMap'))document.getElementById(focused)?.focus({preventScroll:true});
  },
  reset(){this.selected='home';this.signature=null;}
};
