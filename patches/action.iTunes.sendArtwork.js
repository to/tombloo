Tombloo.Service.actions.register(	{
	name : 'iTunes - Send Artwork',
	type : 'context',
	icon : 'chrome://tombloo/skin/iTunes.ico',
	check : function(ctx){
		return !!ctx.target.src;
	},
	execute : function(ctx){
		download(ctx.target.src, getTempFile()).addCallback(function(file){
			runWSH(function(path){
				function forEach(l, f){
					for(var i=1 ; i<=l.count ; i++)
						f(l(i), i);
				}
				
				var iTunes = WScript.CreateObject('iTunes.Application');
				forEach(iTunes.selectedTracks, function(track){
					track.addArtworkFromFile(path);
				});
			}, file.path).addCallback(function(){
				file.remove(false);
			});
		});
	},
}, '----');
