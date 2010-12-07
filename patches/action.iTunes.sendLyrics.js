Tombloo.Service.actions.register(	{
	name : 'iTunes - Send Lyrics',
	type : 'context',
	icon : 'chrome://tombloo/skin/iTunes.ico',
	check : function(ctx){
		return !ctx.window.getSelection().isCollapsed;
	},
	execute : function(ctx){
		var self = this;
		var lyrics = convertToPlainText(ctx.window.getSelection()).replace(/[\u2028\u2029]/g,'');
		runWSH(function(lyrics){
			var iTunes = WScript.CreateObject('iTunes.Application');
			var tracks = iTunes.selectedTracks;
			if(!tracks)
				throw 'Tracks not selected.';
			
			var res = [];
			forEach(tracks, function(track){
				if(track.lyrics)
					throw 'Already exists lyrics.';
				
				track.lyrics = lyrics;
				
				res.push({
					artist : track.artist, 
					name   : track.name,
				});
			});
			
			return res;
		}, lyrics).addCallback(function(tracks){
			notify(self.name, (
				tracks.length > 1? 
					'(+' + (tracks.length - 1) + ') ' : 
					''
				) + tracks[0].artist + ' - ' + tracks[0].name, notify.ICON_INFO);
		}).addErrback(function(e){
			alert('ERROR: ' + e.message);
		});
	},
}, '----');
