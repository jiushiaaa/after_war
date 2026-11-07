const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(extra={}){const ctx=vm.createContext({...extra});for(const file of ['content/editorial.js','src/postwar/editorial.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);return ctx;}
test('reviewed historical copy preserves every dynamic value and has an unambiguous source',()=>{
 const {CivilEditorial:e,CivilEditorialText:catalog}=load(),seen=new Set();
 for(const row of catalog){
  const render=parts=>parts.map((part,i)=>part+(i<parts.length-1?`〔VALUE_${i}：17.5〕`:'')).join('');
  assert.equal(row.source.length,row.text.length,row.id);assert.ok(!seen.has(JSON.stringify(row.source)),row.id);seen.add(JSON.stringify(row.source));
  assert.equal(e.format(render(row.source)),render(row.text),row.id);
 }
 assert.equal(e.format('新图谱：进入世界，半导体与控制器。'),'新图谱：进入世界，半导体与控制器。');
 assert.equal(e.format(0),0);assert.equal(e.format(null),null);
});
test('display formatter keeps surrounding history labels and limits its cache',()=>{
 const {CivilEditorial:e}=load();const old='两区实付设立共同议事与运输机构。先经历连续600秒公共履约，再确认国约；居民与地方仓库保持原处。';
 assert.equal(e.format('重建 57 年 · '+old),'重建 57 年 · '+e.format(old));
 for(let n=0;n<1000;n++)e.format('untouched-'+n);assert.ok(e.cache.size<=512);
});
test('text presentation hook preserves getter, chaining, functional setters and literal export fields',()=>{
 function $(value){const items=Array.isArray(value)?value:[value],selection=Object.create($.fn);selection.items=items;return selection;}
 $.fn={each(fn){this.items.forEach((item,i)=>fn.call(item,i,item));return this;},text(value){if(!arguments.length)return this.items.map(e=>e.value).join('');return this.each(function(i){this.value=typeof value==='function'?value(i,this.value):value;});},attr(name,value){if(typeof name==='string'&&arguments.length===1)return this.items[0].attrs?.[name];const values=typeof name==='object'?name:{[name]:value};return this.each(function(){Object.assign(this.attrs||(this.attrs={}),values);});}};
 const {CivilEditorial:e,CivilEditorialText:rows}=load({$});e.install();const hooked=$.fn.text;e.install();assert.equal($.fn.text,hooked);
 const row=rows.find(r=>r.source.length===1),plain={value:'',closest:()=>null},literal={value:'',closest:()=>true},set=$([plain,literal]);
 assert.equal(set.text(row.source[0]),set);assert.equal(plain.value,row.text[0]);assert.equal(literal.value,row.source[0]);
 assert.equal($(plain).text(),row.text[0]);$(plain).text((i,value)=>value+'!');assert.equal(plain.value,row.text[0]+'!');$(plain).text(12);assert.equal(plain.value,12);
 const attrs={title:row.source[0],'aria-label':row.source[0],value:row.source[0]};$(plain).attr(attrs);
 assert.equal($(plain).attr('title'),row.text[0]);assert.equal($(plain).attr('aria-label'),row.text[0]);assert.equal($(plain).attr('value'),row.source[0]);assert.equal(attrs.title,row.source[0]);
});
test('polished rendering never mutates old public and industrial ledgers or their native save replay',()=>{
 const {start}=require('./helpers/polity-fixture.cjs');
 for(const number of [408,409]){const h=start(number),before=JSON.stringify(h.s);h.roundtrip();for(const record of h.s.civilization.polity.records)if(record.outcome)h.ctx.CivilEditorial.format(record.outcome);assert.equal(JSON.stringify(h.s),before);h.roundtrip();}
});
