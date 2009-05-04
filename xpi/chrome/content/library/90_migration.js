// 2008/8/17 0.3.11移行
(function(){
	var json = getPref('postConfig');
	if(!/reblog:/.test(json))
		return;
	
	var configs = eval(json);
	items(configs).forEach(function([name, config]){
		if(!models[name])
			return;
		
		var favor = models[name].favor;
		
		delete config.reblog;
		
		items(config).forEach(function([type, value]){
			// ひとつでもdefaultに指定されていたらfavoriteもdefaultとする
			if(favor && value)
				config.favorite = 'default';
			
			config[type] = value? 'default' :
				(value === '')? 'disabled' : 'enabled';
		});
		
		// favoriteが未設定ならenabledとする
		if(favor && !config.favorite)
			config.favorite = 'enabled';
	});
	
	// 0.3.11ではfavoriteの意味しかなかったためそのまま移行しない
	if(configs.Flickr.photo == 'default')
		configs.Flickr.photo = 'enabled';
	
	setPref('postConfig', uneval(configs));
})()
