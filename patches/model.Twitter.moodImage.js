addAround(models.Twitter, 'update', function(proceed, args, target){
	var status = args[0];
	status = status.extract(/^(.*?)([、。,.\s\n\r]|$)/);
	return request('http://www.google.com/images', {
		queryString : {
			q   : status,
			biw : 1002, 
			bih : 750,
			ijn : 'ls',
		},
	}).addCallback(function(res){
		// オリジナル画像は見つからない可能性があるためサムネイルを使う
		var imgs = res.responseText.match(/src=".+?"/g).map(function(src){
			return src.extract(/src="(.+?)"/);
		});
		var img = imgs[Math.floor(Math.random() * imgs.length)];
		
		return models.Twitter.changePicture(img);
	}).addCallback(function(){
		// FIXME: /settings/profile/check_processing_completeを利用
		return wait(20);
	}).addCallback(function(){
		return proceed(args);
	});
});
