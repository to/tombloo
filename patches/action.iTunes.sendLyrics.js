Tombloo.Service.actions.register(	{
	name : 'iTunes - Send Lyrics',
	type : 'context',
	check : function(ctx){
		return !ctx.window.getSelection().isCollapsed;
	},
	execute : function(ctx){
		var self = this;
		runWSH(function(lyrics){
			var iTunes = WScript.CreateObject('iTunes.Application');
			var tracks = iTunes.selectedTracks;
			if(!tracks)
				throw 'Tracks not selected.';
			
			var track = tracks.item(1);
			if(track.lyrics)
				throw 'Already exists lyrics.';
			
			track.lyrics = lyrics;
			
			// キー列挙はできなかった
			return {
				artist : track.artist, 
				name   : track.name,
			};
		}, ''+ctx.window.getSelection(), true).addCallback(function(res){
			notify(self.name, res.artist + ' - ' + res.name, notify.ICON_INFO);
		}).addErrback(function(e){
			alert('ERROR: ' + e.message);
		});
	},
}, '----');
