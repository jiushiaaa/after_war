/* MPL-2.0 — Presentation adapters only. Each research ledger keeps its own authority. */
var CivilTechSources={
  families(s){return [
    {id:'future',era:3,data:s.civilization.polity?.future,content:CivilFutureContent.tech,rules:CivilFuture},
    {id:'earth',era:4,data:s.civilization.polity?.earth,content:CivilEarthContent.tech,rules:CivilEarth}
  ];},
  rows(s){
    const rows=CivilInterface.researchRows(s).map(n=>({...n,source:'base',key:n.id}));
    for(const f of this.families(s)){
      if(!f.data)continue;
      // Researchable roots and genuinely acquired capabilities reveal the next step.
      // Further descendants remain anonymous until their actual prerequisites are met.
      for(const [key,cfg] of Object.entries(f.content)){
        const done=!!f.data.tech[key],active=f.data.research?.id===key,available=f.rules.canUse(f.data,cfg);
        if(!done&&!active&&!available)continue;
        rows.push({id:f.id+'__'+key,source:f.id,key,era:f.era,name:cfg.name,done,active,available,
          requires:(cfg.requires||[]).map(k=>({id:f.id+'__'+k,name:f.content[k].name,done:!!f.data.tech[k]})),
          cost:cfg.cost,duration:cfg.time||cfg.duration,
          detail:f.id==='future'?cfg.ability+'\n日常变化：'+cfg.life+'\n取舍：'+cfg.choice+'\n交接：'+cfg.retires:cfg.text});
      }
    }
    return rows;
  },
  hasHiddenChild(s,n,known){
    if(n.source==='base')return Object.keys(CivilText.research).some(id=>!known.has(id)&&
      !(CivilModernContent.tech[id]&&(s.civilization.polishVersion!==1||id==='localgrid'&&s.civilization.course?.id!=='commons'))&&CivilTechTree.requires(s,id).includes(n.id));
    const family=this.families(s).find(f=>f.id===n.source);
    return Object.entries(family.content).some(([id,cfg])=>!known.has(family.id+'__'+id)&&(cfg.requires||[]).includes(n.key));
  },
  stock(s,n){return n.source==='base'?s.stores:s.civilization.polity?.future?.stock||{};},
  research(s,n){return n.source==='base'?s.civilization.research:s.civilization.polity?.[n.source]?.research;},
  resource(key){return CivilFutureContent.labels[key]||CivilText.labels[key]||key;},
  block(s,n){
    if(n.done||n.active)return '';
    if(!n.available)return '先完成标出的前置工艺。';
    if(this.research(s,n))return (n.source==='earth'?'航天':n.source==='future'?'共同体':'复兴')+'研究班组正在忙碌，完成后可立项。';
    if(n.source==='future'&&!s.civilization.polity.future.assets.laboratory)return '先建设临床与研究楼。';
    const stock=this.stock(s,n),missing=Object.entries(n.cost).filter(([k,v])=>(stock[k]||0)+1e-8<v);
    return missing.length?'还缺：'+missing.map(([k,v])=>this.resource(k)+' '+CivilInterface.number(v-(stock[k]||0))).join('、'):'';
  },
  state(s,n){
    if(n.done)return 'done';if(n.active)return 'active';if(!n.available)return 'locked';
    if(Object.entries(n.cost).some(([k,v])=>(this.stock(s,n)[k]||0)+1e-8<v))return 'materials';
    return this.block(s,n)?'blocked':'ready';
  },
  operation(s,n){
    if(n.source==='base')return '原镇公仓 · 复兴研究班组';
    const f=s.civilization.polity.future,g=s.civilization.polity.earth;
    let text='共同体仓 · '+(n.source==='future'?'共同体':'航天')+'研究班组\n12名实际人员、电18；每60秒有效研究另耗'+(n.source==='future'?'知识2、药品1。':'知识4、零件1。')+'\n与建设、生产共享居民和电力；条件不足时停研，已付立项材料不重复扣除。';
    const job=this.research(s,n),last=n.source==='future'?f.last:g.work;
    if(n.active&&last&&last.at>job.at){
      const count=n.source==='future'?last.workers?.research||0:last.research||0;
      text+='\n最近一期研究人员 '+count+' / 12。';
      if(count<12)text+='等待可用班组。';
      if(n.source==='future'&&!last.powered||n.source==='earth'&&!last.researchPower)text+='最近一期供电不足。';
    }
    if(n.active){const upkeep=n.source==='future'?{knowledge:2,medicine:1}:{knowledge:4,parts:1},missing=CivilFuture.shortageText(f.stock,upkeep);if(missing)text+='\n现存持续耗材不足：'+missing+'。';}
    return text;
  },
  start(s,n){
    if(n.unknown||n.done||n.active)return false;
    if(n.source==='base')return Civilization.research(n.key);
    return (n.source==='future'?CivilFuture:CivilEarth).act(s,'research',{id:n.key});
  }
};
