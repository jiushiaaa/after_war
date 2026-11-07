/* MPL-2.0 — Loaded ONLY by the local /test-game.html entry, never by index.html.
 * Imports immutable, checked native saves. No resources, unlocks or simulation time are injected.
 * Every launch has its own IndexedDB namespace; neither local normal saves nor cloud saves are read.
 */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search),scenario=params.get('scenario'),run=params.get('run');
  const valid=/^[a-z0-9-]+$/.test(scenario||'')&&/^[a-z0-9-]{16,64}$/.test(run||'');
  const session=window.CivilTestSession={scenario,run,page:params.get('page')||'room',catalog:null,entry:null,ready:false};
  // Establish isolation even on invalid/missing input: startup recovery must never open normal slots.
  CivilLocalSaves.database=valid?'postwar-test-v1-'+scenario+'-'+run:'postwar-test-invalid';
  CivilSound.key='postwar.test.sound.v1';
  const savedInit=Engine.init,savedPause=Civilization.setPaused;
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const tell=text=>{const e=document.getElementById('testNotice');if(e)e.textContent=text;};
  async function request(url,type='json'){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{const r=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('测试节点读取失败（'+r.status+'），请检查完整仓库与本地服务');return type==='text'?await r.text():await r.json();}
    finally{clearTimeout(timer);}
  }
  function remember(){const value={scenario,run,page:session.page,title:session.entry.title};import('./bookmark.js').then(m=>m.writeBookmark(value)).catch(()=>{});}
  function option(id,value){return [...(document.getElementById(id)?.options||[])].some(o=>o.value===value);}
  function available(page){
    const exists=id=>!!document.getElementById(id),c=State.civilization;
    switch(page){
      case 'room':return true;
      case 'outside':return exists('location_outside');
      case 'road':return !!Civilization.roadModule;
      case 'research':return !!CivilInterface.researchModule;
      case 'laws':return exists('location_council');
      case 'city':case 'census':case 'production':return !!CivilCityView.module;
      case 'lake':return !!c.conurbation?.node;
      case 'network':return !!c.conurbation?.node;
      case 'budget':return !!c.cityCouncil;
      case 'domain':return CivilDomain.available(State);
      case 'trade':return option('politySection','trade');
      case 'war':return option('politySection','conflict');
      case 'equipment':return option('politySection','equipment');
      case 'future':case 'bodies':return !!c.polity?.future;
      case 'echo':return option('futureSection','echo');
      case 'earth':return !!c.polity?.earth;
      case 'space':return option('earthSection','flight');
      case 'history':return CivilHistory.available(State);
      case 'archives':return CivilHistory.available(State)&&Object.keys(c.archives?.records||{}).length>0;
      case 'ending':return !!c.polity?.earth?.ending;
      default:return false;
    }
  }
  function tab(id){const e=document.getElementById('location_'+id);if(e)e.click();}
  function scroll(id){
    clearTimeout(session.scrollTimer);
    // Wait for the selected native page to render before locating its subsection.
    session.scrollTimer=setTimeout(()=>{
      const e=document.getElementById(id);if(!e)return;
      for(let p=e;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
      e.scrollIntoView({block:'start'});
    },700);
  }
  function navigate(page){
    if(Events.activeEvent()){tell('请先处理或关闭当前事件，再切换页面。');return false;}
    if(!available(page)){tell('此节点尚未开放“'+(session.catalog.pages[page]||page)+'”；保留原来的解锁条件。');return false;}
    if(['room','outside','road'].includes(page))tab(page);
    else if(page==='research')tab('research');
    else if(page==='laws')tab('council');
    else if(['city','census','production'].includes(page)){
      CivilConurbationView.selected='home';CivilCityView.view=page==='city'?'overview':page;CivilCityView.refresh(State);tab('city');scroll(page==='city'?'cityOverview':'cityViews');
    }else if(['lake','network','budget','domain','trade','war','equipment'].includes(page)){
      const selected={lake:'lake',network:'link',budget:'council'}[page]||'domain';
      CivilConurbationView.select(selected);tab('city');
      if(['trade','war','equipment'].includes(page)){CivilPolityView.section={trade:'trade',war:'conflict',equipment:'equipment'}[page];CivilPolityView.task='';CivilPolityView.refresh(State);scroll('polityDesk');}
      else scroll({lake:'metroCityTitle',network:'cityNetworkBody',budget:'cityCouncilBody',domain:'domainBody'}[page]);
    }else if(['future','bodies','echo'].includes(page)){
      $('#earthDesk').prop('open',false);CivilFutureView.section={future:'construction',bodies:'people',echo:'echo'}[page];CivilFutureView.task='';CivilFutureView.refresh(State);tab('research');scroll('futureDesk');
    }else if(['earth','space'].includes(page)){CivilEarthView.go(page==='space'?'flight':'regions');scroll('earthDesk');}
    else if(page==='ending')CivilArchives.openScroll(State);
    else{CivilHistory.open(State);if(page==='archives'&&Events.activeEvent()?.scenes.archives_0)Events.loadScene('archives_0');}
    // Reflow the same native page used by the normal entry; no separate test-only viewport.
    Engine.realign();document.getElementById('main').scrollLeft=0;
    session.page=page;document.getElementById('testPage').value=page;remember();
    const url=new URL(location.href);url.searchParams.set('page',page);history.replaceState(null,'',url);
    tell('已打开：'+session.catalog.pages[page]+'。'+(CivilClock.paused?'时间已暂停，可先查看；准备好后继续运行。':'时间正在推进。'));return true;
  }
  session.available=available;session.navigate=navigate;
  function updatePages(){
    const select=document.getElementById('testPage');if(!select||!session.ready)return;
    const pages=Object.keys(session.catalog.pages).filter(available),signature=pages.join(',');if(select.dataset.pages!==signature){const chosen=select.value||session.page;select.replaceChildren();for(const id of pages){const o=node('option',session.catalog.pages[id]);o.value=id;select.append(o);}select.dataset.pages=signature;select.value=pages.includes(chosen)?chosen:pages[0];}
  }
  function shell(){
    if(document.getElementById('testToolbar'))return;
    document.body.classList.add('test-session');
    const bar=node('aside');bar.id='testToolbar';bar.setAttribute('aria-label','独立测试工具');
    const top=node('div');top.className='test-tools';const title=node('strong','正在读取测试节点…');title.id='testTitle';top.append(title);
    const label=node('label','页面 '),select=node('select');select.id='testPage';select.disabled=true;select.setAttribute('aria-label','跳转已解锁的游戏页面');label.append(select);top.append(label);
    select.addEventListener('keydown',e=>{const move={ArrowDown:1,ArrowUp:-1,Home:-Infinity,End:Infinity}[e.key];if(move===undefined||e.altKey||e.ctrlKey||e.metaKey)return;e.preventDefault();select.selectedIndex=Math.max(0,Math.min(select.options.length-1,move===-Infinity?0:move===Infinity?select.options.length-1:select.selectedIndex+move));});
    const button=(id,text,fn)=>{const b=node('button',text);b.type='button';b.id=id;b.disabled=true;b.onclick=fn;top.append(b);return b;};
    button('testGo','转到',()=>navigate(select.value));
    button('testPause','继续运行',()=>Civilization.setPaused(!CivilClock.paused));
    button('testSave','保存测试',async()=>{try{const done=await CivilLocalSaves.save(CivilLocalSaves.active||1,true);tell(done?'已保存到这个测试副本。正式存档未改。':'请先完成新世界设定，再保存测试。');}catch(e){tell('测试尚未保存：'+e.message+'。可以导出备份。');}});
    button('testExport','导出',()=>CivilPlatform.download());
    button('testReset','重来此节点',()=>{const url=new URL(location.href);url.searchParams.set('run',crypto.randomUUID());url.searchParams.delete('resume');window.open(url.href,'_blank','noopener');});
    const back=node('a','← 体验目录');back.href='/test.html';top.append(back);bar.append(top);
    const notice=node('p','正在校验原始存档，完成后自动暂停。正式存档与云存档不参与本次测试。');notice.id='testNotice';notice.setAttribute('role','status');bar.append(notice);
    const details=node('details'),summary=node('summary','这个节点可以试什么？');details.append(summary);const focus=node('p');focus.id='testFocus';details.append(focus);bar.append(details);
    for(const name of ['keydown','keyup'])bar.addEventListener(name,e=>e.stopPropagation());
    document.body.prepend(bar);
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>document.documentElement.style.setProperty('--test-bar-height',bar.offsetHeight+'px')).observe(bar);
  }
  if(document.body)shell();else document.addEventListener('DOMContentLoaded',shell,{once:true});
  CivilPlatform.load=async function(){
    this.sdk=null;this.loaded=false;this.error=null;
    if(!valid)throw Error('测试链接无效，请从体验目录重新进入。');
    session.catalog=await request('testing/catalog.json');session.entry=session.catalog.scenarios.find(s=>s.id===scenario);
    if(!session.entry)throw Error('测试节点不在目录中，请从体验目录重新进入。');
    const active=await CivilLocalSaves.readRaw('active'),row=await CivilLocalSaves.readRaw('slot'+(active===undefined?1:active));
    let state;
    if(active!==undefined&&active!==null&&row===undefined)throw Error('测试保存槽为空；原副本未覆盖，请检查其他测试槽或返回目录新开副本。');
    if(active!==undefined||row!==undefined)state=await CivilLocalSaves.load();
    else if(params.has('resume')&&session.entry.source)throw Error('这个浏览器里没有该测试的保存进度。请返回目录新开副本。');
    else if(session.entry.source){
      const text=await request('testing/saves/'+scenario+'.json','text');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
      if(hash!==session.entry.sha256)throw Error('原始存档校验未通过，未创建测试副本。');
      state=await this.decodeSave(text);
    }else state={};
    this.loaded=true;return state;
  };
  // Existing checkpoints are direct previews; a fresh world exercises the real opening screen.
  if(typeof CivilLanding!=='undefined'){
    const showLanding=CivilLanding.show;
    CivilLanding.show=function(state,onError){
      if(session.entry?.source){Engine.init({state});return;}
      return showLanding.call(this,state,onError);
    };
  }
  Engine.init=function(options){
    const result=savedInit.call(this,options);Civilization.setPaused(true);session.ready=true;shell();
    const e=session.entry;document.getElementById('testTitle').textContent='测试副本 · '+session.catalog.routes[e.route]+' · '+e.title;
    document.getElementById('testFocus').textContent=e.focus+' 刷新读取本副本最近的保存；“重来此节点”另开初始副本。';
    for(const b of document.querySelectorAll('#testToolbar button,#testToolbar select'))b.disabled=false;
    updatePages();remember();
    if(Events.activeEvent())tell('测试已暂停。请先完成当前事件，再用顶部“继续运行”推进。');else navigate(session.page);
    // Save the imported copy immediately; this database was isolated before any storage call.
    CivilLocalSaves.save().then(ok=>{if(!ok&&State.civilization.setup?.confirmed!==false)tell('测试副本尚未保存，请点“保存测试”重试，或导出文件。');});
    clearInterval(session.pageTimer);session.pageTimer=setInterval(updatePages,2000);return result;
  };
  Civilization.setPaused=function(value){const r=savedPause.call(this,value),b=document.getElementById('testPause');if(b){b.textContent=value?'继续运行':'暂停';b.setAttribute('aria-pressed',String(!value));}return r;};
})();
