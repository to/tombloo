Tombloo.Service.actions.register({
	name : 'Download Pixnet',
	type : 'context',
	check : function(ctx){
		return ctx.href.match('pixnet.net/album/set/');
	},
	execute : function(ctx){
		var self = this;
		var c = counter();
		var title = ctx.document.title.split(' :: ')[0];
		var [user, album] = title.split('\u00BB').map(methodcaller('trim'));
		
		var dir = getDownloadDir();
		dir.append('pixnet');
		createDir(dir);
		
		dir.append(user);
		createDir(dir);
		
		dir.append(album);
		createDir(dir);
		
		var srcs = $x('//img[contains(@src, "/thumb_")]/@src', ctx.document, true);
		notify(self.name + ': Start', user + ' - ' + album + ': ' + srcs.length, notify.ICON_INFO);
		deferredForEach(srcs, function(src){
			var file = dir.clone();
			file.append((''+c()).pad(4, '0') + '.jpg');
			
			if(file.exists())
				return succeed();
			
			return download(src.replace('thumb_', ''), file);
		}).addCallback(function(){
			notify(self.name + ': End', user + ' - ' + album, notify.ICON_DOWNLOAD);
		});
	},
}, '----');
