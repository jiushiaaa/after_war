/* MPL-2.0 — A bounded early work mandate; production remains in the original owners. */
var CivilPacing={
  modes:{reserves:'供养与储备',workshop:'修造与回收'},cost:{wood:2,food:1},jobs:['farmer','hunter','medic','teacher','salvager','smith'],
  enabled(s){return s.civilization.pacingVersion===1;},data(s){return s.civilization.workMandate;},
  available(s){return this.enabled(s)&&s.civilization.settled&&s.game.population>=8&&!!s.game.buildings.workshop&&!s.civilization.city?.institutions;},
  init(s){if(this.enabled(s)&&this.data(s)===undefined)s.civilization.workMandate={schema:1,mode:'reserves',enabled:false,until:0,records:[],changes:[],handoffAt:null};},
  crew(s){const d=this.data(s);return this.enabled(s)&&d?.enabled&&d.until>s.civilization.elapsed&&!s.civilization.city?.institutions?1:0;},
  reason(s,mode){if(!this.available(s))return '工坊与8位居民形成后可议定轮值；城市公署成立后由机构接续';if(!Object.hasOwn(this.modes,mode))return '选择轮值方向';const d=this.data(s);if(d?.enabled&&d.mode===mode&&this.crew(s))return '已按此方向轮值';if(CivilSociety.workforce(s)+this.crew(s)<4)return '至少留四名可用成人，才能抽出一人协调';return CivilRules.canPay(s,this.cost)?null:'轮值需木料2、食物1；补足后可恢复';},
  set(s,mode){this.init(s);if(this.reason(s,mode))return false;const d=this.data(s);d.mode=mode;d.enabled=true;d.changes.push({at:s.civilization.elapsed,mode,enabled:true});this.serve(s);return true;},
  stop(s,why='manual'){const d=this.data(s);if(!d?.enabled)return false;d.enabled=false;d.changes.push({at:s.civilization.elapsed,mode:d.mode,enabled:false,why});return true;},
  serve(s){const d=this.data(s),at=s.civilization.elapsed;if(d.until>at)return true;if(!CivilRules.pay(s,this.cost)){this.stop(s,'shortage');return false;}d.until=at+60;d.records.push({at,paid:{...this.cost}});return true;},
  plan(s,mode=this.data(s)?.mode){
    const w=s.game.workers,b=s.game.buildings,c=s.civilization,st=s.stores;
    const fixed=Object.fromEntries(Object.entries(w).filter(([k])=>!this.jobs.includes(k)));
    let left=Math.max(0,CivilSociety.workforce(s)-Object.values(fixed).reduce((a,n)=>a+n,0)-3);
    const next={...fixed},factor=Math.max(.15,CivilIndustry.factor(s));
    const cap=j=>Object.hasOwn(w,j)?CivilCatalog.jobCapacity(s,j):0;
    const put=(j,n)=>{next[j]=Math.max(0,Math.min(left,cap(j),Math.ceil(n)));left-=next[j];};
    // Medicine and teaching still use food, scrap and wood in CivilRules.industry.
    const meds=Math.min(cap('medic'),Math.ceil((s.game.population*.01+.2)/(.15*factor)));
    const eat=CivilSociety.foodPopulation(s)*.12*(CivilRules.policies[c.policy]?.food||1)*(b.cistern?.9:1)+meds*.2+(b.outpost?.2:0)+1/6;
    const foodGoal=eat+(mode==='reserves'?Math.max(1,eat*.5):.5),farmRate=(c.tech.irrigation&&c.outpostSupplied!==false?2:1.4)*factor;
    put('farmer',foodGoal/farmRate);put('hunter',Math.max(0,foodGoal-next.farmer*farmRate)/(.8*factor));
    put('medic',meds);put('teacher',Math.max(c.tech.school?2:0,Math.ceil(CivilPopulation.children(c.society.cohorts)/20)));
    // A finite buffer keeps the smith's inputs available; surplus workers choose wood or salvage.
    const smith=Math.min(cap('smith'),mode==='workshop'?4:2);
    put('salvager',((next.medic||0)*.1+smith*.6+.5)/((c.tech.metal?.8:.5)*factor)+(mode==='workshop'&&st.scrap<120?2:0));
    put('smith',smith);
    if((st.knowledge||0)<600&&left>0){const extra=Math.max(0,Math.min(left,cap('teacher')-next.teacher));next.teacher+=extra;left-=extra;}
    for(const j of this.jobs)if(!Object.hasOwn(w,j))delete next[j];
    return next;
  },
  settle(s){if(!this.enabled(s))return null;this.init(s);const d=this.data(s);if(s.civilization.city?.institutions){if(d.handoffAt===null){this.stop(s,'institution');d.handoffAt=s.civilization.elapsed;}return null;}if(!d.enabled)return null;
    if(CivilSociety.workforce(s)+this.crew(s)<4){this.stop(s,'workforce');return null;}
    const before=d.records.length;if(!this.serve(s))return null;Object.assign(s.game.workers,this.plan(s));CivilSociety.trimJobs(s);return d.records.length>before?this.cost:null;
  },
  validate(s){const d=this.data(s),c=s.civilization,fail=()=>{throw Error('轮值分工记录无效');};if(!this.enabled(s)){if(c.pacingVersion!==undefined||d!==undefined)fail();return;}if(c.polishVersion!==1||c.ruleset!==2||!d||d.schema!==1||typeof d.enabled!=='boolean'||!Object.hasOwn(this.modes,d.mode)||!Array.isArray(d.records)||!Array.isArray(d.changes))fail();const time=n=>Number.isSafeInteger(n)&&n>=0&&n<=c.elapsed;let last=-60;
    for(const r of d.records){if(!time(r.at)||r.at<last+60||JSON.stringify(r.paid)!==JSON.stringify(this.cost))fail();last=r.at;}
    if(d.until!==(d.records.length?last+60:0))fail();last=-1;let mode='reserves',enabled=false;
    for(const r of d.changes){if(!time(r.at)||r.at<last||!Object.hasOwn(this.modes,r.mode)||typeof r.enabled!=='boolean'||(!r.enabled&&!['manual','shortage','workforce','institution'].includes(r.why)))fail();last=r.at;mode=r.mode;enabled=r.enabled;}
    if(mode!==d.mode||enabled!==d.enabled||d.handoffAt!==null&&(!time(d.handoffAt)||!c.city?.institutions||d.enabled))fail();
  },
  refresh(s){if(typeof document==='undefined'||!document.getElementById?.('workers'))return;const exists=document.getElementById('civilWorkMandate');if(!this.available(s)){if(exists)exists.remove();$('#workers').removeClass('civil-worklisted');return;}let box=$('#civilWorkMandate');if(!box.length){box=$('<details>').attr('id','civilWorkMandate').addClass('civil-details').appendTo('#workers');$('<summary>').text('轮值分工').appendTo(box);$('<p>').attr('id','civilWorkStatus').appendTo(box);$('<p>').text('一名现有成人轮值协调，每60秒木料2、食物1。留三名机动成人；只调六项民用岗位，保留司机、守备和在途人员。手动调整民用岗位会暂停；城市公署成立后交接。').appendTo(box);$('<div>').attr('id','civilWorkChoices').appendTo(box);$('<p>').attr('id','civilWorkPreview').appendTo(box);}$('#workers').addClass('civil-worklisted');
    const d=this.data(s);$('#civilWorkStatus').text(d.enabled?this.modes[d.mode]+' · 协调员1人 · 下次续办 '+Math.max(0,d.until-s.civilization.elapsed)+'秒':'自行分工'+(d.changes.at(-1)?.why==='shortage'?' · 维护缺料已暂停，补足后可恢复':''));
    for(const [mode,label]of Object.entries(this.modes))CivilCityView.button('civilWork_'+mode,label,'#civilWorkChoices',this.reason(s,mode),()=>this.set(State,mode));
    CivilCityView.button('civilWork_stop','自行分工','#civilWorkChoices',d.enabled?null:'当前自行分工',()=>this.stop(State));
    $('#civilWorkPreview').text('储备安排多留食物余量；修造安排少留余粮，把更多人用于回收与制器。实际结果仍受岗位、健康与原料限制。');
  }
};
