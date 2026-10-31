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
function depart(h,mode='convoy',max=8){
  const q=h.o.quoteParty(h.s,'river_network',max,{mode});if(!q)return null;
  const u=h.s.civilization.urban,id=u.nextParty++;assert.equal(h.o.commitDeparture(h.s,q,id),true);
  const party={id,source:'river_network',target:'home',cohorts:q.cohorts.map(c=>({...c})),state:'outbound',remaining:120};
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
