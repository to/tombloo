addAround(Flickr, 'check', function(proceed, args, target, methodName){
	var ps = args[0];
	if(ps.type=='photo' && !ps.file && ps.itemUrl)
		return true;

	return proceed(args);
});

addAround(Flickr, 'post', function(proceed, args, target, methodName){
	var ps = args[0];
	if(ps.type=='photo' && !ps.file && ps.itemUrl)
		return download(ps.itemUrl, getTempFile()).addCallback(function(file){
			ps.file = file;
			return proceed(args);
		});
	
	return proceed(args);
});
