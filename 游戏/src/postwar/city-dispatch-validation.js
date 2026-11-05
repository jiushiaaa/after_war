/* MPL-2.0 — Asset, duty, maintenance and carriage proof for paid bulk freight. */
CivilCityDispatch.validate=function(s){
 const d=this.data(s),a=this.c(),bulk=a.data(s)?.shipments.filter(p=>p.carrier==='bulk')||[],fail=x=>{throw Error('联运货场账不符：'+x);};
 if(!d){if(bulk.length)fail('无资产货运');return;}
 const time=t=>Number.isSafeInteger(t)&&t>=0&&t<=s.civilization.elapsed,same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),rs=a.data(s)?.receipts||[];
 const byTime=a.indexRows(rs,['kind','city','at']);
 if(d.schema!==1||!time(d.at)||!this.available(s)||!Object.hasOwn(this.modes,d.mode)||!d.depots||!Object.keys(d.depots).length||!Array.isArray(d.changes))fail('登记');
 const policy=(orders,city,ref,field,initial,start)=>{let value=initial,at=start,last=0;for(const id of orders){const r=rs[id-1];if(!r||r.kind!=='dispatchPolicy'||r.city!==city||r.ref!==ref||r.field!==field||r.id<=last||!time(r.at)||r.at<at||!same(r.paid,{knowledge:4})||r.value===value||field==='mode'&&!Object.hasOwn(this.modes,r.value)||field==='enabled'&&typeof r.value!=='boolean')fail('授权回放');last=r.id;at=r.at;value=r.value;}return value;};
 if(policy(d.changes,'home','network','mode','rotation',d.at)!==d.mode)fail('网络委托');
 for(const [id,o]of Object.entries(d.depots)){
  if(!a.membersAt(s,o.at).includes(id)||!time(o.at)||o.at<d.at||!Number.isSafeInteger(o.order)||o.order<1||o.order>a.data(s).nextReceipt||!a.officeAt(s,id,o.at,o.order)||!same(o.paid,this.cost)||!Array.isArray(o.changes)||!Array.isArray(o.services)||!Number.isSafeInteger(o.worked)||o.worked<0||o.worked>this.duration||o.worked>s.civilization.elapsed-o.at||o.remaining!==this.duration-o.worked)fail('实付装配');
  const capital=rs[o.order-1];if(!capital||capital.kind!=='dispatchBuild'||capital.city!==id||capital.ref!==id||capital.at!==o.at||!same(capital.paid,this.cost))fail('资本付款凭据');
  const budget=s.civilization.cityBudget.decisions.filter(p=>p.at<=o.at&&p.cities.some(x=>x.city===id&&x.receipt<o.order)).at(-1);if(!budget||budget.mode==='manual')fail('建设预算授权');
  if(o.completedAt===null?(o.remaining<1||o.services.length||o.changes.length||o.lastPaidAt!==null||o.enabled!==true):(!time(o.completedAt)||o.completedAt-o.at<this.duration||o.remaining!==0))fail('施工状态');
  if(policy(o.changes,id,id,'enabled',true,o.completedAt??o.at)!==o.enabled)fail('现行授权');
  const expected=o.completedAt===null?0:Math.floor(s.civilization.elapsed/60)-Math.ceil(o.completedAt/60)+1;if(o.services.length!==expected)fail('维护轮次');let last=null;
  for(const [i,r]of o.services.entries()){
   if(r.at!==Math.ceil(o.completedAt/60)*60+i*60||typeof r.paid!=='boolean')fail('维护时点');const receipt=byTime('dispatchService',id,r.at);if(receipt.length!==(r.paid?1:0))fail('维护实付');if(r.paid){const enabled=o.changes.map(i=>rs[i-1]).filter(e=>e.id<receipt[0].id).at(-1)?.value??true;if(!enabled)fail('停办扣费');last=r.at;}
  }
  if(last!==o.lastPaidAt||(a.local(s,id).workers.freightbuilder||0)>this.builders||(a.local(s,id).workers.freightkeeper||0)>this.keepers)fail('维护/有限岗位');
 }
 if(rs.filter(e=>e.kind==='dispatchBuild').length!==Object.keys(d.depots).length)fail('孤立资本支出');
 if(d.at!==Math.min(...Object.values(d.depots).map(o=>o.at)))fail('首次登记');
 const changes=[...d.changes,...Object.values(d.depots).flatMap(o=>o.changes)];if(new Set(changes).size!==changes.length||rs.filter(e=>e.kind==='dispatchPolicy').length!==changes.length)fail('孤立授权');
 for(const p of bulk){const o=this.depot(s,p.source),receipt=rs.find(e=>e.kind==='cargo'&&e.ref===p.id&&e.city===p.source);if(!o||o.completedAt===null||o.completedAt>p.at||!receipt||p.path.legs.length!==1||p.version!==2)fail('货运来源');const enabled=o.changes.map(i=>rs[i-1]).filter(e=>e.id<receipt.id).at(-1)?.value??true,maintenance=rs.filter(e=>e.kind==='dispatchService'&&e.city===p.source&&e.id<receipt.id).at(-1);if(!enabled||!maintenance||p.at-maintenance.at>=120)fail('未维护发车');}
};
