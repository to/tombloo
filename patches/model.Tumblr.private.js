addAround(Tumblr, 'post', function(proceed, args, target, methodName){
	return proceed([
		update({}, args[0], {
			private : true
		})
	]);
});
