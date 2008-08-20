(function(){
	var advice = function(proceed, args, target, methodName){
		var ps = args[0];
		var type = ps.type;
		if(ps.favorite && ps.favorite.name == 'Tumblr')
			ps.type = 'reblog';
		
		var posters = proceed(args);
		
		ps.type = type;
		
		return posters;
	}
	
	addAround(models, 'getDefaults', advice);
	addAround(models, 'getEnables', advice);
})();
