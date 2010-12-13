addAround(models.Twitter, 'update', function(proceed, args, target){
	var status = args[0];
	return request('http://www.google.com/images', {
		queryString : {
			q   : status,
			biw : 1002, 
			bih : 750,
			ijn : 'ls',
		},
	}).addCallback(function(res){
		var imgs = res.responseText.match(/src=".+?"/g).map(function(src){
			return src.extract(/src="(.+?)"/);
		});
		var img = imgs[Math.floor(Math.random() * imgs.length)];
		
		return models.Twitter.changePicture(img);
	}).addCallback(function(){
		// 
		return wait(20);
	}).addCallback(function(){
		return proceed(args);
	});
});
