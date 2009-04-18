connect(grobal, 'content-ready', function(win){
	var href = win.location.href;
	if(href.indexOf('http://images.google.co.jp/images') != 0)
		return;
	
	if(href.indexOf('gbv=1') == -1){
		win.location.href = href.replace(/&?gbv=2/, '') + '&gbv=1';
		return;
	}
	
	win.watch('maybeRedirectForGBV', function(prop, oldVal, newVal){
		return function(){};
	});
});
