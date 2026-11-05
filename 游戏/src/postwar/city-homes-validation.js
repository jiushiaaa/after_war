/* MPL-2.0 — Independent receipt, cohort, reservation and transit reconciliation. */
CivilCityHomes.receipt=function(s,r){
  const d=this.data(s);if(!d)return null;
  if(r.kind==='homeMaintenance'){const [id,at]=String(r.ref).split(':').map(Number),e=d.estates[r.city];return e&&e.project===id&&at===r.at&&e.records.some(x=>x.at===at&&x.paid)?this.fee(s,r.city):null;}
  if(r.kind==='homesPolicy'){const e=d.estates[r.city];return e&&e.project===r.ref&&e.changes.includes(r.id)?{knowledge:2}:null;}
  const p=d.trips[r.ref-1];if(!p||p.from!==r.city||p.at!==r.at)return null;return r.kind==='movePack'?p.pack:r.kind==='moveFee'?p.fee:null;
};
CivilCityHomes.validate=function(s){
  const d=this.data(s),api=this.c(),projects=api.data(s)?.projects.filter(p=>this.schemes[p.kind])||[];
  const fail=x=>{throw Error('安居迁居账不符：'+x);},int=n=>Number.isSafeInteger(n)&&n>=0,num=n=>Number.isFinite(n)&&n>=0,time=n=>int(n)&&n<=s.civilization.elapsed,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),near=(a,b)=>num(a)&&num(b)&&Math.abs(a-b)<1e-5;
  if(!d){if(projects.some(p=>p.completedAt!==null))fail('社区无维护册');return;}
  if(d.schema!==1||!time(d.at)||!api.data(s)||!d.estates||!Array.isArray(d.orders)||!Array.isArray(d.trips))fail('登记');
  const completed=projects.filter(p=>p.completedAt!==null);if(Object.keys(d.estates).length!==completed.reduce((n,p)=>n+Object.keys(p.sites).length,0)||d.at!==Math.min(...completed.map(p=>p.completedAt)))fail('社区来源');
  const receipts=api.data(s).receipts,byKind=new Map();
  // Ephemeral typed indexes retain every duplicate receipt. Never cache across loads or mutate history.
  for(const r of receipts){let refs=byKind.get(r.kind);if(!refs)byKind.set(r.kind,refs=new Map());let cities=refs.get(r.ref);if(!cities)refs.set(r.ref,cities=new Map());let rows=cities.get(r.city);if(!rows)cities.set(r.city,rows=[]);rows.push(r);}
  const receipt=(kind,ref,city)=>byKind.get(kind)?.get(ref)?.get(city)||[];
  for(const p of projects)for(const id of Object.keys(p.sites))if(projects.filter(x=>Object.hasOwn(x.sites,id)).length!==1)fail('重复社区');
  for(const [id,e]of Object.entries(d.estates)){
    const p=completed.find(p=>Object.hasOwn(p.sites,id)&&p.id===e.project);if(!p||e.at!==p.completedAt||!Array.isArray(e.records)||!Array.isArray(e.changes)||!Object.hasOwn(this.modes,e.mode)||typeof e.enabled!=='boolean')fail('维护册');
    let enabled=true,mode='food',supply,condition=100,lastPaidAt=null,changeAt=e.at;const changes=e.changes.map(order=>receipts[order-1]);
    for(const r of changes){if(!r||r.kind!=='homesPolicy'||r.city!==id||r.ref!==p.id||!time(r.at)||r.at<changeAt||!same(r.paid,{knowledge:2}))fail('社区授权');changeAt=r.at;if(r.field==='enabled'&&typeof r.value==='boolean'&&r.value!==enabled)enabled=r.value;else if(r.field==='mode'&&Object.hasOwn(this.modes,r.value)&&r.value!==mode)mode=r.value;else if(r.field==='supply'&&typeof r.value==='boolean'&&r.value!==supply){if(r.value&&(!s.civilization.cityContinuity?.offices[id]||s.civilization.cityContinuity.offices[id].completedAt===null||s.civilization.cityContinuity.offices[id].completedAt>r.at))fail('未具备接续工坊');supply=r.value;}else fail('重复社区授权');}
    if(e.enabled!==enabled||e.mode!==mode||e.supply!==supply||new Set(e.changes).size!==e.changes.length)fail('现行社区授权');
    const start=Math.ceil(e.at/60)*60,expected=Math.max(0,Math.floor(s.civilization.elapsed/60)-Math.ceil(e.at/60)+1);if(e.records.length!==expected)fail('维护轮次');
    for(const [i,r]of e.records.entries()){if(r.at!==start+i*60||typeof r.paid!=='boolean')fail('维护时序');const active=changes.filter(x=>x.at<=r.at&&x.field==='enabled').at(-1)?.value??true;
      // An input after this second's settlement is ordered by its receipt, not just its timestamp.
      const paid=receipt('homeMaintenance',p.id+':'+r.at,id);if(paid.length!==(r.paid?1:0))fail('维护实付');if(r.paid){const prior=changes.filter(x=>x.id<paid[0].id&&x.field==='enabled').at(-1)?.value??true;if(!prior)fail('停办维护');lastPaidAt=r.at;}
      condition=Math.max(0,Math.min(100,condition+(r.paid?5:-4)));if(r.condition!==condition)fail('设施完好度');
    }
    if(e.condition!==condition||e.lastPaidAt!==lastPaidAt)fail('维护结果');
    const n=api.local(s,id),occupied=this.settled(s,id);for(const c of occupied)if(c.count>(n.cohorts.find(x=>x.age===c.age&&x.identity===c.identity)?.count||0))fail('安置家庭子集');
    const expectedWorkers=this.active(s,id)?(typeof CivilCityContinuity!=='undefined'&&CivilCityContinuity.ready(s,id)?CivilCityContinuity.workers(s,id):Math.min(this.cfg(s,id).jobs,CivilPopulation.workforce(occupied))):0;
    if((n.workers.settler||0)>expectedWorkers||(n.workers.homekeeper||0)>this.maintainers(s,id))fail('真实居民岗位');
  }
  let end=d.at;
  for(const [i,o]of d.orders.entries()){if(o.id!==i+1||!time(o.at)||o.at<end||o.from===o.to||!api.membersAt(s,o.at).includes(o.from)||!api.membersAt(s,o.at).includes(o.to)||!d.estates[o.to]||d.estates[o.to].at>o.at||![120,480].includes(o.total)||typeof o.cancelled!=='boolean'||o.endedAt!==null&&(!time(o.endedAt)||o.endedAt<o.at)||o.cancelled&&o.endedAt===null)fail('迁居约');end=o.endedAt??Infinity;const trips=d.trips.filter(p=>p.order===o.id);if(trips.length*120>o.total||trips.some(p=>p.at<o.at||o.endedAt!==null&&p.at>o.endedAt)||!o.cancelled&&o.endedAt!==null&&trips.length*120!==o.total)fail('约定人数');}
  const entries=[];let previous=d.at;const vehicle={};
  for(const [i,p]of d.trips.entries()){
    const o=d.orders[p.order-1],cohorts=a=>Array.isArray(a)&&a.length<=160&&a.every(c=>int(c.age)&&c.age<80&&int(c.count)&&c.count>0&&['human','mutant'].includes(c.identity))&&new Set(a.map(c=>c.age+'_'+c.identity)).size===a.length;
    if(p.id!==i+1||!o||p.from!==o.from||p.to!==o.to||!time(p.at)||p.at<previous||!same(p.path,api.path(s,p.from,p.to,p.at))||!cohorts(p.initial)||this.count(p.initial)!==120||this.count(p.initial.filter(c=>c.age>=18&&c.age<60))!==60||this.count(p.initial.filter(c=>c.age<18))!==36||this.count(p.initial.filter(c=>c.age>=65))!==24||!cohorts(p.cohorts)||!int(p.dead)||!int(p.waited)||p.waited>120||!num(p.food)||!num(p.consumed)||!num(p.received)||!int(p.remaining))fail('家庭批次');previous=p.at;
    if(p.at<(vehicle[p.from]||0))fail('迁居车辆重用');vehicle[p.from]=p.finishedAt??Infinity;
    if(!same(p.pack,this.pack(p.initial,p.path.distance,p.at))||!same(p.fee,api.legFee(p.path.distance))||receipt('movePack',p.id,p.from).length!==1||receipt('moveFee',p.id,p.from).length!==1)fail('旅费与口粮');
    entries.push({at:p.at,kind:'move',from:this.account(s,p.from),to:'transit',count:120,reason:'安居迁居#'+p.id+'出发'});
    const until=p.settledAt??s.civilization.elapsed;if(!time(until)||until<p.at)fail('迁居时间');let food=0,dead=0;
    for(let year=Math.floor(p.at/600);year<=Math.floor(until/600);year++){
      const first=Math.max(p.at+1,year*600),last=Math.min(until,(year+1)*600-1),aged=this.aged(p.initial,p.at,year*600);if(last>=first)food+=(last-first+1)*CivilPopulation.foodPopulation(aged)*.12/10;
      if(year>Math.floor(p.at/600)){const died=this.count(this.aged(p.initial,p.at,year*600-1))-this.count(aged);if(died){dead+=died;entries.push({at:year*600,kind:'death',from:'transit',to:null,count:died,reason:'安居迁居#'+p.id+'途中离世'});}}
    }
    if(p.dead!==dead||p.year!==Math.floor(until/600)||!near(p.consumed,food)||!near(p.pack.food,p.food+p.consumed+p.received))fail('途中人口/口粮守恒');
    const groups=this.aged(p.initial,p.at,until),distance=p.path.distance,arrival=p.at+distance;
    if(p.arrivedAt!==(s.civilization.elapsed>=arrival?arrival:null))fail('到达时刻');
    if(p.settledAt===null){if(p.outcome!==null||p.finishedAt!==null||p.received!==0||!same(p.cohorts,groups))fail('在途家庭');
      if(p.phase==='outbound'){if(s.civilization.elapsed>=arrival||p.remaining!==arrival-s.civilization.elapsed||p.waited!==0)fail('去程');}
      else if(p.phase==='waiting'){if(p.remaining!==0||p.waited!==s.civilization.elapsed-arrival||p.waited>=120)fail('等待接收');}
      else if(p.phase==='returning'){if(p.waited!==120||p.remaining!==arrival+120+distance-s.civilization.elapsed||p.remaining<1)fail('返乡');}else fail('在途阶段');
    }else{
      const returned=p.outcome==='returned';if(!['arrived','returned'].includes(p.outcome)||p.cohorts.length||!time(p.settledAt)||p.settledAt!==(returned?arrival+120+distance:arrival+p.waited))fail('接收时序');
      const count=120-dead;if(count)entries.push({at:p.settledAt,kind:'move',from:'transit',to:this.account(s,returned?p.from:p.to),count,reason:'安居迁居#'+p.id+(returned?'返乡':'入住')});
      const finish=returned?p.settledAt:p.settledAt+distance;if(s.civilization.elapsed>=finish){if(p.phase!=='complete'||p.finishedAt!==finish||p.remaining!==0)fail('车辆结清');}else if(p.phase!=='empty'||p.finishedAt!==null||p.remaining!==finish-s.civilization.elapsed)fail('空返');
    }
  }
  const actual=CivilCensus.data(s).entries.filter(e=>e.reason.startsWith('安居迁居#')),sort=a=>a.map(x=>JSON.stringify(x)).sort();if(!same(sort(actual),sort(entries)))fail('世界迁移流水');
  for(const id of api.ids(s)){const n=api.local(s,id),physical=api.physical(s,id);if(CivilCity.count(n)+this.reserved(s,id)>CivilCity.housing(s,physical))fail('住房预留');}
};
