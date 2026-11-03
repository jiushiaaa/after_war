const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function fresh(){
 const s={game:{population:0,workers:{},buildings:{},builder:{level:4},temperature:{value:3},fire:{value:3}},stores:{wood:100,food:100,scrap:100},timers:{},cooldown:{}};
 const get=p=>p.split('.').reduce((a,k)=>a?.[k],s),set=(p,v)=>{const a=p.split('.'),k=a.pop();let o=s;for(const x of a)o=o[x]??={};o[k]=v;};let active=null;
 const ctx=vm.createContext({State:s,Math:Object.assign(Object.create(Math),{random:()=>.5}),TextEncoder,TextDecoder,console,setTimeout:()=>0,clearTimeout(){},_:s=>s,
  Room:{buttons:{},build(){},updateBuildButtons(){},updateIncomeView(){}},Outside:{setTitle(){},updateVillage(){},updateWorkersView(){},killVillagers(n){s.game.population-=n;}},Engine:{saveGame(){}},AudioEngine:{},Notifications:{notify(){}},CivilClock:{rate:1},
  Events:{activeEvent:()=>active,startEvent(e){active=e;},buttonClick(){},endEvent(){active=null;}},$SM:{get:(p,z)=>get(p)??(z?0:undefined),set,add:(p,n)=>set(p,(get(p)||0)+n),fireUpdate(){}}});
 const files=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f.startsWith('content/')||f.startsWith('src/postwar/'));
 for(const f of [...new Set([...files,'content/city.js','src/postwar/census.js','src/postwar/city.js'])])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 ctx.Civilization.notify=()=>{};ctx.Civilization.refresh=()=>{};ctx.Civilization.updateIncome=()=>{};ctx.Civilization.renderSpeed=()=>{};ctx.Civilization.refreshPeriodic=()=>{};ctx.Outside.updateWorkersView=()=>{};
 ctx.Civilization.initState();s.civilization.ruleset=2;ctx.CivilCity.init(s);ctx.CivilCensus.init(s);
 return {s,ctx,c:ctx.CivilCensus,city:ctx.CivilCity,step(n){for(let i=0;i<n;i++){s.civilization.elapsed++;ctx.CivilCensus.annual(s);ctx.CivilCity.tick(s);}}};
}
module.exports={fresh};
