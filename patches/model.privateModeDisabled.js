addAround(models, 'check', function(proceed, args) {
	var ret = proceed(args);
	var ps = args[0];
	ps.hasPrivateMode = false;
	return ret;
});

