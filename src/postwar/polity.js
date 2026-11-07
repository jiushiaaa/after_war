/* MPL-2.0 — A4 common institutions. Local assets, public stock and cargo stay separate.
 * Events replay the public book; each source effect is also replayed by its local book.
 * No legacy World income, population grant, or technology flag is invoked here.
 */
var CivilPolity={
 data(s){return s.civilization.polity;},copy(x){return JSON.parse(JSON.stringify(x));},same(a,b){return JSON.stringify(a)===JSON.stringify(b);},
 laws:{devolution:{local:'地方自治',central:'中央统筹'},rights:{equal:'平等公民权',custom:'地方身份惯例'},priority:{care:'民生共同责任',industry:'公共工业优先'}},
 capital:{wood:3000,tools:600,knowledge:300},charter:{devolution:'local',rights:'equal',priority:'care'},travel:300,
 resources:['food','wood','medicine','scrap','tools','iron','knowledge','coal','parts','steel','electronics'],
 dataLocal(s,id){return id==='north'?CivilDomain.data(s)?.node:id==='east'?CivilRegional.data(s)?.node:this.data(s)?.peers[id]?.local;},
 available(s){return !!CivilRegional.data(s)?.pact&&CivilRegional.governed(s)>=10000000;},
 book(){return Object.fromEntries(this.resources.map(k=>[k,0]));},
 inspect(n,permit=true,cofunded=true){return {population:CivilDomain.count(n),health:n.health,condition:n.condition,stock:{...n.stores},idle:n.economy?.idle||0,permit,cofunded};},
 sources(s){return {north:this.inspect(this.dataLocal(s,'north'),CivilDomain.data(s).mode==='shared'&&CivilDomain.data(s).enabled),east:this.inspect(this.dataLocal(s,'east'),!!CivilRegional.data(s).pact&&CivilRegional.data(s).enabled,!!CivilRegional.data(s).cofunding)};},
 safe(cost,source){const p=source.population,keep={food:p*.12*18,medicine:p*.01*18,tools:p*.002};return Object.entries(cost).every(([k,v])=>Number.isFinite(v)&&v>=0&&(source.stock[k]||0)-v>=(keep[k]||0)-1e-7);},
 consent(sources,laws){if(!sources.north.permit||!sources.east.permit)return '两区共同服务须在办理';if(!sources.east.cofunded)return '先实付设立东原地方防疫共筹';if(Object.values(sources).some(x=>x.health<90||x.condition<90||x.idle<96))return '两区须恢复健康、设施至90并留出96个实际工位';if(laws.devolution==='central'&&laws.rights==='custom')return '东原拒绝同时交出地方决定权并保留身份差等';return null;},
 initial(at){return {schema:1,at,records:[],laws:{...this.charter},proposal:null,foundedAt:null,stable:0,legitimacy:60,enabled:true,peers:{},contacts:[],cargo:[],public:{received:{},consumed:{},produced:{},sent:{},external:{}},world:{nodes:{north:{population:0,stores:this.book(),infrastructure:100,trust:60,control:'shared',joinedAt:at,stableSeconds:0,casualties:0}},missions:[],populationModel:2},periods:0,paid:0,missed:0,industry:{},history:[]};},
 reason(s,action,args={}){try{if(typeof CivilModern!=='undefined'&&CivilModern.enabled(s)&&action==='earth'&&args.op==='start'&&(!s.civilization.polity?.future?.careMandate||!s.civilization.polity?.future?.laborMandate))return '先接续临床供料和混合班组委托，再承担全球职责';if(typeof CivilModern!=='undefined'&&action==='future'&&args.op==='start'&&CivilModern.gate(s,'future'))return CivilModern.gate(s,'future');const d=this.data(s);if(!d&&!this.available(s))return '先办理两区共同责任并覆盖一千万人';const e={at:s.civilization.elapsed,action,args:this.copy(args),sources:this.sources(s)};if(action==='period'&&s.civilization.pacingVersion===2)e.repairProductionVersion=1;if(typeof CivilEarth!=='undefined')CivilEarth.attach(s,e);if(typeof CivilEquipment!=='undefined')CivilEquipment.attach(s,e);if(typeof CivilSetup!=='undefined')CivilSetup.attach(s,e);if(action==='future'&&['start','migrate'].includes(args.op))e.volunteers=CivilFuturePeople.volunteers(this.dataLocal(s,'north'),240);this.reduce(d?this.copy({...d,records:[]}):null,e);return null;}catch(e){return e.message;}},
 act(s,action,args={}){if(this.reason(s,action,args))return false;return this.record(s,action,args);},
 record(s,action,args={}){const old=this.data(s),e={id:(old?.records.length||0)+1,at:s.civilization.elapsed,action,args:this.copy(args),sources:this.sources(s)};if(action==='period'&&s.civilization.pacingVersion===2)e.repairProductionVersion=1;if(typeof CivilEarth!=='undefined')CivilEarth.attach(s,e);if(typeof CivilEquipment!=='undefined')CivilEquipment.attach(s,e);if(typeof CivilSetup!=='undefined')CivilSetup.attach(s,e);if(action==='future'&&['start','migrate'].includes(args.op))e.volunteers=CivilFuturePeople.volunteers(this.dataLocal(s,'north'),240);if(old&&typeof CivilPolityForeign!=='undefined')e.reserves=Object.fromEntries(old.contacts.filter(c=>c.finishedAt===null&&e.at>=c.at+600).map(c=>[c.actor,CivilCensus.data(s).accounts['reserve_'+c.actor]]));const result=this.reduce(old,e);s.civilization.polity=result.d;e.effects=result.effects;e.outcome=result.outcome;result.d.records.push(e);
  for(const id of ['north','east']){if(!this.applyLocal(this.dataLocal(s,id),e,id))throw Error('公共责任无法在地方履行');if(id==='north')CivilDomain.record(s,'polity',{ref:e.id});else CivilRegional.row(s,'polity',{ref:e.id});const dead=e.effects[id]?.dead||0;if(dead)CivilCensus.death(s,'district_'+id,dead,'共同体实际战损');}
  if(typeof CivilPolityForeign!=='undefined')CivilPolityForeign.syncCensus(s,e);
  if(typeof CivilFuture!=='undefined')CivilFuture.syncCensus(s,e);
  if(typeof CivilEarth!=='undefined')CivilEarth.syncCensus(s,e);
  if(typeof State!=='undefined'&&s===State&&action!=='period'&&action!=='annual')Civilization.notify(result.outcome);
  return true;
 },
 effect(){return {cost:{},sent:{},received:{},staff:0,dead:0};},
 spend(d,cost){if(!CivilRegions.canPay(d.world.nodes.north.stores,cost))throw Error('公共仓不足：'+CivilHistory.costText(cost));CivilServices.pay(d.world.nodes.north.stores,cost);CivilCity.sum(d.public.consumed,cost);},
 localCost(effects,sources,id,cost,sent=false){const all=CivilConurbation.plus(CivilConurbation.plus(effects[id].cost,effects[id].sent),cost);if(!this.safe(all,sources[id]))throw Error((id==='north'?'北岸':'东原')+'须保留当地粮药与维修材料');CivilCity.sum(effects[id][sent?'sent':'cost'],cost);},
 reduce(d,e){const fail=x=>{throw Error(x);},sources=e.sources,effects={north:this.effect(),east:this.effect()},at=e.at,args=e.args;let outcome='';
  if(e.repairProductionVersion!==undefined&&(e.repairProductionVersion!==1||e.action!=='period'))fail('维修生产版本无效');
  if(e.action==='start'){
   if(d)fail('共同机构已存在');if(sources.north.population+sources.east.population<10000000)fail('两区共同责任不足一千万人');const why=this.consent(sources,this.charter);if(why)fail(why);
   for(const id of ['north','east'])this.localCost(effects,sources,id,this.capital);d=this.initial(at);if(typeof CivilEquipment!=='undefined')CivilEquipment.open(d,e);if(typeof CivilCivic!=='undefined')CivilCivic.open(d,e);if(typeof CivilSetup!=='undefined')CivilSetup.open(d,e);outcome='两区实付设立共同议事与运输机构。先经历连续600秒公共履约，再确认国约；居民与地方仓库保持原处。';
  }else{
   if(!d)fail('先设立共同机构');
   if(e.action==='period'){
    if(at%60||at!==(Math.floor(d.at/60)+d.periods+1)*60)fail('公共结算时序无效');d.periods++;
    this.arrive(d,at);const why=this.consent(sources,d.laws),staffed=d.enabled&&!why;
    // Existing convoys, troops and treaty duties keep their real personnel during a spending pause.
    for(const id of ['north','east'])if(sources[id].idle>=96)effects[id].staff=96;
    if(staffed)this.levy(d,e,effects);
    const population=sources.north.population+sources.east.population+Object.entries(d.peers).filter(([id])=>d.world.nodes[id].joinedAt!==null).reduce((v,[,p])=>v+CivilDomain.count(p.local),0);
    const cost={food:population*.000001,tools:population*.0000001,knowledge:population*.00000012*(d.laws.devolution==='local'?1.2:1)};
    const paid=staffed&&CivilRegions.canPay(d.world.nodes.north.stores,cost);
    if(paid){this.spend(d,cost);d.paid++;d.stable=Math.min(600,d.stable+60);d.legitimacy=Math.min(100,d.legitimacy+1);}else{d.missed++;d.stable=0;d.legitimacy=Math.max(0,d.legitimacy-1);}
    d.lastService={at,paid:!!paid,cost:paid?cost:{},reason:why||(!d.enabled?'机构已暂停':paid?null:'等待实际公共份额到仓')};
    if(d.proposal&&at>=d.proposal.at+600){const why=this.consent(sources,d.proposal.laws);const accepted=!why&&paid&&d.legitimacy>=60;d.history.push({at,kind:'law',accepted,laws:d.proposal.laws,reason:why});if(accepted)d.laws=d.proposal.laws;d.proposal=null;}
    if(!d.foundedAt&&d.stable===600&&d.legitimacy>=60){d.foundedAt=at;d.history.push({at,kind:'foundation',population});}
    if(paid&&!CivilForeign.fighting(d.world,'north')){if(d.world.nodes.north.infrastructure===100)this.work(d,'north',d.laws.priority);else if(e.repairProductionVersion===1&&d.world.nodes.north.infrastructure>=60&&d.world.foreign?.aftermath?.plans.north?.mode==='restart')this.repairWork(d);}
    d.world.nodes.north.population=sources.north.population+sources.east.population;d.world.nodes.north.trust=d.legitimacy;d.world.nodes.north.stableSeconds=d.stable;
    if(typeof CivilPolityForeign!=='undefined')CivilPolityForeign.period(d,e,effects,paid);
    if(d.future){effects.futureDelta=CivilFuture.period(d,e);d.world.nodes.north.population+=CivilFuturePeople.total(d.future);}
    if(d.earth)CivilEarth.period(d,e,effects);
    outcome=paid?'本期公共机构实付运行':d.lastService.reason;
   }else if(e.action==='pause'){
    if(typeof args.enabled!=='boolean'||args.enabled===d.enabled)fail('授权没有变化');this.spend(d,{knowledge:12});d.enabled=args.enabled;outcome=d.enabled?'公共机构恢复；旧承诺与欠款继续履行。':'暂停新公共征调与生产；已装船货物继续交付。';
   }else if(e.action==='law'){
    if(!d.foundedAt||d.proposal)fail('先确认国约并结清当前议案');const laws=args.laws;if(!laws||Object.keys(laws).length!==3||Object.entries(this.laws).some(([key,items])=>!Object.hasOwn(items,laws[key]))||this.same(d.laws,laws))fail('选择不同的完整制度安排');const why=this.consent(sources,laws);if(why)fail(why);this.spend(d,{knowledge:180,food:60});d.proposal={at,laws:this.copy(laws)};outcome='议案已实付提出；600秒后按实际地方服务和同意条件表决，费用不因拒绝退还。';
   }else if(e.action==='renewals')outcome=CivilCivic.renewalAction(d,e);else if(e.action==='equipment')outcome=CivilEquipment.action(d,e);else if(e.action==='earth')outcome=CivilEarth.action(d,e,effects);else if(e.action==='future')outcome=CivilFuture.action(d,e,effects);else if(typeof CivilPolityForeign!=='undefined')outcome=CivilPolityForeign.action(d,e,effects);else fail('未知公共行动');
  }
  return {d,effects,outcome};
 },
 // A bounded public warehouse. Levies stop when both delivered and in-flight stock cover the target.
 target(d,p){return {knowledge:2000,food:Math.max(3000,p*.0001,d.future?CivilFuturePeople.counts(d.future).bio*.72*16:0),tools:1000,medicine:500,wood:2000,scrap:1600,iron:1000};},
 levy(d,e,effects){const target=this.target(d,e.sources.north.population+e.sources.east.population),stock=d.world.nodes.north.stores;
  for(const id of ['north','east']){if(d.cargo.some(p=>p.from===id&&p.returnedAt===null))continue;
   const cargo={};let capacity=Infinity;for(const [k,v]of Object.entries(target)){const incoming=d.cargo.filter(p=>p.arrivedAt===null).reduce((n,p)=>n+(p.cargo[k]||0),0),keep={food:e.sources[id].population*.12*18+48,medicine:e.sources[id].population*.01*18,tools:e.sources[id].population*.002+4,wood:16},qty=Math.min(capacity,Math.floor(Math.max(0,(e.sources[id].stock[k]||0)-(keep[k]||0))),Math.ceil(Math.max(0,v-stock[k]-incoming)/2));if(qty){cargo[k]=qty;capacity-=qty;}}
   const total=Object.values(cargo).reduce((a,b)=>a+b,0);if(total>6000)for(const k of Object.keys(cargo))cargo[k]=Math.floor(cargo[k]*6000/total);for(const k of Object.keys(cargo))if(!cargo[k])delete cargo[k];
   if(!Object.keys(cargo).length)continue;const fee={food:48,wood:16,tools:4};if(!this.safe(CivilConurbation.plus(cargo,fee),e.sources[id]))continue;
   this.localCost(effects,e.sources,id,cargo,true);this.localCost(effects,e.sources,id,fee);d.cargo.push({id:d.cargo.length+1,from:id,to:'public',at:e.at,cargo,fee,arrivedAt:null,returnedAt:null});
  }
 },
 arrive(d,at){for(const p of d.cargo){if(p.arrivedAt===null&&at>=p.at+this.travel){CivilRegions.credit(d.world.nodes.north.stores,p.cargo);CivilCity.sum(d.public.received,p.cargo);p.arrivedAt=at;}if(p.returnedAt===null&&at>=p.at+2*this.travel)p.returnedAt=at;}},
 // An explicitly funded partial restart can make its own first repair parts.
 // Eight of the existing public posts use a slower hand-work recipe; no coal,
 // transport, debt, population or earlier war receipt is created or rewritten.
 repairWork(d){const n=d.world.nodes.north,input={iron:12,tools:4,knowledge:4},output={parts:2};
  if(n.stores.parts>=24||!CivilRegions.canPay(n.stores,input))return false;
  CivilServices.pay(n.stores,input);CivilRegions.credit(n.stores,output);CivilCity.sum(d.public.consumed,input);CivilCity.sum(d.public.produced,output);d.industry.north={at:d.lastService.at,used:8,mode:'repair'};return true;
 },
 work(d,id,priority){const n=d.world.nodes[id],ledger=id==='north'?d.public:d.peers[id].public;let labor=priority==='industry'?64:40;const recipes=[['medicine',500,{food:14,scrap:7},{medicine:10}],['parts',180,{iron:8,tools:2,knowledge:2},{parts:4}],['coal',240,{wood:8,food:4},{coal:12}],['steel',120,{iron:8,coal:8},{steel:4}],['electronics',100,{parts:4,knowledge:8},{electronics:2}]];
  if(id!=='north'&&n.stores.parts<8&&labor>=8&&CivilRegions.canPay(n.stores,{iron:12,tools:4,knowledge:4})){const input={iron:12,tools:4,knowledge:4},output={parts:2};CivilServices.pay(n.stores,input);CivilRegions.credit(n.stores,output);CivilCity.sum(ledger.consumed,input);CivilCity.sum(ledger.produced,output);labor-=8;}
  for(const [item,target,input,output]of (priority==='industry'?recipes.concat(recipes):recipes)){if(!(id==='north'?['medicine','parts','electronics']:id==='west'?['medicine','coal','steel']:['medicine']).includes(item)||labor<8||item==='electronics'&&n.stores.parts<12||n.stores[item]>=target||!CivilRegions.canPay(n.stores,input))continue;CivilServices.pay(n.stores,input);CivilRegions.credit(n.stores,output);CivilCity.sum(ledger.consumed,input);CivilCity.sum(ledger.produced,output);labor-=8;}
  d.industry[id]={at:d.lastService?.at||d.at,used:(priority==='industry'?64:40)-labor};
 },
 casualties(n,count){let left=count;for(const c of n.cohorts.filter(c=>c.age>=18&&c.age<65)){const take=Math.min(c.count,left);c.count-=take;left-=take;if(!left)break;}if(left)throw Error('没有足够实际成年人口承担战损');n.cohorts=n.cohorts.filter(c=>c.count>0);n.dead+=count;},
 applyLocal(n,e,id,meta){const src=e.sources[id],x=e.effects?.[id];if(!src||!x)return false;if(!this.same(this.inspect(n,meta?.permit??src.permit,meta?.cofunded??src.cofunded),src))return false;
  if(x.staff){if(!Number.isSafeInteger(x.staff)||x.staff>n.economy.idle||n.workers.publicoffice)return false;n.workers.publicoffice=x.staff;n.economy.idle-=x.staff;}
  if(!CivilCity.pay(n,x.cost)||!CivilRules.pay({stores:n.stores},x.sent))return false;CivilCity.sum(n.budget.sent,x.sent);CivilConurbation.receive(n,x.received);if(x.dead)this.casualties(n,x.dead);if(x.moved&&!CivilFuturePeople.take(n,x.moved))return false;if(x.futureStaff){if(n.economy.idle<x.futureStaff)return false;n.economy.idle-=x.futureStaff;n.workers.futureService=(n.workers.futureService||0)+x.futureStaff;}return true;
 },
 tick(s){if(!this.data(s))return;if(s.civilization.elapsed%60===0)this.record(s,'period');},
 population(s){const d=this.data(s);if(!d)return 0;return CivilDomain.known(s)+CivilRegional.known(s)+(d.future?CivilFuturePeople.total(d.future):0)+Object.entries(d.peers).filter(([id])=>d.world.nodes[id].joinedAt!==null).reduce((v,[,p])=>v+CivilDomain.count(p.local),0);}
};
