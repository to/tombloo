Tombloo.Service.actions = new Repository([
	{
		name : getMessage('label.action.changeAcount'),
		execute : function(){
			openDialog('chrome://tombloo/content/library/login.xul', 'resizable,centerscreen');
		},
	},
	{
		name : getMessage('label.action.downloadPosts'),
		execute : function(){
			var users = getPref('updateUsers') || '';
			users = prompt('Update target users:', users);
			if(!users)
				return;
			
			// FIXME: アクション用のprefに
			setPref('updateUsers', users);
			users = users.split(/[\s,]+/);
			
			// プログレス全体のタスク量を決定するため、事前にコールバックチェーンを構成する
			var p = new Progress('Update');
			var d = new Deferred();
			forEach(users, function(user){
				forEach('regular photo video link conversation quote'.split(' '), function(type){
					d.addCallback(
						Tombloo.Service.update, 
						user, 
						type,
						p.addChild(new Progress('Updating ' + user + "'s " + type + ' posts.'), 20));
				});
				d.addCallback(
					Tombloo.Service.Photo.download, 
					user, 
					75,
					p.addChild(new Progress('Downloading ' + user + "'s photos. (75 pixels)")));
				d.addCallback(
					Tombloo.Service.Photo.download, 
					user, 
					500,
					p.addChild(new Progress('Downloading ' + user + "'s photos. (500 pixels)")));
			});
			d.addBoth(p.complete);
			openProgressDialog(p);
			d.callback();
		},
	},
	{
		name : 'Mosaic',
		execute : function(){
			addTab('chrome://tombloo/content/library/Mosaic.html');
		},
	},
	{
		name : '----',
	},
	{
		name : getMessage('label.action.reloadTombloo'),
		execute : function(){
			reload();
		},
	},
	{
		name : getMessage('label.action.tomblooOptions'),
		execute : function(){
			openDialog('chrome://tombloo/content/prefs.xul', 'resizable,centerscreen');
		},
	},
]);

if(AppShellService.hiddenDOMWindow.PicLensContext){
	Tombloo.Service.actions.register({
		name : 'Piclens + Local Tumblr',
		execute : function(){
			var users = Tombloo.Photo.findUsers();
			var user = (users.length<=1)? users[0] : input({'User' : users});
			if(!user)
				return;
			
			var photos = Tombloo.Photo.findByUser({
				user   : user, 
				limit  : 1000, 
				offset : 0, 
				order  : 'date DESC', // 'random()'
			});
			
			// E4Xを使うコードに比べて30倍程度高速
			var items = [];
			photos.forEach(function(photo){
				var imegeUri = createURI(photo.getFile(500)).asciiSpec;
				items.push('<item>' + 
						'<title>' + photo.body.trimTag() + '</title>' +
						'<link>' + photo.url + '</link>' +
						'<guid>' + photo.id + '</guid>' +
						'<media:thumbnail url="' + imegeUri + '" />' +
						'<media:content url="' + imegeUri + '" />' +
					'</item>'
				);
			});
			
			var file = getTempDir('photos.rss');
			putContents(file, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + 
				'<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss"><channel>' +
					items.join('') +
 				'</channel></rss>');
			
			// hiddenDOMWindowを使うとFirefoxがクラッシュした
			// ガベージのことも考慮しコンテンツのウィンドウを利用する
			// location以外の実行では開始されなかった(PicLensの相対パス解決などと関係あり)
			var win = wrappedObject(getMostRecentWindow().content);
			win.location = 'javascript:piclens = new PicLensContext();piclens.launch("' + createURI(file).asciiSpec + '", "", "")';
		},
	}, '----');
}
