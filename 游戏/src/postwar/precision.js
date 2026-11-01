/* MPL-2.0 — Uses the existing settlement, paid-run callback and local power remainder. */
var CivilPrecision={
  workers(s,id,job){
    const r=CivilPrecisionContent.recipes[job];
    if(!r||!s.civilization.tech[r.tech]||!CivilServices.permitted(s,id))return 0;
    return CivilServices.labor(s,id,job);
  },
  demandCapacity(s,id='home'){
    return Object.entries(CivilPrecisionContent.recipes).reduce((n,[job,r])=>n+(CivilServices.jobs(s,id)[job]||0)*r.power,0);
  },
  run(s,id,{factor=1,run,powerAvailable=0}){
    let power=Math.max(0,powerAvailable),used=0,demand=0;
    for(const [job,r]of Object.entries(CivilPrecisionContent.recipes)){
      const workers=this.workers(s,id,job);demand+=workers*r.power;
      const powered=Math.min(workers,Math.floor((power+1e-8)/r.power));
      const output=Object.fromEntries(Object.entries(r.output).map(([key,n])=>[key,n*factor]));
      const paid=powered?run(job,powered,r.cost,output):0;
      used+=paid*r.power;power-=paid*r.power;
      if(id==='home'&&powered<workers&&!s.civilization.industry.blocked[job])s.civilization.industry.blocked[job]='电力不足，精密工序已停工';
    }
    return {used,demand};
  },
  describe(s,id='home'){
    const b=CivilServices.data(s,id)?.buildings||{},st=CivilServices.stores(s,id);
    return Object.entries(CivilPrecisionContent.recipes).filter(([,r])=>b[r.facility]).map(([job,r])=>{
      const resource=Object.keys(r.output)[0];return CivilText.labels[job]+' '+this.workers(s,id,job)+' / '+CivilServices.jobs(s,id)[job]+'；'+CivilText.labels[resource]+'库存 '+Number((st[resource]||0).toFixed(2));
    }).join('。');
  }
};
