['bit.ly', 'j.mp', 'is.gd'].forEach(function(name){
	addAround(models[name], 'shorten', function(proceed, args, target){
		args[0] = 'http://bacolicio.us/' + args[0]
		return proceed(args);
	});
});
