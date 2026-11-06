/* MPL-2.0 — 战后文明: read-only next steps from the hearth to joint city responsibilities.
   It reads the same conditions the rules use; it never changes state. */
var CivilGuide={
  steps(s){
    const c=s.civilization,b=s.game.buildings,st=s.stores,v=c.village||{},pop=s.game.population||0,need=[];
    if(Number.isSafeInteger(c.city?.cityAt))return this.citySteps(s);
    const lack=(ok,text)=>{if(!ok)need.push(text);};
    if(!c.settled){
      if(!b.hut&&pop===0)return {goal:'为第一批居民留一间屋',need:(st.wood||0)<100?['木料 '+Math.floor(st.wood||0)+'/100']:[],where:'room',target:'build_hut',note:'木屋容四人；也可先做陷阱备粮，但陷阱会用掉同一批屋材'};
      if(b.hut&&pop===0){const period=typeof CivilSetup!=='undefined'&&CivilSetup.options(s).fast?45:60;const cold=(s.game.temperature?.value||0)<2,food=(st.food||0)<6;return {goal:'等循着炊烟来的人',need:[...(cold?['先让房间暖起来']:[]),...(food?['食物 '+Math.floor(st.food||0)+'/6']:[])],where:cold?'room':food?'outside':null,target:cold?'stokeButton':food?'forageButton':null,note:!cold&&!food?'空床与口粮已备好，下次接纳检查约 '+Math.max(0,period-c.populationClock)+' 秒':'不用继续造屋；先让现有床位能够住人'};}
      lack(pop>=4,'居民 '+pop+'/4');lack(b.lodge>0,'建猎棚');lack(b.granary>0,'建粮棚');lack(!!c.policy,'议定配给');
      lack((st.wood||0)>=60,'木料 '+Math.floor(st.wood||0)+'/60');lack((st.food||0)>=20,'食物 '+Math.floor(st.food||0)+'/20');lack(!c.hunger,'口粮不短缺');
      return {goal:'稳定聚落',need,note:need.length?null:'条件已满足，保持 '+Math.max(0,60-(c.stableFor||0))+' 秒'};
    }
    if(!b.workshop)return {goal:'收拾工坊',need:['在维修间建工坊（木料 100、废料 12）'],where:'room',target:'build_workshop'};
    if(!c.station)return {goal:'找到旧交通站',need:['旧公路 → 近郊：带口粮和饮水，沿旧公路向东北走'],where:'road'};
    if(!c.pump){
      lack(!!c.tech.water,'研究净水工艺');
      if(c.tech.water)lack(false,'带维修件走到西南的泵站（P）');
      return {goal:'修复泵站',need,where:c.tech.water?'road':'research'};
    }
    if(!b.outpost){
      lack(!!c.tech.metal,'研究金属回收');lack(b.cistern>0,'建集水设施');lack(pop>=8,'居民 '+pop+'/8');
      lack(false,'建补给外站');return {goal:'设立补给外站',need,where:'room'};
    }
    if(!v.riverKnown){const fast=typeof CivilSetup!=='undefined'&&CivilSetup.options(s).fast;if(fast&&!c.tech.trails){lack(!!c.tech.water,'研究净水工艺');lack(!!c.tech.records,'研究'+CivilText.research.records.name);}else{lack(!!c.tech.handtools,'研究标准手工具');lack(!!c.tech.trails,'研究道路维护');}lack(false,'旧公路 → 沿河勘察');return {goal:'寻找河谷',need,where:'road'};}
    if(v.town&&typeof CivilCourse!=='undefined'&&CivilCourse.needsChoice(s))return {goal:'议定小镇方针',need:['等待居民议事（事件窗口）'],note:null};
    if(!v.town){
      lack(!!b.road,'建河谷道路');lack(!!v.riverAllied,'援助河谷并商议互助');lack(pop>=20,'居民 '+pop+'/20');
      lack(!!b.clinic,'建诊所');lack(!!b.schoolhouse,'建学堂');lack((v.health||0)>=60,'健康 '+Math.floor(v.health||0)+'/60');
      lack((v.convoys||0)>=3,'车队往返 '+(v.convoys||0)+'/3');
      if((v.convoys||0)>=3&&v.routeStatus!=='往返正常')need.push('车队：'+v.routeStatus);
      lack((st.tools||0)>=10,'工具 '+Math.floor(st.tools||0)+'/10');
      return {goal:'成为小镇',need,note:need.length?null:'条件已满足，保持 '+Math.max(0,120-(v.townStable||0))+' 秒'};
    }
    const u=c.urban;if(!u||typeof CivilUrban==='undefined')return null;
    if(u.city){
      if(c.ruleset===2&&typeof CivilCity!=='undefined'&&c.city?.cityAt===null){
        const members=CivilCity.members(s),total=CivilCity.population(s),missing=[];
        if(members.length<2)missing.push('城域 → 普查片区、共同修路与修复水务，再登记公共职责');
        if(total<10000)missing.push('管辖居民 '+total+'/10000（片区居民留在原处）');
        for(const [id,n]of members)if(n.stable<120)missing.push(CivilCityContent.wards[id].name+'：稳定供养 '+n.stable+'/120秒');
        return {goal:'登记万人城市',need:missing,where:'city'};
      }
      return null;
    }
    const city=!!u.chartered,commons=city&&typeof CivilCourse!=='undefined'&&CivilCourse.is(s,'commons');
    const checks=CivilUrban.developmentChecks(s,city);
    if(!city&&!c.tech.standards){
      const prereqs=typeof CivilCourse!=='undefined'?CivilCourse.requires(s,'standards'):CivilText.research.standards.requires;
      const missing=prereqs.filter(k=>!c.tech[k]).map(k=>'研究'+CivilText.research[k].name),cost=typeof CivilCourse!=='undefined'?CivilCourse.researchCost(s,'standards'):CivilText.research.standards.cost;
      for(const [key,n]of Object.entries(cost))if((st[key]||0)<n)missing.push((CivilText.labels[key]||key)+' '+Math.floor(st[key]||0)+'/'+n);
      return {goal:'先研究标准与计量，开放公共设施和扩建住房',need:missing,where:'research',note:c.research?.id==='standards'?'研究中，剩余 '+Math.ceil(c.research.remaining)+' 秒':missing.length?null:'科技页可以开始研究'};
    }
    const reserveTools=typeof CivilPacing!=='undefined'&&CivilPacing.enabled(s)&&city&&pop>=400&&u.enabled&&(st.tools||0)<(commons?60:40);
    if(c.pacingVersion===1&&city){
      const w=s.game.workers;
      if(c.tech.publicHealth&&(u.economy?.medicine||0)<0&&(w.medic||0)>=CivilCatalog.jobCapacity(s,'medic')&&(b.publicclinic||0)<CivilCatalog.buildingLimit(s,'publicclinic'))return {goal:'为现有人口扩充诊疗',need:checks.filter(([,ok])=>!ok).map(([label])=>label),where:'urban',section:'care',target:'build_publicclinic',note:'公共卫生网络可支持12所公共诊疗站；扩建仍须实付材料，由现有成人任职'};
      if(c.tech.precisionFit&&(st.tools||0)<(commons?60:40)&&(w.smith||0)>=CivilCatalog.jobCapacity(s,'smith')&&(b.toolworks||0)<CivilCatalog.buildingLimit(s,'toolworks'))return {goal:'扩建制器间，或先留工具给交接',need:checks.filter(([,ok])=>!ok).map(([label])=>label),where:'urban',section:'care',target:'build_toolworks',note:'制器岗位已满。可付木160、铁20、零件6增加四个工位；修造轮值会安排真实人手，采集与教学会少一些'};
    }
    return {goal:city?(s.civilization.ruleset===2?'完成核心镇服务交接':commons?'成为城市（田地与公共服务）':'成为城市'):'登记镇制',need:checks.filter(([,ok])=>!ok).map(([label])=>label),...(reserveTools?{where:'urban',target:'urbanPlan'}:{}),note:reserveTools?'新批次也会支出安置工具。可暂缓发车，先留材料给公共服务；在途家庭照常接纳':checks.every(([,ok])=>ok)?'保持 '+Math.max(0,(city?300:180)-(city?u.cityStable:u.townStable))+' 秒':null};
  },
  citySteps(s){
    const c=s.civilization;if(c.polity?.foundedAt||c.domain)return null;
    const step=(goal,reason,visit,note=null)=>({goal,need:reason?[reason]:[],where:'city',visit,note});
    if(!c.city.institutions)return step('让城市机构接过日常分工',CivilCityInstitutions.reason(s),{city:'home',view:'production',target:'cityInstitution'},'登记前可查看本城与片区实际开支');
    const modern=CivilModern.gate(s,'city');if(modern)return {goal:'接通电与通信',need:[modern],where:'research',target:'modernDesk',note:c.research?'研究中，剩余 '+Math.ceil(c.research.remaining)+' 秒':'公共路线可用地方电网，不要求采矿燃煤'};
    const d=c.conurbation,n=c.cityNetwork;
    if(!d)return step('联络第二座真实城市',CivilConurbation.surveyReason(s),{city:'home',view:'overview',target:'metroCitySurvey'},'湖滨保留自己的居民、资产与公仓');
    if(d.survey)return step('湖岸普查进行中',null,{city:'link'},'两名普查员暂离岗位，尚需 '+d.survey.remaining+' 秒；可先安排本城培训与生产');
    if(!d.route)return step('共同修复两城道路',CivilConurbation.buildReason(s,'yards'),{city:'link',target:'metroCityActions'},'两端各派20人、各付路材，不合并仓库');
    if(d.route.phase==='building')return step('两城道路施工中',null,{city:'link'},'尚需 '+d.route.remaining+' 工时；缺供养会停工，可查看地方收支');
    if(!d.contract)return step('议定两城第一份协作',c.deliberation?.proposal?.id==='city_exchange'?'公共议题正在讨论':null,{city:'link',target:'metroCityAgreement'},'粮医或工料使用不同真实货物；也可以暂缓协作');
    if(!d.clusterAt){const p=CivilConurbation.active(s),why=p?null:CivilConurbation.dispatchReason(s);return step('让第一批互济实际抵达',why,{city:'link',target:'metroCityActions'},p?'车辆'+(p.status==='outbound'?'去程':'返程')+'，尚需 '+p.remaining+' 秒；到货前仍是在途':'自动按协约备货；若地方工坊缺工具，可实付送修复物资');}
    if(!n)return step('两条线路共用有限车辆',CivilCityNetwork.formReason(s),{city:'link',target:'metroCityActions'},'可设联合调度所，再沿旧铁路普查矿岭');
    if(!n.node)return step('联络第三座城市',n.survey?null:CivilCityNetwork.surveyReason(s),{city:'link',network:'overview',target:'cityNetActions_overview'},n.survey?'普查尚需 '+n.survey.remaining+' 秒':'矿岭有不同产业；接入后仍要承担供养和交通维护');
    if(!n.road)return step('接通矿岭道路',CivilCityNetwork.buildReason(s),{city:'link',network:'overview',target:'cityNetActions_overview'});
    if(n.road.completedAt===null)return step('矿岭道路施工中',null,{city:'link',network:'overview'},'尚需 '+n.road.remaining+' 工时；可先检查两条线的运行预算');
    if(!n.enabled)return step('授权第三城的真实互市',null,{city:'link',network:'transport',target:'cityNet_enable'},'粮医与工料竞争同一组车辆；授权前可先选让行规则');
    if(!c.cityCouncil){const p=CivilCityNetwork.active(s);return step('从互市走向共同职责',CivilCityCouncil.available(s)?CivilCityCouncil.formReason(s):p?null:CivilCityNetwork.dispatchReason(s),{city:'link',network:'overview',target:'cityNet_formCouncil'},p?'矿岭货物在途，尚需 '+p.remaining+' 秒':'三城实际交货后，可各自实付设立公用站');}
    const building=Object.entries(c.cityCouncil.offices).filter(([,o])=>o.completedAt===null);
    if(building.length)return step('公用站由各城建设',null,{city:'council',target:'councilCurrent'},building.map(([id,o])=>CivilCityCouncil.name(s,id)+' '+o.remaining+'工时').join('、'));
    const project=c.cityCouncil.projects.find(p=>p.completedAt===null);
    return step(project?'让共同工程按授权办理':'把下一笔材料用在哪里',null,{city:'council',target:project?'councilCurrent':'councilProposal'},project?'先检查实际到料、车辆与当地额度；无需逐车催发':'安居、直路和地方扩容争用同一批材料。展开议案可比较受益地、地方诉求和分担。');
  },
  open(s,task=this.steps(s)){
    if(!task?.where)return;const v=task.visit;
    if(task.where==='urban'&&(task.section||task.target==='urbanPlan'))CivilInterface.select('urban',task.section||'migration');
    if(v){if(v.city)CivilConurbationView.selected=v.city;if(v.view)CivilCityView.view=v.view;if(v.network)CivilCityNetworkView.section=v.network;CivilCityView.refresh(s);this.refresh(s);}
    const tab=document.getElementById('location_'+task.where);if(tab&&!tab.classList.contains('selected'))tab.click();
    const target=document.getElementById(v?.target||task.target||'');if(target){for(let p=target;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}
  },
  text(s){const g=this.steps(s);if(!g)return null;return '下一步：'+g.goal+(g.need.length?' · 还差 '+g.need.slice(0,3).join('、')+(g.need.length>3?' 等 '+g.need.length+' 项':''):'')+(g.note?' · '+g.note:'');},
  refresh(s){
    if(typeof document==='undefined'||typeof document.getElementById!=='function'||!document.getElementById('roomPanel'))return;
    let el=document.getElementById('civilGuide');const text=this.text(s);
    if(!text){if(el)el.remove();return;}
    // After the town charter is in view the urban page becomes the home for planning.
    const host=document.getElementById(Number.isSafeInteger(s.civilization.city?.cityAt)&&document.getElementById('cityBody')?'cityBody':s.civilization.village?.town&&document.getElementById('urbanPanel')?'urbanPanel':'roomPanel');
    if(!el){el=document.createElement('div');el.id='civilGuide';el.className='civil-brief civil-guide';const line=document.createElement('p');line.setAttribute('role','status');el.appendChild(line);const actions=document.createElement('div');actions.id='civilGuideActions';el.appendChild(actions);}
    if(el.parentNode!==host){if(host.id==='roomPanel')host.appendChild(el);else host.prepend(el);}el.style.display='';
    if(el.firstChild.textContent!==text)el.firstChild.textContent=text;
    const task=this.steps(s);CivilCityView.button('civilGuideGo','查看办理入口','#civilGuideActions',null,()=>{this.open(State);return false;}).toggle(!!task.where);
    const home=s.civilization.city?.institutions?.home;
    CivilCityView.button('civilGuideDelegate','交接原镇日常','#civilGuideActions',null,()=>{this.open(State,{where:'city',visit:{city:'home',view:'production',target:'cityHomeDelegation'}});return false;}).toggle(!!home&&!home.enabled&&!CivilCityContinuity.data(s));
  }
};
// Header tabs grouped by player task; panel order (used by travel) is untouched.
var CivilNav={
  groups:[['家园',['room','outside','urban','city']],['探索',['road','regions']],['建设与供给',['industry','municipal']],['科技',['research']],['共同事务',['council']]],
  scope:{room:'炉火与本地建设',outside:'本地居民与岗位',urban:'本地住房、供养与迁居',city:'片区人口、公共服务、生产和运输',road:'近郊地图与远行',regions:'已知地区与路线',industry:'本城原料、加工与能源',municipal:'某个地方的建设',research:'科技与工艺',council:'制度、继任与对外事务'},
  order(){
    if(typeof document==='undefined'||typeof document.getElementById!=='function')return;const header=document.getElementById('header');if(!header||!header.querySelectorAll)return;
    const tabs=[...header.querySelectorAll('.headerButton')];if(tabs.length<7){tabs.forEach(t=>t.classList.remove('civil-group-start'));return;} // early game keeps the native order
    let prev=null,group=null;
    for(const [name,ids] of this.groups)for(const id of ids){
      const el=document.getElementById('location_'+id);if(!el)continue;
      el.classList.toggle('civil-group-start',group!==null&&group!==name&&el!==tabs[0]);
      if(this.scope[id])el.title=name+' · '+this.scope[id];
      group=name;
      if(prev)prev.after(el);else header.prepend(el);prev=el;
    }
  }
};
