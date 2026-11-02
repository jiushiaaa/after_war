/* MPL-2.0 — Opt-in rules, replayed only after the paid league/open record.
 * Schema 1 foreign history and already-dispatched cargo remain unchanged. */
var CivilLeagues={
  pendingIds:['leagueCouncil',...Object.keys(CivilWorldContent.regions).map(id=>'leagueActor_'+id),...CivilForeign.pendingIds.filter(id=>id.startsWith('foreignPair_')).flatMap(id=>['leaguePair_'+id.slice(12),'leagueRoute_'+id.slice(12)])],
  data(d){return d?.foreign?.leagues;},
  active(d,key){return this.data(d)?.pacts.findLast(p=>p.pair===key&&p.status==='active');},
  count(d,id){return this.data(d).pacts.filter(p=>p.status==='active'&&CivilForeign.ids(p.pair).includes(id)).length;},
  log(d,at,kind,text){CivilForeign.addEvent(d.foreign,at,kind,text);},
  reputation(d,id){return this.data(d)?.reputation[id]||0;},
  credit(d,id){if(!this.data(d))return 0;return this.data(d).pacts.filter(p=>p.type==='commerce'&&p.status==='active'&&CivilForeign.ids(p.pair).includes(id)).length*40-this.reputation(d,id)*3;},
  deadline(f,id){const a=f.actors[id],extension=f.leagues?.extensions[id];return extension&&extension.debtSince===a.debtSince?extension.until:a.debtSince+1800;},
  busy(d,id){return d.foreign.shipments.some(o=>o.arrivedAt===null&&(o.from===id||o.to===id));},
  complement(a,b){const pa=CivilForeignContent.profiles[a],pb=CivilForeignContent.profiles[b];return Object.hasOwn(pa.output,pb.need)||Object.hasOwn(pb.output,pa.need);},
  acceptance(d,key,type){const [a,b]=CivilForeign.ids(key),p=d.foreign.pairs[key];return 40+Math.floor(p.relation/2)-Math.floor(p.pressure/3)+(this.complement(a,b)?20:0)+(d.nodes[a].joinedAt!==null&&d.nodes[b].joinedAt!==null?15:0)+(type==='defense'&&(CivilForeign.fighting(d,a)||CivilForeign.fighting(d,b))?15:0)-Math.max(this.reputation(d,a),this.reputation(d,b));},
  offerReason(d,key,type,at){const l=this.data(d),pair=d.foreign?.pairs[key];if(!l||!pair||!Object.hasOwn(CivilLeagueContent.pacts,type))return '先建立联盟公约';if(this.active(d,key))return '已有生效联盟';const ended=l.pacts.findLast(p=>p.pair===key&&p.endedAt!==null);if(ended&&at-ended.endedAt<1800)return '盟约结束后须冷静1800秒再议';if(l.offers.some(o=>o.pair===key&&o.resolvedAt===null))return '双方正在审议';if(CivilForeign.ids(key).some(id=>this.count(d,id)>=2))return '每方最多承担两份生效联盟';if(l.offers.some(o=>o.pair===key&&at-o.at<1800))return '同一对地区须间隔1800秒再议';if(['war','embargo'].includes(pair.phase))return '先调停双方禁运或战争';return null;},
  creditor(d,id){return Object.keys(d.foreign.actors).filter(k=>k!==id&&d.foreign.actors[k].balance>0).sort((a,b)=>d.foreign.actors[b].balance-d.foreign.actors[a].balance||a.localeCompare(b))[0];},
  workoutReason(d,id){const l=this.data(d),a=d.foreign?.actors[id];if(!l||!a||a.balance>=0)return '没有待展期的清算欠款';if(l.extensions[id]?.debtSince===a.debtSince)return '这轮欠款已使用一次展期';if(l.workouts.some(o=>o.debtor===id&&o.resolvedAt===null))return '债权方正在审议';if(l.workouts.some(o=>o.debtor===id&&o.debtSince===a.debtSince))return '本轮欠款已提出过申请，须真实出口清偿';if(!this.creditor(d,id))return '没有可审议的债权方';return null;},
  reason(s,action,args={}){
    const d=CivilWorld.data(s),l=this.data(d),at=s.civilization.elapsed;
    if(!d?.foreign||d.foreign.round<2)return '联席至少实际运行两轮后再建立联盟公约';
    if(!CivilWorld.political(s))return '先恢复国家行政';
    let reason=null;
    if(action==='open'){if(l)return '联盟公约已经启用';}
    else if(!l)return '先建立联盟公约';
    else if(action==='offer')reason=this.offerReason(d,args.pair,args.type,at);
    else if(action==='workout')reason=this.workoutReason(d,args.actor);
    else if(action==='route'){
      if(!d.foreign.pairs[args.pair]||!Object.hasOwn(CivilLeagueContent.routes,args.mode))return '未知通路';
      const route=l.routes[args.pair];if((route?.mode||'auto')===args.mode)return '已采用此路线';if(route&&at-route.at<600)return '改线须间隔600秒';
    }else if(['notice','breach'].includes(action)){
      const p=this.active(d,args.pair);if(!p||!CivilForeign.ids(args.pair).includes(args.actor))return '该方没有生效盟约';if(action==='notice'&&p.notice)return '已登记退出通知';
    }else return '未知联盟行动';
    if(reason)return reason;
    const cost=action==='open'?CivilLeagueContent.opening:CivilLeagueContent.costs[action];
    return CivilFinance.reserveCheck(s,'home',cost)?null:'备齐实际议事经费，并保留本城供养';
  },
  act(s,action,args={}){
    if(this.reason(s,action,args))return false;
    const d=CivilWorld.data(s),cost={...(action==='open'?CivilLeagueContent.opening:CivilLeagueContent.costs[action])};
    CivilServices.pay(s.stores,cost);CivilWorld.record(d,{kind:'league',action,...args,at:s.civilization.elapsed,cost});return true;
  },
  apply(d,r){
    if(r.action==='open'){d.foreign.leagues={schema:1,startedAt:r.at,pacts:[],offers:[],reputation:{},routes:{},workouts:[],extensions:{}};return;}
    const l=this.data(d);
    if(r.action==='offer'){this.offer(d,r.pair,r.type,r.at,'联席提议');return;}
    if(r.action==='route'){l.routes[r.pair]={mode:r.mode,at:r.at};this.log(d,r.at,'route',CivilForeign.label(r.pair)+'改用'+CivilLeagueContent.routes[r.mode].name+'；只影响新发运单。');return;}
    if(r.action==='workout'){const a=d.foreign.actors[r.actor];l.workouts.push({debtor:r.actor,creditor:this.creditor(d,r.actor),debtSince:a.debtSince,at:r.at,resolvedAt:null,accepted:null,fee:0});return;}
    const p=this.active(d,r.pair);
    if(r.action==='notice'){p.notice={actor:r.actor,at:r.at,dueAt:r.at+600};this.log(d,r.at,'alliance',CivilForeign.name(r.actor)+'通知退出'+CivilForeign.label(r.pair)+'联盟；600秒通知期仍承担费用和援助。');}
    else this.breakPact(d,p,[r.actor],r.at,'提前撕毁盟约');
  },
  validateRecord(d,r){
    const fail=()=>{throw Error('联盟、贸易线路或展期记录无效');},l=this.data(d),f=d.foreign;
    if(!f)fail();
    const cost=r.action==='open'?CivilLeagueContent.opening:CivilLeagueContent.costs[r.action];if(!cost||JSON.stringify(cost)!==JSON.stringify(r.cost))fail();
    if(r.action==='open'){if(l||f.round<2)fail();return;}if(!l)fail();
    if(r.action==='offer'){if(this.offerReason(d,r.pair,r.type,r.at))fail();}
    else if(r.action==='route'){const route=l.routes[r.pair];if(!f.pairs[r.pair]||!Object.hasOwn(CivilLeagueContent.routes,r.mode)||(route?.mode||'auto')===r.mode||route&&r.at-route.at<600)fail();}
    else if(r.action==='workout'){if(this.workoutReason(d,r.actor))fail();}
    else if(['notice','breach'].includes(r.action)){const p=this.active(d,r.pair);if(!p||!CivilForeign.ids(r.pair).includes(r.actor)||r.action==='notice'&&p.notice)fail();}
    else fail();
  },
  offer(d,key,type,at,source){this.data(d).offers.push({pair:key,type,at,source,resolvedAt:null,accepted:null,score:null});this.log(d,at,'alliance',CivilForeign.label(key)+'提出'+CivilLeagueContent.pacts[type].name+'（'+source+'）；至少300秒后答复。');},
  breakPact(d,p,actors,at,cause){
    p.status='broken';p.endedAt=at;p.cause=cause;p.blame=[...actors];const l=this.data(d),pair=d.foreign.pairs[p.pair];
    pair.relation=Math.max(-100,pair.relation-25);pair.pressure=Math.min(100,pair.pressure+25);
    for(const id of actors){l.reputation[id]=Math.min(100,this.reputation(d,id)+20);for(const[key,other]of Object.entries(d.foreign.pairs))if(key!==p.pair&&CivilForeign.ids(key).includes(id))other.relation=Math.max(-100,other.relation-6);}
    this.log(d,at,'breach',CivilForeign.label(p.pair)+'盟约中断：'+cause+'；'+(actors.length?actors.map(CivilForeign.name).join('、')+'失信+20，第三方关系下降，授信减少。':'外部占领中断履约，不计自愿背约失信。')+'旧货与旧债仍须履行。');
  },
  beforeRound(d,r){
    const l=this.data(d);if(!l)return;const f=d.foreign,at=r.at;
    for(const o of l.offers)if(o.resolvedAt===null&&at-o.at>=300){
      const ids=CivilForeign.ids(o.pair),pair=f.pairs[o.pair];o.resolvedAt=at;o.score=this.acceptance(d,o.pair,o.type);
      o.accepted=o.score>=50&&!['war','embargo'].includes(pair.phase)&&ids.every(id=>this.count(d,id)<2&&d.nodes[id].control!=='occupied'&&CivilForeign.canSpend(d.nodes[id],CivilLeagueContent.pacts[o.type].upkeep));
      if(o.accepted){l.pacts.push({id:l.pacts.length+1,pair:o.pair,type:o.type,status:'active',at,paidCycles:0,missed:Object.fromEntries(ids.map(id=>[id,0])),calls:[],notice:null,endedAt:null});pair.relation=Math.min(100,pair.relation+10);}
      this.log(d,at,'alliance',CivilForeign.label(o.pair)+(o.accepted?'接受':'拒绝')+CivilLeagueContent.pacts[o.type].name+'；判断'+o.score+'/50，仍须有空余承诺与实际经费。');
    }
    for(const o of l.workouts)if(o.resolvedAt===null&&at-o.at>=300){
      const a=f.actors[o.debtor],creditor=f.actors[o.creditor],profile=CivilForeignContent.profiles[o.debtor];o.resolvedAt=at;
      o.accepted=a.balance<0&&a.debtSince===o.debtSince&&creditor.balance>0&&this.reputation(d,o.debtor)<40&&!CivilForeign.fighting(d,o.debtor)&&Object.keys(profile.output).some(k=>CivilForeign.canSpend(d.nodes[o.debtor],{[k]:10}));
      if(o.accepted){o.fee=Math.ceil(Math.min(-a.balance,creditor.balance)*.1);CivilForeign.account(f,o.debtor,-o.fee,at);CivilForeign.account(f,o.creditor,o.fee,at);l.extensions[o.debtor]={debtSince:a.debtSince,until:Math.max(at,this.deadline(f,o.debtor))+600,at,fee:o.fee,creditor:o.creditor};a.overdueAt=null;}
      this.log(d,at,'workout',CivilForeign.name(o.creditor)+(o.accepted?'同意':'拒绝')+CivilForeign.name(o.debtor)+'展期；'+(o.accepted?'旧本金保留，新增账额费用'+o.fee+'、期限延长600秒。':'没有增加信用或抹除欠款。'));
    }
    for(const p of l.pacts)if(p.status==='active'){
      const ids=CivilForeign.ids(p.pair),pair=f.pairs[p.pair];
      if(pair.phase==='war'||ids.some(id=>d.nodes[id].control==='occupied')){this.breakPact(d,p,ids.some(id=>d.nodes[id].control==='occupied')?[]:ids,at,'双边交火或地方被占领，履约中断');continue;}
      const retreat=ids.filter(id=>{const cfg=CivilForeignContent.profiles[id];return p.paidCycles>=3&&CivilForeign.overdue(f,id,at)&&(d.nodes[id].stores[cfg.need]||0)<cfg.use*3;});
      if(retreat.length){this.breakPact(d,p,retreat,at,'地方主动保留危急生产投入，拒绝继续承担联盟义务');continue;}
      const cost=CivilLeagueContent.pacts[p.type].upkeep;
      for(const id of ids){if(CivilForeign.canSpend(d.nodes[id],cost)){CivilServices.pay(d.nodes[id].stores,cost);p.missed[id]=0;}else p.missed[id]++;}
      const failed=ids.filter(id=>p.missed[id]>=2);if(failed.length){this.breakPact(d,p,failed,at,'连续两轮拖欠联盟维护');continue;}
      if(ids.every(id=>p.missed[id]===0)){p.paidCycles++;pair.pressure=Math.max(0,pair.pressure-8);}
      if(p.type!=='defense'){this.endNotice(d,p,at);continue;}
      for(const target of ids){const ally=ids.find(id=>id!==target),war=Object.entries(f.pairs).find(([key,q])=>q.phase==='war'&&key!==p.pair&&CivilForeign.ids(key).includes(target));
        if(war&&!p.calls.some(c=>c.target===target&&c.war===war[0]&&c.warSince===war[1].since))p.calls.push({target,ally,war:war[0],warSince:war[1].since,at,dueAt:at+600,status:'pending'});
      }
      for(const call of p.calls)if(call.status==='pending'){
        if(f.pairs[call.war].phase!=='war'){call.status='cancelled';continue;}
        const fare={food:12,parts:3,tools:2},cost=CivilStatecraft.add(CivilLeagueContent.aid,fare);
        if(!this.busy(d,call.ally)&&!this.busy(d,call.target)&&CivilForeign.canSpend(d.nodes[call.ally],cost)){
          CivilServices.pay(d.nodes[call.ally].stores,cost);f.shipments.push({id:f.shipments.length+1,from:call.ally,to:call.target,departedAt:at,dueAt:at+600,arrivedAt:null,cargo:{...CivilLeagueContent.aid},price:0,value:0,fare,route:'escort',aid:true});call.status='sent';call.shipment=f.shipments.length;
          const opponent=CivilForeign.ids(call.war).find(id=>id!==call.target),reaction=f.pairs[CivilForeign.pair(call.ally,opponent)];reaction.relation=Math.max(-100,reaction.relation-10);reaction.pressure=Math.min(100,reaction.pressure+12);
          this.log(d,at,'alliance',CivilForeign.name(call.ally)+'实际派出护航援助给'+CivilForeign.name(call.target)+'，600秒后到达；与对方交战国关系下降10、压力增加12。');
        }else if(at>=call.dueAt){call.status='refused';this.breakPact(d,p,[call.ally],at,'未在600秒内履行战时援助');break;}
      }
      this.endNotice(d,p,at);
    }
  },
  endNotice(d,p,at){if(p.status==='active'&&p.notice&&at>=p.notice.dueAt){p.status='ended';p.endedAt=at;for(const call of p.calls)if(call.status==='pending')call.status='cancelled';this.log(d,at,'alliance',CivilForeign.label(p.pair)+'通知期届满，正常解约；旧援助运单继续履行。');}},
  afterRound(d,r){
    const l=this.data(d);if(!l)return;const f=d.foreign;
    // One autonomous initiative per round. Actual repeated deliveries establish
    // mutual interest; no random free allies or all-to-all alliance spam.
    const candidates=Object.entries(f.pairs).filter(([key,p])=>p.relation>=16&&['calm','truce'].includes(p.phase)&&f.shipments.filter(o=>o.arrivedAt!==null&&!o.returned&&CivilForeign.pair(o.from,o.to)===key).length>=2).sort((a,b)=>b[1].relation-a[1].relation||a[0].localeCompare(b[0]));
    for(const[key]of candidates){const type=CivilForeign.ids(key).some(id=>CivilForeign.fighting(d,id))?'defense':'commerce';if(!this.offerReason(d,key,type,r.at)){this.offer(d,key,type,r.at,'各方根据往来主动议约');break;}}
  },
  route(d,from,to){
    if(!this.data(d))return {fare:{food:8,parts:1},duration:300};
    const key=CivilForeign.pair(from,to);let mode=this.data(d).routes[key]?.mode||'auto';if(mode==='auto'&&(CivilForeign.fighting(d,from)||CivilForeign.fighting(d,to)))mode='detour';
    const cfg=CivilLeagueContent.routes[mode],fare={...cfg.fare};if(this.active(d,key)?.type==='commerce')fare.food=Math.max(1,fare.food-2);
    return {fare,duration:cfg.duration,mode};
  },
  arrive(d,o,at){
    // Pre-charter manifests retain their original delivery promise forever.
    if(o.arrivedAt!==null)return false;
    if(!o.route)return true;
    const risk=CivilForeign.fighting(d,o.from)||CivilForeign.fighting(d,o.to)||['war','embargo'].includes(d.foreign.pairs[CivilForeign.pair(o.from,o.to)].phase);
    if(!risk||o.route==='detour'||o.route==='escort')return true;
    if(o.heldAt===undefined){o.heldAt=at;this.log(d,at,'route',CivilForeign.name(o.from)+'至'+CivilForeign.name(o.to)+'的直达货车因冲突滞留；600秒后仍不通则退运。');}
    if(at-o.heldAt<600)return false;
    CivilRegions.credit(d.nodes[o.from].stores,o.cargo);CivilForeign.account(d.foreign,o.from,-o.value,at);CivilForeign.account(d.foreign,o.to,o.value,at);o.returned=true;o.arrivedAt=at;
    this.log(d,at,'route','第'+o.id+'批直达货物已退回原仓，原清算账额反向冲销，旅费不退。');return false;
  },
  event(id,done){
    if(!this.pendingIds.includes(id))return null;const s=State,d=CivilWorld.data(s),l=this.data(d),text=[],buttons={};
    const action=(key,label,kind,args={})=>{const reason=this.reason(s,kind,args);text.push(label+'：'+CivilHistory.costText(kind==='open'?CivilLeagueContent.opening:CivilLeagueContent.costs[kind])+'；'+(reason||'可以执行'));buttons[key]={text:label,available:()=>!this.reason(s,kind,args),nextScene:'end',onChoose:()=>done(this.act(s,kind,args)?'议事已登记，后续按真实承诺与运输履行。':'条件已变化，没有执行。')()};};
    const go=(key,label,pending)=>buttons[key]={text:label,nextScene:'end',onChoose:()=>{s.civilization.pending=pending;}};
    if(id==='leagueCouncil'){
      if(!l){text.push('建立联盟公约后，各方会主动议约、承担维护与战时援助；毁约影响第三方和信用。新贸易线路可护航或绕行，旧运单不改。清算展期需要债权方同意，旧本金和费用仍待出口偿付。');action('open','建立联盟与通路公约','open');}
      else{const active=l.pacts.filter(p=>p.status==='active');text.push('生效联盟'+active.length+'份；每方最多两份承诺。先选地区，再看双边联盟、通路或欠款。');for(const p of active)text.push(CivilForeign.label(p.pair)+' · '+CivilLeagueContent.pacts[p.type].name+' · 已付'+p.paidCycles+'轮'+(p.notice?' · 退出通知中':''));for(const actor of Object.keys(d.foreign.actors))go(actor,CivilForeign.name(actor),'leagueActor_'+actor);}
    }else if(id.startsWith('leagueActor_')){
      const actor=id.slice(12);if(!l||!d.foreign.actors[actor])return null;const a=d.foreign.actors[actor];text.push(CivilForeign.name(actor)+'：清算账额'+a.balance+'，失信记录'+this.reputation(d,actor)+'；联盟与失信使授信修正'+this.credit(d,actor)+'。');
      if(a.balance<0){text.push('展期由持有最多正余额的债权方审议，须有真实出口库存、未交战且失信低于40。一轮债务只能申请一次；获准保留本金，审议份额收10%账额费用，期限延长600秒。当前期限余'+Math.max(0,this.deadline(d.foreign,actor)-s.civilization.elapsed)+'秒。');action('workout','申请出口信用展期','workout',{actor});}
      for(const other of Object.keys(d.foreign.actors))if(other!==actor)go(other,'与'+CivilForeign.name(other)+'议约','leaguePair_'+CivilForeign.pair(actor,other));
      for(const e of d.foreign.events.filter(e=>['workout','breach','alliance'].includes(e.kind)&&e.text.includes(CivilForeign.name(actor))).slice(-3))text.push(e.text);
    }else{
      const key=id.startsWith('leagueRoute_')?id.slice(12):id.slice(11);if(!l||!d.foreign.pairs[key])return null;const p=this.active(d,key);text.push(CivilForeign.label(key));
      if(id.startsWith('leagueRoute_')){
        text.push('自主直达：粮8/零件1、300秒；若出发时遇第三方战争则自动绕行。护航：粮12/零件3/工具2、600秒。绕行：粮20/零件2、900秒。费用由实际买方承担，通商盟约减2粮。双方相互禁运时不开新单。','出发后直达线路遭遇战争会滞留，持续600秒则原货退回、账额反向冲销；旅费不退。护航或绕行履行原货物，不因此解除新贸易禁运。每方只有一份公共运力。改线不改已发货物。');
        for(const[mode,cfg]of Object.entries(CivilLeagueContent.routes))action(mode,cfg.name,'route',{pair:key,mode});
        for(const o of d.foreign.shipments.filter(o=>CivilForeign.pair(o.from,o.to)===key).slice(-4))text.push('第'+o.id+'批 '+CivilHistory.costText(o.cargo)+' · '+(o.route?CivilLeagueContent.routes[o.route].name:'旧直达约定')+' · '+(o.returned?'已退运':o.arrivedAt!==null?'已交付':o.heldAt!==undefined?'冲突滞留':'在途')+' · 账额'+o.value);
      }else{
        if(!p){for(const[type,cfg]of Object.entries(CivilLeagueContent.pacts)){text.push(cfg.name+'每方每300秒维护：'+CivilHistory.costText(cfg.upkeep)+'；当前判断'+this.acceptance(d,key,type)+'/50。');action(type,'提议'+cfg.name,'offer',{pair:key,type});}text.push('通商盟约降低旅费、增加40授信；互助防卫在第三方战争时须实际派粮24/药4/工具4，另付护航费，最多600秒响应。两类均减缓压力；不能无限签约。');}
        else{ text.push(CivilLeagueContent.pacts[p.type].name+'已付'+p.paidCycles+'轮；每方每300秒维护'+CivilHistory.costText(CivilLeagueContent.pacts[p.type].upkeep)+'。连续两轮缺款或拒绝战时援助算背约。');for(const actor of CivilForeign.ids(key)){action('notice_'+actor,CivilForeign.name(actor)+'通知退出','notice',{pair:key,actor});action('break_'+actor,CivilForeign.name(actor)+'立即毁约','breach',{pair:key,actor});}text.push('正常退出600秒内仍履约；立即毁约失信+20、第三方关系下降6、原双边关系下降25。信用额度随之减少，旧债不免除。');}
        if(p){if(p.notice)text.push('退出通知期尚余'+Math.max(0,p.notice.dueAt-s.civilization.elapsed)+'秒，届满后在联席轮次结算。');for(const[actor,missed]of Object.entries(p.missed))if(missed)text.push(CivilForeign.name(actor)+'连续欠维护'+missed+'轮。');for(const call of p.calls.slice(-2))text.push(CivilForeign.name(call.target)+'的战时求援：'+({pending:'等待盟友发运',sent:'已发护航援助',refused:'未履约',cancelled:'交火结束或盟约退出，求援取消'}[call.status])+'。');}
        else{const ended=l.pacts.findLast(p=>p.pair===key);if(ended)text.push('上一份盟约：'+(ended.status==='ended'?'正常解约':ended.cause)+'；责任与欠款保留。');}
        const last=l.offers.filter(o=>o.pair===key).at(-1);if(last)text.push('最近议约：'+(last.resolvedAt===null?'正在审议':last.accepted?'已接受':'已拒绝'));go('route','查看贸易线路','leagueRoute_'+key);
      }
    }
    buttons.close={text:'合上联盟记录',nextScene:'end',onChoose:done('联盟、通路和清算继续按实际义务运行。')};return {title:'联盟与贸易线路',text,buttons};
  }
};
