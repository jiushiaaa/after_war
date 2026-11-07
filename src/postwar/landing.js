/* MPL-2.0 — A quiet entry. No world, clock or write until the player begins. */
var CivilLanding={
  phase:'idle',resumePaused:false,
  held(){return !['idle','playing'].includes(this.phase);},
  show(state,onError){
    this.phase='ready';this.state=state;this.onError=onError;
    const button=document.getElementById('civilStartButton');
    button.textContent=state.civilization&&state.civilization.setup?.confirmed!==false?'继续游戏':'开始游戏';
    button.disabled=false;button.onclick=()=>this.begin();
    document.getElementById('civilLanding').hidden=false;
    document.body.classList.add('civil-entry');
  },
  begin(){
    if(this.phase!=='ready')return;
    this.phase='starting';document.getElementById('civilStartButton').disabled=true;
    const state=this.state;this.state=null;
    try{Engine.init({state});}catch(error){this.fail();this.onError?.(error);}
  },
  beforeInit(){
    this.phase='starting';this.resumePaused=false;
    document.body.classList.add('civil-entry');
    document.getElementById('civilLanding').hidden=true;
    // A new slot may be opened while the previous world's music is playing.
    if(typeof CivilSound!=='undefined'&&CivilSound.context)CivilSound.context.suspend().catch(()=>{});
  },
  afterInit(){
    if(State.civilization.setup?.confirmed===false){this.phase='setup';CivilClock.paused=true;return;}
    this.reveal();
  },
  finishSetup(){if(this.phase==='setup')this.reveal();},
  reveal(){
    this.phase='playing';CivilClock.paused=this.resumePaused;
    document.body.classList.remove('civil-entry');
    document.getElementById('civilLanding').hidden=true;
    Civilization.renderSpeed();
    const tab=Engine.activeModule?.tab?.[0];
    if(Events.activeEvent())Events._returnFocus=tab;else tab?.focus({preventScroll:true});
    if(typeof CivilSound!=='undefined')CivilSound.unlock();
    Engine.saveGame();
  },
  fail(){
    this.phase='error';this.state=null;
    if(typeof CivilClock!=='undefined')CivilClock.paused=true;
    document.getElementById('civilLanding').hidden=true;
    document.body.classList.add('civil-entry');
  }
};
