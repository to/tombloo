// 2008/8/17 0.3.11ˆÚs
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
			// ‚Ğ‚Æ‚Â‚Å‚àdefault‚Éw’è‚³‚ê‚Ä‚¢‚½‚çfavorite‚àdefault‚Æ‚·‚é
			if(favor && value)
				config.favorite = 'default';
			
			config[type] = value? 'default' :
				(value === '')? 'disabled' : 'enabled';
		});
		
		// favorite‚ª–¢İ’è‚È‚çenabled‚Æ‚·‚é
		if(favor && !config.favorite)
			config.favorite = 'enabled';
	});
	
	// 0.3.11‚Å‚Ífavorite‚ÌˆÓ–¡‚µ‚©‚È‚©‚Á‚½‚½‚ß‚»‚Ì‚Ü‚ÜˆÚs‚µ‚È‚¢
	if(configs.Flickr.photo == 'default')
		configs.Flickr.photo = 'enabled';
	
	setPref('postConfig', uneval(configs));
})()
