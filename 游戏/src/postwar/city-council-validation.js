/* MPL-2.0 — Replay the municipal mandate book, including goods held at a hub. */
CivilCityCouncil.validate=function(s){
  const d=this.data(s);if(!d)return;
  const fail=label=>{throw Error('共同事务账不符：'+label);},int=n=>Number.isSafeInteger(n)&&n>=0,num=n=>Number.isFinite(n)&&n>=0;
  const time=n=>int(n)&&n<=s.civilization.elapsed,near=(a,b)=>num(a)&&num(b)&&Math.abs(a-b)<1e-4,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),resources=CivilCityContent.resources;
  const cost=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.entries(x).every(([k,v])=>resources.includes(k)&&num(v));
  const equalCost=(a,b)=>cost(a)&&cost(b)&&resources.every(k=>near(a[k]||0,b[k]||0));
  if(d.schema!==1||!this.available(s)||!time(d.at)||d.at<CivilCityNetwork.data(s).at||!d.offices||!d.locals||Object.keys(d.locals).some(k=>!['estuary','bridge'].includes(k)))fail('设立');
  for(const key of ['receipts','proposals','projects','shipments','history'])if(!Array.isArray(d[key]))fail(key);
  const ids=this.ids(s),consumed=Object.fromEntries(ids.map(id=>[id,{}]));
  if(Object.keys(d.offices).some(id=>!ids.includes(id))||['home','lake','ridge'].some(id=>!d.offices[id]))fail('登记城市');
  const work=(p,start,duration=300)=>{
    if(!int(p.worked)||p.worked>duration||p.worked>s.civilization.elapsed-start||p.remaining!==duration-p.worked||p.completedAt===null&&p.remaining<1||p.completedAt!==null&&(!time(p.completedAt)||p.completedAt-start<duration||p.worked!==duration))fail('实际施工');
  };
  for(const [id,o]of Object.entries(d.offices)){
    if(!time(o.startedAt)||o.startedAt<d.at||['home','lake','ridge'].includes(id)&&o.startedAt!==d.at||!['home','lake','ridge'].includes(id)&&(!d.locals[id]?.origin||o.startedAt<d.locals[id].origin.at)||!same(o.paid,this.stationCost)||typeof o.enabled!=='boolean'||!this.quotas[o.quota]||o.lastPaidAt!==null&&!time(o.lastPaidAt))fail('公用站');
    work(o,o.startedAt);this.sum(consumed[id],o.paid);
  }
  const remote=d.locals.estuary;
  if(remote){const survey=remote.survey;
    if(!survey||!time(survey.at)||survey.at<d.at||!same(survey.paid,this.surveyCost)||!d.projects.some(p=>p.completedAt!==null&&p.completedAt<=survey.at)||!int(survey.order)||survey.order>d.nextReceipt||!this.officeAt(s,'lake',survey.at,survey.order))fail('沿河普查');
    this.sum(consumed.lake,survey.paid);
    if(!!remote.node!==!!remote.origin)fail('河口登记');
    if(!remote.node){if(survey.finishedAt!==undefined||survey.remaining!==480-(s.civilization.elapsed-survey.at)||survey.remaining<1)fail('普查在途');}
    else{const n=remote.node,o=remote.origin;
      if(survey.remaining!==0||survey.finishedAt!==survey.at+480||o.at!==survey.finishedAt||!same(o,this.origin(s,o.at))||!Array.isArray(n.cohorts)||n.cohorts.length>160||n.cohorts.some(c=>!int(c.count)||!c.count||!int(c.age)||c.age>=80||!['human','mutant'].includes(c.identity)))fail('河口人口来源');
      const parts=CivilCensus.data(s).entries.filter(e=>e.kind==='partition'&&e.to==='city_estuary');
      if(parts.length!==1||parts[0].at!==o.at||parts[0].count!==o.population||n.contactedAt!==o.at||n.joinedAt!==null||n.year!==Math.floor(s.civilization.elapsed/600)||!int(n.born)||!int(n.dead)||CivilCity.count(n)!==o.population+n.born-n.dead+(typeof CivilCityHomes!=='undefined'?CivilCityHomes.delta(s,'estuary'):0)||CivilCity.count(n)>CivilCity.housing(s,'estuary'))fail('河口人口');
      if(!num(n.health)||n.health>100||!num(n.hunger)||!int(n.stable)||n.stable>600||!same(n.buildings,{road:0,water:1,housing:0})||n.project!==null||n.priority!=='balanced'||n.method!=='manual'||n.waterEnabled!==true||n.freightEnabled!==true)fail('河口服务');
      if(n.births?.scaled!==true||!num(n.births.credit)||n.births.credit>=1||!num(n.births.mutantCredit)||n.births.mutantCredit>=1||Object.values(n.workers).some(v=>!int(v))||Object.values(n.workers).reduce((a,b)=>a+b,0)>CivilCity.workforce(n))fail('河口岗位');
      for(const b of [n.stores,...['produced','consumed','received','sent'].map(k=>n.budget?.[k])])if(!cost(b))fail('河口仓库');
      const transfer=this.transfers(s,'estuary');
      if(!equalCost(n.budget.sent,transfer.sent)||!equalCost(n.budget.received,transfer.received))fail('河口收发');
      for(const k of resources)if(!near(n.stores[k],o.stores[k]+(n.budget.produced[k]||0)+(n.budget.received[k]||0)-(n.budget.consumed[k]||0)-(n.budget.sent[k]||0)))fail('河口物资守恒');
    }
  }
  const policies=Object.fromEntries(Object.keys(d.offices).map(id=>[id,{enabled:true,quota:'normal',lastPaidAt:null}]));
  let at=d.at,period=null,used={};const unique=new Set(),locals={},allocated={},delivered={};
  if(d.nextReceipt!==d.receipts.length+1)fail('流水号');
  for(const [i,e]of d.receipts.entries()){
    if(e.id!==i+1||!time(e.at)||e.at<at||!policies[e.city]||!cost(e.paid))fail('流水顺序');at=e.at;
    const office=d.offices[e.city],policy=policies[e.city];if(office.completedAt===null||e.at<office.completedAt)fail('未设站支出');
    const next=this.period(s,e.at);if(period!==next){period=next;used={};}
    let expected,once=e.city+':'+e.kind+':'+e.ref;
    if(e.kind==='policy'){
      if(!['enabled','quota'].includes(e.field)||e.field==='enabled'&&typeof e.value!=='boolean'||e.field==='quota'&&!this.quotas[e.value]||policy[e.field]===e.value)fail('重复或无效授权');
      policy[e.field]=e.value;expected={knowledge:4};once=null;
    }else if(e.kind==='continuityPolicy'){
      expected=typeof CivilCityContinuity!=='undefined'?CivilCityContinuity.receipt(s,e):null;if(!expected)fail('岗位授权');once=null;
    }else if(e.kind==='homesPolicy'){
      expected=typeof CivilCityHomes!=='undefined'?CivilCityHomes.receipt(s,e):null;if(!expected)fail('安居授权');once=null;
    }else if(e.kind==='meeting'){
      const p=d.proposals[e.ref-1];if(e.city!=='home'||!p||p.at!==e.at||p.order!==e.id)fail('议案付款');expected={knowledge:4};
    }else{
      if(!policy.enabled)fail('暂停期间新增开支');
      if(e.kind==='service'){if(e.ref!==e.at||e.at%60)fail('续办时点');expected=this.serviceCost;policy.lastPaidAt=e.at;}
      else{
        if(policy.lastPaidAt===null||e.at-policy.lastPaidAt>=120)fail('未续办执行');
        if(['continuityService','continuityEnroll','continuityLesson','continuityInvite'].includes(e.kind)){expected=typeof CivilCityContinuity!=='undefined'?CivilCityContinuity.receipt(s,e):null;if(!expected)fail('接续开支');}
        else if(['homeMaintenance','moveFee','movePack'].includes(e.kind)){expected=typeof CivilCityHomes!=='undefined'?CivilCityHomes.receipt(s,e):null;if(!expected)fail('安居支出');}
        else if(e.kind==='cargo'){const p=d.shipments[e.ref-1];if(!p||p.at!==e.at||p.source!==e.city)fail('供料付款');expected=p.cargo;}
        else if(e.kind==='leg'){
          const [ship,index]=String(e.ref).split(':').map(Number),l=d.shipments[ship-1]?.legs[index];
          if(!l||l.from!==e.city||l.startedAt!==e.at)fail('分段运费');expected=this.legFee(l.travel);
        }else if(e.kind==='localMaterials'){
          const p=d.projects[e.project-1],q=p?.pledges[e.pledge];if(!q||e.ref!==e.project+':'+e.pledge||q.from!==e.city||q.to!==e.city||e.at<p.at||p.completedAt!==null&&e.at>=p.completedAt||Object.keys(e.paid).some(k=>!q.required[k])||Object.values(e.paid).some(v=>!int(v)||!v)||Object.values(e.paid).reduce((a,b)=>a+b,0)>192)fail('本地材料');
          expected=e.paid;once=null;const key=e.ref;locals[key]||={};this.sum(locals[key],e.paid);
        }else fail('未知支出');
      }
      used[e.city]=(used[e.city]||0)+this.value(e.paid);if(used[e.city]>this.quotas[policy.quota].value+1e-6)fail('超出地方授权');
    }
    if(!equalCost(expected,e.paid))fail('费率');if(once){if(unique.has(once))fail('重复付款');unique.add(once);}
    if(!['cargo','movePack'].includes(e.kind))this.sum(consumed[e.city],e.paid);
  }
  for(const [id,p]of Object.entries(policies))for(const k of Object.keys(p))if(p[k]!==d.offices[id][k])fail('现行委托');
  let prior=d.at;
  for(const [i,p]of d.proposals.entries()){
    if(p.id!==i+1||!time(p.at)||p.at<prior||!unique.has('home:meeting:'+p.id))fail('议案次序');prior=p.at;
    const review=this.review(s,p.kind,p.target,p.mode,p.at,p.order);if(!review||['members','sites','allocations','stances','accepted'].some(k=>!same(p[k],review[k])))fail('利益与分担回放');
    const projects=d.projects.filter(x=>x.proposal===p.id);if(projects.length!==(p.accepted?1:0))fail('未批准的工程');
  }
  const endByCity={};
  for(const [i,p]of d.shipments.entries()){
    const project=d.projects[p.project-1],q=project?.pledges[p.pledge];
    if(p.id!==i+1||!q||p.source!==q.from||p.target!==q.to||p.source===p.target||!time(p.at)||p.at<project.at||i&&p.at<d.shipments[i-1].at||!cost(p.cargo)||!Object.keys(p.cargo).length||Object.keys(p.cargo).some(k=>!q.required[k])||Object.values(p.cargo).some(v=>!int(v)||!v)||Object.values(p.cargo).reduce((a,b)=>a+b,0)>192||!Array.isArray(p.legs)||!p.legs.length||!same(p.path,this.path(s,p.source,p.target,p.at))||p.legs.length>p.path.legs.length||!unique.has(p.source+':cargo:'+p.id))fail('公共运单');
    const key=p.project+':'+p.pledge;allocated[key]||={};this.sum(allocated[key],p.cargo);
    for(const [j,l]of p.legs.entries()){
      const route=p.path.legs[j];if(!same({from:l.from,to:l.to,travel:l.travel,route:l.route},route)||l.index!==j||!time(l.startedAt)||l.startedAt<(j?p.legs[j-1].deliveredAt??Infinity:p.at)||j===0&&l.startedAt!==p.at||!same(l.paid,this.legFee(l.travel))||!unique.has(l.from+':leg:'+p.id+':'+j))fail('分段路径/运费');
      if(l.deliveredAt!==null&&(l.deliveredAt!==l.startedAt+l.travel||!time(l.deliveredAt)))fail('到站时间');
      if(l.status==='complete'){if(l.finishedAt!==l.startedAt+l.travel*2||!time(l.finishedAt)||l.remaining!==0||l.deliveredAt===null)fail('空返');}
      else if(['outbound','returning'].includes(l.status)){if(l.finishedAt!==null||!int(l.remaining)||l.remaining<1||l.remaining!==l.startedAt+l.travel*(l.status==='outbound'?1:2)-s.civilization.elapsed||(l.status==='outbound')!==(l.deliveredAt===null))fail('在途');}else fail('车组状态');
      (endByCity[l.from]||=[]).push(l);
    }
    const final=p.legs[p.path.legs.length-1]?.deliveredAt??null;if(p.deliveredAt!==final)fail('货物交付');
    if(final!==null){delivered[key]||={};this.sum(delivered[key],p.cargo);this.sum(consumed[p.target],p.cargo);}
  }
  for(const p of s.civilization.cityHomes?.trips||[])(endByCity[p.from]||=[]).push({startedAt:p.at,finishedAt:p.finishedAt});
  for(const legs of Object.values(endByCity)){legs.sort((a,b)=>a.startedAt-b.startedAt);let end=0;for(const l of legs){if(l.startedAt<end)fail('一组车辆重复占用');end=l.finishedAt??Infinity;}}
  let ended=d.at;const roads=new Set();
  for(const [i,p]of d.projects.entries()){
    const proposal=d.proposals[p.proposal-1];if(p.id!==i+1||!proposal?.accepted||p.at!==proposal.at||p.at<ended||p.kind!==proposal.kind||p.target!==proposal.target||p.mode!==proposal.mode||!p.sites||Object.keys(p.sites).join()!==Object.keys(proposal.sites).join()||!Array.isArray(p.pledges)||p.pledges.length!==proposal.allocations.length)fail('工程来源');
    if(p.kind==='road'){if(roads.has(p.target))fail('重复道路');roads.add(p.target);}
    const installed={};
    for(const [j,q]of p.pledges.entries()){
      if(!same({from:q.from,to:q.to,required:q.required},proposal.allocations[j]))fail('工程分担');const key=p.id+':'+j,a={...(allocated[key]||{})},r={...(delivered[key]||{})};this.sum(a,locals[key]||{});this.sum(r,locals[key]||{});
      if(!equalCost(q.allocated,a)||!equalCost(q.delivered,r)||resources.some(k=>(a[k]||0)>(q.required[k]||0)))fail('供料守恒');installed[q.to]||={};this.sum(installed[q.to],r);
    }
    for(const [id,site]of Object.entries(p.sites)){
      if(!same(site.required,proposal.sites[id])||!equalCost(site.installed,installed[id]||{}))fail('安装物资');work(site,p.at,this.duration(p.kind));if(site.worked&&!this.full(site))fail('未到料施工');
      if(site.completedAt!==null){const arrivals=d.shipments.filter(x=>x.project===p.id&&x.target===id);if(arrivals.some(x=>x.deliveredAt===null||x.deliveredAt>site.completedAt-this.duration(p.kind)+1))fail('提前竣工');}
    }
    const sites=Object.values(p.sites),finished=sites.every(x=>x.completedAt!==null)?Math.max(...sites.map(x=>x.completedAt)):null;
    if(p.completedAt!==finished)fail('两端竣工');ended=p.completedAt??Infinity;
  }
  for(const id of ids){const n=this.local(s,id);for(const [k,v]of Object.entries(consumed[id]))if((n.budget.consumed[k]||0)+1e-6<v)fail('地方实付');const crew=this.crew(s,this.physical(s,id));if((n.workers.publiccourier||0)!==crew)fail('居民驾驶员');}
  at=d.at;for(const e of d.history){if(!time(e.at)||e.at<at||typeof e.text!=='string'||e.text.length>300)fail('历史');at=e.at;}
};
