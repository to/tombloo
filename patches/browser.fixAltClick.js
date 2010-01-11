connect(grobal, 'browser-load', function(e){
	var win = e.target.defaultView;
	win.getBrowser().mPanelContainer.addEventListener('click', function(e){
		if(!win.content.getSelection().isCollapsed)
			cancel(e);
	}, true);
	win.addEventListener('keyup', function(e){
		// メニューへキーフォーカスが移るのを抑止する
		if(e.keyCode==18 && !win.content.getSelection().isCollapsed)
			cancel(e);
	}, true);
});
