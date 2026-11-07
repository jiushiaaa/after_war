/* MPL-2.0 — Shared cohort arithmetic; no State, resource payment, clocks or UI. */
var CivilPopulation = {
  count(cohorts){return cohorts.reduce((n,c)=>n+c.count,0);},
  workforce(cohorts){return cohorts.filter(c=>c.age>=18 && c.age<65).reduce((n,c)=>n+c.count,0);},
  children(cohorts){return cohorts.filter(c=>c.age<18).reduce((n,c)=>n+c.count,0);},
  foodPopulation(cohorts){return cohorts.reduce((n,c)=>n+c.count*(c.age<18?2/3:1),0);},
  age(cohorts){
    const aged=cohorts.map(c=>({...c,age:c.age+1}));
    return {cohorts:aged.filter(c=>c.age<80),deceased:aged.filter(c=>c.age>=80).reduce((n,c)=>n+c.count,0)};
  },
  // Returns newborn groups only. The caller pays cost before appending them to its ledger.
  // Only the supplied fractional birth state changes; cohorts and options remain untouched.
  births(cohorts,birthState,options){
    const empty=()=>({cohorts:[],count:0,cost:{food:0,medicine:0}});
    const parents=cohorts.filter(c=>c.age>=18 && c.age<=49);
    const eligible=this.count(parents),mutants=this.count(parents.filter(c=>c.identity==='mutant'));
    if(!mutants)birthState.mutantCredit=0;
    const beds=Math.max(0,Math.floor(options.beds)),food=options.food||0,medicine=options.medicine||0;
    if(eligible<2 || this.workforce(cohorts)<6 || options.hunger || options.health<60 || !beds || food+1e-8<6 || medicine+1e-8<.2){
      birthState.credit=0;return empty();
    }
    let wanted=1;
    if(birthState.scaled){
      const potential=eligible*.08+birthState.credit,whole=Math.floor(potential+1e-9);
      birthState.credit=Math.max(0,Math.min(1-Number.EPSILON,potential-whole));
      wanted=Math.min(whole,Math.max(1,Math.ceil(options.yearStartPopulation*.04)));
    }else birthState.credit=0;
    const count=Math.min(wanted,beds,Math.floor((food+1e-8)/6),Math.floor((medicine+1e-8)/.2));
    if(count<wanted)birthState.credit=0;
    if(!count)return empty();
    const identityShare=count*mutants/eligible+birthState.mutantCredit,mutantBirths=Math.min(count,Math.floor(identityShare+1e-9));
    birthState.mutantCredit=Math.max(0,Math.min(1-Number.EPSILON,identityShare-mutantBirths));
    const newborns=[];
    if(count>mutantBirths)newborns.push({age:0,count:count-mutantBirths,identity:'human'});
    if(mutantBirths)newborns.push({age:0,count:mutantBirths,identity:'mutant'});
    return {cohorts:newborns,count,cost:{food:count*6,medicine:count*.2}};
  }
};
