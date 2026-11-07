/* MPL-2.0 — English presentation catalog. State and save identifiers stay unchanged. */
var CivilEnglish = {
  locale:'zh', key:'preferences:postwar.language.v1', cache:new Map(), untranslated:new Set(),
  escape(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');},
  prepare(rows){
    this.exact=new Map();this.index=new Map();this.literalIndex=new Map();this.cache.clear();
    const slot=/\{[^{}]+\}/g;
    for(const row of rows){
      const source=row.source,target=row.text;if(!source||typeof target!=='string')continue;
      const slots=source.match(slot)||[];
      if(!slots.length){
        this.exact.set(source,target);
        if(/[\u4e00-\u9fff]/.test(source)){
          const first=source[0];if(!this.literalIndex.has(first))this.literalIndex.set(first,[]);
          this.literalIndex.get(first).push({source,target});
        }
        continue;
      }
      const parts=source.split(slot),anchor=parts.reduce((a,b)=>a.trim().length>b.trim().length?a:b,'');
      if(!anchor.trim())continue;
      const han=anchor.match(/[\u4e00-\u9fff]{1,3}/);
      const key=han?han[0]:anchor.slice(0,3);
      const entry={source,target,slots,anchor,key,parts:parts.filter(Boolean),weight:parts.join('').length,
        pattern:new RegExp('^'+parts.map(s=>this.escape(s)).join('([\\s\\S]*?)')+'$')};
      if(!this.index.has(key))this.index.set(key,[]);this.index.get(key).push(entry);
    }
    for(const list of this.literalIndex.values())list.sort((a,b)=>b.source.length-a.source.length);
    this.ready=true;
  },
  format(value,depth=0){
    if(typeof value!=='string'||!this.ready||depth>8)return value;
    if(this.exact.has(value))return this.exact.get(value);
    if(this.exact.has(value+'。'))return this.exact.get(value+'。').replace(/\.\s*$/,'');
    if(!/[\u4e00-\u9fff]/.test(value))return value;
    if(this.cache.has(value))return this.cache.get(value);
    if(typeof CivilEditorial!=='undefined'){
      const reviewed=CivilEditorial.format(value);
      if(reviewed!==value){const translated=this.format(reviewed,depth+1);if(!/[\u4e00-\u9fff]/.test(translated)){this.cache.set(value,translated);return translated;}}
    }
    const scaled=value.match(/^(-?[\d,]+(?:\.\d+)?)(万|亿)(.*)$/);
    if(scaled){const n=Number(scaled[1].replace(/,/g,''))*(scaled[2]==='万'?10000:100000000);return n.toLocaleString('en-US',{maximumFractionDigits:2})+(scaled[3]?' '+this.format(scaled[3],depth+1):'');}

    const candidates=new Set();
    for(let i=0;i<value.length;i++)for(let n=1;n<=3;n++){
      const list=this.index.get(value.slice(i,i+n));if(list)for(const row of list)candidates.add(row);
    }
    let output;
    for(const row of [...candidates].sort((a,b)=>b.weight-a.weight||a.slots.length-b.slots.length)){
      if(!value.includes(row.anchor)||!row.parts.every(part=>value.includes(part)))continue;
      const match=row.pattern.exec(value);if(!match)continue;
      const values=new Map(row.slots.map((s,i)=>[s,this.format(match[i+1],depth+1)]));
      output=row.target.replace(/\{[^{}]+\}/g,s=>values.get(s)??s);break;
    }
    if(output===undefined||/[\u4e00-\u9fff]/.test(output)){
      // Longest literal fragments cover labels embedded in numeric summaries.
      output='';
      for(let i=0;i<value.length;){
        const found=(this.literalIndex.get(value[i])||[]).find(r=>value.startsWith(r.source,i));
        if(found){if(/[A-Za-z0-9]$/.test(output)&&/^[A-Za-z]/.test(found.target))output+=' ';output+=found.target;i+=found.source.length;}else output+=value[i++];
      }
    }
    output=output.replace(/。/g,'.').replace(/，/g,', ').replace(/：/g,': ').replace(/；/g,'; ').replace(/（/g,' (').replace(/）/g,')').replace(/、/g,', ');
    if(/[\u4e00-\u9fff]/.test(output)&&value.includes('\n'))output=value.split('\n').map(s=>this.format(s,depth+1)).join('\n');
    if(/[\u4e00-\u9fff]/.test(output)&&value.includes('　'))output=value.split('　').map(s=>this.format(s,depth+1)).join(' — ');
    if(/[\u4e00-\u9fff]/.test(output)&&/[。；\n]/.test(value)){
      const pieces=value.split(/([。；\n])/);
      if(pieces.length>1)output=pieces.map(s=>/^[。；·\n]$/.test(s)?({'。':'. ','；':'; ','·':' · ','\n':'\n'}[s]):this.format(s.trim(),depth+1)).join('');
    }
    if(/[\u4e00-\u9fff]/.test(output)&&value.includes('·'))output=value.split('·').map(s=>this.format(s.trim(),depth+1)).join(' · ');
    if(/[\u4e00-\u9fff]/.test(output)){if(this.untranslated.size<512)this.untranslated.add(value);output=value;}
    output=output.replace(/([.!?])(?=[A-Z])/g,'$1 ');
    if(this.cache.size>=2048)this.cache.clear();this.cache.set(value,output);return output;
  },
  originalText(node){const prior=this.nodes?.get(node);return prior&&node.nodeValue===prior.output?prior.source:node.nodeValue;},
  textNode(node){
    if(!node.parentElement||node.parentElement.closest('script,style,textarea,input,code,[contenteditable="true"],[data-no-translate]'))return;
    const source=this.originalText(node),output=this.locale==='en'?this.format(source):source;
    if(node.nodeValue!==output)node.nodeValue=output;
    this.nodes.set(node,{source,output});
  },
  element(node){
    if(node.closest('script,style,code,[contenteditable="true"],[data-no-translate]'))return;
    let stored=this.attributes.get(node);if(!stored){stored=new Map();this.attributes.set(node,stored);}
    for(const name of ['title','aria-label','placeholder','data-legend','label']){
      const current=node.getAttribute(name);if(current===null)continue;
      const old=stored.get(name),source=old&&current===old.output?old.source:current;
      const output=this.locale==='en'?this.format(source):source;
      if(output!==current)node.setAttribute(name,output);stored.set(name,{source,output});
    }
  },
  paint(root){
    if(!root?.isConnected)return;
    if(root.nodeType===3){this.textNode(root);return;}
    if(root.nodeType!==1)return;
    this.element(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){if(node.nodeType===3)this.textNode(node);else this.element(node);}
  },
  observe(){this.observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','data-legend','label']});},
  flush(){
    this.scheduled=false;this.observer.disconnect();
    const roots=[...this.pending];this.pending.clear();
    for(const root of roots)if(!roots.some(other=>other!==root&&other.contains?.(root)))this.paint(root);
    this.menu();this.observe();
  },
  menu(){
    const menu=document.querySelector('.menu');if(!menu||document.getElementById('civilLanguage'))return;
    const button=document.createElement('button');button.id='civilLanguage';button.className='menuBtn';button.type='button';
    button.textContent=this.locale==='en'?'简体中文':'English';button.dataset.noTranslate='true';
    button.addEventListener('click',()=>this.select(this.locale==='en'?'zh':'en'));menu.appendChild(button);
  },
  async select(locale){
    this.locale=locale==='en'?'en':'zh';this.observer.disconnect();
    document.documentElement.lang=this.locale==='en'?'en':'zh-CN';
    this.paint(document.documentElement);
    const button=document.getElementById('civilLanguage');if(button)button.textContent=this.locale==='en'?'简体中文':'English';
    this.observe();
    try{await CivilLocalSaves.writeRaw(this.key,this.locale);}catch{/* Device preference failure never touches the world. */}
  },
  async install(){
    if(this.observer||typeof CivilEnglishText==='undefined')return;
    this.prepare(CivilEnglishText);this.nodes=new WeakMap();this.attributes=new WeakMap();this.pending=new Set();
    this.observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='childList')for(const node of record.addedNodes)this.pending.add(node);
        else this.pending.add(record.target);
      }
      if(!this.scheduled&&this.pending.size){this.scheduled=true;requestAnimationFrame(()=>this.flush());}
    });
    try{const value=await CivilLocalSaves.readRaw(this.key);this.locale=value==='en'?'en':'zh';}catch{}
    const requested=new URLSearchParams(location.search).get('lang');
    if(requested==='en'||requested==='zh'){this.locale=requested;try{await CivilLocalSaves.writeRaw(this.key,this.locale);}catch{}}
    document.documentElement.lang=this.locale==='en'?'en':'zh-CN';
    this.paint(document.documentElement);this.menu();this.observe();
  }
};
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>CivilEnglish.install());
