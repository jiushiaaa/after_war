/* MPL-2.0 — Civic controls live inside the existing production page, behind disclosures. */
var CivilCityInstitutionsView={
  selected:null,
  details(id,title,host){const e=$('<details>').attr('id',id).addClass('civil-details').appendTo(host);$('<summary>').text(title).appendTo(e);return e;},
  select(id,label,choices,host){
    const row=$('<label>').addClass('city-setting').appendTo(host);$('<span>').text(label).appendTo(row);
    const select=$('<select>').attr({id,'aria-label':label,size:Math.min(3,Object.keys(choices).length)}).appendTo(row);
    for(const [key,text]of Object.entries(choices))$('<option>').val(key).text(text).appendTo(select);
    select.on('change',()=>{select.attr('data-dirty','true');Civilization.refresh();});
    // ADR's document-level arrow handler returns false on keyup. Form controls own their keys.
    select.on('keydown keyup',event=>event.stopPropagation());return select;
  },
  value(id,value,changed){const e=$('#'+id);if(changed||e.attr('data-dirty')!=='true'&&document.activeElement!==e[0])e.val(value);if(changed)e.removeAttr('data-dirty');},
  ensure(){
    if($('#cityInstitution').length)return;
    const root=$('<div>').attr('id','cityInstitution').insertAfter('#cityEmployment');
    $('<p>').attr('id','cityInstitutionStatus').appendTo(root);$('<div>').attr('id','cityInstitutionFound').appendTo(root);$('<div>').attr('id','cityInstitutionRegister').appendTo(root);
    const jobs=this.details('cityJobDetails','岗位与空闲劳力',root);$('#cityEmployment').appendTo(jobs);
    const skills=this.details('citySkillDetails','专业岗位与培训',root);
    $('<p>').attr('id','citySkillStatus').appendTo(skills);
    this.select('cityTrainingSubject','培训方向',CivilCityInstitutions.subjects,skills);
    $('<p>').attr('id','cityTrainingStatus').appendTo(skills);$('<div>').attr('id','cityTrainingActions').appendTo(skills);
    $('<p>').attr('id','citySchoolStatus').appendTo(skills);$('<div>').attr('id','citySchoolActions').appendTo(skills);
    const production=this.details('cityProductionChoices','调整片区生产',root);
    $('<p>').attr('id','cityProfileStatus').appendTo(production);
    this.select('cityProfile','片区分工',CivilCityInstitutions.profiles,production);$('<div>').attr('id','cityProfileActions').appendTo(production);
    this.select('cityCareMethod','配药工序',{basic:'基础配药',clinical:'临床制药'},production);$('<div>').attr('id','cityCareActions').appendTo(production);
    $('<p>').attr('id','cityCareStatus').appendTo(production);
    // Existing priorities and tool methods remain the same controls, now grouped with their consequences.
    const home=this.details('cityHomeDelegation','原镇机构委托',root);
    $('<p>').attr('id','cityHomeScope').text('只调整农业、狩猎、医护、教师、回收和制器岗位。保留运输与其他岗位，至少留两名空闲成人；不建造、不研究、不改变法律，不派出居民。手动调岗会暂停委托。').appendTo(home);
    this.select('cityHomeMode','原镇优先事项',{reserves:'供养与储备',building:'供养与建材'},home);
    $('<p>').attr('id','cityHomeStatus').appendTo(home);$('<div>').attr('id','cityHomeActions').appendTo(home);
    this.details('cityHomeReceipts','最近的实付调度',home);$('<p>').attr('id','cityHomeRecord').appendTo('#cityHomeReceipts');
  },
  refresh(s,id){
    if(!CivilCityInstitutions.available(s))return;
    this.ensure();const d=CivilCityInstitutions.data(s),x=CivilCityInstitutions.local(s,id),n=CivilCity.data(s).wards[id],changed=this.selected!==id;this.selected=id;
    $('#cityInstitutionFound').toggle(!d);$('#cityInstitutionRegister').toggle(!!d&&!x);$('#citySkillDetails,#cityProductionChoices,#cityHomeDelegation').toggle(!!x);
    $('#cityInstitutionStatus').text(d?'城市公署已登记。岗位、资格和地方公仓分别核算。':'万人城域可以筹设城市公署，将专业培训和例行调度交给机构。登记实付：原镇木120、工具20、知识60；各片区木80、工具12、知识30。');
    if(!d){CivilCityView.button('cityFoundInstitution','筹设城市公署','#cityInstitutionFound',CivilCityInstitutions.reason(s),()=>CivilCityInstitutions.found(State));return;}
    if(!x){
      $('#cityInstitutionStatus').text('本片区尚未登记专业名册。登记实付当地木80、工具12、知识30；既有生产与公共服务继续运行。');
      $('#cityPriorities,#cityMethods').insertBefore('#cityBudget');
      CivilCityView.button('cityRegisterInstitution','登记本片区机构','#cityInstitutionRegister',CivilCityInstitutions.registrationReason(s,id),()=>CivilCityInstitutions.register(State,this.selected));return;
    }
    $('#cityPriorities,#cityMethods').appendTo('#cityProductionChoices');
    const t=x.training,craft=CivilCityInstitutions.trained(s,id,'craft'),care=CivilCityInstitutions.trained(s,id,'care');
    $('#citySkillStatus').text('劳动年龄内：技术资格 '+craft+' 人，临床资格 '+care+' 人。当地临床制药需约 '+Math.ceil(CivilCity.count(n)*.01/.3)+' 名专业人员维持供药。资格不增加人口；退休后退出专业劳力。标准件制器与冶炼共享技术人员。');
    const reason=CivilCityInstitutions.trainingReason(s,id,$('#cityTrainingSubject').val()||'craft');
    $('#cityTrainingSubject').prop('disabled',!!t);$('#cityTrainingSubject').closest('label').toggle(!t);
    const learners=t?CivilCityInstitutions.trainingCrew(s,id).apprentice:0;
    $('#cityTrainingStatus').text(t?'正在培训'+CivilCityInstitutions.subjects[t.subject]+'：'+t.rounds+' / '+t.required+' 次课程；'+learners+'名劳动年龄学员、2名教员离开常规岗位。'+(learners<24?'长期停课后本期学员已有人退休，需要停止本期并重新开班。':'口粮、儿童课堂、供水或教具不足时暂停。'):'每期24人、2名教员；开班付12工具、30知识。每10秒课程另付2粮、0.2工具、1知识。有专业教员共30次；专业人员退休后，可由学堂依据教材开60次基础课程。'+(reason?'当前：'+reason+'。':''));
    CivilCityView.button('cityTrain','开设一期培训','#cityTrainingActions',reason,()=>CivilCityInstitutions.enroll(State,this.selected,$('#cityTrainingSubject').val())).toggle(!t);
    CivilCityView.button('cityCancelTraining','停止本期培训','#cityTrainingActions',null,()=>CivilCityInstitutions.cancelTraining(State,this.selected)).toggle(!!t);
    const need=CivilCityInstitutions.schoolNeed(s,id);
    $('#citySchoolStatus').text((x.schoolEnabled?'学堂受托补员。':'可委托学堂按现行工序补员。')+(s.civilization.pacingVersion===1&&x.profile==='provisioning'?'粮食与诊疗分工会先培养足够的临床储备，期间继续基础配药；改工序仍需自己决定。':'只补现行临床制药、标准件岗位。')+'预留两年退休交接；每期仍付全部教具、课程和劳力。至少保留6轮口粮、60工具、60知识才开新班。'+(need?'当前'+CivilCityInstitutions.subjects[need.subject]+'目标 '+need.target+' 人，两年后留任 '+need.retained+' 人。':'现行工序暂不缺员。'));
    CivilCityView.button('cityDelegateSchool',x.schoolEnabled?'暂停学堂补员':'委托学堂补员','#citySchoolActions',null,()=>CivilCityInstitutions.delegateSchool(State,this.selected,!CivilCityInstitutions.local(State,this.selected).schoolEnabled));
    this.value('cityProfile',x.profile,changed);this.value('cityCareMethod',x.careMethod,changed);this.value('cityHomeMode',d.home.mode,false);
    $('#cityProfileStatus').text('当前：'+CivilCityInstitutions.profiles[x.profile]+'。粮食与诊疗增加粮食储备、停止本地制器，需外运工具；回收与制器增加工坊岗位、减少农业余量，需补粮。调运断开时可恢复本地自给。分工调整付4知识、1工具。');
    CivilCityView.button('cityApplyProfile','落实分工','#cityProfileActions',CivilCityInstitutions.settingReason(s,id,'profile',$('#cityProfile').val()),()=>{const ok=CivilCityInstitutions.set(State,this.selected,'profile',$('#cityProfile').val());if(ok)$('#cityProfile').removeAttr('data-dirty');return ok;});
    CivilCityView.button('cityApplyCare','落实配药工序','#cityCareActions',CivilCityInstitutions.settingReason(s,id,'careMethod',$('#cityCareMethod').val()),()=>{const ok=CivilCityInstitutions.set(State,this.selected,'careMethod',$('#cityCareMethod').val());if(ok)$('#cityCareMethod').removeAttr('data-dirty');return ok;}).attr('title',(CivilCityInstitutions.settingReason(s,id,'careMethod',$('#cityCareMethod').val())||'校准付6知识、2工具')+'。基础每人产药0.15；临床每人产药0.3，另耗0.01工具、0.02知识，需要临床资格。');
    $('#cityCareStatus').text('工序校准付6知识、2工具。每10秒：基础每人产药0.15；临床每人产药0.3，另耗0.01工具、0.02知识。现有 '+care+' 位临床人员，维持本片区约需 '+Math.ceil(CivilCity.count(n)*.01/.3)+' 位；不足时须依靠储备、实际调药或继续培训。');
    const h=d.home,continuity=CivilCityContinuity.data(s),last=(continuity?.town.records||h.records).at(-1);
    if(continuity)$('#cityHomeScope').text('原镇由真实办事员及接班课程托管；基础储备足够时轮休，居民照常供养。手动调岗会暂停托管，恢复原有应急生产。详细接任与课程见城际协作中的职责与岗位接续。');
    $('#cityHomeStatus').text((h.enabled?'正在委托':'当前手动安排')+'；每60秒实付2粮、0.2工具、0.1知识后检查岗位。'+(last?.status==='shortage'?'最近办公物资不足，保留原安排，补齐后恢复。':'')+'可随时暂停，停止后保留当前岗位。');
    CivilCityView.button('cityApplyHomeMode','保存优先事项','#cityHomeActions',null,()=>{const ok=CivilCityInstitutions.homeMode(State,$('#cityHomeMode').val());$('#cityHomeMode').removeAttr('data-dirty');return ok;});
    CivilCityView.button('cityDelegate',h.enabled?'暂停原镇委托':'启用原镇委托','#cityHomeActions',null,()=>CivilCityInstitutions.delegate(State,!CivilCityInstitutions.data(State).home.enabled));
    $('#cityHomeRecord').text((continuity?.town.records||h.records).slice(-4).map(r=>Math.floor(r.at/600)+'年 '+(r.status==='unstaffed'?'办事员缺员，等待接班':r.status==='shortage'?'缺办公物资，未调岗':Object.entries(r.changes).map(([j,p])=>(CivilCatalog.jobs[j]||j)+' '+p[0]+'→'+p[1]).join('、')||'岗位适用，已付例行检查开支')).join('；')||'尚无实付调度。');
    this.home(s);
  },
  home(s){
    const h=CivilCityInstitutions.data(s)?.home;if(!h||!$('#workers').length)return;
    $('#outsidePanel').addClass('civil-delegated');
    let box=$('#civilDelegatedJobs');
    if(!box.length){box=$('<details>').attr('id','civilDelegatedJobs').addClass('civil-details').insertBefore('#workers');$('<summary>').appendTo(box);$('#workers').appendTo(box);if(!h.enabled)box.prop('open',true);box.on('toggle',()=>Civilization.refresh());}
    box.children('summary').text(h.enabled?'原镇岗位由机构调度 · 展开应急调整':'原镇手动岗位 · 展开调整');
    if(box.attr('data-enabled')!==String(h.enabled)){box.attr('data-enabled',String(h.enabled));if(h.enabled)box.prop('open',false);}
  }
};
