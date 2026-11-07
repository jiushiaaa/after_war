const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx=vm.createContext({});
for(const file of ['游戏/content/english.js','游戏/src/postwar/english.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
const e=ctx.CivilEnglish;e.prepare(ctx.CivilEnglishText);const issues=[],start=performance.now();
for(const row of ctx.CivilEnglishText){
 const slots=[...new Set(row.source.match(/\{[^{}]+\}/g)||[])];
 const values=new Map(slots.map((s,i)=>[s,`VALUE_${i}_17.25`]));
 const input=row.source.replace(/\{[^{}]+\}/g,s=>values.get(s));
 const actual=e.format(input),expected=row.text.replace(/\{[^{}]+\}/g,s=>values.get(s)).replace(/([.!?])(?=[A-Z])/g,'$1 ');
 if(actual!==expected){
  const missing=[...values.values()].filter(v=>!actual.includes(v));
  issues.push({source:row.source,expected,actual,missing});
 }
}
fs.writeFileSync(path.join(root,'本地化/英文全稿/render-issues.json'),JSON.stringify(issues,null,2));
console.log(JSON.stringify({rows:ctx.CivilEnglishText.length,issues:issues.length,valueLoss:issues.filter(x=>x.missing.length).length,ms:Math.round(performance.now()-start)}));
