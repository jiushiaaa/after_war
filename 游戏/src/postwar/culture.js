/* MPL-2.0 — A paid local commons; no invented residents, faith census or global buffs. */
var CivilCulture={
  pendingIds:['culture_river','culture_rail','culture_highland','culture_ford'],
  modes:{shared:'共享轮用',archive:'公共档案专用'},
  kinds:{archive:'口述档案交流',memorial:'守灯纪念'},
  cost:{wood:4,food:6},duration:180,interval:600,
  data(s,id){return s.civilization.culture?.nodes[id];},
  agreement(s,id){return this.data(s,id)?.agreements.at(-1);},
  active(s,id){const r=this.data(s,id)?.activities.at(-1);return r?.status==='active'?r:null;},
  enabled(s,id){return this.data(s,id)?.controls.at(-1)?.enabled??true;},
  eligible(s,id){const m=CivilMunicipal.data(s,id),n=CivilMunicipal.node(s,id);return !!(m?.town&&m.buildings.school&&CivilMunicipal.canAccept(s,id)&&n.health>=60&&CivilPopulation.workforce(n.cohorts)>=20);},
  due(s,id){const d=this.data(s,id);if(!d)return Infinity;return Math.max(this.agreement(s,id).at+60,(d.activities.at(-1)?.endedAt??-600)+600);},
  nextKind(s,id){const a=this.agreement(s,id);if(a.mode==='archive')return 'archive';const last=this.data(s,id).activities.filter(r=>r.agreementId===a.id&&r.status==='complete').at(-1);return last?.kind==='archive'?'memorial':'archive';},
  needsWorkers(s,id){return !!this.data(s,id)&&!!(this.active(s,id)||(this.enabled(s,id)&&s.civilization.elapsed>=this.due(s,id)));},
  reason(s,id){
    const n=CivilMunicipal.node(s,id),m=CivilMunicipal.data(s,id),e=m?.economy;
    if(!CivilMunicipal.canAccept(s,id))return '地方议约暂停';
    if(!m.buildings.meetinghall)return '先建公共会堂';
    if(n.health<60||!e||s.civilization.elapsed-e.at>10||!e.education||!e.treatment)return '先维持地方健康、治疗与儿童教学';
    if((n.workers.communityworker||0)!==14)return '生产与公共服务之外还需14位成年人';
    if((n.stores.food||0)+1e-8<CivilMunicipal.foodReserve(s,id))return '先留下120秒居民口粮';
    return null;
  },
  agree(s,id,mode){
    if(!Object.hasOwn(this.modes,mode)||!this.eligible(s,id)||this.active(s,id)||this.agreement(s,id)?.mode===mode)return false;
    const n=CivilMunicipal.node(s,id);if(!CivilMunicipal.pay(n.stores,{knowledge:10}))return false;
    const c=s.civilization;if(c.culture===undefined)c.culture={schema:1,nodes:{}};
    if(!this.data(s,id))c.culture.nodes[id]={introducedAt:c.elapsed,agreements:[],controls:[],activities:[]};
    const d=this.data(s,id),unrestDelta=mode==='archive'?Math.min(4,100-n.unrest):0;
    d.agreements.push({id:d.agreements.length+1,at:c.elapsed,generation:c.society.generation,mode,paid:{knowledge:10},unrestDelta});n.unrest+=unrestDelta;
    CivilMunicipal.planWorkers(s,id);return true;
  },
  setEnabled(s,id,enabled){
    const d=this.data(s,id);if(!d||typeof enabled!=='boolean'||this.enabled(s,id)===enabled)return false;
    d.controls.push({at:s.civilization.elapsed,enabled});CivilMunicipal.planWorkers(s,id);return true;
  },
  start(s,id){
    const d=this.data(s,id);if(!d||this.active(s,id)||!this.enabled(s,id)||s.civilization.elapsed<this.due(s,id)||this.reason(s,id))return false;
    const n=CivilMunicipal.node(s,id);if((n.stores.food||0)+1e-8<CivilMunicipal.foodReserve(s,id)+this.cost.food||!CivilMunicipal.pay(n.stores,this.cost))return false;
    d.activities.push({id:d.activities.length+1,agreementId:this.agreement(s,id).id,controlVersion:d.controls.length,kind:this.nextKind(s,id),startedAt:s.civilization.elapsed,lastTick:s.civilization.elapsed,
      remaining:this.duration,status:'active',endedAt:null,paid:{...this.cost},benefit:{knowledge:0,unrest:0}});return true;
  },
  cancel(s,id){
    const r=this.active(s,id);if(!r)return false;
    r.status='cancelled';r.endedAt=s.civilization.elapsed;CivilMunicipal.planWorkers(s,id);return true;
  },
  tick(s){
    for(const id of Object.keys(s.civilization.culture?.nodes||{})){
      const r=this.active(s,id);if(!r){this.start(s,id);continue;}
      if(r.lastTick>=s.civilization.elapsed)continue;r.lastTick=s.civilization.elapsed;
      if(this.reason(s,id))continue;
      r.remaining=Math.max(0,r.remaining-1);
      if(!r.remaining){
        const n=CivilMunicipal.node(s,id);r.status='complete';r.endedAt=s.civilization.elapsed;
        if(r.kind==='archive'){n.stores.knowledge=(n.stores.knowledge||0)+6;r.benefit.knowledge=6;}
        else {r.benefit.unrest=Math.min(2,n.unrest);n.unrest-=r.benefit.unrest;}
        if(this.data(s,id).activities.filter(a=>a.kind===r.kind&&a.status==='complete').length===1)CivilMunicipal.note(CivilRegionContent[id].name+'第一次完成'+this.kinds[r.kind]+'。会堂、材料与现有居民的时间都记入了地方记录。');
        CivilMunicipal.planWorkers(s,id);
      }
    }
  },
  status(s,id){
    const d=this.data(s,id);if(!d)return '公共空间尚未议约';
    const r=this.active(s,id),completed=d.activities.filter(a=>a.status==='complete');
    return this.modes[this.agreement(s,id).mode]+' · 已完成'+completed.length+'次。'+(r?this.kinds[r.kind]+'还需'+r.remaining+'工秒；'+(this.reason(s,id)||'2位组织者与12位参与者在场'):!this.enabled(s,id)?'后续活动已停办。':s.civilization.elapsed<this.due(s,id)?'下次筹备还有'+Math.ceil(this.due(s,id)-s.civilization.elapsed)+'秒。':this.reason(s,id)||'等候地方备齐4木料、6食物和口粮储备。');
  },
  event(eventId){
    const match=/^culture_(river|rail|highland|ford)$/.exec(eventId);if(!match)return null;
    const s=State,id=match[1],d=this.data(s,id);if(!d&&!this.eligible(s,id))return null;
    const snapshot=()=>JSON.stringify([this.agreement(s,id)?.id||0,this.enabled(s,id),this.active(s,id)?.id||0]),offered=snapshot();
    const run=(fn,lease=snapshot,expected=offered)=>()=>{if(s.civilization.pending!==eventId||lease()!==expected||!fn())return false;s.civilization.pending=null;Civilization.refresh();Engine.saveGame();return true;};
    const buttons={};
    if(!this.active(s,id)&&this.eligible(s,id))for(const [mode,name]of Object.entries(this.modes))if(this.agreement(s,id)?.mode!==mode)buttons[mode]={text:name,nextScene:'end',onChoose:run(()=>this.agree(s,id,mode))};
    if(d){const enabled=this.enabled(s,id),scheduleLease=()=>JSON.stringify([this.agreement(s,id)?.id||0,this.enabled(s,id)]);buttons.schedule={text:enabled?'停止后续活动':'恢复后续活动',nextScene:'end',onChoose:run(()=>this.setEnabled(s,id,!enabled),scheduleLease,scheduleLease())};}
    if(this.active(s,id))buttons.cancel={text:'取消本次活动',nextScene:'end',onChoose:run(()=>this.cancel(s,id))};
    buttons.close={text:'暂不改变',nextScene:'end',onChoose:()=>{if(s.civilization.pending!==eventId)return false;s.civilization.pending=null;return true;}};
    return {title:CivilRegionContent[id].name+'的公共空间',text:[
      '档案互助社希望记录迁徙与重建经历；守灯会希望用自己的礼仪悼念逝者。两方都来自现有居民，信仰与人类、变异居民身份无关，这里不推定信徒人数。',
      '共享轮用：口述交流与守灯纪念交替开放，遵守同等预约规则。档案专用：公共会堂只办口述交流，不限制私下信仰；守灯会的公共空间请求未获满足，议约时地方不满增加至多4。',
      '每次议约由地方实付10知识，之后从市政的社群分类建公共会堂。每次活动先实付地方4木料、6食物；2位组织者与12位成年参与者须在生产、施工、诊疗和教学之外腾出180工秒。结束后至少600秒才再筹备，不追补停办期间的活动。',
      '口述交流完成后存入6地方知识；守灯纪念通过兑现空间约定使地方不满减少至多2，不提供医疗、科技或全局增产。停办只停止新活动，当前活动继续；取消本次不退已用筹备材料。',this.status(s,id)
    ],buttons};
  },
  refresh(s,id){
    const visible=this.eligible(s,id)||!!this.data(s,id);let b=$('#cultureButton');
    if(visible){b=Civilization.button('cultureButton','社群公共空间','#municipalBuild',()=>{const target=CivilMunicipal.selected;if(!Events.activeEvent()&&!s.civilization.pending&&(this.eligible(s,target)||this.data(s,target))){s.civilization.pending='culture_'+target;Civilization.showPending();}});b.attr('title',this.status(s,id));}
    b.toggle(visible);
  },
  validate(s){
    const c=s.civilization,v=c.culture;if(v===undefined)return;
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),num=(x,max=c.elapsed)=>Number.isFinite(x)&&x>=0&&x<=max,int=(x,max=c.elapsed)=>Number.isSafeInteger(x)&&num(x,max);
    const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
    const fail=()=>{throw Error('公共空间与活动记录无效');};
    if(!exact(v,['schema','nodes'])||v.schema!==1||!obj(v.nodes))fail();
    for(const [id,d]of Object.entries(v.nodes)){
      const m=CivilMunicipal.data(s,id);
      if(!Object.hasOwn(CivilRegionContent,id)||!m||!exact(d,['introducedAt','agreements','controls','activities'])||!int(d.introducedAt)||d.introducedAt<m.agreedAt||!Array.isArray(d.agreements)||!d.agreements.length||!Array.isArray(d.controls)||!Array.isArray(d.activities))fail();
      let at=d.introducedAt,previousMode=null;
      for(const [index,a]of d.agreements.entries()){
        if(!exact(a,['id','at','generation','mode','paid','unrestDelta'])||a.id!==index+1||!int(a.at)||a.at<at||(index===0&&a.at!==d.introducedAt)||!int(a.generation,c.society.generation)||a.generation<1||!Object.hasOwn(this.modes,a.mode)||a.mode===previousMode||!exact(a.paid,['knowledge'])||a.paid.knowledge!==10||!num(a.unrestDelta,a.mode==='archive'?4:0))fail();
        const term=a.generation===c.society.generation?{from:c.society.leader.started,to:Math.floor(c.elapsed/600)}:c.society.history[a.generation-1];if(Math.floor(a.at/600)<term.from||Math.floor(a.at/600)>term.to)fail();
        at=a.at;previousMode=a.mode;
      }
      let enabled=true;at=d.introducedAt;for(const x of d.controls){if(!exact(x,['at','enabled'])||!int(x.at)||x.at<at||typeof x.enabled!=='boolean'||x.enabled===enabled)fail();enabled=x.enabled;at=x.at;}
      let ended=-600,active=false;const lastComplete={};
      for(const [index,r]of d.activities.entries()){
        const a=d.agreements[r?.agreementId-1],hall=m.completed.find(p=>p.type==='meetinghall');
        if(!exact(r,['id','agreementId','controlVersion','kind','startedAt','lastTick','remaining','status','endedAt','paid','benefit'])||active||r.id!==index+1||!int(r.agreementId,d.agreements.length)||r.agreementId<1||!a||!hall||!m.buildings.meetinghall||!int(r.startedAt)||r.startedAt<Math.max(a.at+60,ended+600,hall.completedAt)||!int(r.lastTick)||r.lastTick<r.startedAt||!int(r.remaining,180)||!['active','complete','cancelled'].includes(r.status)||!exact(r.paid,['wood','food'])||r.paid.wood!==4||r.paid.food!==6||!exact(r.benefit,['knowledge','unrest'])||!int(r.controlVersion,d.controls.length))fail();
        const control=d.controls[r.controlVersion-1],laterControl=d.controls[r.controlVersion];
        if(d.agreements.some(x=>x.id>a.id&&x.at<r.startedAt)||control?.enabled===false||(control&&control.at>r.startedAt)||(laterControl&&laterControl.at<r.startedAt)||r.kind!==(a.mode==='archive'?'archive':lastComplete[a.id]==='archive'?'memorial':'archive')||r.startedAt+180-r.remaining>r.lastTick)fail();
        if(r.status==='active'){if(r.endedAt!==null||r.remaining<=0||r.benefit.knowledge!==0||r.benefit.unrest!==0)fail();active=true;}
        else {
          if(!int(r.endedAt)||r.endedAt<r.lastTick||r.endedAt<r.startedAt+180-r.remaining)fail();ended=r.endedAt;
          if(r.status==='complete'){
            if(r.remaining!==0||r.endedAt!==r.lastTick||r.benefit.knowledge!==(r.kind==='archive'?6:0)||!num(r.benefit.unrest,r.kind==='memorial'?2:0))fail();lastComplete[a.id]=r.kind;
          }else if(r.remaining<=0||r.benefit.knowledge!==0||r.benefit.unrest!==0)fail();
        }
        if(d.agreements.some(x=>x.id>a.id&&x.at<(r.endedAt??c.elapsed+1)))fail();
      }
    }
  }
};
