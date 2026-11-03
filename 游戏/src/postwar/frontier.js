/* MPL-2.0 — Conserved expedition supplies, existing cohorts, and local postwar government. */
var CivilFrontier={
  pendingIds:['fordCouncil','regionFord'],
  data(s){return s.civilization.frontier;},
  node(s){return s.civilization.regions?.nodes.ford;},
  available(s){return !!s.civilization.accession?.joinedAt&&(s.civilization.commerce?.orders.filter(o=>o.publicDuties&&o.returnedAt!==null).length||0)>=2;},
  active(s){const m=this.data(s)?.missions.at(-1);return m&&m.returnedAt===null?m:null;},
  occupation(s){const o=this.data(s)?.occupation;return o&&o.endedAt===null?o:null;},
  relation(s){const d=this.data(s);return d?.occupation&&!d.peace?(this.occupation(s)?.retreatAt===null?'驻防待自治':'停火待议和'):null;},
  reservedTransport(s){return this.active(s)?2:0;},
  guardFloor(s){const m=this.active(s);return Math.max(m?m.guards-(m.battle?.dead.length||0)-(m.battle?.wounded.length||0):0,this.occupation(s)?2:0);},
  awayAt(s,at){const d=this.data(s);return !!d&&(d.missions.some(m=>m.departedAt<at&&(m.returnedAt===null||m.returnedAt>=at))||!!d.occupation&&d.occupation.startedAt<at&&(d.occupation.endedAt===null||d.occupation.endedAt>=at));},
  wounded(s){return (this.data(s)?.patients||[]).filter(p=>p.recoveredAt===null&&p.diedAt===null).length;},
  population(s){return this.wounded(s)+(this.node(s)?.relation==='integrated'?this.node(s).population:0);},
  defenders(s){const n=this.node(s);return n&&!this.data(s)?.peace&&!this.data(s)?.occupation?Math.min(3,CivilPopulation.workforce(n.cohorts)):0;},
  trainingSeconds(s,count){
    const rows=s.civilization.security?.records||[];if(!rows.length||s.civilization.elapsed-rows.at(-1).at>10)return 0;
    let last=null,first=null;for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(!r.paid||r.staff<count||r.away||last&&last.at-r.at!==10)break;first=r;last=r;if(rows.at(-1).at-first.at>=300)break;}
    return first?Math.min(300,rows.at(-1).at-first.at):0;
  },
  trained(s,count){return this.trainingSeconds(s,count)>=300;},
  roster(s,count){const result=[];for(const c of s.civilization.society.cohorts){if(c.age<18||c.age>40)continue;for(let i=0;i<c.count&&result.length<count;i++)result.push({...c,count:1});if(result.length===count)break;}return result;},
  sameCohort(c,p,age){return c.age===age&&(c.identity||'human')===(p.identity||'human')&&c.cohortId===p.cohortId&&c.originId===p.originId;},
  rosterReady(s,m){return m.roster.every((p,i)=>{const age=p.age+s.civilization.society.year-m.year,needed=m.roster.slice(0,i+1).filter(r=>this.sameCohort(r,p,p.age)).length;return age<65&&s.civilization.society.cohorts.filter(c=>this.sameCohort(c,p,age)).reduce((n,c)=>n+c.count,0)>=needed;});},
  reason(s,kind){
    if(typeof CivilPartnership!=='undefined'&&CivilPartnership.active(s))return '原商车正在地区商约途中，等待返城';
    if(!this.available(s)||!CivilNation.operational(s)||!CivilFinance.political(s))return '等待共同法与现任行政正常运作';
    if(this.active(s)||CivilCommerce.active(s)||CivilCommerce.plan(s)||typeof CivilIntercity!=='undefined'&&CivilIntercity.active(s))return '先完成原车往返并撤销剩余商队委托';
    if(kind==='scout'?!!this.node(s):!this.node(s)||this.data(s).peace||this.data(s).occupation)return '当前渡口关系不需要这次行动';
    const cfg=CivilFrontierContent[kind];if(!cfg||!CivilCommerce.asset(s)||!CivilSecurity.asset(s))return '先备好实际车辆与守备训练场';
    if(CivilSecurity.guards(s)<cfg.guards||!this.trained(s,cfg.guards)||this.roster(s,cfg.guards).length<cfg.guards)return '先安排足额守备，连续实付训练300秒；出征者须为18—40岁现有成年人';
    if(CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)<2)return '等待两名空闲运输工';
    if(!CivilFinance.reserveCheck(s,'home',cfg.cost))return '先备足行囊并保留本城供养';
    return null;
  },
  dispatch(s,kind){
    if(this.reason(s,kind))return false;const c=s.civilization,cfg=CivilFrontierContent[kind];
    if(!this.data(s))c.frontier={schema:1,startedAt:c.elapsed,discoveredAt:null,missions:[],peace:null,occupation:null,patients:[],defense:[],lastSettledAt:null};
    const d=this.data(s);CivilServices.pay(s.stores,cfg.cost);
    d.missions.push({id:d.missions.length+1,kind,guards:cfg.guards,roster:this.roster(s,cfg.guards),year:c.society.year,assetId:CivilCommerce.asset(s).id,departedAt:c.elapsed,arrivedAt:null,returnedAt:null,phase:'outbound',outboundSeconds:0,waitingSeconds:0,battleSeconds:0,inboundSeconds:0,choice:null,choiceAt:null,battle:null,paid:{...cfg.cost},buffer:{...cfg.cost},uses:[],refunded:null,lastTickAt:c.elapsed});return true;
  },
  use(m,at,cost,kind){if(!CivilRegions.canPay(m.buffer,cost))return false;CivilRegions.debit(m.buffer,cost);m.uses.push({at,kind,cost:{...cost}});return true;},
  choose(s,choice){
    const m=this.active(s);if(!m||m.kind!=='expedition'||!['outbound','waiting'].includes(m.phase)||!['attack','withdraw'].includes(choice))return false;
    if(choice==='withdraw'&&!m.outboundSeconds)return false;
    if(choice==='attack'&&(m.phase!=='waiting'||CivilSecurity.guards(s)<4||!this.rosterReady(s,m)||!CivilRegions.canPay(m.buffer,{medicine:2,tools:1})))return false;
    m.choice=choice;m.choiceAt=s.civilization.elapsed;m.phase=choice==='attack'?'battle':'inbound';return true;
  },
  remove(cohorts,person,age){const c=cohorts.find(c=>this.sameCohort(c,person,age)&&c.count>0);if(!c)return null;c.count--;return {...c,count:1};},
  fight(s,m){
    const d=this.data(s),n=this.node(s),at=s.civilization.elapsed,defense=d.defense.at(-1),enemy=defense?.paid&&at-defense.at<=10?defense.staff:0;
    const dead=[],wounded=[],localDead=[];
    // Both casualties are removed from the exact age/identity groups selected at departure.
    if(enemy){
      for(let i=0;i<2;i++){const p=m.roster[i],person=this.remove(s.civilization.society.cohorts,p,p.age+s.civilization.society.year-m.year);if(!person)throw Error('出征名册已失配');(i? wounded:dead).push(person);}
      if(typeof CivilCensus!=='undefined'){CivilCensus.death(s,'home',1,'战斗死亡');CivilCensus.move(s,'home','patients',1,'战斗受伤');CivilCensus.death(s,'local_ford',1,'战斗死亡');}
      s.civilization.society.cohorts=s.civilization.society.cohorts.filter(c=>c.count);s.game.population-=2;s.game.workers.guard=Math.max(0,s.game.workers.guard-2);
      const adult=n.cohorts.find(c=>c.age>=18&&c.age<65&&c.count);localDead.push(this.remove(n.cohorts,adult,adult.age));n.cohorts=n.cohorts.filter(c=>c.count);n.population--;
      this.use(m,at,{medicine:2,tools:1},'battle');
      d.patients.push({missionId:m.id,person:{...wounded[0]},year:s.civilization.society.year,injuredAt:at,arrivedAt:null,records:[],recovery:0,recoveredAt:null,diedAt:null});
    }
    m.battle={at,defenders:enemy,dead,wounded,localDead};m.phase='inbound';
    d.occupation={startedAt:at,retreatAt:null,retreatCost:null,endedAt:null,reason:null,missed:0,records:[]};n.relation='trade';n.trust=Math.max(0,n.trust-20);n.unrest=Math.min(100,n.unrest+30);
    CivilRegions.planWorkers(s,'ford',n);Civilization.notify('旧渡口停止抵抗。'+(enemy?'双方名册各有一人死亡，一名伤员随原车返城。':'对方已无足额供给，守备放下器械。')+'两名守备驻防；地方仓库和公民资格仍独立，须修复并恢复自治。');
  },
  endOccupation(s,reason='withdraw'){
    const o=this.occupation(s);if(!o||o.retreatAt!==null)return false;const cost={food:4,tools:.2},paid=CivilFinance.reserveCheck(s,'home',cost);if(!paid&&reason!=='supply')return false;if(paid)CivilServices.pay(s.stores,cost);o.retreatAt=s.civilization.elapsed;o.retreatCost=paid?cost:{};o.reason=reason;o.missed=0;if(s===State)Civilization.notify('两名驻防守备开始徒步返城，180秒后释放岗位。'+(reason==='autonomy'?'地方自治议约已生效；共同治理仍需公民资格与持续履约。':'已交付物资保留，修复与自治议约仍需完成。'));return true;
  },
  agreement(s){
    const d=this.data(s),n=this.node(s);if(!d||!n||d.peace||this.active(s)||!CivilNation.operational(s)||!CivilFinance.political(s))return false;
    const war=!!d.occupation,cost=war?CivilFrontierContent.reconciliation:CivilFrontierContent.peace;
    if(war&&(!n.completedProjects.publicWorks||s.civilization.regions.routes.ford.completedTrips<3))return false;
    const homeCost={...cost.home,...(this.occupation(s)?.retreatAt===null?{food:4,tools:.2}:{})};
    if(!CivilFinance.reserveCheck(s,'home',homeCost)||!CivilRegions.canPay(n.stores,cost.local,CivilRegions.foodPopulation(n)*.12*12))return false;
    CivilServices.pay(s.stores,cost.home);CivilServices.pay(n.stores,cost.local);d.peace={at:s.civilization.elapsed,kind:war?'reconciliation':'peace',costs:JSON.parse(JSON.stringify(cost))};
    this.endOccupation(s,'autonomy');n.relation='trade';n.autonomy='local';CivilRegions.planWorkers(s,'ford',n);return true;
  },
  settle(s){
    const d=this.data(s),n=this.node(s),at=s.civilization.elapsed,flow={};if(!d||d.lastSettledAt!==null&&at-d.lastSettledAt<10)return flow;d.lastSettledAt=at;
    if(n&&!d.peace&&!d.occupation){const staff=this.defenders(s),cost={food:staff*.5,medicine:staff*.01},paid=staff>0&&CivilRegions.canPay(n.stores,cost,CivilRegions.foodPopulation(n)*.12*12);if(paid)CivilServices.pay(n.stores,cost);d.defense.push({at,staff,paid,costs:paid?cost:{}});}
    const o=this.occupation(s);if(o&&o.retreatAt===null){const cost=CivilFrontierContent.occupation,paid=CivilSecurity.guards(s)>=2&&CivilFinance.reserveCheck(s,'home',cost);if(paid){CivilServices.pay(s.stores,cost);for(const [k,v]of Object.entries(cost))flow[k]=(flow[k]||0)-v;}o.records.push({at,paid,costs:paid?{...cost}:{}});o.missed=paid?0:o.missed+10;if(o.missed>=60)this.endOccupation(s,'supply');}
    for(const p of d.patients){
      if(p.recoveredAt!==null||p.diedAt!==null)continue;
      const age=p.person.age+s.civilization.society.year-p.year;if(age>=80){p.diedAt=at;if(typeof CivilCensus!=='undefined')CivilCensus.death(s,'patients',1);continue;}
      if(p.arrivedAt===null||at-p.arrivedAt<10)continue;
      const cost={food:.5,medicine:.2},paid=(s.game.workers.medic||0)>0&&CivilFinance.reserveCheck(s,'home',cost);
      if(paid){CivilServices.pay(s.stores,cost);for(const [k,v]of Object.entries(cost))flow[k]=(flow[k]||0)-v;p.recovery+=10;}
      p.records.push({at,paid,costs:paid?cost:{}});
      if(p.recovery>=120){if(typeof CivilCensus!=='undefined')CivilCensus.move(s,'patients','home',1,'伤员康复');p.recoveredAt=at;s.civilization.society.cohorts.push({...p.person,age});s.game.population++;if(s===State)Civilization.notify('返城伤员完成120秒实付治疗，回到原居民名册；岗位须重新安排。');}
    }
    return flow;
  },
  returnMission(s,m){
    m.returnedAt=s.civilization.elapsed;m.phase='returned';m.refunded={...m.buffer};CivilRegions.credit(s.stores,m.buffer);m.buffer={};
    for(const p of this.data(s).patients)if(p.missionId===m.id)p.arrivedAt=m.returnedAt;
    Civilization.notify('原车实际返城，行囊余量已退回原仓，已消耗的军需不退。');
  },
  tick(s){
    const at=s.civilization.elapsed,o=this.occupation(s);if(o?.retreatAt!==null&&o?.retreatAt!==undefined&&at-o.retreatAt>=180){o.endedAt=at;Civilization.notify('两名撤防守备走完180秒返程，已经回到本城，岗位可以重新安排。');}
    const m=this.active(s);if(!m||m.lastTickAt>=at)return;m.lastTickAt=at;
    if(m.phase!=='inbound'&&(CivilSecurity.guards(s)<this.guardFloor(s)||!this.rosterReady(s,m))){
      if(m.kind==='expedition'){m.choice='withdraw';m.choiceAt=at;}m.phase='inbound';
      Civilization.notify('出征人员已经不足或退休，队伍开始按原路返城。已消耗的军需不会退回。');
    }
    if(m.phase==='inbound'&&m.inboundSeconds===(m.arrivedAt===null?m.outboundSeconds:180)){this.returnMission(s,m);return;}
    if(CivilPassenger.actualWorkers(s)-CivilUrban.reservedTransport(s)-CivilRegions.reservedTransport(s)<2)return;
    const total=m.outboundSeconds+m.waitingSeconds+m.battleSeconds+m.inboundSeconds;
    if((total+1)%10===0){const staff=m.guards-(m.battle?.dead.length||0);if(!this.use(m,at,{food:staff*.5,tools:staff*.01},'march'))return;}
    if(m.phase==='outbound'){
      m.outboundSeconds++;
      if(m.outboundSeconds===180){m.arrivedAt=at;if(m.kind==='scout'){if(!this.node(s)){this.data(s).discoveredAt=at;CivilRegions.createNode(s,'ford');Civilization.notify('勘察队登记旧渡口原有60位居民。当地保有仓库与守备，未加入共同法。');}m.phase='inbound';}else m.phase='waiting';}
    }else if(m.phase==='waiting'){m.waitingSeconds++;if(m.waitingSeconds>=60)this.choose(s,'withdraw');}
    else if(m.phase==='battle'){m.battleSeconds++;if(m.battleSeconds===180)this.fight(s,m);}
    else if(m.phase==='inbound'){
      m.inboundSeconds++;if(m.inboundSeconds===(m.arrivedAt===null?m.outboundSeconds:180)){
        this.returnMission(s,m);
      }
    }
  },
  status(s){
    const d=this.data(s),m=this.active(s);if(m)return (m.kind==='scout'?'勘察队':'渡口分队')+'：'+({outbound:'去程 '+m.outboundSeconds+'/180秒',waiting:'抵达待议 '+m.waitingSeconds+'/60秒',battle:'行动 '+m.battleSeconds+'/180秒',inbound:'返程 '+m.inboundSeconds+'/'+(m.arrivedAt===null?m.outboundSeconds:180)+'秒'}[m.phase])+'；行囊 '+CivilHistory.costText(m.buffer);
    if(!this.node(s))return '加盟公共货车已带回渡口线索。两名现有守备与两名司机可用原车勘察';
    return '旧渡口 '+this.node(s).population+'人；'+(d.peace?'已恢复地方议约，修复与持续履约仍按地区账册执行'+(this.occupation(s)?'；撤防守备返城还需'+Math.max(0,180-(s.civilization.elapsed-this.occupation(s).retreatAt))+'秒':''):this.occupation(s)?(this.occupation(s).retreatAt===null?'两名守备驻防，地方产出八成；修复后才能议和自治':'驻防守备徒步返城，还需'+Math.max(0,180-(s.civilization.elapsed-this.occupation(s).retreatAt))+'秒'):d.occupation?'已经撤防，修复与议和自治尚待完成':'尚未议约：可和平交涉；四人足额训练'+this.trainingSeconds(s,4)+'/300秒，可实付派分队')+'；返城治疗 '+this.wounded(s)+'人';
  },
  event(id,done){
    if(id!=='fordCouncil'&&!(id==='regionFord'&&this.node(State)?.relation==='contacted'))return null;
    const s=State,d=this.data(s),m=this.active(s),buttons={},finish=(ok,text)=>done(ok?text:'人员、供给或政治条件尚未满足；未执行。')();
    if(!this.node(s)&&!m)buttons.scout={text:'实付派出勘察队',nextScene:'end',onChoose:()=>finish(this.dispatch(s,'scout'),'勘察队携原仓军需出发。')};
    if(this.node(s)&&!m&&!d.peace){buttons.peace={text:d.occupation?'修复后议和恢复自治':'双方实付和平议约',nextScene:'end',onChoose:()=>finish(this.agreement(s),'双方知识已支付；货车、公共项目和共同治理仍需实际完成。')};if(!d.occupation)buttons.expedition={text:'实付派四人分队',nextScene:'end',onChoose:()=>finish(this.dispatch(s,'expedition'),'四名守备与两名司机携实物军需出发，原商车暂不可贸易。')};}
    if(m?.kind==='expedition'&&['outbound','waiting'].includes(m.phase)){buttons.withdraw={text:'原路撤回分队',nextScene:'end',onChoose:()=>finish(this.choose(s,'withdraw'),'分队按实际已走路程返城；余粮到仓才退回。')};if(m.phase==='waiting')buttons.attack={text:'承担伤亡继续行动',nextScene:'end',onChoose:()=>finish(this.choose(s,'attack'),'行动开始，仍需180秒、真实人员与军需。')};}
    if(this.occupation(s)?.retreatAt===null)buttons.withdrawOccupation={text:'结束驻防',nextScene:'end',onChoose:()=>finish(this.endOccupation(s),'实付食物4、工具0.2，守备开始180秒徒步返程。')};
    buttons.close={text:'合上渡口记录',nextScene:'end',onChoose:done('旧渡口的居民、库存与已付成本按原账继续。')};
    const text=[this.status(s)];
    if(!this.node(s))text.push('勘察需守备2、司机2，足额训练300秒。携食物40、工具1、药1；单程180秒，消耗后余额随车返回。');
    else if(!d.peace&&!d.occupation)text.push('和平：本城知识80、当地20；之后实际贸易、修复与600秒履约。','分队：守备4、司机2，足额训练300秒；携食物120、工具4、药4。抵达后60秒决定，行动180秒。有防务时双方各死1人、我方另伤1人；胜利仅驻防。');
    else if(d.occupation&&!d.peace)text.push('驻防占2名守备，每10秒食物2、知识0.2、工具0.05、药0.1。主动撤防备粮4、工具0.2；断供60秒也会撤防。徒步返城180秒后释放岗位。','用地区原车交付、恢复地方信任并完成堤岸诊疗修复后，本城知识120、当地20议和。恢复自治后议加盟，满足公民资格并履约600秒才登记居民。');
    if(this.wounded(s))text.push('伤员原床预留，不参加生产。实际返城后，每10秒食物0.5、药0.2，累计120秒返回名册。');
    if(!m&&!d?.peace&&!d?.occupation){const why=this.reason(s,this.node(s)?'expedition':'scout');if(why)text.push((this.node(s)?'分队出发：':'勘察出发：')+why+'。');}
    return {title:'旧渡口的往来与冲突',text,buttons};
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#frontierButton,#frontierSummary').hide();return;}
    Civilization.button('frontierButton','旧渡口的往来','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='fordCouncil';Civilization.showPending();}).show();
    let line=$('#frontierSummary');if(!line.length)line=$('<div>').attr('id','frontierSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).appendTo('#councilPanel');line.show().text(this.status(State));
  }
};
CivilFrontier.validate=function(s){
  const c=s.civilization,d=this.data(s),n=this.node(s),fail=()=>{throw Error('旧渡口行动、名册或物资回执无效');};
  const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),int=(x,max=c.elapsed)=>Number.isSafeInteger(x)&&x>=0&&x<=max,time=x=>int(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const cargo=x=>obj(x)&&Object.entries(x).every(([k,v])=>CivilCatalog.resources.includes(k)&&Number.isFinite(v)&&v>=0);
  const person=x=>obj(x)&&int(x.age,79)&&x.age>=18&&x.count===1&&(x.identity===undefined||['human','mutant'].includes(x.identity));
  if(d===undefined){if(n||c.pending==='regionFord'||c.pending==='fordCouncil'&&!this.available(s))fail();return;}
  if(!obj(d)||d.schema!==1||!this.available(s)||!time(d.startedAt)||!Array.isArray(d.missions)||!d.missions.length||!Array.isArray(d.patients)||!Array.isArray(d.defense)||d.lastSettledAt!==null&&!time(d.lastSettledAt)||!same(!!n,d.discoveredAt!==null))fail();
  let previous=null;
  for(const m of d.missions){
    const cfg=CivilFrontierContent[m.kind];
    if(!obj(m)||!['scout','expedition'].includes(m.kind)||!cfg||m.id!==(previous?previous.id+1:1)||m.guards!==cfg.guards||!Array.isArray(m.roster)||m.roster.length!==m.guards||m.roster.some(p=>!person(p)||p.age>40)||!int(m.year)||m.year!==Math.floor(m.departedAt/600)||m.assetId!==CivilCommerce.asset(s)?.id||!time(m.departedAt)||m.departedAt<d.startedAt||previous&&(previous.returnedAt===null||m.departedAt<previous.returnedAt)||!previous&&(m.kind!=='scout'||m.departedAt!==d.startedAt)||m.kind==='scout'&&d.discoveredAt!==null&&m.departedAt>=d.discoveredAt||!same(m.paid,cfg.cost)||!cargo(m.buffer)||!Array.isArray(m.uses))fail();
    if(CivilCommerce.asset(s).completedAt>m.departedAt||c.commerce.orders.some(o=>o.departedAt<m.departedAt&&(o.returnedAt===null||o.returnedAt>m.departedAt)||o.departedAt>=m.departedAt&&(m.returnedAt===null||o.departedAt<m.returnedAt)))fail();
    const training=c.security.records.filter(r=>r.at<=m.departedAt).slice(-31);if(training.length!==31||training.some((r,i)=>!r.paid||r.away||r.staff<m.guards||i&&r.at-training[i-1].at!==10)||m.departedAt-training.at(-1).at>10)fail();
    if(!int(m.outboundSeconds,180)||!int(m.inboundSeconds,180)||!int(m.waitingSeconds,60)||!int(m.battleSeconds,180)||!['outbound','waiting','battle','inbound','returned'].includes(m.phase)||!time(m.lastTickAt)||m.lastTickAt<m.departedAt)fail();
    const total=m.outboundSeconds+m.waitingSeconds+m.battleSeconds+m.inboundSeconds,back=m.arrivedAt===null?m.outboundSeconds:180;
    if(m.lastTickAt-m.departedAt<total||m.returnedAt!==null&&(!time(m.returnedAt)||m.returnedAt<m.departedAt+total||m.phase!=='returned'||m.inboundSeconds!==back||!cargo(m.refunded)||Object.keys(m.buffer).length)||m.returnedAt===null&&(m.phase==='returned'||m.refunded!==null))fail();
    if(m.arrivedAt!==null&&(!time(m.arrivedAt)||m.arrivedAt<m.departedAt+180||m.outboundSeconds!==180)||m.outboundSeconds===180&&m.arrivedAt===null||m.phase==='outbound'&&(m.arrivedAt!==null||m.inboundSeconds||m.waitingSeconds||m.battleSeconds)||['waiting','battle'].includes(m.phase)&&(m.arrivedAt===null||m.inboundSeconds))fail();
    if(![null,'attack','withdraw'].includes(m.choice)||m.choice===null&&m.choiceAt!==null||m.choice!==null&&(!time(m.choiceAt)||m.choiceAt<m.departedAt)||m.kind==='scout'&&(m.choice!==null||m.battle!==null||m.waitingSeconds||m.battleSeconds)||m.choice==='attack'&&(m.arrivedAt===null||m.choiceAt<m.arrivedAt)||m.battleSeconds&&m.choice===null)fail();
    if(m.kind==='expedition'&&(d.discoveredAt===null||m.departedAt<d.discoveredAt||d.peace&&m.departedAt>=d.peace.at)||m.choice==='withdraw'&&m.phase!=='inbound'&&m.phase!=='returned')fail();
    const spent={};let last=0,marches=0,battles=0;
    for(const row of m.uses){
      if(!obj(row)||!time(row.at)||row.at<=m.departedAt||row.at<last||row.at>m.lastTickAt||!cargo(row.cost)||!['march','battle'].includes(row.kind))fail();last=row.at;
      if(row.kind==='march'){marches++;const staff=m.guards-(m.battle&&row.at>m.battle.at?m.battle.dead.length:0);if(!same(row.cost,{food:staff*.5,tools:staff*.01}))fail();}
      else {battles++;if(!m.battle||row.at!==m.battle.at||!same(row.cost,{medicine:2,tools:1}))fail();}
      CivilRegions.credit(spent,row.cost);
    }
    if(marches!==Math.floor(total/10)||battles!==(m.battle?.dead.length?1:0))fail();
    const remainder=m.refunded||m.buffer;if(Object.keys(remainder).some(k=>!Object.hasOwn(cfg.cost,k))||Object.entries(cfg.cost).some(([k,v])=>Math.abs(v-(spent[k]||0)-(remainder[k]||0))>1e-6))fail();
    if(m.battle!==null){
      const b=m.battle;if(!obj(b)||m.kind!=='expedition'||m.choice!=='attack'||m.battleSeconds!==180||!time(b.at)||b.at<m.choiceAt+180||!int(b.defenders,3)||!Array.isArray(b.dead)||!Array.isArray(b.wounded)||!Array.isArray(b.localDead)||[b.dead,b.wounded,b.localDead].some(a=>a.length!==(b.defenders?1:0)||a.some(p=>!person(p))))fail();
      const row=d.defense.filter(r=>r.at<=b.at).at(-1),expected=row?.paid&&b.at-row.at<=10?row.staff:0;if(b.defenders!==expected)fail();
      for(let i=0;i<b.dead.length+b.wounded.length;i++){const p=i?b.wounded[0]:b.dead[0];if(!same(p,{...m.roster[i],age:m.roster[i].age+Math.floor(b.at/600)-m.year}))fail();}
      if(!d.occupation||d.occupation.startedAt!==b.at)fail();
    }else if(m.battleSeconds===180)fail();
    previous=m;
  }
  const scout=d.missions.find(m=>m.kind==='scout'&&m.arrivedAt!==null);if(d.discoveredAt!==(scout?.arrivedAt??null)||d.discoveredAt!==null&&!time(d.discoveredAt))fail();
  if(this.active(s)&&CivilCommerce.active(s))fail();
  let last=null;
  for(const row of d.defense){if(!obj(row)||!n||!time(row.at)||row.at<d.discoveredAt||last&&row.at-last.at<10||!int(row.staff,3)||typeof row.paid!=='boolean'||row.paid&&!row.staff||!same(row.costs,row.paid?{food:row.staff*.5,medicine:row.staff*.01}:{})||d.peace&&row.at>d.peace.at||d.occupation&&row.at>d.occupation.startedAt)fail();last=row;}
  if(n&&Object.values(n.workers).reduce((a,b)=>a+b,0)+this.defenders(s)>CivilPopulation.workforce(n.cohorts))fail();
  if(d.peace!==null){const p=d.peace,cost=p.kind==='peace'?CivilFrontierContent.peace:p.kind==='reconciliation'?CivilFrontierContent.reconciliation:null;if(!obj(p)||!cost||!time(p.at)||p.at<d.discoveredAt||!same(p.costs,cost)||p.kind==='peace'&&d.occupation||p.kind==='reconciliation'&&(!d.occupation||!n.completedProjects.publicWorks||c.regions.routes.ford.completedTrips<3||d.occupation.retreatAt===null||d.occupation.retreatAt>p.at))fail();}
  if(n&&(['associated','integrated'].includes(n.relation)&&!d.peace||n.relation!=='contacted'&&!d.peace&&!d.occupation))fail();
  if(d.occupation!==null){
    const o=d.occupation;if(!obj(o)||!time(o.startedAt)||!d.missions.some(m=>m.battle?.at===o.startedAt)||!Array.isArray(o.records)||!int(o.missed,50)||o.endedAt!==null&&(!time(o.endedAt)||o.endedAt<o.startedAt||!['withdraw','autonomy','supply'].includes(o.reason))||o.retreatAt===null&&(o.reason!==null||o.retreatCost!==null)||o.retreatAt!==null&&(!time(o.retreatAt)||o.retreatAt<o.startedAt||!['withdraw','autonomy','supply'].includes(o.reason)||!same(o.retreatCost,{food:4,tools:.2})&&!(o.reason==='supply'&&same(o.retreatCost,{})))||o.endedAt!==null&&(o.retreatAt===null||o.endedAt!==o.retreatAt+180))fail();
    last=null;let missed=0;for(const row of o.records){if(!obj(row)||!time(row.at)||row.at<o.startedAt||o.retreatAt!==null&&row.at>o.retreatAt||last&&row.at-last.at<10||typeof row.paid!=='boolean'||!same(row.costs,row.paid?CivilFrontierContent.occupation:{}))fail();missed=row.paid?0:missed+10;last=row;}
    if(o.retreatAt===null&&o.missed!==missed||o.retreatAt!==null&&o.missed!==0||o.reason==='supply'&&missed<60)fail();
  }
  if(d.patients.length!==d.missions.reduce((sum,m)=>sum+(m.battle?.wounded.length||0),0))fail();
  const ids=new Set();for(const p of d.patients){
    const m=d.missions.find(m=>m.id===p.missionId);if(!obj(p)||!m?.battle||ids.has(p.missionId)||!same(p.person,m.battle.wounded[0])||p.injuredAt!==m.battle.at||p.year!==Math.floor(p.injuredAt/600)||p.arrivedAt!==m.returnedAt||!Array.isArray(p.records)||!int(p.recovery,120)||p.recoveredAt!==null&&(!time(p.recoveredAt)||p.diedAt!==null)||p.diedAt!==null&&(!time(p.diedAt)||p.person.age+Math.floor(p.diedAt/600)-p.year<80))fail();ids.add(p.missionId);
    last=null;let progress=0;for(const r of p.records){if(!obj(r)||p.arrivedAt===null||!time(r.at)||r.at<p.arrivedAt+10||last&&r.at-last.at<10||typeof r.paid!=='boolean'||!same(r.costs,r.paid?{food:.5,medicine:.2}:{})||progress>=120)fail();if(r.paid)progress+=10;last=r;}
    if(p.recovery!==progress||progress===120&&(p.recoveredAt!==last.at)||progress<120&&p.recoveredAt!==null)fail();
  }
};
