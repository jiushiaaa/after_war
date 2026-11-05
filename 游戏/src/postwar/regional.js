/* MPL-2.0 — A4 multi-region public compact. Opt-in, local books and physical escrow.
 * East residents come from the existing east reserve. Medicines, tools and crews
 * never become a population, treasury or capacity reward for signing a compact.
 */
var CivilRegional={
  name:'东原地区',account:'district_east',surveyTime:480,travel:480,lastMile:240,
  surveyCost:{food:120,tools:24,knowledge:48},northSurvey:{wood:160,tools:24},
  setup:{home:{wood:240,tools:48,knowledge:48},north:{wood:2400,tools:480,knowledge:120},east:{wood:4800,tools:960,knowledge:240}},
  shares:{480:'地方优先 · 城市480药',2400:'兼顾城市 · 城市2400药',19200:'集中城市 · 城市19200药'},
  profiles:{food:2.6,wood:1.2,scrap:1.2,tools:.3,iron:.1},
  data(s){return s.civilization.regional;},copy(x){return JSON.parse(JSON.stringify(x));},
  north(s){return CivilDomain.data(s)?.node;},home(s){return CivilDomain.city(s,'home');},
  available(s){const d=CivilDomain.data(s);return !!d?.node&&d.mode==='shared'&&d.trips.some(p=>p.deliveredAt!==null);},
  known(s){return this.data(s)?.node?CivilDomain.count(this.data(s).node):0;},
  governed(s){return CivilDomain.governed(s)+(this.data(s)?.pact?this.known(s):0);},
  row(s,kind,fields={}){const d=this.data(s),e={id:d.ledger.length+1,at:s.civilization.elapsed,kind,...fields};d.ledger.push(e);return e;},
  note(s,text){if(typeof State!=='undefined'&&State===s)Civilization.notify(text);},
  northEntry(s,e){CivilDomain.record(s,'regional',{ref:e.id});},
  payNorth(s,e,cost){if(!CivilCity.pay(this.north(s),cost))throw Error('北岸责任不能无物资支付');this.northEntry(s,e);},
  startReason(s){if(!this.available(s))return '先让北岸共同服务实际交付一班货物';if(this.data(s))return '东原普查已有记录';return CivilCityCouncil.stockReason(s,'home',this.surveyCost)||(!CivilRules.canPay({stores:this.north(s).stores},this.northSurvey)?'北岸先备齐接力路材':null);},
  start(s){if(this.startReason(s))return false;CivilCity.pay(this.home(s),this.surveyCost);s.civilization.regional={schema:1,at:s.civilization.elapsed,survey:{remaining:this.surveyTime,finishedAt:null},origin:null,node:null,pact:null,enabled:true,levee:80,buffer:0,medical:{stock:0,received:0,local:0,used:0},ledger:[],trips:[],deliveries:[]};const e=this.row(s,'survey');this.payNorth(s,e,this.northSurvey);this.replan(s);this.note(s,'北岸协助两名本城普查员沿旧运河前往东原，双方实付路材和旅粮。');return true;},
  origin(s,at){const c=CivilCensus.data(s),initial=6200000+c.seed%500001,ratio=initial/CivilCensus.initial(c.seed).counts.reserve_east;
    let population=initial,born=0,dead=0,housing=Math.ceil(initial*1.25);
    const initialStores={food:initial*.12*36,medicine:initial*.01*24,wood:initial*.12,scrap:initial*.1,tools:initial*.04,knowledge:initial*.006,iron:initial*.005};const stores={...initialStores},produced={},consumed={};
    for(const e of c.entries){if(e.at>at)break;if(e.kind==='birth'&&e.to==='reserve_east'){const n=Math.floor(e.count*ratio);population+=n;born+=n;}
      if(e.kind==='death'&&e.from==='reserve_east'){const n=Math.floor(e.count*ratio);population-=n;dead+=n;const need={food:population*.12*60,medicine:population*.01*60,wood:population*.04,scrap:population*.04,tools:population*.02,knowledge:population*.002};const beds=Math.max(0,Math.ceil(population*1.25)-housing);housing+=beds;need.wood+=beds*.6;need.tools+=beds*.08;const growth={food:Math.max(0,population*.12*36-stores.food),medicine:Math.max(0,population*.01*24-stores.medicine)};CivilCity.sum(produced,CivilConurbation.plus(need,growth));CivilCity.sum(consumed,need);CivilCity.sum(stores,growth);}}
    return {at,initial,population,born,dead,housing,initialStores,stores,produced,consumed,assets:{beds:housing,waterCapacity:housing,coastalBarges:16,freightCapacity:96000,publicCart:1},model:'east-floodplain-annual-subsistence-v1'};
  },
  discover(s){const d=this.data(s),o=this.origin(s,s.civilization.elapsed);if(!CivilCensus.partition(s,o.population,'eastDistrict'))throw Error('东原人口细分来源不足');d.origin=o;d.node=CivilDomain.initialNode(o);d.survey.remaining=0;d.survey.finishedAt=o.at;this.row(s,'discover');this.replan(s);this.note(s,'东原确认 '+o.population+' 名居民，从东陆失联名册细分。当地农田、木作、河堤与公仓属于当地；旧城市和北岸不重复计入。');},
  leveeCost(n){const p=CivilDomain.count(n);return {wood:p*.00006,tools:p*.00003,medicine:p*.00008,knowledge:p*.000005};},
  need(n){return Math.ceil(this.leveeCost(n).medicine*16);},
  consent(s,share){const d=this.data(s);if(!d?.node)return '先完成东原普查';if(!Object.hasOwn(this.shares,share))return '未知分担方案';const remaining=24000-Number(share),need=this.need(d.node);if(remaining<need)return '东原拒绝：下一往返期防疫需 '+need+' 药，分配后只留 '+remaining+' 药';if(d.node.health<80||d.node.condition<80||!d.node.economy?.maintained)return '东原先要求恢复实际基础服务和维护';const north=CivilDomain.data(s);if(north.mode!=='shared'||!north.enabled||north.node.health<80||north.node.condition<80)return '北岸须恢复共同服务与地方维护';return null;},
  reason(s,share){const d=this.data(s);if(!d?.node)return '先完成普查';if(d.pact?.share===Number(share))return '正在按此份额履约';if(this.active(s)||this.delivery(s)||d.buffer>0)return '先暂停新发运，等在途与已承诺城市药品交清';const why=this.consent(s,share);if(why)return why;
    return CivilCityCouncil.stockReason(s,'home',this.setup.home)||(!CivilRules.canPay({stores:this.north(s).stores},this.setup.north)?'北岸尚缺协议修船材料':null)||(!CivilRules.canPay({stores:d.node.stores},this.setup.east)?'东原尚缺码头与堤务材料':null);},
  agree(s,share){if(this.reason(s,share))return false;const d=this.data(s),e=this.row(s,'agreement',{share:Number(share),handoff:1});CivilCity.pay(this.home(s),this.setup.home);CivilCity.pay(d.node,this.setup.east);this.payNorth(s,e,this.setup.north);d.pact={at:e.at,share:Number(share),handoff:1};d.enabled=true;this.replan(s);this.note(s,'两区议定公共互济：北岸每班出24000药，东原出12000工具，另把其中 '+share+' 药封存转送原城。各地同意的公共职责不等于中央接管或已经建国。');return true;},
  set(s,enabled){const d=this.data(s);if(!d?.pact||typeof enabled!=='boolean'||enabled===d.enabled||!CivilCity.pay(this.home(s),{knowledge:4}))return false;d.enabled=enabled;this.row(s,'policy',{enabled});this.replan(s);return true;},
  endReason(s){const d=this.data(s);if(!d?.pact)return '尚未签署两区公约';if(this.active(s)||this.delivery(s)||d.buffer>0)return '先结清在途与已经承诺的城市药品';return CivilRules.canPay({stores:this.home(s).stores},{knowledge:4})?null:'本城尚缺知识4';},
  end(s){if(this.endReason(s))return false;const d=this.data(s);CivilCity.pay(this.home(s),{knowledge:4});this.row(s,'withdraw');d.pact=null;d.enabled=true;this.replan(s);this.note(s,'两区互济结束，已履行责任和费用保留；居民、资产与地方仓库不移走。东原恢复地方自行办理堤务。');return true;},
  active(s){return this.data(s)?.trips.find(p=>p.finishedAt===null);},delivery(s){return this.data(s)?.deliveries.find(p=>p.finishedAt===null);},
  northCrew(s){return this.active(s)?16:0;},
  northCrewAt(s,at){return this.data(s)?.trips.some(p=>p.at<at&&p.at+this.travel*2>=at)?16:0;},
  eastCrew(s){return (this.active(s)?16:0)+(this.delivery(s)?4:0);},
  cityCrew(s,id){const d=this.data(s);if(!d||id!==CivilCityCouncil.depot(s))return 0;return (d.survey.finishedAt===null?2:0)+(this.delivery(s)?4:0);},
  reserve(s,id,reserved){const d=this.data(s);if(!d)return;const away=this.cityCrew(s,id);if(away)reserved.regionalcourier=away;if(d.pact&&id===CivilCityCouncil.depot(s))reserved.regionalclerk=2;},
  replan(s){CivilCity.plan(s,CivilCityCouncil.depot(s));},
  freightFees(){return {food:192,wood:64,tools:16};},cartFees(){return {food:24,wood:4,tools:1};},
  serviceFees(){return {food:12,wood:2,tools:.5,knowledge:1};},northFees(){return {food:60,tools:4,knowledge:2};},
  latest(s){return this.data(s)?.ledger.findLast(e=>e.kind==='service');},
  serviceReason(s){const d=this.data(s);if(!d?.pact)return '尚未议定公约';if(!d.enabled)return '已暂停新的共同支出';const north=CivilDomain.data(s);if(north.mode!=='shared'||!north.enabled)return '北岸共同服务已退出或停办';if((this.home(s).workers.regionalclerk||0)<2)return '本城两名联络员尚未到岗';return CivilCityCouncil.stockReason(s,'home',this.serviceFees())||(!CivilRules.canPay({stores:this.north(s).stores},this.northFees())?'北岸联络物资不足':null);},
  dispatchReason(s){const d=this.data(s);if(!d?.pact)return '先议定两区责任';if(!d.enabled)return '已停发；承诺的城市药品仍会送达';if(this.active(s))return '地区船队仍在往返';const service=this.latest(s);if(!service?.paid||s.civilization.elapsed-service.at>=120)return '先恢复本期联络维护';const why=this.consent(s,d.pact.share);if(why)return why;if(d.levee<60)return '东原堤务尚未恢复60，码头暂停新发运';if(d.buffer>4800)return '先把已经承诺的城市药品送到原城';
    const north=this.north(s),p=CivilDomain.count(north),fees=this.freightFees(),room=Math.max(0,((north.workers.medic||0)-(north.economy?.worked.medic||0))*6*.15),amount=Math.max(0,p*.01*18+24000-north.stores.medicine);
    if(amount>room+1e-7)return '北岸当期诊疗余力不足，先保当地';if(north.stores.food-amount/.15*.2-fees.food<p*.12*18||north.stores.scrap<amount/.15*.1||north.stores.wood<fees.wood||north.stores.tools-fees.tools<p*.002)return '北岸先保留粮食、药品与维修材料';
    if(!CivilRules.canPay({stores:d.node.stores},CivilConurbation.plus({tools:12000},fees))||d.node.stores.tools-12000-fees.tools<CivilDomain.count(d.node)*.002)return '东原工具先保本地；等待木作生产补库';return null;},
  dispatch(s){if(this.dispatchReason(s))return false;const d=this.data(s),north=this.north(s),amount=Math.max(0,CivilDomain.count(north)*.01*18+24000-north.stores.medicine);if(amount&&!CivilDomain.prepareMedicine(north,amount))throw Error('实际诊疗余力不足');const e=this.row(s,'dispatch',{trip:d.trips.length+1,prepared:amount});this.northEntry(s,e);const p={id:e.trip,at:e.at,share:d.pact.share,out:{medicine:24000},back:{tools:12000},fees:this.freightFees(),deliveredAt:null,finishedAt:null};d.trips.push(p);
    for(const [n,cargo]of [[north,p.out],[d.node,p.back]]){CivilRules.pay({stores:n.stores},CivilConurbation.plus(cargo,p.fees));CivilCity.sum(n.budget.sent,cargo);CivilCity.sum(n.budget.consumed,p.fees);}return true;},
  cityReason(s){const d=this.data(s);if(!d?.node||d.buffer<=0)return '尚无已承诺城市药品';if(this.delivery(s))return '分药车仍在往返';const n=this.home(s),cost=this.cartFees();if(CivilCity.workforce(n)<4)return '本城没有四名驾驶员';if(!CivilRules.canPay({stores:n.stores},cost)||n.stores.food-cost.food<CivilPopulation.foodPopulation(n.cohorts)*.12*6)return '本城先备足旅粮和车辆维护';if(!CivilRules.canPay({stores:d.node.stores},cost))return '东原尚缺分药车接力旅费';return null;},
  distribute(s){if(this.cityReason(s))return false;const d=this.data(s),e=this.row(s,'distribution',{trip:d.deliveries.length+1}),quantity=Math.min(2400,d.buffer);for(const n of [this.home(s),d.node])CivilCity.pay(n,this.cartFees());d.buffer-=quantity;d.deliveries.push({id:e.trip,at:e.at,cargo:{medicine:quantity},fees:this.cartFees(),deliveredAt:null,finishedAt:null});this.replan(s);return true;},
  transfers(s,id){const sent={},received={};if(id==='home')for(const p of this.data(s)?.deliveries||[])if(p.deliveredAt!==null)CivilCity.sum(received,p.cargo);return {sent,received};},
  service(s){const d=this.data(s),reason=this.serviceReason(s),paid=!reason,e=this.row(s,'service',{paid,reason});if(paid){CivilCity.pay(this.home(s),this.serviceFees());this.payNorth(s,e,this.northFees());}},
  selfCareReason(s){const d=this.data(s);if(!d?.pact)return '先议定两区公约';if(!d.enabled)return '先恢复共同委托';const amount=this.need(d.node)/2,room=Math.max(0,((d.node.workers.medic||0)-(d.node.economy?.worked.medic||0))*6*.15);if(d.medical.stock>=amount)return '堤务药品已有半航期储备';if(room<amount)return '本期诊疗岗位余力不足';if(d.node.stores.food-amount/.15*.2<CivilDomain.count(d.node)*.12*18||d.node.stores.scrap<amount/.15*.1)return '东原先备足临时制药的粮食与废料';return null;},
  selfCare(s){if(this.selfCareReason(s))return false;const d=this.data(s),amount=this.need(d.node)/2;if(!CivilDomain.prepareMedicine(d.node,amount))return false;CivilRules.pay({stores:d.node.stores},{medicine:amount});CivilCity.sum(d.node.budget.sent,{medicine:amount});d.medical.stock+=amount;d.medical.local+=amount;this.row(s,'selfCare',{amount});return true;},
  settleEast(s){const d=this.data(s);CivilDomain.settle(d.node,'care',true,this.eastCrew(s),this.profiles);this.row(s,'round');const cost=this.leveeCost(d.node),p=CivilDomain.count(d.node),material={...cost};delete material.medicine;
    // Newly signed compacts retain the paid local service until replacement cargo arrives.
    // Historical agreements without this marker replay their original costs and losses.
    const waiting=d.pact?.handoff===1&&d.enabled&&!d.trips.some(p=>p.at>=d.pact.at&&p.deliveredAt!==null);
    let local=0;if((!d.pact||waiting)&&d.medical.stock<cost.medicine&&CivilDomain.prepareMedicine(d.node,cost.medicine)){local=cost.medicine;CivilRules.pay({stores:d.node.stores},{medicine:local});CivilCity.sum(d.node.budget.sent,{medicine:local});d.medical.local+=local;d.medical.stock+=local;}
    const paid=(!d.pact||d.enabled)&&d.node.economy.fed&&d.medical.stock>=cost.medicine&&CivilCity.pay(d.node,material);if(paid){d.medical.stock-=cost.medicine;d.medical.used+=cost.medicine;}d.levee=Math.max(20,Math.min(100,d.levee+(paid?4:-4)));this.row(s,'levee',{paid:!!paid,local});
    if(d.levee<60){const spoil=Math.min(d.node.stores.food,p*.002);CivilCity.pay(d.node,{food:spoil});this.row(s,'flood',{food:spoil});}
  },
  tick(s){const d=this.data(s);if(!d)return;const at=s.civilization.elapsed;if(d.survey.finishedAt===null){d.survey.remaining=Math.max(0,this.surveyTime-(at-d.at));if(!d.survey.remaining)this.discover(s);return;}
    if(at%600===0){const delta=CivilDomain.annual(d.node);CivilCensus.death(s,this.account,delta.dead,'东原年度死亡');CivilCensus.birth(s,this.account,delta.born);this.row(s,'annual');}
    for(const p of d.trips){if(p.deliveredAt===null&&at===p.at+this.travel){CivilConurbation.receive(this.north(s),p.back);d.medical.stock+=24000-p.share;d.medical.received+=24000-p.share;d.buffer+=p.share;p.deliveredAt=at;this.northEntry(s,this.row(s,'arrival',{trip:p.id}));}if(p.finishedAt===null&&at===p.at+2*this.travel){p.finishedAt=at;this.row(s,'return',{trip:p.id});}}
    for(const p of d.deliveries){if(p.deliveredAt===null&&at===p.at+this.lastMile){CivilConurbation.receive(this.home(s),p.cargo);p.deliveredAt=at;this.row(s,'distributed',{trip:p.id});}if(p.finishedAt===null&&at===p.at+2*this.lastMile){p.finishedAt=at;this.row(s,'cartReturn',{trip:p.id});this.replan(s);}}
    if(at%60===0){this.settleEast(s);if(d.pact){this.service(s);this.dispatch(s);}this.distribute(s);}
  }
};
