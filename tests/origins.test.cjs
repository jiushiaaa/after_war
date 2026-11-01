const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function harness(){
  const s={game:{population:0,workers:{},buildings:{}},stores:{food:6000,knowledge:100},civilization:{elapsed:0,urban:{registered:true,source:[],year:0,nextParty:1,parties:[],admitted:480,deceased:0},village:{riverKnown:true}}};
  const messages=[],ctx=vm.createContext({State:s,Civilization:{notify:x=>messages.push(x)},CivilRules:{pay:(s,cost)=>{if(Object.entries(cost).some(([k,v])=>(s.stores[k]||0)<v))return false;for(const [k,v]of Object.entries(cost))s.stores[k]-=v;return true;}}});
  for(const file of ['src/postwar/population.js','content/origins.js','src/postwar/origins.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
  const o=ctx.CivilOrigins;o.init(s);return {s,o,p:ctx.CivilPopulation,n:s.civilization.origins.nodes.river_network,ctx,messages};
}
function tick(h,seconds){for(let i=0;i<seconds;i++){h.s.civilization.elapsed++;if(h.s.civilization.elapsed%10===0)h.o.settle(h.s);h.s.civilization.urban.year=Math.floor(h.s.civilization.elapsed/600);h.o.tick(h.s);}}
function contact(h,agree=false){assert.equal(h.o.beginContact(h.s),true);tick(h,240);if(agree)assert.equal(h.o.agree(h.s),true);return h;}
function municipal(h){
  h.s.civilization.municipal={nodes:{river:{admitted:0},rail:{admitted:0}}};
  h.s.civilization.regions={nodes:{river:{relation:'associated',population:60},rail:{relation:'integrated',population:32}}};
  h.ctx.CivilMunicipal={has:(s,id)=>Object.hasOwn(s.civilization.municipal.nodes,id),canAccept:(s,id)=>['associated','integrated'].includes(s.civilization.regions.nodes[id]?.relation)};
  return h;
}
function depart(h,mode='convoy',max=8,target='home'){
  const q=h.o.quoteParty(h.s,'river_network',max,{mode});if(!q)return null;
  const u=h.s.civilization.urban,id=u.nextParty++;assert.equal(h.o.commitDeparture(h.s,q,id,target),true);
  const party={id,source:'river_network',target,cohorts:q.cohorts.map(c=>({...c})),state:'outbound',remaining:120};
  if(mode==='convoy')u.parties.push(party);return party;
}
function admit(h,party){assert.equal(h.o.recordArrival(h.s,party),true);if(party.state){party.cohorts=[];party.state='returning';}return party;}
function advanceYears(h,years){for(let i=0;i<years*60;i++){h.s.civilization.elapsed+=10;h.o.settle(h.s);h.s.civilization.urban.year=Math.floor(h.s.civilization.elapsed/600);h.o.tick(h.s);}}
test('one finite source is introduced once without changing the old 480 ledger, home stores or population',()=>{
  const h=harness(),{s,o,n,p}=h;assert.equal(n.population,1800);assert.equal(p.count(n.cohorts),1800);assert.equal(n.cohorts.length,160);
  const before=JSON.stringify(s);o.init(s);assert.equal(JSON.stringify(s),before);assert.doesNotThrow(()=>o.validate(s));
  const home=JSON.stringify([s.game,s.stores,s.civilization.urban]);o.settle(s);assert.equal(JSON.stringify([s.game,s.stores,s.civilization.urban]),home);
  for(const value of [null,false,0]){const bad=structuredClone(s);bad.civilization.origins=value;o.init(bad);assert.equal(bad.civilization.origins,value);assert.throws(()=>o.validate(bad));}
  const legacy=structuredClone(s);delete legacy.civilization.origins;assert.doesNotThrow(()=>o.validate(legacy));
});
test('contact uses two actual source staff and prepaid source food/tools even when the home has no working adults',()=>{
  const h=harness(),{s,o,n}=h,home=JSON.stringify([s.stores,s.game,s.civilization.urban]),stock={...n.stores};
  assert.equal(o.beginContact(s),true);assert.equal(stock.food-n.stores.food,12);assert.equal(stock.tools-n.stores.tools,1);assert.equal(o.sourceStaff(s,'river_network'),2);assert.equal(o.reservedLabor(s),0);assert.equal(o.beginContact(s),false);
  tick(h,239);assert.equal(n.status,'contacting');assert.equal(o.quoteParty(s,'river_network',1,{mode:'singleton'}),null);tick(h,1);
  assert.equal(n.status,'contacted');assert.equal(o.sourceStaff(s,'river_network'),0);assert.equal(JSON.stringify([s.stores,s.game,s.civilization.urban]),home);
  assert.equal(o.quoteParty(s,'river_network',1,{mode:'singleton'}).count,1);assert.equal(o.quoteParty(s,'river_network',8,{mode:'convoy'}),null);
  assert.equal(o.nextEvent(s),'originContact');assert.doesNotThrow(()=>o.validate(s));
});
test('contact cannot invent crew or supplies and the batch agreement charges its actual one-time knowledge fee',()=>{
  const h=harness(),{s,o,n}=h;n.stores.tools=0;assert.equal(o.beginContact(s),false);n.stores.tools=1;contact(h);
  s.stores.knowledge=19;assert.equal(o.agree(s),false);assert.equal(s.stores.knowledge,19);s.stores.knowledge=20;assert.equal(o.agree(s),true);assert.equal(s.stores.knowledge,0);assert.equal(o.agree(s),false);assert.equal(s.stores.knowledge,0);
});
test('quote is read-only, retains actual cohorts, and stale or forged commitments are atomic failures',()=>{
  const h=contact(harness(),true),{s,o,n}=h,before=JSON.stringify(s),q=o.quoteParty(s,'river_network',8,{mode:'convoy'});
  assert.equal(JSON.stringify(s),before);assert.equal(q.count,8);assert.equal(q.cohorts.filter(c=>c.age<18).reduce((sum,c)=>sum+c.count,0),2);assert.ok(q.cohorts.some(c=>c.age>=65));
  const bad=structuredClone(q);bad.cohorts[0].age=0;assert.equal(o.commitDeparture(s,bad,1),false);assert.equal(JSON.stringify(s),before);
  const party=depart(h);assert.equal(n.population,1792);assert.equal(o.commitDeparture(s,q,2),false);assert.equal(o.commitDeparture(s,q,1),false);assert.equal(o.inTransit(n),8);assert.doesNotThrow(()=>o.validate(s));
  assert.equal(party.cohorts.reduce((sum,c)=>sum+c.count,0),8);
});
test('arrival and return settle source ledgers only once and do not grant home residents or refund fares',()=>{
  const h=contact(harness(),true),{s,o,n}=h,home=JSON.stringify([s.game,s.stores]),party=depart(h);
  assert.equal(o.recordArrival(s,party),true);assert.equal(o.recordArrival(s,party),false);assert.equal(o.returnPeople(s,party),false);assert.equal(n.admitted,8);assert.equal(JSON.stringify([s.game,s.stores]),home);
  party.state='returning';party.cohorts=[];assert.doesNotThrow(()=>o.validate(s));s.civilization.urban.parties=[];
  const returning=depart(h);assert.equal(o.returnPeople(s,returning),true);assert.equal(o.returnPeople(s,returning),false);assert.equal(o.recordArrival(s,returning),false);s.civilization.urban.parties=[];
  assert.equal(n.population,1792);assert.equal(o.remaining(s,'river_network'),1072);assert.equal(JSON.stringify([s.game,s.stores]),home);assert.doesNotThrow(()=>o.validate(s));
});
test('a singleton has a real departure receipt but no persistent travel party after its atomic arrival',()=>{
  const h=contact(harness()),{s,o,n}=h,p=depart(h,'singleton',1);assert.equal(o.recordArrival(s,p),true);assert.equal(n.admitted,1);assert.equal(s.game.population,0);assert.equal(s.civilization.urban.parties.length,0);assert.doesNotThrow(()=>o.validate(s));
});
test('regional departures require an agreed destination at commitment without changing the source quote or charging stores',()=>{
  const h=contact(municipal(harness()),true),{s,o,n}=h,q=o.quoteParty(s,'river_network',8,{mode:'convoy'}),before=JSON.stringify(s);
  for(const target of [null,false,0,'','unknown','river_network']){assert.equal(o.commitDeparture(s,q,1,target),false);assert.equal(JSON.stringify(s),before);}
  s.civilization.regions.nodes.river.relation='trade';const inactive=JSON.stringify(s);assert.equal(o.commitDeparture(s,q,1,'river'),false);assert.equal(JSON.stringify(s),inactive);
  const singleton=o.quoteParty(s,'river_network',1,{mode:'singleton'});assert.equal(o.commitDeparture(s,singleton,1,'rail'),false);assert.equal(JSON.stringify(s),inactive);
  s.civilization.regions.nodes.river.relation='associated';const stock=JSON.stringify(s.stores),party=depart(h,'convoy',8,'river');
  assert.equal(n.departures.p1.target,'river');assert.equal(n.population,1792);assert.equal(JSON.stringify(s.stores),stock);assert.equal(party.target,'river');assert.doesNotThrow(()=>o.validate(s));
  const withoutModule=contact(harness(),true),quote=withoutModule.o.quoteParty(withoutModule.s,'river_network',8,{mode:'convoy'}),snapshot=JSON.stringify(withoutModule.s);
  assert.equal(withoutModule.o.commitDeparture(withoutModule.s,quote,1,'river'),false);assert.equal(JSON.stringify(withoutModule.s),snapshot);
});
test('regional arrivals count the source boundary once without writing home or destination residents and cannot be redirected',()=>{
  const h=contact(municipal(harness()),true),{s,o,n}=h,party=depart(h,'convoy',8,'river'),before=JSON.stringify(s),local=JSON.stringify([s.game,s.stores,s.civilization.regions,s.civilization.municipal]);
  for(const target of ['home','rail']){const diverted={...party,target};assert.equal(o.recordArrival(s,diverted),false);assert.equal(o.returnPeople(s,diverted),false);assert.equal(JSON.stringify(s),before);}
  assert.equal(o.recordArrival(s,party),true);assert.equal(n.admitted,8);assert.equal(o.recordArrival(s,party),false);assert.equal(o.returnPeople(s,party),false);assert.equal(JSON.stringify([s.game,s.stores,s.civilization.regions,s.civilization.municipal]),local);
  party.cohorts=[];party.state='returning';assert.doesNotThrow(()=>o.validate(s));
  const wrong=structuredClone(s);wrong.civilization.urban.parties[0].target='rail';assert.throws(()=>o.validate(wrong));
  s.civilization.urban.parties=[];assert.doesNotThrow(()=>o.validate(s));assert.equal(n.admitted,8);
});
test('a regional party ages once and returns living passengers to its source after destination eligibility is lost',()=>{
  const h=contact(municipal(harness()),true),{s,o,n,p}=h;n.cohorts.sort((a,b)=>(b.age===79)-(a.age===79));const party=depart(h,'convoy',8,'river');
  s.civilization.regions.nodes.river.relation='trade';s.civilization.elapsed=600;o.annual(s,'river_network');s.civilization.urban.year=1;
  const aged=p.age(party.cohorts),before=JSON.stringify(s);assert.equal(aged.deceased,1);assert.equal(o.recordTransitDeath(s,{...party,target:'rail'},1),false);assert.equal(JSON.stringify(s),before);
  assert.equal(o.recordTransitDeath(s,party,1),true);party.cohorts=aged.cohorts;party.state='returning_people';assert.doesNotThrow(()=>o.validate(s));
  const population=n.population,local=JSON.stringify([s.game,s.stores,s.civilization.regions,s.civilization.municipal]);
  assert.equal(o.returnPeople(s,party),true);assert.equal(n.population,population+7);assert.equal(n.transitDeaths,1);assert.equal(n.admitted,0);assert.equal(n.departures.p1.target,'river');assert.equal(party.target,'river');assert.equal(o.returnPeople(s,party),false);
  assert.equal(JSON.stringify([s.game,s.stores,s.civilization.regions,s.civilization.municipal]),local);s.civilization.urban.parties=[];assert.doesNotThrow(()=>o.validate(s));assert.equal(o.remaining(s,'river_network'),1079);
});
test('imports reject explicit invalid or mismatched destinations but accept historical municipal receipts during service loss',()=>{
  const h=contact(municipal(harness()),true),{s,o}=h;depart(h,'convoy',8,'river');
  for(const target of [null,false,0,'','unknown','river_network','home','rail']){const bad=structuredClone(s);bad.civilization.origins.nodes.river_network.departures.p1.target=target;assert.throws(()=>o.validate(bad));}
  const missing=structuredClone(s);delete missing.civilization.origins.nodes.river_network.departures.p1.target;assert.throws(()=>o.validate(missing),'legacy home receipt cannot bind regional passengers');
  s.civilization.regions.nodes.river.relation='trade';assert.doesNotThrow(()=>o.validate(s));const saved=JSON.parse(JSON.stringify(s)),before=JSON.stringify(saved);o.init(saved);assert.equal(JSON.stringify(saved),before);assert.doesNotThrow(()=>o.validate(saved));
});
test('the natural 508-resident save accepts missing home targets and migrates only destination receipts once',()=>{
  const {o}=harness(),s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-origin-migration.json'),'utf8')).state,expected=structuredClone(s);
  assert.equal(s.game.population,508);assert.doesNotThrow(()=>o.validate(s));
  for(const d of Object.values(expected.civilization.origins.nodes.river_network.departures))d.target='home';
  expected.civilization.origins.nodes.river_network.schooling={schema:1,completed:[],project:null};
  expected.civilization.origins.nodes.river_network.legacyHousingOverflow=0;
  o.init(s);assert.deepEqual(JSON.parse(JSON.stringify(s)),expected);assert.doesNotThrow(()=>o.validate(s));const before=JSON.stringify(s);o.init(s);assert.equal(JSON.stringify(s),before);
  const restored=JSON.parse(JSON.stringify(s));o.init(restored);assert.equal(JSON.stringify(restored),before);assert.doesNotThrow(()=>o.validate(restored));
  const legacy=structuredClone(s);for(const d of Object.values(legacy.civilization.origins.nodes.river_network.departures))delete d.target;
  const party=legacy.civilization.urban.parties.find(p=>p.state==='outbound');assert.equal(o.recordArrival(legacy,party),true);party.cohorts=[];party.state='returning';assert.equal(legacy.game.population,508);assert.equal(legacy.civilization.origins.nodes.river_network.admitted,20);assert.doesNotThrow(()=>o.validate(legacy));
});
test('old ages are aged by Urban exactly once; equal death counts in successive years have separate receipts',()=>{
  const h=contact(harness(),true),{s,o,n,p}=h;
  n.cohorts.sort((a,b)=>(b.age===79)-(a.age===79));const first=depart(h);n.cohorts.sort((a,b)=>(b.age===78)-(a.age===78));const second=depart(h);
  for(let year=1;year<=2;year++){
    s.civilization.elapsed=year*600;o.annual(s,'river_network');s.civilization.urban.year=year;
    for(const party of [first,second]){const aged=p.age(party.cohorts);if(aged.deceased){assert.equal(o.recordTransitDeath(s,party,aged.deceased),true);assert.equal(o.recordTransitDeath(s,party,aged.deceased),false);}party.cohorts=aged.cohorts;}
    assert.doesNotThrow(()=>o.validate(s));
  }
  assert.equal(n.transitDeaths,2);admit(h,first);admit(h,second);assert.equal(n.admitted,14);assert.doesNotThrow(()=>o.validate(s));
});
test('imports reject missing, duplicate and fabricated parties and mismatching age, identity or cohort ID',()=>{
  const h=contact(harness(),true),{s,o}=h;depart(h);assert.doesNotThrow(()=>o.validate(s));
  const mutations=[x=>x.civilization.urban.parties=[],x=>x.civilization.urban.parties.push({...x.civilization.urban.parties[0]}),x=>x.civilization.urban.parties[0].cohorts[0].age++,x=>x.civilization.urban.parties[0].cohorts[0].identity='mutant',x=>x.civilization.urban.parties[0].cohorts[0].cohortId='fabricated',x=>x.civilization.urban.parties[0].id=999,x=>x.civilization.urban.nextParty=1,x=>x.civilization.origins.nodes.river_network.departures.p1.status='arrived'];
  for(const mutate of mutations){const bad=structuredClone(s);mutate(bad);assert.throws(()=>o.validate(bad));}
  const saved=JSON.parse(JSON.stringify(s)),before=JSON.stringify(saved);o.init(saved);assert.equal(JSON.stringify(saved),before);assert.doesNotThrow(()=>o.validate(saved));
});
test('a nominally balanced forged traveller is rejected by immutable departure ages, including empty parties',()=>{
  const h=contact(harness(),true),{s,o}=h;const party=depart(h);const bad=structuredClone(party);bad.cohorts[0].age=30;assert.equal(o.recordArrival(s,bad),false);assert.equal(o.returnPeople(s,bad),false);
  const saved=structuredClone(s);saved.civilization.urban.parties[0].cohorts=[];assert.throws(()=>o.validate(saved));
  const orphan=structuredClone(s);delete orphan.civilization.origins.nodes.river_network.departures.p1;orphan.civilization.origins.nodes.river_network.population+=8;orphan.civilization.origins.nodes.river_network.cohorts[0].count+=8;assert.throws(()=>o.validate(orphan));
});
test('a party whose real passengers all age out retains its empty travel receipt and accepts each annual death once',()=>{
  const h=contact(harness(),true),{s,o,n,p}=h,party=depart(h),counts=[];
  for(let year=1;year<=80;year++){
    s.civilization.elapsed=year*600;o.annual(s,'river_network');s.civilization.urban.year=year;
    const aged=p.age(party.cohorts);if(aged.deceased){counts.push(aged.deceased);assert.equal(o.recordTransitDeath(s,party,aged.deceased),true);assert.equal(o.recordTransitDeath(s,party,aged.deceased),false);}party.cohorts=aged.cohorts;
    assert.doesNotThrow(()=>o.validate(s));
  }
  assert.ok(counts.filter(n=>n===2).length>=2);assert.equal(p.count(party.cohorts),0);assert.equal(n.transitDeaths,8);assert.equal(o.inTransit(n),0);
  const lost=structuredClone(s);lost.civilization.urban.parties=[];assert.throws(()=>o.validate(lost));admit(h,party);assert.equal(n.admitted,0);assert.doesNotThrow(()=>o.validate(s));
});
test('adult-only selection coalesces repeated pulls from the same cohort into a valid unique-ID quote',()=>{
  const {o,n}=harness(),adults=n.cohorts.filter(c=>c.age>=18&&c.age<=49),choice=o.choose(adults,8,'convoy');
  assert.equal(choice.selected.reduce((sum,c)=>sum+c.count,0),8);assert.equal(new Set(choice.selected.map(c=>c.cohortId)).size,choice.selected.length);
});
test('stale years cannot replay source births, aging, or introduction during import',()=>{
  const h=harness();advanceYears(h,2);for(const mutate of [x=>x.nodes.river_network.year--,x=>x.nodes.river_network.year++,x=>x.introducedAt=h.s.civilization.elapsed+1]){
    const bad=structuredClone(h.s);mutate(bad.civilization.origins);assert.throws(()=>h.o.validate(bad));
  }
});
test('singleton extraction stops at fertility-band floors, then the remaining society can self-supply for a century',()=>{
  const h=contact(harness()),{s,o,n,p}=h;let taken=0,party;
  while((party=depart(h,'singleton',1))){assert.equal(o.recordArrival(s,party),true);taken++;assert.ok(taken<=1080);}
  assert.equal(taken,435);assert.equal(n.population,1365);
  for(const band of h.ctx.CivilOriginContent.river_network.fertilityBands)assert.equal(p.count(n.cohorts.filter(c=>c.age>=band.min&&c.age<=band.max)),band.retained);
  const born=n.born;advanceYears(h,100);assert.ok(n.born>born);assert.ok(n.sourceDeaths>0);assert.ok(n.population>=720);assert.ok(p.workforce(n.cohorts)>200);assert.ok(n.health>=60);assert.equal(n.hunger,0);assert.equal(n.admitted,435);assert.doesNotThrow(()=>o.validate(s));
  assert.ok(o.quoteParty(s,'river_network',1,{mode:'singleton'}),'later real births mature into new eligible residents');
});
test('1080 family emigrations preserve 720 actual residents and paid generational recovery without renewed permits',()=>{
  const h=contact(harness(),true),{s,o,n,p}=h;let taken=0,party;
  while((party=depart(h))){taken+=p.count(party.cohorts);admit(h,party);s.civilization.urban.parties=[];assert.ok(taken<=1080);}
  assert.equal(taken,1080);assert.equal(n.population,720);assert.equal(o.remaining(s,'river_network'),0);assert.ok(p.count(n.cohorts.filter(c=>c.age>=18&&c.age<=49))>=291);assert.doesNotThrow(()=>o.validate(s));
  advanceYears(h,100);assert.ok(n.population>=720);assert.ok(n.health>=60);assert.equal(n.hunger,0);assert.ok(n.born>1080);assert.equal(n.admitted,1080);assert.equal(o.remaining(s,'river_network'),0);assert.equal(o.quoteParty(s,'river_network',1,{mode:'singleton'}),null);assert.doesNotThrow(()=>o.validate(s));
});
test('a century before contact retains a living census rather than silently refreshing initial adults',()=>{
  const h=harness(),{s,o,n}=h;advanceYears(h,100);assert.ok(n.born>1800);assert.ok(n.sourceDeaths>=1800);assert.ok(n.population>=720);assert.ok(n.cohorts.every(c=>c.cohortId.includes('_born_')));assert.equal(o.beginContact(s),true);tick(h,240);assert.ok(o.quoteParty(s,'river_network',1,{mode:'singleton'}));assert.doesNotThrow(()=>o.validate(s));
});
function crowdedSchool(){
  const h=contact(harness(),true),{n,o,s}=h;
  n.cohorts=[{age:8,count:822},{age:24,count:276},{age:35,count:221},{age:45,count:227},{age:55,count:327},{age:70,count:327}].map((c,i)=>({...c,identity:'human',originId:'river_network',cohortId:'river_network_school_'+i}));
  n.population=2200;n.born=400;n.health=100;n.hunger=0;for(const key of Object.keys(n.stores))n.stores[key]=10000;o.assign(s,'river_network');return h;
}
test('every convoy seat limit from one through eight preserves positive integer cohorts and exact source conservation',()=>{
  for(let limit=1;limit<=8;limit++){
    const h=contact(harness(),true),{s,o,n,p}=h,before=JSON.stringify(n.cohorts),choice=o.choose(n.cohorts,limit,'convoy');
    assert.equal(JSON.stringify(n.cohorts),before);assert.equal(p.count(choice.selected),limit);assert.equal(p.count(choice.selected)+p.count(choice.remaining),n.population);
    assert.ok([...choice.selected,...choice.remaining].every(c=>Number.isInteger(c.count)&&c.count>0));
    for(const cohort of n.cohorts)assert.equal([...choice.selected,...choice.remaining].filter(c=>c.cohortId===cohort.cohortId).reduce((sum,c)=>sum+c.count,0),cohort.count);
    const quote=o.quoteParty(s,'river_network',limit,{mode:'convoy'});assert.equal(quote.count,limit);assert.equal(o.quoteReason(s,'river_network',limit,{mode:'convoy'}),null);
    const party=depart(h,'convoy',limit);assert.equal(p.count(party.cohorts),limit);assert.doesNotThrow(()=>o.validate(s));
  }
});
test('822 real children expose the exact teacher shortage, then source-paid expansion restores migration after 180 actual work seconds',()=>{
  const h=crowdedSchool(),{s,o,n}=h,home=JSON.stringify([s.game,s.stores,s.civilization.urban]),people=JSON.stringify(n.cohorts),stock={...n.stores};
  assert.equal(n.workers.teacher,40);assert.equal(o.quoteParty(s,'river_network',8,{mode:'convoy'}),null);assert.match(o.quoteReason(s,'river_network',8,{mode:'convoy'}),/40.*820.*41/);
  const before=JSON.stringify(s);o.quoteReason(s,'river_network',1,{mode:'singleton'});assert.equal(JSON.stringify(s),before);
  assert.equal(o.startSchool(s,'river_network'),true);assert.equal(stock.wood-n.stores.wood,120);assert.equal(stock.tools-n.stores.tools,12);assert.equal(stock.knowledge-n.stores.knowledge,20);assert.equal(o.sourceStaff(s,'river_network'),2);assert.equal(JSON.stringify(n.cohorts),people);
  const paid=JSON.stringify(n.stores);assert.equal(o.startSchool(s,'river_network'),false);assert.equal(JSON.stringify(n.stores),paid);assert.match(o.quoteReason(s,'river_network',8,{mode:'convoy'}),/180秒/);
  tick(h,179);assert.equal(o.schoolCapacity(s,'river_network'),40);assert.equal(n.schooling.project.remaining,1);tick(h,1);
  assert.equal(o.schoolCapacity(s,'river_network'),50);assert.equal(n.schooling.project,null);assert.equal(n.workers.teacher,42);assert.equal(o.sourceStaff(s,'river_network'),0);assert.equal(o.quoteParty(s,'river_network',8,{mode:'convoy'}).count,8);assert.equal(o.quoteReason(s,'river_network',8,{mode:'convoy'}),null);
  assert.equal(JSON.stringify(n.cohorts),people);assert.equal(JSON.stringify([s.game,s.stores,s.civilization.urban]),home);assert.doesNotThrow(()=>o.validate(s));
});
test('source schools wait for their own materials, spare adults and reserves, and retirement pauses a paid project without a refund',()=>{
  const h=crowdedSchool(),{s,o,n}=h;n.stores.tools=11;const noTools=JSON.stringify(n.stores);assert.equal(o.startSchool(s,'river_network'),false);assert.equal(JSON.stringify(n.stores),noTools);assert.match(o.schoolStatus(s,'river_network'),/工具12/);
  n.stores.tools=12;n.stores.food=0;assert.equal(o.startSchool(s,'river_network'),false);assert.match(o.schoolStatus(s,'river_network'),/120秒粮药/);
  n.stores.food=10000;assert.equal(o.startSchool(s,'river_network'),true);const p=n.schooling.project,stock=JSON.stringify(n.stores),saved=n.cohorts.map(c=>({...c}));n.cohorts.forEach(c=>c.age=70);
  s.civilization.elapsed++;o.tickSchool(s,'river_network');assert.equal(p.remaining,180);assert.equal(o.schoolBuilders(s,'river_network'),0);assert.equal(JSON.stringify(n.stores),stock);
  n.cohorts=saved;s.civilization.elapsed++;o.tickSchool(s,'river_network');assert.equal(p.remaining,179);const once=JSON.stringify(s);o.tickSchool(s,'river_network');assert.equal(JSON.stringify(s),once);
});
test('school migration is idempotent and partial construction survives reload; explicit corruption is rejected rather than reset',()=>{
  const h=crowdedSchool(),{s,o,n}=h;delete n.schooling;const old=JSON.stringify([n.cohorts,n.stores,n.births,n.born,n.sourceDeaths]);assert.doesNotThrow(()=>o.validate(s));o.init(s);assert.equal(o.schoolCapacity(s,'river_network'),40);assert.equal(JSON.stringify([n.cohorts,n.stores,n.births,n.born,n.sourceDeaths]),old);
  o.startSchool(s,'river_network');tick(h,37);const loaded=JSON.parse(JSON.stringify(s)),before=JSON.stringify(loaded);o.init(loaded);o.tickSchool(loaded,'river_network');assert.equal(JSON.stringify(loaded),before);assert.doesNotThrow(()=>o.validate(loaded));
  for(const mutate of [x=>x.schooling=null,x=>x.schooling.completed.push({startedAt:0,completedAt:1,paid:{wood:120,tools:12,knowledge:20}}),x=>x.schooling.project.paid.tools--,x=>x.schooling.project.remaining=0,x=>x.schooling.project.lastWorkedAt=s.civilization.elapsed+1]){const bad=structuredClone(s);mutate(bad.civilization.origins.nodes.river_network);o.init(bad);assert.throws(()=>o.validate(bad));}
});
test('school expansion has a finite paid cap matching source housing, and quota or fertility reasons remain distinct from teaching',()=>{
  const h=crowdedSchool(),{s,o,n,ctx}=h,cfg=ctx.CivilOriginContent.river_network.school;
  n.cohorts=[{age:5,count:1800,identity:'human',originId:'river_network',cohortId:'river_network_school_children'},{age:25,count:400,identity:'human',originId:'river_network',cohortId:'river_network_school_adults'}];o.assign(s,'river_network');
  assert.equal(o.startSchool(s,'river_network'),false,'400 adults cannot staff production, classrooms and builders');
  n.schooling.completed=Array.from({length:cfg.max},(_,i)=>({startedAt:i*180,completedAt:(i+1)*180,paid:{...cfg.cost}}));assert.equal(o.schoolCapacity(s,'river_network'),110);assert.equal(o.startSchool(s,'river_network'),false);assert.equal(o.schoolCapacity(s,'river_network')*20,n.housing);
  const untouched=contact(harness(),true);untouched.n.permit.limit=0;assert.match(untouched.o.quoteReason(untouched.s,'river_network',8,{mode:'convoy'}),/额度/);
});

function fullSource(){
  const h=contact(harness(),true);advanceYears(h,15);assert.equal(h.n.population,h.n.housing);return h;
}
function ageSourceAndPassengers(h){
  const {s,o,p}=h;s.civilization.elapsed=(h.n.year+1)*600;o.annual(s,'river_network');s.civilization.urban.year=h.n.year;
  for(const party of s.civilization.urban.parties){const aged=p.age(party.cohorts);if(aged.deceased)assert.equal(o.recordTransitDeath(s,party,aged.deceased),true);party.cohorts=aged.cohorts;}
}
function urbanJourney(h){
  // Only destination capacity is supplied by the harness; travel, waiting, annual passenger
  // aging and the return receipt are the real Urban controller, with source births first.
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/postwar/urban.js'),'utf8'),h.ctx,{filename:'src/postwar/urban.js'});
  h.ctx.CivilCatalog={capacity:()=>0};const u=h.s.civilization.urban;u.enabled=false;u.dispatchClock=0;
  for(const party of u.parties){party.heldFor=0;party.rations=48;}
  return seconds=>{for(let i=0;i<seconds;i++){h.s.civilization.elapsed++;h.o.tick(h.s);h.ctx.CivilUrban.tick(h.s);}};
}
function oldBirthsFillVacantBeds(h){
  // Reconstruct the pre-fix annual rule using its real birth helper and payment. This
  // deliberately omits travel reservations, as existing schema-1 saves could do.
  const {s,o,n,p}=h,birth=p.births(n.cohorts,n.births,{yearStartPopulation:n.population,beds:n.housing-n.population,health:n.health,hunger:n.hunger,food:n.stores.food,medicine:n.stores.medicine});
  assert.equal(o.pay(n.stores,birth.cost),true);
  for(const c of birth.cohorts)n.cohorts.push({...c,cohortId:'river_network_legacy_birth_'+n.year+'_'+c.identity,originId:'river_network'});
  n.born+=birth.count;n.population+=birth.count;delete n.legacyHousingOverflow;o.assign(s,'river_network');return birth.count;
}
test('a full source preserves return beds across a real Urban year, destination wait and passenger return',()=>{
  const h=fullSource(),{s,o,n,p}=h;s.civilization.elapsed=(n.year+1)*600-10;
  const quote=o.quoteParty(s,'river_network',8,{mode:'convoy'});s.stores.medicine=100;s.stores.tools=100;assert.equal(h.ctx.CivilRules.pay(s,quote.cost),true);
  const home=JSON.stringify([s.game,s.stores]),party=depart(h),people=structuredClone(party.cohorts),born=n.born,deaths=n.sourceDeaths;
  assert.equal(n.population,2192);assert.equal(o.reservedBeds(s,'river_network'),8);assert.equal(o.availableBeds(s,'river_network'),0);
  const step=urbanJourney(h);step(10);
  assert.equal(n.population,2192);assert.equal(n.born-born,n.sourceDeaths-deaths);assert.equal(o.reservedBeds(s,'river_network'),8);assert.equal(o.availableBeds(s,'river_network'),0);assert.equal(n.legacyHousingOverflow,0);
  assert.deepEqual(JSON.parse(JSON.stringify(party.cohorts)),people.map(c=>({...c,age:c.age+1})));assert.doesNotThrow(()=>o.validate(s));
  step(110);assert.equal(party.state,'held');assert.equal(o.reservedBeds(s,'river_network'),8);
  step(120);assert.equal(party.state,'returning_people');assert.equal(o.reservedBeds(s,'river_network'),8);
  step(120);assert.equal(s.civilization.urban.parties.length,0);assert.equal(n.departures['p'+party.id].status,'returned');assert.equal(n.population,2200);assert.equal(p.count(n.cohorts),2200);assert.equal(o.reservedBeds(s,'river_network'),0);assert.equal(o.availableBeds(s,'river_network'),0);
  assert.equal(JSON.stringify([s.game,s.stores]),home);assert.equal(o.returnPeople(s,party),false);assert.equal(n.housing,2200);assert.doesNotThrow(()=>o.validate(s));
});
test('only an actual passenger death releases its source bed and empty return vehicles reserve no beds',()=>{
  const h=fullSource(),{s,o,n,p}=h;n.cohorts.sort((a,b)=>(b.age===79)-(a.age===79));const party=depart(h);
  s.civilization.elapsed=(n.year+1)*600;o.annual(s,'river_network');s.civilization.urban.year=n.year;
  const aged=p.age(party.cohorts);assert.equal(aged.deceased,1);assert.equal(o.reservedBeds(s,'river_network'),8);assert.equal(o.availableBeds(s,'river_network'),0);
  assert.equal(o.recordTransitDeath(s,party,1),true);assert.equal(o.reservedBeds(s,'river_network'),7);assert.equal(o.availableBeds(s,'river_network'),1);
  assert.equal(o.recordTransitDeath(s,party,1),false);assert.equal(o.availableBeds(s,'river_network'),1);party.cohorts=aged.cohorts;
  const born=n.born;o.annual(s,'river_network');assert.equal(n.born,born,'no retroactive births in the same year');assert.doesNotThrow(()=>o.validate(s));
  admit(h,party);assert.equal(party.state,'returning');assert.equal(o.reservedBeds(s,'river_network'),0);assert.equal(o.availableBeds(s,'river_network'),8);assert.equal(n.admitted,7);assert.equal(n.transitDeaths,1);assert.doesNotThrow(()=>o.validate(s));
});
test('old overbooked saves return every real resident, then extinguish housing debt without reusing it',()=>{
  const h=fullSource(),{s,o,n}=h,party=depart(h);ageSourceAndPassengers(h);assert.equal(oldBirthsFillVacantBeds(h),8);
  assert.equal(n.population,2200);assert.equal(o.inTransit(n),8);assert.doesNotThrow(()=>o.validate(s));const assets=JSON.stringify([n.cohorts,n.stores,n.births,n.born,n.departures]);
  const notLegacy=structuredClone(s);notLegacy.civilization.origins.nodes.river_network.legacyHousingOverflow=0;assert.throws(()=>o.validate(notLegacy),'a new save cannot overbook even when its people ledger balances');
  o.init(s);assert.equal(n.legacyHousingOverflow,8);assert.equal(JSON.stringify([n.cohorts,n.stores,n.births,n.born,n.departures]),assets);const migrated=JSON.stringify(s);o.init(s);assert.equal(JSON.stringify(s),migrated);assert.doesNotThrow(()=>o.validate(s));
  const loaded=JSON.parse(migrated);o.init(loaded);assert.equal(JSON.stringify(loaded),migrated);assert.doesNotThrow(()=>o.validate(loaded));
  party.state='returning_people';party.remaining=1;urbanJourney(h)(1);assert.equal(n.population,2208);assert.equal(n.legacyHousingOverflow,8);assert.equal(n.housing,2200);assert.equal(o.availableBeds(s,'river_network'),0);assert.equal(s.civilization.urban.parties.length,0);assert.doesNotThrow(()=>o.validate(s));
  const born=n.born,deaths=n.sourceDeaths;ageSourceAndPassengers(h);assert.equal(n.legacyHousingOverflow,0);assert.equal(n.population,2200);assert.equal(n.born-born,n.sourceDeaths-deaths-8);assert.doesNotThrow(()=>o.validate(s));
  const next=depart(h);ageSourceAndPassengers(h);assert.equal(n.population,2192);assert.equal(n.legacyHousingOverflow,0);assert.equal(o.availableBeds(s,'river_network'),0);
  assert.equal(o.returnPeople(s,next),true);s.civilization.urban.parties=[];assert.equal(n.population,2200);assert.equal(n.legacyHousingOverflow,0);assert.doesNotThrow(()=>o.validate(s));
  for(const value of [null,false,-1,1,17,NaN]){const bad=structuredClone(s);bad.civilization.origins.nodes.river_network.legacyHousingOverflow=value;o.init(bad);assert.equal(bad.civilization.origins.nodes.river_network.legacyHousingOverflow,value);assert.throws(()=>o.validate(bad));}
});
test('an old save made after overbooked passengers really returned imports without deleting residents or changing housing',()=>{
  const h=fullSource(),{s,o,n}=h,party=depart(h);ageSourceAndPassengers(h);oldBirthsFillVacantBeds(h);
  assert.equal(o.returnPeople(s,party),true);s.civilization.urban.parties=[];assert.equal(n.population,2208);assert.equal(n.legacyHousingOverflow,undefined);assert.equal(n.departures['p'+party.id].status,'returned');
  const saved=JSON.parse(JSON.stringify(s)),expected=structuredClone(saved);assert.doesNotThrow(()=>o.validate(saved));expected.civilization.origins.nodes.river_network.legacyHousingOverflow=8;
  o.init(saved);assert.deepEqual(JSON.parse(JSON.stringify(saved)),expected);assert.doesNotThrow(()=>o.validate(saved));const once=JSON.stringify(saved);o.init(saved);assert.equal(JSON.stringify(saved),once);
  const broken=structuredClone(saved);broken.civilization.origins.nodes.river_network.cohorts[0].count--;assert.throws(()=>o.validate(broken),'legacy capacity does not excuse missing actual people');
  const excessive=structuredClone(saved),x=excessive.civilization.origins.nodes.river_network;delete x.legacyHousingOverflow;x.cohorts[0].count+=9;x.population+=9;x.born+=9;assert.throws(()=>o.validate(excessive),'legacy import never grants more than the two existing eight-seat parties');
  const invented=fullSource(),y=invented.n;delete y.legacyHousingOverflow;y.cohorts[0].count+=8;y.population+=8;y.born+=8;assert.throws(()=>invented.o.validate(invented.s),'an old birth total alone cannot invent a historical return reservation');
});
test('historical housing squeeze shrinks only by living arrivals or actual deaths, never by returning passengers',()=>{
  const h=contact(harness(),true),{s,o,n,p}=h;
  n.cohorts=[{age:78,count:1},{age:10,count:600},{age:25,count:500},{age:35,count:400},{age:45,count:300},{age:55,count:300},{age:69,count:99}].map((c,i)=>({...c,identity:'human',originId:'river_network',cohortId:'river_network_return_'+i}));n.population=2200;n.born=400;n.health=100;for(const key of Object.keys(n.stores))n.stores[key]=10000;o.assign(s,'river_network');
  const first=depart(h),second=depart(h);ageSourceAndPassengers(h);assert.equal(oldBirthsFillVacantBeds(h),16);o.init(s);assert.equal(n.legacyHousingOverflow,16);assert.doesNotThrow(()=>o.validate(s));
  admit(h,second);assert.equal(n.legacyHousingOverflow,8);assert.equal(o.availableBeds(s,'river_network'),0);
  const born=n.born,food=n.stores.food,medicine=n.stores.medicine;s.civilization.elapsed=(n.year+1)*600;o.annual(s,'river_network');s.civilization.urban.year=n.year;
  assert.equal(n.born,born);assert.equal(n.stores.food,food);assert.equal(n.stores.medicine,medicine);assert.equal(n.legacyHousingOverflow,8);
  const aged=p.age(first.cohorts);assert.equal(aged.deceased,1);assert.equal(o.recordTransitDeath(s,first,1),true);first.cohorts=aged.cohorts;assert.equal(n.legacyHousingOverflow,7);assert.equal(o.reservedBeds(s,'river_network'),7);assert.equal(o.availableBeds(s,'river_network'),0);assert.doesNotThrow(()=>o.validate(s));
  assert.equal(o.returnPeople(s,first),true);s.civilization.urban.parties=s.civilization.urban.parties.filter(x=>x!==first);assert.equal(n.population,2207);assert.equal(n.legacyHousingOverflow,7);assert.doesNotThrow(()=>o.validate(s));
});
