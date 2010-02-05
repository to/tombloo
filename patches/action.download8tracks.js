Tombloo.Service.actions.register(	{
	name : 'Download 8tracks',
	type : 'context',
	icon : "data:image/x-icon;base64,AAABAAEAEBAAAAEAGABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAABTORFGLhhyZVWgnJGtpqOYj4ZTSTcrGws+KQ5LNBRSNhNVORZQNxdUOxtSNhNZOhNTPBylmpLn6+zl6uvn5Obw7Ovh39dwaWYxHQtDKxNTNhdaOxpUNxhSNBddPh9WNhOMfmzu6ei9u7pnXUxaRzKHeGXk39bb3uZRRz02JRJQNRpXOBdcPRxWOBtWOBtaOxzRzcjf29ZGOCZSNxVcOxRePxiFc1zn6OyfnJQvIhJMNxhYPRhZPRpZPhxWPR1YPRvm6e6inpkzIg1KNBtSPSJaPRhiSSnh29TAurMwJBJLNhdcQRxcPxpYPBlbQR1bPxzn6u+8ubQxIA08JxFENiBWPR1bQCXd2M/Nw7k6KBdMMxlYOxxXOxxZPR9ZPB1gQB3Pw7nz9PBzaV81Hgg5KRI4Jg89KRizsKusoZk1JRg6JhQ9KhU8KBY/LBdLMxtXOx2DZkfr8O7u9Pu5r6iMiH2PiYKTh4GSj4eTkIiNh3yUjH+Sin2CfHFGPjEyJBFDLxZdRCKFb13b0ML//fP69vv2+f77//rv6uf77+X09/v2/P/6+fX//fXq6+l3dGwxIxFoRyBgQyRlSSt/Z0uAa1Z+aVR8bFWqnpKflJBnWE9yXk2EbFSijnz06+f89/hoW1NlRidhSChnRyRpRiRkSCZnRh9lSSvi3NXa2Nc4Jg9ZQCBjRyRlRySEdmT4+PjAvbhkSS5YRCVlSClmRilgSSloSB9vUTTd39/W29k7LRZKOCFcRi1oSB9dSCnW1Mzl49trSiNhSiRoSidjRidgSytqSh9xUzDj4dng3+E9KxpALBtSPCpmQyJXPSXb1NHo4t1sSh9nTShnSyhiSCpgSy9sTyphRSLDu6r7//+Lfm41JA9ALRhHMhx6cGn9/v+8t7RqTitlSi9hRSZrTzBiRyxkSixmTS1/alT39ev///atqZ5zbF2loZb8/v749vVsYE5mSitmRy5sTSxtSiJwSylpSilnTCdoSSiLdF7f2tn5/P////////7l39qEcF9qRyUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	check : function(ctx){
		return ctx.host == '8tracks.com';
	},
	execute : function(ctx){
		var self = this;
		var win = ctx.window;
		var page = win.location.href;
		var match = (/8tracks.com\/(.+)\/(.+)(\?|$)/).exec(page);
		var user = match[1];
		var album = match[2];
		
		ctx.document.body.style.cursor = 'progress';
		
		models['8tracks'].getPlaylist(win.mix.id).addCallback(function(tracks){
			ctx.document.body.style.cursor = '';
		
			// プレイリストを表示しダウンロードの開始を確認する
			var msg = 'Start?: ' + user + ' - ' + album + '\n\n' + tracks.map(function(track){
				return track.number + '\t' + track.contributor + ' / ' + track.title;
			}).join('\n');
			
			if(!confirm(msg))
				return;
				
			var dir = createDir(ctx.host + win.location.pathname, getDownloadDir());
			var playlist = dir.clone();
			
			// 処理が途中を表すために先頭にアンダースコアを付加する
			playlist.append('_' + user + ' - ' + album + '.txt');
			putContents(playlist, tracks.map(function(track){
				var album = track.album;
				var album = ['8tracks', user, track.mixName.trim()].join(': ');
				
				return [track.number, track.contributor.trim(), track.title.trim(), album, 'Web', page].join('\t')
			}).join('\n'));
			
			deferredForEach(tracks, function(track){
				var file = dir.clone();
				var ext = track.item.split('.').pop();
				file.append(user + ' - ' + album + ' - ' + track.number.pad(3) + '.' + ext);
				
				return download(track.item, file, true);
			}).addCallback(function(){
				playlist.moveTo(null, playlist.leafName.replace(/^_/, ''));
				
				notify(self.name, 'End: ' + user + ' - ' + album, notify.ICON_DOWNLOAD);
			});
		});
	},
}, '----');
