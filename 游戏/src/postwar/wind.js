/* MPL-2.0 — Local, maintained wind generation enters the existing instantaneous power pool. */
var CivilWind={
  phases:[{name:'静风',rate:0},{name:'微风',rate:.25},{name:'和风',rate:.5},{name:'强风',rate:1},{name:'和风',rate:.5},{name:'微风',rate:.25}],
  offsets:{home:0,river:2,rail:4,highland:1},
  weather(at,id='home'){return this.phases[(Math.floor(at/120)+(this.offsets[id]||0))%this.phases.length];},
  capacity(s,id='home'){return (CivilServices.jobs(s,id).windworker||0)*6;},
  prepare(s,id,{factor,run}){
    const m=CivilServices.data(s,id);if(!m?.buildings.windstation||!s.civilization.tech.wind_power)return 0;
    const at=s.civilization.elapsed;if(m.wind?.at===at)return 0;
    const weather=this.weather(at,id),staff=CivilServices.labor(s,id,'windworker');
    const workers=weather.rate&&CivilServices.permitted(s,id)?run('windworker',staff,{parts:.04},{}):0;
    const generation=workers*6*weather.rate*factor;
    m.wind={at,rate:weather.rate,workers,factor,generation,parts:workers*.04};return generation;
  },
  describe(s,id='home'){
    const m=CivilServices.data(s,id),w=m?.wind,weather=this.weather(s.civilization.elapsed,id),fmt=n=>Number(n.toFixed(2));
    if(!m?.buildings.windstation)return '风力机组建成后需派人值守；风弱时须有备用电源顶上';
    return '当地'+weather.name+'，风轮出力 '+weather.rate*100+'%；'+(w?'近轮风电 '+fmt(w.generation)+' / 额定'+this.capacity(s,id)+'，'+w.workers+'名值守耗用零件'+fmt(w.parts):'等待首轮试运行')+'。电力仅供本地当轮使用；静风时停机，须靠备用电源维持';
  },
  validate(s){
    for(const [id,m]of Object.entries(s.civilization.services?.nodes||{})){
      const w=m.wind;if(w===undefined)continue;
      const maxFactor=id==='home'?Math.max(...Object.values(CivilRules.policies).map(p=>p.output))*1.18:1;
      const keys=['at','rate','workers','factor','generation','parts'],num=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max+1e-8;
      const completed=m.completed?.filter(p=>p.type==='windstation'&&p.completedAt<=w?.at).length||0;
      if(!w||typeof w!=='object'||Array.isArray(w)||Object.keys(w).length!==keys.length||!keys.every(k=>Object.hasOwn(w,k))||!completed||!s.civilization.tech.wind_power||!Number.isSafeInteger(w.at)||!num(w.at,s.civilization.elapsed)||w.rate!==this.weather(w.at,id).rate||!Number.isInteger(w.workers)||!num(w.workers,completed*2)||w.rate===0&&w.workers!==0||!num(w.factor,maxFactor)||!num(w.generation,completed*12*maxFactor)||Math.abs(w.generation-w.workers*6*w.rate*w.factor)>1e-8||!num(w.parts,completed*.08)||Math.abs(w.parts-w.workers*.04)>1e-8)throw Error('风力机组运行记录无效');
    }
  }
};
