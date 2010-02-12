addAround(Flickr, 'getSizes', function(proceed, args, target, methodName){
	const LIMIT = 3000;
	
	return proceed(args).addCallback(function(sizes){
		for(var i=sizes.length-1 ; i>=0 ; i--)
			if(sizes[i].width < LIMIT && sizes[i].height < LIMIT)
				break;
		
		return sizes.slice(0, i+1);
	});
});
