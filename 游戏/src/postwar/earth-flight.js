/* MPL-2.0 — Finite Earth/orbit missions. People, cargo and identity travel together. */
var CivilEarthFlight={
 active(g){return g.flights.find(x=>x.returnedAt===null);},
 done(g,kind){return g.flights.some(x=>x.kind===kind&&x.success&&x.returnedAt!==null);},
 crew(f,mode){if(!Object.hasOwn(CivilEarthContent.crews,mode))throw Error('未知乘员组成');if(mode==='uncrewed')return [];const eligible=f.cohorts.filter(c=>(!CivilFuturePeople.isBio(c)||c.age>=18&&c.age<=60)&&c.count>0),plan=[];let left=12;
  const take=(body,max)=>{for(const c of eligible.filter(c=>c.body===body)){const used=plan.filter(x=>x.first>=c.first&&x.first<c.first+c.count).reduce((n,x)=>n+x.count,0),n=Math.min(c.count-used,max,left);if(n>0){plan.push({...c,first:c.first+used,count:n});max-=n;left-=n;}if(!max||!left)break;}};
  if(mode==='mixed'){for(const body of ['organic','gene','mechanical','synthetic'])take(body,3);for(const body of ['organic','gene','mechanical','synthetic','prosthetic'])take(body,left);}else take(mode,12);
  if(left)throw Error('须有12位符合年龄与身体条件的自愿乘员');if(mode==='mixed'&&new Set(plan.map(x=>x.body)).size<2)throw Error('混合乘员至少来自两种身体群体');return plan;
 },
 detach(f,plan){for(const x of plan){const row=f.cohorts.find(c=>c.first<=x.first&&c.first+c.count>=x.first+x.count&&c.body===x.body);if(!row)throw Error('乘员持续身份不可用');const before=x.first-row.first,after=row.first+row.count-x.first-x.count;f.cohorts=f.cohorts.filter(c=>c!==row);if(before)f.cohorts.push({...row,count:before});if(after)f.cohorts.push({...row,first:x.first+x.count,count:after});}f.cohorts.sort((a,b)=>a.first-b.first);f.aboard=this.copy(plan);},copy:x=>JSON.parse(JSON.stringify(x)),
 counts(rows){const n={total:0,bio:0,mechanical:0,synthetic:0,gene:0,organic:0};for(const c of rows){n.total+=c.count;if(CivilFuturePeople.isBio(c))n.bio+=c.count;n[c.body]=(n[c.body]||0)+c.count;}return n;},
 pack(rows){const n=this.counts(rows);return {food:n.bio*12,medicine:n.bio*1.2,culture:n.gene*.4,parts:24+(n.total-n.bio)*2,electronics:12,propellant:36,shielding:8};},
 missing(stock,cost){return CivilFuture.costText(Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,Math.max(0,v-(stock[k]||0))])));},
 capital(kind){return kind==='probe'?{spaceparts:16,lifesupport:4,shielding:8,propellant:24}:{spaceparts:24,lifesupport:16,shielding:12,propellant:32};},
 action(d,e,effects){const g=d.earth,f=d.future,a=e.args,at=e.at,fail=x=>{throw Error(x);};
  if(a.op==='ground'){
   if(!g.assets.control||!g.assets.works||!g.tech.closed)fail('先建成装配场与闭环测控场');if(g.ground)fail('闭环试验已有记录；可恢复供电继续');const kit={culture:10,medicine:10,parts:5,knowledge:10},capital={lifesupport:12,food:96,medicine:24};if(!CivilRegions.canPay(f.stock,CivilConurbation.plus(capital,kit)))fail('闭环试验仍缺：'+this.missing(f.stock,CivilConurbation.plus(capital,kit)));CivilFuture.mustPay(f,capital);CivilServices.pay(f.stock,kit);CivilCity.sum(f.book.sent,kit);g.ground={at,progress:0,completedAt:null,paid:0,missed:0,stock:{...kit},book:{received:{...kit},consumed:{},sent:{}}};return '闭环负载试验已实付；四位测控人员、实际电力与培养耗材连续运行300秒。';
  }
  if(a.op==='launch'){
   if(!['probe','departure'].includes(a.kind))fail('未知航天任务');if(this.active(g))fail('先让现有航天器与乘员返航');if(this.done(g,a.kind))fail('此任务已有完整记录');if(!g.ground?.completedAt||!g.assets.control||!g.tech.guidance)fail('先完成地面闭环试验与轨道测控');if(!g.power||!g.work?.controlPower||g.work.control!==4||!f.last?.powered)fail('先恢复四位测控人员与航天地面电力');
   if(a.kind==='departure'){if(!this.done(g,'probe'))fail('先完成无常驻乘员轨道验证');if(!g.unity)fail('先确认八区地球共同法');const why=CivilEarth.unityReason(d,at);if(why)fail(why);}
   const mode=a.kind==='probe'?'uncrewed':a.crew,crew=this.crew(f,mode),n=this.counts(crew);if(f.adoption)fail('先完成当前临床采纳，避免重复占用本人');if(n.synthetic&&f.quarantined||n.mechanical&&f.machineWear>=30||n.gene&&f.geneSafety<90)fail('先恢复乘员身体与人格安全');
   const pack=this.pack(crew),capital=this.capital(a.kind);if(!CivilRegions.canPay(f.stock,CivilConurbation.plus(capital,pack)))fail('首航备料仍缺：'+this.missing(f.stock,CivilConurbation.plus(capital,pack)));
   CivilFuture.mustPay(f,capital);CivilServices.pay(f.stock,pack);CivilCity.sum(f.book.sent,pack);
   const flight={id:g.flights.length+1,kind:a.kind,mode,at,crew:this.copy(crew),counts:n,stock:{...pack},book:{received:{...pack},consumed:{},sent:{}},capital:this.copy(capital),phase:'outbound',remaining:120,elapsed:0,success:false,aborted:false,returnedAt:null,charge:0,energy:{generated:0,used:0,spill:0},last:null};g.flights.push(flight);
   if(crew.length){this.detach(f,crew);effects.futureTravel={out:this.copy(crew),back:[]};g.voyageOpenedAt??=at;}
   CivilEarth.note(g,at,'launch',(n.total?n.total+'位实际乘员':'无常驻乘员先遣器')+'离地，航天物资已出仓；'+(n.total?'原工位与家庭供养相应退出，在途保留同一持续身份。':'自主控制设备不登记为人格。'));
   return '任务已发射，有限船载物资持续消耗；完成轨道工作后返回，不进入星际可玩区域。';
  }
  if(a.op==='abort'){
   const x=this.active(g);if(!x||x.phase==='returning')fail('当前没有可中止的在轨任务');if(!g.power||g.work?.control!==4)fail('先恢复地面通信再发返航指令');CivilFuture.mustPay(f,{knowledge:12,electronics:4});x.aborted=true;x.success=false;x.phase='returning';x.remaining=180;CivilEarth.note(g,at,'abort','地面实付发出返航指令。任务成果不登记，原乘员和剩余物资按原船返回。');return '任务中止，已经消耗的材料不退；乘员仍在途中，不能提前回到工位。';
  }
  fail('未知全球或航天行动');
 },
 spend(x,cost){if(!CivilRegions.canPay(x.stock,cost))return false;CivilServices.pay(x.stock,cost);CivilCity.sum(x.book.consumed,cost);return true;},
 period(d,e,effects){const g=d.earth,f=d.future,at=e.at,w=g.work||{},ready=g.power&&w.control===4&&w.controlPower;
  if(g.ground&&g.ground.completedAt===null){const cost={culture:2,medicine:2,parts:1,knowledge:2},q=g.ground;if(ready&&!CivilRegions.canPay(q.stock,cost)&&CivilRegions.canPay(f.stock,cost)){CivilServices.pay(f.stock,cost);CivilCity.sum(f.book.sent,cost);CivilCity.sum(q.stock,cost);CivilCity.sum(q.book.received,cost);}const paid=ready&&this.spend(q,cost);q.last={at,paid:!!paid,reason:!ready?'测控人手或地面电力中断':paid?null:'试验耗材待补给'};if(paid){g.ground.progress+=60;g.ground.paid++;}else{g.ground.progress=0;g.ground.missed++;}if(g.ground.progress>=300){g.ground.completedAt=at;CivilEarth.note(g,at,'ground','闭环负载连续五期合格；此前消耗与中断记录保留。');}}
  const x=this.active(g);if(!x)return;x.elapsed+=60;const rows=x.counts.total?(f.aboard||[]):[],n=this.counts(rows);let generated=0;
  const demand=12+n.bio*.4+(n.total-n.bio)*.8;if(x.charge<demand&&this.spend(x,{propellant:1})){generated=60;x.energy.generated+=60;}const available=x.charge+generated,powered=available>=demand;
  const supplies={food:n.bio*.72,medicine:n.bio*.06,culture:n.gene*.02,parts:.5+(n.total-n.bio)*.04,electronics:.1};const supplied=this.spend(x,supplies),used=powered?demand:0;x.energy.used+=used;x.charge=Math.min(120,available-used);x.energy.spill+=Math.max(0,available-used-120);
  x.last={at,powered,supplied,crew:n,generated,used,charge:x.charge};
  if((!powered||!supplied||!ready)&&x.phase!=='returning'){x.aborted=true;x.success=false;x.phase='returning';x.remaining=180;CivilEarth.note(g,at,'abort','航天保护因'+(!ready?'地面测控中断':'船载服务不足')+'启动返航；既有乘员身份保留，成果不登记。');}
  x.remaining-=60;if(x.remaining>0)return;
  if(x.phase==='outbound'){x.phase='orbit';x.remaining=x.kind==='probe'?180:300;return;}
  if(x.phase==='orbit'){
   x.success=true;x.phase='returning';x.remaining=180;
   if(x.kind==='departure'){g.ending={at,flight:x.id,mode:g.unity.mode,crew:this.copy(x.counts),missionMode:x.mode,publicLaws:this.copy(d.laws),bodyLaws:this.copy(f.laws),echo:f.echo?.choice||null};CivilEarth.note(g,at,'ending','地球篇首航达成：'+(x.counts.total?x.counts.total+'位实际乘员，其中机械'+x.counts.mechanical+'、合成人'+x.counts.synthetic:'无常驻乘员的先遣器')+'完成轨道任务，正沿已验证航道返航。');}else CivilEarth.note(g,at,'orbit','无常驻乘员轨道验证完成，实际设备与数据返回；没有新增居民。');return;
  }
  if(x.phase==='returning'){
   if(rows.length){effects.futureTravel={out:[],back:this.copy(rows)};f.cohorts.push(...rows);f.cohorts.sort((a,b)=>a.first-b.first);f.aboard=[];}
   for(const [key,value]of Object.entries(x.stock)){if(!value)continue;CivilCity.sum(f.stock,{[key]:value});CivilCity.sum(f.book.received,{[key]:value});CivilCity.sum(x.book.sent,{[key]:value});x.stock[key]=0;}
   x.phase='returned';x.returnedAt=at;CivilEarth.note(g,at,'return',(x.aborted?'中止任务':'完成任务')+'的'+n.total+'位原乘员与未用物资实际返回；只返还一次，不重建人格或退回已消耗组件。');
  }
 },
 validate(s){const d=s.civilization.polity,g=d.earth,f=d.future,c=s.civilization.census,fail=x=>{throw Error('航天在途账不符：'+x);},active=this.active(g),aboard=(f.aboard||[]).reduce((n,x)=>n+x.count,0);
  if((c.accounts.future_voyage||0)!==aboard||aboard&&(active?.counts.total||0)<aboard)fail('在途人口');
  const expected=[];for(const e of d.records){if(e.effects.futureDelta?.awayDead)expected.push({at:e.at,kind:'death',from:'future_voyage',to:null,count:e.effects.futureDelta.awayDead,reason:'航天乘员生物寿终'});if(e.effects.futureTravel){if(!expected.length)expected.push({at:e.at,kind:'account',from:null,to:'future_voyage',count:0,reason:'航天乘员在途名册'});for(const [key,from,to,reason]of [['out','future_common','future_voyage','航天乘员离地'],['back','future_voyage','future_common','航天同一乘员返航']]){const count=(e.effects.futureTravel[key]||[]).reduce((n,x)=>n+x.count,0);if(count)expected.push({at:e.at,kind:'move',from,to,count,reason});}}}
  if(!CivilPolity.same(c.entries.filter(e=>e.to==='future_voyage'||e.from==='future_voyage'),expected))fail('在途身份流水');
  for(const x of [...g.flights,...(g.ground?[g.ground]:[])]){for(const key of Object.keys(x.stock)){const want=(x.book.received[key]||0)-(x.book.consumed[key]||0)-(x.book.sent[key]||0);if(!Number.isFinite(x.stock[key])||x.stock[key]<0||Math.abs(x.stock[key]-want)>1e-7)fail('船载物资');}if(x.energy&&Math.abs(x.energy.generated-x.energy.used-x.energy.spill-x.charge)>1e-6)fail('船载能量');}
 }
};
