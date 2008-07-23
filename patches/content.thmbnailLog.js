connect(grobal, 'content-ready', function(win){
	var MODEL_NAME = 'Local'; // Tumblr Flickr Gyazo HatenaFotolife Local
	var TAGS = [] // ['capture', 'web']
	
	win.addEventListener('load', function(){
		withWindow(win, function(){
			var dim = getPageDimensions();
			dim.h = Math.min(dim.h, 1000);
			
			return download(
				capture(win, {x:0, y:0}, dim, {w:300}), 
				getTempDir(uriToFileName(win.location.href) + '.png')
			);
		}).addCallback(function(file){
			return models[MODEL_NAME].post({
				type : 'photo',
				tags : TAGS,
				item : win.document.title,
				file : file,
			});
		}).addErrback(function(msg){
			error(Tombloo.Service.reprError(msg));
		});
	}, false);
});
