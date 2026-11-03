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
    if(!v.town){
      lack(!!b.road,'建河谷道路');lack(!!v.riverAllied,'援助河谷并商议互助');lack(pop>=20,'居民 '+pop+'/20');
      lack(!!b.clinic,'建诊所');lack(!!b.schoolhouse,'建学堂');lack((v.health||0)>=60,'健康 '+Math.floor(v.health||0)+'/60');
      lack((v.convoys||0)>=3,'车队往返 '+(v.convoys||0)+'/3');
      if((v.convoys||0)>=3&&v.routeStatus!=='往返正常')need.push('车队：'+v.routeStatus);
      lack((st.tools||0)>=10,'工具 '+Math.floor(st.tools||0)+'/10');
      return {goal:'成为小镇',need,note:need.length?null:'条件已满足，保持 '+Math.max(0,120-(v.townStable||0))+' 秒'};
    }
    return null;
  },
  text(s){const g=this.steps(s);if(!g)return null;return '下一步：'+g.goal+(g.need.length?' · 还差 '+g.need.slice(0,3).join('、')+(g.need.length>3?' 等 '+g.need.length+' 项':''):'')+(g.note?' · '+g.note:'');},
  refresh(s){
    if(typeof document==='undefined'||!document.getElementById?.('roomPanel'))return;
    let el=document.getElementById('civilGuide');const text=this.text(s);
    if(!text){if(el)el.remove();return;}
    if(!el){el=document.createElement('div');el.id='civilGuide';el.className='civil-brief civil-guide';el.setAttribute('aria-live','polite');document.getElementById('roomPanel').appendChild(el);}
    if(el.textContent!==text)el.textContent=text;
  }
};
