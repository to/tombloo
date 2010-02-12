addAround(Tumblr, 'appendTags', function(proceed, args, target, methodName){
	proceed(args);
	
	args[0]['post[state]'] = 'private';
;
});
