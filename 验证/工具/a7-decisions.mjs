// Shared policy for scripted UI play, not game AI. All decisions are visible button clicks.
export async function handlePolish({read,raw,log,route}){
 const e=await read('(()=>{const c=State.civilization;return {at:c.elapsed,pending:c.pending,title:Events.activeEvent()?.title,buttons:[...document.querySelectorAll("#event .button")].filter(e=>!e.classList.contains("disabled")).map(e=>e.id),agenda:c.pending==="civic_issue"?CivilCivic.pending(State)[0]:null};})()');
 if(!e.title)return false;let key;
 if(['story_stage','modern_era'].includes(e.pending))key='continue';
 else if(e.pending==='generation_head')key='keep';
 else if(e.pending==='civic_pressure')key='read';
 else if(e.pending==='civic_issue'){
  const priorities=route==='public'||route==='commons'?['care','homes','ecology','knowledge']:['producers','trade','knowledge'];
  const choices=(e.agenda?.options||[]).filter(o=>e.buttons.includes('civic_'+o.value));
  choices.sort((a,b)=>b.groups.reduce((n,k)=>n+(priorities.includes(k)?1:0),0)-a.groups.reduce((n,k)=>n+(priorities.includes(k)?1:0),0));key=choices.length?'civic_'+choices[0].value:'later';
  if(process.env.A7_NORMAL&&e.agenda?.id==='town_work')key='civic_learning';
  if(process.env.A7_NORMAL&&e.agenda?.id==='town_intake')key='civic_false';
 }
 if(!key)return false;if(!e.buttons.includes(key))throw Error('Polish decision unavailable '+JSON.stringify(e));
 let before=null,changesRule=null;
 if(e.agenda){before=await read(`(()=>{const c=State.civilization,a=CivilCivic.agenda(State).find(a=>a.id===${JSON.stringify(e.agenda.id)}),h=CivilCivic.home(State);if(a.owner==='intake')return c.urban.enabled;if(a.owner==='roster')return c.workMandate?.enabled?c.workMandate.mode:null;if(a.owner==='exchange')return c.conurbation.contract;if(a.owner==='exchangeShare')return c.conurbation.share;if(a.owner==='freight')return c.cityNetwork.priority;if(a.owner==='institution')return CivilCityInstitutions.local(State,h)?.[a.key];if(a.owner==='school')return !!CivilCityInstitutions.local(State,h)?.schoolEnabled;if(a.owner==='modern')return c.modern[a.key];if(a.owner==='budget')return CivilCityCouncil.membersAt(State,c.elapsed).map(id=>CivilCityBudget.mode(State,id));if(a.owner==='governance')return CivilCityCouncil.membersAt(State,c.elapsed).map(id=>CivilCityGovernance.office(State,id)?.mode);if(a.owner==='homes')return CivilCityHomes.estate(State,'home')?.mode;if(a.owner==='national')return c.polity.laws[a.key];if(a.owner==='body')return c.polity.future.laws[a.key];return c.polity?.earth?.unity?.mode||null;})()`);const chosen=e.agenda.options.find(o=>'civic_'+o.value===key)?.value;changesRule=Array.isArray(before)?before.some(v=>v!==chosen):before!==chosen;}
 log('deliberate_choice',{at:e.at,pending:e.pending,title:e.title,agenda:e.agenda?.id,choice:key,route,before,changesRule});
 if(!await raw('#event #'+key))throw Error('Could not reach native decision '+key);return true;
}
