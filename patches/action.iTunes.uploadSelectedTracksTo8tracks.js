Tombloo.Service.actions.register(	{
	name : 'iTunes - Upload Selected Tracks to 8tracks',
	icon : "data:image/x-icon;base64,AAABAAEAEBAAAAEAGABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAABTORFGLhhyZVWgnJGtpqOYj4ZTSTcrGws+KQ5LNBRSNhNVORZQNxdUOxtSNhNZOhNTPBylmpLn6+zl6uvn5Obw7Ovh39dwaWYxHQtDKxNTNhdaOxpUNxhSNBddPh9WNhOMfmzu6ei9u7pnXUxaRzKHeGXk39bb3uZRRz02JRJQNRpXOBdcPRxWOBtWOBtaOxzRzcjf29ZGOCZSNxVcOxRePxiFc1zn6OyfnJQvIhJMNxhYPRhZPRpZPhxWPR1YPRvm6e6inpkzIg1KNBtSPSJaPRhiSSnh29TAurMwJBJLNhdcQRxcPxpYPBlbQR1bPxzn6u+8ubQxIA08JxFENiBWPR1bQCXd2M/Nw7k6KBdMMxlYOxxXOxxZPR9ZPB1gQB3Pw7nz9PBzaV81Hgg5KRI4Jg89KRizsKusoZk1JRg6JhQ9KhU8KBY/LBdLMxtXOx2DZkfr8O7u9Pu5r6iMiH2PiYKTh4GSj4eTkIiNh3yUjH+Sin2CfHFGPjEyJBFDLxZdRCKFb13b0ML//fP69vv2+f77//rv6uf77+X09/v2/P/6+fX//fXq6+l3dGwxIxFoRyBgQyRlSSt/Z0uAa1Z+aVR8bFWqnpKflJBnWE9yXk2EbFSijnz06+f89/hoW1NlRidhSChnRyRpRiRkSCZnRh9lSSvi3NXa2Nc4Jg9ZQCBjRyRlRySEdmT4+PjAvbhkSS5YRCVlSClmRilgSSloSB9vUTTd39/W29k7LRZKOCFcRi1oSB9dSCnW1Mzl49trSiNhSiRoSidjRidgSytqSh9xUzDj4dng3+E9KxpALBtSPCpmQyJXPSXb1NHo4t1sSh9nTShnSyhiSCpgSy9sTyphRSLDu6r7//+Lfm41JA9ALRhHMhx6cGn9/v+8t7RqTitlSi9hRSZrTzBiRyxkSixmTS1/alT39ev///atqZ5zbF2loZb8/v749vVsYE5mSitmRy5sTSxtSiJwSylpSilnTCdoSSiLdF7f2tn5/P////////7l39qEcF9qRyUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	execute : function(){
		var self = this;
		runWSH(function(msg){
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
		}).addCallback(function(res){
			var paths = res.split('\t');
			
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
		});
	},
}, '----');
