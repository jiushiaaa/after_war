/* MPL-2.0 — Qualifications remain subsets of residents; every lesson has a receipt. */
CivilCityContinuity.receipt=function(s,r){
  const d=this.data(s),o=d?.offices[r.city];if(!o)return null;
  if(r.kind==='continuityPolicy')return r.ref===r.city&&o.changes.includes(r.id)?{knowledge:2}:null;
  if(r.kind==='continuityService')return r.ref===r.city+':'+r.at&&o.services.includes(r.at)?this.officeFee(s,r.city):null;
  if(r.kind==='continuityInvite'){const i=d.invites[r.ref-1];return i&&i.at===r.at&&i.to===r.city?this.inviteCost:null;}
  const [id,index,round]=String(r.ref).split(':'),course=[...o.courses,...(o.training?[o.training]:[])].find(t=>t.id===Number(index));
  if(id!==r.city||!course)return null;
  if(r.kind==='continuityEnroll')return round===undefined&&r.at===course.at?this.enrollment:null;
  if(r.kind==='continuityLesson')return Number.isInteger(Number(round))&&Number(round)>=1&&Number(round)<=course.rounds&&r.at>=course.at&&r.at<=course.lastAt?this.lesson:null;
  return null;
};
CivilCityContinuity.validate=function(s){
  const d=this.data(s);if(d===undefined)return;const a=this.c(),now=s.civilization.elapsed;
  const fail=x=>{throw Error('职责接续账不符：'+x);},int=x=>Number.isSafeInteger(x)&&x>=0,time=x=>int(x)&&x<=now,num=x=>Number.isFinite(x)&&x>=0;
  const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),equal=(x,y)=>x&&y&&[...new Set([...Object.keys(x),...Object.keys(y)])].every(k=>num(x[k]||0)&&Math.abs((x[k]||0)-(y[k]||0))<1e-5);
  const groups=(x,max=64)=>Array.isArray(x)&&x.length<=160&&x.every(c=>int(c.age)&&c.age>=18&&c.age<=max&&int(c.count)&&c.count>0&&['human','mutant'].includes(c.identity))&&new Set(x.map(c=>this.key(c))).size===x.length;
  const subset=(x,pool)=>{const used=this.merge(x),source=new Map(this.merge(pool).map(c=>[this.key(c),c.count]));return used.every(c=>c.count<=(source.get(this.key(c))||0));};
  if(d.schema!==1||!time(d.at)||!d.town||!d.offices?.home||!this.h().data(s)||d.at<this.h().estate(s,'home').at||!Array.isArray(d.invites))fail('设立');
  const t=d.town;if(!same(t.paid,this.townCost)||!Array.isArray(t.terms)||!t.terms.length||!Array.isArray(t.courses)||!Array.isArray(t.records))fail('原镇名册');
  let ended=d.at;const townCourses=[...t.courses,...(t.training?[t.training]:[])];
  for(const [i,c]of townCourses.entries()){
    if(c.id!==i+1||!time(c.at)||c.at<ended||!groups(c.cohorts,40)||this.count(c.cohorts)!==2||!int(c.rounds)||c.rounds>30||c.lastAt!==null&&(!time(c.lastAt)||c.lastAt<c.at+10*(c.rounds-1))||!!c.rounds!==(c.lastAt!==null))fail('原镇课程');
    const paid={...this.townEnrollment};for(const [k,v]of Object.entries(this.townLesson))paid[k]=(paid[k]||0)+v*c.rounds;if(!equal(c.paid,paid))fail('原镇教具');
    if(i<t.courses.length){if(!time(c.endedAt)||c.endedAt<c.at||!['completed','expired'].includes(c.status)||c.status==='completed'&&(c.rounds!==30||c.endedAt!==c.lastAt)||c.status==='expired'&&this.count(this.aged(c.cohorts,c.at,c.endedAt))===2)fail('原镇结业');ended=c.endedAt;}else if(c.status!=='learning'||c.endedAt!==null||c.rounds>=30)fail('原镇在读');
  }
  const usedCourses=new Set();let previous=d.at;
  for(const [i,term]of t.terms.entries()){
    if(!time(term.at)||term.at<previous||!groups(term.cohorts)||this.count(term.cohorts)!==2)fail('原镇任期');previous=term.at;
    if(!i){if(term.at!==d.at||term.source!=='found'||term.cohorts.some(c=>c.age>62))fail('原镇现任');}
    else{const c=t.courses.find(c=>c.id===term.source);if(!c||c.status!=='completed'||c.endedAt>term.at||usedCourses.has(c.id)||!same(term.cohorts,this.aged(c.cohorts,c.at,term.at))||this.count(this.aged(t.terms[i-1].cohorts,t.terms[i-1].at,term.at))===2)fail('原镇接任');usedCourses.add(c.id);}
  }
  if(t.successor){const c=t.courses.find(c=>c.id===t.successor.source);if(!c||c.status!=='completed'||usedCourses.has(c.id)||t.successor.at!==c.endedAt||!same(t.successor.cohorts,this.aged(c.cohorts,c.at,c.endedAt)))fail('待接任名册');}
  const townUsed=[...this.townStaff(s),...(t.training?this.aged(t.training.cohorts,t.training.at,now):t.successor?this.aged(t.successor.cohorts,t.successor.at,now):[])];if(!subset(townUsed,s.civilization.society.cohorts))fail('原镇真实劳力');
  previous=null;for(const r of t.records){if(!time(r.at)||r.at<d.at||previous!==null&&r.at-previous<60||!['paid','shortage','unstaffed'].includes(r.status)||!same(r.paid,r.status==='paid'?this.townFee:{})||!r.changes||Object.values(r.changes).some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!int(n))))fail('原镇续办');previous=r.at;}if(t.lastAt!==previous)fail('原镇续办时点');
  const receipts=a.data(s).receipts,officeRows=a.indexRows(receipts.filter(r=>r.kind.startsWith('continuity')),['city']),forOffice=id=>officeRows(id),byRef=a.indexRows(receipts,['kind','city','ref']),byCourse=a.indexRows(receipts.filter(r=>r.kind==='continuityLesson'),['city',r=>String(r.ref).split(':').slice(0,2).join(':')]);
  for(const [id,o]of Object.entries(d.offices)){
    if(!a.ids(s).includes(id)||!this.h().estate(s,id)||!time(o.at)||o.at<d.at||o.at<this.h().estate(s,id).at||id==='home'&&o.at!==d.at||!same(o.paid,this.officeCost(s,id))||!int(o.worked)||o.worked>this.duration(s,id)||o.worked>now-o.at||o.remaining!==this.duration(s,id)-o.worked||o.completedAt===null&&o.remaining<1||o.completedAt!==null&&(!time(o.completedAt)||o.completedAt<o.at+this.duration(s,id)||o.remaining!==0))fail('接续工坊');
    for(const k of ['changes','services','courses','certificates'])if(!Array.isArray(o[k]))fail('岗位册');
    let settings={enabled:true,policy:'manual',source:a.ids(s).find(x=>x!==id)},lastPaidAt=null;const service=[],changes=[];
    for(const r of forOffice(id)){
      if(o.completedAt===null||r.at<o.completedAt)fail('未建成办事');
      if(r.kind==='continuityPolicy'){if(!Object.hasOwn(settings,r.field)||settings[r.field]===r.value||r.field==='enabled'&&typeof r.value!=='boolean'||r.field==='policy'&&!this.policies[r.value]||r.field==='source'&&(!a.membersAt(s,r.at).includes(r.value)||r.value===id))fail('岗位授权');settings[r.field]=r.value;changes.push(r.id);}
      else {if(!settings.enabled)fail('停办仍付课费');if(r.kind==='continuityService'){if(r.at%60||service.includes(r.at))fail('续办轮次');lastPaidAt=r.at;service.push(r.at);}else if(lastPaidAt===null||r.at-lastPaidAt>=120)fail('未续办教学/招工');}
    }
    if(!same(changes,o.changes)||!same(service,o.services)||lastPaidAt!==o.lastPaidAt||Object.keys(settings).some(k=>o[k]!==settings[k]))fail('现行岗位委托');
    const courses=[...o.courses,...(o.training?[o.training]:[])];let end=o.completedAt??now;
    for(const [i,c]of courses.entries()){
      if(c.id!==i+1||!time(c.at)||c.at<end||!['arrival','local'].includes(c.kind)||!groups(c.cohorts,62)||this.count(c.cohorts)<1||this.count(c.cohorts)>24||!int(c.rounds)||c.rounds>30)fail('岗位学员');
      const enrolled=byRef('continuityEnroll',id,id+':'+c.id),lessons=byCourse(id,id+':'+c.id).filter(r=>String(r.ref).startsWith(id+':'+c.id+':'));
      if(enrolled.length!==1||lessons.length!==c.rounds||c.lastAt!==(lessons.at(-1)?.at??null))fail('课程实付');
      let lessonAt=c.at-10;for(const [j,r]of lessons.entries()){if(r.ref!==id+':'+c.id+':'+(j+1)||r.at<lessonAt+10)fail('课程时间');lessonAt=r.at;}
      if(i<o.courses.length){if(!time(c.endedAt)||c.endedAt<c.at||!['completed','cancelled','expired'].includes(c.status)||c.status==='completed'&&(c.rounds!==30||c.endedAt!==c.lastAt)||c.status!=='completed'&&c.rounds===30||c.status==='expired'&&this.count(this.aged(c.cohorts,c.at,c.endedAt))===this.count(c.cohorts))fail('课程结果');end=c.endedAt;}else if(c.status!=='learning'||c.endedAt!==null||c.rounds>=30)fail('在读结果');
    }
    const legacy=o.certificates.filter(c=>c.kind==='legacy'),expectedLegacy=this.merge((this.h().data(s).trips||[]).filter(p=>p.to===id&&p.outcome==='arrived'&&p.settledAt<=o.completedAt).flatMap(p=>this.aged(p.initial,p.at,o.completedAt)));
    if(legacy.length!==(o.completedAt===null?0:1)||legacy.length&&(!same(legacy[0].cohorts,expectedLegacy)||legacy[0].at!==o.completedAt||legacy[0].source!=='register'))fail('在岗登记');
    for(const cert of o.certificates){if(!time(cert.at)||!groups(cert.cohorts))fail('资格年龄');if(cert.kind!=='legacy'){const c=o.courses.find(c=>c.id===cert.source);if(!c||c.status!=='completed'||cert.kind!==c.kind||cert.at!==c.endedAt||!same(cert.cohorts,this.aged(c.cohorts,c.at,cert.at)))fail('结业资格');}}
    if(o.certificates.length!==legacy.length+o.courses.filter(c=>c.status==='completed').length||o.courses.some(c=>c.status==='completed'&&o.certificates.filter(x=>x.source===c.id).length!==1))fail('重复资格');
    const physical=a.physical(s,id),old=CivilCityInstitutions.local(s,physical),protectedGroups=[...this.h().settled(s,id),...this.extraProtected(s,id),...CivilCityInstitutions.qualified(s,physical,'craft'),...CivilCityInstitutions.qualified(s,physical,'care'),...(old?.training?CivilCityInstitutions.aged(old.training.cohorts,old.training.startedAt,now):[])];
    if(!subset(protectedGroups,a.local(s,id).cohorts)||!subset([...o.certificates.filter(c=>c.kind!=='local').flatMap(c=>this.aged(c.cohorts,c.at,now)),...(o.training?.kind==='arrival'?this.trainees(s,id):[])],this.h().settled(s,id,true)))fail('重复占用居民');
    const paid={...o.paid};for(const r of forOffice(id))a.sum(paid,r.paid);for(const [k,v]of Object.entries(paid))if((a.local(s,id).budget.consumed[k]||0)+1e-5<v)fail('地方物资实付');
  }
  const orders=new Set(),lastInvite={};
  for(const [i,r]of d.invites.entries()){const o=this.h().data(s).orders[r.order-1],paid=receipts.filter(e=>e.kind==='continuityInvite'&&e.ref===r.id);if(r.id!==i+1||!time(r.at)||r.at<d.at||!d.offices[r.to]||!o||o.at!==r.at||o.from!==r.from||o.to!==r.to||o.total!==120||orders.has(o.id)||paid.length!==1||lastInvite[r.to]!==undefined&&r.at-lastInvite[r.to]<600)fail('有限招工');orders.add(o.id);lastInvite[r.to]=r.at;}
  for(const [id,o]of Object.entries(d.offices))if(o.lastInviteAt!==(lastInvite[id]??null))fail('最近招工');
};
