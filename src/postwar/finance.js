/* MPL-2.0 — Finance owns common-cargo transfers; Regions owns the sole cart and its clock. */
var CivilFinance={
  pendingIds:['financeOffer','financeLedger'],
  obj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);},
  now(s){return s.civilization.elapsed;},
  same(a,b){return this.obj(a)&&this.obj(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>Object.hasOwn(b,k)&&Math.abs(v-b[k])<1e-8);},
  known(id){return typeof CivilRegionContent!=='undefined'&&Object.hasOwn(CivilRegionContent,id);},
  data(s){return s.civilization.finance;},
  init(s){
    if(s.civilization.finance!==undefined)return;
    if(this.traces(s))throw Error('共同货运缺少互助账册');
    s.civilization.finance={schema:1,introducedAt:this.now(s),nextAgreement:1,activeId:null,agreements:[],periods:[],orders:[],receipts:[],lastSettledAt:null,offered:false,revision:null};
  },
  traces(s){const r=s.civilization.regions;return (r?.shipments||[]).some(p=>p.purpose==='common'||p.commonOrderId!==undefined||p.agreementId!==undefined||p.periodIndex!==undefined)||Object.values(r?.routes||{}).some(r=>r.lastPurpose==='common');},
  agreement(s){const f=this.data(s);return f?.agreements.find(a=>a.id===f.activeId)||null;},
  stores(s,id){return id==='home'?s.stores:s.civilization.regions?.nodes[id]?.stores;},
  population(s,id){return id==='home'?s.game.population:s.civilization.regions?.nodes[id]?.population||0;},
  political(s){const x=s.civilization.society;return !!x?.governed&&!x.succession&&!x.reforming;},
  candidates(s){
    const c=s.civilization,r=c.regions;if(!c.urban?.city||!r?.active||!c.society?.governed||CivilFinanceContent.requires.some(t=>!c.tech[t]))return [];
    if(!c.society.service||!r.adminService||CivilRegions.load(s)>CivilRegions.capacity(s))return [];
    return Object.keys(r.nodes).filter(id=>this.known(id)&&typeof CivilMunicipal!=='undefined'&&CivilMunicipal.has(s,id)&&c.municipal.nodes[id].town&&r.nodes[id].population>=80&&['associated','integrated'].includes(r.nodes[id].relation)&&CivilRegions.serviceReady(s,id));
  },
  quoteAgreement(s,members){
    const f=this.data(s),active=this.agreement(s);if(!f||active||!this.political(s))return null;
    const ids=(members||this.candidates(s).slice(0,2)).filter(id=>id!=='home');
    if(ids.length!==2||new Set(ids).size!==2||ids.some(id=>!this.candidates(s).includes(id)))return null;
    const costs={home:30,[ids[0]]:10,[ids[1]]:10};
    return {members:['home',...ids],costs,payable:Object.entries(costs).every(([id,n])=>(this.stores(s,id)?.knowledge||0)+1e-8>=n)};
  },
  approve(s,members){
    const q=this.quoteAgreement(s,members);if(!q?.payable)return false;
    const f=this.data(s),at=this.now(s),a={id:f.nextAgreement++,members:q.members,plan:CivilFinanceContent.plan,approvedAt:at,axes:{...s.civilization.society.axes},approvals:{...q.costs},paused:false,exitedAt:null};
    for(const [id,n]of Object.entries(q.costs))this.stores(s,id).knowledge-=n;
    f.agreements.push(a);f.activeId=a.id;f.offered=true;this.advance(s);return true;
  },
  periodIndex(s,a=this.agreement(s)){return a?Math.floor((this.now(s)-a.approvedAt)/CivilFinanceContent.period):null;},
  period(s,a=this.agreement(s)){return a?this.data(s).periods.find(p=>p.agreementId===a.id&&p.index===this.periodIndex(s,a))||null:null;},
  advance(s){
    const f=this.data(s),a=this.agreement(s);if(!f)return null;
    for(const p of f.periods)if(p.closedAt===null&&this.now(s)>=p.endsAt){p.closedAt=p.endsAt;p.missed=this.missed(s,p,p.endsAt);}
    if(!a)return null;let p=this.period(s,a);if(p)return p;
    const index=this.periodIndex(s,a),startedAt=a.approvedAt+index*600;
    p={id:a.id+':'+index,agreementId:a.id,index,startedAt,endsAt:startedAt+600,closedAt:null,routeOrders:{},paidAdmin:{},adminPayments:[],serviceTotals:{},lastObserved:{},missed:[]};f.periods.push(p);return p;
  },
  missed(s,p,at){const f=this.data(s),a=f.agreements.find(a=>a.id===p.agreementId);return a.members.slice(1).filter(id=>!f.orders.some(o=>o.id===p.routeOrders[id]&&o.status==='complete'&&o.returnedAt<=at));},
  transportPlan(s,id){
    const a=this.agreement(s),n=s.civilization.regions?.nodes[id];
    return a&&!a.paused&&a.exitedAt===null&&a.members.slice(1).includes(id)&&n&&['associated','integrated'].includes(n.relation)?{out:{...CivilFinanceContent.out},back:{...CivilFinanceContent.back},period:600}:null;
  },
  coordinationReady(s){const p=this.period(s);return !!p&&p.adminPayments.some(x=>this.now(s)-x.at>=0&&this.now(s)-x.at<10);},
  revision(s,action){
    const f=this.data(s),a=this.agreement(s);if(!a||f.revision||!this.political(s)||!['pause','resume','exit'].includes(action)||action==='pause'&&a.paused||action==='resume'&&!a.paused)return false;
    f.revision={agreementId:a.id,action,requestedAt:this.now(s),charter:s.civilization.society.axes.charter,effectiveAt:this.now(s)+(s.civilization.society.axes.charter==='constitution'?60:0)};this.applyRevision(s);return true;
  },
  applyRevision(s){
    const f=this.data(s),v=f?.revision,a=this.agreement(s);if(!v||!a||this.now(s)<v.effectiveAt||!this.political(s))return false;
    if(v.action==='exit'){a.exitedAt=this.now(s);f.activeId=null;for(const p of f.periods)if(p.agreementId===a.id&&p.closedAt===null){p.closedAt=Math.min(this.now(s),p.endsAt);p.missed=this.missed(s,p,p.closedAt);}}
    else a.paused=v.action==='pause';f.revision=null;return true;
  },
  pause(s){return this.revision(s,'pause');},resume(s){return this.revision(s,'resume');},exit(s){return this.revision(s,'exit');},
  settle(s){
    this.init(s);const f=this.data(s),at=this.now(s),flow={};this.applyRevision(s);const p=this.advance(s),a=this.agreement(s);
    if(f.lastSettledAt!==null&&at-f.lastSettledAt<10)return flow;f.lastSettledAt=at;
    if(!a||a.paused||!p||a.members.slice(1).some(id=>!this.transportPlan(s,id)))return flow;
    const mode=s.civilization.society.axes.devolution,fee=CivilFinanceContent.administration[mode];if(!fee)return flow;
    const costs={home:fee.home};if(fee.local)for(const id of a.members.slice(1))costs[id]=fee.local;
    if(Object.entries(costs).some(([id,n])=>(this.stores(s,id)?.knowledge||0)+1e-8<n))return flow;
    for(const [id,n]of Object.entries(costs)){this.stores(s,id).knowledge=Math.max(0,(this.stores(s,id).knowledge||0)-n);p.paidAdmin[id]=(p.paidAdmin[id]||0)+n;}
    p.adminPayments.push({at,mode,costs});flow.knowledge=-fee.home;return flow;
  },
  reserve(s,id='home'){
    const at=this.now(s),e=id==='home'?s.civilization.urban?.economy:s.civilization.municipal?.nodes[id]?.economy;
    let input=e?.paidInputs;
    if(!input||input.at>at||at-input.at>10){
      const f=id==='home'&&typeof CivilUrban!=='undefined'?CivilUrban.forecast(s):id!=='home'&&typeof CivilMunicipal!=='undefined'?CivilMunicipal.forecast(s,id):null;
      input=f?.paidInputs||f?.copy?.civilization?.urban?.economy?.paidInputs;
    }
    const food=id==='home'?CivilUrban.foodReserve(s):CivilMunicipal.foodReserve(s,id);
    return {food,medicine:this.population(s,id)*.01*12,tools:Math.max(4,(input?.resources?.tools||0)*12)};
  },
  reserveCheck(s,id,cost={}){const stores=this.stores(s,id);if(!stores)return false;const reserve=this.reserve(s,id);return [...new Set([...Object.keys(cost),...Object.keys(reserve)])].every(key=>(stores[key]||0)+1e-8>=(cost[key]||0)+(reserve[key]||0));},
  contributionCheck(s,id,cargo){
    const stores=this.stores(s,id);if(!stores)return false;const reserve=this.reserve(s,id);
    // Protect the resources this cart actually removes. Unrelated shortages
    // must not strand the sole returning cart that brings the next supplies.
    return Object.entries(cargo).every(([key,n])=>(stores[key]||0)+1e-8>=n+(reserve[key]||0));
  },
  nextCargo(s,id,capacity){
    const a=this.agreement(s),plan=this.transportPlan(s,id),f=this.data(s);if(!a||!plan||!this.coordinationReady(s)||capacity<14)return null;
    const index=this.periodIndex(s,a),orderId=a.id+':'+index+':'+id;
    if(f.orders.some(o=>o.id===orderId||o.node===id&&this.now(s)-o.dispatchedAt<600))return null;
    return {orderId,agreementId:a.id,periodIndex:index,cargo:{...plan.out}};
  },
  order(s,p){return this.data(s)?.orders.find(o=>o.id===p?.commonOrderId)||null;},
  original(s,p){return !!p&&s.civilization.regions?.shipments.some(x=>x===p);},
  hasRouteOrder(s,id){return !!this.data(s)?.orders.some(o=>o.node===id);},
  dispatch(s,p,cost){
    const q=this.nextCargo(s,p?.route,p?.capacity),r=s.civilization.regions;
    if(!q||!this.original(s,p)||!Number.isSafeInteger(p.id)||p.id<1||p.id>=r.nextShipment||r.shipments.filter(x=>x.id===p.id).length!==1||![64,128].includes(p.capacity)||p.capacity!==r.routes[p.route].capacity||!r.routes[p.route].enabled||p.purpose!=='common'||p.commonOrderId!==q.orderId||p.agreementId!==q.agreementId||p.periodIndex!==q.periodIndex||p.source!=='home'||p.target!==p.route||p.phase!=='outbound'||p.status!=='moving'||p.remaining!==r.routes[p.route].travel||p.legStartedAt!==this.now(s)||p.legDuration!==p.remaining||!this.same(p.cargo,q.cargo)||!this.same(cost,CivilRegions.dispatchCost(s,p.route,q.cargo))||!this.reserveCheck(s,'home',cost)||r.shipments.filter(x=>x.route===p.route).length!==1||!CivilRegions.staffedRoutes(s).has(p.route)||r.routes[p.route].condition!=='open')return false;
    const period=this.advance(s),o={id:q.orderId,agreementId:q.agreementId,periodIndex:q.periodIndex,node:p.route,shipmentId:p.id,capacity:p.capacity,dispatchedAt:this.now(s),travel:p.remaining,paid:{...cost},status:'outbound',deliveredAt:null,loadedAt:null,returnedAt:null,closedAt:null};
    for(const [k,v]of Object.entries(cost))s.stores[k]-=v;
    this.data(s).orders.push(o);period.routeOrders[p.route]=o.id;this.receipt(s,o,'out','home',o.node,q.cargo,this.now(s));return true;
  },
  receipt(s,o,leg,source,target,cargo,paidAt){
    const x={invoiceId:o.id+':'+leg,orderId:o.id,shipmentId:o.shipmentId,leg,source,target,cargo:{...cargo},paidAt,deliveredAt:null,returnedAt:null};this.data(s).receipts.push(x);return x;
  },
  legReceipt(s,o,leg){return this.data(s).receipts.find(x=>x.invoiceId===o.id+':'+leg);},
  arrived(s,p){return this.original(s,p)&&p.status==='moving'&&p.remaining===0&&Number.isInteger(p.legStartedAt)&&Number.isInteger(p.legDuration)&&p.legDuration>=1&&this.now(s)>=p.legStartedAt+p.legDuration;},
  receive(s,p){
    const o=this.order(s,p),route=s.civilization.regions?.routes[p?.route];if(!o||!this.arrived(s,p)||!this.validShipment(s,p)||route.condition!=='open')return false;
    if(p.phase==='outbound'&&o.status==='outbound'){
      const receipt=this.legReceipt(s,o,'out');if(receipt.deliveredAt!==null||receipt.returnedAt!==null)return false;
      CivilRegions.credit(this.stores(s,o.node),p.cargo);receipt.deliveredAt=this.now(s);o.deliveredAt=this.now(s);o.status='loading';return true;
    }
    if(p.phase==='inbound'&&o.status==='inbound'){
      const receipt=this.legReceipt(s,o,'back');if(!receipt||receipt.deliveredAt!==null||receipt.returnedAt!==null)return false;
      const first=!this.data(s).orders.some(x=>x.agreementId===o.agreementId&&x.status==='complete');
      CivilRegions.credit(s.stores,p.cargo);receipt.deliveredAt=this.now(s);o.returnedAt=this.now(s);o.closedAt=this.now(s);o.status='complete';
      const period=this.data(s).periods.find(x=>x.agreementId===o.agreementId&&x.index===o.periodIndex);
      if(period?.closedAt===this.now(s))period.missed=this.missed(s,period,period.closedAt);
      if(first&&typeof State!=='undefined'&&s===State&&typeof Civilization!=='undefined'&&Civilization.notify)Civilization.notify(CivilRegionContent[o.node].name+'收到药品与工具，木材也随原车运回了炉火城。第一笔互助往返记入公共账册。');return true;
    }
    return false;
  },
  returnCargo(s,p){return this.order(s,p)?{...CivilFinanceContent.back}:null;},
  loadReturn(s,p){
    const o=this.order(s,p),route=s.civilization.regions?.routes[p?.route];
    if(!o||!this.original(s,p)||o.status!=='loading'||p.phase!=='inbound'||p.status!=='loading'||p.source!==o.node||p.target!=='home'||Object.keys(p.cargo).length||route.condition!=='open'||!this.validShipment(s,p)||!this.contributionCheck(s,o.node,CivilFinanceContent.back))return false;
    for(const [k,v]of Object.entries(CivilFinanceContent.back))this.stores(s,o.node)[k]-=v;
    o.status='inbound';o.loadedAt=this.now(s);this.receipt(s,o,'back',o.node,'home',CivilFinanceContent.back,this.now(s));return true;
  },
  recordReturn(s,p){
    const o=this.order(s,p);if(!o||!this.arrived(s,p)||!this.validShipment(s,p))return false;
    if(p.phase==='returning'&&p.source===p.target&&['outbound','inbound'].includes(o.status)){
      const leg=o.status==='outbound'?'out':'back',receipt=this.legReceipt(s,o,leg);if(!receipt||receipt.deliveredAt!==null||receipt.returnedAt!==null)return false;
      CivilRegions.credit(this.stores(s,p.source),p.cargo);receipt.returnedAt=this.now(s);
      if(leg==='out'){o.status='cancelled';o.closedAt=this.now(s);}else{o.status='backReturned';o.returnedAt=this.now(s);}return true;
    }
    if(p.phase==='empty'&&p.source===o.node&&p.target==='home'&&['loading','backReturned'].includes(o.status)){
      o.status='cancelled';o.closedAt=this.now(s);return true;
    }
    return false;
  },
  validShipment(s,p){
    const o=this.order(s,p),r=s.civilization.regions,route=r?.routes[p?.route];if(!o||!route||!this.obj(p.cargo)||!['moving','held','loading'].includes(p.status)||p.purpose!=='common'||p.id!==o.shipmentId||p.route!==o.node||p.agreementId!==o.agreementId||p.periodIndex!==o.periodIndex||p.capacity!==o.capacity)return false;
    const loading=p.phase==='inbound'&&p.status==='loading';
    if(!Number.isInteger(p.legStartedAt)||p.legStartedAt<o.dispatchedAt||p.legStartedAt>this.now(s)||!Number.isInteger(p.legDuration)||p.legDuration<(loading?0:1)||p.legDuration>o.travel||!Number.isInteger(p.remaining)||p.remaining<0||p.remaining>p.legDuration||p.legDuration-p.remaining>this.now(s)-p.legStartedAt||loading&&(p.legDuration!==0||p.remaining!==0))return false;
    if(p.phase==='outbound'&&(p.legStartedAt!==o.dispatchedAt||p.legDuration!==o.travel)||p.phase==='inbound'&&(p.legStartedAt!==(loading?o.deliveredAt:o.loadedAt)||p.legDuration!==(loading?0:o.travel)))return false;
    if(o.status==='outbound')return this.same(p.cargo,CivilFinanceContent.out)&&p.source==='home'&&(p.phase==='outbound'&&p.target===o.node||p.phase==='returning'&&p.target==='home');
    if(o.status==='loading')return Object.keys(p.cargo).length===0&&p.source===o.node&&p.target==='home'&&(p.phase==='inbound'&&p.status==='loading'||p.phase==='empty');
    if(o.status==='inbound')return this.same(p.cargo,CivilFinanceContent.back)&&p.source===o.node&&(p.phase==='inbound'&&p.target==='home'||p.phase==='returning'&&p.target===o.node);
    if(o.status==='backReturned')return p.phase==='empty'&&p.source===o.node&&p.target==='home'&&Object.keys(p.cargo).length===0;
    return false;
  },
  observe(s,evidence){
    const p=this.period(s),a=this.agreement(s);if(!p||!a)return;
    const entries=Array.isArray(evidence)?evidence:evidence?[evidence]:a.members.map(nodeId=>({nodeId,...(nodeId==='home'?s.civilization.urban.economy:s.civilization.municipal.nodes[nodeId].economy)}));
    for(const e of entries){if(!e||!a.members.includes(e.nodeId)||e.at!==this.now(s)||e.at<p.startedAt||e.at>=p.endsAt||p.lastObserved[e.nodeId]!==undefined&&e.at-p.lastObserved[e.nodeId]<10)continue;
      const total=p.serviceTotals[e.nodeId]||(p.serviceTotals[e.nodeId]={observations:0,paidInputs:{},treatmentInputs:{},treatment:0,education:0});
      for(const field of ['paidInputs','treatmentInputs'])if(e[field]?.at===e.at)for(const [key,n]of Object.entries(e[field].resources||{}))if(CivilCatalog.resources.includes(key)&&Number.isFinite(n)&&n>=0&&(field!=='treatmentInputs'||key==='medicine'))total[field][key]=(total[field][key]||0)+n;
      const paidCare=e.treatmentInputs?.at===e.at&&Number.isFinite(e.treatmentInputs.resources?.medicine)&&e.treatmentInputs.resources.medicine>0;
      total.observations++;if(e.treatment===true&&paidCare)total.treatment++;if(e.education===true)total.education++;p.lastObserved[e.nodeId]=e.at;
    }
  },
  tick(s){this.init(s);this.applyRevision(s);this.advance(s);return false;},
  nextEvent(s){const f=this.data(s);return f&&!f.offered&&this.quoteAgreement(s)?'financeOffer':null;},
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,f=this.data(s),a=this.agreement(s);if(!f)return null;
    const end=message=>done(message)();
    if(id==='financeOffer'||!a){
      const ids=this.candidates(s),buttons={};for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
        const pair=[ids[i],ids[j]],q=this.quoteAgreement(s,pair);if(!q)continue;
        buttons['agree_'+pair.join('_')]={text:'与'+pair.map(x=>CivilRegionContent[x].name).join('、')+'议约',nextScene:'end',onChoose:()=>{const ok=this.approve(s,pair);f.offered=true;return end(ok?'三地在公共账册上签下了诊疗与道路互助约定。':'三方条件或议约知识不足，账册仍待签署。');}};
      }
      buttons.later={text:'暂缓商议',nextScene:'end',onChoose:()=>{f.offered=true;return end('代表留下互助草案，等待下一次议事。');}};
      const balances=['炉火城：'+Math.floor(s.stores.knowledge||0)+'/30知识',...ids.map(node=>CivilRegionContent[node].name+'：'+Math.floor(this.stores(s,node).knowledge||0)+'/10知识')].join('；');
      return {title:'三仓互助议约',text:['炉火城与两地各自保管仓库，共同照看诊疗与道路。','首次议约：炉火城30知识，两地各10知识。每600秒向每地送药品12、工具2；地方以木材12随原车回赠。',balances+'。','炉火城发车前须留下120秒口粮、治疗药品和维护工具。地方备足返赠木材后，同一辆车沿原路线返回，仍由原运输工照管。'],buttons};
    }
    const p=this.period(s),lines=a.members.slice(1).map(node=>CivilRegionContent[node].name+'：'+this.routeStatus(s,node));
    const mode=s.civilization.society.axes.devolution,fee=mode==='central'?'炉火城每10秒知识0.04':'三地各每10秒知识0.02';
    const buttons={close:{text:'合上账册',nextScene:'end',onChoose:done('代表们收好了互助账册。')}};
    for(const node of a.members.slice(1)){
      const waiting=this.waitingReturn(s,node);if(!waiting)continue;
      lines.push(CivilRegionContent[node].name+'可先空车返程，已送达物资不追回，本期不算履约；该路线会停发，车回后可在地区重新启用。木材长期不足时，可在市政原料分类补地方林场。');
      buttons['return_'+node]={text:CivilRegionContent[node].name+'空车返程',nextScene:'end',onChoose:()=>{
        if(this.waitingReturn(s,node)?.shipmentId!==waiting.shipmentId||!CivilRegions.returnShipment(s,waiting.shipmentId))return false;
        return end(CivilRegionContent[node].name+'的空车沿原路返回，路线已停发；已送达的药品工具留在当地，未完成的往返如实记账。');
      }};
    }
    if(!f.revision&&this.political(s))for(const action of [a.paused?'resume':'pause','exit'])buttons[action]={text:{resume:'恢复互助',pause:'暂停新车次',exit:'退出试行约定'}[action],nextScene:'end',onChoose:()=>end(this.revision(s,action)?(f.revision?'修订已公示，60秒后生效。':'互助约定已更新，在途车队继续按原账行驶。'):'当前尚不能修订约定。')};
    return {title:'诊疗与道路互助',text:[a.members.map(x=>x==='home'?'炉火城':CivilRegionContent[x].name).join('、')+'；'+fee+'。',...lines,...this.ledgerLines(s),f.revision?'修订公示尚余'+Math.max(0,f.revision.effectiveAt-this.now(s))+'秒。':a.paused?'新车次已暂停，旧车队仍在往返。':'已批准的车次按本地储备安排。'],buttons};
  },
  ledgerLines(s){
    const a=this.agreement(s),p=this.period(s);if(!a||!p)return ['账册正在整理。'];
    const name=id=>id==='home'?'炉火城':CivilRegionContent[id].name;
    const lines=['第'+(p.index+1)+'期 · 还剩'+Math.max(0,p.endsAt-this.now(s))+'秒（每期600秒）。',
      '本期已付记录费用：'+a.members.map(id=>name(id)+' '+Number((p.paidAdmin[id]||0).toFixed(2))).join('、')+'知识。'];
    const closed=this.data(s).periods.filter(x=>x.agreementId===a.id&&x.closedAt!==null).sort((x,y)=>y.index-x.index)[0];
    if(closed)lines.push('上一期：'+(closed.missed.length?'尚欠完整往返 '+closed.missed.map(name).join('、')+'；迟到交付仍记在原期。':'两地约定均已按期往返。'));
    return lines;
  },
  waitingReturn(s,id){
    const p=s.civilization.regions?.shipments.find(p=>p.route===id&&p.purpose==='common'&&p.phase==='inbound'&&p.status==='loading');
    if(!p||!this.validShipment(s,p))return null;
    const o=this.order(s,p),stores=this.stores(s,id),reserve=this.reserve(s,id);
    const missing=Object.entries(CivilFinanceContent.back).map(([key,n])=>({resource:key,required:n+(reserve[key]||0),stored:stores[key]||0,missing:Math.max(0,n+(reserve[key]||0)-(stores[key]||0))})).filter(x=>x.missing>1e-8);
    return {shipmentId:p.id,waited:Math.max(0,this.now(s)-o.deliveredAt),missing,constructionWaiting:[s.civilization.municipal?.nodes[id]?.project,s.civilization.services?.nodes[id]?.project,s.civilization.regions.projects[id]].some(p=>p?.status==='supplying')};
  },
  waitingText(s,id){
    const q=this.waitingReturn(s,id);if(!q)return null;
    const fmt=n=>Number(n.toFixed(2)),needs=q.missing.map(x=>(CivilText.labels[x.resource]||x.resource)+'缺'+fmt(x.missing)+'（现有'+fmt(x.stored)+'，需'+fmt(x.required)+'）').join('、');
    return '返程已等'+q.waited+'秒；'+(needs||'物资已备齐，等待通路与运输班组')+(q.constructionWaiting?'；占用工程运材车辆':'');
  },
  routeStatus(s,id){
    const a=this.agreement(s);if(!a||!a.members.includes(id))return '未参加互助';
    const waiting=this.waitingText(s,id);if(waiting)return waiting;
    const returning=s.civilization.regions.shipments.find(p=>p.route===id&&p.purpose==='common'&&p.phase==='empty');
    if(returning)return '原车空返'+(returning.status==='held'?'受阻，等待通路恢复':'在途，剩余'+returning.remaining+'秒');
    const index=this.periodIndex(s,a),o=this.data(s).orders.find(o=>o.agreementId===a.id&&o.periodIndex===index&&o.node===id);
    if(o)return ({outbound:'药品与工具在途',loading:'已收到，等待返程木材',inbound:'木材返程在途',backReturned:'木材已退回，空车待归',complete:'本周期已履约',cancelled:'本周期车次已退回'})[o.status];
    if(a.paused)return '新车次暂停';
    if(!this.coordinationReady(s))return '共同记录知识待补';
    const r=s.civilization.regions,route=r.routes[id];
    if(!route?.enabled)return '路线已停发';
    if(route.condition!=='open')return '道路中断，等待修复';
    if(r.shipments.some(p=>p.route===id))return '等待现有货车归来';
    if(!CivilRegions.staffedRoutes(s).has(id))return '运输班组不足';
    if(!this.reserveCheck(s,'home',CivilRegions.dispatchCost(s,id,CivilFinanceContent.out)))return '等待炉火城备足物资与120秒储备';
    return '等待原路线安排车次';
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    const s=State,f=this.data(s);if(!f)return;const a=this.agreement(s),visible=!!a||this.candidates(s).length>=2||f.agreements.length>0;
    if(!visible){$('#financeButton').hide();$('#financeSummary').hide();return;}
    const button=Civilization.button('financeButton',a?'查看共同约定':'商议三仓互助','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending=this.agreement(State)?'financeLedger':'financeOffer';Civilization.showPending();});
    button.contents().filter(function(){return this.nodeType===3;}).first().replaceWith(document.createTextNode(a?'查看共同约定':'商议三仓互助'));
    let line=$('#financeSummary');if(!line.length)line=$('<div>').attr('id','financeSummary').css({lineHeight:'1.8',marginTop:'12px',width:'420px',maxWidth:'100%'}).appendTo('#councilPanel');
    line.show().text(a?a.members.slice(1).map(id=>CivilRegionContent[id].name+'：'+this.routeStatus(s,id)).join('。'):f.agreements.length?'旧互助账册仍保留，代表可以商议新的约定。':'代表提出用原车队互送诊疗和道路物资。');$('#financeButton').show();
  },
  reset(){},
  validate(s){
    const f=this.data(s);if(f===undefined){if(this.traces(s))throw Error('共同货运缺少互助账册');return true;}
    const fail=()=>{throw Error('共同互助账册无效');},obj=v=>this.obj(v),integer=(v,min=0,max=this.now(s))=>Number.isSafeInteger(v)&&v>=min&&v<=max,money=v=>obj(v)&&Object.entries(v).every(([k,n])=>CivilCatalog.resources.includes(k)&&Number.isFinite(n)&&n>=0),date=v=>v===null||integer(v);
    if(!obj(f)||f.schema!==1||!integer(f.introducedAt)||!Number.isSafeInteger(f.nextAgreement)||f.nextAgreement<1||!date(f.lastSettledAt)||typeof f.offered!=='boolean'||!Array.isArray(f.agreements)||!Array.isArray(f.periods)||!Array.isArray(f.orders)||!Array.isArray(f.receipts)||!obj(s.civilization.regions))fail();
    const agreements=new Map(),periods=new Map(),orders=new Map(),receipts=new Map(),shipments=new Set(),invoiceIds=new Set();
    for(const a of f.agreements){
      if(!obj(a)||!integer(a.id,1,f.nextAgreement-1)||agreements.has(a.id)||!Array.isArray(a.members)||a.members.length!==3||a.members[0]!=='home'||new Set(a.members).size!==3||a.members.slice(1).some(id=>!this.known(id)||!Object.hasOwn(s.civilization.regions.nodes,id))||a.plan!==CivilFinanceContent.plan||!integer(a.approvedAt,f.introducedAt)||typeof a.paused!=='boolean'||!date(a.exitedAt)||a.exitedAt!==null&&a.exitedAt<a.approvedAt||!obj(a.axes)||!this.same(a.approvals,{home:30,[a.members[1]]:10,[a.members[2]]:10}))fail();
      if(Object.keys(a.axes).length!==Object.keys(CivilSociety.axes).length)fail();for(const [axis,definition]of Object.entries(CivilSociety.axes))if(!Object.hasOwn(definition.choices,a.axes[axis]))fail();agreements.set(a.id,a);
    }
    if(f.nextAgreement!==f.agreements.length+1||f.agreements.some((a,i)=>a.id!==i+1)||f.activeId!==null&&!agreements.has(f.activeId)||f.agreements.filter(a=>a.exitedAt===null).length!==(f.activeId===null?0:1)||f.activeId!==null&&agreements.get(f.activeId).exitedAt!==null)fail();
    for(const p of f.periods){
      const a=agreements.get(p?.agreementId);if(!obj(p)||!a||!integer(p.index,0,Number.MAX_SAFE_INTEGER)||p.id!==a.id+':'+p.index||periods.has(p.id)||p.startedAt!==a.approvedAt+p.index*600||p.startedAt>this.now(s)||p.endsAt!==p.startedAt+600||!date(p.closedAt)||p.closedAt!==null&&(p.closedAt<p.startedAt||p.closedAt>p.endsAt)||!obj(p.routeOrders)||!obj(p.paidAdmin)||!Array.isArray(p.adminPayments)||!obj(p.serviceTotals)||!obj(p.lastObserved)||!Array.isArray(p.missed)||new Set(p.missed).size!==p.missed.length||p.missed.some(id=>!a.members.slice(1).includes(id)))fail();
      const paid={},ats=new Set();let previous=null;for(const pay of p.adminPayments){const fee=CivilFinanceContent.administration[pay?.mode],expected=fee?{home:fee.home,...(fee.local?Object.fromEntries(a.members.slice(1).map(id=>[id,fee.local])):{})}:null;if(!obj(pay)||!fee||!integer(pay.at,p.startedAt,Math.min(this.now(s),p.endsAt-1))||ats.has(pay.at)||previous!==null&&pay.at-previous<10||f.lastSettledAt===null||pay.at>f.lastSettledAt||a.exitedAt!==null&&pay.at>a.exitedAt||!this.same(pay.costs,expected))fail();previous=pay.at;ats.add(pay.at);for(const [id,n]of Object.entries(pay.costs))paid[id]=(paid[id]||0)+n;}if(!this.same(p.paidAdmin,paid)||p.adminPayments.length>60)fail();
      for(const [id,t]of Object.entries(p.serviceTotals)){if(!a.members.includes(id)||!obj(t)||!integer(t.observations,1,60)||!integer(t.treatment,0,t.observations)||!integer(t.education,0,t.observations)||!money(t.paidInputs)||!money(t.treatmentInputs)||Object.keys(t.treatmentInputs).some(key=>key!=='medicine')||!integer(p.lastObserved[id],p.startedAt,Math.min(this.now(s),p.endsAt-1))||t.observations>Math.floor((p.lastObserved[id]-p.startedAt)/10)+1||(t.treatmentInputs.medicine||0)+1e-8<t.treatment*.01)fail();}
      if(Object.keys(p.lastObserved).some(id=>!Object.hasOwn(p.serviceTotals,id)))fail();periods.set(p.id,p);
    }
    for(const o of f.orders){
      const a=agreements.get(o?.agreementId),p=periods.get(o?.agreementId+':'+o?.periodIndex),route=s.civilization.regions.routes[o?.node];
      if(!obj(o)||!a||!p||!a.members.slice(1).includes(o.node)||!route||o.id!==a.id+':'+p.index+':'+o.node||orders.has(o.id)||!integer(o.shipmentId,1,s.civilization.regions.nextShipment-1)||shipments.has(o.shipmentId)||![64,128].includes(o.capacity)||o.capacity>route.capacity||o.travel!==CivilRegionContent[o.node].travel||!integer(o.dispatchedAt,p.startedAt,Math.min(this.now(s),p.endsAt-1))||!p.adminPayments.some(pay=>pay.at<=o.dispatchedAt&&o.dispatchedAt-pay.at<10)||!['outbound','loading','inbound','backReturned','complete','cancelled'].includes(o.status)||![o.deliveredAt,o.loadedAt,o.returnedAt,o.closedAt].every(date)||p.routeOrders[o.node]!==o.id)fail();
      const expected={...CivilFinanceContent.out,wood:1,food:o.paid?.food,...(o.capacity===128?{parts:.05}:{})};if(![1,2].includes(o.paid?.food)||!this.same(o.paid,expected)||o.deliveredAt!==null&&o.deliveredAt<o.dispatchedAt+o.travel||o.loadedAt!==null&&(o.deliveredAt===null||o.loadedAt<o.deliveredAt)||o.returnedAt!==null&&(o.loadedAt===null||o.returnedAt<o.loadedAt)||o.closedAt!==null&&o.closedAt<o.dispatchedAt||['complete','cancelled'].includes(o.status)!==(o.closedAt!==null))fail();
      if(a.exitedAt!==null&&o.dispatchedAt>a.exitedAt||o.status==='outbound'&&[o.deliveredAt,o.loadedAt,o.returnedAt,o.closedAt].some(x=>x!==null)||o.status==='loading'&&(o.deliveredAt===null||o.loadedAt!==null||o.returnedAt!==null)||o.status==='inbound'&&(o.loadedAt===null||o.returnedAt!==null)||o.status==='backReturned'&&(o.loadedAt===null||o.returnedAt===null)||o.status==='complete'&&(o.loadedAt===null||o.returnedAt!==o.closedAt||o.returnedAt<o.loadedAt+o.travel))fail();
      const live=s.civilization.regions.shipments.filter(x=>x.id===o.shipmentId);if(['complete','cancelled'].includes(o.status)?live.length!==0:live.length!==1||!this.validShipment(s,live[0]))fail();
      orders.set(o.id,o);shipments.add(o.shipmentId);
    }
    for(const p of f.periods){for(const [id,orderId]of Object.entries(p.routeOrders)){const o=orders.get(orderId);if(!o||o.node!==id||o.agreementId!==p.agreementId||o.periodIndex!==p.index)fail();}if(p.closedAt!==null&&JSON.stringify(p.missed)!==JSON.stringify(this.missed(s,p,p.closedAt))||p.closedAt===null&&p.missed.length)fail();}
    for(const x of f.receipts){
      const o=orders.get(x?.orderId),back=x?.leg==='back';if(!obj(x)||!o||!['out','back'].includes(x.leg)||x.invoiceId!==o.id+':'+x.leg||invoiceIds.has(x.invoiceId)||x.shipmentId!==o.shipmentId||x.source!==(back?o.node:'home')||x.target!==(back?'home':o.node)||!this.same(x.cargo,back?CivilFinanceContent.back:CivilFinanceContent.out)||x.paidAt!==(back?o.loadedAt:o.dispatchedAt)||!date(x.deliveredAt)||!date(x.returnedAt)||x.deliveredAt!==null&&x.returnedAt!==null||x.deliveredAt!==null&&x.deliveredAt<x.paidAt+o.travel||x.returnedAt!==null&&x.returnedAt<x.paidAt)fail();invoiceIds.add(x.invoiceId);receipts.set(x.invoiceId,x);
    }
    for(const o of f.orders){const out=receipts.get(o.id+':out'),back=receipts.get(o.id+':back');if(!out||out.deliveredAt!==o.deliveredAt||(o.loadedAt!==null)!==!!back||o.status==='outbound'&&(out.deliveredAt!==null||out.returnedAt!==null)||['loading','inbound','backReturned','complete'].includes(o.status)&&out.deliveredAt===null||o.status==='inbound'&&(back.deliveredAt!==null||back.returnedAt!==null)||o.status==='complete'&&(!back||back.deliveredAt!==o.closedAt)||o.status==='backReturned'&&(!back||back.returnedAt!==o.returnedAt)||o.status==='cancelled'&&o.deliveredAt===null&&out.returnedAt!==o.closedAt||o.status==='cancelled'&&o.loadedAt!==null&&(back?.returnedAt!==o.returnedAt||o.closedAt<o.returnedAt+o.travel)||o.status==='cancelled'&&o.deliveredAt!==null&&o.loadedAt===null&&o.closedAt<o.deliveredAt+o.travel)fail();}
    for(const p of s.civilization.regions.shipments)if(p.purpose==='common'||p.commonOrderId!==undefined||p.agreementId!==undefined||p.periodIndex!==undefined){if(!this.validShipment(s,p))fail();}
    if(Object.entries(s.civilization.regions.routes).some(([id,r])=>r.lastPurpose==='common'&&!this.hasRouteOrder(s,id)))fail();
    if(f.revision!==null){const v=f.revision,a=this.agreement(s);if(!obj(v)||!a||v.agreementId!==a.id||!['pause','resume','exit'].includes(v.action)||!integer(v.requestedAt,a.approvedAt)||!['custom','constitution'].includes(v.charter)||v.effectiveAt!==v.requestedAt+(v.charter==='constitution'?60:0))fail();}
    return true;
  }
};
