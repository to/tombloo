shortcutkeys['PAUSE'] = {
	description : 'Quick Capture',
	execute : function(e){
		cancel(e);
		var MODEL_NAME = 'Local'; // Tumblr Flickr Gyazo HatenaFotolife Local
		var CAPTURE_TYPE = 'View' // View Page
		var TAGS = [] // ['capture', 'web']
		
		var win = getMostRecentWindow().document.getElementById('content').contentWindow;
		var doc = win.document;
		var ctx = {
			document    : doc,
			window      : win,
			title       : doc.title,
			href        : win.location.href,
			captureType : CAPTURE_TYPE,
		}
		succeed().addCallback(function(){
			
			// Flash!
			return withWindow(win, function(){
				return flashView();
			})
			
		}).addCallback(function(){
			
			// Capture!!
			var exts = Tombloo.Service.extracters;
			return exts.extract(ctx, exts['Photo - Capture']);
			
		}).addCallback(function(ps){
			
			// Post!!!
			return models[MODEL_NAME].post(update(ps, {
				tags        : TAGS,
				description : MODEL_NAME=='Tumblr'? '' : joinText([ps.page, ps.pageUrl], '\n'),
				// private     : true,
			}));
			
		}).addErrback(function(msg){
			
			// Error!!!!
			Tombloo.Service.alertError(msg, ctx.title, ctx.href);
			
		});
	}
}
