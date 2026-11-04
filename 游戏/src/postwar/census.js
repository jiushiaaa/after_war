/* MPL-2.0 — New-game world population ledger. Discovery partitions existing people.
   Residence is separate from political membership. Legacy saves never acquire this ledger. */
var CivilCensus={
  regions:{north:'北陆',east:'东陆',west:'西陆',rainforest:'赤道雨带',islands:'群岛',desert:'荒漠',plateau:'高原',polar:'极地'},
  enabled(s){return s.civilization.ruleset===2;},
  data(s){return s.civilization.census;},
  initial(seed){
    const counts={},weights=[18,19,17,15,9,7,10,5];
    const total=350000000+(seed%150000001);let used=0;
    Object.keys(this.regions).forEach((id,i)=>{const n=i===7?total-used:Math.floor(total*weights[i]/100);counts['reserve_'+id]=n;used+=n;});
    const take=(id,n,region='north')=>{counts['reserve_'+region]-=n;counts[id]=n;};
    take('home',0);take('transit',0);take('patients',0);take('wanderers',512);take('dispersed',480);take('cellar',3);
    for(const [id,cfg]of Object.entries(CivilOriginContent))take('origin_'+id,cfg.baseline);
    for(const [id,cfg]of Object.entries(CivilRegionContent))take('local_'+id,cfg.population);
    for(const [id,cfg]of Object.entries(CivilWorldContent.regions))take('macro_'+id,cfg.population,id);
    if(typeof CivilCityContent!=='undefined')for(const [id,cfg]of Object.entries(CivilCityContent.wards))take('ward_'+id,cfg.population);
    return {total,counts};
  },
  init(s){
    if(!this.enabled(s)||this.data(s))return;
    if(s.civilization.elapsed!==0||s.game.population!==0)throw Error('新世界底账只能在开局建立');
    const seed=Math.floor(Math.random()*0x7fffffff),base=this.initial(seed);
    s.civilization.census={schema:1,seed,initial:base.total,accounts:base.counts,born:0,dead:0,year:0,entries:[]};
  },
  record(s,kind,from,to,count,reason){
    if(!this.enabled(s)||!count)return true;
    const d=this.data(s);if(!d||!Number.isSafeInteger(count)||count<0||!['move','birth','death'].includes(kind))throw Error('人口变动无效');
    if((from!==null&&!Object.hasOwn(d.accounts,from))||(to!==null&&!Object.hasOwn(d.accounts,to)))throw Error('未知人口来源');
    if(kind==='move'&&(!from||!to||from===to)||kind==='birth'&&(from!==null||!to)||kind==='death'&&(!from||to!==null))throw Error('人口变动方向无效');
    if(from&&d.accounts[from]<count)return false;
    if(from)d.accounts[from]-=count;if(to)d.accounts[to]+=count;
    if(kind==='birth')d.born+=count;if(kind==='death')d.dead+=count;
    d.entries.push({at:s.civilization.elapsed,kind,from,to,count,reason});return true;
  },
  partition(s,count,id='lake'){
    const source={lake:'reserve_north',ridge:'reserve_west',estuary:'reserve_east',bridge:'reserve_north'}[id],to='city_'+id,d=this.data(s);
    if(!source||!this.enabled(s)||Object.hasOwn(d.accounts,to)||!Number.isSafeInteger(count)||count<1||d.accounts[source]<count)return false;
    d.accounts[source]-=count;d.accounts[to]=count;d.entries.push({at:s.civilization.elapsed,kind:'partition',from:source,to,count,reason:({lake:'湖滨市',ridge:'矿岭市',estuary:'河口市',bridge:'桥原市'}[id])+'普查细分，居民仍在当地'});return true;
  },
  move(s,from,to,n,reason='迁居'){return this.record(s,'move',from,to,n,reason);},
  birth(s,to,n){return this.record(s,'birth',null,to,n,'出生');},
  death(s,from,n,reason='死亡'){return this.record(s,'death',from,null,n,reason);},
  source(id){return id==='dispersed'?'dispersed':'origin_'+id;},
  target(id){return id==='home'?'home':'local_'+id;},
  total(s){const d=this.data(s);return d?Object.values(d.accounts).reduce((a,b)=>a+b,0):null;},
  annual(s){
    if(!this.enabled(s))return;
    const d=this.data(s),year=Math.floor(s.civilization.elapsed/600);
    while(d.year<year){
      d.year++;
      // Unsurveyed populations use an explicit coarse demographic assumption, not free discoveries.
      for(const id of Object.keys(this.regions)){
        const key='reserve_'+id,n=d.accounts[key];
        this.birth(s,key,Math.floor(n*.022));this.death(s,key,Math.floor(n*.018),'未普查地区年度死亡');
      }
    }
  },
  syncMacro(s){
    if(!this.enabled(s))return;
    // National wars already own an exact cumulative casualty count. Mirror only actual losses.
    for(const [id,n]of Object.entries(s.civilization.worldstage?.nodes||{})){
      const key='macro_'+id,expected=CivilWorldContent.regions[id].population-(n.casualties||0);
      if(n.population!==expected)throw Error('远域人口与伤亡不符');
      const lost=this.data(s).accounts[key]-expected;if(lost<0)throw Error('远域人口来源不符');
      if(lost)this.death(s,key,lost,'远域实际伤亡');
    }
  },
  known(s){
    const c=s.civilization,rows=[{id:'home',name:'原镇居民',count:s.game.population,member:true}];
    for(const [id,n]of Object.entries(c.origins?.nodes||{}))if(n.status!=='unknown')rows.push({id:'origin_'+id,name:CivilOriginContent[id].name,count:n.population,member:false});
    for(const [id,n]of Object.entries(c.regions?.nodes||{}))rows.push({id:'local_'+id,name:CivilRegionContent[id].name,count:n.population,member:['associated','integrated'].includes(n.relation)});
    for(const [id,n]of Object.entries(c.city?.wards||{}))if(n.contactedAt!==null)rows.push({id:'ward_'+id,name:CivilCityContent.wards[id].name,count:CivilPopulation.count(n.cohorts),member:n.joinedAt!==null});
    if(c.urban?.registered)rows.push({id:'dispersed',name:'沿路待迁家庭',count:CivilPopulation.count(c.urban.source),member:false});
    if(c.cityNetwork?.node)rows.push({id:'city_ridge',name:'矿岭市（独立城市）',count:CivilPopulation.count(c.cityNetwork.node.cohorts),member:false});
    if(c.conurbation?.node)rows.push({id:'city_lake',name:'湖滨市（独立城市）',count:CivilPopulation.count(c.conurbation.node.cohorts),member:false});
    if(c.cityCouncil?.locals.bridge?.node)rows.push({id:'city_bridge',name:'桥原市（独立城市）',count:CivilPopulation.count(c.cityCouncil.locals.bridge.node.cohorts),member:false});
    if(c.cityCouncil?.locals.estuary?.node)rows.push({id:'city_estuary',name:'河口市（独立城市）',count:CivilPopulation.count(c.cityCouncil.locals.estuary.node.cohorts),member:false});
    return rows;
  },
  validate(s){
    if(!this.enabled(s)){if(this.data(s)!==undefined)throw Error('旧规则不能混入新世界底账');return;}
    const d=this.data(s),int=n=>Number.isSafeInteger(n)&&n>=0,fail=()=>{throw Error('世界人口底账不符');};
    if(!d||d.schema!==1||!int(d.seed)||d.seed>=0x7fffffff||!int(d.year)||d.year!==Math.floor(s.civilization.elapsed/600)||!Array.isArray(d.entries)||!int(d.born)||!int(d.dead))fail();
    const base=this.initial(d.seed),counts={...base.counts};let born=0,dead=0,last=0;
    if(d.initial!==base.total||!d.accounts)fail();
    for(const e of d.entries){
      if(!e||!int(e.at)||e.at<last||e.at>s.civilization.elapsed||!int(e.count)||!e.count||typeof e.reason!=='string'||e.reason.length>80)fail();last=e.at;
      if(e.kind==='partition'){if(!({city_lake:s.civilization.conurbation?.node&&'reserve_north',city_ridge:s.civilization.cityNetwork?.node&&'reserve_west',city_estuary:s.civilization.cityCouncil?.locals.estuary?.node&&'reserve_east',city_bridge:s.civilization.cityRegistry&&s.civilization.cityCouncil?.locals.bridge?.node&&'reserve_north'}[e.to])||e.from!==({city_lake:'reserve_north',city_ridge:'reserve_west',city_estuary:'reserve_east',city_bridge:'reserve_north'}[e.to])||Object.hasOwn(counts,e.to))fail();counts[e.to]=0;}
      else if(e.kind==='move'){if(!Object.hasOwn(counts,e.from)||!Object.hasOwn(counts,e.to)||e.from===e.to)fail();}
      else if(e.kind==='birth'){if(e.from!==null||!Object.hasOwn(counts,e.to))fail();born+=e.count;}
      else if(e.kind==='death'){if(e.to!==null||!Object.hasOwn(counts,e.from))fail();dead+=e.count;}else fail();
      if(e.from!==null){counts[e.from]-=e.count;if(counts[e.from]<0)fail();}
      if(e.to!==null)counts[e.to]+=e.count;
    }
    if(Object.keys(d.accounts).sort().join()!==Object.keys(counts).sort().join())fail();
    if(born!==d.born||dead!==d.dead||this.total(s)!==d.initial+born-dead)fail();
    for(const [id,n]of Object.entries(counts))if(!int(d.accounts[id])||d.accounts[id]!==n)fail();
    const eq=(id,n)=>{if(counts[id]!==n)throw Error('人口所在名册不符：'+id);};
    const c=s.civilization;eq('home',s.game.population);
    for(const [id,n]of Object.entries(c.origins?.nodes||{}))eq('origin_'+id,n.population);
    for(const [id,n]of Object.entries(c.regions?.nodes||{}))eq('local_'+id,n.population);
    for(const [id,n]of Object.entries(c.worldstage?.nodes||{}))eq('macro_'+id,n.population);
    if(c.urban?.registered)eq('dispersed',CivilPopulation.count(c.urban.source));
    eq('transit',(c.urban?.parties||[]).reduce((a,p)=>a+CivilPopulation.count(p.cohorts),0)+(c.cityHomes?.trips||[]).reduce((a,p)=>a+CivilPopulation.count(p.cohorts),0));
    eq('cellar',c.expedition?.sites?.cellar?.state==='joined'?0:3);
    eq('patients',(c.frontier?.patients||[]).filter(p=>p.diedAt===null&&p.recoveredAt===null).length);
    for(const [id,n]of Object.entries(c.city?.wards||{}))eq('ward_'+id,CivilPopulation.count(n.cohorts));
    if(c.cityNetwork?.node)eq('city_ridge',CivilPopulation.count(c.cityNetwork.node.cohorts));
    if(c.cityCouncil?.locals.bridge?.node)eq('city_bridge',CivilPopulation.count(c.cityCouncil.locals.bridge.node.cohorts));
    if(c.cityCouncil?.locals.estuary?.node)eq('city_estuary',CivilPopulation.count(c.cityCouncil.locals.estuary.node.cohorts));
    if(c.conurbation?.node)eq('city_lake',CivilPopulation.count(c.conurbation.node.cohorts));
  }
};
