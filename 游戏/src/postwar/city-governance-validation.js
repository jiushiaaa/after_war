/* MPL-2.0 — Replay local authority, operating decisions and actual workshop inputs. */
CivilCityGovernance.validate=function(s){
 const d=this.data(s);if(!d)return;const a=this.c(),rs=a.data(s)?.receipts,at=s.civilization.elapsed,fail=x=>{throw Error('地方章程账不符：'+x);};
 const time=t=>Number.isSafeInteger(t)&&t>=0&&t<=at,near=(x,y)=>Math.abs(x-y)<1e-6,same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),goods=(x,y)=>Object.keys(x).length===Object.keys(y).length&&Object.entries(x).every(([k,v])=>Number.isFinite(v)&&near(v,y[k]));
 if(d.schema!==1||!time(d.at)||!this.available(s)||!d.offices||!Object.keys(d.offices).length)fail('登记');const seen=new Set(),serviceIndex=new Map();for(const e of rs)if(e.kind==='governanceService'){const key=e.city+':'+e.at;if(!serviceIndex.has(key))serviceIndex.set(key,[]);serviceIndex.get(key).push(e);}
 for(const [id,o]of Object.entries(d.offices)){
  if(!time(o.at)||o.at<d.at||!a.membersAt(s,o.at).includes(id)||!Array.isArray(o.changes)||!o.changes.length||!Array.isArray(o.services)||!Array.isArray(o.production))fail('地方记录');
  let previous=0;const policies=o.changes.map((i,index)=>{const e=rs[i-1];if(!Number.isSafeInteger(i)||i<=previous||seen.has(i)||!e||e.kind!=='governancePolicy'||e.city!==id||e.ref!==id||!time(e.at)||e.at<o.at||!Object.hasOwn(this.modes,e.mode)||!same(e.paid,index===0?this.cost:this.changeCost)||index===0&&(e.at!==o.at||e.mode==='manual'))fail('章程付款');previous=i;seen.add(i);if(e.mode==='standard'&&(!s.civilization.tech.mechanics||!s.civilization.tech.standards))fail('缺少工艺知识');const budget=s.civilization.cityBudget.decisions.filter(p=>p.at<=e.at&&p.cities.some(r=>r.city===id&&r.receipt<e.id)).at(-1);if(e.mode!=='manual'&&(!budget||budget.mode==='manual'||!a.officeAt(s,id,e.at,e.id)))fail('未经授权');return e;});
  if(o.services.length!==Math.floor(at/60)-Math.floor(o.at/60))fail('续办轮次');
  for(const [i,r]of o.services.entries()){if(r.at!==(Math.floor(o.at/60)+i+1)*60||!Number.isFinite(r.iron)||r.iron<0||typeof r.paid!=='boolean')fail('续办时点');const receipts=serviceIndex.get(id+':'+r.at)||[];if(receipts.length!==(r.paid?1:0)||r.receipt!==(receipts[0]?.id??null))fail('重复或未实付续办');}
  // UI policies at a second happen after its economy/maintenance tick.
  const events=[...policies.map(e=>({at:e.at,phase:1,e})),...o.services.map(r=>({at:r.at,phase:0,r}))].sort((x,y)=>x.at-y.at||x.phase-y.phase||(x.e?.id||0)-(y.e?.id||0));
  let mode='manual',operation=null,last=null,authority=null;const checkpoints=[];
  for(const item of events){if(item.e){if(item.e.mode===mode)fail('重复约定');mode=item.e.mode;operation=mode==='manual'?null:'repair';authority=item.e.id;}
    else {const r=item.r;if(r.authority!==authority)fail('续办越权');if(r.paid){if(mode==='manual')fail('暂停仍续费');operation=mode==='standard'&&r.iron>=(operation==='standard'?6:60)?'standard':'repair';last=r.at;}if(r.operation!==operation)fail('原料转工序回放');}
    checkpoints.push({at:item.at,phase:item.phase,mode,operation,last,authority});
  }
  if(o.mode!==mode||o.operation!==operation||o.lastPaidAt!==last)fail('现行委托');
  const account=id==='home'?'ward_'+a.depot(s):'city_'+id,census=CivilCensus.data(s),changes=census.entries.filter(e=>e.from===account||e.to===account);
  let population=CivilCensus.initial(census.seed).counts[account]||0,popCursor=0,prior=o.at,cursor=-1;const consumed={},produced={};for(const p of o.production){
    while(popCursor<changes.length&&changes[popCursor].at<=p.at){const e=changes[popCursor++];if(e.from===account)population-=e.count;if(e.to===account)population+=e.count;}
    if(!time(p.at)||p.at%10||p.at<=prior||!Number.isSafeInteger(p.workers)||p.workers<1||p.workers>population||!Object.hasOwn(this.recipes,p.operation))fail('生产时点/岗位');prior=p.at;
    while(cursor+1<checkpoints.length&&checkpoints[cursor+1].at<p.at)cursor++;let state=checkpoints[cursor];for(let j=cursor+1;j<checkpoints.length&&checkpoints[j].at===p.at;j++)if(checkpoints[j].phase===1&&checkpoints[j].authority<=p.authority)state=checkpoints[j];
    if(!state||state.authority!==p.authority||state.mode==='manual'||state.operation!==p.operation||state.last!==p.service||p.service===null||p.at-p.service>=120)fail('未续办生产');
    const recipe=this.recipes[p.operation],cost=Object.fromEntries(Object.entries(recipe.input).map(([k,v])=>[k,v*p.workers]));if(!goods(p.paid,cost)||!goods(p.output,{tools:recipe.output.tools*p.workers}))fail('生产投入/产物');a.sum(consumed,p.paid);a.sum(produced,p.output);
  }
  const n=a.local(s,id);for(const [k,v]of Object.entries(consumed))if((n.budget.consumed[k]||0)+1e-6<v)fail('未扣生产材料');for(const [k,v]of Object.entries(produced))if((n.budget.produced[k]||0)+1e-6<v)fail('产出未入公仓');if((n.workers.steward||0)>(mode==='manual'?0:2))fail('机构人员');
 }
 if(d.at!==Math.min(...Object.values(d.offices).map(o=>o.at))||rs.filter(e=>e.kind==='governancePolicy').length!==seen.size)fail('孤立章程');
};
