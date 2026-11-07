/* MPL-2.0 — A7 new-game rules. Biographies name existing people; never mint residents. */
var CivilGenerations={
  enabled(s){return s.civilization?.ruleset===2&&s.civilization.polishVersion===1;},
  init(s){
    if(!this.enabled(s)||s.civilization.generations!==undefined)return;
    s.civilization.generations={schema:1,term:10,terms:1,platform:'engineer',elections:[],people:{},records:[],heads:{},pending:null,lastCrisis:-40,dialogs:0};
  },
  data(s){return s.civilization.generations;},
  annual(s,random){
    this.init(s);const c=s.civilization,x=c.society,d=this.data(s),l=x.leader,regency=l.title==='摄政委员会';
    if(regency&&x.axes.selection==='hereditary'&&x.heir.age>=18&&!x.succession)x.succession='regency';
    if(l.alive&&!regency){
      l.age++;
      if(l.age>=85||(l.age>=70&&random()<Math.min(.5,(l.age-69)*.025)*(c.village.health>=70?.6:1))){l.alive=false;x.succession='death';}
      else if(x.governed&&!x.succession){
        if(x.axes.selection==='appointment'&&l.age>=65)x.succession='retirement';
        if(x.axes.selection==='election'&&x.year-l.termStarted>=d.term){
          const renewed=d.terms<2&&l.age<65&&x.legitimate>=45&&x.service;
          d.elections.push({year:x.year,generation:x.generation,renewed,term:d.term});
          if(renewed){l.termStarted=x.year;d.terms++;this.record(s,'election','居民按十年之约完成推举。现任代表连任，原有职责与起任年份照旧保留。');}
          else x.succession='election';
        }
      }
    }
    // A constitutional crisis is actionable once per forty years, not at every birthday.
    if(x.succession){
      const crisis=x.governed&&x.legitimate<25&&x.year-d.lastCrisis>=40;
      if(crisis){d.lastCrisis=x.year;d.dialogs++;this.record(s,'crisis','交接之际公共认可不足，居民要求亲自过目并确认继任方案。');}
      else if(c.pending!=='succession'){
        const options=CivilSociety.successionOptions(s),key=Object.hasOwn(options,d.platform)?d.platform:Object.keys(options)[0];
        CivilSociety.succeed(s,key);
      }
    }
  },
  succeeded(s,kind){
    if(!this.enabled(s))return;this.init(s);const d=this.data(s),x=s.civilization.society;
    d.terms=1;if(['engineer','scholar'].includes(kind))d.platform=kind;
    // Council appointments are experienced adults, with a real retirement at 65.
    if(x.axes.selection==='appointment'&&['engineer','scholar'].includes(kind))x.leader.age=45;
  },
  record(s,kind,text){this.data(s).records.push({at:s.civilization.elapsed,kind,text});},
  register(s,id,title,age,institution,synthetic=false){
    const d=this.data(s);if(d.people[id])return;
    const year=s.civilization.society.year;
    d.people[id]={title,born:year-age,met:year,institution,synthetic,retired:null,died:null};
    this.record(s,'person',title+'的名字第一次写进共同记录，时年'+age+'岁。往后，这份担子将由'+institution+'接续。');
  },
  observe(s){
    if(!this.enabled(s))return;this.init(s);const c=s.civilization,x=c.society,d=this.data(s),year=x.year;
    if(s.game.builder?.level>=4)this.register(s,'craft','首任工匠·阿岑',50,'工坊轮值');
    if(c.expedition?.sites?.cellar?.state==='joined')this.register(s,'surveyor','老测量员·林衡',58,'测绘所');
    if(x.governed&&x.cohorts.some(g=>g.identity==='mutant'&&g.age>=18&&g.age<65))this.register(s,'mutant','变异居民代表·余禾',32,'居民议事会');
    const f=c.polity?.future;
    if(f&&typeof CivilFuturePeople!=='undefined'&&(CivilFuturePeople.counts(f).synthetic||0)>0)this.register(s,'synthetic','首位合成人代表·序七',Math.min(...f.cohorts.filter(g=>g.body==='synthetic').map(g=>g.age)),'人格与维修议事会',true);
    const flight=c.polity?.earth?.flights?.find(v=>v.kind==='departure'&&v.crew?.length);
    if(flight)this.register(s,'captain','首航指挥·陆遥',flight.crew[0].age,'航行指挥所',flight.crew[0].body==='synthetic'||flight.crew[0].body==='mechanical');
    for(const [id,p]of Object.entries(d.people)){
      const age=year-p.born;
      if(p.retired===null&&(p.synthetic?year-p.met>=25:age>=65)){
        p.retired=year;this.record(s,'retirement',p.title+'卸下了日常值守，'+p.institution+'接过了案头的记录。');
      }
      if(!p.synthetic&&p.died===null&&age>=85){p.died=year;this.record(s,'death',p.title+'在这一年走完了人生。'+p.institution+'里还妥善收着那份最早的工作记录。');}

    }
    for(const [key,at]of [['nation',c.polity?.foundedAt],['earth',c.polity?.earth?.unity?.at]]){
      if(Number.isSafeInteger(at)&&d.heads[key]===undefined&&!d.pending)d.pending=key;
    }
  },
  nextEvent(s){return this.enabled(s)&&this.data(s)?.pending?'generation_head':null;},
  event(id,done){
    if(id!=='generation_head'||!this.enabled(State)||!this.data(State).pending)return null;
    const d=this.data(State),kind=d.pending;
    return {title:kind==='nation'?'共同职责有了名字':'向外代表同一个地球',text:[kind==='nation'?'各区的签名，第一次落在了同一份国约上。':'八大区把共同法的副本送进了这间屋子。','公共机构照常运转。这一回，由谁出面担起对外代表的职责？','现任代表可继续履职；若推举新代表，需经历交接与短期磨合。'],buttons:Object.fromEntries([['keep','由现任继续承担'],['engineer','交给工程代表'],['scholar','交给教师代表']].map(([key,text])=>[key,{text,nextScene:'end',onChoose:done('代表职责已载入发展史。',()=>this.head(State,kind,key))}]))};
  },
  head(s,kind,key){
    const d=this.data(s),x=s.civilization.society;if(!this.enabled(s)||d.pending!==kind||!['keep','engineer','scholar'].includes(key))return false;
    if(key!=='keep'){x.succession=x.leader.alive?'retirement':'death';if(!CivilSociety.succeed(s,key))return false;}
    d.heads[kind]={at:s.civilization.elapsed,generation:x.generation,choice:key};d.pending=null;d.dialogs++;
    this.record(s,'representation',(kind==='nation'?'建国':'统一')+'代表：第'+x.generation+'任'+x.leader.title+'。各公共机构与现行制度照常运转。');return true;
  },
  validate(s){
    const c=s.civilization,d=c.generations;if(!this.enabled(s)){if(d!==undefined)throw Error('代际版本不符');return;}
    const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),year=c.society?.year||0,integer=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
    if(!obj(d)||d.schema!==1||!integer(d.term,8,12)||!integer(d.terms,1,2)||!['engineer','scholar'].includes(d.platform)||!Array.isArray(d.elections)||!Array.isArray(d.records)||!obj(d.people)||!obj(d.heads)||![null,'nation','earth'].includes(d.pending)||!integer(d.dialogs,0,10000)||!integer(d.lastCrisis,-40,year))throw Error('代际委托无效');
    let prev=-1;for(const e of d.elections){if(!integer(e.year,prev+1,year)||!integer(e.generation,1,c.society.generation)||!integer(e.term,8,12)||typeof e.renewed!=='boolean')throw Error('选举记录无效');prev=e.year;}
    for(const [id,p]of Object.entries(d.people)){if(!['craft','surveyor','mutant','synthetic','captain'].includes(id)||!obj(p)||!integer(p.born,-85,year)||!integer(p.met,0,year)||typeof p.title!=='string'||typeof p.institution!=='string'||typeof p.synthetic!=='boolean'||[p.retired,p.died].some(v=>v!==null&&!integer(v,p.met,year))||p.synthetic&&p.died!==null)throw Error('人物记录无效');}
    prev=0;for(const r of d.records){if(!obj(r)||!integer(r.at,prev,c.elapsed)||typeof r.kind!=='string'||typeof r.text!=='string'||r.text.length>500)throw Error('代际历史无效');prev=r.at;}
    for(const [id,h]of Object.entries(d.heads))if(!['nation','earth'].includes(id)||!integer(h.at,0,c.elapsed)||!integer(h.generation,1,c.society.generation)||!['keep','engineer','scholar'].includes(h.choice))throw Error('代表记录无效');
  }
};
