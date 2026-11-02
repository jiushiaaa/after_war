/* MPL-2.0 — Optional charter: no retrospective changes to old invoices or wars. */
var CivilTransit={
 pendingIds:['transitCouncil',...Object.keys(CivilWorldContent.regions).map(id=>'transitActor_'+id),...CivilForeign.pendingIds.filter(id=>id.startsWith('foreignPair_')).map(id=>'transitPair_'+id.slice(12))],
 data(d){return d?.foreign?.network;},
 includes(o,id){return o.from===id||o.to===id||o.transit?.via===id;},
 busy(d,id,physical=false){if(CivilSettlement.data(d))return CivilSettlement.busy(d,id,physical);return d.foreign.shipments.some(o=>o.arrivedAt===null&&this.includes(o,id))||!!this.data(d)?.supplies.some(o=>o.region===id&&o.arrivedAt===null)||!physical&&!!this.data(d)?.clearings?.some(o=>o.actor===id&&o.status==='pending');},
 log(d,at,kind,text){CivilForeign.addEvent(d.foreign,at,kind,text);},
 need(id){const p=CivilForeignContent.profiles[id];return {[p.need]:p.use*70};},
 supplyCost(id){return CivilStatecraft.add(this.need(id),{food:40,parts:6});},
 permit(d,key){return this.data(d)?.permits.findLast(p=>p.pair===key&&p.status==='active');},
 access(d,key,via){return !!d.nodes[via]&&!CivilForeign.ids(key).includes(via)&&d.nodes[via].control!=='occupied'&&d.nodes[via].infrastructure>=70&&CivilForeign.ids(key).every(id=>!['war','embargo'].includes(d.foreign.pairs[CivilForeign.pair(id,via)].phase));},
 canDeploy(d,id){return d.nodes[id]?.joinedAt!==null&&!!d.nodes[id]||d.foreign.leagues.pacts.some(p=>p.status==='active'&&p.type==='defense'&&CivilForeign.ids(p.pair).includes(id)&&CivilForeign.ids(p.pair).some(peer=>d.nodes[peer].joinedAt!==null));},
 doctrine(d,id,enemy,at){const p=CivilForeignContent.profiles[id],node=d.nodes[id];if(node.infrastructure<75||(node.stores[p.need]||0)<p.use*3)return 'hold';const reinforced=d.foreign.shipments.some(o=>o.aid&&o.to===enemy&&o.arrivedAt!==null&&!o.returned&&at-o.arrivedAt<=900);return reinforced&&p.resolve>=2?'raid':p.resolve>=3?'push':'hold';},
 canBorrow(d,id,value){return this.data(d)?.cash[id]?d.foreign.actors[id].balance-value>=0:true;},
 settlement(d,id,at,quote=false){
  const n=this.data(d),f=d.foreign,a=f?.actors[id];if(!n||!a||a.balance>=0||!quote&&this.busy(d,id,true)||at-(n.settledAt[id]??-10000)<600)return null;
  for(const peer of Object.keys(f.actors).filter(k=>k!==id&&f.actors[k].balance>0&&(quote||!this.busy(d,k,true))&&!CivilForeign.blocked(f.pairs[CivilForeign.pair(k,id)])).sort((a,b)=>f.actors[b].balance-f.actors[a].balance||a.localeCompare(b))){
   for(const item of Object.keys(CivilForeignContent.profiles[id].output)){
    const value=Math.min(240,-a.balance,f.actors[peer].balance),unit=CivilForeign.price(d,id,item),qty=Math.ceil(value/unit),cargo={[item]:qty},route=CivilLeagues.route(d,id,peer);
    if(CivilForeign.canSpend(d.nodes[id],cargo)&&CivilForeign.canSpend(d.nodes[peer],route.fare))return {peer,value,cargo,route};
   }
  }return null;
 },
 reason(s,action,args={}){
  const d=CivilWorld.data(s),n=this.data(d),at=s.civilization.elapsed;
  if(!d?.foreign?.leagues)return '先建立联盟与通路公约';if(!CivilWorld.political(s))return '先恢复国家行政';
  if(action==='open'){if(n)return '网络公约已运行';}
  else if(!n)return '先建立中转、治理与战线公约';
  else if(action==='permit'){
   if(!d.foreign.pairs[args.pair]||!this.access(d,args.pair,args.via))return '中转方必须已联络，且未与任一端禁运、交战或被占领';
   if(n.permits.some(p=>p.pair===args.pair&&['pending','active'].includes(p.status)))return '该线路已有通行安排';
  }else if(action==='revoke'){if(!this.permit(d,args.pair))return '没有生效通行权';}
  else if(action==='stance'){if(!d.foreign.pairs[args.pair]||d.foreign.pairs[args.pair].phase!=='war'||!CivilForeign.ids(args.pair).includes(args.actor)||!Object.hasOwn(CivilTransitContent.stances,args.mode))return '仅能调整正在交战一方的部署';const old=n.stances[args.pair]?.[args.actor];if(!this.canDeploy(d,args.actor))return '仅能协调共同法成员或共同法成员的防卫盟友；对手自主部署';if(old&&(old.mode===args.mode||at-old.at<300))return '当前部署相同或尚未间隔300秒';}
  else{
   if(!d.nodes[args.actor])return '先联络该地区';
   if(action==='supply'){if(n.supplies.some(o=>o.arrivedAt===null)||this.busy(d,args.actor))return '等待已发调剂或当地公共运力返空';if(d.nodes[args.actor].control==='occupied')return '先结束占领';}
   else if(action==='settle'){if(n.clearings?.some(o=>o.actor===args.actor&&o.status==='pending')||!this.settlement(d,args.actor,at,true))return '须有债权方和真实出口库存；同区间隔600秒，不能重复预约';}
   else if(action==='review'){if(!CivilLeagues.reputation(d,args.actor))return '没有待修复失信';if(n.reviews.some(r=>r.actor===args.actor&&r.completedAt===null))return '已有履约审查';}
   else if(action==='cash'||action==='credit'){if(!!n.cash[args.actor]===(action==='cash'))return '已采用该采购纪律';}
   else return '未知治理行动';
  }
  const cost=action==='open'?CivilTransitContent.opening:action==='supply'?this.supplyCost(args.actor):CivilTransitContent.costs[action];
  return CivilFinance.reserveCheck(s,'home',cost)?null:'预留议事与货物实付，并保留本城供养';
 },
 act(s,action,args={}){if(this.reason(s,action,args))return false;const cost=action==='open'?CivilTransitContent.opening:action==='supply'?this.supplyCost(args.actor):CivilTransitContent.costs[action];CivilServices.pay(s.stores,cost);CivilWorld.record(CivilWorld.data(s),{kind:'network',action,...args,at:s.civilization.elapsed,cost:{...cost}});return true;},
 apply(d,r){
  if(r.action==='open'){d.foreign.network={schema:1,startedAt:r.at,permits:[],supplies:[],cash:{},reviews:[],settledAt:{},stances:{},fronts:[]};return;}
  const n=this.data(d),f=d.foreign;
  if(r.action==='permit'){n.permits.push({id:n.permits.length+1,pair:r.pair,via:r.via,at:r.at,status:'pending',resolvedAt:null,expiresAt:null});return;}
  if(r.action==='revoke'){const p=this.permit(d,r.pair);p.status='withdrawn';p.endedAt=r.at;this.log(d,r.at,'passage',CivilForeign.name(p.via)+'终止新通行预约；原运单仍按实际战况履行。');return;}
  if(r.action==='supply'){n.supplies.push({id:n.supplies.length+1,region:r.actor,at:r.at,dueAt:r.at+600,arrivedAt:null,cargo:this.need(r.actor),fare:{food:40,parts:6}});return;}
  if(r.action==='cash'||r.action==='credit'){n.cash[r.actor]=r.action==='cash';return;}
  if(r.action==='review'){n.cash[r.actor]=true;n.reviews.push({actor:r.actor,at:r.at,cycles:0,completedAt:null,baseline:CivilLeagues.reputation(d,r.actor),deliveries:0});return;}
  if(r.action==='stance'){n.stances[r.pair]??={};n.stances[r.pair][r.actor]={mode:r.mode,at:r.at};return;}
  n.clearings??=[];n.clearings.push({actor:r.actor,at:r.at,expiresAt:r.at+1800,status:'pending',dispatchedAt:null});
 },
 validateRecord(d,r){
  const n=this.data(d),fail=()=>{throw Error('中转、战线或信用治理记录无效');};if(!d.foreign?.leagues)fail();
  const cost=r.action==='open'?CivilTransitContent.opening:r.action==='supply'&&d.nodes[r.actor]?this.supplyCost(r.actor):CivilTransitContent.costs[r.action];if(!cost||JSON.stringify(cost)!==JSON.stringify(r.cost))fail();
  if(r.action==='open'){if(n)fail();return;}if(!n)fail();
  if(r.action==='permit'){if(!d.foreign.pairs[r.pair]||!this.access(d,r.pair,r.via)||n.permits.some(p=>p.pair===r.pair&&['pending','active'].includes(p.status)))fail();}
  else if(r.action==='revoke'){if(!this.permit(d,r.pair))fail();}
  else if(r.action==='stance'){const old=n.stances[r.pair]?.[r.actor];if(!this.canDeploy(d,r.actor)||d.foreign.pairs[r.pair]?.phase!=='war'||!CivilForeign.ids(r.pair).includes(r.actor)||!Object.hasOwn(CivilTransitContent.stances,r.mode)||old&&(old.mode===r.mode||r.at-old.at<300))fail();}
  else if(!d.nodes[r.actor])fail();
  else if(r.action==='supply'){if(n.supplies.some(o=>o.arrivedAt===null)||this.busy(d,r.actor)||d.nodes[r.actor].control==='occupied')fail();}
  else if(r.action==='settle'){if(n.clearings?.some(o=>o.actor===r.actor&&o.status==='pending')||!this.settlement(d,r.actor,r.at,true))fail();}
  else if(r.action==='review'){if(!CivilLeagues.reputation(d,r.actor)||n.reviews.some(o=>o.actor===r.actor&&o.completedAt===null))fail();}
  else if(r.action==='cash'||r.action==='credit'){if(!!n.cash[r.actor]===(r.action==='cash'))fail();}else fail();
 },
 dispatch(d,r){const n=this.data(d);if(!n)return;const f=d.foreign;for(const request of n.clearings||[])if(request.status==='pending'){if(r.at>=request.expiresAt||f.actors[request.actor].balance>=0){request.status='closed';continue;}
  const q=this.settlement(d,request.actor,r.at);if(!q)continue;CivilServices.pay(d.nodes[request.actor].stores,q.cargo);CivilServices.pay(d.nodes[q.peer].stores,q.route.fare);CivilForeign.account(f,request.actor,q.value,r.at);CivilForeign.account(f,q.peer,-q.value,r.at);n.settledAt[request.actor]=r.at;
  const o={id:f.shipments.length+1,from:request.actor,to:q.peer,departedAt:r.at,dueAt:r.at+q.route.duration,arrivedAt:null,cargo:q.cargo,value:q.value,price:q.value/Object.values(q.cargo)[0],fare:{...q.route.fare},settlement:true,route:q.route.mode};this.stamp(d,o,q.route,r.at);f.shipments.push(o);this.log(d,r.at,'recovery',CivilForeign.name(request.actor)+'以实际出口安排清偿'+q.value+'账额，货物待交付；退运会恢复原债务。');
  request.status='sent';request.dispatchedAt=r.at;request.shipment=o.id;
 }},
 route(d,from,to,base){const key=CivilForeign.pair(from,to),p=this.permit(d,key);if(!p||base.mode!=='auto'||!this.access(d,key,p.via)||this.busy(d,p.via))return base;return {mode:'auto',duration:600,fare:{food:18,parts:2,tools:1},via:p.via,permit:p.id};},
 stamp(d,o,route,at){if(route.via)o.transit={via:route.via,permit:route.permit,stage:'outbound',nextAt:at+300,toll:{...CivilTransitContent.toll},tollPaid:false};},
 blocked(d,o){const t=o.transit;if(!this.access(d,CivilForeign.pair(o.from,o.to),t.via))return true;return this.data(d).fronts.some(front=>front.status==='active'&&Math.abs(front.position)>=20&&front.raid&&CivilForeign.ids(front.pair).some(id=>[o.from,o.to,t.via].includes(id)));},
 move(d,at){
  const n=this.data(d);if(!n)return;
  for(const o of n.supplies)if(o.arrivedAt===null&&at>=o.dueAt){CivilRegions.credit(d.nodes[o.region].stores,o.cargo);o.arrivedAt=at;this.log(d,at,'recovery',CivilForeign.name(o.region)+'收到国库实际调剂'+CivilHistory.costText(o.cargo)+'；没有替地方免除欠款。');}
  for(const o of d.foreign.shipments)if(o.transit&&o.arrivedAt===null){const t=o.transit;if(at<t.nextAt)continue;
   if(t.stage==='returning'){CivilRegions.credit(d.nodes[o.from].stores,o.cargo);if(!t.tollPaid)CivilRegions.credit(d.nodes[o.to].stores,t.toll);CivilForeign.account(d.foreign,o.from,-o.value,at);CivilForeign.account(d.foreign,o.to,o.value,at);o.returned=true;o.arrivedAt=at;t.stage='returned';this.log(d,at,'passage','中转第'+o.id+'批原货退回，原账额冲销；实际旅费不退。');continue;}
   if(this.blocked(d,o)){if(t.heldAt===undefined)t.heldAt=at;if(at-t.heldAt>=600){t.stage='returning';t.nextAt=at+300;}continue;}
   delete t.heldAt;
   if(t.stage==='outbound'){t.stage='hub';t.nextAt=at+300;o.dueAt=t.nextAt;if(!t.tollPaid){CivilRegions.credit(d.nodes[t.via].stores,t.toll);t.tollPaid=true;}this.log(d,at,'passage','第'+o.id+'批抵达'+CivilForeign.name(t.via)+'中转，实际交纳粮4、工具1；货物仍在途中。');}
   else if(t.stage==='hub')t.stage='ready';
  }
 },
 arrive(d,o){return o.transit?o.transit.stage==='ready':null;},
 beforeRound(d,r){const n=this.data(d);if(!n)return;const at=r.at;
  for(const front of n.fronts)if(front.status==='active'&&d.foreign.pairs[front.pair].phase!=='war'){front.status='ceasefire';front.endedAt=at;}
  this.move(d,at);
  for(const p of n.permits){if(p.status==='pending'&&at-p.at>=300){p.resolvedAt=at;const accepted=this.access(d,p.pair,p.via)&&CivilForeign.ids(p.pair).every(id=>d.foreign.pairs[CivilForeign.pair(id,p.via)].relation>=-10);p.status=accepted?'active':'refused';if(accepted)p.expiresAt=at+3600;this.log(d,at,'passage',CivilForeign.name(p.via)+(accepted?'批准':'拒绝')+CivilForeign.label(p.pair)+'的中转通行；逐单付费，最多3600秒。');}else if(p.status==='active'&&(at>=p.expiresAt||!this.access(d,p.pair,p.via))){p.status='closed';p.endedAt=at;this.log(d,at,'passage',CivilForeign.name(p.via)+'的中转预约到期或因局势关闭；已发货物依实际战况通行或退运。');}}
 },
 afterRound(d,r){const n=this.data(d);if(!n)return;const f=d.foreign,at=r.at;
  for(const review of n.reviews)if(review.completedAt===null){const id=review.actor,p=CivilForeignContent.profiles[id],a=f.actors[id],rep=CivilLeagues.reputation(d,id),ongoing=f.leagues.pacts.filter(p=>p.status==='active'&&CivilForeign.ids(p.pair).includes(id));
   const deliveries=f.shipments.filter(o=>o.from===id&&o.departedAt>=review.at&&o.arrivedAt!==null&&!o.returned&&!o.aid);
   review.deliveries=deliveries.length;const okay=a.balance>=0&&!CivilForeign.fighting(d,id)&&(d.nodes[id].stores[p.need]||0)>=p.use*3&&ongoing.every(p=>p.missed[id]===0)&&rep<=review.baseline&&r.political;
   if(rep>review.baseline)review.baseline=rep;review.cycles=okay?review.cycles+1:0;
   if(review.cycles>=4&&at-review.at>=1200&&deliveries.length>=2&&deliveries.reduce((sum,o)=>sum+o.value,0)>=40){f.leagues.reputation[id]=Math.max(0,rep-20);review.completedAt=at;this.log(d,at,'recovery',CivilForeign.name(id)+'经真实出口、无欠债与四轮持续履约，修复20失信；旧背约记录保留。');}
  }
 },
 battle(d,key,p,at){
  const n=this.data(d);if(!n)return false;const ids=CivilForeign.ids(key),nodes=ids.map(id=>d.nodes[id]);let front=n.fronts.findLast(x=>x.pair===key&&x.status==='active');
  if(!front){front={pair:key,at,status:'active',position:0,rounds:0,raid:false,history:[]};n.fronts.push(front);}
  if(nodes.every(x=>x.joinedAt!==null)||nodes.some(x=>x.control==='occupied'||x.population<5)||front.rounds>=6||Math.abs(front.position)>=60){front.status='ceasefire';front.endedAt=at;p.phase='truce';p.since=at;p.truceUntil=at+1800;p.pressure=25;p.battles=0;this.log(d,at,'front',CivilForeign.label(key)+'战线停火，位置'+front.position+'；不自动吞并整个地区。');return true;}
  const decisions=ids.map((id,i)=>{let mode=n.stances[key]?.[id]?.mode;if(!mode||!this.canDeploy(d,id))mode=this.doctrine(d,id,ids[1-i],at);const cfg=CivilTransitContent.stances[mode],supplied=CivilForeign.canSpend(d.nodes[id],cfg.cost);if(supplied)CivilServices.pay(d.nodes[id].stores,cfg.cost);const aid=d.foreign.markets?CivilMarkets.support(d,id,key,at,supplied):d.foreign.shipments.some(o=>o.aid&&o.to===id&&o.arrivedAt!==null&&!o.returned&&at-o.arrivedAt<=900);return {id,mode,supplied,force:supplied?cfg.force+Math.floor(nodes[i].infrastructure/25)+(aid?2:0):0,aid};});
  if(decisions.every(x=>!x.supplied)){front.rounds=6;return true;}
  const delta=(decisions[0].force-decisions[1].force)*5;front.position=CivilForeign.clamp(front.position+delta,-60,60);front.raid=decisions.some(x=>x.supplied&&x.mode==='raid');front.rounds++;p.battles++;
  for(let i=0;i<2;i++){const node=nodes[i],loss=decisions[1-i].supplied?(decisions[i].mode==='push'?3:2):0;node.population-=loss;node.casualties+=loss;node.infrastructure=Math.max(40,node.infrastructure-(decisions[1-i].supplied?5:0));node.stableSeconds=0;}
  front.history.push({at,position:front.position,decisions});this.log(d,at,'front',CivilForeign.label(key)+'战线位置'+front.position+'；'+decisions.map(x=>CivilForeign.name(x.id)+'：'+CivilTransitContent.stances[x.mode].name+(x.supplied?'，军需实付':'，缺军需停摆')+(x.aid?'，有实际到货盟援':'')).join('；')+'。');return true;
 },
 event(id,done){if(!this.pendingIds.includes(id))return null;const s=State,d=CivilWorld.data(s),n=this.data(d),text=[],buttons={};
  const action=(key,label,kind,args={})=>{const cost=kind==='open'?CivilTransitContent.opening:kind==='supply'?this.supplyCost(args.actor):CivilTransitContent.costs[kind];text.push(label+'：'+CivilHistory.costText(cost)+'；'+(this.reason(s,kind,args)||'可以执行'));buttons[key]={text:label,available:()=>!this.reason(s,kind,args),nextScene:'end',onChoose:()=>done(this.act(s,kind,args)?'安排已登记，货物、通行与责任仍须实际履行。':'条件已变化，没有执行。')()};};
  const go=(key,label,pending)=>buttons[key]={text:label,nextScene:'end',onChoose:()=>{s.civilization.pending=pending;}};
  if(id==='transitCouncil'){if(!n){text.push('中转需第三方批准和真实通行费；战线受实际军需、部署及到货盟援影响。信用须真实出口偿债和持续履约修复，不能花知识直接消除失信。');action('open','建立中转与治理公约','open');}else{go('markets','国家供需与周转','marketCouncil');for(const actor of Object.keys(d.nodes)){go(actor,CivilForeign.name(actor),'transitActor_'+actor);text.push(CivilForeign.name(actor)+'：清算'+d.foreign.actors[actor].balance+(d.foreign.actors[actor].overdueAt!==null?'（欠款逾期）':'')+'，失信'+CivilLeagues.reputation(d,actor)+'，公共服务'+d.nodes[actor].stableSeconds+'/600秒');}text.push('先选地区查看生产投入、债务与治理；再选另一地区查看中转、通行和战线。');}}
  else if(id.startsWith('transitActor_')){const actor=id.slice(13);if(!n||!d.nodes[actor])return null;const cfg=CivilForeignContent.profiles[actor],a=d.foreign.actors[actor];text.push(CivilForeign.name(actor)+'：'+CivilText.labels[cfg.need]+'库存'+Math.floor(d.nodes[actor].stores[cfg.need]||0)+'，三轮安全线'+cfg.use*3+'、采购目标'+CivilForeign.target(actor,d)+'；清算'+a.balance+'，失信'+CivilLeagues.reputation(d,actor)+'，连续公共服务'+d.nodes[actor].stableSeconds+'/600秒。');text.push('国库调剂70轮生产投入，另付粮40/零件6承运；600秒后到货，最多一批，占目的地公共运力。出口清偿预约最多1800秒，旧货到达腾出运力后优先派出；债权方接收真实货物，退运恢复原债。自有账额采购避免新赊购，不能免除现债。');
   action('supply','国库调剂生产投入','supply',{actor});action('settle','组织出口清偿','settle',{actor});action('cash',n.cash[actor]?'恢复通常授信采购':'只用自有账额采购',n.cash[actor]?'credit':'cash',{actor});if(CivilLeagues.reputation(d,actor))action('review','申请履约信用修复','review',{actor});
   const queued=n.clearings?.findLast(o=>o.actor===actor);if(queued)text.push('清偿预约：'+({pending:'等双方旧货到达',sent:'已实际出货',closed:'到期或债务已结清'}[queued.status]));
   const review=n.reviews.findLast(o=>o.actor===actor);if(review)text.push('信用审查：'+(review.completedAt!==null?'已修复20失信':'持续合格'+review.cycles+'/4轮，审查后出口到货'+review.deliveries+'/2批；至少1200秒且到货价值40，须无欠债、无战争、投入安全和盟约足额。'));
   for(const other of Object.keys(d.nodes))if(other!==actor)go(other,'通路：'+CivilForeign.name(other),'transitPair_'+CivilForeign.pair(actor,other));
  }else{const key=id.slice(12);if(!n||!d.foreign.pairs[key])return null;text.push(CivilForeign.label(key));const p=this.permit(d,key);if(p){text.push('经'+CivilForeign.name(p.via)+'中转，通行预约余'+Math.max(0,p.expiresAt-s.civilization.elapsed)+'秒；两段各300秒，粮18/零件2/工具1，其中粮4/工具1到站付中转方。三方共占用公共运力；遇封锁先滞留，600秒后返航300秒，冲销原货款。仅自主择路的新单采用中转，护航/绕行偏好不改。');action('revoke','撤回新通行预约','revoke',{pair:key});}else for(const via of Object.keys(d.nodes).filter(x=>!CivilForeign.ids(key).includes(x)))action(via,'申请经'+CivilForeign.name(via)+'中转','permit',{pair:key,via});
   const recent=n.permits.filter(p=>p.pair===key).at(-1);if(recent)text.push('最近通行申请：'+({pending:'待第三方答复',active:'已批准',refused:'拒绝',closed:'到期或局势关闭',withdrawn:'主动终止新预约'}[recent.status]));
   for(const o of d.foreign.shipments.filter(o=>o.transit&&CivilForeign.pair(o.from,o.to)===key).slice(-3))text.push('中转第'+o.id+'批：'+CivilHistory.costText(o.cargo)+'，经'+CivilForeign.name(o.transit.via)+'；'+(o.returned?'已退货冲销':o.arrivedAt!==null?'已交付':o.transit.heldAt!==undefined?'冲突滞留':({outbound:'驶向中转港',hub:'已付费离港',ready:'即将交付',returning:'返航中'}[o.transit.stage]))+'；'+(o.transit.tollPaid?'通行费已实际支付':'通行费待到站支付')+'。');
   const front=n.fronts.findLast(x=>x.pair===key);if(front)text.push('战线'+(front.status==='active'?'交战':'停火')+'：位置'+front.position+'（正数前者推进，负数后者推进），实战'+front.rounds+'轮；推进60或六轮战疲停火，不自动吞并。袭扰且推进20会截断涉及战区的中转。');
   if(d.foreign.pairs[key].phase==='war')for(const actor of CivilForeign.ids(key))for(const[mode,cfg]of Object.entries(CivilTransitContent.stances))action(actor+mode,CivilForeign.name(actor)+'：'+cfg.name,'stance',{pair:key,actor,mode});
  }
  buttons.close={text:'合上通路与治理记录',nextScene:'end',onChoose:done('实际供给、贸易、信用和局势继续结算。')};return {title:'通路、战线与治理',text,buttons};
 }
};
