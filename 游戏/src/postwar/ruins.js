/* MPL-2.0 — Finite nearby field work by existing residents, paid choices and recoverable pauses. */
CivilMunicipalContent.jobs.push('ruinworker');
CivilText.labels.ruinworker='遗迹勘探员';
var CivilRuins={
  pendingIds:['ruin_river'],
  phases:{survey:{name:'外围勘察',seconds:180,cost:{wood:20,food:20,tools:8,medicine:4}},relocate:{name:'诱导巢群迁移',seconds:240,cost:{wood:20,food:16}},barrier:{name:'加固隔离通道',seconds:180,cost:{iron:12,tools:6}},preserve:{name:'保全设备与整理档案',seconds:300,cost:{parts:8,tools:4}},recycle:{name:'拆解设备材料',seconds:180,cost:{tools:6}}},
  data(s){return s.civilization.ruins;},
  eligible(s,id='river'){return id==='river'&&!!(CivilMunicipal.data(s,id)?.town&&CivilMunicipal.canAccept(s,id)&&s.civilization.tech.survey&&s.civilization.tech.records&&s.civilization.tech.sanitation);},
  active(s){const r=this.data(s)?.stages.at(-1);return r&&r.endedAt===null?r:null;},
  enabled(s){return this.data(s)?.controls.at(-1)?.enabled??true;},
  needsWorkers(s,id){return id==='river'&&!!this.active(s)&&this.enabled(s);},
  choices(s){const d=this.data(s),last=d?.stages.at(-1);if(!d)return ['survey'];if(this.active(s)||d.completedAt!==null)return [];return last.kind==='survey'?['relocate','barrier']:['preserve','recycle'];},
  start(s,kind){
    if(!this.eligible(s)||!this.choices(s).includes(kind))return false;
    const n=CivilMunicipal.node(s,'river'),cost=this.phases[kind].cost;
    if(n.health<60||n.stores.food<CivilMunicipal.foodReserve(s,'river')+(cost.food||0)||!CivilMunicipal.pay(n.stores,cost))return false;
    const c=s.civilization;if(!c.ruins)c.ruins={schema:1,site:'river_depot',introducedAt:c.elapsed,controls:[],stages:[],completedAt:null,reward:null};
    c.ruins.stages.push({kind,startedAt:c.elapsed,lastTick:c.elapsed,remaining:this.phases[kind].seconds,endedAt:null,paid:{...cost}});
    CivilMunicipal.planWorkers(s,'river');return true;
  },
  setEnabled(s,value){const d=this.data(s);if(!d||!this.active(s)||typeof value!=='boolean'||this.enabled(s)===value)return false;d.controls.push({at:s.civilization.elapsed,enabled:value});CivilMunicipal.planWorkers(s,'river');return true;},
  reason(s){
    if(!this.enabled(s))return '勘探已暂缓，进度与已用材料保留';
    if(!CivilMunicipal.canAccept(s,'river'))return '先恢复地方议约';
    const n=CivilMunicipal.node(s,'river'),e=CivilMunicipal.data(s,'river').economy;
    if(n.health<60||!e||s.civilization.elapsed-e.at>10||!e.education||!e.treatment)return '先维持居民健康、教学与诊疗';
    if(n.stores.food<CivilMunicipal.foodReserve(s,'river'))return '先留下120秒居民口粮';
    if((n.workers.ruinworker||0)<4)return '生产与公共服务之外还需4位成年人';
    return null;
  },
  reward(kind){return kind==='preserve'?{stores:{knowledge:40,glass:12,parts:12},robot:1}:{stores:{steel:20,parts:30},robot:0};},
  tick(s){
    const r=this.active(s);if(!r||r.lastTick>=s.civilization.elapsed)return;r.lastTick=s.civilization.elapsed;
    if(this.reason(s))return;r.remaining=Math.max(0,r.remaining-1);if(r.remaining)return;
    r.endedAt=s.civilization.elapsed;const d=this.data(s);
    if(['preserve','recycle'].includes(r.kind)){
      d.completedAt=r.endedAt;d.reward=this.reward(r.kind);const st=CivilMunicipal.node(s,'river').stores;
      for(const [k,v]of Object.entries(d.reward.stores))st[k]=(st[k]||0)+v;
      CivilMunicipal.note(r.kind==='preserve'?'河谷旧维护库现场已清理完毕：一台传动轴断裂的维护机器人打上铅封存入地库，残存档案与可用零部件如实归入地方仓储。该设备暂不具备开机效能。':'河谷旧维护库已彻底破拆清点完毕，回收之型钢与零部件尽数划拨地方公库。此处废墟已被清空，不再产出任何次生建材。');
    }else CivilMunicipal.note(r.kind==='survey'?'勘探队员在检修通道深处发现盘踞的变异甲虫巢群。针对旧维护库的通路状况，亟须定夺切实可行的现场处置预案。':'旧维护库的隔离通道已安全疏通，决策层须决定是对核心设备与档案予以就地保全，还是彻底拆解破产取材。');
    CivilMunicipal.planWorkers(s,'river');
  },
  status(s){
    const d=this.data(s),r=this.active(s);if(!d)return '河谷城外的旧维护库有断裂管道和活动痕迹，尚未勘察';
    if(r)return this.phases[r.kind].name+' · 余'+r.remaining+'工秒 · '+(this.reason(s)||'4位现有居民轮班作业');
    if(d.completedAt!==null)return d.reward.robot?'已清点：损坏维护机1台已封存；需后续电子与机械修复，当前不替代工人':'已拆解清点；此遗迹不会再次补充材料';
    return d.stages.length===1?'发现变异甲虫巢群，等待选择迁移或隔离':'通道已开放，等待选择保全档案与设备，或拆解取材';
  },
  event(id){
    if(id!=='ruin_river'||!this.eligible(State)&&!this.data(State))return null;
    const s=State,sig=()=>JSON.stringify([this.data(s)?.stages.length||0,this.active(s)?.kind||null,this.data(s)?.controls.length||0]),expected=sig();
    const action=fn=>()=>{if(s.civilization.pending!==id||sig()!==expected||!fn())return false;s.civilization.pending=null;Civilization.refresh();Engine.saveGame();return true;},buttons={};
    for(const kind of this.choices(s))buttons[kind]={text:this.phases[kind].name,nextScene:'end',onChoose:action(()=>this.start(s,kind))};
    if(this.active(s))buttons.schedule={text:this.enabled(s)?'暂缓勘探':'恢复勘探',nextScene:'end',onChoose:action(()=>this.setEnabled(s,!this.enabled(s)))};
    buttons.close={text:'关闭',nextScene:'end',onChoose:()=>{if(s.civilization.pending===id)s.civilization.pending=null;}};
    const d=this.data(s),texts=['此系河谷城外当日可徒步往返之旧时代战备维护库。指派4名在册成年劳力轮值排班，其归属仍系于本地户籍与日常口粮配额；现场干粮按外勤特批核拨。此项作业绝不得挤占常规生产、市政营建、学堂教学与医疗诊治，凡遇缺员或粮荒即行停摆；暂缓勘探不予退还已耗损物料。'];
    if(!d)texts.push('外围勘察规程：耗用地方木料20、食物20、工具8、药品4，累计作业180工秒。先行测绘周边地质与辐射环境方可纵深掘进，绝无不劳而获之横财或凭空虚增人口。');
    else if(d.stages.length===1&&!this.active(s))texts.push('变异硬壳甲虫依附地热管沟残温结巢盘踞，生人逼近即躁动结阵护卵。诱导迁移方案：耗用木料20、食物16，耗时240工秒，循气味信息素布设引向废弃荒沟的诱导轨迹。加固隔离方案：耗用铁料12、工具6，耗时180工秒，浇筑铁骨封闭巢穴裂隙，另行支撑掘进副通道。两项抉择均详录现场档案备查。');
    else if(d.stages.length===2&&!this.active(s))texts.push('库房内仅存少量密封储备及一台伺服关节彻底卡死的旧型维护机。保全方案：耗费零件8、工具4，耗时300工秒，清理起获知识40、玻璃12、机械零件12，封存损坏维护机1台；该机体暂不可用。拆解方案：耗费工具6，耗时180工秒，割裂破拆得钢材20、零件30，机体结构不予保留。两项决议互斥且终身只得结项一次，绝不凭此直接获得量产科技。');
    if(d?.completedAt!==null&&d?.reward)texts.push('本次已入河谷仓库：'+Object.entries(d.reward.stores).map(([k,v])=>({knowledge:'知识',glass:'玻璃',parts:'机械零件',steel:'钢材'}[k]+' '+v)).join('、')+'。这里只查看已完成记录，不再次领取。');
    texts.push(this.status(s));return {title:'河谷旧维护库',text:texts,buttons};
  },
  refresh(s,id){
    const visible=id==='river'&&(this.eligible(s)||!!this.data(s));let box=$('#civilRuinStatus');if(!box.length)box=$('<p>').attr('id','civilRuinStatus').addClass('civil-brief').insertAfter('#municipalStatus');box.text(this.status(s)).toggle(visible);
    let button=$('#ruinButton');if(visible)button=Civilization.button('ruinButton','旧维护库','#municipalPanel',()=>{if(!Events.activeEvent()&&!s.civilization.pending){s.civilization.pending='ruin_river';Civilization.showPending();}});button.toggle(visible).insertAfter(box);
  },
  validate(s){
    const d=this.data(s);if(d===undefined)return;const c=s.civilization;
    const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k)),int=(x,max=c.elapsed)=>Number.isSafeInteger(x)&&x>=0&&x<=max,fail=()=>{throw Error('遗迹现场与回收记录无效');},same=(a,b)=>obj(a)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>a[k]===v);
    if(!exact(d,['schema','site','introducedAt','controls','stages','completedAt','reward'])||d.schema!==1||d.site!=='river_depot'||!int(d.introducedAt)||!CivilMunicipal.data(s,'river')?.town||!Array.isArray(d.stages)||d.stages.length<1||d.stages.length>3||!Array.isArray(d.controls))fail();
    let previous=d.introducedAt;
    for(const [i,r]of d.stages.entries()){
      const def=this.phases[r?.kind];if(!def||!exact(r,['kind','startedAt','lastTick','remaining','endedAt','paid'])||!int(r.startedAt)||r.startedAt<previous||i===0&&r.startedAt!==d.introducedAt||!int(r.lastTick)||r.lastTick<r.startedAt||!int(r.remaining,def.seconds)||r.startedAt+def.seconds-r.remaining>r.lastTick||!same(r.paid,def.cost)||!(i===0?r.kind==='survey':i===1?['relocate','barrier'].includes(r.kind):['preserve','recycle'].includes(r.kind)))fail();
      if(r.endedAt===null){if(i!==d.stages.length-1||r.remaining===0)fail();}else if(!int(r.endedAt)||r.endedAt!==r.lastTick||r.remaining!==0)fail();previous=r.endedAt??r.lastTick;
    }
    let at=d.introducedAt,on=true;for(const x of d.controls){if(!exact(x,['at','enabled'])||!int(x.at)||x.at<at||typeof x.enabled!=='boolean'||x.enabled===on||!d.stages.some(r=>r.startedAt<=x.at&&(r.endedAt===null||x.at<=r.endedAt)))fail();at=x.at;on=x.enabled;}
    for(const r of d.stages){let paused=0;for(const [i,x]of d.controls.entries())if(!x.enabled)paused+=Math.max(0,Math.min(r.lastTick,d.controls[i+1]?.at??r.lastTick)-Math.max(r.startedAt,x.at));if(this.phases[r.kind].seconds-r.remaining>r.lastTick-r.startedAt-paused)fail();}
    const last=d.stages.at(-1),done=d.stages.length===3&&last.endedAt!==null;
    if(done){const reward=this.reward(last.kind);if(d.completedAt!==last.endedAt||!exact(d.reward,['stores','robot'])||d.reward.robot!==reward.robot||!same(d.reward.stores,reward.stores))fail();}
    else if(d.completedAt!==null||d.reward!==null)fail();
  }
};
