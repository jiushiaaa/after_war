/* MPL-2.0 — Device preferences and a backed-up, explicit new-world transition. */
var CivilPreferences = {
  key:'preferences:postwar.interface.v1', prefs:{dark:false}, revision:0,
  normalize(value){return {dark:value?.dark===true};},
  async load(){
    const revision=this.revision;
    try{const value=await CivilLocalSaves.readRaw(this.key);if(revision===this.revision)this.prefs=this.normalize(value);}
    catch{this.storageError=true;}
    this.apply();
  },
  save(){
    const prefs=this.normalize(this.prefs);this.revision++;
    this.writes=(this.writes||Promise.resolve()).then(()=>CivilLocalSaves.writeRaw(this.key,prefs)).catch(()=>{
      this.storageError=true;CivilPlatform.status('设置暂未保存在本机');
    });
    return this.writes;
  },
  apply(){
    if(typeof document==='undefined')return;
    document.documentElement.classList.toggle('dark',this.prefs.dark);
    document.body.classList.toggle('dark',this.prefs.dark);
    const sheet=document.getElementById('civilDarkTheme');if(sheet)sheet.media=this.prefs.dark?'all':'not all';
    const button=document.getElementById('themeMenu');
    if(button){button.textContent=this.prefs.dark?'日间模式':'夜间模式';button.setAttribute('aria-pressed',String(this.prefs.dark));}
  },
  toggleTheme(){this.prefs.dark=!this.prefs.dark;this.apply();return this.save();},
  menu(){
    const menu=$('.menu').first();
    $('<button>').attr({id:'restartMenu',type:'button'}).addClass('menuBtn').text('重开').on('click',()=>this.restartMenu()).appendTo(menu);
    $('<button>').attr({id:'themeMenu',type:'button'}).addClass('menuBtn').on('click',()=>this.toggleTheme()).appendTo(menu);
    this.apply();
  },
  restartMenu(){
    if(Events.activeEvent()||this.restarting)return;
    Events.startEvent({title:'重开？',scenes:{start:{text:['重开游戏？'],buttons:{
      begin:{text:'是',onChoose:()=>this.restartWorld()},cancel:{text:'否',nextScene:'end'}
    }}}});
  },
  async restartWorld(next={},readOnly=false){
    if(this.restarting)return false;
    this.restarting=true;const clock=CivilClock,wasPaused=clock.paused;
    const panel=typeof document==='undefined'?null:document.getElementById('event');
    const controls=panel?.querySelector('#buttons'),wasInert=controls?.inert;
    if(controls)controls.inert=true;
    let notice,switching=false;
    if(panel){notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='正在保留当前世界…';panel.querySelector('#description')?.appendChild(notice);}
    clock.paused=true;CivilPlatform.transitioning=true;CivilLocalSaves.suspended=true;
    clearTimeout(CivilPlatform.timer);CivilPlatform.timer=null;
    clearTimeout(CivilLocalSaves.timer);CivilLocalSaves.timer=null;
    try{
      // A cloud/local write already in flight must finish before another world can exist.
      await CivilPlatform.writePromise;await CivilLocalSaves.queue;
      const row={text:await CivilPlatform.encode(),meta:CivilLocalSaves.metadata(State)};
      await CivilLocalSaves.backupRestart(row);
      if(readOnly)await CivilLocalSaves.activate(null);
      CivilPlatform.dirty=false;
      switching=true;
      Civilization.restart(next);
      return true;
    }catch(error){
      if(!switching){clock.paused=wasPaused;Notifications.notify(null,'没有重开：'+error.message+'。当前世界仍在。');}
      else{
        // A failed renderer must never autosave a half-initialized replacement.
        CivilClock.paused=true;CivilClock.stop?.();CivilPlatform.loaded=false;CivilLocalSaves.blocked=true;
        CivilPlatform.status('新世界未能打开，请刷新恢复原进度；重开前备份已保留。');
      }
      return false;
    }finally{
      if(controls)controls.inert=wasInert;
      notice?.remove();
      this.restarting=false;CivilPlatform.transitioning=false;CivilLocalSaves.suspended=false;
      if(CivilPlatform.dirty)CivilPlatform.changed();
      if(CivilLocalSaves.dirty)CivilLocalSaves.changed();
      if(State.civilization?.setup?.confirmed!==false)CivilPlatform.changed();
    }
  }
};
