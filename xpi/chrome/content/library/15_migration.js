(function(){
	var json = getPref('postConfig');
	if(!/reblog:/.test(json))
		return;
	
	var configs = eval(json);
	items(configs).forEach(function([name, config]){
		delete config.reblog;
		
		if(!models[name].favor)
			return;
		
		config.favorite = false;
		
		for each(var type in 'regular photo quote link video conversation'.split(' ')){
			if(config[type]){
				config.favorite = true;
				return;
			}
		}
	});
	
	setPref('postConfig', uneval(configs));
})()
