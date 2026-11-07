/* MPL-2.0 — Policy changes are paid, ordered and reversible. Historic spending
 * remains in the original municipal ledger; forecasts are never saved assets. */
CivilCityBudget.validate=function(s){
  const d=this.data(s);if(!d)return;const a=this.c(),fail=x=>{throw Error('共同预算约定不符：'+x);},time=t=>Number.isSafeInteger(t)&&t>=0&&t<=s.civilization.elapsed;
  if(d.schema!==1||!time(d.at)||!this.available(s)||!Array.isArray(d.decisions)||!d.decisions.length||d.decisions[0].at!==d.at)fail('设立');
  let at=d.at,lastReceipt=0;const modes={},seen=new Set();
  for(const [i,p]of d.decisions.entries()){
    const members=a.membersAt(s,p.at);if(p.id!==i+1||!time(p.at)||p.at<at||!Object.hasOwn(this.modes,p.mode)||p.scope!=='all'&&!members.includes(p.scope)||!Array.isArray(p.cities)||!p.cities.length)fail('议定顺序');at=p.at;const cities=new Set();
    for(const row of p.cities){const e=a.data(s).receipts[row.receipt-1];if(!members.includes(row.city)||p.scope!=='all'&&p.scope!==row.city||cities.has(row.city)||!e||e.at!==p.at||e.city!==row.city||e.kind!=='budgetPolicy'||e.ref!==p.id||e.id<=lastReceipt||seen.has(e.id))fail('地方实付');cities.add(row.city);seen.add(e.id);lastReceipt=e.id;
      if(row.quotaReceipt!==null){const q=a.data(s).receipts[row.quotaReceipt-1];if(!q||q.id!==e.id-1||q.city!==row.city||q.at!==e.at||q.kind!=='policy'||q.field!=='quota'||p.mode==='manual')fail('额度议定');}
      else if((modes[row.city]||'manual')===p.mode)fail('重复约定');modes[row.city]=p.mode;
    }
  }
  if(a.data(s).receipts.filter(e=>e.kind==='budgetPolicy').length!==seen.size)fail('孤立收据');
};
