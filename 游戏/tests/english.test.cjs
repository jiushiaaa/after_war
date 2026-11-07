const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function engine(){const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/postwar/english.js'),'utf8'),ctx);return ctx.CivilEnglish;}
test('English templates reorder placeholders without changing values and translate nested display labels',()=>{
 const e=engine();e.prepare([{source:'炉火城',text:'Hearth City'},{source:'{变量1}名孩子',text:'Children: {变量1}'},{source:'{分支1}在{变量2}降生。',text:'New arrivals in {变量2}: {分支1}.'}]);
 assert.equal(e.format('17名孩子在炉火城降生。'),'New arrivals in Hearth City: Children: 17.');
 assert.equal(e.format('1名孩子'),'Children: 1');assert.equal(e.format('0名孩子'),'Children: 0');
 assert.equal(e.format('4.25'),'4.25');assert.equal(e.format(null),null);
});
test('English renderer restores source text exactly and notices subsequent game updates',()=>{
 const e=engine();e.prepare([{source:'生火',text:'Light Fire'},{source:'添火',text:'Stoke Fire'}]);e.nodes=new WeakMap();e.locale='en';
 const node={nodeValue:'生火',parentElement:{closest:()=>null}};e.textNode(node);assert.equal(node.nodeValue,'Light Fire');
 e.locale='zh';e.textNode(node);assert.equal(node.nodeValue,'生火');
 e.locale='en';e.textNode(node);node.nodeValue='添火';e.textNode(node);assert.equal(node.nodeValue,'Stoke Fire');
 e.locale='zh';e.textNode(node);assert.equal(node.nodeValue,'添火');
 const literal={nodeValue:'生火',parentElement:{closest:()=>true}};e.locale='en';e.textNode(literal);assert.equal(literal.nodeValue,'生火');
});
test('English UI attributes never rewrite resource keys or form values',()=>{
 const e=engine();e.prepare([{source:'木料',text:'Wood'}]);e.attributes=new WeakMap();e.locale='en';
 const attrs={title:'木料',value:'木料',id:'木料'},node={closest:()=>null,getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>attrs[k]=v};
 e.element(node);assert.equal(attrs.title,'Wood');assert.equal(attrs.value,'木料');assert.equal(attrs.id,'木料');
 e.locale='zh';e.element(node);assert.equal(attrs.title,'木料');
});
test('template specificity handles empty slots and short Chinese anchors without shifting values',()=>{
 const e=engine();e.prepare([
  {source:'{变量1} {变量2}人',text:'{变量1} {变量2} people'},
  {source:'{变量1} 人',text:'{变量1} people'},
  {source:'{变量1}缺{变量2} {变量3}{变量4}',text:'{变量1} is short of {变量2} {变量3}{变量4}'}
 ]);
 assert.equal(e.format('17 人'),'17 people');
 assert.equal(e.format('City缺18 wood (urgent)'),'City is short of 18 wood (urgent)');
});
test('Chinese compact population units become English quantities without concatenating digits',()=>{
 const e=engine();e.prepare([{source:'万',text:'10,000'},{source:'亿',text:'100 million'},{source:'人',text:'people'}]);
 assert.equal(e.format('1.21万人'),'12,100 people');assert.equal(e.format('4.91亿'),'491,000,000');
 assert.equal(e.format('12,345人'),'12,345 people');
});
test('compiled catalog translates stitched history while preserving dates and restores it verbatim',()=>{
 const e=engine();const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../content/english.js'),'utf8'),c);e.prepare(c.CivilEnglishText);
 const source='重建 0 年　首任工匠·阿岑第一次进入共同记录，时年50岁。工坊轮值会接续这份职责。';
 const translated=e.format(source);assert.doesNotMatch(translated,/[\u4e00-\u9fff]/);assert.match(translated,/Year 0/);assert.match(translated,/age 50/);
 e.nodes=new WeakMap();e.locale='en';const node={nodeValue:source,parentElement:{closest:()=>null}};e.textNode(node);e.locale='zh';e.textNode(node);assert.equal(node.nodeValue,source);
 assert.equal(e.format('定位可研究（5）'),'Find researchable (5)');
 assert.equal(e.format('自愿采纳12位辅助义体'),'Voluntary adoption: 12 residents · Assistive Prosthetics');
});
