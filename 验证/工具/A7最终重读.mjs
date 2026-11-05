// Final native imports in an isolated UI copy. Source bytes never change; no rewards or state are injected.
import fs from'node:fs';import path from'node:path';import z from'node:zlib';import crypto from'node:crypto';import assert from'node:assert/strict';import{spawn}from'node:child_process';import{connect}from'./a7-cdp.mjs';
const dir='验证/A7/7-全流程/最终重读',report={kind:'two native UI imports of each unedited final export in independent port 9372',routes:{}};fs.mkdirSync(dir,{recursive:true});
for(const route of['public','industry']){
 const source=path.resolve('验证/A7/7-全流程',route,'earth/13_ten_years_after_flight/战后文明-存档.json'),bytes=fs.readFileSync(source),raw=JSON.parse(bytes),s=(raw.encoding?JSON.parse(z.gunzipSync(Buffer.from(raw.data,'base64'))):raw).state,c=s.civilization,f=c.polity.future,g=c.polity.earth;
 const rounds=[];
 for(let n=1;n<=2;n++){
  const dest=path.resolve(dir,route+'-'+n),code=await new Promise(resolve=>{const p=spawn(process.execPath,['验证/工具/A7原生导入接续.mjs','9372',source,dest],{stdio:['ignore','inherit','inherit']});p.on('exit',resolve);});assert.equal(code,0);
  const b=await connect(9372,dest),info=await b.read(`(()=>{const c=State.civilization,f=c.polity.future,g=c.polity.earth;return {at:c.elapsed,paused:!!CivilClock.paused,created:f.created,converted:f.converted,flightIds:g.flights.map(x=>x.id),ending:g.ending,away:CivilFuturePeople.away(f),ammoSpent:c.fieldEquipment.ammoSpent,achievements:c.archives.achievements,world:CivilCensus.total(State),equation:c.census.initial+c.census.born+(c.census.created||0)-c.census.dead};})()`);b.close();
  assert.ok(info.paused&&info.at>=c.elapsed&&info.at-c.elapsed<50);assert.equal(info.created,f.created);assert.deepEqual(info.converted,f.converted);assert.deepEqual(info.flightIds,g.flights.map(x=>x.id));assert.deepEqual(info.ending,g.ending);assert.equal(info.away,0);assert.equal(info.ammoSpent,c.fieldEquipment.ammoSpent);assert.deepEqual(info.achievements,c.archives.achievements);assert.equal(info.world,info.equation);rounds.push(info);
 }
 assert.ok(bytes.equals(fs.readFileSync(source)));report.routes[route]={source,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceUnchanged:true,rounds};
}
fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Both final sources reimported twice, no duplicate persons, flights, ammo or achievements.');
