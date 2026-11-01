/* MPL-2.0 — LumiMaker asynchronous single-slot persistence. No browser-storage fallback. */
(function(root) {
  const id = 'postwar-civilization';
  function validate(state) {
    if(!state || typeof state !== 'object' || Array.isArray(state) || !state.civilization || !state.game || !state.stores) throw Error('这不是战后文明存档');
    const walk = (v,depth=0) => {
      if(depth > 30) throw Error('存档层级过深');
      if(typeof v === 'number' && !Number.isFinite(v)) throw Error('存档含无效数值');
      if(v && typeof v === 'object') for(const k of Object.keys(v)) {
        if(!/^[\p{L}\p{N}_ -]+$/u.test(k) || ['__proto__','constructor','prototype'].includes(k)) throw Error('存档字段无效');
        walk(v[k],depth+1);
      }
    }; walk(state);
    for(const [key,value] of Object.entries(state.stores)) if(!CivilCatalog.resources.includes(key) || typeof value !== 'number' || value < 0 || value > 1e12) throw Error('库存无效');
    for(const key of ['fire','temperature']) if(!Number.isInteger(state.game[key]?.value) || state.game[key].value < 0 || state.game[key].value > 4) throw Error('火或温度无效');
    if(!Number.isInteger(state.game.builder?.level) || state.game.builder.level < -1 || state.game.builder.level > 4) throw Error('工匠进度无效');
    const c = state.civilization;
    if(![1,2,4,8,16].includes(c.speed) || ![1,2,4,8,16].includes(c.maxSpeed) || c.speed > c.maxSpeed) throw Error('倍率无效');
    if(c.maxSpeed>=8&&!(c.urban?.city===true&&c.tech?.passenger_transport===true))throw Error('高级倍率缺少城市与运输进度');
    if(c.maxSpeed===16&&!Object.entries(c.municipal?.nodes||{}).some(([key,n])=>n?.city===true&&Object.hasOwn(c.regions?.nodes||{},key)))throw Error('16倍速需要第二座已登记城市');
    if(!c.tech || !c.events || !c.policySeen || !state.game.buildings || !state.game.workers) throw Error('存档缺少进度字段');
    const limits=CivilCatalog.limits;
    for(const [key,n] of Object.entries(state.game.buildings)) if(!(key in limits) || !Number.isInteger(n) || n<0 || n>(CivilCatalog.buildingLimit?CivilCatalog.buildingLimit(state,key):limits[key])) throw Error('建筑无效');
    for(const [key,value] of Object.entries(c.tech)) if(!Object.hasOwn(CivilText.research,key) || typeof value!=='boolean') throw Error('技术进度无效');
    const regionPending=typeof CivilRegions!=='undefined'?(CivilRegions.pendingIds||[]):[],urbanPending=typeof CivilUrban!=='undefined'?(CivilUrban.pendingIds||[]):[],originPending=typeof CivilOrigins!=='undefined'?(CivilOrigins.pendingIds||[]):[],municipalPending=typeof CivilMunicipal!=='undefined'?(CivilMunicipal.pendingIds||[]):[];
    const financePending=typeof CivilFinance!=='undefined'?(CivilFinance.pendingIds||[]):[],metroPending=typeof CivilMetro!=='undefined'?(CivilMetro.pendingIds||[]):[],incidentPending=typeof CivilIncidents!=='undefined'?(CivilIncidents.pendingIds||[]):[],culturePending=typeof CivilCulture!=='undefined'?CivilCulture.pendingIds:[],cooperativePending=typeof CivilCooperative!=='undefined'?CivilCooperative.pendingIds:[];
    if(![null,'policy','station','pump','salvage','merchant','cold','river','riverAid','geology','constitution_structure','constitution_selection','constitution_charter','constitution_devolution','succession',...regionPending,...urbanPending,...originPending,...municipalPending,...financePending,...metroPending,...incidentPending,...culturePending,...cooperativePending,...(typeof CivilNation!=='undefined'?CivilNation.pendingIds:[]),...(typeof CivilRuins!=='undefined'?CivilRuins.pendingIds:[])].includes(c.pending)) throw Error('事件进度无效');
    const pop = state.game.population || 0;
    if(!Number.isInteger(pop) || pop < 0 || pop > CivilCatalog.capacity(state)) throw Error('人口无效');
    if(c.society!==undefined)CivilSociety.validate(state);
    if(typeof CivilDecisions!=='undefined')CivilDecisions.validate(state);
    if(c.industry!==undefined)CivilIndustry.validate(state);
    if(c.regions!==undefined)CivilRegions.validate(state);
    if(c.urban!==undefined)CivilUrban.validate(state);
    if(c.origins!==undefined)CivilOrigins.validate(state);
    if(c.municipal!==undefined)CivilMunicipal.validate(state);
    if(c.advanced!==undefined)CivilAdvanced.validate(state);
    if(c.services!==undefined)CivilServices.validate(state);
    if(typeof CivilWind!=='undefined')CivilWind.validate(state);
    if(typeof CivilPassenger!=='undefined')CivilPassenger.validate(state);
    if(typeof CivilFinance!=='undefined')CivilFinance.validate(state);
    if(typeof CivilRelief!=='undefined')CivilRelief.validate(state);
    if(typeof CivilCulture!=='undefined')CivilCulture.validate(state);
    if(typeof CivilCooperative!=='undefined')CivilCooperative.validate(state);
    if(typeof CivilRuins!=='undefined')CivilRuins.validate(state);
    if(typeof CivilPlanning!=='undefined')CivilPlanning.validate(state);
    if(typeof CivilMetro!=='undefined')CivilMetro.validate(state);
    if(typeof CivilNation!=='undefined')CivilNation.validate(state);
    if(typeof CivilIncidents!=='undefined')CivilIncidents.validate(state);
    if(typeof CivilHeating!=='undefined')CivilHeating.validate(state);
    const labor=c.society?CivilSociety.workforce(state):pop;
    const workers = Object.entries(state.game.workers);
    if(workers.some(([key,n]) => (!Object.hasOwn(CivilCatalog.jobs,key) || key==='gatherer') || !Number.isInteger(n) || n < 0) || workers.reduce((n,[,v])=>n+v,0)>labor) throw Error('岗位无效');
    for(const [job,n]of workers)if(n>CivilCatalog.jobCapacity(state,job))throw Error('超过岗位容量');
    if(c.policy && !['equal','ration','generous'].includes(c.policy)) throw Error('配给规则无效');
    for(const key of ['elapsed','hunger','trust','stableFor','populationClock','productionClock','randomClock','policyCooldown','residentTime']) if(!Number.isFinite(c[key]) || c[key] < 0) throw Error('存档计时无效');
    if(c.research && (!Object.hasOwn(CivilText.research,c.research.id) || !Number.isFinite(c.research.remaining) || c.research.remaining < 0)) throw Error('研究无效');
    const regionJourneys=typeof CivilRegions!=='undefined'?Object.keys(CivilRegions.journeys):[];
    if(c.journey && (!['station','pump','salvage','river','riverAid','geology',...regionJourneys].includes(c.journey.id) || !Number.isFinite(c.journey.remaining) || c.journey.remaining < 0)) throw Error('旅途无效');
    if(c.village) {
      const v=c.village;
      for(const k of ['health','convoyClock','convoys','riverFood','riverTools','riverMedicine','townStable'])if(!Number.isFinite(v[k]) || v[k]<0)throw Error('村镇数据无效');
      if(v.health>100 || v.riverFood>240 || !Number.isInteger(v.convoys))throw Error('村镇数值越界');
      for(const k of ['riverKnown','riverAllied','town'])if(typeof v[k]!=='boolean')throw Error('村镇状态无效');
    }
    if(!state.cooldown || typeof state.cooldown !== 'object' || !state.timers || typeof state.timers !== 'object') throw Error('计时数据缺失');
    for(const n of Object.values(state.cooldown)) if(!Number.isFinite(n) || n<0 || n>3600) throw Error('冷却无效');
    for(const n of Object.values(state.timers.civilClock || {})) if(!Number.isFinite(n) || n<0 || n>3600000) throw Error('计时无效');
    return state;
  }
  function decode(text) {
    if(text.length > 9e6) throw Error('存档太大');
    const save = JSON.parse(text);
    if(save.format !== id || save.version !== 1) throw Error('存档版本不兼容');
    // v1 previews allowed the random-event wait to pass below zero before population existed.
    if(Number.isFinite(save.state?.civilization?.randomClock)) save.state.civilization.randomClock=Math.max(0,save.state.civilization.randomClock);
    return validate(save.state);
  }
  const Platform = root.CivilPlatform = {
    sdk:null, loaded:false, busy:false, dirty:false, timer:null, error:null,
    validate, decode,
    async load() {
      const sdk = root.LumiMakerSdk;
      if(!sdk) { this.loaded=true; return {}; }
      this.sdk = sdk;
      const ready = await sdk.ready();
      if(!ready.ready) throw Error(ready.error || '尚未连接存档服务');
      const bytes = await sdk.readSave(); // Only null means no save. A rejection must block startup.
      const state = bytes === null ? {} : decode(new TextDecoder().decode(bytes));
      this.loaded = true; this.error=null; return state;
    },
    serialize() {
      if(root.CivilClock) State.timers.civilClock = CivilClock.snapshot();
      // JSON deliberately omits optional undefined values from ADR income records.
      return JSON.stringify({format:id,version:1,savedAt:new Date().toISOString(),state:State});
    },
    changed() {
      if(!this.loaded || !root.State?.civilization) return;
      this.dirty=true;
      if(this.sdk && !this.timer && !this.busy) this.timer=setTimeout(()=>{this.timer=null;this.flush();},2500);
    },
    async flush() {
      if(!this.sdk || !this.loaded || this.busy || !this.dirty) return;
      this.busy=true; this.dirty=false;
      try { await this.sdk.writeSave(this.serialize()); this.error=null; this.status('云端已保存'); }
      catch(error) { this.dirty=true; this.error=error; this.status('云端未保存，打开存档重试'); }
      finally { this.busy=false; if(this.dirty && !this.error) this.changed(); }
    },
    status(message) { $('#saveNotify').text(message).stop(true).css('opacity',1).delay(2200).animate({opacity:0},700); },
    download() {
      const blob = new Blob([this.serialize()],{type:'application/json'}), url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='战后文明-存档.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      this.status('存档已导出');
    },
    menu() {
      if(Events.activeEvent()) return;
      const cloud = this.sdk ? (this.error?'云端保存失败。当前进度仍在，请导出备份或重试。':'已连接云存档。进度自动保存。') : '本地预览没有云存档。刷新或关闭前，请导出进度；下次可导入继续。';
      Events.startEvent({title:'存档', scenes:{start:{text:[cloud],buttons:{
        download:{text:'导出进度',onChoose:()=>this.download()},
        import:{text:'导入进度',nextScene:{1:'import'}},
        ...(this.sdk ? {save:{text:'保存到云端',onChoose:()=>{this.dirty=true;this.flush();}}}:{}),
        close:{text:'关闭',nextScene:'end'}
      }},import:{text:['粘贴存档文件中的完整内容。检查通过后，会再次确认是否替换当前进度。'],textarea:'',buttons:{
        inspect:{text:'检查存档',onChoose:text=>{
          try { this.pending=decode(text); setTimeout(()=>{
            Events.loadScene('confirm');
          },0); } catch(error) { Notifications.notify(null,'导入未执行：'+error.message); }
        }},cancel:{text:'取消',nextScene:'end'}
      }},confirm:{text:['用这份存档替换当前进度？替换前可以先导出当前进度。'],buttons:{
        backup:{text:'导出当前进度',onChoose:()=>this.download()},
        replace:{text:'替换当前进度',onChoose:()=>{const next=this.pending;this.pending=null;setTimeout(()=>Civilization.restart(next),0);}},
        cancel:{text:'取消',nextScene:'end'}
      }}}});
    }
  };
})(globalThis);
