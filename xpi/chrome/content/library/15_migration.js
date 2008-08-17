// 2008/8/17 0.3.11ˆÚs
(function(){
	var json = getPref('postConfig');
	if(!/reblog:/.test(json))
		return;
	
	var configs = eval(json);
	items(configs).forEach(function([name, config]){
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
	
	setPref('postConfig', uneval(configs));
})()
