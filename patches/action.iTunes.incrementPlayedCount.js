Tombloo.Service.actions.register(	{
	name : 'iTunes - Increment Played Count',
	execute : function(){
		executeWSH(function(msg){
			var iTunes = WScript.CreateObject('iTunes.Application');
			var tracks = iTunes.selectedTracks;
			if(!tracks)
				return;
			
			for(var i = 1 ; i <= tracks.count ; i++){
				var track = tracks(i);
				track.PlayedCount = Math.max(0, track.PlayedCount) + 1;
			}
		});
	},
}, '----');
