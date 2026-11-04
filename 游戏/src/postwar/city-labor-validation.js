/* MPL-2.0 — Reconcile public stocks, reserved people, wage escrow and households. */
CivilCityLabor.receipt=function(s,e){
  const d=this.data(s);if(!d)return null;
  if(e.kind==='laborBuild'){const o=d.offices[e.city];return o&&o.at===e.at&&e.ref===e.city?this.cost:null;}
  if(e.kind==='laborPolicy'){const o=d.offices[e.city];return o&&o.changes.includes(e.id)&&e.ref===e.city?{knowledge:2}:null;}
  if(e.kind==='laborRecognition'){const o=d.contracts[e.ref-1];return o?.version===2&&o.to===e.city&&o.at===e.at?this.recognitionCost:null;}
  if(e.kind==='laborLodging'){const o=d.contracts[e.ref-1];return o&&o.to===e.city&&o.at===e.at&&o.from!==o.to?this.lodgingCost(o.count):null;}
  if(e.kind==='laborLodgingService'){const [id,at]=String(e.ref).split(':').map(Number),o=d.contracts[id-1];return o&&o.to===e.city&&e.at===at&&o.services.some(r=>r.at===at&&r.paid)?this.lodgingFee(o.count):null;}
  const [id,index]=String(e.ref).split(':').map(Number),p=d.shifts[id-1];if(!p)return null;
  if(['laborTravel','laborPack','laborEscrow'].includes(e.kind)){
    if(e.at!==p.at||index!==undefined||e.city!==(e.kind==='laborEscrow'?p.to:p.from)||e.kind!=='laborEscrow'&&p.from===p.to)return null;
    return e.kind==='laborTravel'?p.fee:e.kind==='laborPack'?p.pack:{food:p.escrow};
  }
  const r=p.rounds[index-1];if(!r||e.at!==r.at||e.city!==p.to)return null;
  return e.kind==='laborInput'?r.paid:e.kind==='laborMeals'&&r.meal?{food:r.meal}:null;
};
CivilCityLabor.validate=function(s){
  const d=this.data(s);if(!d)return;const a=this.c(),now=s.civilization.elapsed;
  const fail=x=>{throw Error('城市劳务账不符：'+x);},int=x=>Number.isSafeInteger(x)&&x>=0,num=x=>Number.isFinite(x)&&x>=0,time=x=>int(x)&&x<=now;
  const near=(x,y)=>num(x)&&num(y)&&Math.abs(x-y)<1e-5,same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),keys=CivilCityContent.resources;
  const goods=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.entries(x).every(([k,v])=>keys.includes(k)&&num(v));
  const subset=(groups,pool)=>{const merged=this.x().merge(pool);return this.x().merge(groups).every(c=>c.count<=(merged.find(x=>this.x().key(x)===this.x().key(c))?.count||0));};
  const equal=(x,y)=>goods(x)&&goods(y)&&keys.every(k=>near(x[k]||0,y[k]||0));
  const groups=x=>Array.isArray(x)&&x.length>0&&x.length<=160&&x.every(c=>int(c.age)&&c.age>=18&&c.age<=50&&int(c.count)&&c.count>0&&['human','mutant'].includes(c.identity))&&new Set(x.map(c=>this.x().key(c))).size===x.length;
  const receipts=a.data(s).receipts,lookup=(kind,city,ref)=>receipts.filter(r=>r.kind===kind&&r.city===city&&r.ref===ref);
  const paid=(kind,city,ref,at,cost)=>{const rows=lookup(kind,city,ref);if(rows.length!==1||rows[0].at!==at||!equal(rows[0].paid,cost))fail('缺失或重复实付 '+kind);};
  if(d.schema!==1||!this.available(s)||!time(d.at)||d.at<this.x().local(s,'home').completedAt||!d.offices||!Object.keys(d.offices).length||!Array.isArray(d.contracts)||!Array.isArray(d.shifts)||!d.households)fail('登记');
  const enabledAt=(id,at,order=Infinity)=>{const o=d.offices[id];let enabled=true;for(const key of o.changes){const r=receipts[key-1];if(r.at<=at&&r.id<order)enabled=r.value;}return enabled&&o.completedAt!==null&&o.completedAt<=at;};
  for(const [id,o]of Object.entries(d.offices)){
    if(!this.trades[id]||!a.membersAt(s,o.at).includes(id)||!time(o.at)||o.at<d.at||!equal(o.paid,this.cost)||!int(o.worked)||o.worked>120||o.worked>now-o.at||o.remaining!==120-o.worked||o.completedAt===null&&o.remaining===0||o.completedAt!==null&&(!time(o.completedAt)||o.completedAt<o.at+120||o.worked!==120)||typeof o.enabled!=='boolean'||!Array.isArray(o.changes))fail('有限工位');
    paid('laborBuild',id,id,o.at,this.cost);let enabled=true,at=o.completedAt??now;
    for(const key of o.changes){const r=receipts[key-1];if(!r||r.kind!=='laborPolicy'||r.city!==id||r.at<at||typeof r.value!=='boolean'||r.value===enabled)fail('委托变更');enabled=r.value;at=r.at;}
    if(enabled!==o.enabled||new Set(o.changes).size!==o.changes.length)fail('当前委托');
  }
  const ended={},latest={};let prior=d.at;
  for(const [i,o]of d.contracts.entries()){
    if(o.id!==i+1||!time(o.at)||o.at<prior||!d.offices[o.to]||d.offices[o.to].completedAt===null||d.offices[o.to].completedAt>o.at||!a.membersAt(s,o.at).includes(o.from)||![24,60,120].includes(o.count)||o.at<(ended[o.to]||0)||o.endedAt!==null&&(!time(o.endedAt)||o.endedAt<o.at))fail('委托顺序');
    if(!equal(o.paid,o.from===o.to?{}:this.lodgingCost(o.count))||!Array.isArray(o.services))fail('临住登记');
    if(o.version===2){
      if(!Object.hasOwn(this.skilledTrades,o.task)||!equal(o.recognition,this.recognitionCost)||!this.x().local(s,o.from)||this.x().local(s,o.from).completedAt===null||this.x().local(s,o.from).completedAt>o.at)fail('技能互认');
      paid('laborRecognition',o.to,o.id,o.at,this.recognitionCost);
    }else if(o.version!==undefined||o.task!==undefined||o.recognition!==undefined)fail('未知岗位版本');
    let lodging=o.from===o.to?null:o.at,serviceAt=o.at-1;if(o.from!==o.to)paid('laborLodging',o.to,o.id,o.at,o.paid);
    for(const r of o.services){if(o.from===o.to||!time(r.at)||r.at%60||r.at<=serviceAt||r.at<o.at||o.endedAt!==null&&r.at>o.endedAt&&!d.shifts.some(p=>p.order===o.id&&p.at<=r.at&&(p.leftAt===null||p.leftAt>=r.at))||typeof r.paid!=='boolean')fail('临住维护');if(r.paid){paid('laborLodgingService',o.to,o.id+':'+r.at,r.at,this.lodgingFee(o.count));lodging=r.at;}serviceAt=r.at;}
    if(o.lastLodgingAt!==lodging)fail('临住续办');
    ended[o.to]=o.endedAt??Infinity;latest[o.id]=null;prior=o.at;
  }
  const income={},inputs={},outputs={},lastByCity={};prior=d.at;
  for(const [i,p]of d.shifts.entries()){
    const o=d.contracts[p.order-1],distance=p.path?.distance||0;
    if(!o||p.id!==i+1||!time(p.at)||p.at<prior||p.at<o.at||o.endedAt!==null&&p.at>o.endedAt||p.from!==o.from||p.to!==o.to||p.count!==o.count||!groups(p.cohorts)||this.count(p.cohorts)!==p.count||p.at<(lastByCity[p.to]||0)||latest[o.id]!==null&&p.at-latest[o.id]<600||!enabledAt(p.to,p.at,lookup('laborEscrow',p.to,p.id)[0]?.id)||!a.officeAt(s,p.from,p.at,lookup('laborEscrow',p.to,p.id)[0]?.id)||!a.officeAt(s,p.to,p.at,lookup('laborEscrow',p.to,p.id)[0]?.id))fail('实际班次');
    if(p.from===p.to?p.path!==null:!same(p.path,a.path(s,p.from,p.to,p.at))||distance>720)fail('历史通路');
    const pack=p.from===p.to?0:Math.ceil((p.count+4)*.012*(2*distance+this.duration));
    if(!equal(p.pack,{food:pack})||!equal(p.fee,distance?this.fee:{})||!near(p.escrow,p.count*this.wage*30)||!Array.isArray(p.rounds)||p.rounds.length>30)fail('封存数量');
    paid('laborEscrow',p.to,p.id,p.at,{food:p.escrow});if(distance){paid('laborTravel',p.from,p.id,p.at,p.fee);paid('laborPack',p.from,p.id,p.at,p.pack);}
    let earned=0,meal=0,roundAt=p.at;
    if(o.version===2){
      const qualified=this.qualifiedAt(s,p.from,p.at),concurrent=this.skilledGroups(s,p.from,p.at);
      if(!subset(p.cohorts,qualified)||!subset(concurrent,qualified)||this.count(concurrent)>Math.min(Math.floor(Math.min(this.x().capacity(s,p.from),this.count(qualified))/2),this.count(qualified)-2))fail('资格来源与留岗');
    }
    const trade=this.trade(s,p.to,o);inputs[p.to]||={};outputs[p.to]||={};
    for(const [j,r]of p.rounds.entries()){
      const expected=Object.fromEntries(Object.entries(trade.input).map(([k,v])=>[k,v*r.workers]));
      if(!int(r.workers)||!r.workers||r.workers>p.count||!time(r.at)||r.at%10||r.at<=roundAt||p.arrivedAt===null||r.at<p.arrivedAt||p.leftAt!==null&&r.at>p.leftAt||r.at-p.arrivedAt>300||!enabledAt(p.to,r.at,lookup('laborInput',p.to,p.id+':'+(j+1))[0]?.id)||!a.officeAt(s,p.to,r.at,lookup('laborInput',p.to,p.id+':'+(j+1))[0]?.id)||!equal(r.paid,expected)||!near(r.wage,r.workers*this.wage)||!near(r.meal,distance?p.count*.12:0)||!goods(r.output)||keys.some(k=>(r.output[k]||0)>(trade.output[k]||0)*r.workers+1e-7))fail('产出与工资');
      paid('laborInput',p.to,p.id+':'+(j+1),r.at,r.paid);if(r.meal)paid('laborMeals',p.to,p.id+':'+(j+1),r.at,{food:r.meal});
      a.sum(inputs[p.to],r.paid);a.sum(outputs[p.to],r.output);earned+=r.wage;meal+=r.meal;roundAt=r.at;
    }
    if(!near(p.earned,earned)||!near(p.hospitality,meal)||!num(p.food)||!num(p.consumed)||!num(p.received)||!num(p.refunded))fail('班次结算');
    if(p.arrivedAt!==null&&(p.arrivedAt!==p.at+distance||!time(p.arrivedAt)))fail('到岗时点');
    if(p.leftAt!==null&&(!time(p.leftAt)||p.arrivedAt===null||p.leftAt<p.arrivedAt||p.leftAt-p.arrivedAt>300||!near(p.refunded,p.escrow-p.earned)||typeof p.reason!=='string'))fail('返程结算');
    if(p.leftAt===null&&(p.refunded!==0||p.received!==0||p.finishedAt!==null))fail('提前结算');
    if(p.finishedAt!==null&&(p.leftAt===null||p.finishedAt!==p.leftAt+distance||!time(p.finishedAt)||p.food!==0||p.phase!=='complete'||p.remaining!==0))fail('返乡时间');
    if(p.finishedAt===null){
      if(p.leftAt!==null){if(p.phase!=='returning'||p.remaining!==p.leftAt+distance-now||p.remaining<1)fail('返乡在途');}
      else if(p.arrivedAt!==null){if(p.phase!=='working'||p.remaining!==300||now-p.arrivedAt>=300)fail('驻班');}
      else if(p.phase!=='outbound'||p.remaining!==p.at+distance-now||p.remaining<1)fail('出发在途');
    }
    const end=p.finishedAt??now,consumed=distance?(end-p.at)*(p.count+4)*.012:0;
    if(!near(p.consumed,consumed)||!near(pack,p.consumed+(p.finishedAt===null?p.food:p.received-p.hospitality)))fail('旅粮守恒');
    if(p.finishedAt!==null){income[p.from]=(income[p.from]||0)+p.earned;}else if(p.received!==0)fail('提前收货');
    lastByCity[p.to]=p.finishedAt??Infinity;latest[o.id]=p.at;prior=p.at;
  }
  for(const o of d.contracts)if(o.lastAt!==latest[o.id])fail('续班间隔');
  for(const id of a.ids(s)){
    const n=a.local(s,id),physical=a.physical(s,id),inst=CivilCityInstitutions.local(s,physical),reserved=this.protected(s,id);
    const used=this.x().merge([...this.unqualifiedProtected(s,id),...this.h().settled(s,id),...this.x().extraProtected(s,id),...CivilCityInstitutions.qualified(s,physical,'craft'),...CivilCityInstitutions.qualified(s,physical,'care'),...(inst?.training?CivilCityInstitutions.aged(inst.training.cohorts,inst.training.startedAt,now):[])]);
    if(used.some(c=>c.count>(n.cohorts.find(x=>this.x().key(x)===this.x().key(c))?.count||0))||(n.workers.wageworker||0)!==this.count(reserved))fail('同一居民重复就业');
    const skilled=this.skilledGroups(s,id);if(!subset(skilled,this.qualifiedAt(s,id,now)))fail('在班资格');
    if(this.count(skilled)&&this.h().active(s,id)&&(n.workers.settler||0)!==this.x().workers(s,id))fail('合格岗位重复安排');
    if(this.beds(s,id)>Math.max(0,CivilCity.housing(s,physical)-CivilCity.count(n)-this.h().reserved(s,id)))fail('临住挤占家庭住房');
    for(const k of keys)if((n.budget.consumed[k]||0)+1e-5<(inputs[id]?.[k]||0)||(n.budget.produced[k]||0)+1e-5<(outputs[id]?.[k]||0))fail('真实投入产出');
    const h=d.households[id];if(income[id]&&!h)fail('收入去向');if(h&&(!num(h.food)||!num(h.received)||!num(h.consumed)||!near(h.received,income[id]||0)||!near(h.food+h.consumed,h.received)||!int(h.rounds)||h.lastAt!==null&&(!time(h.lastAt)||h.lastAt<d.at)||h.rounds===0&&(h.consumed!==0||h.lastAt!==null)))fail('家庭食物守恒');
  }
  if(Object.keys(d.households).some(id=>!a.ids(s).includes(id)))fail('家庭所在城市');
};
