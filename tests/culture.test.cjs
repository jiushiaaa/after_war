const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,clone,near}=require('./helpers/metro-fixture.cjs');
const original=JSON.parse(fs.readFileSync('tests/fixtures/natural-recovered-town.json','utf8')).state;
function create(){const h=harness(original);h.culture=h.ctx.CivilCulture;return h;}
function started(mode='shared'){
 const h=create();assert.ok(h.culture.agree(h.s,'rail',mode));assert.ok(h.m.startProject(h.s,'rail','meetinghall'));
 h.until(()=>h.culture.active(h.s,'rail'),4000);return h;
}
test('commons remain absent in old saves and early settlements, with no invented faith population or new residents',()=>{
 const h=create(),before=JSON.stringify(h.s);h.culture.tick(h.s);h.ctx.CivilHistory.snapshot(h.s);h.roundtrip();assert.equal(JSON.stringify(h.s),before);assert.equal(h.s.civilization.culture,undefined);
 assert.equal(h.culture.agree(h.s,'unknown','shared'),false);assert.equal(h.culture.agree(h.s,'highland','shared'),false);assert.equal(h.culture.agree(h.s,'rail','invalid'),false);assert.equal(JSON.stringify(h.s),before);
});
test('a real local agreement pays only its local knowledge, cannot repeat, and does not build the hall or issue a benefit',()=>{
 const h=create(),n=h.s.civilization.regions.nodes.rail,home=JSON.stringify(h.s.stores),population=JSON.stringify(n.cohorts),knowledge=n.stores.knowledge;
 assert.ok(h.culture.agree(h.s,'rail','shared'));near(n.stores.knowledge,knowledge-10);assert.equal(JSON.stringify(h.s.stores),home);assert.equal(JSON.stringify(n.cohorts),population);
 assert.equal(h.m.data(h.s,'rail').buildings.meetinghall,undefined);assert.equal(h.culture.data(h.s,'rail').activities.length,0);const after=JSON.stringify(h.s);assert.equal(h.culture.agree(h.s,'rail','shared'),false);assert.equal(JSON.stringify(h.s),after);h.roundtrip();
});
test('the existing cart and two real builders finish a paid hall before fourteen spare adults can start an activity',()=>{
 const h=started(),n=h.s.civilization.regions.nodes.rail,m=h.m.data(h.s,'rail'),r=h.culture.active(h.s,'rail');
 assert.equal(m.buildings.meetinghall,1);assert.equal(m.project.status,'complete');assert.deepEqual(clone(m.project.required),{wood:120,iron:12,tools:8});assert.ok(m.project.receipts.length>0);
 assert.ok(r.startedAt>=m.completed.find(p=>p.type==='meetinghall').completedAt);assert.equal(r.remaining,180);assert.equal(n.workers.communityworker,14);assert.ok(Object.values(n.workers).reduce((a,b)=>a+b,0)<=h.ctx.CivilPopulation.workforce(n.cohorts));h.roundtrip();
});
test('actual local preparation is charged once and a full staffed activity credits exactly six local knowledge once',()=>{
 const h=started(),u=h.culture,n=h.s.civilization.regions.nodes.rail,r=u.active(h.s,'rail'),initial=JSON.stringify(h.s);u.tick(h.s);assert.equal(JSON.stringify(h.s),initial);assert.deepEqual(clone(r.paid),{wood:4,food:6});
 const tick=u.tick.bind(u),credits=[];u.tick=s=>{const before=n.stores.knowledge,status=r.status;tick(s);if(status==='active'&&r.status==='complete')credits.push(n.stores.knowledge-before);};
 h.step(179);assert.equal(r.remaining,1);assert.equal(r.benefit.knowledge,0);h.step(1);assert.equal(r.status,'complete');assert.deepEqual(credits,[6]);assert.equal(r.endedAt-r.startedAt,180);
 const after=JSON.stringify(h.s);u.tick(h.s);assert.equal(JSON.stringify(h.s),after);h.roundtrip();
});
test('low adult labour pauses the same paid activity instead of recruiting imaginary people or stealing service jobs',()=>{
 const h=started(),u=h.culture,n=h.s.civilization.regions.nodes.rail,r=u.active(h.s,'rail'),saved=clone(n.cohorts);
 // Isolated shortage case: keep the population count but remove spare working ages.
 n.cohorts=[{age:40,count:40,identity:'human'},{age:70,count:n.population-40,identity:'human'}];h.m.planWorkers(h.s,'rail');assert.equal(n.workers.communityworker,undefined);
 const remaining=r.remaining;h.step(30);assert.equal(r.remaining,remaining);assert.equal(r.benefit.knowledge,0);assert.equal(u.data(h.s,'rail').activities.length,1);
 n.cohorts=saved;h.m.planWorkers(h.s,'rail');h.step(1);assert.equal(r.remaining,remaining-1);h.roundtrip();
});
test('insufficient food reserve prevents preparation and poor health pauses already paid work without refund or reward',()=>{
 const h=started(),u=h.culture,n=h.s.civilization.regions.nodes.rail,r=u.active(h.s,'rail');n.health=59;h.step(1);assert.equal(r.remaining,180);assert.equal(r.benefit.knowledge,0);
 assert.ok(u.cancel(h.s,'rail'));assert.ok(u.setEnabled(h.s,'rail',false));h.step(600);n.stores.food=0;assert.ok(u.setEnabled(h.s,'rail',true));h.m.planWorkers(h.s,'rail');const before=JSON.stringify(n.stores);assert.equal(u.start(h.s,'rail'),false);assert.equal(JSON.stringify(n.stores),before);assert.equal(u.data(h.s,'rail').activities.length,1);
});
test('stopping future sessions lets paid work finish, releases attendees, and resuming never backfills missed sessions',()=>{
 const h=started(),u=h.culture;assert.ok(u.setEnabled(h.s,'rail',false));assert.equal(h.s.civilization.regions.nodes.rail.workers.communityworker,14);h.step(180);assert.equal(u.active(h.s,'rail'),null);assert.equal(h.s.civilization.regions.nodes.rail.workers.communityworker,undefined);
 h.step(1200);assert.equal(u.data(h.s,'rail').activities.length,1);assert.ok(u.setEnabled(h.s,'rail',true));h.step(1);assert.equal(u.data(h.s,'rail').activities.length,2);assert.equal(u.active(h.s,'rail').kind,'memorial');assert.equal(u.active(h.s,'rail').remaining,180);h.roundtrip();
});
test('cancelling even in the start second never refunds consumed preparation or issues a result, and records survive same-second controls',()=>{
 const h=started(),u=h.culture,n=h.s.civilization.regions.nodes.rail,stores=JSON.stringify(n.stores);assert.ok(u.setEnabled(h.s,'rail',false));assert.ok(u.cancel(h.s,'rail'));assert.equal(JSON.stringify(n.stores),stores);assert.equal(u.cancel(h.s,'rail'),false);assert.equal(u.data(h.s,'rail').activities[0].benefit.knowledge,0);h.roundtrip();
 assert.ok(u.agree(h.s,'rail','archive'));h.roundtrip();
});
test('shared space alternates real activities; a fulfilled memorial changes only bounded local unrest, never health or population',()=>{
 const h=started(),u=h.culture,n=h.s.civilization.regions.nodes.rail;h.step(780);const r=u.active(h.s,'rail');assert.equal(r.kind,'memorial');assert.equal(r.remaining,180);
 const tick=u.tick.bind(u),effects=[];u.tick=s=>{const before={health:n.health,pop:n.population,unrest:n.unrest,knowledge:n.stores.knowledge,home:JSON.stringify(s.stores)},status=r.status;tick(s);if(status==='active'&&r.status==='complete'){near(before.unrest-n.unrest,r.benefit.unrest);assert.equal(n.health,before.health);assert.equal(n.population,before.pop);assert.equal(n.stores.knowledge,before.knowledge);assert.equal(JSON.stringify(s.stores),before.home);effects.push(r.benefit.unrest);}};
 h.step(180);assert.equal(effects.length,1);assert.ok(effects[0]>=0&&effects[0]<=2);assert.equal(u.nextKind(h.s,'rail'),'archive');h.roundtrip();
});
test('archive-only agreements leave a real bounded unresolved-space dispute and do not schedule religious activities',()=>{
 const h=started('archive'),u=h.culture,d=u.data(h.s,'rail');assert.equal(d.agreements[0].unrestDelta,4);h.step(960);assert.ok(d.activities.every(r=>r.kind==='archive'));h.roundtrip();
});
test('in-progress original work survives reload without restarting or repaying and invalid receipts are rejected',()=>{
 const h=started(),u=h.culture;h.step(37);const reload=h.roundtrip(),r=reload.ctx.CivilCulture.active(reload.s,'rail');assert.equal(r.remaining,143);reload.step(143);assert.equal(r.status,'complete');reload.roundtrip();
 for(const change of [d=>d.activities[0].paid.food++,d=>d.activities[0].remaining=0,d=>d.activities[0].startedAt=h.s.civilization.elapsed,d=>d.activities[0].agreementId=2,d=>d.activities[0].benefit.knowledge=6,d=>d.activities[0].controlVersion=99,d=>d.agreements[0].paid.knowledge=0,d=>d.activities.push({...d.activities[0]})]){const bad=clone(h.s);change(bad.civilization.culture.nodes.rail);assert.throws(()=>h.ctx.CivilPlatform.validate(bad));}
});
test('native protocol events and short history pages are progressive, escape text, and never grant replay rewards',()=>{
 const h=create(),u=h.culture;h.s.civilization.pending='culture_rail';h.ctx.Civilization.showPending();const old=h.active.scenes.start.buttons.archive.onChoose;h.click('shared');assert.equal(old(),false);assert.equal(u.agreement(h.s,'rail').mode,'shared');
 const before=JSON.stringify(h.s),event=h.ctx.CivilHistory.event(h.s);assert.ok(event.scenes.start.buttons.history_culture);for(const [name,scene]of Object.entries(event.scenes))if(name.startsWith('culture_')){assert.ok(scene.text.length<=4);for(const button of Object.values(scene.buttons)){assert.equal(button.onChoose,undefined);assert.equal(button.cost,undefined);}}assert.equal(JSON.stringify(h.s),before);h.roundtrip();
});
test('an activity finishing while its window is open does not invalidate stopping future sessions or allow a stale cancellation',()=>{
 const h=started(),u=h.culture;h.s.civilization.pending='culture_rail';h.ctx.Civilization.showPending();
 const controls=h.active.scenes.start.buttons,stop=controls.schedule.onChoose,cancel=controls.cancel.onChoose;
 h.step(180,{choose:false});assert.equal(u.active(h.s,'rail'),null);assert.equal(cancel(),false);
 assert.ok(stop());assert.equal(u.enabled(h.s,'rail'),false);assert.equal(h.s.civilization.pending,null);
 assert.equal(stop(),false);assert.equal(u.data(h.s,'rail').controls.length,1);h.roundtrip();
});
