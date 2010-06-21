(function(){
	var cachedInfo;
	
	addAround(models.Flickr, 'getInfo', function(proceed, args, target){
		return proceed(args).addCallback(function(info){
			return cachedInfo = info;
		});
	});
	
	addAround(Tombloo.Service.extractors['Photo - Flickr'], 'extract', function(proceed, args, target){
		return proceed(args).addCallback(function(ps){
			ps.tags = cachedInfo.tags.tag.map(itemgetter('raw'));
			return ps;
		});
	});
	
	/*
	// バージョン0.4.9以下で、このパッチを使う場合に必要
	connect(grobal, 'form-open', function(win){
		setTimeout(function(){
			var tagsPanel = win.dialogPanel.formPanel.tagsPanel;
			tagsPanel.elmCompletion.addEventListener('construct', function(){
				tagsPanel.value = win.ps.tags;
			}, false);
		}, 0);
	});
	*/
})();
