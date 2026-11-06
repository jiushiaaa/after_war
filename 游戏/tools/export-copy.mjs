// MPL-2.0. Read-only source extraction. This tool never imports editorial changes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {parse} from 'acorn';
import {parse as parseHTML, parseFragment} from 'parse5';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(game);
const arg=process.argv.indexOf('--out'),out=arg>=0?path.resolve(process.argv[arg+1]):path.join(root,'文案编辑');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const han=s=>/\p{Script=Han}/u.test(s),name=n=>n?.name??n?.value??'';
const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(new Date());
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const previous=path.join(out,'作品完整文案.md'),baseline=path.join(out,'_导出基线/作品完整文案.md');
const managedBatches=fs.existsSync(path.join(out,'_导出基线/分卷哈希.json'))?Object.keys(JSON.parse(readOut(path.join(out,'_导出基线/分卷哈希.json')))).filter(f=>/^分卷\/\d+_[^/]+\.md$/.test(f)):[];
if(fs.existsSync(previous)&&(!fs.existsSync(baseline)||readOut(previous)!==readOut(baseline)))throw Error('文稿有未导入改动，拒绝覆盖。请先备份并由人工决定如何处理。');
function readOut(p){return fs.readFileSync(p,'utf8');}
if(fs.existsSync(path.join(out,'_导出基线/分卷哈希.json'))){
 for(const [f,digest]of Object.entries(JSON.parse(readOut(path.join(out,'_导出基线/分卷哈希.json')))))
  if(!fs.existsSync(path.join(out,f))||hash(readOut(path.join(out,f)))!==digest)throw Error('分卷或润色附件有未导入改动，拒绝覆盖：'+f);
}
const chapters=['求生与近郊探索','城镇科技与公共服务','城市与城市群','地区国家与战争贸易','先进社会与身体路线','地球首航与发展史','通用界面与存档','旧版兼容与原作译文','独立体验测试入口','错误诊断与技术键名'];
const titles={zh:'开局、基础术语与时代措辞',adapter:'共同体日常与进度提示',setup:'新世界设定',expedition:'近郊出行与遗迹',incidents:'日常与随机事件',hearth:'炉火管理',wind:'寒潮',forecast:'预报',village:'村镇生活',rules:'求生与生产',decisions:'早期抉择',course:'公共与工业路线',pacing:'轮值委托与发展抉择',development:'复兴科技',industry:'工业与岗位',modern:'电与通信',urban:'城镇建设',origins:'幸存者来源',municipal:'地方公共工程',advanced:'复兴后期设施',services:'公共服务',precision:'精密制造',heating:'供热',ruins:'遗迹调查',culture:'文化与共同生活',cooperative:'合作社',guide:'下一步指引',population:'年龄与人口',generations:'人物与机构接续',society:'制度与代际',city:'城市经营',census:'世界人口底账',conurbation:'真实城市接入',metro:'城市群旧制',intercity:'城际接续',corridor:'运输走廊',passenger:'迁居运输',settlement:'聚居与收容',regions:'周边地区',regional:'地区经营',domain:'地区共同职责',polity:'国家国约',nation:'建国旧制',foreign:'国家自主交涉',diplomacy:'外交',statecraft:'国家利益',congress:'联盟会议',leagues:'联盟与退出',aftermath:'停火与重建',markets:'自主市场',transit:'贸易中转',commerce:'商贸',finance:'互助与财政',relief:'救济',railway:'轨道运输',security:'守备',equipment:'装备与护送',accession:'地区接纳',frontier:'开拓',partnership:'地区伙伴',worldstage:'地球地区旧制',future:'先进社会',earth:'地球共同法',space:'航天旧制',archives:'档案、里程碑与文明回顾',history:'发展史',platform:'导入导出与存档',local:'本地',saves:'存档槽',sound:'声音菜单',interface:'建造与科技界面',readable:'状况卡与告警',planning:'生产计划',budget:'公共预算',homes:'住房与迁居',labor:'岗位与工资',skills:'技能培训',registry:'人口登记',continuity:'代际补员',council:'共同委托',governance:'城市治理',dispatch:'货运调度',network:'跨城物流',institutions:'机构职责',people:'居民身体与身份',echo:'回响调查',flight:'首航与返航',view:'界面',validation:'校验',clock:'时间',room:'维修间',outside:'荒林与原镇',engine:'通用操作',Button:'原生按钮',events:'原生事件',path:'原作行囊',world:'原作地图',ship:'原作飞船',fabricator:'原作制造',prestige:'原作继承',scoring:'原作评分',notifications:'消息记录',state_manager:'状态管理',localization:'语言设置',audio:'原生声音',audioLibrary:'原生声音清单',hub:'测试目录',session:'测试副本',catalog:'测试节点',manifest:'音乐目录',strings:'简体中文旧译'};
const title=f=>{const stem=path.basename(f).replace(/\.[^.]+$/,'');return titles[stem]||stem.split('-').map(x=>titles[x]||'补充').join('·');};
function chapter(f){
 const s=path.basename(f).replace(/\.[^.]+$/,'');
 if(f.includes('/testing/')||f.includes('体验测试'))return 8;
 if(f.includes('/script/')||f.includes('/lang/')||/Warning/.test(f))return 7;
 if(/^(future)/.test(s))return 4;
 if(/^(earth|space|archives|history)/.test(s))return 5;
 if(/^(city|census|conurbation|metro|intercity|corridor|passenger)/.test(s))return 2;
 if(/^(regions|regional|domain|polity|nation|foreign|diplomacy|statecraft|congress|leagues|aftermath|markets|transit|commerce|finance|relief|railway|security|equipment|accession|frontier|partnership|worldstage|settlement)/.test(s))return 3;
 if(/^(development|industry|modern|urban|origins|municipal|advanced|services|precision|heating|culture|cooperative|course|pacing)/.test(s))return 1;
 if(/^(zh|adapter|setup|expedition|incidents|hearth|wind|forecast|village|rules|decisions|population|generations|society|settlement)/.test(s))return 0;
 return 6;
}
const fields={cost:'所需物资',input:'投入',output:'产出',reward:'结果',requires:'前置',duration:'耗时（秒）',time:'耗时（秒）',jobs:'岗位',limit:'上限',capacity:'容量',power:'电量',health:'健康',damage:'伤害',delay:'间隔',chance:'概率',wood:'木料',food:'食物',scrap:'废料',fur:'毛皮',knowledge:'知识',medicine:'药品',tools:'工具',parts:'机械零件',electronics:'电子元件',iron:'铁锭',ore:'铁矿石',coal:'煤',steel:'钢材',water:'水',culture:'培养物',body:'身体载体',cell:'燃料组件',housing:'住房',population:'人口',workers:'人员',adults:'成年人',children:'儿童',elders:'老年人',distance:'距离',travel:'行程',beds:'床位',charge:'储能',cooldown:'冷却',x:'横坐标',y:'纵坐标',radius:'范围',count:'数量',amount:'数量',initial:'初始值',min:'下限',max:'上限',salary:'工资',wage:'工资',maintenance:'维护',budget:'预算',tax:'税收',debt:'债务',credit:'信用',trust:'信任',need:'需求',rate:'速率',interval:'间隔',target:'目标'};
const files=new Map(),records=[],numbers=[],numericRows=[],covered=new Map(),chinese=[],fallbacks=[],idCounts=new Map(),adaptedLabels=new Set();
const entryHTML=read('游戏/index.html');
const loaded=new Set([...entryHTML.matchAll(/<script[^>]+src=["']([^"']+)/g)].map(m=>'游戏/'+m[1].split('?')[0]));
function register(f,source,kind){if(!files.has(f))files.set(f,{file:f,sha256:hash(source),bytes:Buffer.byteLength(source),kind,loaded:loaded.has(f)||f==='游戏/index.html'});}
function uniqueID(f,anchor,original,kind){const seed=[f,anchor,original,kind].join('\0'),i=idCounts.get(seed)||0;idCounts.set(seed,i+1);return 'cw.'+hash(seed).slice(0,14)+(i?'.'+(i+1):'');}
function add(f,source,node,info){
 const original=source.slice(node.start,node.end),r={id:uniqueID(f,info.anchor||'',original,info.kind),file:f,line:node.loc?.start.line||1,column:node.loc?.start.column||0,start:node.start,end:node.end,original,originalHash:hash(original),sourceHash:hash(source),...info};
 r.chapter??=chapter(f);r.section=title(f);records.push(r);
 for(const span of info.spans||[]){const key=f+':'+span.start+':'+span.end;if(covered.has(key))throw Error('重复归属 '+key);covered.set(key,r.id);}
 return r;
}
function htmlText(raw){const dom=parseFragment(raw),parts=[];function visit(n){if(n.nodeName==='#text')parts.push(n.value);else if(['script','style'].includes(n.tagName))return;else{if(['p','div','br','li','tr','h1','h2','h3'].includes(n.tagName))parts.push('\n');for(const a of n.attrs||[])if(['title','aria-label','placeholder','alt'].includes(a.name)&&a.value.trim())parts.push(a.value);for(const c of n.childNodes||[])visit(c);}}visit(dom);return parts.join('').replace(/\n{3,}/g,'\n\n').trim();}
function polishText(s){return /<\/?[a-z][^>]*>/i.test(s)?htmlText(s):s;}
function parseJS(f,source,offset=0,whole=source){
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true,allowReturnOutsideFunction:true});
 const meta=new WeakMap(),nodes=[];
 function walk(n,parent=null,route='root',anc=[]){if(!n?.type)return;meta.set(n,{parent,route,anc});nodes.push(n);for(const [key,v]of Object.entries(n))if(!['loc','start','end'].includes(key)){if(Array.isArray(v))v.forEach((x,i)=>{if(x?.type)walk(x,n,route+'.'+key+'['+i+']',[...anc,n]);});else if(v?.type)walk(v,n,route+'.'+key,[...anc,n]);}}
 walk(ast);
 // Read only literal override keys; never execute content files to resolve translations.
 for(const n of nodes){
  const p=meta.get(n).parent;
  if(n.type==='ObjectExpression'&&(p?.type==='Property'&&name(p.key)==='labels'||p?.type==='CallExpression'&&source.slice(p.callee.start,p.callee.end)==='Object.assign'&&p.arguments[0]&&source.slice(p.arguments[0].start,p.arguments[0].end)==='CivilText.labels'))
   for(const prop of n.properties)if(prop.type==='Property'&&!prop.computed&&prop.value.type==='Literal'&&typeof prop.value.value==='string')adaptedLabels.add(String(name(prop.key)));
  if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&source.slice(n.left.object.start,n.left.object.end)==='CivilText.labels'&&(!n.left.computed||n.left.property.type==='Literal'))adaptedLabels.add(String(name(n.left.property)));
 }
 const props=n=>meta.get(n).anc.filter(x=>x.type==='Property').map(p=>String(name(p.key)));
 const anchor=n=>meta.get(n).anc.flatMap(a=>a.type==='VariableDeclarator'&&a.id.name?[a.id.name]:a.type==='Property'?[String(name(a.key))]:a.type==='FunctionDeclaration'&&a.id?[a.id.name]:[]).join('.');
 const callName=n=>n?.type==='Identifier'?n.name:n?.type==='MemberExpression'?String(name(n.property)):'';
 const location=n=>({start:n.start+offset,end:n.end+offset,loc:{start:{line:whole.slice(0,n.start+offset).split('\n').length,column:n.loc.start.column}}});
 const keyNode=n=>meta.get(n).parent?.type==='Property'&&meta.get(n).parent.key===n&&!meta.get(n).parent.computed;
 function uiLiteral(n){const p=meta.get(n).parent;if(p?.type==='Property'&&p.value===n&&/^(name|title|text|label|message|detail|description|notification|tooltip|alt|placeholder|aria-label)$/.test(name(p.key)))return true;
  return p?.type==='CallExpression'&&['text','html','createTextNode'].includes(callName(p.callee))&&p.arguments[0]===n;
 }
 function isError(n){return f.includes('validation')||meta.get(n).anc.some(a=>a.type==='ThrowStatement'||a.type==='NewExpression'&&/Error$/.test(callName(a.callee)));}
 function info(n,kind,text,spans,variables=[]){const ks=props(n),isKey=keyNode(n),error=isError(n);let tag=kind==='template'?'动态文本':isKey?'界面·账目键名':ks.some(k=>['name','title','label'].includes(k))?'界面·名称':/[。！？]/.test(text)?'叙述与说明':'界面文字';
  const fieldTags={ability:'科技·新能力',life:'科技·生活变化',choice:'科技·取舍',retires:'科技·退出旧操作',done:'完成提示',detail:'内容说明',description:'内容说明',notification:'系统提示'};
  if(kind!=='template'&&fieldTags[ks.at(-1)])tag=fieldTags[ks.at(-1)];
  if(ks.includes('buttons')&&ks.at(-1)==='text')tag='选项';
  let context='';for(const obj of meta.get(n).anc.filter(a=>a.type==='ObjectExpression')){const p=obj.properties.find(p=>p.type==='Property'&&['name','title'].includes(name(p.key))&&p.value.type==='Literal'&&typeof p.value.value==='string'&&han(p.value.value));if(p)context=p.value.value;}
  if(error)tag='系统提示·异常与校验';
  const note=isKey?'此文字兼作账目或查找键；可提改名建议，导入时须审核所有引用。':kind==='template'?'花括号由游戏填入；分支和列表另有条目，勿改占位符。':undefined;
  return {kind,tag,text:polishText(text),context,spans:spans.map(location),variables,anchor:anchor(n),astPath:meta.get(n).route,chapter:error||isKey?9:chapter(f),note};
 }
 for(const n of nodes){if(n.type==='Literal'&&typeof n.value==='string'&&han(n.value))chinese.push({file:f,...location(n),value:n.value});if(n.type==='TemplateElement'&&han(n.value.cooked||''))chinese.push({file:f,...location(n),value:n.value.cooked});}
 const handled=new Set();
 // Flatten only genuine string concatenations. Branches, calls and arithmetic stay as variables.
 for(const n of nodes){
  const p=meta.get(n).parent;if(!(n.type==='BinaryExpression'&&n.operator==='+'||n.type==='TemplateLiteral'))continue;
  if(p?.type==='BinaryExpression'&&p.operator==='+')continue;
  const spans=[],variables=[];
  function hasText(x){return x.type==='Literal'&&typeof x.value==='string'||x.type==='TemplateLiteral'||x.type==='BinaryExpression'&&x.operator==='+'&&(hasText(x.left)||hasText(x.right));}
  function flatten(x){
   if(x.type==='BinaryExpression'&&x.operator==='+'&&hasText(x))return flatten(x.left)+flatten(x.right);
   if(x.type==='Literal'&&typeof x.value==='string'){spans.push(x);return x.value;}
   if(x.type==='Literal'&&typeof x.value==='number')return String(x.value);
   if(x.type==='TemplateLiteral')return x.quasis.map((q,i)=>{spans.push(q);return (q.value.cooked??q.value.raw)+(x.expressions[i]?variable(x.expressions[i]):'');}).join('');
   // Numeric arithmetic is not evaluated by the exporter.
   return variable(x);
  }
  function variable(x){const key=(x.type==='ConditionalExpression'?'分支':/\.map\(|\.join\(/.test(source.slice(x.start,x.end))?'列表':'变量')+(variables.length+1);variables.push({placeholder:'{'+key+'}',expression:source.slice(x.start,x.end),...location(x)});return '{'+key+'}';}
  const text=flatten(n);if(!spans.some(s=>han(s.value?.cooked??s.value)))continue;
  const r=add(f,whole,location(n),info(n,'template',text,spans,variables));for(const s of spans)handled.add(s);
  if(!r.text.trim())r.note='此项是标记属性中的文字；回填需保持原标记结构。';
 }
 for(const n of nodes){
  if(handled.has(n))continue;
  if(n.type==='Literal'&&typeof n.value==='string'){
   if(han(n.value)||polishText(n.value).trim()&&uiLiteral(n))add(f,whole,location(n),info(n,'text',n.value,[n]));
   else {const p=meta.get(n).parent;if(p?.type==='CallExpression'&&callName(p.callee)==='_'&&p.arguments[0]===n)fallbacks.push({file:f,node:location(n),key:n.value,anchor:anchor(n),source:whole});}
  }else if(n.type==='TemplateElement'&&han(n.value.cooked||''))add(f,whole,location(n),info(n,'fragment',n.value.cooked,[n]));
  if(n.type==='Literal'&&typeof n.value==='number'){
   const ks=props(n),objects=meta.get(n).anc.filter(a=>a.type==='ObjectExpression');let owner='';
   for(const obj of objects){const p=obj.properties.find(p=>p.type==='Property'&&['name','title'].includes(name(p.key))&&p.value.type==='Literal'&&typeof p.value.value==='string'&&han(p.value.value));if(p)owner=p.value.value;}
   const negative=meta.get(n).parent?.type==='UnaryExpression'&&meta.get(n).parent.operator==='-',signed=negative?meta.get(n).parent:n;
   const row={file:f,...location(signed),anchor:anchor(n),astPath:meta.get(n).route,value:negative?-n.value:n.value,expression:whole.slice(Math.max(0,signed.start+offset-70),signed.end+offset+70),sourceHash:hash(whole)};numbers.push(row);
   if(f.startsWith('游戏/content/'))numericRows.push({...row,section:title(f),owner:owner||title(f),label:ks.filter(k=>fields[k]).map(k=>fields[k]).slice(-3).join(' · ')||'参数（含范围、序列或坐标）'});
  }
 }
}
const js=[];
for(const dir of ['游戏/content','游戏/src/postwar','游戏/script'])for(const file of fs.readdirSync(path.join(root,dir),{recursive:true}).sort())if(file.endsWith('.js'))js.push(dir+'/'+file.replaceAll(path.sep,'/'));
js.push('游戏/testing/hub.js','游戏/testing/session.js');
for(const f of js){const s=read(f);register(f,s,'javascript');parseJS(f,s);}

// Translation keys are identifiers, not duplicate editable English sentences.
const tf='游戏/lang/zh_cn/strings.js',ts=read(tf),translation=new Map();register(tf,ts,'translation');
const ta=parse(ts,{ecmaVersion:'latest',locations:true});const object=ta.body[0].expression.arguments[0];
for(const p of object.properties){const key=name(p.key),v=p.value;if(typeof v.value!=='string')continue;translation.set(key,v.value);add(tf,ts,v,{kind:'translation',tag:'旧版译文',text:v.value,spans:[v],anchor:key,translationKey:key,chapter:7,note:'原作兼容词库；不代表当前主线可达，也不作为战后文明世界观依据。'});if(han(v.value))chinese.push({file:tf,...v,value:v.value});}
for(const r of fallbacks)if(!translation.has(r.key)&&!adaptedLabels.has(r.key))add(r.file,r.source,r.node,{kind:'untranslated',tag:'原生调用·待核对',text:r.key,anchor:r.anchor,spans:[],chapter:7,note:'未从静态词库解析出译文，或由运行时替换；先核对实际界面，不直接改调用键。'});

for(const f of ['游戏/index.html','游戏/体验测试.html','游戏/browserWarning.html','游戏/mobileWarning.html']){
 const s=read(f);register(f,s,'html');const dom=parseHTML(s,{sourceCodeLocationInfo:true});
 function visit(n,hidden=false){const skip=hidden||['script','style','noscript'].includes(n.tagName),loc=n.sourceCodeLocation;
  if(n.nodeName==='#text'&&!skip&&n.value.trim()&&loc)add(f,s,{start:loc.startOffset,end:loc.endOffset,loc:{start:{line:loc.startLine,column:loc.startCol-1}}},{kind:'html',tag:'界面文字',text:n.value.trim(),anchor:'html-text',spans:[]});
  for(const a of n.attrs||[])if(['title','aria-label','placeholder','alt'].includes(a.name)||n.tagName==='meta'&&a.name==='content'&&(n.attrs||[]).some(a=>a.name==='name'&&['description','title'].includes(a.value))){const l=loc?.attrs?.[a.name];if(l&&a.value.trim())add(f,s,{start:l.startOffset,end:l.endOffset,loc:{start:{line:l.startLine,column:l.startCol-1}}},{kind:'html-attribute',tag:'界面·说明',text:a.value,anchor:n.tagName+'.'+a.name,spans:[]});}
  if(n.tagName==='script'&&!(n.attrs||[]).some(a=>a.name==='src')){const start=loc?.startTag?.endOffset,end=loc?.endTag?.startOffset;if(start!==undefined&&end!==undefined)parseJS(f,s.slice(start,end),start,s);}
  for(const c of n.childNodes||[])visit(c,skip);
 }visit(dom);
}
for(const dir of ['游戏/css','游戏/lang/zh_cn'])for(const file of fs.readdirSync(path.join(root,dir)))if(file.endsWith('.css')){
 const f=dir+'/'+file,s=read(f);register(f,s,'css');for(const m of s.matchAll(/\bcontent\s*:\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g)){if(!m[2].trim())continue;add(f,s,{start:m.index,end:m.index+m[0].length,loc:{start:{line:s.slice(0,m.index).split('\n').length,column:0}}},{kind:'css-content',tag:'界面·标记',text:m[2],anchor:'content',spans:[],chapter:6});}
}
for(const f of ['游戏/testing/catalog.json','游戏/audio/postwar/manifest.json']){
 const s=read(f);register(f,s,'json');const tree=parse('('+s+')',{ecmaVersion:'latest',locations:true});
 function walk(n,route=[]){if(!n?.type)return;if(n.type==='Property'){const k=String(name(n.key));if(n.value.type==='Literal'&&typeof n.value.value==='string'&&han(n.value.value)&&!['source','focusFile'].includes(k)&&!/^验证\//.test(n.value.value)){const v=n.value;add(f,s,{start:v.start-1,end:v.end-1,loc:v.loc},{kind:'json',tag:f.includes('audio/')?'界面·音乐名称':'测试入口文字',text:v.value,anchor:[...route,k].join('.'),spans:[],chapter:f.includes('/testing/')?8:6});}walk(n.value,[...route,k]);return;}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach((x,i)=>walk(x,[...route,String(i)]));else if(v?.type)walk(v,route);}}walk(tree);
}

const missing=chinese.filter(n=>!covered.has(n.file+':'+n.start+':'+n.end));
if(missing.length)throw Error('尚有未归属中文字符串：'+JSON.stringify(missing.slice(0,5)));
if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('文案标记重复');
for(const r of records)if(read(r.file).slice(r.start,r.end)!==r.original)throw Error('来源定位不匹配 '+r.id);
const readingOrder=['zh','setup','hearth','village','adapter','expedition','incidents','forecast','wind','population','generations','society','course','development','industry','modern','pacing','urban','municipal','services','city','census','city-institutions','city-labor','city-homes','city-network','conurbation','city-council','city-budget','city-governance','domain','regional','polity','nation','future','future-people','future-echo','earth','earth-flight','archives','history'];
const rank=f=>{const n=readingOrder.indexOf(path.basename(f,'.js'));return n<0?999:n;};
records.sort((a,b)=>a.chapter-b.chapter||rank(a.file)-rank(b.file)||a.file.localeCompare(b.file,'en')||a.start-b.start);
const intro=`# 《战后文明》作品完整文案\n\n> 说明：导出于 ${stamp}（北京时间）。这是当前源码文案，不是重新创作的剧本。\n\n## 阅读与修改须知\n\n1. 标签下面是原文，隐藏标记用于把改稿找回游戏。请保留标记、条目数量和原有顺序。\n2. 本轮只润色表达；不改玩法、人数、成本、时长、前置、权利、守恒和成败条件。\n3. 花括号是动态占位符，必须原样保留；同一模板内的分支选句和列表另有条目，不能把多个分支拼成同时发生。\n4. 短按钮和告警要清楚、克制；旁白可有画面，但不提前泄露未来时代。\n5. 需要增删设定、改名或调整功能时，另写“> 批注：……”而非直接改变事实。\n6. 旧版兼容词库与错误诊断单列。旧版星舰、异星等叙述不代表本作已做出地球篇之外的玩法。\n7. 相同字句可能服务不同场景；每个标记分别处理，不做全局替换。纯空格、标点、程序标识和布局样式不作为独立润色句。\n8. 改好后交回完整 Markdown，对 Codex 说：“请把我改过的文案导入正式游戏”。也可只交改过的分卷，注明卷号。\n\n## 推荐阅读顺序\n\n从求生、城镇、城市群读到国家、先进社会与首航，再处理通用界面。兼容译文、测试入口、错误诊断和数值参考最后看。章节代表功能分类，不声称线性解锁或每一旧分支都可到达。\n\n`;
function sectionText(rows){let s='',section='',context='';for(const r of rows){if(r.section!==section){section=r.section;context='';s+='\n### '+section+'\n\n';}if(r.context&&r.context!==context){context=r.context;s+='#### '+context+'\n\n';}s+='【'+r.tag+'】<!-- @'+r.id+' -->\n'+r.text+'\n';if(r.note)s+='\n> 说明：'+r.note+'\n';s+='\n';}return s;}
const main=intro+chapters.map((c,i)=>'## '+(i+1)+'、'+c+'\n\n'+sectionText(records.filter(r=>r.chapter===i))).join('\n')+`\n## 数值总表\n\n数值较多，完整静态内容表另存《数值与规则参考.md》。动态计算和程序常量定位表保留给研发核对。润色时只改文字，不改数字、单位或公式。\n\n## 附录：不能直接通过本文稿改写的内容\n\n- 人口、库存、年份、距离、价格和任期等运行结果用占位符保留，不把某个存档的当时结果写死。\n- 分支选择、列表顺序、动态条件由程序决定；改稿后由研发逐条判断，不用全局替换或一键导入。\n- 旧存档中的历史快照保持原件，不追改已经发生的旧记载。\n- 外语词库、第三方库、开发文档、测试夹具、生成音乐提示词与音频不是本次润色正文。\n`;
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'_导出基线'),{recursive:true});fs.mkdirSync(path.join(out,'分卷'),{recursive:true});
for(const f of managedBatches)fs.unlinkSync(path.join(out,f));
if(fs.existsSync(previous)){const folder=path.join(out,'历史版本');fs.mkdirSync(folder,{recursive:true});fs.copyFileSync(previous,path.join(folder,'作品完整文案_'+stamp.replace(/[^0-9]/g,'')+'.md'));}
function write(f,s){fs.writeFileSync(path.join(out,f),typeof s==='string'?s:JSON.stringify(s,null,2)+'\n');}
write('作品完整文案.md',main);write('_导出基线/作品完整文案.md',main);
// Each batch stays modest enough to edit without asking the model to omit the end of a large book.
const batches=[];let chunk=[],size=0,sequence=0;
function flush(){if(!chunk.length)return;const file='分卷/'+String(++sequence).padStart(2,'0')+'_'+chapters[chunk[0].chapter]+'.md',body='# 《战后文明》润色分卷 '+sequence+' · '+chapters[chunk[0].chapter]+'\n\n> 说明：只修改标记下的文字，保留全部占位符、数字、单位、标记与事实。请先读《给Gemini的润色提示词》。\n\n'+sectionText(chunk);write(file,body);batches.push({file,count:chunk.length,first:chunk[0].id,last:chunk.at(-1).id});chunk=[];size=0;}
for(const r of records){const len=r.text.length+(r.note?.length||0)+80;if(chunk.length&&(chunk[0].chapter!==r.chapter||size+len>26000||chunk.length>=250))flush();chunk.push(r);size+=len;}flush();
let numeric='# 《战后文明》数值与规则参考\n\n> 说明：这份资料供润色时核对，不改动。表格逐项保留内容表中的数值；条件判断、公式、兼容费率与程序常量另见研发定位资料。本表不能代替实际游戏规则。\n\n|所属内容|项目|数值|\n|---|---|---:|\n';
numericRows.forEach((r,i)=>{r.id='num.'+hash(r.file+'\0'+r.anchor+'\0'+r.astPath).slice(0,14);numeric+='|'+r.section+' · '+r.owner.replaceAll('|','／')+'|'+r.label+'|'+r.value+'|<!-- @'+r.id+' -->\n';});write('数值与规则参考.md',numeric);
write('文案定位.json',{schema:1,exportedAt:stamp,revision,offsetConvention:'JavaScript UTF-16 offsets; start inclusive, end exclusive; not an import command',records});
write('数值定位.json',{schema:1,revision,staticContent:numericRows,programNumbers:numbers,note:'所有数值字面量只作研发定位参考，含算法索引/坐标/内部版本；不是可直接修改的平衡表。公式与条件必须回到源代码审核。'});
const stats={exportedAt:stamp,revision,files:files.size,records:records.length,chineseLiteralSpans:chinese.length,uncoveredChinese:missing.length,uniqueIDs:new Set(records.map(r=>r.id)).size,batches,chapterCounts:chapters.map((name,i)=>({name,count:records.filter(r=>r.chapter===i).length})),numericContentRows:numericRows.length,numericProgramLiterals:numbers.length,sourceHashes:[...files.values()]};
write('导出校验.json',stats);
write('阅读顺序.md','# 《战后文明》Gemini润色包 · 从这里开始\n\n1. 先发送《给Gemini的润色提示词.md》，让它确认本轮只改文字，不改玩法。\n2. 完整稿供查阅；实际改稿建议每次上传一份分卷，按下表顺序。不要同时修改完整稿和分卷。\n3. 每卷都要求返回全部条目，保留隐藏标记、动态占位符、数字与单位。检查最后一条标记，防止回复截断。\n4. 保存返回的原始Markdown文件；全部完成后交回Codex，逐条审核并导回游戏。不要让Gemini据文稿直接改存档或批量替换代码。\n\n本包共'+records.length+'条、'+batches.length+'卷。第1—7类优先；第8—10类为原作兼容、测试入口和诊断／技术键名，默认只提建议。数值参考只读。完整稿与分卷内容相同，不是两批稿。\n\n|卷号|内容|条数|最后一个标记|\n|---|---|---:|---|\n'+batches.map((b,i)=>'|'+(i+1)+'|['+path.basename(b.file,'.md')+']('+b.file+')|'+b.count+'|'+b.last+'|').join('\n')+'\n\n正文中的“> 说明”不是游戏台词。动态句、短补句、兼容规则都按原有含义保留；不把不同分支连成同一段故事。润色包不含源码、定位资料、存档或凭据；来源基线留在项目内，改稿完成后用于审阅。\n');
const sourceTable='|来源|是否由正式入口直接加载|文案条目|用途|\n|---|---|---:|---|\n'+[...files.values()].map(f=>'|`'+f.file+'`|'+(f.loaded?'是':'否或经运行时使用')+'|'+records.filter(r=>r.file===f.file).length+'|'+title(f.file)+'|').join('\n');
write('来源清单.md','# 文案来源清单\n\n'+sourceTable+'\n');
const rm=path.join(out,'Readme_文案说明.md');if(fs.existsSync(rm)){let s=readOut(rm);s=s.replace(/<!-- export-meta-start -->[\s\S]*?<!-- export-meta-end -->/,'<!-- export-meta-start -->\n- 导出时间：'+stamp+'（北京时间）\n- 源码提交：`'+revision+'`\n- 文案：'+records.length+' 条；分卷：'+batches.length+'；静态数值：'+numericRows.length+' 项。\n<!-- export-meta-end -->');s=s.replace(/<!-- export-sources-start -->[\s\S]*?<!-- export-sources-end -->/,'<!-- export-sources-start -->\n'+sourceTable+'\n<!-- export-sources-end -->');write('Readme_文案说明.md',s);}
write('_导出基线/分卷哈希.json',Object.fromEntries([...batches.map(b=>b.file),'数值与规则参考.md'].map(f=>[f,hash(readOut(path.join(out,f)))])));
console.log(JSON.stringify({files:stats.files,records:stats.records,chineseLiteralSpans:stats.chineseLiteralSpans,uncoveredChinese:stats.uncoveredChinese,batches:batches.length,numericRows:numericRows.length,chapters:stats.chapterCounts},null,2));
