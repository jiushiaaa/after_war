/* MPL-2.0 — Reuse the city switch and the existing census disclosure. */
var CivilCityRegistryView={
  growth(s){const api=CivilCityRegistry,d=api.data(s),r=api.remote(s),c=CivilCityCouncil,v=CivilCityView;if(!CivilCityContinuity.data(s))return;
    if(!$('#registryGrowth').length)$('<p>').attr('id','registryGrowth').addClass('city-net-lines').appendTo('#councilGrowth');if(!$('#registryActions').length)$('<div>').attr('id','registryActions').appendTo('#councilGrowth');
    $('#registryGrowth').text(!d?'北岸旧校道：'+(api.reason(s)||'职责接任与跨城补员已有实际记录，可派2名湖滨普查员继续寻访。实付 '+v.cost(api.cost)+'，480秒返回。'):!r?.node?'桥原普查尚需 '+d.remaining+'秒；居民仍在北陆失联名册。':'桥原已普查。当地校舍可生产知识，基础配药仍消耗更多劳力。先当地设站，再以地方自筹修湖滨—桥原校道，两端实付建材、各20人施工300秒。通路单程240秒。');
    v.button('registry_survey','沿旧校道普查','#registryActions',api.reason(s),()=>api.survey(State)).toggle(!d&&api.proof(s));v.button('registry_join','桥原实付设站','#registryActions',api.joinReason(s),()=>api.join(State)).toggle(!!r?.node&&!c.data(s).offices.bridge);
    if(r?.node){for(const [key,title]of Object.entries({'housing:bridge':'桥原市安居','road:academy':'湖滨—桥原校道'}))if(!$('#councilChoice_project option[value="'+key+'"]').length)$('<option>').val(key).text(title).appendTo('#councilChoice_project');$('#councilChoice_project').attr('size',6);if(!$('#councilChoice_city option[value="bridge"]').length)$('<option>').val('bridge').text('桥原市').appendTo('#councilChoice_city');$('#councilChoice_city').attr('size',4);}
  },
  city(s){const c=CivilCityCouncil,r=CivilCityRegistry.remote(s),n=r.node,o=r.origin,v=CivilCityView,a=x=>v.amount(x);$('#councilTitle').text('桥原市');
    CivilInterface.summary('#councilSummary',{title:'桥原校舍与生活',cards:[['居民',a(CivilCity.count(n))],['家庭床位',a(CivilCity.housing(s,'bridge'))],['健康',Math.floor(n.health)],['公共服务',n.stable+'秒']],brief:'战前校舍与档案保存了教学方法。每名教师用木0.1产知识0.3；公共工程按产业供料时由桥原承担知识。基础诊疗与全部供养仍由当地居民承担。',notices:v.issues(s,n),details:[['人口来源','北陆失联名册细分 '+a(o.population)+'；出生 '+a(n.born)+'，死亡 '+a(n.dead)+'，净迁居 '+a(CivilCityHomes.delta(s,'bridge'))],['实际岗位','诊疗 '+n.workers.medic+'、教学 '+n.workers.teacher+'、农业 '+n.workers.farmer+'、水务 '+n.workers.waterworker],['公共责任',c.data(s).offices.bridge?(c.activeOffice(s,'bridge')?'公用站续办正常':'设站或续办待完成'):'尚未设站']]});
    $('#councilCurrent').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+' '+a(n.stores[k])+' · 近轮 '+CivilInterface.signed(n.economy?.flow[k]||0)).join('\n'));
    $('#councilLedger p').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：原有 '+a(o.stores[k])+' + 生产 '+a(n.budget.produced[k])+' + 收货 '+a(n.budget.received[k])+' − 消耗 '+a(n.budget.consumed[k])+' − 发货 '+a(n.budget.sent[k])+' = '+a(n.stores[k])).join('\n'));return true;
  }
};
