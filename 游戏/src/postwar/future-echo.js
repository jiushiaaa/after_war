/* MPL-2.0 — Original adaptation, not a claim about any novel's canon. Information has a cost. */
var CivilFutureEcho={
 action(d,e){const f=d.future,a=e.args,at=e.at,fail=x=>{throw Error(x);};if(!f.tech.echo)fail('先完成战场回响调查方法');
  if(a.choice==='depart'){if(f.echo)fail('本地旧战场已有调查记录');if(!f.last?.powered||f.last.idle<4)fail('先留出4位实际外勤居民与电力');CivilFuture.mustPay(f,{food:96,medicine:24,electronics:12,cell:8});f.echo={at,stage:'outward',remaining:360,crew:4,choice:null,exposure:0,knowledge:0,care:0,visits:0,finishedAt:null};CivilFuture.note(f,at,'echo','四位调查员抵达旧战线外围。联接信号来自战时神经工程残留；仅传递有噪声的信息。');return '调查队带上已付旅粮与屏蔽设备出发；四人暂停原有工作。';}
  const x=f.echo;if(!x||x.stage!=='choice'||!Object.hasOwn(CivilFutureContent.echoes,a.choice))fail('先让现场调查完成，再作选择');
  const cost={seal:{tools:20,parts:8},study:{knowledge:60,medicine:24,electronics:8},exploit:{cell:20,medicine:12,electronics:12}}[a.choice];CivilFuture.mustPay(f,cost);x.choice=a.choice;x.stage='returning';x.remaining=240;x.exposure=a.choice==='exploit'?60:a.choice==='study'?15:0;CivilFuture.note(f,at,'echo',CivilFutureContent.echoes[a.choice].text);return '现场选择已记录。人员返程后仍要按暴露程度接受随访；无物资凭空出现。';
 },
 period(f,at,allocate,power){const x=f.echo;if(['outward','choice','returning'].includes(x.stage)){const crew=allocate('field',4);if(crew<4)return;if(x.stage==='choice')return;x.remaining-=60;if(x.remaining>0)return;if(x.stage==='outward'){x.stage='choice';x.remaining=0;CivilFuture.note(f,at,'echo','旧战场只留下三段互相矛盾的撤离记录。调查队请求决定：封存、有限研究，或冒险接入。');}else{x.stage=x.exposure?'followup':'complete';x.crew=0;const knowledge=x.choice==='exploit'?180:x.choice==='study'?80:0;if(knowledge){CivilFuture.make(f,{knowledge});x.knowledge=knowledge;}x.finishedAt=x.exposure?null:at;CivilFuture.note(f,at,'echo','四位调查员返程。知识只来自已完成的分析，暴露者继续接受医疗；没有新增或复制人格。');}return;}
  if(x.stage==='followup'&&allocate('recovery',4)===4&&f.assets.clinic&&f.monitor&&CivilFuture.usePower(power,4)&&CivilFuture.pay(f,{medicine:8,culture:4})){x.care++;x.visits++;x.exposure=Math.max(0,x.exposure-5);if(!x.exposure){x.stage='complete';x.finishedAt=at;CivilFuture.note(f,at,'echo','随访完成。接收者恢复日常生活，资料连同误差和代价存入公共历史。');}}
 }
};
