const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('content/')||x.startsWith('src/postwar/'));
function harness(saved,initialize=true){
 const s=clone(saved||JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-two-towns.json'),'utf8')).state),notes=[];
 const ctx=vm.createContext({State:s,_:x=>x,TextDecoder,TextEncoder,setTimeout,clearTimeout,Room:{buttons:{}},Outside:{updateVillage(){},updateWorkersView(){}},Events:{},AudioEngine:{},Engine:{saveGame(){}},$SM:{fireUpdate(){}},Notifications:{printMessage:x=>notes.push(x)}});
 for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};if(initialize)ctx.Civilization.initState();
 const h={s,ctx,p:ctx.CivilPassenger,u:ctx.CivilUrban,o:ctx.CivilOrigins,r:ctx.CivilRegions,v:ctx.CivilServices,notes};
 h.step=n=>{for(let i=0;i<n;i++){s.civilization.elapsed++;s.civilization.productionClock++;if(s.civilization.productionClock>=10){s.civilization.productionClock-=10;ctx.Civilization.settleEconomy(s);}for(const name of ['CivilSociety','CivilIndustry','CivilRegions','CivilOrigins','CivilMunicipal','CivilServices','CivilUrban'])ctx[name].tick(s);}};
 return h;
}
function finish(h,type){const {s,v}=h;assert.equal(v.startProject(s,'home',type),true,'start '+type);s.game.workers.servicebuilder=2;const project=v.data(s).project;for(let i=0;i<1000&&project.status!=='complete';i++)h.step(1);assert.equal(project.status,'complete',type);return project;}
const snapshots={};
function ready(assetCount=2){
 if(snapshots[assetCount])return harness(snapshots[assetCount]);
 const h=harness(),{s,ctx}=h,c=s.civilization;c.urban.enabled=false;
 // Declared finite economy fixture, not browser play: preserve the natural census,
 // sources and project ledgers, fund finite stocks, and pay every new facility.
 for(const key of ctx.CivilCatalog.resources)s.stores[key]=50000;
 h.step(240);assert.equal(c.urban.parties.length,0);
 c.tech.passenger_transport=true;
 finish(h,'waterfield');s.game.workers.farmer+=8;
 finish(h,'densehousing');for(let i=0;i<assetCount;i++)finish(h,'passengerfleet');
 s.game.workers.transporter=14;c.urban.activeSource='old_city_fringe';h.u.setTarget(s,'home');c.urban.enabled=false;
 ctx.Civilization.settleEconomy(s);ctx.CivilPlatform.validate(s);snapshots[assetCount]=clone(s);return h;
}
function send(h,source='old_city_fringe',target='home'){const x=h.s.civilization.urban;x.activeSource=source;h.u.setTarget(h.s,target);x.enabled=true;assert.equal(h.u.dispatch(h.s),true,x.status);x.enabled=false;return x.parties.at(-1);}
function valid(h){h.ctx.CivilPlatform.validate(h.s);for(const n of Object.values(h.s.civilization.origins.nodes))assert.equal(n.baselinePopulation+n.born,n.population+n.sourceDeaths+n.transitDeaths+n.admitted+h.o.inTransit(n));}

