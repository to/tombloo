(function(grobal){
	var checked = {};
	
	// アプリケーションを通じて一度だけオブサーバーに追加される
	var observer = grobal.findDirectoryIndexObserver;
	if(!observer){
		observer = grobal.findDirectoryIndexObserver = {};
		
		ObserverService.addObserver(observer, 'http-on-examine-response', false);
	}
	
	// リロードの度に再評価される
	observer.observe = function(subject, topic, data) {
		subject.QueryInterface(Components.interfaces.nsIHttpChannel);
		
		if(!/^(image|audio)/.test(subject.contentType) || subject.contentLength < 2048)
			return;
		
		var url = subject.URI.resolve('.');
		if(url == subject.URI.asciiSpec || checked[url])
			return;
		
		checked[url] = true;
		
		request(url).addCallback(function(res){
			if(!(/<title>Index of/i).test(res.responseText))
				return;
			
			addTab(url, true);
			notify('Found directory index', url, notify.ICON_INFO);
		});
	}
})(this);
