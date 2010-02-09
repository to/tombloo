Tombloo.Service.actions.register(	{
	name : 'iTunes - Increment Played Count',
	icon : 'chrome://tombloo/skin/iTunes.ico',
	execute : function(){
		runWSH(function(msg){
			var iTunes = WScript.CreateObject('iTunes.Application');
			var tracks = iTunes.selectedTracks;
			if(!tracks)
				return;
			
			for(var i = 1 ; i <= tracks.count ; i++){
				var track = tracks(i);
				track.playedCount = Math.max(0, track.playedCount) + 1;
			}
		});
	},
}, '----');
