/* MPL-2.0 — Disposable economic preview, never a save or a live-state replacement. */
var CivilForecast={
  copy(s){
    const civilization={...s.civilization};
    // Next-round governance reads the last two receipts; training needs 31.
    // Keep full finance/transport histories, whose old orders can still be active.
    for(const [key,count]of [['nation',2],['diplomacy',2],['accession',2],['security',31]]){
      const data=civilization[key];
      if(data?.records.length>count)civilization[key]={...data,records:data.records.slice(-count)};
    }
    return JSON.parse(JSON.stringify({...s,civilization}));
  }
};
