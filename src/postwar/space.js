/* MPL-2.0 — Optional late-game state. Tests spend real components and share city power. */
var CivilSpace={
  pendingIds:['spaceCouncil'],
  data(s){return s.civilization.space;},
  init(s){return s.civilization.space||(s.civilization.space={schema:1,unification:null,missions:[]});},
  available(s){return !!s.civilization.tech.orbital_survey;},
  asset(s){return CivilServices.data(s,'home')?.completed.find(p=>p.type==='spaceport');},
  active(s){const m=this.data(s)?.missions.at(-1);return m&&m.completedAt===null?m:null;},
  complete(s,id){return this.data(s)?.missions.some(m=>m.kind===id&&m.completedAt!==null)||false;},
  worldReady(nodes){return Object.keys(CivilWorldContent.regions).every(id=>nodes[id]?.joinedAt!==null&&Number.isSafeInteger(nodes[id]?.joinedAt)&&nodes[id].stableSeconds===600&&nodes[id].infrastructure===100&&nodes[id].control==='member');},
  unityReason(s){if(!this.worldReady(CivilWorld.data(s)?.nodes||{}))return '八区须全部接纳，设施完好，各区连续实付公共服务600秒';if(!CivilWorld.political(s)||s.civilization.regions.rights!=='equal'||s.civilization.society.axes.devolution!=='local')return '恢复公共行政、平等公民资格与地区自治承诺';if(CivilWorld.active(s))return '等国家行动队返城';return null;},
  ratify(s){if(!this.available(s)||this.data(s)?.unification||this.unityReason(s)||!CivilFinance.reserveCheck(s,'home',CivilSpaceContent.charterCost))return false;CivilServices.pay(s.stores,CivilSpaceContent.charterCost);this.init(s).unification={at:s.civilization.elapsed,worldLedgerLength:CivilWorld.data(s).ledger.length,paid:{...CivilSpaceContent.charterCost}};return true;},
  reason(s,kind){
    if(!Object.hasOwn(CivilSpaceContent.phases,kind)||!this.available(s))return '先完成轨道测绘';
    if(this.active(s))return '先完成当前试验或发射准备';if(this.complete(s,kind))return '已有完整验证记录';
    if(!s.civilization.tech.closed_ecology||!s.civilization.tech.space_manufacturing||!this.asset(s))return '研究航天制造与闭环生命保障，在街区加工建成测控场';
    if(CivilServices.labor(s,'home','missionworker')<4)return '在炉火城页安排四名实际测控人员';
    if(!CivilWorld.political(s))return '先恢复国家公共行政';
    if(kind!=='habitat'&&!this.complete(s,'habitat'))return '先完成闭环生命保障试验';
    if(kind==='departure'&&!this.complete(s,'orbital'))return '先完成无人轨道验证';
    if(kind==='departure'&&!this.data(s)?.unification)return '先接纳八区并登记地球共同法';
    if(kind==='departure'&&this.unityReason(s))return this.unityReason(s);
    if(!CivilFinance.reserveCheck(s,'home',CivilSpaceContent.phases[kind].cost))return '备足实际航天与生命保障组件，并保留城市供养';return null;
  },
  start(s,kind){if(this.reason(s,kind))return false;const cfg=CivilSpaceContent.phases[kind];CivilServices.pay(s.stores,cfg.cost);this.init(s).missions.push({kind,assetId:this.asset(s).id,startedAt:s.civilization.elapsed,paid:{...cfg.cost},progress:0,completedAt:null,receipts:[]});return true;},
  // Called once per existing ten-second economy settlement, AFTER world budgets.
  // Power is the remainder of the same city's industrial pool, never regenerated.
  settle(s){
    const m=this.active(s);if(!m)return {};const at=s.civilization.elapsed,last=m.receipts.at(-1);if(at-m.startedAt<10||last&&at-last.at<10)return {};
    const cfg=CivilSpaceContent.phases[m.kind],i=s.civilization.industry,crew=CivilServices.labor(s,'home','missionworker');
    const ready=CivilWorld.political(s)&&(m.kind!=='departure'||!this.unityReason(s));
    const paid=ready&&crew===4&&i.generation-i.used+1e-8>=CivilSpaceContent.power&&CivilFinance.reserveCheck(s,'home',cfg.upkeep);
    i.demand+=CivilSpaceContent.power;
    if(paid){CivilServices.pay(s.stores,cfg.upkeep);i.used+=CivilSpaceContent.power;}
    m.receipts.push({at,paid,crew,power:paid?CivilSpaceContent.power:0,ready,worldLedgerLength:CivilWorld.data(s).ledger.length});
    m.progress=paid?m.progress+10:0;
    if(m.progress===cfg.duration){m.completedAt=at;if(s===State)Civilization.notify(m.kind==='departure'?'地球篇告成：八区共同法典运转如常。无人先遣器刺破铅灰大气层，向沉寂的深空播发出第一声新生的问候。':cfg.name+'圆满完成，实体组件与连续运行日志均已封存归档。');}
    return paid?Object.fromEntries(Object.entries(cfg.upkeep).map(([k,v])=>[k,-v])):{};
  },
  demandCapacity(s){return this.asset(s)?CivilSpaceContent.power:0;},
  event(id,done){
    if(id!=='spaceCouncil')return null;const s=State,d=this.data(s),m=this.active(s),text=[],buttons={};
    if(this.complete(s,'departure'))return {
      title:'地球篇 · 向星空出发',
      text:['八区共同法典已然确立。无人先遣器越过电离层，向漫天星海发出了第一封新生的问候。',
        '从寒冷维修间里的第一把柴火，到城邦、国度乃至重新联结的地球——你所延续的从来不是某一个人的寿命，而是一代代薪火相传、接过重担的共同体。',
        '地面闭环生态保障、无人轨道遥测与先遣发射均已圆满达成。此处即是地球篇的终章；载人深空远征与星际开拓，留待后世续写。',
        '你仍可留在地表继续经营家园。发展史长卷已完整收录统一盟约、历次试验与首航档案，各地居民与公共财政将继续如常运转。'],
      buttons:{close:{text:'继续建设地球',nextScene:'end',onChoose:done('先遣器已然升空远去。地面上的烟火日常与营建脚步，仍在日复一日地继续。')}}
    };
    text.push('地球与星空：'+CivilWorld.members(s).length+' / 8区接纳。'+(d?.unification?'地球共同法已立案入册；点火发射仍须核验当期连续履约状态。':this.unityReason(s)||'八区已具备正式签署地球共同法典的全部前置条件。'));
    if(!d?.unification){text.push('地球共同法议约：'+CivilHistory.costText(CivilSpaceContent.charterCost));buttons.charter={text:'登记地球共同法',available:()=>!this.unityReason(s)&&CivilFinance.reserveCheck(s,'home',CivilSpaceContent.charterCost),nextScene:'end',onChoose:doneAction(()=>this.ratify(s),'八区共同法正式生效。地表统一并非一劳永逸的终局，而是赖以持续履约的共同事业；各地户籍名簿与地方财政继续各自保留。')};}
    text.push('科技页研究「航天制造」与「闭环生命保障」；街区加工页营建制造车间与发射测控场；炉火城页面调派装配工、生保技师及四名专职测控员。所有航天组件皆须产线实造。试验与发射另需预留地面电12，必要时可暂歇自动机群或部分产线以腾出电力负荷。');
    if(m)text.push(CivilSpaceContent.phases[m.kind].name+'：已连续运转 '+m.progress+' / '+CivilSpaceContent.phases[m.kind].duration+'秒。凡遇缺员、断电、断供或行政停摆，连续计时即行归零重置，已损耗组件概不退赔。');
    for(const [kind,cfg]of Object.entries(CivilSpaceContent.phases)){
      if(kind==='orbital'&&!this.complete(s,'habitat')||kind==='departure'&&!this.complete(s,'orbital'))continue;
      if(this.complete(s,kind)){text.push(cfg.name+'：已完成');continue;}
      text.push(cfg.name+'：'+CivilHistory.costText(cfg.cost)+'；每10秒另耗'+CivilHistory.costText(cfg.upkeep)+'，12电。'+(this.reason(s,kind)||'可开始'));
      buttons[kind]={text:cfg.name,available:()=>!this.reason(s,kind),nextScene:'end',onChoose:doneAction(()=>this.start(s,kind),'实体组件已核扣入舱，地面测控班组进入全天候值守。')};
    }
    buttons.close={text:'合上航天记录',nextScene:'end',onChoose:done('近地航天日志已封存归档。')};return {title:this.complete(s,'departure')?'地球篇 · 向星空出发':'地球共同法与航天',text,buttons};
    function doneAction(action,msg){return ()=>done(action()?msg:'前置条件已发生变动，本次指令未予执行。')();}
  },
  summary(s){
    const m=this.active(s);
    if(m){const last=m.receipts.at(-1),reason=last&&!last.paid?(!last.ready?'国家行政或八区履约未满足':last.crew<4?'测控人员不足4人':'检查剩余12电与维护材料'):null;return CivilSpaceContent.phases[m.kind].name+' · 连续 '+m.progress+'/'+CivilSpaceContent.phases[m.kind].duration+'秒'+(reason?' · 暂停：'+reason:'');}
    if(this.complete(s,'departure'))return '地球篇完成 · 无人先遣船已出发，可打开航天记录回看结局';
    if(!s.civilization.tech.closed_ecology)return '下一步：科技研究航天制造与闭环生命保障';
    if(!this.asset(s))return '下一步：街区 → 加工，建航天/生命保障车间与测控场';
    const kind=!this.complete(s,'habitat')?'habitat':!this.complete(s,'orbital')?'orbital':'departure',cfg=CivilSpaceContent.phases[kind];
    return '下一步：'+cfg.name+' · 航天组件 '+Math.floor(s.stores.spaceparts||0)+'/'+cfg.cost.spaceparts+'，生命保障组件 '+Math.floor(s.stores.lifesupport||0)+'/'+cfg.cost.lifesupport+' · '+(this.reason(s,kind)||'条件齐备，可开始');
  },
  refresh(){
    if(typeof $==='undefined'||!$('#councilPanel').length)return;
    if(!this.available(State)){$('#spaceButton,#spaceSummary').hide();return;}
    Civilization.button('spaceButton','地球共同法与航天','#councilPanel',()=>{if(Events.activeEvent()||State.civilization.pending)return;State.civilization.pending='spaceCouncil';Civilization.showPending();}).show();
    let line=$('#spaceSummary');if(!line.length)line=$('<div>').attr('id','spaceSummary').css({lineHeight:'1.8',maxWidth:'420px',marginTop:'12px'}).insertAfter('#spaceButton');line.show().text(this.summary(State));
  },
  validate(s){
    const d=this.data(s),at=s.civilization.elapsed,fail=()=>{throw Error('地球共同法或航天验证记录无效');},obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),time=x=>Number.isSafeInteger(x)&&x>=0&&x<=at,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(d===undefined){if(s.civilization.pending==='spaceCouncil'&&!this.available(s))fail();return;}
    if(!obj(d)||d.schema!==1||!this.available(s)||!Array.isArray(d.missions)||!d.missions.length&&d.unification===null)fail();
    const world=CivilWorld.data(s);if(!world)fail();
    // Replay regional history only once, caching the exact referenced prefixes.
    const prefixes=new Map(),replay={nodes:{},missions:world.missions};let lastBudget=null;
    const needed=new Set([d.unification?.worldLedgerLength,...d.missions.flatMap(m=>Array.isArray(m.receipts)?m.receipts.map(r=>r.worldLedgerLength):[])]);
    world.ledger.forEach((r,i)=>{CivilWorld.apply(replay,r);if(r.kind==='budget')lastBudget=r;if(needed.has(i+1))prefixes.set(i+1,{at:r.at,political:!!lastBudget?.political,budgetAt:lastBudget?.at,ready:this.worldReady(replay.nodes)&&lastBudget?.political&&lastBudget.rights==='equal'&&lastBudget.devolution==='local'});});
    const traveling=when=>world.missions.some(m=>m.departedAt<=when&&(m.returnedAt===null||m.returnedAt>when));
    const prefix=(length,when)=>Number.isSafeInteger(length)&&prefixes.has(length)&&prefixes.get(length).at<=when&&(!world.ledger[length]||world.ledger[length].at>=when);
    if(d.unification!==null){const u=d.unification;if(!obj(u)||!time(u.at)||!same(u.paid,CivilSpaceContent.charterCost)||!prefix(u.worldLedgerLength,u.at)||!prefixes.get(u.worldLedgerLength).ready||traveling(u.at))fail();}
    const completed=new Set();let previous=null;
    for(const m of d.missions){
      const cfg=CivilSpaceContent.phases[m?.kind];if(!obj(m)||!cfg||!this.asset(s)||m.assetId!==this.asset(s).id||!time(m.startedAt)||m.startedAt<this.asset(s).completedAt||!s.civilization.tech.closed_ecology||!s.civilization.tech.space_manufacturing||!same(m.paid,cfg.cost)||!Array.isArray(m.receipts)||completed.has(m.kind)||previous&&(previous.completedAt===null||m.startedAt<previous.completedAt)||m.kind!=='habitat'&&!completed.has('habitat')||m.kind==='departure'&&(!completed.has('orbital')||!d.unification||d.unification.at>m.startedAt))fail();
      let progress=0,last=m.startedAt;
      for(const r of m.receipts){if(!obj(r)||!time(r.at)||r.at-last<10||last!==m.startedAt&&r.at-last!==10||last===m.startedAt&&r.at-last>19||progress===cfg.duration||typeof r.paid!=='boolean'||typeof r.ready!=='boolean'||!Number.isInteger(r.crew)||r.crew<0||r.crew>4||r.power!==(r.paid?12:0)||r.paid&&(!r.ready||r.crew!==4)||!prefix(r.worldLedgerLength,r.at)||prefixes.get(r.worldLedgerLength).budgetAt!==r.at||r.ready&&!prefixes.get(r.worldLedgerLength).political||m.kind==='departure'&&r.ready&&(!prefixes.get(r.worldLedgerLength).ready||traveling(r.at)))fail();progress=r.paid?progress+10:0;last=r.at;}
      if(m.progress!==progress||(m.completedAt!==null)!==(progress===cfg.duration)||m.completedAt!==null&&m.completedAt!==last)fail();if(m.completedAt!==null)completed.add(m.kind);previous=m;
    }
  }
};
