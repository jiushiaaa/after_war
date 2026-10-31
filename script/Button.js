var Button = {
	Button: function(options) {
		if(typeof options.cooldown == 'number') {
			this.data_cooldown = options.cooldown;
		}
		this.data_remaining = 0;
		if(typeof options.click == 'function') {
			this.data_handler = options.click;
		}

		var el = $('<div>')
			.attr('id', typeof(options.id) != 'undefined' ? options.id : "BTN_" + Engine.getGuid())
			.addClass('button')
      .attr({role:'button',tabindex:0})
      .keydown(function(event) { if(event.key==='Enter' || event.key===' ') {event.preventDefault();$(this).click();} })
			.text(typeof(options.text) != 'undefined' ? options.text : "button")
			.click(function() {
				if(!$(this).hasClass('disabled')) {
					Button.cooldown($(this));
					$(this).data("handler")($(this));
				}
			})
			.data("handler",  typeof options.click == 'function' ? options.click : function() { Engine.log("click"); })
			.data("remaining", 0)
			.data("cooldown", typeof options.cooldown == 'number' ? options.cooldown : 0)
			.data('boosted', options.boosted ?? (() => false));

		el.append($("<div>").addClass('cooldown'));

		// waiting for expiry of residual cooldown detected in state
		Button.cooldown(el, 'state');

		if(options.cost) {
			var ttPos = options.ttPos ? options.ttPos : "bottom right";
			var costTooltip = $('<div>').addClass('tooltip ' + ttPos);
			for(var k in options.cost) {
				$("<div>").addClass('row_key').text(_(k)).appendTo(costTooltip);
				$("<div>").addClass('row_val').text(options.cost[k]).appendTo(costTooltip);
			}
			if(costTooltip.children().length > 0) {
				costTooltip.appendTo(el);
			}
		}

		if(options.width) {
			el.css('width', options.width);
		}

		return el;
	},

	saveCooldown: true,

	setDisabled: function(btn, disabled) {
		if(btn) {
			if(!disabled && !btn.data('onCooldown')) {
				btn.removeClass('disabled');
			} else if(disabled) {
				btn.addClass('disabled');
			}
			btn.data('disabled', disabled).attr('aria-disabled',disabled || !!btn.data('onCooldown'));

		}
	},

	isDisabled: function(btn) {
		if(btn) {
			return btn.data('disabled') === true;
		}
		return false;
	},

	cooldown: function(btn, option) {
    const cd=btn.data('cooldown'), id='cooldown.'+btn.attr('id');
    if(!(cd>0)) return;
    let left=option==='state' ? $SM.get(id,true) : typeof option==='number' ? option : cd;
    if(left<=0) return;
    Button.clearCooldown(btn);
    btn.addClass('disabled').data('onCooldown',true).attr('aria-disabled','true');
    $SM.set(id,left,true);
    const end=CivilClock.time+left*1000;
    const update=()=>{
      const remaining=Math.max(0,(end-CivilClock.time)/1000);
      $SM.set(id,remaining,true);
      $('div.cooldown',btn).width(Math.min(100,remaining/cd*100)+'%');
      if(remaining<=0) Button.clearCooldown(btn,true);
    };
    btn.data('countdown',Engine.setInterval(update,100));update();
  },
  clearCooldown: function(btn) {
    if(btn.data('countdown')) Engine.clearInterval(btn.data('countdown'));
    btn.removeData('countdown').data('onCooldown',false);
    $SM.remove('cooldown.'+btn.attr('id'),true);
    $('div.cooldown',btn).stop(true).width('0%');
    if(!btn.data('disabled'))btn.removeClass('disabled').attr('aria-disabled','false');
  }
};
