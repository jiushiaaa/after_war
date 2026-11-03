/* MPL-2.0 — 战后文明: read-only "next step" line for the pre-town stages.
   It reads the same conditions the rules use; it never changes state. */
var CivilGuide={
  steps(s){
    const c=s.civilization,b=s.game.buildings,st=s.stores,v=c.village||{},pop=s.game.population||0,need=[];
    const lack=(ok,text)=>{if(!ok)need.push(text);};
    if(!c.settled){
      lack(pop>=4,'居民 '+pop+'/4');lack(b.lodge>0,'建猎棚');lack(b.granary>0,'建粮棚');lack(!!c.policy,'议定配给');
      lack((st.wood||0)>=60,'木料 '+Math.floor(st.wood||0)+'/60');lack((st.food||0)>=20,'食物 '+Math.floor(st.food||0)+'/20');lack(!c.hunger,'口粮不短缺');
      return {goal:'稳定聚落',need,note:need.length?null:'条件已满足，保持 '+Math.max(0,60-(c.stableFor||0))+' 秒'};
    }
    if(!b.workshop)return {goal:'收拾工坊',need:['在维修间建工坊（木料 100、废料 12）'],where:'room'};
    if(!c.station)return {goal:'找到旧交通站',need:['旧公路 → 近郊：带口粮和饮水，沿旧公路向东北走'],where:'road'};
    if(!c.pump){
      lack(!!c.tech.water,'研究净水工艺');
      lack(true,'带维修件走到西南的泵站（P）');
      return {goal:'修复泵站',need,where:c.tech.water?'road':'research'};
    }
    if(!b.outpost){
      lack(!!c.tech.metal,'研究金属回收');lack(b.cistern>0,'建集水设施');lack(pop>=8,'居民 '+pop+'/8');
      lack(true,'建补给外站');return {goal:'设立补给外站',need,where:'room'};
    }
    if(!v.riverKnown){lack(!!c.tech.handtools,'研究标准手工具');lack(!!c.tech.trails,'研究道路维护');lack(true,'旧公路 → 沿河勘察');return {goal:'寻找河谷',need,where:'road'};}
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
    return {goal:city?(s.civilization.ruleset===2?'完成核心镇服务交接':commons?'成为城市（田地与公共服务）':'成为城市'):'登记镇制',need:checks.filter(([,ok])=>!ok).map(([label])=>label),note:checks.every(([,ok])=>ok)?'保持 '+Math.max(0,(city?300:180)-(city?u.cityStable:u.townStable))+' 秒':null};
  },
  text(s){const g=this.steps(s);if(!g)return null;return '下一步：'+g.goal+(g.need.length?' · 还差 '+g.need.slice(0,3).join('、')+(g.need.length>3?' 等 '+g.need.length+' 项':''):'')+(g.note?' · '+g.note:'');},
  refresh(s){
    if(typeof document==='undefined'||typeof document.getElementById!=='function'||!document.getElementById('roomPanel'))return;
    let el=document.getElementById('civilGuide');const text=this.text(s);
    if(!text){if(el)el.remove();return;}
    // After the town charter is in view the urban page becomes the home for planning.
    const host=document.getElementById(s.civilization.village?.town&&document.getElementById('urbanPanel')?'urbanPanel':'roomPanel');
    if(!el){el=document.createElement('div');el.id='civilGuide';el.className='civil-brief civil-guide';el.setAttribute('role','status');}
    if(el.parentNode!==host){if(host.id==='urbanPanel')host.insertBefore(el,host.firstChild);else host.appendChild(el);}
    if(el.textContent!==text)el.textContent=text;
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
