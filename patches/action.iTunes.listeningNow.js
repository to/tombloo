Tombloo.Service.actions.register(	{
	name : 'iTunes - Listening Now',
	execute : function(){
		var res = executeWSH(function(msg){
			function fix(s){
				return s.replace(/\u0000/g, '');
			}
			
			var iTunes = WScript.CreateObject('iTunes.Application');
			var track = iTunes.currentTrack;
			if(!track){
				if(!iTunes.selectedTracks)
					return;
				
				track = iTunes.selectedTracks.item(1);
			}
			
			return 'Listening: ' + 
				(track.artist? fix(track.artist) + ' - ' : '') + 
				(track.album? fix(track.album) + ' - ' : '') + fix(track.name) +
				(track.comment.match('^http://')? ' ' + track.comment.split(/[\n\r]/)[0] : '');
		});
		
		if(res){
			QuickPostForm.show({
				type    : 'regular',
				description : res,
			});
		} else {
			alert("Can't get the track.");
		}
	},
}, '----');
