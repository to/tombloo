Tombloo.Service.actions = new Repository([
	{
		type : 'context',
		icon : 'chrome://tombloo/skin/tombloo_16.png',
		name : getMessage('label.action.installPatch'),
		check : function(ctx){
			// GitHubでかつraw以外のリンクの場合は除外する
			// FIXME: より簡易にインストールできるように
			var url = ctx.linkURL;
			return ctx.onLink && 
				(createURI(url).fileExtension == 'js') && 
				!(/github\.com/.test(url) && !/\/raw\//.test(url));
		},
		execute : function(ctx){
			var self = this;
			
			// ファイルタイプを取得しチェックする
			var url;
			return request(ctx.linkURL).addCallback(function(res){
				if(!/^text\/.*(javascript|plain)/.test(res.channel.contentType)){
					alert(getMessage('message.install.invalid'));
					return;
				}
				
				var res = input({
					'message.install.warning' : null,
					'label.install.agree' : false,
				}, 'message.install.warning');
				if(!res || !res['label.install.agree'])
					return;
				
				return download(ctx.linkURL, getPatchDir()).addCallback(function(file){
					// 異常なスクリプトが含まれているとここで停止する
					reload();
					
					notify(self.name, getMessage('message.install.success'), notify.ICON_INFO);
				});
			});
		},
	},
	
	{
		type : 'menu,context',
		name : getMessage('label.action.changeAcount'),
		execute : function(){
			openDialog('chrome://tombloo/content/library/login.xul', 'resizable,centerscreen');
		},
	},
	{
		type : 'menu,context',
		name : '----',
	},
	{
		type : 'menu,context',
		icon : 'chrome://tombloo/skin/tombloo_16.png',
		name : getMessage('label.action.tomblooOptions'),
		execute : function(){
			openDialog('chrome://tombloo/content/prefs.xul', 'resizable,centerscreen');
		},
	},
]);

var openInActionBase = {
	check : function(ctx){
		return true;
	},
	execute : function(ctx){
		var app = this.getFile(getPrefValue(this.prefKey));
		if(!app){
			while(true){
				var path = prompt(this.prompt);
				if(path === null)
					return;
				
				app = this.getFile(path);
				if(app){
					setPrefValue(this.prefKey, path);
					break;
				}
			}
		}
		
		try{
			new Process(app).run(false, [ctx.href], 1);
		}catch(e){
			alert(e);
			setPrefValue(this.prefKey, '');
		}
	},
	getFile : function(path){
		try{
			var file = getLocalFile(path);
			return file.exists() && file.isFile() && file;
		}catch(e){}
	},
}

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
