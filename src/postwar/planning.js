/* MPL-2.0 — Explicit, bounded local building orders; existing project owners keep all costs and work. */
var CivilPlanning={
  limit:6,
  data(s,id){return s.civilization.planning?.nodes[id];},
  queued(s,id){return (this.data(s,id)?.orders||[]).filter(r=>r.status==='queued');},
  eligible(s,id){return !!CivilMunicipal.data(s,id)?.town&&CivilMunicipal.canAccept(s,id);},
  owner(kind){return kind==='municipal'?CivilMunicipal:kind==='services'?CivilServices:null;},
  definition(kind,type){const all=kind==='municipal'?CivilMunicipalContent.facilities:kind==='services'?CivilServiceContent.facilities:null;return all&&Object.hasOwn(all,type)?all[type]:null;},
  queueMode(s,id){return this.eligible(s,id)&&(!CivilMunicipal.projectAvailable(s,id)||this.queued(s,id).length>0);},
  canQueue(s,id,kind,type){
    const owner=this.owner(kind),d=this.definition(kind,type);if(!this.eligible(s,id)||!d||d.homeOnly||!owner.facilityGate(s,id,type)||this.queued(s,id).length>=this.limit)return false;
    const m=owner.data(s,id),active=m?.project;
    const committed=(m?.buildings[type]||0)+(active?.type===type&&active.status!=='complete'?1:0)+this.queued(s,id).filter(r=>r.owner===kind&&r.type===type).length;
    return committed<d.max;
  },
  enqueue(s,id,kind,type){
    if(!this.canQueue(s,id,kind,type))return false;const c=s.civilization;
    if(c.planning===undefined)c.planning={schema:1,nodes:{}};
    if(!this.data(s,id))c.planning.nodes[id]={createdAt:c.elapsed,enabled:true,changedAt:c.elapsed,nextId:1,orders:[]};
    const d=this.data(s,id);d.orders.push({id:d.nextId++,owner:kind,type,queuedAt:c.elapsed,status:'queued',startedAt:null,projectId:null,cancelledAt:null});return true;
  },
  request(s,id,kind,type){return this.queueMode(s,id)?this.enqueue(s,id,kind,type):this.owner(kind)?.startProject(s,id,type)||false;},
  setEnabled(s,id,enabled){const d=this.data(s,id);if(!d||typeof enabled!=='boolean'||d.enabled===enabled)return false;d.enabled=enabled;d.changedAt=s.civilization.elapsed;return true;},
  cancel(s,id,orderId){const r=this.data(s,id)?.orders.find(r=>r.id===orderId);if(r?.status!=='queued')return false;r.status='cancelled';r.cancelledAt=s.civilization.elapsed;return true;},
  reason(s,id){
    const d=this.data(s,id),r=this.queued(s,id)[0];if(!r)return '没有待建项目';
    if(!d.enabled)return '计划已暂停；当前已开工程继续';
    if(!this.eligible(s,id))return '等待地方恢复共同营建';
    if(!CivilMunicipal.projectAvailable(s,id))return '等待当前工程完成；不抢占施工和货车';
    if(!this.owner(r.owner).facilityGate(s,id,r.type))return '首项条件不满足或已达上限；可移除后重新安排';
    return '下一项将在下一秒交给当地工程';
  },
  tick(s){
    for(const [id,d]of Object.entries(s.civilization.planning?.nodes||{})){
      const r=this.queued(s,id)[0];if(!r||!d.enabled||!this.eligible(s,id)||!CivilMunicipal.projectAvailable(s,id))continue;
      const owner=this.owner(r.owner);if(!owner.startProject(s,id,r.type))continue;
      r.status='started';r.startedAt=s.civilization.elapsed;r.projectId=owner.data(s,id).project.id;
      CivilMunicipal.note(CivilRegionContent[id].name+'按建设计划筹办'+this.definition(r.owner,r.type).name+'。建材仍需逐车运到，未计为完工。');
    }
  },
  caption(button,text){button.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(text));},
  refresh(s,id){
    let box=$('#civilPlan');const d=this.data(s,id);if(!d){box.hide();return;}
    if(!box.length){box=$('<details>').attr('id','civilPlan').addClass('civil-details civil-plan').appendTo('#municipalPanel');$('<summary>').appendTo(box);$('<p>').addClass('civil-plan-status').appendTo(box);$('<p>').text('最多安排6项，按顺序营建，建材随货车发运支付。暂停不影响当前工程；未开始的项目可移除。').appendTo(box);$('<div>').addClass('civil-plan-controls').appendTo(box);$('<div>').addClass('civil-plan-orders').appendTo(box);}
    const list=this.queued(s,id);box.show();box.children('summary').text('后续建设（'+list.length+' / '+this.limit+'）'+(d.enabled?'':' · 已暂停'));box.children('.civil-plan-status').text(this.reason(s,id));
    const control=Civilization.button('civilPlanToggle','暂停后续建设',box.children('.civil-plan-controls'),()=>{const id=CivilMunicipal.selected,d=this.data(State,id);if(d&&this.setEnabled(State,id,!d.enabled)){Engine.saveGame();Civilization.refresh();}});this.caption(control,d.enabled?'暂停后续建设':'恢复后续建设');
    const root=box.children('.civil-plan-orders'),signature=JSON.stringify([id,list.map(r=>r.id)]);if(root.attr('data-orders')===signature)return;root.attr('data-orders',signature).empty();
    for(const [index,r]of list.entries()){
      const row=$('<div>').addClass('civil-plan-row').appendTo(root),def=this.definition(r.owner,r.type);
      $('<span>').text((index+1)+'. '+def.name).appendTo(row);
      const cost=Object.entries(def.cost).map(([k,v])=>(CivilText.labels[k]||k)+' '+v).join('、');
      $('<p>').text(cost+'；到料后施工 '+def.duration+' 秒').appendTo(row);
      Civilization.button('civilPlanCancel_'+id+'_'+r.id,'移除此项',row,()=>{if(this.cancel(State,id,r.id)){Engine.saveGame();Civilization.refresh();}});
    }
  },
  validate(s){
    const v=s.civilization.planning;if(v===undefined)return;
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
    const int=(x,max=s.civilization.elapsed)=>Number.isSafeInteger(x)&&x>=0&&x<=max,fail=()=>{throw Error('地方建设计划无效');};
    if(!exact(v,['schema','nodes'])||v.schema!==1||!obj(v.nodes))fail();
    for(const [id,d]of Object.entries(v.nodes)){
      const m=CivilMunicipal.data(s,id);if(!Object.hasOwn(CivilRegionContent,id)||!m?.town||!exact(d,['createdAt','enabled','changedAt','nextId','orders'])||!int(d.createdAt)||d.createdAt<m.agreedAt||typeof d.enabled!=='boolean'||!int(d.changedAt)||d.changedAt<d.createdAt||!Array.isArray(d.orders)||!d.orders.length||d.nextId!==d.orders.length+1||this.queued(s,id).length>this.limit)fail();
      let queuedAt=d.createdAt,startedAt=d.createdAt;const claimed=new Set();
      for(const [index,r]of d.orders.entries()){
        const def=this.definition(r?.owner,r?.type);if(!exact(r,['id','owner','type','queuedAt','status','startedAt','projectId','cancelledAt'])||r.id!==index+1||!def||def.homeOnly||!int(r.queuedAt)||r.queuedAt<queuedAt||(index===0&&r.queuedAt!==d.createdAt)||!['queued','started','cancelled'].includes(r.status))fail();queuedAt=r.queuedAt;
        if(r.status==='started'){
          const owner=this.owner(r.owner),local=owner.data(s,id),project=local?.project?.id===r.projectId?local.project:local?.completed.find(p=>p.id===r.projectId),key=r.owner+'_'+r.projectId;
          if(!int(r.startedAt)||r.startedAt<r.queuedAt||r.startedAt<startedAt||!int(r.projectId,1e8)||r.projectId<1||r.cancelledAt!==null||!project||project.type!==r.type||project.completedAt!==undefined&&project.completedAt<r.startedAt||claimed.has(key))fail();
          for(const prior of d.orders.slice(0,index))if(prior.status==='queued'||prior.status==='cancelled'&&prior.cancelledAt>r.startedAt)fail();
          claimed.add(key);startedAt=r.startedAt;
        }else{
          if(r.startedAt!==null||r.projectId!==null||r.status==='queued'&&r.cancelledAt!==null||r.status==='cancelled'&&(!int(r.cancelledAt)||r.cancelledAt<r.queuedAt))fail();
        }
      }
    }
  }
};