test('natural old exports gain only passenger metadata; in-flight eight-person records stay byte-for-byte unchanged',()=>{
 const h=harness(undefined,false),{s,p,ctx}=h,before=clone(s),cutoff=s.civilization.urban.nextParty;
 ctx.CivilPlatform.validate(s);p.init(s);const metadata=clone(s.civilization.passenger);delete s.civilization.passenger;assert.deepEqual(s,before);s.civilization.passenger=metadata;
 assert.deepEqual(metadata,{schema:1,introducedAt:48712,legacyBeforePartyId:cutoff,preference:'auto',lastDepartureAt:null,legacyReadyAt:48712+s.civilization.urban.dispatchClock});assert.equal(p.assets(s).length,0);
 const once=JSON.stringify(s);ctx.Civilization.initState();ctx.Civilization.initState();assert.equal(JSON.stringify(s),once);valid(h);
 for(const value of [null,false,[],{schema:2}]){const bad=clone(s);bad.civilization.passenger=value;assert.throws(()=>ctx.CivilPlatform.validate(bad));}
});
test('new transport evidence cannot masquerade as a legacy save by deleting the module',()=>{
 const h=ready();for(const edit of [s=>{s.civilization.tech.passenger_transport=true;},s=>{s.civilization.research={id:'passenger_transport',remaining:20};}]){const s=clone(h.s);delete s.civilization.passenger;edit(s);assert.throws(()=>h.ctx.CivilPlatform.validate(s));assert.throws(()=>h.p.init(s));}
});
test('a paid 24-person family departure conserves source cohorts, all fees and reserved assets through its empty return',()=>{
 const h=ready(),{s,p,u,o}=h,c=s.civilization,before={...s.stores},source=c.origins.nodes.old_city_fringe,people=source.population;
 const q=p.quote(s);assert.equal(q.sourceQuote.count,24);const unchanged=JSON.stringify(s);p.quote(s);assert.equal(JSON.stringify(s),unchanged);
 const party=send(h);assert.equal(party.transport.profile,'road24');assert.equal(party.transport.crew,4);assert.equal(u.count(party.cohorts),24);assert.equal(u.children(party.cohorts),6);assert.equal(party.cohorts.filter(x=>x.age>=65).reduce((sum,x)=>sum+x.count,0),3);
 assert.equal(source.population,people-24);for(const [key,n]of Object.entries(p.cost('road24',24)))near(before[key]-s.stores[key],n);
 assert.equal(o.reservedBeds(s,'old_city_fringe'),24);assert.equal(u.reservedBeds(s),24);assert.equal(u.reservedTransport(s),4);valid(h);
 const asset=party.transport.assetId;h.step(120);assert.equal(party.state,'returning');assert.equal(party.cohorts.length,0);assert.equal(u.reservedBeds(s),0);assert.equal(o.reservedBeds(s,'old_city_fringe'),0);assert.notEqual(p.availableAsset(s).id,asset);valid(h);
 h.step(120);assert.equal(c.urban.parties.length,0);assert.equal(p.availableAsset(s).id,asset);valid(h);
});
test('two paid assets still cannot create a third party',()=>{
 const h=ready(),{s,p,u}=h,c=s.civilization;const first=send(h);h.step(120);
 // One equipment is currently busy; the other remains available for a second large team.
 const second=send(h,'mountain_settlements');assert.equal(second.transport.profile,'road24');assert.notEqual(second.transport.assetId,first.transport.assetId);assert.equal(u.reservedTransport(s),8);
 const before=JSON.stringify([s.stores,c.origins,c.urban.parties]);c.urban.dispatchClock=0;c.urban.enabled=true;assert.equal(u.dispatch(s),false);assert.equal(JSON.stringify([s.stores,c.origins,c.urban.parties]),before);valid(h);
});
test('insufficient large-party maintenance falls back atomically to eight travelers without a partial maintenance charge',()=>{
 const h=ready(),{s,p}=h;s.stores.tools=2;const before={...s.stores},party=send(h);
 assert.equal(party.transport.profile,'road8');assert.equal(party.transport.assetId,null);assert.equal(party.transport.initial,8);near(before.wood-s.stores.wood,0);near(before.tools-s.stores.tools,1.6);near(before.food-s.stores.food,48);assert.equal(party.transport.paid.parts,0);assert.match(s.civilization.urban.status,/小队/);valid(h);
});
test('a source revision failure restores precisely the actual payment and creates neither party nor asset reservation',()=>{
 const h=ready(),{s,o,u}=h,original=o.commitDeparture;o.commitDeparture=()=>false;
 const before=JSON.stringify([s.stores,s.civilization.origins,s.civilization.urban.parties]),last=s.civilization.passenger.lastDepartureAt;s.civilization.urban.enabled=true;
 assert.equal(u.dispatch(s),false);assert.equal(JSON.stringify([s.stores,s.civilization.origins,s.civilization.urban.parties]),before);assert.equal(s.civilization.passenger.lastDepartureAt,last);o.commitDeparture=original;
});
test('switching source, destination or plan cannot bypass the global 120-second departure interval',()=>{
 const h=ready(),{s,u}=h;send(h);u.setTarget(s,'river');s.civilization.urban.activeSource='mountain_settlements';s.civilization.urban.enabled=true;s.civilization.urban.dispatchClock=0;
 const before=JSON.stringify([s.stores,s.civilization.origins,s.civilization.urban.parties]);assert.equal(u.dispatch(s),false);assert.equal(JSON.stringify([s.stores,s.civilization.origins,s.civilization.urban.parties]),before);
});
test('retired or unassigned crews pause movement while preserving paid equipment, people and annual aging',()=>{
 const h=ready(),{s,u,p}=h;const a=send(h);h.step(120);const b=send(h,'mountain_settlements');s.game.workers.transporter=4;
 assert.deepEqual([...p.staffedParties(s)],[a.id]);assert.equal(h.r.staffedRoutes(s).size,0);const remaining=b.remaining,people=u.count(b.cohorts);h.step(10);assert.equal(b.remaining,remaining);assert.equal(u.count(b.cohorts),people);assert.equal(u.reservedTransport(s),8);
 s.game.workers.transporter=14;h.step(1);assert.equal(b.remaining,remaining-1);valid(h);
});
test('transport snapshots reject forged profiles, duplicate assets, omitted new records and altered initial fees',()=>{
 const h=ready(),{s,ctx}=h;send(h);h.step(120);send(h,'mountain_settlements');
 const mutations=[x=>delete x.civilization.urban.parties[1].transport,x=>x.civilization.urban.parties[1].transport.crew=2,x=>x.civilization.urban.parties[1].transport.paid.tools=4.8,x=>x.civilization.urban.parties[1].transport.assetId='service_project_999',x=>x.civilization.urban.parties[1].transport.assetId=x.civilization.urban.parties[0].transport.assetId];
 for(const mutate of mutations){const bad=clone(s);mutate(bad);assert.throws(()=>ctx.CivilPlatform.validate(bad));}
 const restored=harness(s);assert.deepEqual(clone(restored.s),clone(s));valid(restored);
});
test('changing to small teams never rewrites a 24-person outbound or charges maintenance during its return',()=>{
 const h=ready(),{s}=h,party=send(h),snapshot=JSON.stringify(party.transport);s.civilization.passenger.preference='small';s.stores.parts=0;
 h.step(120);assert.equal(party.state,'returning');assert.equal(JSON.stringify(party.transport),snapshot);h.step(120);assert.equal(s.civilization.urban.parties.length,0);valid(h);
});

