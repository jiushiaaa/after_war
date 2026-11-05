// Constructed full-adapter play; real baseline actions, no resource/clock injection.
const assert=require('node:assert/strict');const {start}=require('./polity-fixture.cjs');
function route(number=364){const h=start(number),E=h.ctx.CivilEarth,F=h.ctx.CivilFuture;
 h.earth=E;h.future=F;h.wait=(module,op,args={},limit=5400)=>{let n=0,why;while((why=module.reason(h.s,op,args))&&n<limit){h.step(60,{checkEvery:0});n+=60;}assert.equal(why,null,op+' '+JSON.stringify(args));assert.ok(module.act(h.s,op,args));};h.advance=(test,limit=5400)=>{let n=0;while(!test()&&n<limit){h.step(60,{checkEvery:0});n+=60;}assert.ok(test(),'bounded Earth condition');};
 h.wait(E,'start');h.wait(F,'build',{id:'solar'});h.advance(()=>!h.s.civilization.polity.future.project);h.wait(E,'research',{id:'mapping'});
 const options=number===364?{north:'network',east:'wetland',west:'open',desert:'reclaim',rainforest:'corridor',islands:'beacons',plateau:'station',polar:'restore'}:{north:'reserve',east:'levee',west:'licensed',desert:'wells',rainforest:'canopy',islands:'harbor',plateau:'archive',polar:'preserve'};
 for(const [region,mode]of Object.entries(options)){if(!h.s.civilization.polity.earth.regions[region]){h.wait(E,'survey',{region});h.advance(()=>!!h.s.civilization.polity.earth.regions[region]);}h.wait(E,'offer',{region,mode});if(region==='east')h.wait(E,'research',{id:'navigation'});}
 h.wait(E,'unity',{mode:number===364?'federal':'covenant'});
 for(const id of ['fabrication','closed','guidance'])h.wait(E,'research',{id});for(const id of ['works','control'])h.wait(E,'build',{id});h.wait(E,'ground');h.wait(E,'launch',{kind:'probe'});h.advance(()=>h.ctx.CivilEarthFlight.done(h.s.civilization.polity.earth,'probe'));return h;
}
module.exports={route};
