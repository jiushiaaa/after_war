/* MPL-2.0 — Paid bulk carriage and a bounded network dispatch mandate.
 * The freight train is separate from the original passenger/public duty car. */
var CivilCityDispatch={
  cost:{wood:240,tools:48,knowledge:40},fee:{wood:4,tools:.8,knowledge:.2},duration:360,builders:30,keepers:6,capacity:768,
  modes:{rotation:'各地轮送',focused:'集中供料'},
  c(){return CivilCityCouncil;},data(s){return s.civilization.cityDispatch;},
  depot(s,id){return this.data(s)?.depots[this.c().logical(s,id)];},
  available(s){return !!s.civilization.cityBudget&&this.c().membersAt(s,s.civilization.elapsed).length>=3&&this.c().data(s).shipments.some(p=>p.deliveredAt!==null);},
  ready(s,id){const d=this.depot(s,id);return !!d&&d.completedAt!==null;},
  active(s,id){const d=this.depot(s,id);return this.ready(s,id)&&d.enabled&&d.lastPaidAt!==null&&s.civilization.elapsed-d.lastPaidAt<120&&this.c().activeOffice(s,id);},
  buildReason(s,id){if(!this.available(s)||!this.c().membersAt(s,s.civilization.elapsed).includes(id))return '先议定三城共同预算并实际交付公共物资';if(this.depot(s,id))return '当地货场已经登记';if(!CivilCityBudget.enabled(s,id))return '先由当地议定共同预算';if(!this.c().activeOffice(s,id))return '先续办当地公用站';return this.c().stockReason(s,id,this.cost);},
  build(s,id){if(this.buildReason(s,id))return false;const at=s.civilization.elapsed;CivilCity.pay(this.c().local(s,id),this.cost);if(!this.data(s))s.civilization.cityDispatch={schema:1,at,mode:'rotation',changes:[],depots:{}};
    const receipt=this.c().record(s,id,'dispatchBuild',id,this.cost);this.data(s).depots[id]={at,order:receipt.id,paid:{...this.cost},worked:0,remaining:this.duration,completedAt:null,enabled:true,lastPaidAt:null,changes:[],services:[]};this.c().replan(s);this.c().note(s,this.c().name(s,id)+'实付建设联运货场与载货挂车，30名当地居民装配360秒。完工后增加一组8人货运车列，直达单批至多768件；原勤务车仍办理迁居、通勤与接力。');return true;
  },
  set(s,id,field,value){const d=this.data(s),depot=this.depot(s,id);if(!d||!['mode','enabled'].includes(field)||field==='mode'&&(!Object.hasOwn(this.modes,value)||value===d.mode)||field==='enabled'&&(!this.ready(s,id)||typeof value!=='boolean'||value===depot.enabled))return false;
    const city=field==='mode'?'home':id;if(!CivilCity.pay(this.c().local(s,city),{knowledge:4}))return false;const r=this.c().record(s,city,'dispatchPolicy',field==='mode'?'network':id,{knowledge:4},{field,value});if(field==='mode'){d.mode=value;d.changes.push(r.id);}else{depot.enabled=value;depot.changes.push(r.id);}this.c().replan(s);this.c().note(s,field==='mode'?'网络货运改为'+this.modes[value]+'，只调整已批准供料的次序，不改各城份额与在途运单。':this.c().name(s,id)+(value?'恢复货场维护与新发车。':'暂停货场续办与新发车；在途按原约交付并空返，原勤务车保留。'));return true;
  },
  busy(s,id){return this.c().data(s)?.shipments.some(p=>p.carrier==='bulk'&&p.source===id&&p.legs.some(l=>l.finishedAt===null));},
  feeFor(travel){return Object.fromEntries(Object.entries(this.c().legFee(travel)).map(([k,n])=>[k,n*2]));},
  reason(s,id,travel,probe=false){if(!this.active(s,id))return '当地货场尚未完工、已停办或待维护';if(this.busy(s,id))return '货运车列尚未空返';const n=this.c().local(s,id);if(CivilCity.workforce(n)-Object.values(n.workers).reduce((a,b)=>a+b,0)<8)return '还需8名空闲成年驾驶员';return this.c().payReason(s,id,this.feeFor(travel),probe?'probe':'leg');},
  indices(s,p){const indices=p.pledges.map((_,i)=>i);if(this.data(s)?.mode!=='rotation')return indices;for(const id of this.c().ids(s)){if(!this.depot(s,id)?.enabled)continue;const positions=indices.filter(i=>p.pledges[i].from===id),last=i=>this.c().data(s).shipments.filter(x=>x.project===p.id&&x.source===id&&x.target===p.pledges[i].to).at(-1)?.at??-1,sorted=[...positions].sort((i,j)=>last(i)-last(j)||i-j);positions.forEach((i,k)=>indices[i]=sorted[k]);}return indices;},
  plan(s,id,reserved){const d=this.depot(s,id);if(!d)return;if(d.completedAt===null)reserved.freightbuilder=this.builders;else if(d.enabled&&this.c().activeOffice(s,this.c().logical(s,id)))reserved.freightkeeper=this.keepers;},
  tick(s){const d=this.data(s);if(!d)return;const at=s.civilization.elapsed,a=this.c();for(const [id,o]of Object.entries(d.depots)){const n=a.local(s,id);if(o.completedAt===null&&a.activeOffice(s,id)&&n.economy?.ate&&n.workers.freightbuilder===this.builders){o.worked++;o.remaining--;if(!o.remaining){o.completedAt=at;a.replan(s);a.note(s,a.name(s,id)+'联运货场完工；维护实付后可按网络委托发出大宗直达运单。');}}
      if(o.completedAt!==null&&at%60===0){const paid=o.enabled&&a.activeOffice(s,id)&&n.economy?.ate&&n.workers.freightkeeper===this.keepers&&a.pay(s,id,'dispatchService',id+':'+at,this.fee);o.services.push({at,paid:!!paid});if(paid)o.lastPaidAt=at;}}
  },
  receipt(s,e){const d=this.data(s);if(!d)return null;if(e.kind==='dispatchBuild'){const o=this.depot(s,e.city);return o&&o.at===e.at&&o.order===e.id&&e.ref===e.city?this.cost:null;}if(e.kind==='dispatchPolicy'){const o=this.depot(s,e.city);return (e.field==='mode'?e.city==='home'&&e.ref==='network'&&d.changes.includes(e.id):e.field==='enabled'&&e.ref===e.city&&o?.changes.includes(e.id))?{knowledge:4}:null;}const o=this.depot(s,e.city);return o&&e.ref===e.city+':'+e.at&&o.services.some(r=>r.at===e.at&&r.paid)?this.fee:null;},
  status(s,id){const d=this.depot(s,id);if(!d)return '原勤务车承运';if(d.completedAt===null)return '装配尚需'+d.remaining+'工时';if(!d.enabled)return '货场停办，在途继续结清';if(!this.active(s,id))return '货场待维护，暂不新发车';const ship=this.c().data(s).shipments.find(p=>p.carrier==='bulk'&&p.source===id&&p.legs.some(l=>l.finishedAt===null));if(ship){const l=ship.legs.at(-1);return (l.status==='outbound'?'载货，':'空返，')+l.remaining+'秒'+(l.status==='outbound'?'到站':'回场');}return '货运车列可用';}
};
