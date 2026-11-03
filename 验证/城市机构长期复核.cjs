// 构造输入：207 副本 + 已声明的机械传动。实际执行完整适配器，非自然百年游玩。
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),{harness}=require(path.join(root,'游戏/tests/helpers/metro-fixture.cjs'));
const h=harness(JSON.parse(fs.readFileSync(path.join(__dirname,'存档/自然游玩_万人城域水务恢复207.json'))).state),{s,ctx}=h,i=ctx.CivilCityInstitutions;
i.found(s);i.delegate(s,true);s.civilization.tech.mechanics=true;
i.set(s,'terraces','profile','provisioning');i.set(s,'yards','profile','workshop');i.set(s,'canal','careMethod','clinical');ctx.CivilCity.set(s,'yards','method','standard');i.delegateSchool(s,'canal',true);i.delegateSchool(s,'yards',true);
const records=[],start=s.civilization.elapsed;
for(let y=0;y<100;y++){h.step(600,{checkEvery:600});records.push({year:y+1,total:ctx.CivilCity.population(s),home:s.game.population,homeHealth:s.civilization.village.health,hunger:s.civilization.hunger,wards:Object.fromEntries(Object.entries(s.civilization.city.wards).map(([id,n])=>[id,{health:n.health,stable:n.stable,pop:ctx.CivilCity.count(n),food:n.stores.food,tools:n.stores.tools,blocked:n.economy.blocked}])),courses:Object.fromEntries(Object.entries(i.data(s).wards).map(([id,n])=>[id,n.courses.length]))});}
ctx.CivilPlatform.validate(s);h.roundtrip();
fs.writeFileSync(process.argv[2]||path.join(__dirname,'城市机构_完整适配器百年.json'),JSON.stringify({scenario:'synthetic copy of 207, mechanics precondition; full adapter and real settlement costs',start,end:s.civilization.elapsed,records},null,2));console.log(JSON.stringify(records.at(-1)));
