/* MPL-2.0 — Reuse the city switch and the existing census disclosure. */
var CivilCityRegistryView={
  growth(s){const api=CivilCityRegistry,d=api.data(s),r=api.remote(s),c=CivilCityCouncil,v=CivilCityView;if(!CivilCityContinuity.data(s))return;
    if(!$('#registryGrowth').length)$('<p>').attr('id','registryGrowth').addClass('city-net-lines').appendTo('#councilGrowth');if(!$('#registryActions').length)$('<div>').attr('id','registryActions').appendTo('#councilGrowth');
    $('#registryGrowth').text(!d?'北岸旧校道：'+(api.reason(s)||'原镇职责接班与跨城招工均已走上正轨，可由湖滨市派出2名普查员继续北上寻访。需支取 '+v.cost(api.cost)+'，耗时480秒返回。'):!r?.node?'桥原普查尚需 '+d.remaining+'秒；当地人口暂留北陆失联底账。':'桥原市已普查在册。当地保有着旧时代的校舍，擅长整理传授知识，但基础配药较费人手。请先由当地筹建公用站，再以“地方自筹”修通湖滨—桥原校道，两端各出建材、各派20人施工300秒。通车后单程耗时240秒。');
    v.button('registry_survey','沿旧校道普查','#registryActions',api.reason(s),()=>api.survey(State)).toggle(!d&&api.proof(s));v.button('registry_join','桥原实付设站','#registryActions',api.joinReason(s),()=>api.join(State)).toggle(!!r?.node&&!c.data(s).offices.bridge);
    if(r?.node){for(const [key,title]of Object.entries({'housing:bridge':'桥原市安居','road:academy':'湖滨—桥原校道'}))if(!$('#councilChoice_project option[value="'+key+'"]').length)$('<option>').val(key).text(title).appendTo('#councilChoice_project');$('#councilChoice_project').attr('size',6);if(!$('#councilChoice_city option[value="bridge"]').length)$('<option>').val('bridge').text('桥原市').appendTo('#councilChoice_city');$('#councilChoice_city').attr('size',4);}
  },
  city(s){const c=CivilCityCouncil,r=CivilCityRegistry.remote(s),n=r.node,o=r.origin,v=CivilCityView,a=x=>v.amount(x);$('#councilTitle').text('桥原市');
    CivilInterface.summary('#councilSummary',{title:'桥原校舍与生活',cards:[['居民',a(CivilCity.count(n))],['家庭床位',a(CivilCity.housing(s,'bridge'))],['健康',Math.floor(n.health)],['公共服务',n.stable+'秒']],brief:'战前留下的校舍与藏书阁保住了完整的教学规程。每名先生耗木0.1可产知识0.3；共同工程若按产业供料，将由桥原市挑起知识的担子。当地基础看诊与吃穿用度仍由本地居民自担。',notices:v.issues(s,n),details:[['人口来源','自北陆失联底账核实细分 '+a(o.population)+'；此后出生 '+a(n.born)+'，死亡 '+a(n.dead)+'，净迁居 '+a(CivilCityHomes.delta(s,'bridge'))],['实际岗位','诊疗 '+n.workers.medic+'、教学 '+n.workers.teacher+'、农业 '+n.workers.farmer+'、水务 '+n.workers.waterworker],['公共责任',c.data(s).offices.bridge?(c.activeOffice(s,'bridge')?'公用站续办正常':'设站或续办待完成'):'尚未设站']]});
    $('#councilCurrent').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+' '+a(n.stores[k])+' · 近轮 '+CivilInterface.signed(n.economy?.flow[k]||0)).join('\n'));
    $('#councilLedger p').text(CivilCityContent.resources.map(k=>(CivilText.labels[k]||k)+'：期初 '+a(o.stores[k])+' + 生产 '+a(n.budget.produced[k])+' + 收货 '+a(n.budget.received[k])+' − 消耗 '+a(n.budget.consumed[k])+' − 发货 '+a(n.budget.sent[k])+' = '+a(n.stores[k])).join('\n'));return true;
  }
};