test('one paid equipment supports one large party and then a separate original small party',()=>{
 const h=ready(1),{s,p,u}=h;h.step(180);const first=send(h);h.step(120);const second=send(h,'mountain_settlements');
 assert.equal(p.assets(s).length,1);assert.equal(first.transport.profile,'road24');assert.equal(second.transport.profile,'road8');assert.equal(second.transport.assetId,null);assert.equal(u.reservedTransport(s),6);valid(h);
});
test('the independent singleton recovery path needs no passenger equipment, batch agreement, medicine or crew',()=>{
 const h=harness(),{s,ctx,u,o}=h,c=s.civilization;assert.equal(presentEquipment(h),0);c.urban.enabled=false;
 // Keep existing source ledgers; only the synthetic home workforce is reset.
 s.game.population=0;c.society.cohorts=[];s.game.workers={};s.stores.food=6;s.stores.medicine=0;s.stores.tools=0;c.urban.activeSource='old_city_fringe';c.origins.nodes.old_city_fringe.status='contacted';c.origins.nodes.old_city_fringe.permit.paid=false;c.origins.nodes.old_city_fringe.agreement=null;
 const n=c.origins.nodes.old_city_fringe,before=n.population,next=c.urban.nextParty;assert.equal(u.handleArrival(s),true);assert.equal(s.game.population,1);assert.equal(n.population,before-1);assert.equal(s.stores.food,0);assert.equal(c.urban.parties.length,1,'preexisting old eight-person travel remains');assert.equal(n.departures['p'+next].transport,null);assert.equal(n.departures['p'+next].mode,'singleton');assert.ok(c.society.cohorts[0].age>=18);o.validate(s);
 function presentEquipment(h){return h.p.assets(h.s).length;}
});

test('legacy in-flight cooldown survives a destination or source switch after migration',()=>{
 const h=harness(),{s,u}=h,c=s.civilization;assert.equal(c.urban.dispatchClock,103);assert.equal(c.passenger.legacyReadyAt,48815);
 c.urban.activeSource='mountain_settlements';u.setTarget(s,'river');c.urban.enabled=true;
 const before=JSON.stringify([s.stores,c.origins,c.urban.parties]);assert.equal(u.dispatch(s),false);assert.equal(JSON.stringify([s.stores,c.origins,c.urban.parties]),before);assert.equal(c.passenger.legacyReadyAt,48815);
});
test('large-party maintenance cannot consume the current home teaching supply and count future adults as workers',()=>{
 const h=ready(),{s,p,u,ctx}=h;
 s.game.workers.hunter=(s.game.workers.hunter||0)+ctx.CivilPopulation.workforce(s.civilization.society.cohorts)-Object.values(s.game.workers).reduce((a,b)=>a+b,0);s.stores.wood=2;
 valid(h);assert.equal(u.serviceCheck(s,[]),null);const plan=p.quote(s);assert.equal(plan.transport.profile,'road8');const party=send(h);assert.equal(party.transport.profile,'road8');assert.equal(s.stores.wood,2);assert.equal(u.serviceCheck(s,[]),null);valid(h);
});

test('a new dispersed family party cannot reduce its paid initial count below its actual travelers',()=>{
 const h=harness(),{s,p,u,ctx}=h;s.civilization.urban.enabled=false;h.step(120);const party=send(h,'dispersed','river');assert.ok(u.count(party.cohorts)>1);valid(h);
 party.transport.initial=1;party.transport.paid=p.cost('road8',1);party.rations=6;assert.throws(()=>ctx.CivilPlatform.validate(s));
});
test('visible departure receipts prevent erasing or rolling back the shared departure timer',()=>{
 const h=ready(),{s,ctx}=h;send(h);for(const time of [null,s.civilization.elapsed-1]){const bad=clone(s);bad.civilization.passenger.lastDepartureAt=time;assert.throws(()=>ctx.CivilPlatform.validate(bad));}
 h.step(240);const bad=clone(s);bad.civilization.passenger.lastDepartureAt=null;assert.throws(()=>ctx.CivilPlatform.validate(bad),'closed Origins departure remains evidence');
});
