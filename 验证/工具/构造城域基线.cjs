// Explicit synthetic foundation for integration/UI verification. Never a natural save.
const fs=require('node:fs'),path=require('node:path');
function build(){
const {fresh}=require(path.resolve(__dirname,'../../游戏/tests/helpers/census-fixture.cjs'));
const h=fresh(),{s,ctx,c,city}=h;
// Declared synthetic integration foundation: never presented as natural play.
s.game.population=400;s.civilization.society.cohorts=[{age:25,count:400,identity:'human'}];c.move(s,'wanderers','home',400,'构造测试前置：400名原有居民迁居');
Object.assign(s.civilization.village,{town:true,health:100,riverKnown:true,riverAllied:true});ctx.CivilCourse.choose(s,'commons');
Object.assign(s.civilization,{settled:true,station:true,pump:true,policy:'equal',trust:100,outpostSupplied:true});
Object.assign(s.civilization.tech,Object.fromEntries(['water','metal','agronomy','handtools','preservation','records','sanitation','school','trails','irrigation','standards','logistics','survey','administration','urbanworks'].map(k=>[k,true])));
Object.assign(s.civilization.urban,{chartered:true,city:true});
Object.assign(s.game.buildings,{hut:4,longhouse:4,commonhouse:12,lodge:1,workshop:1,cistern:1,outpost:1,granary:1,cart:1,farm:4,toolshop:1,clinic:2,schoolhouse:1,road:1,publicclinic:8,publicschool:4,irrigatedfield:6,cartdepot:1});
s.game.workers={farmer:30,medic:32,teacher:12,smith:4,salvager:10};
Object.assign(s.stores,{wood:10000,food:10000,tools:1000,medicine:1000,scrap:5000,knowledge:1000});
const step=n=>{for(let i=0;i<n;i++)ctx.Civilization.tick();};
ctx.CivilPlatform.validate(s);
for(const id of Object.keys(city.data(s).wards)){if(!city.contact(s,id))throw Error(city.contactReason(s,id));step(180);if(!city.startProject(s,id,'road'))throw Error('road');}
step(420);for(const id of Object.keys(city.data(s).wards))if(!city.startProject(s,id,'water'))throw Error('water');step(480);
for(const id of Object.keys(city.data(s).wards))if(!city.join(s,id))throw Error(city.joinReason(s,id));step(120);ctx.CivilPlatform.validate(s);
return {...h,step};
}
module.exports={build};
if(require.main===module){const h=build(),file=process.argv[2]||'/tmp/postwar-city-ui-synthetic.json';fs.writeFileSync(file,JSON.stringify({format:'postwar-civilization',version:1,state:h.s}));console.log('SYNTHETIC',file,h.city.population(h.s));}
