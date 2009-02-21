Tombloo.Service.actions.register(	{
	name : 'iTunes - Upload Selected Tracks to 8tracks',
	execute : function(){
		var self = this;
		var paths = executeWSH(function(msg){
			function map(f, l){
				var res = [];
				for(var i=1 ; i<=l.count ; i++)
					res.push(f(l(i)));
				return res;
			}
			
			var iTunes = WScript.CreateObject('iTunes.Application');
			return map(function(track){
				return track.location;
			}, iTunes.selectedTracks).join('\t');
		}).split('\t');
		
		deferredForEach(paths, function(path){
			return models['8tracks'].upload(path);
		}).addCallback(function(){
			notify(
				self.name, 
				'END: uploaded ' + paths.length + ' track' + ((paths.length>1)? 's' : '') + '.', 
				notify.ICON_INFO);
		}).addErrback(function(e){
			alert(Tombloo.Service.reprError(e));
		});
	},
}, '----');
