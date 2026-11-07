/* MPL-2.0 — Disposable economic preview, never a save or a live-state replacement. */
var CivilForecast={
  copy(s){
    const civilization={...s.civilization};
    // Next-round governance reads the last two receipts; training needs 31.
    // Keep finance periods and transport orders: old orders can still be active.
    for(const [key,count]of [['nation',2],['diplomacy',2],['accession',2],['security',31]]){
      const data=civilization[key];
      if(data?.records.length>count)civilization[key]={...data,records:data.records.slice(-count)};
    }
    // Metro checks complete current/previous periods. Keep the last 1200 seconds
    // in full; older administration rows are unused by a next-round preview. All
    // periods/orders/receipts stay intact. Exports retain every original payment.
    if(civilization.finance)civilization.finance={...civilization.finance,periods:civilization.finance.periods.map(p=>({...p,adminPayments:p.endsAt>=s.civilization.elapsed-1200?p.adminPayments:p.adminPayments.slice(-2)}))};
    if(civilization.corridor)civilization.corridor={...civilization.corridor,maintenance:civilization.corridor.maintenance.slice(-1)};
    if(civilization.partnership) civilization.partnership={...civilization.partnership,partners:Object.fromEntries(Object.entries(civilization.partnership.partners).map(([id,p])=>[id,{...p,records:p.records.slice(-2)}]))};
    // Economic previews need current regional treasuries and the current space
    // test, not their immutable historical receipts. Only this disposable copy
    // is shortened; exports and validators always keep the complete ledgers.
    if(civilization.worldstage)civilization.worldstage={...civilization.worldstage,ledger:civilization.worldstage.ledger.slice(-2)};
    if(civilization.space)civilization.space={...civilization.space,missions:civilization.space.missions.map(m=>({...m,receipts:m.receipts.slice(-1)}))};
    return JSON.parse(JSON.stringify({...s,civilization}));
  }
};
