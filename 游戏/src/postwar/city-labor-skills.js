/* MPL-2.0 — Recognise existing cooperative qualifications without creating
 * another resident or letting a worker keep two production assignments. */
Object.assign(CivilCityLabor,{
  recognitionCost:{knowledge:4},
  skilledTrades:{
    food:{name:'合格班组 · 粮作',job:'farmer',input:{tools:.015},output:{food:1.6}},
    tools:{name:'合格班组 · 制器',job:'smith',input:{scrap:.8,wood:.2},output:{tools:.3}}
  },
  trade(s,id,order){return order?.version===2?this.skilledTrades[order.task]:this.trades[this.city(s,id)];},
  skilled(s,p){return this.data(s)?.contracts[p.order-1]?.version===2;},
  qualifiedAt(s,id,at){return this.x().merge((this.x().local(s,id)?.certificates||[]).filter(c=>c.at<=at).flatMap(c=>this.x().aged(c.cohorts,c.at,at)));},
  skilledGroups(s,id,at=s.civilization.elapsed){const city=this.city(s,id);return this.x().merge((this.data(s)?.shifts||[]).filter(p=>p.from===city&&this.skilled(s,p)&&p.at<=at&&(p.finishedAt===null||p.finishedAt>at)).flatMap(p=>this.x().aged(p.cohorts,p.at,at)));},
  unqualifiedProtected(s,id){const city=this.city(s,id);return this.x().merge(this.shifts(s).filter(p=>p.from===city&&!this.skilled(s,p)).flatMap(p=>this.groups(s,p)));},
  skilledCandidates(s,id,count){
    const qualified=this.qualifiedAt(s,id,s.civilization.elapsed),busy=this.skilledGroups(s,id),remaining=this.x().subtract(qualified,busy);
    // Keep at least half the certified workforce at home, including two
    // potential tutors. These are the same people counted by the home workshop.
    const staffed=this.x().ready(s,id)?Math.min(this.x().capacity(s,id),this.count(qualified)):0;
    const limit=Math.max(0,Math.min(Math.floor(staffed/2),staffed-2)-this.count(busy));
    const tutors=this.x().pick(remaining,2,64,true);
    return this.x().pick(this.x().subtract(remaining,tutors),Math.min(count,limit),50);
  },
  taskReason(s,o){
    if(o.version!==2)return null;
    if(!Object.hasOwn(this.skilledTrades,o.task))return '尚无此项合格班组工序';
    if(!this.x().active(s,o.from)||!this.h().active(s,o.from))return '来源城的接续工坊与安居社区须正常续办，方可外派合格班组';
    if(this.count(this.skilledCandidates(s,o.from,o.count))<o.count)return '来源城须有足额的在册资格人员，且外派后仍须留至少半数合格人员与两名教员看家';
    return null;
  },
  commitment(s,o){
    const q=this.quote(s,o),trade=this.trade(s,o.to,o);if(!trade)return null;
    const input=Object.fromEntries(Object.entries(trade.input).map(([k,v])=>[k,v*o.count*30]));
    const meals=q.distance?o.count*.12*30:0,work=this.duration,travel=2*(q.distance||0),car=travel+(q.distance?work:0);
    return {input,meals,work,travel,car,workingShare:work/(work+travel),
      registration:o.version===2?this.recognitionCost:{},
      sourceLost:o.version===2?Object.fromEntries(Object.entries(this.h().estate(s,o.from)?.mode==='food'?{food:1.6}:{tools:.3}).map(([k,v])=>[k,v*o.count])):{}};
  }
});
