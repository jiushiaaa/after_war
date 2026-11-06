/* MPL-2.0 — A bounded early work mandate; production remains in the original owners. */
var CivilPacing={
  modes:{reserves:'供养与储备',workshop:'修造与回收',industry:'工业投产',learning:'学徒与维修'},cost:{wood:2,food:1},jobs:['farmer','hunter','medic','teacher','salvager','smith'],industrialJobs:['miner','collier','smelter','machinist','electrician'],
  enabled(s){return [1,2].includes(s.civilization.pacingVersion);},data(s){return s.civilization.workMandate;},
  industrial(s,mode=this.data(s)?.mode){return s.civilization.pacingVersion===2&&['industry','learning'].includes(mode);},
  modesFor(s){return Object.fromEntries(Object.entries(this.modes).filter(([id])=>!['industry','learning'].includes(id)||s.civilization.pacingVersion===2));},
  managed(s,mode=this.data(s)?.mode){return this.industrial(s,mode)?[...this.jobs,...this.industrialJobs]:this.jobs;},
  industrialReady(s){return s.civilization.pacingVersion===2&&s.civilization.course?.id==='industry'&&s.civilization.village.town&&!!s.game.buildings.furnace;},
  available(s){return this.enabled(s)&&s.civilization.settled&&(s.game.population>=8||!!this.data(s)?.changes.length)&&!!s.game.buildings.workshop&&!s.civilization.city?.institutions;},
  init(s){if(this.enabled(s)&&this.data(s)===undefined)s.civilization.workMandate={schema:1,mode:'reserves',enabled:false,until:0,records:[],changes:[],handoffAt:null};},
  crew(s){const d=this.data(s);return this.enabled(s)&&d?.enabled&&d.until>s.civilization.elapsed&&!s.civilization.city?.institutions?1:0;},
  labor(s,mode=this.data(s)?.mode){return CivilSociety.workforce(s)+this.crew(s)-Object.entries(s.game.workers).filter(([j])=>!this.managed(s,mode).includes(j)).reduce((n,[,count])=>n+count,0);},
  reason(s,mode){if(!this.available(s))return '工坊与8位居民形成后可议定轮值；城市公署成立后由机构接续';if(!Object.hasOwn(this.modesFor(s),mode))return '选择轮值方向';if(this.industrial(s,mode)&&!this.industrialReady(s))return '工业城镇建成熔炉后可接管投产与学徒轮值';const d=this.data(s);if(d?.enabled&&d.mode===mode&&this.crew(s))return '已按此方向轮值';if(this.labor(s,mode)<4)return '至少留四名可用成人，才能抽出一人协调';return d?.until>s.civilization.elapsed||CivilRules.canPay(s,this.cost)?null:'轮值需木料2、食物1；补足后可恢复';},
  set(s,mode){this.init(s);if(this.reason(s,mode))return false;const d=this.data(s);d.mode=mode;d.enabled=true;d.changes.push({at:s.civilization.elapsed,mode,enabled:true});this.serve(s);Object.assign(s.game.workers,this.plan(s));CivilSociety.trimJobs(s);return true;},
  stop(s,why='manual'){const d=this.data(s);if(!d?.enabled)return false;d.enabled=false;d.changes.push({at:s.civilization.elapsed,mode:d.mode,enabled:false,why});return true;},
  commit(mode){const changed=mode===null?this.stop(State):this.set(State,mode);if(changed)Outside.updateWorkersView();return changed;},
  serve(s){const d=this.data(s),at=s.civilization.elapsed;if(d.until>at)return true;if(!CivilRules.pay(s,this.cost)){this.stop(s,'shortage');return false;}d.until=at+60;d.records.push({at,paid:{...this.cost}});return true;},
  plan(s,mode=this.data(s)?.mode){
    const w=s.game.workers,b=s.game.buildings,c=s.civilization,st=s.stores;
    const managed=this.managed(s,mode),industrial=this.industrial(s,mode),learning=mode==='learning';
    const fixed=Object.fromEntries(Object.entries(w).filter(([k])=>!managed.includes(k)));
    let left=Math.max(0,CivilSociety.workforce(s)-Object.values(fixed).reduce((a,n)=>a+n,0)-3);
    const next={...fixed},factor=Math.max(.15,CivilIndustry.factor(s));
    const cap=j=>Object.hasOwn(w,j)?CivilCatalog.jobCapacity(s,j):0;
    const put=(j,n)=>{next[j]=Math.max(0,Math.min(left,cap(j),Math.ceil(n)));left-=next[j];};
    // Medicine and teaching still use food, scrap and wood in CivilRules.industry.
    const meds=Math.min(cap('medic'),Math.ceil((s.game.population*.01+.2)/(.15*factor)));
    const eat=CivilSociety.foodPopulation(s)*.12*(CivilRules.policies[c.policy]?.food||1)*(b.cistern?.9:1)+meds*.2+(b.outpost?.2:0)+1/6;
    const foodGoal=eat+(mode==='reserves'&&(st.food||0)<eat*24?Math.max(1,eat*.5):.5),farmRate=(c.tech.irrigation&&c.outpostSupplied!==false?2:1.4)*factor;
    put('farmer',foodGoal/farmRate);put('hunter',Math.max(0,foodGoal-next.farmer*farmRate)/(.8*factor));
    put('medic',meds);put('teacher',Math.max(c.tech.school?2:0,Math.ceil(CivilPopulation.children(c.society.cohorts)/20)));
    // A finite buffer keeps the smith's inputs available; surplus workers choose wood or salvage.
    const repairReady=(st.food||0)>=eat*24&&(st.wood||0)>=120&&(st.tools||0)<24;
    const smith=Math.min(cap('smith'),mode==='workshop'||industrial?((st.tools||0)<120?cap('smith'):4):repairReady?8:2);
    const repairBuffer=mode==='workshop'||industrial?st.scrap<120:(st.scrap||0)<60&&(st.wood||0)>=120;
    put('salvager',((next.medic||0)*.1+smith*.6+.5)/((c.tech.metal?.8:.5)*factor)+(repairBuffer?2:0));
    put('smith',smith);
    if(industrial){
      // Competing uses of the same workforce. Training takes first claim only in learning mode.
      const teach=()=>{const extra=Math.max(0,Math.min(left,cap('teacher')-next.teacher));next.teacher+=extra;left-=extra;};
      if(learning&&(st.knowledge||0)<600)teach();
      const wanted=learning?{miner:2,collier:3,smelter:2,machinist:1}:{miner:4,collier:6,smelter:4,machinist:2};
      const target=learning?{ore:60,coal:80,iron:60,parts:40}:{ore:200,coal:240,iron:200,parts:120};
      // Power is a service, not a stockpile; coal and parts are still paid by CivilIndustry.
      put('electrician',4);
      for(const [job,key]of [['collier','coal'],['miner','ore'],['smelter','iron'],['machinist','parts']])put(job,(st[key]||0)<target[key]?wanted[job]:0);
    }
    if((st.knowledge||0)<600&&left>0){const extra=Math.max(0,Math.min(left,cap('teacher')-next.teacher));next.teacher+=extra;left-=extra;}
    for(const j of managed)if(!Object.hasOwn(w,j))delete next[j];
    return next;
  },
  settle(s){if(!this.enabled(s))return null;this.init(s);const d=this.data(s);if(s.civilization.city?.institutions){if(d.handoffAt===null){this.stop(s,'institution');d.handoffAt=s.civilization.elapsed;}return null;}if(!d.enabled)return null;
    if(this.labor(s)<4){this.stop(s,'workforce');return null;}
    const before=d.records.length;if(!this.serve(s))return null;Object.assign(s.game.workers,this.plan(s));CivilSociety.trimJobs(s);return d.records.length>before?this.cost:null;
  },
  validate(s){const d=this.data(s),c=s.civilization,fail=()=>{throw Error('轮值分工记录无效');};if(!this.enabled(s)){if(c.pacingVersion!==undefined||d!==undefined)fail();return;}const modes=this.modesFor(s);if(c.polishVersion!==1||c.ruleset!==2||!d||d.schema!==1||typeof d.enabled!=='boolean'||!Object.hasOwn(modes,d.mode)||!Array.isArray(d.records)||!Array.isArray(d.changes))fail();const time=n=>Number.isSafeInteger(n)&&n>=0&&n<=c.elapsed;let last=-60;
    for(const r of d.records){if(!time(r.at)||r.at<last+60||JSON.stringify(r.paid)!==JSON.stringify(this.cost))fail();last=r.at;}
    if(d.until!==(d.records.length?last+60:0))fail();last=-1;let mode='reserves',enabled=false;
    for(const r of d.changes){if(!time(r.at)||r.at<last||!Object.hasOwn(modes,r.mode)||this.industrial(s,r.mode)&&(c.course?.id!=='industry'||r.at<c.course.chosenAt)||typeof r.enabled!=='boolean'||(!r.enabled&&!['manual','shortage','workforce','institution'].includes(r.why)))fail();last=r.at;mode=r.mode;enabled=r.enabled;}
    if(mode!==d.mode||enabled!==d.enabled||d.handoffAt!==null&&(!time(d.handoffAt)||!c.city?.institutions||d.enabled))fail();
  },
  refresh(s){
    if(typeof document==='undefined'||!document.getElementById?.('workers'))return;
    let root=$('#civilEarlyWork');
    if(!this.available(s)){
      if(root.length){const jobs=$('#civilDelegatedJobs').length?$('#civilDelegatedJobs'):$('#workers');jobs.insertBefore(root);$('#socialNote,#civilManualGather').appendTo('#outsidePanel');root.remove();}
      return;
    }
    if(!root.length){
      root=$('<div>').attr('id','civilEarlyWork').appendTo('#outsidePanel');
      $('<p>').attr('id','civilWorkBrief').addClass('civil-brief').appendTo(root);
      const box=$('<details>').attr('id','civilWorkMandate').addClass('civil-details').appendTo(root);$('<summary>').text('议定轮值与优先事项').appendTo(box);
      $('<p>').attr('id','civilWorkStatus').appendTo(box);$('<p>').attr('id','civilWorkScope').appendTo(box);
      $('<div>').attr('id','civilWorkChoices').appendTo(box);$('<p>').attr('id','civilWorkPreview').appendTo(box);
      const manual=$('<details>').attr('id','civilEarlyJobs').addClass('civil-details').appendTo(root);$('<summary>').text('工种与手动调整').appendTo(manual);$('#workers').appendTo(manual);
    }
    for(const id of ['socialNote','civilManualGather'])if($('#'+id).length&&$('#'+id).parent()[0]!==root[0])$('#'+id).appendTo(root);
    const d=this.data(s);$('#civilWorkStatus').text(d.enabled?this.modes[d.mode]+' · 协调员1人 · 下次续办 '+Math.max(0,d.until-s.civilization.elapsed)+'秒':'自行分工'+(d.changes.at(-1)?.why==='shortage'?' · 维护缺料已暂停，补足后可恢复':''));
    $('#civilWorkScope').text('一名现有成人轮值协调，每60秒木料2、食物1。留三名机动成人；'+(this.industrial(s)?'当前接管民用与五项工业岗位':'当前只调六项民用岗位')+'，保留司机、守备和在途人员。手动调整受托岗位会暂停；城市公署成立后交接。');
    $('#civilWorkBrief').text(d.enabled?'已委托：'+this.modes[d.mode]+' · 协调员1人':'自行安排民用岗位');
    const manual=$('#civilEarlyJobs');if(manual.attr('data-enabled')!==String(d.enabled)){manual.attr('data-enabled',String(d.enabled));manual.prop('open',!d.enabled);}
    if(this.industrialReady(s)){
      $('#civilWork_reserves,#civilWork_workshop').hide();
      if(!$('#civilWorkDirection').length){const label=$('<label>').attr('for','civilWorkDirection').text('轮值方针 ').appendTo('#civilWorkChoices');const select=$('<select>').attr({id:'civilWorkDirection',size:4}).appendTo(label);for(const [id,name]of Object.entries(this.modesFor(s)))$('<option>').val(id).text(name).appendTo(select);select.val(d.mode).on('change',()=>this.refresh(State)).on('keydown keyup',e=>e.stopPropagation());}
      const selected=$('#civilWorkDirection').val();CivilCityView.button('civilWork_apply','按此方针委托','#civilWorkChoices',this.reason(s,selected),()=>this.commit($('#civilWorkDirection').val()));
    }else for(const [mode,label]of Object.entries(this.modesFor(s)))if(!['industry','learning'].includes(mode))CivilCityView.button('civilWork_'+mode,label,'#civilWorkChoices',this.reason(s,mode),()=>this.commit(mode));
    CivilCityView.button('civilWork_stop','自行分工','#civilWorkChoices',d.enabled?null:'当前自行分工',()=>this.commit(null));
    $('#civilWorkPreview').text('储备安排先留24轮供养，足够后转回基本产粮；木料足120时补废料至60、工具至24。修造安排优先补废料与工具至120，可使用已扩建的制器工位；工具够用后回到四人。实际仍受劳力、健康与原料限制。');
    if(this.industrialReady(s)){
      const descriptions={reserves:'先留24轮供养，够用后回到基本产粮；废料留60、工具留24。工业岗位自行安排。',workshop:'优先补废料与工具至120；使用已扩建的制器工位，够用后回到四人。工业岗位自行安排。',industry:'先满足生产工位：矿200、煤240、铁200、零件120。余下成人再安排教学。',learning:'先安排教师；工业只留维修缓冲：矿60、煤80、铁60、零件40。生产扩建会更慢。'};
      $('#civilWorkPreview').text(descriptions[$('#civilWorkDirection').val()]+' 全部仍受实际劳力、健康、原料与岗位上限限制。');
    }
  }
};
