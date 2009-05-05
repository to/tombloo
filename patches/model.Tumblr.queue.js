addAround(Tumblr, 'appendTags', function(proceed, args){
	args[0]['post[state]'] = 2;
	return proceed(args);
});
