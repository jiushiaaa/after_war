(function() {
  var Engine = window.Engine = {

    SITE_URL: encodeURIComponent("http://adarkroom.doublespeakgames.com"),
    VERSION: 1.3,
    MAX_STORE: 99999999999999,
    SAVE_DISPLAY: 30 * 1000,
    GAME_OVER: false,

    //object event types
    topics: {},

    Perks: {
      'boxer': {
        name: _('boxer'),
        desc: _('punches do more damage'),
        /// TRANSLATORS : means with more force.
        notify: _('learned to throw punches with purpose')
      },
      'martial artist': {
        name: _('martial artist'),
        desc: _('punches do even more damage.'),
        notify: _('learned to fight quite effectively without weapons')
      },
      'unarmed master': {
        /// TRANSLATORS : master of unarmed combat
        name: _('unarmed master'),
        desc: _('punch twice as fast, and with even more force'),
        notify: _('learned to strike faster without weapons')
      },
      'barbarian': {
        name: _('barbarian'),
        desc: _('melee weapons deal more damage'),
        notify: _('learned to swing weapons with force')
      },
      'slow metabolism': {
        name: _('slow metabolism'),
        desc: _('go twice as far without eating'),
        notify: _('learned how to ignore the hunger')
      },
      'desert rat': {
        name: _('desert rat'),
        desc: _('go twice as far without drinking'),
        notify: _('learned to love the dry air')
      },
      'evasive': {
        name: _('evasive'),
        desc: _('dodge attacks more effectively'),
        notify: _("learned to be where they're not")
      },
      'precise': {
        name: _('precise'),
        desc: _('land blows more often'),
        notify: _('learned to predict their movement')
      },
      'scout': {
        name: _('scout'),
        desc: _('see farther'),
        notify: _('learned to look ahead')
      },
      'stealthy': {
        name: _('stealthy'),
        desc: _('better avoid conflict in the wild'),
        notify: _('learned how not to be seen')
      },
      'gastronome': {
        name: _('gastronome'),
        desc: _('restore more health when eating'),
        notify: _('learned to make the most of food')
      }
    },

    options: {
      state: null,
      debug: false,
      log: false,
      dropbox: false,
      doubleTime: false
    },

    init: function(options) {
      this.options = $.extend(
        this.options,
        options
      );
      this._debug = this.options.debug;
      this._log = this.options.log;

      window.State = this.options.state || {};
      Civilization.initState();
      window.CivilClock = new SimulationClock();
      CivilClock.restored = State.timers?.civilClock || {};
      $('<div>').attr('id', 'locationSlider').appendTo('#main');
      $.Dispatch('stateUpdate').subscribe(Engine.handleStateUpdates);
      $SM.init(); Notifications.init(); Events.init(); Room.init();
      if(typeof $SM.get('stores.wood') !== 'undefined') Outside.init();
      else if($SM.get('game.builder.level') >= 1) Engine.setTimeout(Room.unlockForest, Room._NEED_WOOD_DELAY);
      $('body').off('keydown').keydown(Engine.keyDown);
      $('body').off('keyup').keyup(Engine.keyUp);
      Engine.travelTo(Room);
      Civilization.init();
      CivilClock.start();
    },
    resumeAudioContext: function () {
      AudioEngine.tryResumingAudioContext();
      
      // turn on music!
          AudioEngine.setMasterVolume($SM.get('config.soundOn') ? 1.0 : 0.0, 0);

      document.removeEventListener('click', Engine.resumeAudioContext);
    },
    browserValid: function() {
      return ( location.search.indexOf( 'ignorebrowser=true' ) >= 0 || ( typeof Storage != 'undefined' && !oldIE ) );
    },

    isMobile: function() {
      return ( location.search.indexOf( 'ignorebrowser=true' ) < 0 && /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test( navigator.userAgent ) );
    },

    saveGame: function() { if(window.CivilPlatform) CivilPlatform.changed(); },
    loadGame: function() { throw Error('Use CivilPlatform.load before Engine.init'); },
    event: function() {}, // No analytics in this adaptation.
    findStylesheet: function(title) {
      for(var i=0; i<document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if(sheet.title == title) {
          return sheet;
        }
      }
      return null;
    },

    isLightsOff: function() {
      var darkCss = Engine.findStylesheet('darkenLights');
      if ( darkCss != null && !darkCss.disabled ) {
        return true;
      }
      return false;
    },

    turnLightsOff: function() {
      var darkCss = Engine.findStylesheet('darkenLights');
      if (darkCss == null) {
        $('head').append('<link rel="stylesheet" href="css/dark.css" type="text/css" title="darkenLights" />');
        $('.lightsOff').text(_('lights on.'));
        $SM.set('config.lightsOff', true, true);
      } else if (darkCss.disabled) {
        darkCss.disabled = false;
        $('.lightsOff').text(_('lights on.'));
        $SM.set('config.lightsOff', true,true);
      } else {
        $("#darkenLights").attr("disabled", "disabled");
        darkCss.disabled = true;
        $('.lightsOff').text(_('lights off.'));
        $SM.set('config.lightsOff', false, true);
      }
    },

    confirmHyperMode: function(){
      if (!Engine.options.doubleTime) {
        Events.startEvent({
          title: _('Go Hyper?'),
          scenes: {
            start: {
              text: [_('turning hyper mode speeds up the game to x2 speed. do you want to do that?')],
              buttons: {
                'yes': {
                  text: _('yes'),
                  nextScene: 'end',
                  onChoose: Engine.triggerHyperMode
                },
                'no': {
                  text: _('no'),
                  nextScene: 'end'
                }
              }
            }
          }
        });
      } else {
        Engine.triggerHyperMode();
      }
    },

    triggerHyperMode: function() {
      Engine.options.doubleTime = !Engine.options.doubleTime;
      if(Engine.options.doubleTime)
        $('.hyper').text(_('classic.'));
      else
        $('.hyper').text(_('hyper.'));

      $SM.set('config.hyperMode', Engine.options.doubleTime, false);
    },

    // Gets a guid
    getGuid: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    },

    activeModule: null,

    travelTo: function(module) {
      // The slider owns horizontal navigation. Focusing a control in an
      // incoming panel must not leave the clipped viewport scrolled as well.
      $('#main').scrollLeft(0);
      if(Engine.activeModule == module) {
        return;
      }

      var currentIndex = Engine.activeModule ? $('.location').index(Engine.activeModule.panel) : 1;
      $('div.headerButton').removeClass('selected');
      module.tab.addClass('selected');

      var slider = $('#locationSlider');
      var stores = $('#storesContainer');
      var panelIndex = $('.location').index(module.panel);
      var diff = Math.abs(panelIndex - currentIndex);
      slider.animate({left: -(panelIndex * 700) + 'px'}, 300 * diff, function() {
        $('#main').scrollLeft(0);
      });

      if($SM.get('stores.wood') !== undefined) {
        // FIXME Why does this work if there's an animation queue...?
        stores.animate({right: -(panelIndex * 700) + 'px'}, 300 * diff);
      }

      if(Engine.activeModule == Room || Engine.activeModule == Path || Engine.activeModule == Fabricator) {
        // Don't fade out the weapons if we're switching to a module
        // where we're going to keep showing them anyway.
        if (module != Room && module != Path && module != Fabricator) {
          $('div#weapons').animate({opacity: 0}, 300);
        }
      }

      if(module == Room || module == Path || module == Fabricator) {
        $('div#weapons').animate({opacity: 1}, 300);
      }

      Engine.activeModule = module;
      module.onArrival(diff);
      Notifications.printQueue(module);
    },

    /* Move the stores panel beneath top_container (or to top: 0px if top_container
     * either hasn't been filled in or is null) using transition_diff to sync with
     * the animation in Engine.travelTo().
     */
    moveStoresView: function(top_container, transition_diff) {
      var stores = $('#storesContainer');

      // If we don't have a storesContainer yet, leave.
      if(typeof(stores) === 'undefined') return;

      if(typeof(transition_diff) === 'undefined') transition_diff = 1;

      if(top_container === null) {
        stores.animate({top: '0px'}, {queue: false, duration: 300 * transition_diff});
      }
      else if(!top_container.length) {
        stores.animate({top: '0px'}, {queue: false, duration: 300 * transition_diff});
      }
      else {
        stores.animate({
          top: top_container.height() + 26 + 'px'
        }, {
          queue: false,
          duration: 300 * transition_diff
        });
      }
    },

    log: function(msg) {
      if(this._log) {
        console.log(msg);
      }
    },

    updateSlider: function() {
      var slider = $('#locationSlider');
      slider.width((slider.children().length * 700) + 'px');
    },

    updateOuterSlider: function() {
      var slider = $('#outerSlider');
      slider.width((slider.children().length * 700) + 'px');
    },

    getIncomeMsg: function(num, delay) {
      return (num > 0 ? "+" : "") + Number(num.toFixed(2)) + " / " + Number((delay / (window.CivilClock?.rate || 1)).toFixed(2)) + "秒";
      //return (num > 0 ? "+" : "") + num + " per " + delay + "s";
    },

    keyLock: false,
    tabNavigation: true,
    restoreNavigation: false,

    keyDown: function(e) {
      e = e || window.event;
      if(!Engine.keyPressed && !Engine.keyLock) {
        Engine.pressed = true;
        if(Engine.activeModule.keyDown) {
          Engine.activeModule.keyDown(e);
        }
      }
      return jQuery.inArray(e.keycode, [37,38,39,40]) < 0;
    },

    keyUp: function(e) {
      Engine.pressed = false;
      if(Engine.activeModule.keyUp) {
        Engine.activeModule.keyUp(e);
      } else {
        switch(e.which) {
          case 38: // Up
          case 87:
            Engine.log('up');
            break;
          case 40: // Down
          case 83:
            Engine.log('down');
            break;
          case 37: // Left
          case 65:
            if (Engine.tabNavigation) {
              if (Engine.activeModule == Ship && Fabricator.tab) {
                Engine.travelTo(Fabricator);
              }
              else if ((Engine.activeModule == Ship || Engine.activeModule == Fabricator) && Path.tab) {
                Engine.travelTo(Path);
              }
              else if (Engine.activeModule == Path && Outside.tab) {
                Engine.travelTo(Outside);
              } 
              else if (Engine.activeModule == Outside && Room.tab) {
                Engine.travelTo(Room);
              }
            }
            Engine.log('left');
            break;
          case 39: // Right
          case 68:
            if (Engine.tabNavigation){
              if (Engine.activeModule == Room && Outside.tab) {
                Engine.travelTo(Outside);
              }
              else if (Engine.activeModule == Outside && Path.tab){
                Engine.travelTo(Path);
              }
              else if(Engine.activeModule == Path && Fabricator.tab) {
                Engine.travelTo(Fabricator);
              }
              else if ((Engine.activeModule == Path || Engine.activeModule == Fabricator) && Ship.tab){
                Engine.travelTo(Ship);
              }
            }
            Engine.log('right');
            break;
        }
      }
      if(Engine.restoreNavigation){
        Engine.tabNavigation = true;
        Engine.restoreNavigation = false;
      }
      return false;
    },

    swipeLeft: function(e) {
      if(Engine.activeModule.swipeLeft) {
        Engine.activeModule.swipeLeft(e);
      }
    },

    swipeRight: function(e) {
      if(Engine.activeModule.swipeRight) {
        Engine.activeModule.swipeRight(e);
      }
    },

    swipeUp: function(e) {
      if(Engine.activeModule.swipeUp) {
        Engine.activeModule.swipeUp(e);
      }
    },

    swipeDown: function(e) {
      if(Engine.activeModule.swipeDown) {
        Engine.activeModule.swipeDown(e);
      }
    },

    disableSelection: function() {
      document.onselectstart = eventNullifier; // this is for IE
      document.onmousedown = eventNullifier; // this is for the rest
    },

    enableSelection: function() {
      document.onselectstart = eventPassthrough;
      document.onmousedown = eventPassthrough;
    },

    autoSelect: function(selector) {
      $(selector).focus().select();
    },

    handleStateUpdates: function(e){

    },

    setInterval: function(callback, interval, skipDouble, key) {
      return CivilClock.add(callback, interval, interval, key);
    },
    setTimeout: function(callback, timeout, skipDouble) {
      const keys = [[Room.coolFire,'fire'],[Room.adjustTemp,'temperature'],[Room.updateBuilderState,'builder'],[Room.unlockForest,'forest']];
      const key=keys.find(pair=>pair[0]===callback)?.[1];
      return CivilClock.add(callback,timeout,0,key);
    },
    clearTimeout: function(id) { CivilClock.clear(id); },
    clearInterval: function(id) { CivilClock.clear(id); }

  };

  function eventNullifier(e) {
    return $(e.target).hasClass('menuBtn');
  }

  function eventPassthrough(e) {
    return true;
  }

  function notifyAboutSound() {
    if ($SM.get('playStats.audioAlertShown')) {
      return;
    }

    // Tell new users that there's sound now!
    $SM.set('playStats.audioAlertShown', true);
    Events.startEvent({
      title: _('Sound Available!'),
      scenes: {
        start: {
          text: [
            _('ears flooded with new sensations.'),
            _('perhaps silence is safer?')
          ],
          buttons: {
            'yes': {
              text: _('enable audio'),
              nextScene: 'end',
              onChoose: () => Engine.toggleVolume(true)
            },
            'no': {
              text: _('disable audio'),
              nextScene: 'end',
              onChoose: () => Engine.toggleVolume(false)
            }
          }
        }
      }
    });
  }

})();

