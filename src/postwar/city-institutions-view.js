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
    $('<p>').attr('id','cityHomeScope').text('公署仅调配农耕、狩猎、医护、学堂、回收与制器六项工位。不动用司机、守备与在途人员，且常留至少两名空闲劳力；公署不会擅自动工、立项研究、变法或外派小队。若手动调动上述工位，委托将自动暂停。').appendTo(home);
    this.select('cityHomeMode','原镇优先事项',{reserves:'供养与储备',building:'供养与建材'},home);
    $('<p>').attr('id','cityHomeStatus').appendTo(home);$('<div>').attr('id','cityHomeActions').appendTo(home);
    this.details('cityHomeReceipts','近期调度记录',home);$('<p>').attr('id','cityHomeRecord').appendTo('#cityHomeReceipts');
  },
  refresh(s,id){
    if(!CivilCityInstitutions.available(s))return;
    this.ensure();const d=CivilCityInstitutions.data(s),x=CivilCityInstitutions.local(s,id),n=CivilCity.data(s).wards[id],changed=this.selected!==id;this.selected=id;
    $('#cityInstitutionFound').toggle(!d);$('#cityInstitutionRegister').toggle(!!d&&!x);$('#citySkillDetails,#cityProductionChoices,#cityHomeDelegation').toggle(!!x);
    $('#cityInstitutionStatus').text(d?'城市公署已设立。各片区的工位、专业资格与地方公仓各自独立核算。':'万人城域可筹设城市公署，将专业带徒与例行排班交由常设机构打理。设立需支取：原镇木120、工具20、知识60；各片区各出木80、工具12、知识30。');
    if(!d){CivilCityView.button('cityFoundInstitution','筹设城市公署','#cityInstitutionFound',CivilCityInstitutions.reason(s),()=>CivilCityInstitutions.found(State));return;}
    if(!x){
      $('#cityInstitutionStatus').text('本片区尚未建立专业资格名册。登记需支取当地木80、工具12、知识30；期间既有生产与公共服务照常运转。');
      $('#cityPriorities,#cityMethods').insertBefore('#cityBudget');
      CivilCityView.button('cityRegisterInstitution','登记本片区机构','#cityInstitutionRegister',CivilCityInstitutions.registrationReason(s,id),()=>CivilCityInstitutions.register(State,this.selected));return;
    }
    $('#cityPriorities,#cityMethods').appendTo('#cityProductionChoices');
    const t=x.training,craft=CivilCityInstitutions.trained(s,id,'craft'),care=CivilCityInstitutions.trained(s,id,'care');
    $('#citySkillStatus').text('适龄劳力中：持技术资格者 '+craft+' 人，持临床资格者 '+care+' 人。本片区若走临床制药，约需 '+Math.ceil(CivilCity.count(n)*.01/.3)+' 名临床人员方能稳住供药。考取资格不会凭空添丁；到龄退休后即退出专业工位。标准件制器与冶炼工序共用技术工。');
    const reason=CivilCityInstitutions.trainingReason(s,id,$('#cityTrainingSubject').val()||'craft');
    $('#cityTrainingSubject').prop('disabled',!!t);$('#cityTrainingSubject').closest('label').toggle(!t);
    const learners=t?CivilCityInstitutions.trainingCrew(s,id).apprentice:0;
    $('#cityTrainingStatus').text(t?'正在培训'+CivilCityInstitutions.subjects[t.subject]+'：进度 '+t.rounds+' / '+t.required+' 次课；'+learners+'名适龄学员与2名教员暂离常设岗位。'+(learners<24?'因停课日久，本班学员中已有人到龄退休，需先终止本期培训再重新开班。':'口粮、儿童课堂、供水或教具短缺时，课程将自动暂停。'):'每期招24名学员、配2名教员；开班耗12工具、30知识。每10秒授课另耗2粮、0.2工具、1知识。由专业教员带班共需30次课；若专业教员均已退休，也可由学堂先生按教材开60次课的基础班。'+(reason?'当前方向：'+reason+'。':''));
    CivilCityView.button('cityTrain','开设一期培训','#cityTrainingActions',reason,()=>CivilCityInstitutions.enroll(State,this.selected,$('#cityTrainingSubject').val())).toggle(!t);
    CivilCityView.button('cityCancelTraining','停止本期培训','#cityTrainingActions',null,()=>CivilCityInstitutions.cancelTraining(State,this.selected)).toggle(!!t);
    const need=CivilCityInstitutions.schoolNeed(s,id);
    $('#citySchoolStatus').text((x.schoolEnabled?'学堂已受托自动补员。':'可委托学堂按现行工序自动开班补员。')+(CivilPacing.enabled(s)&&x.profile==='provisioning'?'“粮食与诊疗”分工下会优先带出足额的临床储备人手，期间暂维持基础配药；何时切换制药工序仍由你拍板。':'仅针对现行已启用的临床制药、标准件工位自动补员。')+'提前两年为临退工位备人；每期照章支取教具、课时耗材并抽调人手。当地公仓须至少留足6轮口粮、60工具、60知识方会开新班。'+(need?'当前'+CivilCityInstitutions.subjects[need.subject]+'需在岗 '+need.target+' 人，两年后预计留任 '+need.retained+' 人。':'现行工序暂不缺人。'));
    CivilCityView.button('cityDelegateSchool',x.schoolEnabled?'暂停学堂补员':'委托学堂补员','#citySchoolActions',null,()=>CivilCityInstitutions.delegateSchool(State,this.selected,!CivilCityInstitutions.local(State,this.selected).schoolEnabled));
    this.value('cityProfile',x.profile,changed);this.value('cityCareMethod',x.careMethod,changed);this.value('cityHomeMode',d.home.mode,false);
    $('#cityProfileStatus').text('当前：'+CivilCityInstitutions.profiles[x.profile]+'。“粮食与诊疗”会厚备存粮、停下本地制器，工具需靠外头调运；“回收与制器”则扩充工坊工位、压缩农田余量，需从外头补粮。若外运中断，可随时切回本地自给。每次调整分工耗4知识、1工具。');
    CivilCityView.button('cityApplyProfile','落实分工','#cityProfileActions',CivilCityInstitutions.settingReason(s,id,'profile',$('#cityProfile').val()),()=>{const ok=CivilCityInstitutions.set(State,this.selected,'profile',$('#cityProfile').val());if(ok)$('#cityProfile').removeAttr('data-dirty');return ok;});
    CivilCityView.button('cityApplyCare','落实配药工序','#cityCareActions',CivilCityInstitutions.settingReason(s,id,'careMethod',$('#cityCareMethod').val()),()=>{const ok=CivilCityInstitutions.set(State,this.selected,'careMethod',$('#cityCareMethod').val());if(ok)$('#cityCareMethod').removeAttr('data-dirty');return ok;}).attr('title',(CivilCityInstitutions.settingReason(s,id,'careMethod',$('#cityCareMethod').val())||'校准耗6知识、2工具')+'。基础配药每人产0.15药；临床制药每人产0.3药，另耗0.01工具、0.02知识，且须持临床资格。');
    $('#cityCareStatus').text('校准工序需耗6知识、2工具。每10秒：基础配药每人产0.15药；临床制药每人产0.3药，另耗0.01工具、0.02知识。本片区现有 '+care+' 位临床人员，稳住供药约需 '+Math.ceil(CivilCity.count(n)*.01/.3)+' 位；若人手不足，则需靠库存、外片区调药或继续开班带徒。');
    const h=d.home,continuity=CivilCityContinuity.data(s),last=(continuity?.town.records||h.records).at(-1);
    $('#cityHomeScope').text((continuity?'原镇已交由在岗办事员及接班梯队打理；库存充裕时富余劳力转入轮休，居民一日三餐照常供应。':'代管农耕、狩猎、医护、学堂、回收与制器六项工位。')+(CivilCityInstitutions.industrialHome(s)?'一并接管已委托的工业班组，视库存水位补足乌煤、矿石、铁锭与维修零件，稳住电网出力；若设为建材优先，则会拉高工业备料线。':'')+'不动用司机、守备与在途人员，且常留至少两名空闲劳力。若手动调动受托工位，委托将自动暂停；大宗营建、科技、法度与对外决断仍由你亲自拍板。');
    $('#cityHomeStatus').text((h.enabled?'正在委托':'当前手动安排')+'；每60秒支取2粮、0.2工具、0.1知识后核验排班。'+(last?.status==='shortage'?'近轮办公耗材不足，暂维持原排班，待补齐物资后恢复调度。':'')+'可随时叫停，停下后保留眼下的工位安排。');
    CivilCityView.button('cityApplyHomeMode','保存优先事项','#cityHomeActions',null,()=>{const ok=CivilCityInstitutions.homeMode(State,$('#cityHomeMode').val());$('#cityHomeMode').removeAttr('data-dirty');return ok;});
    CivilCityView.button('cityDelegate',h.enabled?'暂停原镇委托':'启用原镇委托','#cityHomeActions',null,()=>CivilCityInstitutions.delegate(State,!CivilCityInstitutions.data(State).home.enabled));
    $('#cityHomeRecord').text((continuity?.town.records||h.records).slice(-4).map(r=>Math.floor(r.at/600)+'年 '+(r.status==='unstaffed'?'办事员缺额，等待后生接班':r.status==='shortage'?'缺办公耗材，本轮未调岗':Object.entries(r.changes).map(([j,p])=>(CivilCatalog.jobs[j]||j)+' '+p[0]+'→'+p[1]).join('、')||'排班合宜，已支取例行核验耗材')).join('；')||'暂无调度记录。');
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
