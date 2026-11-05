/* MPL-2.0 — Two-sided source receipts and deterministic public/diplomatic replay. */
CivilPolity.validate=function(s){const d=this.data(s);if(d===undefined)return;const fail=why=>{throw Error('共同国约账不符：'+why);};if(d.schema!==1||s.civilization.ruleset!==2||!Array.isArray(d.records)||!d.records.length)fail('设立');let replay=null,last=0,periods=0;
 for(const [i,e]of d.records.entries()){
  if(e.id!==i+1||!Number.isSafeInteger(e.at)||e.at<last||e.at>s.civilization.elapsed||!e.sources||!e.args)fail('流水时序');last=e.at;if(i===0&&(e.action!=='start'||e.at!==d.at))fail('设立时点');
  if(typeof CivilEquipment!=='undefined'&&(CivilEquipment.enabled(s)?e.equipmentVersion!==1:e.equipmentVersion!==undefined))fail('装备版本');
  if(e.action==='start'&&s.civilization.polishVersion===1){const options=typeof CivilSetup!=='undefined'?CivilSetup.options(s):{};if(!this.same(e.worldOptions,{logistics:!!options.logistics,autonomy:!!options.autonomy}))fail('局势来源');}
  const result=this.reduce(replay,e);replay=result.d;if(!this.same(e.effects,result.effects)||e.outcome!==result.outcome)fail('实付后果回放');
  for(const id of ['north','east']){const rows=(id==='north'?s.civilization.domain:s.civilization.regional).ledger.filter(r=>r.kind==='polity'&&r.ref===e.id);if(rows.length!==1||rows[0].at!==e.at)fail('地方回执');}
  if(e.action==='period')periods++;
 }
 if(periods!==Math.floor(s.civilization.elapsed/60)-Math.floor(d.at/60))fail('遗漏公共结算');
 const actual={...d,records:[]};if(!this.same(replay,actual))fail('最终公共仓或外交状态');
 for(const local of [s.civilization.domain,s.civilization.regional])for(const r of local.ledger.filter(r=>r.kind==='polity'))if(!d.records[r.ref-1]||d.records[r.ref-1].at!==r.at)fail('孤立地方记录');
 for(const [id,n]of Object.entries(d.world.nodes)){const b=id==='north'?d.public:d.peers[id].public;for(const k of this.resources){const expected=(b.received[k]||0)+(b.produced[k]||0)-(b.consumed[k]||0)-(b.sent[k]||0)+(b.external[k]||0);if(!Number.isFinite(n.stores[k])||n.stores[k]<-1e-7||Math.abs(n.stores[k]-expected)>1e-5+Math.abs(expected)*1e-11)fail('公共物资守恒');}}
 if(d.world.foreign){const f=d.world.foreign;if(Object.values(f.actors).reduce((n,a)=>n+a.balance,0)!==0)fail('清算不守恒');}
 if(typeof CivilPolityForeign!=='undefined')CivilPolityForeign.validateCensus(s);
 if(typeof CivilFuture!=='undefined')CivilFuture.validateCensus(s);
 if(typeof CivilEarth!=='undefined')CivilEarth.validate(s);
};
