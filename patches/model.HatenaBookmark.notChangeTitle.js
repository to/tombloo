addAround(HatenaBookmark, 'post', function(proceed, args, target, methodName){
	var ps = args[0] = update({}, args[0]);
	delete ps.item;
	return proceed(args);
});
