/* MPL-2.0 — Decision receipts. Owners execute policy and reform; this ledger never does. */
var CivilDecisions={
  ensure(s){
    const c=s.civilization,x=c.society;
    if(c.decisions===undefined)c.decisions={schema:1,introducedAt:c.elapsed,nextId:1,
      baseline:{policy:c.policy||null,axes:{...x.axes},generation:x.generation,
        reform:x.reforming?{axis:x.reforming,knowledge:x.reformPaid}:null},records:[]};
    return c.decisions;
  },
  append(s,kind,axis,from,to,knowledge=0,proposalId=null){
    const d=s.civilization.decisions;
    d.records.push({id:d.nextId++,kind,at:s.civilization.elapsed,generation:s.civilization.society.generation,axis,from,to,knowledge,proposalId});
  },
  proposalId(s){
    const rows=s.civilization.decisions.records;
    for(let i=rows.length-1;i>=0;i--)if(rows[i].kind==='proposal')return rows[i].id;
    return 0; // A reservation already present when an old save first joined this ledger.
  },
  validate(s){
    const c=s.civilization,d=c.decisions;if(d===undefined)return;
    const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const integer=(v,min=0,max=c.elapsed)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
    const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
    const fail=()=>{throw Error('政策与制度记录不一致');};
    const axisValue=(axis,value)=>Object.hasOwn(CivilSociety.axes,axis)&&Object.hasOwn(CivilSociety.axes[axis].choices,value);
    const policy=value=>value===null||Object.hasOwn(CivilRules.policies,value);
    const generation=(g,at)=>{
      const x=c.society;if(!integer(g,1,x.generation))return false;
      const h=g===x.generation?{from:x.leader.started,to:Math.floor(c.elapsed/600)}:x.history[g-1];
      const year=Math.floor(at/600);return h&&year>=h.from&&year<=h.to;
    };
    if(!c.society||!exact(d,['schema','introducedAt','nextId','baseline','records'])||d.schema!==1||!integer(d.introducedAt)||!Array.isArray(d.records)||!integer(d.nextId,1,Number.MAX_SAFE_INTEGER)||d.nextId!==d.records.length+1)fail();
    const b=d.baseline;
    if(!exact(b,['policy','axes','generation','reform'])||!policy(b.policy)||!object(b.axes)||!generation(b.generation,d.introducedAt))fail();
    for(const [axis,value]of Object.entries(b.axes))if(!axisValue(axis,value))fail();
    let open=null,axes={...b.axes},currentPolicy=b.policy;
    if(b.reform!==null){
      if(!exact(b.reform,['axis','knowledge'])||!Object.keys(CivilSociety.axes).every(k=>axisValue(k,axes[k]))||!axisValue(b.reform.axis,axes[b.reform.axis])||b.reform.knowledge!==(axes.charter==='constitution'?60:30))fail();
      open={axis:b.reform.axis,knowledge:b.reform.knowledge,id:0};
    }
    let at=d.introducedAt,lastGeneration=b.generation;
    for(const [index,r]of d.records.entries()){
      if(!exact(r,['id','kind','at','generation','axis','from','to','knowledge','proposalId'])||r.id!==index+1||!integer(r.at,at)||!generation(r.generation,r.at)||r.generation<lastGeneration||![0,30,60].includes(r.knowledge))fail();
      at=r.at;lastGeneration=r.generation;
      if(r.kind==='policy'){
        if(r.axis!==null||!policy(r.from)||!policy(r.to)||r.to===null||r.from!==currentPolicy||r.to===r.from||r.knowledge!==0||r.proposalId!==null)fail();
        currentPolicy=r.to;continue;
      }
      if(!Object.hasOwn(CivilSociety.axes,r.axis)||r.from!==(axes[r.axis]||null))fail();
      if(r.kind==='founding'){
        if(r.from!==null||open||!axisValue(r.axis,r.to)||r.knowledge!==0||r.proposalId!==null)fail();
        axes[r.axis]=r.to;
      }else if(r.kind==='proposal'){
        if(open||!Object.keys(CivilSociety.axes).every(k=>axisValue(k,axes[k]))||r.to!==null||r.knowledge!==(axes.charter==='constitution'?60:30)||r.proposalId!==null)fail();
        open={axis:r.axis,knowledge:r.knowledge,id:r.id};
      }else if(r.kind==='reform'||r.kind==='cancel'){
        if(!open||open.axis!==r.axis||open.knowledge!==r.knowledge||open.id!==r.proposalId)fail();
        if(r.kind==='reform'){
          if(!axisValue(r.axis,r.to)||r.to===r.from)fail();axes[r.axis]=r.to;
        }else if(r.to!==r.from)fail();
        open=null;
      }else fail();
    }
    const x=c.society;
    if(currentPolicy!==(c.policy||null)||Object.keys(axes).length!==Object.keys(x.axes).length||Object.entries(axes).some(([k,v])=>x.axes[k]!==v)||
      (open?x.reforming!==open.axis||x.reformPaid!==open.knowledge:x.reforming!==null||(x.reformPaid||0)!==0))fail();
  }
};
