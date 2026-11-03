/**
 * Module that takes care of header buttons
 */
var Header = {
	
	init: function(options) {
		this.options = $.extend(
			this.options,
			options
		);
	},
	
	options: {}, // Nothing for now
	
	canTravel: function() {
		return $('div#header div.headerButton').length > 1;
	},
	
	addLocation: function(text, id, module, before) {
    const go = function() { if(Header.canTravel()) Engine.travelTo(module); };
    // Place tabs are reachable with Tab and activated with Enter/Space.
    const toAdd = $('<div>').attr({id: "location_" + id, role: 'button', tabindex: 0})
			.addClass('headerButton')
			.text(text).click(go)
			.on('keydown', function(e) { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      
    if (before && $(`#location_${before}`).length > 0) {
      return toAdd.insertBefore(`#location_${before}`);
    }
    
    return toAdd.appendTo($('div#header'));
	}
};