function inView(dir, elem){

  var scTop = $('#main').offset().top;
  var scBot = scTop + $('#main').height();

  var elTop = elem.offset().top;
  var elBot = elTop + elem.height();

  if( dir == 'up' ){
    // STOP MOVING IF BOTTOM OF ELEMENT IS VISIBLE IN SCREEN
    return ( elBot < scBot );
  } else if( dir == 'down' ){
    return ( elTop > scTop );
  } else {
    return ( ( elBot <= scBot ) && ( elTop >= scTop ) );
  }

}

function setYPosition(elem, y) {
  var elTop = parseInt( elem.css('top'), 10 );
  elem.css('top', `${y}px`);
}


//create jQuery Callbacks() to handle object events
$.Dispatch = function( id ) {
  var callbacks, topic = id && Engine.topics[ id ];
  if ( !topic ) {
    callbacks = jQuery.Callbacks();
    topic = {
      publish: callbacks.fire,
      subscribe: callbacks.add,
      unsubscribe: callbacks.remove
    };
    if ( id ) {
      Engine.topics[ id ] = topic;
    }
  }
  return topic;
};

$(function() {
  async function boot() {
    try { const state=await CivilPlatform.load(); $('#startupError').remove(); Engine.init({state}); }
    catch(error) {
      $('#startupError').remove();
      const box=$('<div>').attr('id','startupError').appendTo('body');
      $('<p>').text('没有读到云端进度，游戏尚未开始。原存档不会被覆盖。').appendTo(box);
      $('<p>').text(error.message).appendTo(box);
      $('<button>').text('重试读取').on('click',async function(){this.disabled=true;await boot();}).appendTo(box);
    }
  }
  boot();
});
