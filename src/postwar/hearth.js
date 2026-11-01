/* MPL-2.0 — Explain the original paid hearth watch; electrical production is not heating. */
var CivilHearth={
  status(s){
    const c=s.civilization||{},fire=s.game.fire?.value||0,temperature=s.game.temperature?.value||0,wood=s.stores.wood||0,watched=(s.game.builder?.level??-1)>3;
    const town=!!(c.village?.town||c.urban?.chartered||c.urban?.city),city=!!c.urban?.city;
    let warning='';
    if(watched&&fire===0)warning='炉火已熄，需5木料重新生火';
    else if(watched&&wood<1)warning='守火缺木，至少需要1木料';
    else if(watched&&fire<2)warning='余火偏弱，可手动添火升温';
    return {watched,town,city,fire,temperature,wood,warning,title:city?'旧维修间炉火':'炉火管理',
      note:watched?'工匠已接手照看炉火。余火每5分钟消耗1木料；手动添火可临时升温。'+(city?'旧维修间仍烧木取暖，发电机供应工区和公用设施。':'断木后火势会变弱，熄火后需要重新生火。'):''};
  },
  refresh(s){
    if(typeof $!=='function'||!$('#roomPanel').length||!$('#stokeButton').length)return;
    const view=this.status(s);let note=$('#hearthNote'),details=$('#hearthManagement');
    if(!note.length)note=$('<div>').attr('id','hearthNote').css({clear:'both',width:'390px',lineHeight:'1.7',marginBottom:'12px'}).insertAfter('#stokeButton');
    if(view.town&&!details.length){
      details=$('<details>').attr('id','hearthManagement').css({clear:'both',marginBottom:'16px',width:'410px'}).insertBefore('#lightButton');
      $('<summary>').attr('id','hearthSummary').css({cursor:'pointer',marginBottom:'10px'}).appendTo(details);
      const body=$('<div>').attr('id','hearthControls').appendTo(details);
      $('#lightButton').appendTo(body);$('#stokeButton').appendTo(body);note.appendTo(body);
    }
    if(details.length)$('#hearthSummary').text(view.title+' · '+(view.warning||(view.watched?'工匠照看':'等待照看'))).attr('title',view.warning||'展开查看炉温与备用添火').css('fontWeight',view.warning?'bold':'normal');
    const conditions='火势：'+['熄灭','余烬','微火','燃烧','旺火'][view.fire]+'；室温：'+['冰冷','寒冷','适宜','温暖','炎热'][view.temperature]+'。';
    note.text((view.warning?view.warning+'。':'')+conditions+view.note).toggle(view.watched||view.town);
    $('#stokeButton').attr('title','手动添火需1木料，提高一级火势，并重新开始5分钟冷却。');
    $('#lightButton').attr('title',s.stores.wood===undefined?'点燃维修间的炉火。':'重新生火需5木料。');
  },
  install(){
    if(this.installed||typeof Room==='undefined'||typeof Room.coolFire!=='function'||typeof Room.stokeFire!=='function')return;
    this.installed=true;
    const stoke=Room.stokeFire,update=Room.updateButton;
    Room.stokeFire=function(){
      const wood=$SM.get('stores.wood');
      // Preserve the original introductory fire before wood has become a stored resource.
      if(typeof wood==='number'&&wood<1){Notifications.notify(Room,'添火需要1份木料。');Button.clearCooldown($('#stokeButton.button'));return;}
      return stoke.apply(Room,arguments);
    };
    Room.coolFire=function(){
      const fire=$SM.get('game.fire.value'),wood=$SM.get('stores.wood');
      // A dead hearth needs the existing five-wood light action; tending ashes must not burn wood.
      if(fire<=0)return;
      if(fire<=Room.FireEnum.Flickering.value&&$SM.get('game.builder.level')>3&&wood>=1){
        $SM.set('stores.wood',wood-1);$SM.set('game.fire',Room.FireEnum.fromInt(fire+1));
        Notifications.notify(Room,_('builder stokes the fire'),true);
      }
      $SM.set('game.fire',Room.FireEnum.fromInt($SM.get('game.fire.value')-1));
      // Native onFireChange owns the single next five-minute timer and the original visual updates.
      Room.onFireChange();
    };
    Room.updateButton=function(){const result=update.apply(Room,arguments);CivilHearth.refresh(State);return result;};
  }
};
CivilHearth.install();
