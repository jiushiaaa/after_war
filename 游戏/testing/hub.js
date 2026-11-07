/* Local testing catalogue; entering a node always creates a separate browser database. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  let catalog,route='all',stage='recommended',resumeRequest=0;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function href(s,page,run=crypto.randomUUID()){return '/test-game.html?'+new URLSearchParams({scenario:s.id,page,run});}
  async function resume(){const request=++resumeRequest;try{const {readBookmark}=await import('./bookmark.js'),last=await readBookmark();if(request!==resumeRequest)return;const s=catalog.scenarios.find(s=>s.id===last?.scenario),a=$('#resume');a.hidden=true;if(!s||!/^[a-z0-9-]{16,64}$/.test(last.run))return;a.href=href(s,s.pages.includes(last.page)?last.page:s.pages[0],last.run)+'&resume=1';a.textContent='继续上次测试：'+catalog.routes[s.route]+' · '+s.title+' →';a.target='_blank';a.rel='noopener';a.hidden=false;}catch{if(request===resumeRequest)$('#resume').hidden=true;}}
  function controls(id,values,current,change){const box=$(id);box.replaceChildren();for(const [id,label]of Object.entries(values)){const b=el('button',label);b.type='button';b.dataset.value=id;b.setAttribute('aria-pressed',String(id===current));b.onclick=()=>{change(id);for(const item of box.children)item.setAttribute('aria-pressed',String(item===b));render();};box.append(b);}}
  function render(){
    const q=$('#search').value.trim().toLocaleLowerCase();
    const items=catalog.scenarios.filter(s=>(route==='all'||s.route===route||s.route==='shared')&&(stage==='all'||stage==='recommended'&&s.recommended||s.stage===stage)&&(!q||[s.title,s.description,s.focus,catalog.routes[s.route],...s.pages.map(p=>catalog.pages[p])].join(' ').toLocaleLowerCase().includes(q)));
    $('#catalog').replaceChildren();$('#empty').hidden=items.length!==0;$('#status').textContent=`${items.length} / ${catalog.scenarios.length} 个体验节点 · 先选页面，再进入独立副本`;
    for(const [group,label]of Object.entries(catalog.stages)){
      const list=items.filter(s=>s.stage===group);if(!list.length)continue;
      const section=el('section',undefined,'stage'),heading=el('div',undefined,'stage-heading');heading.append(el('h2',label),el('span',String(Object.keys(catalog.stages).indexOf(group)+1).padStart(2,'0')));section.append(heading);const cards=el('div',undefined,'cards');
      for(const s of list){
        const card=el('article',undefined,'card');card.dataset.scenario=s.id;
        const meta=el('div',undefined,'eyebrow');meta.append(el('span',catalog.routes[s.route]),el('span',s.source?'重建 '+s.year+' 年':'全新世界'));card.append(meta,el('h3',s.title),el('p',s.description,'description'));
        const focus=el('p',undefined,'focus');focus.append(el('strong','试什么'),document.createTextNode(s.focus));card.append(focus);
        const entry=el('div',undefined,'entry'),label=el('label','直接打开'),select=el('select');select.setAttribute('aria-label',catalog.routes[s.route]+' · '+s.title+'：落地页面');for(const p of s.pages){const o=el('option',catalog.pages[p]);o.value=p;select.append(o);}label.append(select);
        const a=el('a','进入体验 ↗','enter');a.target='_blank';a.rel='noopener';a.href=href(s,select.value);a.setAttribute('aria-label','进入'+catalog.routes[s.route]+'：'+s.title);
        select.onchange=()=>a.href=href(s,select.value);a.addEventListener('click',()=>{a.href=href(s,select.value);});entry.append(label,a);card.append(entry);
        if(s.source){const details=el('details',undefined,'source');details.append(el('summary','原始记录'),el('p',s.source),el('p','真实 UI 验收档 · 规则 '+s.ruleset+' / 节奏 '+s.pacingVersion+' · 保留当时的选择与损失'));card.append(details);}
        cards.append(card);
      }section.append(cards);$('#catalog').append(section);
    }
  }
  async function main(){
    if(location.protocol==='file:')throw Error('请通过本地游戏服务打开这个 HTML');
    const r=await fetch('testing/catalog.json');if(!r.ok)throw Error('体验目录暂时不可用');catalog=await r.json();
    controls('#routes',{all:'两条路线',public:'公共路线',industry:'工业路线'},route,x=>route=x);
    controls('#stages',{recommended:'先看这些',all:'全部阶段',...catalog.stages},stage,x=>stage=x);
    $('#search').addEventListener('input',()=>{if($('#search').value&&stage==='recommended'){stage='all';for(const b of $('#stages').children)b.setAttribute('aria-pressed',String(b.dataset.value==='all'));}render();});render();resume();window.addEventListener('focus',resume);window.addEventListener('storage',resume);
  }
  main().catch(e=>{$('#status').textContent=e.message;$('#serverHelp').hidden=false;});
})();
