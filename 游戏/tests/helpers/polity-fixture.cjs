// Constructed adapter scenario, starting from immutable public/industrial natural checkpoints.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');const {harness}=require('./metro-fixture.cjs');
function start(number=308){const dir=path.resolve(__dirname,'../../../验证/存档'),file=fs.readdirSync(dir).find(f=>f.endsWith(number+'.json')),e=JSON.parse(fs.readFileSync(path.join(dir,file))),h=harness((e.encoding?JSON.parse(z.gunzipSync(Buffer.from(e.data,'base64'))):e).state);h.p=h.ctx.CivilPolity;h.r=h.ctx.CivilRegional;return h;}
function ready(number=308){const h=start(number);assert.ok(h.r.cofund(h.s));assert.equal(h.p.reason(h.s,'start'),null);assert.ok(h.p.act(h.s,'start'));return h;}
function act(h,action,args={},limit=7200){for(let n=0;n<limit&&h.p.reason(h.s,action,args);n+=60)h.step(60,{checkEvery:0});assert.equal(h.p.reason(h.s,action,args),null,action+' '+JSON.stringify(args));assert.ok(h.p.act(h.s,action,args));h.ctx.CivilPlatform.validate(h.s);}
function diplomatic(number=308){const h=ready(number);act(h,'contact',{actor:'west'});act(h,'contact',{actor:'desert'});act(h,'protocol',{mode:'clearing'});act(h,'protocol',{mode:'shipping'});act(h,'protocol',{mode:'congress'});h.step(2400,{checkEvery:0});h.ctx.CivilPlatform.validate(h.s);return h;}
module.exports={start,ready,act,diplomatic};
