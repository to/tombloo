Tombloo.Service.actions.register(	{
	name : 'Download 8tracks',
	type : 'context',
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
