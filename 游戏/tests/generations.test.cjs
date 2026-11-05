const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fresh}=require('./helpers/census-fixture.cjs');
function scenario(selection='election'){
 const h=fresh(),x=h.s.civilization.society;
 x.axes={structure:'federation',selection,charter:'constitution',devolution:'local'};x.governed=true;x.founded=true;x.legitimate=100;
 h.year=()=>{h.s.civilization.elapsed+=600;h.ctx.CivilSociety.annual(h.s,()=>.9);h.ctx.CivilGenerations.observe(h.s);h.ctx.CivilSociety.validate(h.s);h.ctx.CivilGenerations.validate(h.s);};return h;
}
test('A7 constructed 300 years: ten-year elections, reelection and 15–25 actual leaders without routine dialogs',()=>{
 const h=scenario(),x=h.s.civilization.society,d=h.s.civilization.generations;
 for(let i=0;i<300;i++)h.year();
 assert.ok(x.generation>=15&&x.generation<=25,`actual leaders ${x.generation}`);assert.equal(x.succession,null);assert.equal(d.dialogs,0);assert.ok(d.elections.some(e=>e.renewed));
 assert.ok(d.elections.every(e=>e.term===10));assert.equal(x.history.length,x.generation-1);assert.equal(x.history[0].from,0);
 const report={kind:'constructed annual rules, NOT natural play',years:300,leaders:x.generation,elections:d.elections.length,renewals:d.elections.filter(e=>e.renewed).length,dialogs:d.dialogs};
 fs.writeFileSync(path.resolve(__dirname,'../../验证/A7/0-代际/300年构造.json'),JSON.stringify(report,null,2)+'\n');
});
test('A7 appointment retires at 65; hereditary keeps a living head after 65 and ages the existing heir',()=>{
 const a=scenario('appointment');a.s.civilization.society.leader.age=64;a.year();assert.equal(a.s.civilization.society.generation,2);assert.equal(a.s.civilization.society.leader.age,45);assert.equal(a.s.civilization.society.history[0].reason,'retirement');
 const b=scenario('hereditary'),x=b.s.civilization.society;x.leader.age=64;b.year();assert.equal(x.generation,1);x.leader.age=84;const heir=x.heir.age;b.year();assert.equal(x.generation,2);assert.equal(x.leader.age,heir+1);assert.equal(x.history[0].reason,'death');
});
test('A7 crisis asks once; routine delegated selection does not lose assets or mint population',()=>{
 const h=scenario(),{s,ctx}=h,x=s.civilization.society;x.legitimate=0;x.leader.age=84;
 const before=JSON.stringify([s.stores,s.game.population,s.civilization.census.accounts]);h.year();assert.equal(x.succession,'death');assert.equal(s.civilization.generations.dialogs,1);
 assert.ok(ctx.CivilSociety.succeed(s,'scholar'));assert.equal(JSON.stringify([s.stores,s.game.population,s.civilization.census.accounts]),before);assert.equal(x.leader.trait,'scholar');
});
test('A7 biographies retire, age and pass to institutions without adding people; reload does not duplicate',()=>{
 const h=scenario(),{s,ctx}=h;ctx.CivilGenerations.observe(s);const before=s.game.population;
 for(let i=0;i<40;i++)h.year();const d=s.civilization.generations,p=d.people.craft;
 assert.equal(p.retired,15);assert.equal(p.died,35);assert.equal(s.game.population,before);
 const clone=JSON.parse(JSON.stringify(s)),exact=JSON.stringify(clone);ctx.CivilGenerations.init(clone);ctx.CivilGenerations.observe(clone);assert.equal(JSON.stringify(clone),exact);
 assert.ok(ctx.CivilHistory.snapshot(s).entries.some(e=>e.category==='people'));
});
test('A7 representation is one-shot and retaining a head does not reset tenure',()=>{
 const h=scenario(),{s,ctx}=h;const d=s.civilization.generations;d.pending='nation';const started=s.civilization.society.leader.started;
 assert.ok(ctx.CivilGenerations.head(s,'nation','keep'));assert.equal(ctx.CivilGenerations.head(s,'nation','keep'),false);assert.equal(s.civilization.society.leader.started,started);assert.equal(d.dialogs,1);
});
test('old ruleset:2 exports acquire no A7 data and retain six-year elections',()=>{
 const h=scenario(),{s,ctx}=h;delete s.civilization.polishVersion;delete s.civilization.generations;ctx.CivilGenerations.init(s);
 for(let i=0;i<6;i++){s.civilization.elapsed+=600;ctx.CivilSociety.annual(s,()=>.9);ctx.CivilGenerations.observe(s);}
 assert.equal(s.civilization.generations,undefined);assert.equal(s.civilization.society.succession,'election');ctx.CivilGenerations.validate(s);
});
test('unknown or malformed A7 state is rejected rather than reset on import',()=>{
 const h=scenario(),{s,ctx}=h;s.civilization.generations.terms=3;assert.throws(()=>ctx.CivilGenerations.validate(s));
 s.civilization.generations=null;ctx.CivilGenerations.init(s);assert.throws(()=>ctx.CivilGenerations.validate(s));
});
