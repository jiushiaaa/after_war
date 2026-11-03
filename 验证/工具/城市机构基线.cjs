// Explicit synthetic UI scenario derived from an unchanged 207 copy. Not natural-play evidence.
const fs=require('node:fs'),path=require('node:path');
const {harness}=require('../../游戏/tests/helpers/metro-fixture.cjs');
function build(){
 const raw=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../存档/自然游玩_万人城域水务恢复207.json'))),h=harness(raw.state),{s,ctx}=h,i=ctx.CivilCityInstitutions;
 if(!i.found(s))throw Error('charter');
 // Declared technology fixture. All lessons and subsequent production pay their real costs.
 s.civilization.tech.mechanics=true;i.delegate(s,true);i.enroll(s,'yards','craft');
 for(let j=0;j<5;j++){if(!i.enroll(s,'canal','care'))throw Error('class '+j);h.step(300);}
 i.set(s,'canal','careMethod','clinical');i.set(s,'terraces','profile','provisioning');i.set(s,'yards','profile','workshop');ctx.CivilCity.set(s,'yards','method','standard');h.step(600);
 ctx.CivilPlatform.validate(s);return h;
}
module.exports={build};
if(require.main===module){const h=build(),file=process.argv[2]||'/tmp/postwar-city-institutions-fixture.json';fs.writeFileSync(file,JSON.stringify({format:'postwar-civilization',version:1,state:h.s}));console.log('SYNTHETIC',file,h.ctx.CivilCity.population(h.s));}
