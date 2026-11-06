/* MPL-2.0 — Read-only technology atlas. Research authority stays in the original rules. */
var CivilTechTree={
  selected:null,zoom:1,signature:'',detailSignature:'',model:null,observer:null,drag:null,
  eras:['早期 · 生存与公共工艺','中期 · 电与通信','后期 · 自动化与新生活'],
  middle:new Set(['mining','furnace','mechanics','power','localgrid','chemistry','steel','medicine','municipal_engineering','wind_power','district_heating','machine_tools','electronics','railway_engineering','passenger_transport']),
  late:new Set(['computing','national_logistics','automation','orbital_survey','ocean_navigation','ecological_recovery','space_manufacturing','closed_ecology']),
  requires(s,id){return typeof CivilCourse!=='undefined'&&s.civilization.course?CivilCourse.requires(s,id):(CivilText.research[id]?.requires||[]);},
  baseEra(id){
    if(this.late.has(id)||typeof CivilModernContent!=='undefined'&&CivilModernContent.late.includes(id))return 2;
    return this.middle.has(id)||typeof CivilModernContent!=='undefined'&&CivilModernContent.middle.includes(id)?1:0;
  },
  // Never serialize an undiscovered name, cost, description, count or hidden prerequisite.
  // A single question mark only says a visible branch has more to discover.
  build(s){
    if(!s.game.buildings.workshop)return {nodes:[],edges:[],eras:[],width:0,height:0};
    const rows=CivilInterface.researchRows(s),known=new Set(rows.map(r=>r.id)),c=s.civilization;
    const nodes=rows.map(r=>({...r,unknown:false,state:r.done?'done':r.active?'active':r.available?(CivilRules.canPay(s,r.cost)?'ready':'materials'):'locked'}));
    const canBelong=id=>!(typeof CivilModernContent!=='undefined'&&CivilModernContent.tech[id]&&(c.polishVersion!==1||id==='localgrid'&&c.course?.id!=='commons'));
    const byId=new Map(nodes.map(n=>[n.id,n])),visiting=new Set(),placed=new Set();
    const rank=n=>{
      if(placed.has(n.id))return;
      if(visiting.has(n.id))throw Error('科技前置存在循环：'+n.id);
      visiting.add(n.id);
      const parents=n.requires.map(r=>byId.get(r.id)).filter(Boolean);parents.forEach(rank);
      n.era=Math.max(n.unknown?0:this.baseEra(n.id),...parents.map(p=>p.era));
      n.column=Math.max(0,...parents.filter(p=>p.era===n.era).map(p=>p.column+1));
      visiting.delete(n.id);placed.add(n.id);
    };
    nodes.forEach(rank);
    const frontier=nodes.filter(n=>Object.keys(CivilText.research).some(id=>!known.has(id)&&canBelong(id)&&this.requires(s,id).includes(n.id)));
    const leaf=n=>!rows.some(r=>r.requires.some(p=>p.id===n.id));
    frontier.sort((a,b)=>Number(leaf(b))-Number(leaf(a))||b.era-a.era||b.column-a.column);
    for(const r of frontier.slice(0,3)){
      const n={id:'unknown-'+r.id,name:'？',unknown:true,state:'unknown',requires:[{id:r.id,done:r.done}],cost:{}};
      nodes.push(n);byId.set(n.id,n);rank(n);
    }
    const eras=[];let offset=0;
    for(let era=0;era<this.eras.length;era++){
      const group=nodes.filter(n=>n.era===era);if(!group.length)continue;
      const count=Math.max(...group.map(n=>n.column))+1;
      eras.push({id:era,title:this.eras[era],start:offset,columns:count});
      group.forEach(n=>{n.column+=offset;});offset+=count;
    }
    // Stable topological columns; related branches share nearby rows. Long edges use
    // the gutters between rows instead of crossing through other node labels.
    const slots=new Map();let maxRow=0;
    for(let col=0;col<offset;col++){
      const group=nodes.filter(n=>n.column===col);
      const preferred=n=>{const ps=n.requires.map(r=>byId.get(r.id)).filter(p=>p?.row!==undefined);return ps.length?ps.reduce((v,p)=>v+p.row,0)/ps.length:group.indexOf(n);};
      group.sort((a,b)=>preferred(a)-preferred(b));const used=new Set();slots.set(col,used);
      group.forEach(n=>{let row=Math.round(preferred(n));while(used.has(row))row++;used.add(row);n.row=row;maxRow=Math.max(maxRow,row);n.x=30+col*276;n.y=88+row*112;n.width=n.unknown?72:224;n.height=64;});
    }
    const edges=nodes.flatMap(n=>n.requires.filter(r=>byId.has(r.id)).map((r,i)=>{
      const p=byId.get(r.id),x=p.x+p.width,y=p.y+32,endX=n.x,endY=n.y+32;
      const path=n.column-p.column===1?`M${x},${y} H${x+22+i*7} V${endY} H${endX}`:
        `M${x},${y} H${x+14+i*6} V${p.y-16-i*5} H${endX-16-i*6} V${endY} H${endX}`;
      return {from:p.id,to:n.id,done:!!r.done,path};
    }));
    return {nodes,edges,eras,width:Math.max(360,offset*276+12),height:Math.max(350,88+(maxRow+1)*112)};
  },
  ancestors(model,id){
    const nodes=new Map(model.nodes.map(n=>[n.id,n])),result=new Set();
    const visit=k=>{if(result.has(k))return;result.add(k);for(const p of nodes.get(k)?.requires||[])if(nodes.has(p.id))visit(p.id);};
    visit(id);return result;
  },
  label(n){return {done:'已掌握',active:'研究中',ready:'可研究',materials:'待备料',locked:'待前置',unknown:'未发现'}[n.state];},
  mark(n){return {done:'✓',active:'▰',ready:'○',materials:'○',locked:'—',unknown:'？'}[n.state];},
  element(tag,className,parent,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;parent?.append(e);return e;},
  svg(tag,attrs,parent){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;},
  mount(){
    if(document.getElementById('civilTechAtlas'))return;
    const panel=document.getElementById('civilResearchPanel');panel.classList.add('civil-tech-enabled');
    document.getElementById('civilResearchTree')?.remove();
    const root=this.element('section','civil-tech-atlas',null);root.id='civilTechAtlas';root.setAttribute('aria-label','科技路线图谱');document.getElementById('civilResearchIntro').after(root);
    const bar=this.element('div','civil-tech-toolbar',root);
    const choice=this.element('label','civil-tech-choice',bar,'查找工艺 '),select=this.element('select','',choice);select.id='civilTechSelect';select.addEventListener('change',()=>this.select(select.value,true));
    this.control(bar,'civilTechLocate','定位研究',()=>{const m=this.model;this.select(m.nodes.find(n=>n.active)?.id||m.nodes.find(n=>n.state==='ready')?.id||m.nodes.find(n=>n.available&&!n.done)?.id||this.selected,true);});
    const zoom=this.element('div','civil-tech-zoom',bar);this.control(zoom,'civilTechZoomOut','−',()=>this.scale(this.zoom-.1),'缩小科技图谱');
    const level=this.element('output','',zoom,'100%');level.id='civilTechZoom';level.setAttribute('aria-label','图谱缩放比例');
    this.control(zoom,'civilTechZoomIn','＋',()=>this.scale(this.zoom+.1),'放大科技图谱');this.control(zoom,'civilTechReset','复位',()=>{this.scale(1);this.center(this.selected);},'恢复原始字号并定位所选工艺');
    const layout=this.element('div','civil-tech-layout',root),map=this.element('div','civil-tech-map',layout);
    const caption=this.element('div','civil-tech-caption',map);caption.id='civilTechCaption';
    const viewport=this.element('div','civil-tech-viewport',map);viewport.id='civilTechViewport';viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','科技地图。拖动空白处或用方向键平移，滚轮缩放。');
    const plane=this.element('div','civil-tech-plane',viewport),world=this.element('div','civil-tech-world',plane);world.id='civilTechWorld';
    const footer=this.element('div','civil-tech-map-footer',map),mini=this.element('div','civil-tech-mini',footer);mini.id='civilTechMini';mini.setAttribute('aria-hidden','true');
    this.element('p','civil-secondary',footer,'拖动空白处查看 · 滚轮缩放\n键盘：方向键平移，Tab 选择工艺');
    const detail=this.element('aside','civil-tech-detail',layout);detail.id='civilTechDetail';detail.tabIndex=0;detail.setAttribute('aria-label','所选工艺详情');
    const legend=this.element('div','civil-tech-legend',root);for(const text of ['✓ 已掌握','○ 可研究 / 待备料','▰ 研究中','┄ 待前置','？ 未发现'])this.element('span','',legend,text);
    viewport.addEventListener('scroll',()=>this.miniViewport(),{passive:true});
    viewport.addEventListener('wheel',e=>{if(e.shiftKey)return;e.preventDefault();const r=viewport.getBoundingClientRect();this.scale(this.zoom*Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
    viewport.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button'))return;
      this.drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove',e=>{if(!this.drag)return;viewport.scrollLeft=this.drag.left+this.drag.x-e.clientX;viewport.scrollTop=this.drag.top+this.drag.y-e.clientY;});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,()=>{this.drag=null;viewport.classList.remove('dragging');});
    viewport.addEventListener('keydown',e=>{
      const move={ArrowLeft:[-120,0],ArrowRight:[120,0],ArrowUp:[0,-100],ArrowDown:[0,100]};
      if(e.target!==viewport||!move[e.key])return;e.preventDefault();e.stopPropagation();viewport.scrollBy(...move[e.key]);
    });
    mini.addEventListener('pointerdown',e=>{if(!this.model)return;const r=mini.getBoundingClientRect();viewport.scrollLeft=(e.clientX-r.left)/r.width*this.model.width*this.zoom-viewport.clientWidth/2;viewport.scrollTop=(e.clientY-r.top)/r.height*this.model.height*this.zoom-viewport.clientHeight/2;});
    if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(()=>{if(viewport.clientWidth&&this.viewportWidth!==viewport.clientWidth){this.viewportWidth=viewport.clientWidth;this.center(this.selected);}this.miniViewport();});this.observer.observe(viewport);}
  },
  control(parent,id,text,fn,label){const b=this.element('button','civil-tech-control',parent,text);b.id=id;b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',fn);return b;},
  draw(){
    const m=this.model,world=document.getElementById('civilTechWorld'),focused=document.activeElement?.dataset?.techId;world.replaceChildren();
    world.style.width=m.width+'px';world.style.height=m.height+'px';
    const lines=this.svg('svg',{width:m.width,height:m.height,'aria-hidden':'true',class:'civil-tech-lines'},world);
    for(const era of m.eras){const label=this.element('div','civil-tech-era',world,era.title);label.style.left=(30+era.start*276)+'px';if(era.start)this.svg('path',{d:`M${era.start*276+8},20 V${m.height-16}`,class:'civil-tech-era-line'},lines);}
    for(const edge of m.edges)this.svg('path',{d:edge.path,class:'civil-tech-edge'+(edge.done?' satisfied':''),'data-from':edge.from,'data-to':edge.to},lines);
    for(const n of [...m.nodes].sort((a,b)=>a.column-b.column||a.row-b.row)){
      const button=this.element('button','civil-tech-node '+n.state,world);button.type='button';button.dataset.techId=n.id;button.id='techNode_'+n.id;
      Object.assign(button.style,{left:n.x+'px',top:n.y+'px',width:n.width+'px',height:n.height+'px'});
      const title=this.element('span','civil-tech-node-name',button);this.element('span','civil-tech-mark',title,n.unknown?'':this.mark(n));this.element('span','',title,n.name);
      this.element('small','civil-tech-node-status',button,this.label(n));
      if(n.active){const progress=this.element('span','civil-tech-node-progress',button);this.element('span','',progress);}
      button.setAttribute('aria-label',(n.unknown?'尚未发现的后续工艺':n.name)+'，'+this.label(n)+'。查看详情');button.setAttribute('aria-controls','civilTechDetail');
      button.addEventListener('click',()=>this.select(n.id));button.addEventListener('focus',()=>this.highlight(n.id));button.addEventListener('blur',()=>this.highlight(this.selected));button.addEventListener('mouseenter',()=>this.highlight(n.id));button.addEventListener('mouseleave',()=>this.highlight(this.selected));
    }
    const select=document.getElementById('civilTechSelect'),eras=new Map();select.replaceChildren();
    for(const n of m.nodes.filter(n=>!n.unknown).sort((a,b)=>a.era-b.era||a.column-b.column||a.row-b.row)){
      if(!eras.has(n.era)){const group=this.element('optgroup','',select);group.label=this.eras[n.era];eras.set(n.era,group);}
      const option=this.element('option','',eras.get(n.era),n.name+' · '+this.label(n));option.value=n.id;
    }
    const mini=document.getElementById('civilTechMini');mini.replaceChildren();
    const overview=this.svg('svg',{viewBox:`0 0 ${m.width} ${m.height}`,preserveAspectRatio:'none'},mini);
    for(const edge of m.edges)this.svg('path',{d:edge.path,class:'civil-tech-mini-edge'},overview);
    for(const n of m.nodes)this.svg('rect',{x:n.x,y:n.y,width:n.width,height:n.height,class:'civil-tech-mini-node '+n.state},overview);
    this.svg('rect',{id:'civilTechMiniViewport',x:0,y:0,width:1,height:1},overview);
    this.applyScale();this.highlight(this.selected);if(focused)document.getElementById('techNode_'+focused)?.focus({preventScroll:true});
  },
  highlight(id){
    if(!this.model)return;const path=this.ancestors(this.model,id);
    for(const e of document.querySelectorAll('#civilTechWorld .civil-tech-edge'))e.classList.toggle('on-path',path.has(e.dataset.from)&&path.has(e.dataset.to));
    for(const e of document.querySelectorAll('#civilTechWorld .civil-tech-node')){e.classList.toggle('on-path',path.has(e.dataset.techId));e.classList.toggle('selected',e.dataset.techId===this.selected);e.setAttribute('aria-pressed',String(e.dataset.techId===this.selected));}
  },
  select(id,locate=false){
    if(!this.model?.nodes.some(n=>n.id===id))return;this.selected=id;this.highlight(id);this.detail(State);
    document.getElementById('civilTechSelect').value=id.startsWith('unknown-')?'':id;if(locate)this.center(id);
  },
  center(id){
    const n=this.model?.nodes.find(n=>n.id===id),v=document.getElementById('civilTechViewport');if(!n||!v?.clientWidth)return;
    v.scrollLeft=(n.x+n.width/2)*this.zoom-v.clientWidth/2;v.scrollTop=(n.y+n.height/2)*this.zoom-v.clientHeight/2;this.miniViewport();
  },
  scale(value,anchor){
    const v=document.getElementById('civilTechViewport');if(!v)return;
    const old=this.zoom,point=anchor||{x:v.clientWidth/2,y:v.clientHeight/2},x=(v.scrollLeft+point.x)/old,y=(v.scrollTop+point.y)/old;
    this.zoom=Math.max(.55,Math.min(1.5,value));this.applyScale();v.scrollLeft=x*this.zoom-point.x;v.scrollTop=y*this.zoom-point.y;this.miniViewport();
  },
  applyScale(){
    const world=document.getElementById('civilTechWorld');if(!world||!this.model)return;
    world.style.transform=`scale(${this.zoom})`;world.parentElement.style.width=this.model.width*this.zoom+'px';world.parentElement.style.height=this.model.height*this.zoom+'px';
    document.getElementById('civilTechZoom').textContent=Math.round(this.zoom*100)+'%';document.getElementById('civilTechZoomOut').disabled=this.zoom<=.55;document.getElementById('civilTechZoomIn').disabled=this.zoom>=1.5;
    this.miniViewport();
  },
  miniViewport(){
    const v=document.getElementById('civilTechViewport'),rect=document.getElementById('civilTechMiniViewport');if(!v||!rect||!this.model)return;
    for(const [k,value]of Object.entries({x:v.scrollLeft/this.zoom,y:v.scrollTop/this.zoom,width:Math.min(this.model.width,v.clientWidth/this.zoom),height:Math.min(this.model.height,v.clientHeight/this.zoom)}))rect.setAttribute(k,value);
  },
  detail(s){
    const n=this.model?.nodes.find(n=>n.id===this.selected),root=document.getElementById('civilTechDetail');if(!n||!root)return;
    document.getElementById('civilTechCaption').textContent=this.eras[n.era]+(n.unknown?' · 未知边界':'');
    const signature=JSON.stringify([n.id,n.state,n.cost,n.requires,n.detail,s.civilization.research?.id]);
    if(signature!==this.detailSignature){
      this.detailSignature=signature;
      // Reuse the original action, with its existing callback and final rule/cost check.
      $('#civilTechAction > .button').appendTo('#researchBtns');root.replaceChildren();root.scrollTop=0;
      this.element('h3','',root,n.unknown?'尚未发现':n.name);
      const status=this.element('p','civil-tech-detail-state',root,this.label(n));status.id='civilTechState';
      if(n.unknown){this.element('p','',root,'这条路线还没有新的记录。继续探索与发展，后续工艺会逐步显现。');return;}
      const p=this.element('div','civil-tech-progress',root);p.id='civilTechProgress';p.setAttribute('role','progressbar');p.setAttribute('aria-label',n.name+'研究进度');p.setAttribute('aria-valuemin','0');p.setAttribute('aria-valuemax','100');this.element('span','',p);
      this.element('h4','',root,'前置');const prerequisites=this.element('div','civil-tech-prerequisites',root);
      if(!n.requires.length)this.element('p','',prerequisites,'工坊');
      for(const req of n.requires){const visible=this.model.nodes.some(x=>x.id===req.id);if(visible)this.control(prerequisites,'techReq_'+req.id,req.name+(req.done?' ✓':' · 未完成'),()=>this.select(req.id,true));else this.element('p','',prerequisites,'？ · 待发现');}
      this.element('h4','',root,n.active||n.done?'材料参考':'准备材料');
      const costs=this.element('dl','civil-kv civil-tech-costs',root);costs.id='civilTechCosts';
      for(const [key,amount]of Object.entries(n.cost)){this.element('dt','',costs,CivilText.labels[key]||key);const val=this.element('dd','',costs,String(amount));val.dataset.resource=key;}
      const duration=this.element('p','civil-secondary',root);duration.id='civilTechDuration';
      if(n.active||n.done)this.element('p','civil-secondary',root,'按当前工艺标准列示，立项费用已支付。');
      const hint=this.element('p','civil-tech-hint',root);hint.id='civilTechHint';
      const actions=this.element('div','',root);actions.id='civilTechAction';
      if(!n.done&&!n.active){const button=Civilization.button('research_'+n.id,'开始研究',actions,()=>Civilization.research(n.id),n.cost);button.appendTo(actions).show();button.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode('开始研究'));}
      this.element('h4','',root,n.done?'它改变了什么':'将带来的变化');this.element('p','',root,n.detail);
      if(n.done){const targets=Civilization.techUnlocks(n.id,s).filter(k=>Civilization.placeOf(k));if(targets.length){const list=this.element('details','civil-details',root);this.element('summary','',list,'已开放的设施');const host=this.element('div','',list);for(const key of targets){const name=key.startsWith('services:')?CivilServiceContent.facilities[key.slice(9)].name:_(key);this.control(host,'techBuild_'+key.replace(':','_'),'去建 '+name,()=>Civilization.goTo(key));}}}
    }
    if(n.unknown)return;
    const remaining=n.active?Math.ceil(s.civilization.research.remaining):0,percent=n.active?Math.max(0,Math.min(100,100*(1-remaining/n.duration))):n.done?100:0;
    const progress=document.getElementById('civilTechProgress');progress.hidden=!n.active;progress.setAttribute('aria-valuenow',Math.floor(percent));progress.firstElementChild.style.width=percent+'%';
    document.getElementById('civilTechState').textContent=n.active?'研究中 · '+Math.floor(percent)+'%':this.label(n);
    document.getElementById('civilTechDuration').textContent=n.active?'剩余 '+remaining+' 秒':'试制 '+n.duration+' 秒';
    const missing=[];
    for(const val of document.querySelectorAll('#civilTechCosts dd')){const k=val.dataset.resource,need=n.cost[k],have=s.stores[k]||0,bad=!n.done&&!n.active&&have+1e-8<need;val.classList.toggle('shortage',bad);val.textContent=n.done||n.active?String(need):CivilInterface.number(have)+' / '+need;if(bad)missing.push((CivilText.labels[k]||k)+' '+CivilInterface.number(need-have));}
    const busy=!!s.civilization.research&&!n.active;
    document.getElementById('civilTechHint').textContent=n.done||n.active?'':!n.available?'先完成标出的前置工艺。':busy?'研究班组正在忙碌，完成后可立项。':missing.length?'还缺：'+missing.join('、'):'材料齐备，可以开始试制。';
    const button=$('#civilTechAction > .button');if(button.length)Button.setDisabled(button,!n.available||busy||missing.length>0);
  },
  refresh(s){
    this.mount();const m=this.build(s);this.model=m;
    const root=document.getElementById('civilTechAtlas'),retired=!!s.civilization.polity?.future&&m.nodes.filter(n=>!n.unknown).every(n=>n.done);
    let archive=document.getElementById('civilTechArchive');
    if(retired){
      if(!archive){archive=this.element('details','civil-details');archive.id='civilTechArchive';this.element('summary','',archive,'已掌握的科技图谱');root.before(archive);archive.addEventListener('toggle',()=>{if(archive.open)this.arrive();});}
      if(root.parentElement!==archive)archive.append(root);
    }else if(archive){archive.before(root);archive.remove();}
    const signature=JSON.stringify(m);let initial=false;
    if(!m.nodes.some(n=>n.id===this.selected)){this.selected=m.nodes.find(n=>n.active)?.id||m.nodes.find(n=>n.state==='ready')?.id||m.nodes.find(n=>n.available&&!n.done)?.id||m.nodes[0]?.id;initial=true;}
    if(signature!==this.signature){this.signature=signature;this.draw();}
    document.getElementById('civilTechSelect').value=this.selected?.startsWith('unknown-')?'':this.selected;
    this.detail(s);
    const active=m.nodes.find(n=>n.active);if(active){const bar=document.querySelector('#techNode_'+active.id+' .civil-tech-node-progress > span');if(bar)bar.style.width=Math.max(0,Math.min(100,100*(1-s.civilization.research.remaining/active.duration)))+'%';}
    if(initial)this.center(this.selected);
  },
  arrive(){requestAnimationFrame(()=>{this.center(this.selected);this.miniViewport();});},
  reset(){this.observer?.disconnect();this.observer=null;this.viewportWidth=0;this.selected=null;this.zoom=1;this.signature='';this.detailSignature='';this.model=null;this.drag=null;}
};
