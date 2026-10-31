/* MPL-2.0 — Permanent source census, bounded emigration and source-owned support. */
var CivilOrigins={
  pendingIds:['originContact','originAgreement'],
  init(s){
    if(s.civilization.origins!==undefined)return;
    const year=Math.floor(s.civilization.elapsed/600),cohorts=[];
    // 40 ages with 23 residents and 40 with 22: a living society, not 1800 new adult workers.
    for(let age=0;age<80;age++){
      const count=age<40?23:22,mutants=age%4===0?5:4;
      cohorts.push({cohortId:'river_network_initial_'+age+'_human',age,count:count-mutants,identity:'human',originId:'river_network'});
      cohorts.push({cohortId:'river_network_initial_'+age+'_mutant',age,count:mutants,identity:'mutant',originId:'river_network'});
    }
    const population=CivilPopulation.count(cohorts),meal=CivilPopulation.foodPopulation(cohorts)*.12;
    const n={status:'unknown',baselinePopulation:1800,year,revision:0,cohorts,population,housing:2200,
      stores:{food:meal*12+1000,medicine:population*.01*12+50,tools:120,scrap:300,wood:200,knowledge:0},workers:{},health:80,hunger:0,
      births:{scaled:true,credit:0,mutantCredit:0},born:0,sourceDeaths:0,transitDeaths:0,admitted:0,
      permit:{limit:1080,paid:false},departures:{},announced:false,discarded:{}};
    s.civilization.origins={schema:1,introducedAt:s.civilization.elapsed,contactTrip:null,warned:false,nodes:{river_network:n}};
    this.assign(s,'river_network');
  },
  discoverable(s){const c=s.civilization;return !!(c.urban?.registered || c.village?.riverKnown || c.regions?.nodes.river?.discovered);},
  reservedLabor(){return 0;}, // Contact staff belong to the source; a town with no working adults can still answer.
  sourceStaff(s,id){return s.civilization.origins?.contactTrip?.source===id?2:0;},
  plan(cohorts){
    const p=CivilPopulation.count(cohorts),medic=Math.ceil(p*.01/.15)+2,teacher=Math.ceil(CivilPopulation.children(cohorts)/20);
    const farmer=Math.ceil((CivilPopulation.foodPopulation(cohorts)*.12+medic*.2)*1.15/1.4);
    const smith=Math.ceil(farmer*.01/.25)+1,salvager=Math.ceil((medic*.1+smith*.6)/.8)+1;
    return {farmer,medic,smith,salvager,teacher,gatherer:Math.ceil(teacher*.1+smith*.2)+1};
  },
  assign(s,id){
    const n=s.civilization.origins.nodes[id],plan=this.plan(n.cohorts),limits=CivilOriginContent[id].limits;
    let left=Math.max(0,CivilPopulation.workforce(n.cohorts)-this.sourceStaff(s,id));n.workers={};
    for(const job of ['farmer','medic','smith','salvager','gatherer','teacher']){const count=Math.min(left,limits[job],plan[job]);n.workers[job]=count;left-=count;}
  },
  canPay(stores,cost){return Object.entries(cost).every(([k,v])=>(stores[k]||0)+1e-8>=v);},
  pay(stores,cost){if(!this.canPay(stores,cost))return false;for(const [k,v]of Object.entries(cost))stores[k]=Math.max(0,(stores[k]||0)-v);return true;},
  settle(s){
    this.init(s);
    for(const [id,n]of Object.entries(s.civilization.origins.nodes)){
      this.assign(s,id);const st=n.stores,w=n.workers,factor=(n.health<30?.75:1)*(n.hunger>=30?.65:1);
      const run=(count,cost,output)=>{
        let batches=count;for(const [k,v]of Object.entries(cost))batches=Math.min(batches,Math.floor(((st[k]||0)+1e-8)/v));
        this.pay(st,Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,v*batches])));
        for(const [k,v]of Object.entries(output))st[k]=(st[k]||0)+v*batches*factor;
      };
      run(w.gatherer,{}, {wood:1});run(w.salvager,{}, {scrap:.8});
      run(w.smith,{wood:.2,scrap:.6},{tools:.25});run(w.farmer,{tools:.01},{food:1.4});
      const meal=CivilPopulation.foodPopulation(n.cohorts)*.12,ate=this.pay(st,{food:meal});
      if(!ate)st.food=0;n.hunger=ate?Math.max(0,n.hunger-20):n.hunger+10;
      run(w.medic,{food:.2,scrap:.1},{medicine:.15});run(w.teacher,{wood:.1},{knowledge:.2});
      const treated=w.medic>0 && this.pay(st,{medicine:n.population*.01});
      n.health=Math.max(0,Math.min(100,n.health+(ate && treated?.25:ate?-.15:-.5)));
      const caps={food:Math.max(100,meal*120),medicine:Math.max(20,n.population*.01*120),tools:5000,scrap:10000,wood:10000,knowledge:10000};
      for(const [k,cap]of Object.entries(caps))if((st[k]||0)>cap){n.discarded[k]=(n.discarded[k]||0)+st[k]-cap;st[k]=cap;}
    }
    return {}; // No source material or income is available to the home inventory.
  },
  beginContact(s){
    this.init(s);const r=s.civilization.origins,n=r.nodes.river_network,d=CivilOriginContent.river_network;
    if(!this.discoverable(s)||r.contactTrip||n.status!=='unknown')return false;
    const needed=Object.values(this.plan(n.cohorts)).reduce((a,b)=>a+b,0);
    if(CivilPopulation.workforce(n.cohorts)<needed+2 || !this.pay(n.stores,d.contactCost))return false;
    r.contactTrip={source:'river_network',remaining:d.contactDuration};n.status='contacting';this.assign(s,'river_network');return true;
  },
  agree(s,id='river_network'){
    const n=s.civilization.origins?.nodes[id],d=CivilOriginContent[id];
    if(!n || !d || n.status!=='contacted' || n.permit.paid || !CivilRules.pay(s,d.agreementCost))return false;
    n.status='agreed';n.permit.paid=true;n.revision++;return true;
  },
  inTransit(n){return Object.values(n.departures).filter(d=>d.status==='travel').reduce((sum,d)=>sum+d.alive,0);},
  remaining(s,id){const n=s.civilization.origins?.nodes[id];return n?Math.max(0,n.permit.limit-n.admitted-n.transitDeaths-this.inTransit(n)):0;},
  sustainable(s,id,cohorts){
    const n=s.civilization.origins.nodes[id],d=CivilOriginContent[id],p=CivilPopulation.count(cohorts),plan=this.plan(cohorts);
    return p>=d.retained && d.fertilityBands.every(b=>CivilPopulation.count(cohorts.filter(c=>c.age>=b.min&&c.age<=b.max))>=b.retained) &&
      n.health>=60 && !n.hunger && Object.entries(plan).every(([k,v])=>v<=d.limits[k]) &&
      Object.values(plan).reduce((a,b)=>a+b,0)+this.sourceStaff(s,id)<=CivilPopulation.workforce(cohorts) &&
      (n.stores.food||0)+1e-8>=CivilPopulation.foodPopulation(cohorts)*.12*12 && (n.stores.medicine||0)+1e-8>=p*.01*12;
  },
  choose(cohorts,limit,mode){
    const remaining=cohorts.map(c=>({...c})),selected=[];
    const bands=CivilOriginContent.river_network.fertilityBands;
    const excess=b=>Math.max(0,CivilPopulation.count(remaining.filter(c=>c.age>=b.min&&c.age<=b.max))-b.retained);
    const take=(test,count)=>{
      while(count){
        const candidates=remaining.filter(c=>test(c)&&c.count).map(c=>({c,b:bands.find(b=>c.age>=b.min&&c.age<=b.max)}))
          .filter(x=>!x.b||excess(x.b)>0).sort((a,b)=>!a.b&&!b.b?0:(b.b?excess(b.b):Infinity)-(a.b?excess(a.b):Infinity)||b.c.count-a.c.count||a.c.age-b.c.age);
        if(!candidates.length)break;
        const {c,b}=candidates[0],n=Math.min(count,c.count,b?excess(b):Infinity),old=selected.find(x=>x.cohortId===c.cohortId);
        if(old)old.count+=n;else selected.push({...c,count:n});c.count-=n;count-=n;
      }
      return count;
    };
    if(mode==='singleton')take(c=>c.age>=18&&c.age<=49,1);
    else{
      // At least two real young adults; do not accidentally take a sorted array of babies.
      const adults=Math.min(5,Math.max(2,limit-3));take(c=>c.age>=18&&c.age<=49,Math.min(2,adults));
      take(c=>c.age>=50&&c.age<65,adults-CivilPopulation.count(selected));
      take(c=>c.age>=18&&c.age<=49,adults-CivilPopulation.count(selected));
      const got=CivilPopulation.count(selected);if(got<Math.min(2,limit))return {selected:[],remaining};
      let room=limit-got;
      const children=Math.min(2,Math.max(0,room-1));take(c=>c.age<18,children);
      room=limit-CivilPopulation.count(selected);if(room)take(c=>c.age>=65,1);
      room=limit-CivilPopulation.count(selected);if(room)take(c=>c.age>=18&&c.age<65,room);
    }
    return {selected,remaining:remaining.filter(c=>c.count>0)};
  },
  quoteParty(s,id,maxPeople,options={mode:'convoy'}){
    const n=s.civilization.origins?.nodes[id],mode=options.mode;
    if(!n || !['singleton','convoy'].includes(mode) || !['contacted','agreed'].includes(n.status) || mode==='convoy' && n.status!=='agreed' || !Number.isInteger(maxPeople)||maxPeople<1)return null;
    const max=Math.min(mode==='singleton'?1:8,maxPeople,this.remaining(s,id),n.population-CivilOriginContent[id].retained);
    for(let count=max;count>0;count--){
      const {selected,remaining}=this.choose(n.cohorts,count,mode),actual=CivilPopulation.count(selected);
      if(!actual || actual!==count || !this.sustainable(s,id,remaining))continue;
      return {originId:id,revision:n.revision,mode,cohorts:selected,count:actual,cost:mode==='singleton'?{food:actual*6}:{food:actual*6,medicine:actual*.2,tools:actual*.2}};
    }
    return null;
  },
  commitDeparture(s,quote,partyId){
    const n=s.civilization.origins?.nodes[quote?.originId];
    if(!n || !Number.isInteger(partyId)||partyId<1 || n.departures['p'+partyId] || quote.revision!==n.revision)return false;
    const fresh=this.quoteParty(s,quote.originId,quote.count,{mode:quote.mode});
    if(!fresh || JSON.stringify(fresh.cohorts)!==JSON.stringify(quote.cohorts) || fresh.count!==quote.count)return false;
    const next=n.cohorts.map(c=>({...c}));
    for(const item of quote.cohorts){const c=next.find(c=>c.cohortId===item.cohortId);if(!c || c.age!==item.age || c.identity!==item.identity || c.count<item.count)return false;c.count-=item.count;}
    n.cohorts=next.filter(c=>c.count>0);n.population=CivilPopulation.count(n.cohorts);n.revision++;
    n.departures['p'+partyId]={partyId,status:'travel',initial:quote.count,alive:quote.count,dead:0,mode:quote.mode,deathsByYear:{},
      cohorts:quote.cohorts.map(c=>({...c})),startedYear:s.civilization.urban?.year ?? n.year,closedYear:null};
    this.assign(s,quote.originId);return true;
  },
  departure(s,party){
    const n=s.civilization.origins?.nodes[party?.source],d=n?.departures['p'+party?.id];
    return n && d && party.target==='home'?{n,d}:null;
  },
  expected(d,year){return d.cohorts.map(c=>({...c,age:c.age+year-d.startedYear})).filter(c=>c.age<80);},
  sameCohorts(a,b){
    const signature=cs=>cs.map(c=>[c.cohortId,c.age,c.count,c.identity,c.originId]).sort((x,y)=>x[0].localeCompare(y[0]));
    return JSON.stringify(signature(a))===JSON.stringify(signature(b));
  },
  matchesParty(s,party,d){return this.sameCohorts(party.cohorts,this.expected(d,s.civilization.urban?.year ?? Math.floor(s.civilization.elapsed/600)));},
  recordArrival(s,party){
    const found=this.departure(s,party);if(!found)return false;const {n,d}=found;
    if(d.status!=='travel' || CivilPopulation.count(party.cohorts)!==d.alive || !this.matchesParty(s,party,d))return false;
    d.status='arrived';d.closedYear=s.civilization.urban?.year ?? n.year;n.admitted+=d.alive;n.revision++;return true;
  },
  returnPeople(s,party){
    const found=this.departure(s,party);if(!found)return false;const {n,d}=found;
    if(d.status!=='travel' || CivilPopulation.count(party.cohorts)!==d.alive || !this.matchesParty(s,party,d))return false;
    for(const c of party.cohorts){const old=n.cohorts.find(x=>x.cohortId===c.cohortId);if(old && (old.age!==c.age || old.identity!==c.identity))return false;}
    for(const c of party.cohorts){const old=n.cohorts.find(x=>x.cohortId===c.cohortId);if(old)old.count+=c.count;else n.cohorts.push({...c});}
    d.status='returned';d.closedYear=s.civilization.urban?.year ?? n.year;n.population=CivilPopulation.count(n.cohorts);n.revision++;this.assign(s,party.source);return true;
  },
  recordTransitDeath(s,party,count){
    const found=this.departure(s,party);if(!found || !Number.isInteger(count)||count<=0)return false;const {n,d}=found;
    const year=s.civilization.urban?.year ?? Math.floor(s.civilization.elapsed/600),key='y'+year;
    if(d.status!=='travel' || d.deathsByYear[key]!==undefined || count>d.alive)return false;
    const aged=CivilPopulation.age(party.cohorts).deceased;
    if(aged!==count || !this.sameCohorts(party.cohorts,this.expected(d,year-1)))return false;
    d.deathsByYear[key]=count;d.alive-=count;d.dead+=count;n.transitDeaths+=count;n.revision++;return true;
  },
  annual(s,id){
    const n=s.civilization.origins.nodes[id],target=Math.floor(s.civilization.elapsed/600);
    while(n.year<target){
      const populationStart=n.population,aged=CivilPopulation.age(n.cohorts);n.year++;n.cohorts=aged.cohorts;n.sourceDeaths+=aged.deceased;n.population=CivilPopulation.count(n.cohorts);
      const birth=CivilPopulation.births(n.cohorts,n.births,{yearStartPopulation:populationStart,beds:n.housing-n.population,health:n.health,hunger:n.hunger,food:n.stores.food,medicine:n.stores.medicine});
      if(birth.count && this.pay(n.stores,birth.cost)){
        for(const c of birth.cohorts)n.cohorts.push({...c,cohortId:id+'_born_'+n.year+'_'+c.identity,originId:id});
        n.born+=birth.count;n.population+=birth.count;
      }
      n.revision++;this.assign(s,id);
    }
  },
  tick(s){
    this.init(s);const r=s.civilization.origins;
    for(const id of Object.keys(r.nodes))this.annual(s,id);
    if(r.contactTrip){
      r.contactTrip.remaining=Math.max(0,r.contactTrip.remaining-1);
      if(!r.contactTrip.remaining){const id=r.contactTrip.source;r.nodes[id].status='contacted';r.nodes[id].revision++;r.contactTrip=null;this.assign(s,id);}
    }
    const u=s.civilization.urban;
    if(u?.registered && !r.warned && (CivilPopulation.count(u.source)===0 || u.source.filter(c=>c.age>=18&&c.age<=49).reduce((a,c)=>a+c.count,0)<16)){
      r.warned=true;this.note('原有接纳名册正在衰老。河谷之外还有散居家庭；沿河网联络后，可按真实粮食与床位接纳新居民。');
    }
    return {storesChanged:false,populationChanged:false};
  },
  nextEvent(s){const n=s.civilization.origins?.nodes.river_network;return n?.status==='contacted' && !n.announced?'originContact':null;},
  event(id,done){
    const s=State,n=s.civilization.origins?.nodes.river_network;if(!n)return null;
    if(id==='originContact')return {title:'河网另一头的名册',text:[
      '河网的联络站用自己的值守人员与旅粮确认了这条路。那里分布着许多已有家庭，孩子会长大，老人也会离世。',
      '这次联系不会给聚落增加任何居民。已联系的来源可逐人到访，每人实际支付6食物；即使本地已没有成年劳动力，也可先手动备粮恢复。',
      '批次接纳需另花20知识登记协议，仍按车队、床位、粮药与教学能力发车。最多迁出1080人，并保证来源至少留下720人及必要供养岗位。'
    ],buttons:{record:{text:'记录来源与接纳条件',nextScene:'end',onChoose:done('河网来源已记录。选择来源后才按真实费用接纳，原名册与已离世者保持原账。',()=>{n.announced=true;})}}};
    if(id==='originAgreement' && n.status==='contacted')return {title:'河网迁居登记',text:[
      '登记批次迁居需要20知识。费用支付一次，协议总额1080，不随读档、出生或换任重置。',
      '登记后每批仍需每人6食物、0.2药品、0.2工具，两名实际运输工和已预留床位。逐人到访不要求先签这份批次协议。'
    ],buttons:{agree:{text:'登记批次协议（20知识）',nextScene:'end',onChoose:()=>{const ok=this.agree(s);return done(ok?'批次迁居协议已经登记。':'当前知识不足或协议已经登记，未重复扣款。')();}},later:{text:'先维持逐人到访',nextScene:'end',onChoose:done('保留逐人到访，稍后再商议批次接纳。')}}};
    return null;
  },
  note(message){if(typeof Civilization!=='undefined' && Civilization.notify)Civilization.notify(message);},
  reset(){this.panelReady=false;},
  refresh(){
    const s=State,r=s.civilization.origins;if(!r || !this.discoverable(s) || !$('#roadPanel').length)return;
    const n=r.nodes.river_network;
    const start=Civilization.button('originContactButton','沿河网联络','#roadPanel',()=>{if(this.beginContact(s)){Engine.saveGame();this.refresh();}});
    start.toggle(n.status==='unknown' || n.status==='contacting');Button.setDisabled(start,n.status!=='unknown');start.attr('title','来源社会承担2名值守人员、12粮与1工具；240秒后取得联系，本地不需成年探访员');
    let info=$('#originSourceInfo');if(!info.length)info=$('<div>').attr('id','originSourceInfo').css({width:'410px',lineHeight:'1.8',marginTop:'15px'}).appendTo('#roadPanel');
    info.text(r.contactTrip?'河网人员正在联络，还需 '+Math.ceil(r.contactTrip.remaining)+' 秒。':n.status==='unknown'?'河谷之外仍有散居家庭。来源人员可以建立联系，接触不会赠送居民。':
      '河网来源：现有 '+n.population+' 人，成年劳动力 '+CivilPopulation.workforce(n.cohorts)+'，儿童 '+CivilPopulation.children(n.cohorts)+'；健康 '+Math.floor(n.health)+'。协议余量 '+this.remaining(s,'river_network')+'；至少留守720人。'+(n.status==='agreed'?'可安排批次接纳。':'已可逐人到访，每人6粮；批次需登记。'));
    if(n.status==='contacted'){
      const agree=Civilization.button('originAgreementButton','商议批次接纳','#roadPanel',()=>{if(!Events.activeEvent() && !s.civilization.pending){s.civilization.pending='originAgreement';Civilization.showPending();}},{knowledge:20});Button.setDisabled(agree,!CivilRules.canPay(s,{knowledge:20}));
    }
    $('#originAgreementButton').toggle(n.status==='contacted');
  },
  validate(s){
    const r=s.civilization.origins;if(r===undefined)return;
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),int=(x,max=1e9)=>Number.isInteger(x)&&x>=0&&x<=max,num=(x,max=1e12)=>Number.isFinite(x)&&x>=0&&x<=max;
    const year=Math.floor(s.civilization.elapsed/600),u=s.civilization.urban;
    if(!obj(r)||r.schema!==1||!num(r.introducedAt,s.civilization.elapsed)||typeof r.warned!=='boolean'||!obj(r.nodes)||Object.keys(r.nodes).length!==1||!r.nodes.river_network)throw Error('来源总账无效');
    if(r.contactTrip!==null && (!obj(r.contactTrip)||r.contactTrip.source!=='river_network'||!int(r.contactTrip.remaining,240)))throw Error('来源联络无效');
    for(const [id,n]of Object.entries(r.nodes)){
      const cfg=CivilOriginContent[id];
      if(!cfg||!obj(n)||!['unknown','contacting','contacted','agreed'].includes(n.status)||n.baselinePopulation!==cfg.baseline||n.housing!==cfg.housing||n.year!==year||!int(n.revision)||!Array.isArray(n.cohorts)||n.cohorts.length>400||!int(n.population,n.housing)||!obj(n.stores)||!obj(n.workers)||!num(n.health,100)||!num(n.hunger)||!obj(n.departures)||typeof n.announced!=='boolean'||!obj(n.discarded))throw Error('来源状态无效');
      if((n.status==='contacting')!==!!r.contactTrip || !obj(n.permit)||n.permit.limit!==cfg.permit||typeof n.permit.paid!=='boolean'||(n.status==='agreed')!==n.permit.paid)throw Error('来源协议无效');
      if(!obj(n.births)||n.births.scaled!==true||['credit','mutantCredit'].some(k=>!num(n.births[k],1)||n.births[k]>=1))throw Error('来源出生记录无效');
      const cohortIds=new Set();
      for(const c of n.cohorts){if(!obj(c)||typeof c.cohortId!=='string'||!c.cohortId.startsWith(id+'_')||cohortIds.has(c.cohortId)||!int(c.age,79)||!int(c.count,n.housing)||!c.count||!['human','mutant'].includes(c.identity)||c.originId!==id)throw Error('来源年龄名册无效');cohortIds.add(c.cohortId);}
      if(CivilPopulation.count(n.cohorts)!==n.population)throw Error('来源人口不符');
      for(const [k,v]of Object.entries(n.stores))if(!['food','medicine','tools','scrap','wood','knowledge'].includes(k)||!num(v))throw Error('来源库存无效');
      for(const [k,v]of Object.entries(n.discarded))if(!['food','medicine','tools','scrap','wood','knowledge'].includes(k)||!num(v))throw Error('来源弃置记录无效');
      if(Object.entries(n.workers).some(([k,v])=>!Object.hasOwn(cfg.limits,k)||!int(v,cfg.limits[k]))||Object.values(n.workers).reduce((a,b)=>a+b,0)+this.sourceStaff(s,id)>CivilPopulation.workforce(n.cohorts))throw Error('来源岗位无效');
      for(const key of ['born','sourceDeaths','transitDeaths','admitted'])if(!int(n[key]))throw Error('来源流量无效');
      let arrived=0,dead=0,travel=0;
      for(const [key,d]of Object.entries(n.departures)){
        if(!obj(d)||!int(d.partyId)||d.partyId<1||!u||!int(u.nextParty)||d.partyId>=u.nextParty||key!=='p'+d.partyId||!['travel','arrived','returned'].includes(d.status)||!int(d.initial,8)||!d.initial||!int(d.alive,8)||!int(d.dead,8)||d.alive+d.dead!==d.initial||!['singleton','convoy'].includes(d.mode)||d.mode==='singleton'&&d.initial!==1||!obj(d.deathsByYear)||!int(d.startedYear,year)||d.startedYear<Math.floor(r.introducedAt/600)||!Array.isArray(d.cohorts)||!d.cohorts.length||d.cohorts.length>8)throw Error('来源迁出记录无效');
        const originals=new Set();
        for(const c of d.cohorts){if(!obj(c)||typeof c.cohortId!=='string'||!c.cohortId.startsWith(id+'_')||originals.has(c.cohortId)||!int(c.age,79)||!int(c.count,8)||!c.count||!['human','mutant'].includes(c.identity)||c.originId!==id)throw Error('迁出原始名册无效');originals.add(c.cohortId);}
        if(CivilPopulation.count(d.cohorts)!==d.initial || d.status==='travel' && d.closedYear!==null || d.status!=='travel' && (!int(d.closedYear,year)||d.closedYear<d.startedYear))throw Error('迁出时间记录无效');
        const censusYear=d.status==='travel'?u.year:d.closedYear,expected=this.expected(d,censusYear);
        if(!int(censusYear,year)||censusYear<d.startedYear||CivilPopulation.count(expected)!==d.alive)throw Error('迁出年龄总账不符');
        let perYear=0;for(const [k,v]of Object.entries(d.deathsByYear)){
          const deathYear=Number(k.slice(1));
          if(!/^y\d+$/.test(k)||deathYear>d.startedYear+80||deathYear>censusYear||deathYear<=d.startedYear||!int(v,8)||!v||CivilPopulation.count(d.cohorts.filter(c=>c.age+deathYear-d.startedYear===80))!==v)throw Error('在途死亡记录无效');perYear+=v;
        }
        if(perYear!==d.dead)throw Error('在途死亡计数不符');
        const parties=(u.parties||[]).filter(p=>p.source===id&&p.id===d.partyId);
        if(d.status==='travel' && (d.mode!=='convoy'||parties.length!==1||!['outbound','held','returning_people'].includes(parties[0].state)||parties[0].target!=='home'||!this.sameCohorts(parties[0].cohorts,expected)) ||
          d.status==='arrived' && (parties.length>1||parties.some(p=>d.mode!=='convoy'||p.state!=='returning'||p.target!=='home'||p.cohorts.length)) ||
          d.status==='returned' && parties.length)throw Error('来源与在途名册不符');
        dead+=d.dead;if(d.status==='arrived')arrived+=d.alive;if(d.status==='travel')travel+=d.alive;
      }
      if(arrived!==n.admitted||dead!==n.transitDeaths||n.admitted+n.transitDeaths+travel>n.permit.limit||n.baselinePopulation+n.born!==n.population+n.sourceDeaths+n.transitDeaths+n.admitted+travel)throw Error('来源人口总账不符');
      if((u?.parties||[]).some(p=>p.source===id&&!n.departures['p'+p.id]))throw Error('在途居民没有来源记录');
    }
  }
};
