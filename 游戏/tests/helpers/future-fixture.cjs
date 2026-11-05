// Explicit constructed finite test world. Never claimed as a natural playthrough.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let context;
function ctx(){if(context)return context;context=vm.createContext({console});const root=path.join(__dirname,'../..');for(const file of ['content/future.js','src/postwar/future-people.js','src/postwar/future.js','src/postwar/future-echo.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const add=(s,x)=>{for(const [k,v]of Object.entries(x))s[k]=(s[k]||0)+v;},can=(s,c)=>Object.entries(c).every(([k,v])=>(s[k]||0)+1e-8>=v),pay=(s,c)=>{for(const [k,v]of Object.entries(c))s[k]=(s[k]||0)-v;};
 context.CivilRegions={canPay:can};context.CivilServices={pay};context.CivilCity={sum:add};context.CivilText={labels:{}};context.CivilConurbation={plus:(a,b)=>{const x={...a};add(x,b);return x;}};
 context.CivilPopulation={foodPopulation:rows=>rows.reduce((n,c)=>n+c.count*(c.age<18?2/3:1),0)};
 context.CivilPolity={spend(d,c){if(!can(d.world.nodes.north.stores,c))throw Error('公共仓不足');pay(d.world.nodes.north.stores,c);add(d.public.consumed,c);},same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)};return context;
}
function fixture(){const c=ctx(),F=c.CivilFuture,P=c.CivilFuturePeople,d={foundedAt:1,stable:600,lastService:{paid:true},public:{sent:{},received:{},consumed:{}},world:{nodes:{north:{stores:Object.fromEntries(['food','medicine','wood','tools','iron','knowledge','parts','electronics','steel'].map(k=>[k,100000]))}}}};
 let at=600;const events=[],e=(op,args)=>({at,action:'future',args:{op,...args},sources:{north:{idle:10000}},volunteers:[{age:25,count:180,identity:'human'},{age:30,count:60,identity:'mutant'}]}),effects=()=>({north:{},east:{}});
 const h={c,F,P,d,events,get f(){return d.future;},get at(){return at;},act(op,args={}){const event=e(op,args),x=effects();const result=F.action(d,event,x);events.push({event,effects:x});return result;},wait(op,args={}){for(let n=0;n<120;n++){try{F.action(F.copy(d),e(op,args),effects());return this.act(op,args);}catch(error){if(n===119)throw error;this.step();}}},step(rounds=1){for(let i=0;i<rounds;i++){at+=60;F.period(d,{at});P.validate(d.future);}},ready(id){const cfg=c.CivilFutureContent.tech[id];for(const pre of cfg.requires)if(!d.future.tech[pre])this.ready(pre);this.wait('research',{id});let n=0;while(d.future.research&&n++<80)this.step();if(d.future.research)throw Error('Research stalled '+id+JSON.stringify(d.future.last));},build(id){this.wait('build',{id});let n=0;while(d.future.project&&n++<80)this.step();if(d.future.project)throw Error('Build stalled '+id);},adopt(body,count=24){this.wait('adopt',{body,count});let n=0;while(d.future.adoption&&n++<80)this.step();if(d.future.adoption)throw Error('Adoption stalled '+body);}};
 h.act('start');h.step(1);return h;
}
function equipped(){const h=fixture();h.build('laboratory');h.build('workshop');h.ready('ecology');h.build('solar');h.build('garden');h.ready('clinical');h.build('clinic');h.wait('commission');h.build('housing');return h;}
module.exports={fixture,equipped,ctx};
