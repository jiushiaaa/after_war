/* MPL-2.0 — A4 first regional account. Explicit opt-in; no legacy country unlocks.
 * Residents remain in their original census account. Local assets are never capital stock.
 * All amounts use the existing resource units. One paid route, one finite barge.
 */
var CivilDomain={
  name:'北岸地区',account:'district_north',travel:360,surveyTime:420,
  surveyCost:{food:120,tools:24,knowledge:40},charterCost:{wood:160,tools:32,knowledge:40},
  modes:{trade:'互市通行',shared:'共同服务'},priorities:{care:'民生修复',works:'工料外供'},
  goods:{iron:{name:'铁料',unit:6,trade:80,shared:320},medicine:{name:'药品',unit:4,trade:80,shared:320}},
  data(s){return s.civilization.domain;},copy(x){return JSON.parse(JSON.stringify(x));},
  city(s,id){return CivilCityCouncil.local(s,id);},count(n){return CivilPopulation.count(n.cohorts);},
  available(s){return s.civilization.ruleset===2&&CivilCityCouncil.ids(s).length>=3&&!!s.civilization.cityGovernance&&CivilCityCouncil.ids(s).every(id=>!!CivilCityGovernance.office(s,id));},
  note(s,text){if(typeof State!=='undefined'&&s===State)Civilization.notify(text);},
  startReason(s){if(!this.available(s))return '请先让三城机构平稳接管日常公共职责';if(this.data(s))return '北岸普查已有记录';return CivilCityCouncil.stockReason(s,'home',this.surveyCost);},
  start(s){if(this.startReason(s))return false;CivilCity.pay(this.city(s,'home'),this.surveyCost);s.civilization.domain={schema:1,at:s.civilization.elapsed,survey:{paid:this.copy(this.surveyCost),remaining:this.surveyTime,finishedAt:null},origin:null,node:null,mode:null,priority:'care',enabled:true,good:'iron',ledger:[],trips:[]};this.replan(s);this.note(s,'两名普查员背上付清的旅粮，动身前往北岸。既有城市、地方公仓与共同事务照常独立运转。');return true;},
  origin(s,at){
    const c=CivilCensus.data(s),initial=3200000+c.seed%400001,ratio=initial/CivilCensus.initial(c.seed).counts.reserve_north;
    let population=initial,born=0,dead=0,housing=Math.ceil(initial*1.25);
    const initialStores={food:initial*.12*36,medicine:initial*.01*24,wood:initial*.05,scrap:initial*.1,tools:initial*.02,knowledge:initial*.005,iron:initial*.01};
    const stores={...initialStores},produced={},consumed={};
    for(const e of c.entries){if(e.at>at)break;
      if(e.kind==='birth'&&e.to==='reserve_north'){const v=Math.floor(e.count*ratio);population+=v;born+=v;}
      if(e.kind==='death'&&e.from==='reserve_north'){
        const v=Math.floor(e.count*ratio);population-=v;dead+=v;
        const need={food:population*.12*60,medicine:population*.01*60,wood:population*.02,scrap:population*.04,tools:population*.01,knowledge:population*.002};
        const beds=Math.max(0,Math.ceil(population*1.25)-housing);housing+=beds;need.wood+=beds*.6;need.tools+=beds*.08;
        const growth={food:Math.max(0,population*.12*36-stores.food),medicine:Math.max(0,population*.01*24-stores.medicine)};
        CivilCity.sum(produced,CivilConurbation.plus(need,growth));CivilCity.sum(consumed,need);CivilCity.sum(stores,growth);
      }
    }
    return {at,initial,population,born,dead,housing,initialStores,stores,produced,consumed,assets:{beds:housing,barge:1,waterCapacity:housing,workshops:Math.ceil(housing*.01)},model:'north-hinterland-annual-subsistence-v1'};
  },
  initialNode(o){return {cohorts:CivilCity.cohortSeed(o.population),year:Math.floor(o.at/600),born:0,dead:0,births:{scaled:true,credit:0,mutantCredit:0},housing:o.housing,health:90,condition:90,stores:{...o.stores},budget:{produced:{},consumed:{},sent:{},received:{}},workers:{},economy:null};},
  discover(s){const d=this.data(s),o=this.origin(s,s.civilization.elapsed);if(!CivilCensus.partition(s,o.population,'northDistrict'))throw Error('北岸人口来源不足');d.origin=o;d.node=this.initialNode(o);d.survey.finishedAt=o.at;d.survey.remaining=0;this.replan(s);this.note(s,'北岸地区普查在册 '+o.population+' 位居民，系从北陆失联底账中核实细分，仍居当地；此次普查并未凭空增加全球人口。');},
  record(s,kind,extra={}){const e={at:s.civilization.elapsed,kind,...extra};this.data(s).ledger.push(e);return e;},
  active(s){return this.data(s)?.trips.find(p=>p.finishedAt===null);},
  annual(n){const before=this.count(n),aged=CivilPopulation.age(n.cohorts);n.cohorts=aged.cohorts;n.dead+=aged.deceased;n.year++;
    const born=CivilPopulation.births(n.cohorts,n.births,{beds:Math.min(Math.ceil(before*.02),Math.max(0,n.housing-this.count(n))),food:n.stores.food,medicine:n.stores.medicine,health:n.health,hunger:!n.economy?.fed,yearStartPopulation:before});
    CivilCity.pay(n,born.cost);n.cohorts.push(...born.cohorts);n.born+=born.count;return {born:born.count,dead:aged.deceased};
  },
  // Pure regional production: a bounded set of occupations, paid recipes, physical services.
  settle(n,priority,enabled,away=0,profile=null){
    const p=this.count(n),cap=n.housing,weighted=CivilPopulation.foodPopulation(n.cohorts)-away,work=CivilPopulation.workforce(n.cohorts)-away,rates=profile||{food:1.8,wood:.8,scrap:1.5,tools:.25,iron:.3},before={...n.stores},workers={},worked={};let left=Math.max(0,work);
    const reserve=(k,count)=>{workers[k]=Math.min(left,Math.max(0,Math.ceil(count)));left-=workers[k];};
    reserve('water',p/160);reserve('medic',p*.012/.15);reserve('teacher',CivilPopulation.children(n.cohorts)/20);reserve('farmer',(weighted*.12+workers.medic*.2+p*.004)*1.12/rates.food);
    reserve('maintenance',enabled?p*.001:0);reserve('clerk',p*.0005);
    const smelters=n.condition>=60?Math.floor(cap*(priority==='works'?.002:.0005)):0;
    const smiths=Math.ceil((workers.farmer*.01+p*.00015)/.25)+2;
    reserve('salvager',(workers.medic*.1+smiths*.6+smelters)/rates.scrap+2);reserve('gatherer',(smiths*.2+smelters*.5+workers.teacher*.1+p*.0001)/rates.wood+2);reserve('smith',Math.min(cap*.01,smiths));reserve('smelter',smelters);
    const targets={food:p*.12*36,medicine:p*.01*24,wood:p*.08,scrap:p*.12,tools:p*.03,knowledge:p*.01,iron:p*.03};
    const run=(job,input,output)=>{let units=workers[job]*6;for(const [k,v]of Object.entries(output))units=Math.min(units,Math.max(0,(targets[k]-(n.stores[k]||0))/v));for(const [k,v]of Object.entries(input))units=Math.min(units,(n.stores[k]||0)/v);units=Math.max(0,units);const paid={},made={};for(const [k,v]of Object.entries(input))paid[k]=v*units;for(const [k,v]of Object.entries(output))made[k]=v*units;CivilCity.pay(n,paid);CivilCity.sum(n.stores,made);CivilCity.sum(n.budget.produced,made);worked[job]=units/6;};
    run('gatherer',{}, {wood:rates.wood});run('salvager',{}, {scrap:rates.scrap});run('smith',{scrap:.6,wood:.2},{tools:rates.tools});run('farmer',{tools:.01},{food:rates.food});run('medic',{food:.2,scrap:.1},{medicine:.15});run('teacher',{wood:.1},{knowledge:.2});run('smelter',{scrap:1,wood:.5},{iron:rates.iron});
    const meals={food:Math.max(0,weighted)*.12*6},treatment={medicine:p*.01*6};const fed=CivilCity.pay(n,meals),treated=CivilCity.pay(n,treatment),educated=workers.teacher*20>=CivilPopulation.children(n.cohorts),water=workers.water*160>=p;
    const factor=priority==='works'?2:1,cost={food:p*.001,wood:p*.0001*factor,tools:p*.0001*factor,knowledge:p*.00002};
    const maintained=enabled&&workers.maintenance>=Math.ceil(p*.001)&&CivilCity.pay(n,cost);
    n.condition=Math.max(20,Math.min(100,n.condition+(maintained?5:-5)));
    n.health=Math.max(0,Math.min(100,n.health+(fed&&treated&&water?1:-3)));n.workers=workers;
    n.economy={fed,treated,educated,water,maintained,upkeep:maintained?cost:{},worked,idle:left,flow:Object.fromEntries(Object.keys(n.stores).map(k=>[k,n.stores[k]-before[k]]))};return n.economy;
  },
  agreementReason(s,mode){const d=this.data(s),n=d?.node;if(!n)return '先完成北岸普查';if(!Object.hasOwn(this.modes,mode))return '未知协约';if(d.mode===mode)return '正按此协约操办';if(this.active(s))return '请先等在途船货交割并返航归港';if(n.condition<80||n.health<80)return '北岸要求先恢复当地水务、看诊，并将设施维护拉回80';if(mode==='shared'&&!n.economy?.maintained)return '北岸要求先兑现一期实际的维护投入';return CivilCityCouncil.stockReason(s,'home',this.charterCost)||CivilCityCouncil.stockReason(s,'lake',{wood:120,tools:24})||(!CivilRules.canPay({stores:n.stores},{wood:1200,tools:240})?'北岸须先留足修船材料':null);},
  agree(s,mode){if(this.agreementReason(s,mode))return false;const d=this.data(s);CivilCity.pay(this.city(s,'home'),this.charterCost);CivilCity.pay(this.city(s,'lake'),{wood:120,tools:24});CivilCity.pay(d.node,{wood:1200,tools:240});d.mode=mode;d.enabled=true;d.priority='care';this.record(s,'agreement',{mode});this.replan(s);this.note(s,this.modes[mode]+'已签订：北岸居民与当地家底照旧归其自管；湖滨码头、北岸船队与本城联络处各自拨付材料。'+(mode==='shared'?'双方共担公用维护，但尚未立国。':'仅互通水路买卖，不涉及管辖权归属。'));return true;},
  change(s,key,value){const d=this.data(s);if(!d?.mode||!['priority','enabled','good'].includes(key)||key==='priority'&&!Object.hasOwn(this.priorities,value)||key==='enabled'&&typeof value!=='boolean'||key==='good'&&!Object.hasOwn(this.goods,value)||d[key]===value)return false;
    if(key==='priority'&&value==='works'&&(d.mode!=='shared'||d.node.condition<80))return false;
    if(!CivilCity.pay(this.city(s,'home'),{knowledge:4}))return false;d[key]=value;this.record(s,'policy',{key,value});this.replan(s);return true;},
  withdraw(s){const d=this.data(s);if(!d?.mode||this.active(s))return false;if(!CivilCity.pay(this.city(s,'home'),{knowledge:4}))return false;this.record(s,'withdraw');d.mode=null;d.priority='care';d.enabled=true;this.replan(s);this.note(s,'北岸共同协约已终止。此前支取的用度不退，居民照旧留在北岸；当地自行担回基础服务与设施维护。');return true;},
  fees(mode){return {food:12,wood:mode==='shared'?4:2,tools:mode==='shared'?1:.5,knowledge:mode==='shared'?2:1};},
  currentService(s){return this.data(s)?.ledger.findLast(e=>e.kind==='service');},
  serviceReason(s){const d=this.data(s);if(!d?.mode)return '尚无共同协约';if(!d.enabled)return '联络与共同维护已暂停';if((this.city(s,'home').workers.regionclerk||0)<2)return '联络处尚缺两名当值办事员';return CivilCityCouncil.stockReason(s,'home',this.fees(d.mode));},
  tradeReason(s,preparing=false){const d=this.data(s),n=d?.node;if(!d?.mode)return '先议定有限协作';if(!d.enabled)return '暂停新发船班；在途船货照常交割';if(this.active(s))return '唯一的一组船队仍在航行往返';const service=this.currentService(s);if(!service?.paid||s.civilization.elapsed-service.at>=120)return '联络处用度尚未续付';if(n.condition<80)return '北岸码头维护度低于80';if(n.health<80||!n.economy?.fed||!n.economy?.treated)return '北岸需先稳住本地供养';
    const cargo=this.cargo(s),fees=this.freightFees();if(!cargo)return '未知货物';const p=this.count(n),keep={food:p*.12*18,medicine:p*.01*18,tools:p*.002,iron:120};
    for(const [k,v]of Object.entries(CivilConurbation.plus(cargo.back,fees)))if((n.stores[k]||0)-v<(keep[k]||0)&&!(preparing&&d.good==='medicine'&&k==='medicine'))return '北岸的'+(CivilText.labels[k]||k)+'须先留足本地保底用度';
    if(CivilPopulation.workforce(n.cohorts)<8||CivilCity.workforce(this.city(s,'lake'))<8)return '两地随船水手不足';return CivilCityCouncil.stockReason(s,'lake',CivilConurbation.plus(cargo.out,fees));},
  quantity(mode,priority,good){const g=this.goods[good];return g?(mode==='shared'?(priority==='works'?good==='iron':good==='medicine')?g.shared:g.trade:g[mode]):0;},
  cargo(s){const d=this.data(s),g=this.goods[d.good],qty=this.quantity(d.mode,d.priority,d.good);return qty?{out:{food:qty*g.unit},back:{[d.good]:qty}}:null;},
  freightFees(){return {food:48,wood:8,tools:2};},
  // Export preparation uses only the diagnostic capacity left unused this same round.
  // It never consumes the protected stock or adds another shift/person to the workforce.
  prepareMedicine(n,amount){const room=Math.max(0,((n.workers.medic||0)-(n.economy?.worked.medic||0))*6*.15);if(!(amount>0)||amount>room+1e-7)return false;
    const units=amount/.15,paid={food:units*.2,scrap:units*.1};if(!CivilCity.pay(n,paid))return false;CivilCity.sum(n.stores,{medicine:amount});CivilCity.sum(n.budget.produced,{medicine:amount});n.economy.worked.medic+=units/6;for(const [k,v]of Object.entries(paid))n.economy.flow[k]-=v;n.economy.flow.medicine+=amount;return true;
  },
  prepareExport(s){const d=this.data(s),at=s.civilization.elapsed;if(at%60||d?.good!=='medicine'||this.tradeReason(s,true)||!d.ledger.some(e=>e.kind==='round'&&e.at===at))return false;
    const amount=Math.max(0,this.count(d.node)*.01*18+this.cargo(s).back.medicine-d.node.stores.medicine);if(d.node.stores.food-amount/.15*.2<this.count(d.node)*.12*18+this.freightFees().food)return false;if(!this.prepareMedicine(d.node,amount))return false;this.record(s,'exportPrep',{amount});return true;
  },
  dispatch(s){if(this.tradeReason(s))return false;const d=this.data(s),cargo=this.cargo(s),fees=this.freightFees();for(const [n,c]of [[this.city(s,'lake'),cargo.out],[d.node,cargo.back]]){CivilRules.pay({stores:n.stores},CivilConurbation.plus(c,fees));CivilCity.sum(n.budget.sent,c);CivilCity.sum(n.budget.consumed,fees);}
    const p={id:d.trips.length+1,startedAt:s.civilization.elapsed,mode:d.mode,good:d.good,...cargo,fees,deliveredAt:null,finishedAt:null};d.trips.push(p);this.record(s,'dispatch',{id:p.id});this.replan(s);return true;},
  crew(s,id){const d=this.data(s);if(!d)return 0;return (id===CivilCityCouncil.depot(s)&&d.survey.finishedAt===null?2:0)+(id==='lake'&&this.active(s)?4:0);},
  reserve(s,id,reserved){const d=this.data(s);if(!d)return;const away=this.crew(s,id);if(away)reserved.regioncourier=away;if(id===CivilCityCouncil.depot(s)&&d.mode)reserved.regionclerk=2;},
  replan(s){for(const id of ['home','lake'])CivilCity.plan(s,CivilCityCouncil.physical(s,id));},
  transfers(s,id){const sent={},received={},d=this.data(s);if(d&&id==='lake')for(const p of d.trips){CivilCity.sum(sent,p.out);if(p.deliveredAt!==null)CivilCity.sum(received,p.back);}return {sent,received};},
  known(s){const d=this.data(s);return d?.node?this.count(d.node):0;},
  governed(s){const d=this.data(s);return d?.mode==='shared'?this.known(s):0;},
  tick(s){const d=this.data(s);if(!d)return;const at=s.civilization.elapsed;
    if(d.survey.finishedAt===null){d.survey.remaining=Math.max(0,this.surveyTime-(at-d.at));if(!d.survey.remaining)this.discover(s);return;}
    if(at%600===0){const result=this.annual(d.node);CivilCensus.death(s,this.account,result.dead,'北岸年度死亡');CivilCensus.birth(s,this.account,result.born);this.record(s,'annual');}
    for(const p of d.trips){if(p.deliveredAt===null&&at>=p.startedAt+this.travel){CivilConurbation.receive(this.city(s,'lake'),p.back);CivilConurbation.receive(d.node,p.out);p.deliveredAt=at;this.record(s,'arrival',{id:p.id});}if(p.finishedAt===null&&at>=p.startedAt+this.travel*2){p.finishedAt=at;this.record(s,'return',{id:p.id});this.replan(s);}}
    if(at%60===0){const regionalAway=typeof CivilRegional!=='undefined'?CivilRegional.northCrew(s):0;this.settle(d.node,d.priority,d.mode==='shared'?d.enabled:true,(this.active(s)?4:0)+regionalAway);this.record(s,'round',s.civilization.regional?{regionalAway}:{});if(d.mode){const reason=this.serviceReason(s),paid=!reason;if(paid)CivilCity.pay(this.city(s,'home'),this.fees(d.mode));this.record(s,'service',{mode:d.mode,paid,reason});}this.prepareExport(s);this.dispatch(s);}
  }
};
