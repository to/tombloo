connect(grobal, 'browser-load', function(e){
	var win = e.target.defaultView;
	win.getBrowser().mPanelContainer.addEventListener('click', function(e){
		if(win.content.getSelection() != '' && e.altKey)
			e.stopPropagation();
	}, true);
});
