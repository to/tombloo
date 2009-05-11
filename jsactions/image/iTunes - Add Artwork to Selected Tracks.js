(function(){with(Components.classes['@brasil.to/tombloo-service;1'].getService().wrappedJSObject){
	download(_jsaCScript.context.target.src, getTempFile()).addCallback(function(file){
		var res = executeWSH(function(path){
			function forEach(l, f){
				for(var i=1 ; i<=l.count ; i++)
					f(l(i), i);
			}
			
			var iTunes = WScript.CreateObject('iTunes.Application');
			forEach(iTunes.selectedTracks, function(track){
				track.addArtworkFromFile(path);
			});
		}, file.path, true);
	});
}})();
