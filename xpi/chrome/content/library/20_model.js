if(typeof(models)=='undefined')
	this.models = models = new Repository();

models.register({
	name : 'FriendFeed',
	ICON : 'http://friendfeed.com/favicon.ico',
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookieString('friendfeed.com', 'U');
	},
	
	getToken : function(){
		return getCookieString('friendfeed.com', 'AT').split('=').pop();
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		var self = this;
		return request('https://friendfeed.com/a/bookmarklet', {
			redirectionLimit : 0,
			sendContent : {
				at      : self.getToken(),
				link    : ps.pageUrl,
				title   : ps.page,
				image0  : ps.type == 'photo'? ps.itemUrl : '',
				comment : joinText([ps.body, ps.description], ' ', true),
			},
		});
	},
});


models.register({
	name : 'Mento',
	ICON : 'http://www.mento.info/favicon.ico',
	
	check : function(ps){
		// キャプチャ(file)はAPIキーを入手後に対応(現在未公開)
		return (/(photo|quote|link)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return this.save({
			title       : ps.page,
			url         : ps.itemUrl,
			tags        : ps.tags,
			private     : ps.private,
			image       : (ps.type == 'photo')? ps.itemUrl : '',
			description : joinText([ps.body? ps.body.wrap('"') : '', ps.description], '\n', true),
		});
	},
	
	getCurrentUser : function(){
		var cookie = getCookies('mento.info', 'mxtu')[0];
		if(!cookie)
			throw new Error(getMessage('error.notLoggedin'));
			
		return cookie.value;
	},
	
	save : function(ps){
		Mento.getCurrentUser();
		
		if(ps.image){
			ps.image0 = ps.media = ps.image;
			delete ps.image;
		}
		
		// quick APIはプライベートなどを保存できなかった
		// http://www.mento.info/post/save/v1/quick
		
		return request('http://www.mento.info/post/save', {
			sendContent : update(ps, {
				src        : 'tombloo',
				action     : 'save',
				save       : 1,
				tags       : joinText(ps.tags, ','),
				local      : this.getLocalTimestamp(),
				private    : ps.private? 1 : 0,
				for_public : ps.private? 0 : 1,
			}),
		});
	},
	
	getLocalTimestamp : function(){
		with(new Date())
			return [getSeconds(), getMinutes(), getHours(), getDate(), getMonth()+1, getFullYear()].join('-'); 
	},
});


models.register({
	name : 'FFFFOUND',
	ICON : 'http://ffffound.com/favicon.ico',
	URL  : 'http://FFFFOUND.com/',
	
	getToken : function(){
		return request(FFFFOUND.URL + 'bookmarklet.js').addCallback(function(res){
			return res.responseText.match(/token ?= ?'(.*?)'/)[1];
		});
	},
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		return this.getToken().addCallback(function(token){
			return request(FFFFOUND.URL + 'add_asset', {
				referrer : ps.pageUrl,
				queryString : {
					token   : token,
					url     : ps.itemUrl,
					referer : ps.pageUrl,
					title   : ps.item,
				},
			}).addCallback(function(res){
				if(res.responseText.match('(FAILED:|ERROR:) +(.*?)</span>'))
					throw new Error(RegExp.$2.trim());
				
				if(res.responseText.match('login'))
					throw new Error(getMessage('error.notLoggedin'));
			});
		});
	},
	
	favor : function(ps){
		return this.iLoveThis(ps.favorite.id)
	},
	
	remove : function(id){
		return request(FFFFOUND.URL + 'gateway/in/api/remove_asset', {
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : id,
			},
		});
	},
	
	iLoveThis : function(id){
		return request(FFFFOUND.URL + 'gateway/in/api/add_asset', {
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : 'i'+id,
				inappropriate : false,
			},
		}).addCallback(function(res){
			var error = res.responseText.extract(/"error":"(.*?)"/);
			if(error == 'AUTH_FAILED')
				throw new Error(getMessage('error.notLoggedin'));
			
			// NOT_FOUND / EXISTS / TOO_BIG
			if(error)
				throw new Error(RegExp.$1.trim());
		});
	},
});

// Flickr API Documentation 
// http://www.flickr.com/services/api/
models.register(update({
	name : 'Flickr',
	ICON : 'http://www.flickr.com/favicon.ico',
	API_KEY : 'ecf21e55123e4b31afa8dd344def5cc5',
	
	check : function(ps){
		return ps.type == 'photo';
	},
	
	post : function(ps){
		return (ps.file? succeed(ps.file) : download(ps.itemUrl, getTempFile())).addCallback(function(file){
			return models.Flickr.upload({
				photo       : file,
				title       : ps.item || ps.page || '',
				description : ps.description || '',
				is_public   : ps.private? 0 : 1,
				tags        : joinText(ps.tags, ' '),
			});
		});
	},
	
	favor : function(ps){
		return this.addFavorite(ps.favorite.id);
	},
	
	callMethod : function(ps){
		return request('http://flickr.com/services/rest/', {
			queryString : update({
				api_key        : this.API_KEY,
				nojsoncallback : 1,
				format         : 'json',
			}, ps),
		}).addCallback(function(res){
			eval('var json=' + res.responseText);
			if(json.stat!='ok')
				throw json.message;
			return json;
		});
	},
	
	callAuthMethod : function(ps){
		return this.getToken().addCallback(function(page){
			if(ps.method=='flickr.photos.upload')
				delete ps.method;
			
			update(ps, page.token);
			ps.cb = new Date().getTime(),
			ps.api_sig = (page.secret + keys(ps).sort().filter(function(key){
				// ファイルを取り除く
				return typeof(ps[key])!='object';
			}).map(function(key){
				return key + ps[key]
			}).join('')).md5();
			
			return request('http://flickr.com/services/' + (ps.method? 'rest/' : 'upload/'), {
				sendContent : ps,
			});
		}).addCallback(function(res){
			res = convertToXML(res.responseText);
			if(res.@stat!='ok'){
				var err = new Error(''+res.err.@msg)
				err.code = res.err.@code;
				
				throw err;
			}
			return res;
		});
	},
	
	getToken : function(){
		var status = this.updateSession();
		switch (status){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request('http://flickr.com/').addCallback(function(res){
				var html = res.responseText;
				return self.token = {
					secret : html.extract(/global_flickr_secret[ =]+'(.*?)'/),
					token  : {
						api_key    : html.extract(/global_magisterLudi[ =]+'(.*?)'/),
						auth_hash  : html.extract(/global_auth_hash[ =]+'(.*?)'/),
						auth_token : html.extract(/global_auth_token[ =]+'(.*?)'/),
					},
				};
			});
		}
	},
	
	addFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.add',
			photo_id : id,
		}).addErrback(function(err){
			switch(err.message){
			case 'Photo is already in favorites': // code = 3
				return;
			}
			
			throw err;
		});
	},
	
	removeFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.remove',
			photo_id : id,
		});
	},
	
	getSizes : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getSizes',
			photo_id : id,
		}).addCallback(function(res){
			return res.sizes.size;
		});
	},
	
	getInfo : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getInfo',
			photo_id : id,
		}).addCallback(function(res){
			return res.photo;
		});
	},
	
	// photo
	// title (optional)
	// description (optional)
	// tags (optional)
	// is_public, is_friend, is_family (optional)
	// safety_level (optional)
	// content_type (optional)
	// hidden (optional)
	upload : function(ps){
		return this.callAuthMethod(update({
			method   : 'flickr.photos.upload',
		}, ps)).addCallback(function(res){
			return ''+res.photoid;
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('flickr.com', 'cookie_accid');
	},
}, AbstractSessionService));

models.register({
	name : 'Picasa',
	ICON : 'http://picasaweb.google.com/favicon.ico',
	URL  : 'http://picasaweb.google.com',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		var self = this;
		return ((ps.file)? 
			succeed(ps.file) : 
			download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))
		).addCallback(function(file){
			return self.upload(file);
		});
	},
	
	/**
	 * 画像をアップロードする。
	 *
	 * @param {File} files 
	 *        画像ファイル。単数または複数(最大5ファイル)。
	 * @param {optional String} user 
	 *        ユーザーID。省略された場合は現在Googleアカウントでログインしていると仮定される。
	 * @param {optional String || Number} album 
	 *        アルバム名称またはアルバムID。
	 *        省略された場合はmodel.picasa.defaultAlbumの設定値か先頭のアルバムとなる。
	 * @param {String || nsIFile || nsIURI} basePath 基点となるパス。
	 */
	upload : function(files, user, album){
		files = [].concat(files);
		
		album = album || getPref('model.picasa.defaultAlbum');
		
		var self = this;
		var user = user || this.getCurrentUser();
		var endpoint;
		return maybeDeferred((typeof(album)=='number')? album : this.getAlbums(user).addCallback(function(albums){
			if(album){
				// 大/小文字が表示されているものと異なる
				for each(var a in albums.feed.entry)
					if(album.match(a.gphoto$name.$t, 'i'))
						return a.gphoto$id.$t;
				throw new Error('Album not found.');
			} else {
				// アルバムが指定されていない場合は先頭のアルバムとする
				return albums.feed.entry[0].gphoto$id.$t;
			}
		})).addCallback(function(aid){
			// トークンを取得しポスト準備をする
			return request(self.URL + '/lh/webUpload', {
				queryString : {
					uname : user,
					aid   : aid,
				}
			}).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				var form = doc.getElementById('lhid_uploadFiles');
				endpoint = resolveRelativePath(form.action, self.URL);
				
				return formContents(form);
			});
		}).addCallback(function(token){
			var ps = {};
			files.forEach(function(file, i){
				ps['file' + i] = file;
			});
			
			return request(endpoint, {
				sendContent : update(token, ps, {
					num : files.length,
				})
			});
		});
	},
	
	getAlbums : function(user){
		user = user || this.getCurrentUser();
		return getJSON('http://picasaweb.google.com/data/feed/back_compat/user/' + user + '?alt=json&kind=album');
	},
	
	getCurrentUser : function(){
		var cookie = getCookies('google.com', 'GAUSR')[0];
		if(!cookie)
			throw new Error(getMessage('error.notLoggedin'));
			
		return cookie.value.split('@').shift();
	},
});

models.register({
	name     : 'Twitpic',
	ICON     : 'http://twitpic.com/favicon.ico',
	POST_URL : 'http://twitpic.com/upload',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		var self = this;
		return ((ps.file)? 
			succeed(ps.file) : 
			download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))
		).addCallback(function(file){
			return self.upload({
				media      : file,
				message    : ps.description,
				post_photo : 1, // Twitterへクロスポスト
			});
		});
	},
	
	upload : function(ps){
		var self = this;
		return this.getToken().addCallback(function(token){
			return request(self.POST_URL + '/process', {
				sendContent : update(token, ps),
			});
		});
	},
	
	getToken : function(){
		var self = this;
		return request(self.POST_URL).addCallback(function(res){
			// 未ログインの場合トップにリダイレクトされる(クッキー判別より安全と判断)
			if(res.channel.URI.asciiSpec != self.POST_URL)
				throw new Error(getMessage('error.notLoggedin'));
			
			var doc = convertToHTMLDocument(res.responseText);
			return {
				form_auth : $x('//input[@name="form_auth"]/@value', doc)
			};
		});
	},
});

models.register({
	name : 'WeHeartIt',
	ICON : 'http://weheartit.com/favicon.ico',
	URL  : 'http://weheartit.com/',
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		return request(this.URL + 'add.php', {
			redirectionLimit : 0,
			referrer : ps.pageUrl,
			queryString : {
				via   : ps.pageUrl,
				title : ps.item,
				img   : ps.itemUrl,
			},
		});
	},
	
	favor : function(ps){
		return this.iHeartIt(ps.favorite.id);
	},
	
	iHeartIt : function(id){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		return request(this.URL + 'inc_heartedby.php', {
			redirectionLimit : 0,
			referrer : this.URL,
			queryString : {
				do    : 'heart',
				entry : id,
			},
		});
	},
	
	getAuthCookie : function(){
		// クッキーの動作が不安定なため2つをチェックし真偽値を返す
		return getCookieString('weheartit.com', 'password') && getCookieString('weheartit.com', 'name');
	},
});

models.register({
	name : '4u',
	ICON : 'data:image/x-icon,%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%10%00%00%00%10%08%03%00%00%00(-%0FS%00%00%00ZPLTE%FF%FF%FF%F9%F9%F9%C3%C3%C3%AE%AE%AE%E7%E7%E7%24%24%24EEE%60%60%60!!!%DE%DE%DEoooZZZWWW%CC%CC%CC%0C%0C%0CKKK%D2%D2%D2fff%06%06%06uuu%D5%D5%D5%1B%1B%1B%93%93%93ccclll%BA%BA%BA%C0%C0%C0%AB%AB%AB%00%00%00%8D%8D%8D2%BF%0C%CD%00%00%00IIDAT%18%95c%60%20%17021%B3%20%F3YX%D9%D898%91%04%B8%B8%D1t%B0%F3%A0%09%F0%F2%F1%0B%A0%8Ap%0A%0A%093%A2%0A%89%88%8A%A1i%13%97%40%E2H%B20H%89J%23%09%08%F3%C9%88%CA%E2w%3A%1E%00%00%E6%DF%02%18%40u1A%00%00%00%00IEND%AEB%60%82',
	URL : 'http://4u.straightline.jp/',
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		return request(this.URL + 'power/manage/register', {
			referrer : ps.pageUrl,
			queryString : {
				site_title  : ps.page,
				site_url    : ps.pageUrl,
				alt         : ps.item,
				src         : ps.itemUrl,
				bookmarklet : 1,
			},
		}).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},
	
	favor : function(ps){
		return this.iLoveHer(ps.favorite.id);
	},
	
	iLoveHer : function(id){
		return request(this.URL + 'user/manage/do_register', {
			redirectionLimit : 0,
			referrer : this.URL,
			queryString : {
				src : id,
			},
		}).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},
});

models.register({
	name : 'Gyazo',
	ICON : 'chrome://tombloo/skin/item.ico',
	
	check : function(ps){
		return ps.type=='photo' && ps.file;
	},
	
	getId : function(){
		var id = getPref('model.gyazo.id');
		if(!id){
			with(new Date()){
				id = getFullYear() + [getMonth()+1, getDate(), getHours(), getMinutes(), getSeconds()].map(function(n){
					return (''+n).pad(2, '0');
				}).join('');
			}
			setPref('model.gyazo.id', id);
		}
		return id;
	},
	
	post : function(ps){
		return request('http://gyazo.com/upload.cgi', {
			sendContent : {
				id        : this.getId(),
				imagedata : ps.file,
			},
		}).addCallback(function(res){
			addTab(res.responseText);
		});
	},
});

models.register({
	name : 'Local',
	ICON : 'chrome://tombloo/skin/local.ico',
	
	check : function(ps){
		return (/(regular|photo|quote|link)/).test(ps.type);
	},
	
	post : function(ps){
		if(ps.type=='photo'){
			return this.Photo.post(ps);
		} else {
			return Local.append(getDataDir(ps.type + '.txt'), ps);
		}
	},
	
	append : function(file, ps){
		putContents(file, joinText([
			joinText([joinText(ps.tags, ' '), ps.item, ps.itemUrl, ps.body, ps.description], '\n\n', true), 
			getContents(file)
		], '\n\n\n'));
		
		return succeed();
	},
	
	Photo : {
		post : function(ps){
			var file = getDataDir('photo');
			createDir(file);
			
			if(ps.file){
				file.append(ps.file.leafName);
			} else {
				var uri = createURI(ps.itemUrl);
				var fileName = validateFileName(uri.fileName);
				file.append(fileName);
			}
			clearCollision(file);
			
			return succeed().addCallback(function(){
				if(ps.file){
					ps.file.copyTo(file.parent, file.leafName);
					return file;
				} else {
					return download(ps.itemUrl, file);
				}
			}).addCallback(function(file){
				if(AppInfo.OS == 'Darwin'){
					var script = getTempDir('setcomment.scpt');
					
					putContents(script, [
						'set aFile to POSIX file ("' + file.path + '" as Unicode text)',
						'set cmtStr to ("' + ps.pageUrl + '" as Unicode text)',
						'tell application "Finder" to set comment of (file aFile) to cmtStr'
					].join('\n'), 'UTF-16');
					
					var process = new Process(new LocalFile('/usr/bin/osascript'));
					process.run(false, [script.path], 1);
				}
			});
		},
	},
	
});

models.register({
	name : 'PingFm',
	ICON : 'http://ping.fm/favicon.ico',

	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		// ログインせずにポストしてもエラーが発生しない
		// クッキーでログインを判別できない
		return request('http://ping.fm/dashboard/').addCallback(function(res){
			// 未ログインか?
			if(res.channel.URI.path == '/login/')
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('http://ping.fm/post/', {
				sendContent : {
					message : joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true),
				},
			});
		})
	}
});

models.register({
	name : 'Twitter',
	ICON : 'http://twitter.com/favicon.ico',
	URL  : 'https://twitter.com',
	SHORTEN_SERVICE : 'bit.ly',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return this.update(joinText([ps.description, (ps.body)? '"' + ps.body + '"' : '', ps.item, ps.itemUrl], ' '));
	},
	
	update : function(status){
		var self = this;
		var POST_URL = self.URL + '/status/update';
		
		return maybeDeferred((status.length < 140)? 
			status : 
			shortenUrls(status, models[this.SHORTEN_SERVICE])
		).addCallback(function(shortend){
			status = shortend;
			
			return Twitter.getToken();
		}).addCallback(function(token){
			token.status = status;
			
			return request(POST_URL, {
				sendContent : token,
			});
		}).addCallback(function(res){
			// ホームにリダイレクトされなかった場合はエラー発生とみなす
			if(res.channel.URI.asciiSpec == POST_URL)
				throw new Error('Error');
			
			var msg = res.responseText.extract(/"flashNotice":"(.*?)"/);
			if(msg)
				throw unescapeHTML(msg).trimTag();
		});
	},
	
	favor : function(ps){
		return this.addFavorite(ps.favorite.id);
	},
	
	getToken : function(){
		return request(this.URL + '/account/settings').addCallback(function(res){
			var html = res.responseText;
			if(~html.indexOf('class="signin"'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return {
				authenticity_token : html.extract(/authenticity_token.+value="(.+?)"/),
				siv                : html.extract(/logout\?siv=(.+?)"/),
			}
		});
	},
	
	changePicture : function(url){
		var self = this;
		return ((url instanceof IFile)? succeed(url) : download(url, getTempDir())).addCallback(function(file){
			return request(self.URL + '/account/settings').addCallback(function(res){
				var form = convertToHTMLDocument(res.responseText).getElementById('account_settings_form');
				var ps = formContents(form);
				var endpoint = self.URL + '/settings/profile';
				return request(endpoint, {
					referrer : endpoint,
					sendContent : update(ps, {
						'profile_image[uploaded_data]' : file,
					}),
				});
			});
		});
	},
	
	remove : function(id){
		var self = this;
		return Twitter.getToken().addCallback(function(ps){
			ps._method = 'delete';
			return request(self.URL + '/status/destroy/' + id, {
				redirectionLimit : 0,
				referrer : self.URL + '/',
				sendContent : ps,
			});
		});
	},
	
	addFavorite : function(id){
		var self = this;
		return Twitter.getToken().addCallback(function(ps){
			return request(self.URL + '/favourings/create/' + id, {
				redirectionLimit : 0,
				referrer : self.URL + '/',
				sendContent : ps,
			});
		});
	},
	
	getRecipients : function(){
		var self = this;
		return request(this.URL + '/direct_messages/recipients_list?twttr=true').addCallback(function(res){
			return map(function([id, name]){
				return {id:id, name:name};
			}, evalInSandbox('(' + res.responseText + ')', self.URL));
		});
	},
});


models.register(update({
	name : 'Plurk',
	ICON : 'http://www.plurk.com/static/favicon.png',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return Plurk.addPlurk(
			':',
			joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true)
		);
	},
	
	addPlurk : function(qualifier, content){
		return Plurk.getToken().addCallback(function(token){
			return request('http://www.plurk.com/TimeLine/addPlurk', {
				redirectionLimit : 0,
				sendContent : update(token, {
					qualifier : qualifier,
					content   : content,
				}),
			});
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('plurk.com', 'plurkcookiea').extract(/user_id=(.+)/);
	},
	
	getToken : function(){
		var status = this.updateSession();
		switch (status){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request('http://www.plurk.com/').addCallback(function(res){
				return self.token = {
					uid : res.responseText.extract(/"user_id": (.+?),/)
				};
			});
		}
	},
}, AbstractSessionService));

models.register({
	name : 'Google',
	ICON : 'http://www.google.com/favicon.ico',
});

// copied from http://userscripts.org/scripts/show/19741
models.register({
	name : 'GoogleWebHistory',
	ICON : models.Google.ICON,
	
	getCh : function(url){
		function r(x,y){
			return Math.floor((x/y-Math.floor(x/y))*y+.1);
		}
		function m(c){
			var i,j,s=[13,8,13,12,16,5,3,10,15];
			for(i=0;i<9;i+=1){
				j=c[r(i+2,3)];
				c[r(i,3)]=(c[r(i,3)]-c[r(i+1,3)]-j)^(r(i,3)==1?j<<s[i]:j>>>s[i]);
			}
		}
		
		return (this.getCh = function(url){
			url='info:'+url;
			
			var c = [0x9E3779B9,0x9E3779B9,0xE6359A60],i,j,k=0,l,f=Math.floor;
			for(l=url.length ; l>=12 ; l-=12){
				for(i=0 ; i<16 ; i+=1){
					j=k+i;c[f(i/4)]+=url.charCodeAt(j)<<(r(j,4)*8);
				}
				m(c);
				k+=12;
			}
			c[2]+=url.length;
			
			for(i=l;i>0;i--)
				c[f((i-1)/4)]+=url.charCodeAt(k+i-1)<<(r(i-1,4)+(i>8?1:0))*8;
			m(c);
			
			return'6'+c[2];
		})(url);
	},
	
	post : function(url){
		return request('http://www.google.com/search?client=navclient-auto&ch=' + GoogleWebHistory.getCh(url) + '&features=Rank&q=info:' + escape(url));
	},
});

models.register({
	name : 'GoogleBookmarks',
	ICON : models.Google.ICON,
	POST_URL : 'https://www.google.com/bookmarks/mark',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request(this.POST_URL, {
			queryString : {
				op     : 'edit',
				output : 'popup',
			},
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(doc.getElementById('gaia_loginform'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('https://www.google.com' + $x('//form[@name="add_bkmk_form"]/@action', doc), {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					title      : ps.item,
					bkmk       : ps.itemUrl,
					annotation : joinText([ps.body, ps.description], ' ', true),
					labels     : joinText(ps.tags, ','),
				}),
			});
		});
	},
	
	getEntry : function(url){
		return request(this.POST_URL, {
			queryString : {
				op     : 'edit',
				output : 'popup',
				bkmk   : url,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var form = formContents(doc);
			return {
				saved       : (/(edit|編集)/i).test($x('//h1/text()', doc)),
				item        : form.title,
				tags        : form.labels.split(/,/).map(methodcaller('trim')),
				description : form.annotation,
			};
		});
	},
	
	getUserTags : function(){
		return request('https://www.google.com/bookmarks/api/bookmark', {
			queryString : {
				op : 'LIST_LABELS',
			}
		}).addCallback(function(res){
			var data = JSON.parse(res.responseText);
			return zip(data['labels'], data['counts']).map(function(pair){
				return {
					name      : pair[0],
					frequency : pair[1],
				};
			});
		});
	},
	
	getSuggestions : function(url){
		var self = this;
		return new DeferredHash({
			tags  : self.getUserTags(),
			entry : self.getEntry(url),
		}).addCallback(function(ress){
			var entry = ress.entry[1];
			var tags = ress.tags[1];
			return {
				form        : entry.saved? entry : null,
				tags        : tags,
				duplicated  : entry.saved,
				recommended : [],
				editPage    : self.POST_URL + '?' + queryString({
					op   : 'edit',
					bkmk : url
				}),
			};
		});
	},
});

models.register({
	name : 'GoogleCalendar',
	ICON : 'http://calendar.google.com/googlecalendar/images/favicon.ico',
	
	check : function(ps){
		return (/(regular|link)/).test(ps.type) && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookieString('www.google.com', 'secid').split('=').pop();
	},
	
	post : function(ps){
		if(ps.item && (ps.itemUrl || ps.description)){
			return this.addSchedule(ps.item, joinText([ps.itemUrl, ps.body, ps.description], '\n'), ps.date);
		} else {
			return this.addSimpleSchedule(ps.description);
		}
	},
	
	addSimpleSchedule : function(description){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		var endpoint = 'http://www.google.com/calendar/m';
		return request(endpoint, {
			queryString : {
				hl : 'en',
			},
		}).addCallback(function(res){
			// form.secidはクッキー内のsecidとは異なる
			var form = formContents(res.responseText);
			return request(endpoint, {
				redirectionLimit : 0,
				sendContent: {
					ctext  : description,
					secid  : form.secid,
					as_sdt : form.as_sdt,
				},
			});
		});
	},
	
	addSchedule : function(title, description, from, to){
		from = from || new Date();
		to = to || new Date(from.getTime() + (86400 * 1000));
		
		return request('http://www.google.com/calendar/event', {
				queryString : {
					action  : 'CREATE', 
					secid   : this.getAuthCookie(), 
					dates   : from.toLocaleFormat('%Y%m%d') + '/' + to.toLocaleFormat('%Y%m%d'),
					text    : title, 
					details : description,
					sf      : true,
					crm     : 'AVAILABLE',
					icc     : 'DEFAULT',
					output  : 'js',
					scp     : 'ONE',
				}
		});
	},
});


models.register({
	name     : 'Evernote',
	ICON     : 'http://www.evernote.com/favicon.ico',
	POST_URL : 'https://www.evernote.com/clip.action',
	 
	check : function(ps){
		return (/(regular|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		var self = this;
		ps = update({}, ps);
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		var d = succeed();
		if(ps.type=='link' && !ps.body && getPref('model.evernote.clipFullPage')){
			d = request(ps.itemUrl).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				ps.body = convertToHTMLString(doc.documentElement, true);
			});
		}
		
		return d.addCallback(function(){
			return self.getToken();
		}).addCallback(function(token){
			return request(self.POST_URL, {
				redirectionLimit : 0,
				sendContent : update(token, {
					saveQuicknote : 'save',
					format        : 'microclip',
					
					url      : ps.itemUrl,
					title    : ps.item || 'no title',
					comment  : ps.description,
					body     : getFlavor(ps.body, 'html'),
					tags     : joinText(ps.tags, ','),
					fullPage : (ps.body)? 'true' : 'false',
				}),
			});
		}).addBoth(function(res){
			// 正常終了していない可能性を考慮(ステータスコード200で失敗していた)
			if(res.status != 302)
				throw new Error('An error might occur.');
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('evernote.com', 'auth');
	},
	
	getToken : function(){
		return request(this.POST_URL, {
			sendContent: {
				format    : 'microclip', 
				quicknote : 'true'
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				_sourcePage   : $x('//input[@name="_sourcePage"]/@value', doc),
				__fp          : $x('//input[@name="__fp"]/@value', doc),
				noteBookGuide : $x('//select[@name="notebookGuid"]//option[@selected="selected"]/@value', doc),
			};
		});
	},
});

models.register(update({
	name : 'Pinboard',
	ICON : 'http://pinboard.in/favicon.ico',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	getCurrentUser : function(){
		var cookie = getCookies('pinboard.in', 'login')[0];
		if(!cookie)
			throw new Error(getMessage('error.notLoggedin'));
		
		return cookie.value;
	},
	
	post : function(ps){
		var self = this;
		return succeed().addCallback(function(){
			self.getCurrentUser();
			
			return request('https://pinboard.in/add', {
				queryString : {
					title : ps.item,
					url   : ps.itemUrl,
				}
			})
		}).addCallback(function(res){
			var form = formContents(res.responseText);
			return request('https://pinboard.in/add', {
				sendContent : update(form, {
					title       : ps.item,
					url         : ps.itemUrl,
					description : joinText([ps.body, ps.description], ' ', true),
					tags        : joinText(ps.tags, ' '),
					private     : 
						(ps.private == null)? form.private : 
						(ps.private)? 'on' : '',
				}),
			});
		});
	},
	
	getUserTags : function(){
		var self = this;
		return succeed().addCallback(function(){
			self.getCurrentUser();
			
			return request('https://pinboard.in/user_tag_list/');
		}).addCallback(function(res){
			return evalInSandbox(
				res.responseText, 
				'https://pinboard.in/'
			).usertags.map(function(tag){
				// 数字のみのタグが数値型になり並べ替え時の比較で失敗するのを避ける
				return {
					name      : ''+tag,
					frequency : 0,
				}
			});
		});
	},
	
	getRecommendedTags : function(url){
		return request('https://pinboard.in/ajax_suggest', {
			queryString : {
				url : url,
			}
		}).addCallback(function(res){
			// 空配列ではなく、空文字列が返ることがある
			return res.responseText? 
				evalInSandbox(res.responseText, 'https://pinboard.in/').map(function(tag){
					// 数字のみのタグが数値型になるのを避ける
					return ''+tag;
				}) : [];
		});
	},
	
	getSuggestions : function(url){
		var self = this;
		var ds = {
			tags        : this.getUserTags(),
			recommended : this.getRecommendedTags(url),
			suggestions : succeed().addCallback(function(){
				self.getCurrentUser();
				
				return request('https://pinboard.in/add', {
					queryString : {
						url : url,
					}
				});
			}).addCallback(function(res){
				var form = formContents(res.responseText);
				return {
					editPage : 'https://pinboard.in/add?url=' + url,
					form : {
						item        : form.title,
						description : form.description,
						tags        : form.tags.split(' '),
						private     : !!form.private,
					},
					
					// 入力の有無で簡易的に保存済みをチェックする
					// (submitボタンのラベルやalertの有無でも判定できる)
					duplicated : !!(form.tags || form.description),
				}
			})
		};
		
		return new DeferredHash(ds).addCallback(function(ress){
			var res = ress.suggestions[1];
			res.recommended = ress.recommended[1]; 
			res.tags = ress.tags[1];
			
			return res;
		});
	},
}));

models.register(update({}, AbstractSessionService, {
	name : 'Delicious',
	ICON : 'http://www.delicious.com/favicon.ico',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		var self = this;
		return this.getCurrentUser().addCallback(function(){
			return request('http://www.delicious.com/save', {
				queryString : {
					title : ps.item,
					url   : ps.itemUrl,
				}
			})
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var form = {};
			items(formContents(doc.documentElement)).forEach(function([key, value]){
				form[key.replace(/[A-Z]/g, function(c){
					return '_' + c.toLowerCase()
				})] = value;
			});
			
			return request('http://www.delicious.com/save', {
				sendContent : update(form, {
					title   : ps.item,
					url     : ps.itemUrl,
					note    : joinText([ps.body, ps.description], ' ', true),
					tags    : joinText(ps.tags, ','),
					private : ps.private,
				}),
			});
		}).addCallback(function(res){
			res = JSON.parse(res.responseText);
			
			if(res.error)
				throw new Error(res.error_msg);
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('www.delicious.com', 'deluser');
	},
	
	getCurrentUser : function(){
		var self = this;
		return this.getSessionValue('user', function(){
			return self.getInfo().addCallback(function(info){
				if(!info.is_logged_in)
					throw new Error(getMessage('error.notLoggedin'));
				
				return info.logged_in_username;
			});
		});
	},
	
	getInfo : function(){
		return request('http://delicious.com/save/quick', {method : 'POST'}).addCallback(function(res){
			return evalInSandbox('(' + res.responseText + ')', 'http://delicious.com/');
		});
	},
	
	/**
	 * ユーザーの利用しているタグ一覧を取得する。
	 *
	 * @param {String} user 対象ユーザー名。未指定の場合、ログインしているユーザー名が使われる。
	 * @return {Array}
	 */
	getUserTags : function(user){
		// 同期でエラーが起きないようにする
		var d = (user)? succeed(user) : Delicious.getCurrentUser();
		return d.addCallback(function(user){
			return request('http://feeds.delicious.com/v2/json/tags/' + user);
		}).addCallback(function(res){
			var tags = JSON.parse(res.responseText);
			
			// タグが無いか?(取得失敗時も発生)
			if(!tags || isEmpty(tags))
				return [];
			
			return reduce(function(memo, tag){
				memo.push({
					name      : tag[0],
					frequency : tag[1],
				});
				return memo;
			}, tags, []);
		}).addErrback(function(err){
			// Delicious移管によりfeedが停止されタグの取得に失敗する
			// 再開時に動作するように接続を試行し、失敗したら空にしてエラーを回避する
			error(err);
			
			return [];
		});
	},
	
	/**
	 * タグ、おすすめタグ、ネットワークなどを取得する。
	 * ブックマーク済みでも取得できる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		var self = this;
		var ds = {
			tags : this.getUserTags(),
			suggestions : this.getCurrentUser().addCallback(function(){
				// フォームを開いた時点でブックマークを追加し過去のデータを修正可能にするか?
				// 過去データが存在すると、お勧めタグは取得できない
				// (現時点で保存済みか否かを確認する手段がない)
				return getPref('model.delicious.prematureSave')? 
					request('http://www.delicious.com/save', {
						queryString : {
							url : url,
						}
					}) : 
					request('http://www.delicious.com/save/confirm', {
						queryString : {
							url   : url,
							isNew : true,
						}
					});
			}).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return {
					editPage : 'http://www.delicious.com/save?url=' + url,
					form : {
						item        : doc.getElementById('saveTitle').value,
						description : doc.getElementById('saveNotes').value,
						tags        : doc.getElementById('saveTags').value.split(','),
						private     : doc.getElementById('savePrivate').checked,
					},
					
					duplicated : !!doc.querySelector('.saveFlag'),
					recommended : $x('id("recommendedField")//a[contains(@class, "m")]/text()', doc, true), 
				}
			})
		};
		
		return new DeferredHash(ds).addCallback(function(ress){
			var res = ress.suggestions[1];
			res.tags = ress.tags[1];
			return res;
		});
	},
}));

models.register({
	name : 'Digg',
	ICON : 'http://cdn1.diggstatic.com/img/favicon.ico',
	
	check : function(ps){
		return ps.type=='link';
	},
	
	post : function(ps){
		return Digg.dig(ps.item, ps.itemUrl);
	},
	
	dig : function(title, url){
		var url = 'http://digg.com/submit?' + queryString({
			phase : 2,
			url   : url,
			title : title, 
		});
		
		return request(url).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('digg.com/register/'))
				throw new Error(getMessage('error.notLoggedin'));
			
			var html = res.responseText;
			var pagetype = html.extract(/var pagetype ?= ?"(.+?)";/);
			
			// 誰もdigしていなかったらフォームを開く(CAPTCHAがあるため)
			// 一定時間後にページ遷移するためdescriptionを設定するのが難しい
			if(pagetype=='other')
				return addTab(url, true);
			
			var matches = (/javascript:dig\((.+?),(.+?),'(.+?)'\)/).exec(html);
			return request('http://digg.com/diginfull', {
				sendContent : {
					id       : matches[2],
					row      : matches[1],
					digcheck : matches[3],
					type     : 's',
					loc      : pagetype,
				},
			});
		});
	},
});

models.register(update({}, AbstractSessionService, {
	name : 'StumbleUpon',
	ICON : 'http://www.stumbleupon.com/favicon.ico',
	
	check : function(ps){
		return ps.type=='link';
	},
	
	post : function(ps){
		return this.iLikeIt(ps.item, ps.itemUrl, ps.description);
	},
	
	iLikeIt : function(title, url, comment){
		var username;
		return StumbleUpon.getCurrentId().addCallback(function(id){
			username = id;
			
			return StumbleUpon.getCurrentPassword();
		}).addCallback(function(password){
			return request('http://www.stumbleupon.com/rate.php', {
				queryString : {
					username : username,
				},
				sendContent : {
					rating   : 1,
					username : username,
					password : ('StumbleUpon public salt' + username + password).sha1(),
					url      : url,
					yr       : 0,
					yts      : 0,
					yhd      : 0,
					ycur_q   : 0,
					ycur_t   : '',
					ycur_s   : '',
					ypre_q   : 0,
					ypre_t   : '',
					ypre_s   : '',
					version  : 'mozbar 3.26 xpi',
				},
			});
		}).addCallback(function(res){
			if(/NEWURL/.test(res.responseText))
				return addTab('http://www.stumbleupon.com/newurl.php?' + queryString({
					title   : title,
					url     : url,
					rating  : 1,
					referer : url,
				}), true).addCallback(function(win){
					$x('id("searchtext")', win.document).value = comment;
				});
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('stumbleupon.com', 'PHPSESSID');
	},
	
	getCurrentUser : function(){
		return this.getSessionValue('user', function(){
			return request('http://www.stumbleupon.com/').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				var user = $x('id("t-home")/a/@href', doc).extract('http://(.+?)\.stumbleupon\.com');
				if(user=='www')
					throw new Error(getMessage('error.notLoggedin'));
				
				return user;
			});
		});
	},
	
	getCurrentId : function(){
		return this.getSessionValue('id', function(){
			var ps = {};
			return succeed().addCallback(function(){
				return StumbleUpon.getCurrentUser();
			}).addCallback(function(user){
				ps.username = user;
				
				return StumbleUpon.getCurrentPassword();
			}).addCallback(function(password){
				ps.password = password;
				
				return request('https://www.stumbleupon.com/userexists.php', {
					sendContent : ps,
				});
			}).addCallback(function(res){
				return res.responseText.extract(/USER (.+)/);
			});
		});
	},
	
	getCurrentPassword : function(user){
		return this.getSessionValue('password', function(){
			return StumbleUpon.getCurrentUser().addCallback(function(user){
				var passwords = getPasswords('http://www.stumbleupon.com', user);
				if(!passwords.length)
					throw new Error(getMessage('error.passwordNotFound'));
				
				return passwords[0].password;
			});
		});
	},
}));

models.register({
	name : 'FirefoxBookmark',
	ICON : 'chrome://tombloo/skin/firefox.ico',
	ANNO_DESCRIPTION : 'bookmarkProperties/description',
	
	check : function(ps){
		return ps.type == 'link';
	},
	
	post : function(ps){
		return succeed(this.addBookmark(ps.itemUrl, ps.item, ps.tags, ps.description));
	},
	
	addBookmark : function(uri, title, tags, description){
		var bs = NavBookmarksService;
		
		var folder;
		var index = bs.DEFAULT_INDEX;
		
		// ハッシュタイプの引数か?
		if(typeof(uri)=='object' && !(uri instanceof IURI)){
			if(uri.index!=null)
				index = uri.index;
			
			folder = uri.folder;
			title = uri.title;
			tags = uri.tags;
			description = uri.description;
			uri = uri.uri;
		}
		
		uri = createURI(uri);
		tags = tags || [];
		
		// フォルダが未指定の場合は未整理のブックマークになる
		folder = (!folder)? 
			bs.unfiledBookmarksFolder : 
			this.createFolder(folder);
		
		// 同じフォルダにブックマークされていないか?
		if(!bs.getBookmarkIdsForURI(uri, {}).some(function(item){
			return bs.getFolderIdForItem(item) == folder;
		})){
			var folders = [folder].concat(tags.map(bind('createTag', this)));
			folders.forEach(function(folder){
				bs.insertBookmark(
					folder, 
					uri,
					index,
					title);
			});
		}
		
		this.setDescription(uri, description);
	},
	
	getBookmark : function(uri){
		uri = createURI(uri);
		var item = this.getBookmarkId(uri);
		if(item)
			return {
				title       : NavBookmarksService.getItemTitle(item),
				uri         : uri.asciiSpec,
				description : this.getDescription(item),
			};
	},
	
	isBookmarked : function(uri){
		return this.getBookmarkId(uri) != null;
		
		// 存在しなくてもtrueが返ってくるようになり利用できない
		// return NavBookmarksService.isBookmarked(createURI(uri));
	},
	
	isVisited : function(uri) {
		try{
			var query = NavHistoryService.getNewQuery();
			var options = NavHistoryService.getNewQueryOptions();
			query.uri = createURI(uri);
			
			var root = NavHistoryService.executeQuery(query, options).root;
			root.containerOpen = true;
			
			return !!root.childCount;
		} catch(e) {
			return false;
		} finally {
			root.containerOpen = false;
		}
	},
	
	removeBookmark : function(uri){
		this.removeItem(this.getBookmarkId(uri));
	},
	
	removeItem : function(itemId){
		NavBookmarksService.removeItem(itemId);
	},
	
	getBookmarkId : function(uri){
		if(typeof(uri)=='number')
			return uri;
		
		uri = createURI(uri);
		return NavBookmarksService.getBookmarkIdsForURI(uri, {}).filter(function(item){
			while(item = NavBookmarksService.getFolderIdForItem(item))
				if(item == NavBookmarksService.tagsFolder)
					return false;
			
			return true;
		})[0];
	},
	
	getDescription : function(uri){
		try{
			return AnnotationService.getItemAnnotation(this.getBookmarkId(uri), this.ANNO_DESCRIPTION);
		} catch(e){
			return '';
		}
	},
	
	setDescription : function(uri, description){
		if(description == null)
			return;
		
		description = description || '';
		try{
			AnnotationService.setItemAnnotation(this.getBookmarkId(uri), this.ANNO_DESCRIPTION, description, 
				0, AnnotationService.EXPIRE_NEVER);
		} catch(e){}
	},
	
	createTag : function(name){
		return this.createFolder(name, NavBookmarksService.tagsFolder);
	},
	
	/*
	NavBookmarksServiceに予め存在するフォルダID
		placesRoot
		bookmarksMenuFolder
		tagsFolder
		toolbarFolder
		unfiledBookmarksFolder
	*/
	
	/**
	 * フォルダを作成する。
	 * 既に同名のフォルダが同じ場所に存在する場合は、新たに作成されない。
	 *
	 * @param {String} name フォルダ名称。
	 * @param {Number} parentId 
	 *        フォルダの追加先のフォルダID。省略された場合ブックマークメニューとなる。
	 * @return {Number} 作成されたフォルダID。
	 */
	createFolder : function(name, parentId){
		parentId = parentId || NavBookmarksService.bookmarksMenuFolder;
		
		return this.getFolder(name, parentId) ||
			NavBookmarksService.createFolder(parentId, name, NavBookmarksService.DEFAULT_INDEX);
	},
	
	/**
	 * フォルダIDを取得する。
	 * 既に同名のフォルダが同じ場所に存在する場合は、新たに作成されない。
	 *
	 * @param {String} name フォルダ名称。
	 * @param {Number} parentId 
	 *        フォルダの追加先のフォルダID。省略された場合ブックマークメニューとなる。
	 */
	getFolder : function(name, parentId) {
		parentId = parentId || NavBookmarksService.bookmarksMenuFolder;
		
		let query = NavHistoryService.getNewQuery();
		let options = NavHistoryService.getNewQueryOptions();
		query.setFolders([parentId], 1);
		
		let root = NavHistoryService.executeQuery(query, options).root;
		try{
			root.containerOpen = true;
			for(let i=0, len=root.childCount; i<len; ++i){
				let node = root.getChild(i);
				if(node.type === node.RESULT_TYPE_FOLDER && node.title === name)
					return node.itemId;
			}
		} finally {
			root.containerOpen = false;
		}
	},
});


models.register({
	name : 'ReadItLater',
	ICON : 'http://readitlaterlist.com/favicon.ico',
	check : function(ps){
		return /quote|link/.test(ps.type);
	},
	post : function(ps){
		return request('http://readitlaterlist.com/edit').addCallback(function(res) {
			var doc = convertToHTMLDocument(res.responseText);
			var form = $x('id("content")/form', doc);
			if(/login/.test(form.action))
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('http://readitlaterlist.com/edit_process.php', {
				queryString: {
					BL : 1
				},
				sendContent: update(formContents(form), {
					tags  : ps.tags? ps.tags.join(',') : '',
					title : ps.item,
					url   : ps.itemUrl
				})
			});
		});
	}
});


models.register(update({
	name : 'Instapaper',
	ICON : 'chrome://tombloo/skin/instapaper.ico',
	POST_URL: 'http://www.instapaper.com/edit',
	check : function(ps){
		return (/(quote|link)/).test(ps.type);
	},
	
	getAuthCookie : function(){
		return getCookieString('www.instapaper.com', 'pfu');
	},
	
	post : function(ps){
		var url = this.POST_URL;
		return this.getSessionValue('token', function(){
			return request(url).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return $x('//input[@id="form_key"]/@value', doc);
			});
		}).addCallback(function(token){
			return request(url, {
				redirectionLimit: 0,
				sendContent: {
					'form_key': token,
					'bookmark[url]': ps.itemUrl,
					'bookmark[title]': ps.item,
					'bookmark[selection]': joinText([ps.body, ps.description])
				}
			});
		});
	}
}, AbstractSessionService));


models.register({
	name : 'Remember The Milk',
	ICON : 'http://www.rememberthemilk.com/favicon.ico',
	POST_URL: 'http://www.rememberthemilk.com/services/ext/addtask.rtm',
	
	check : function(ps){
		return (/(regular|link)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return this.addSimpleTask(
			joinText([ps.item, ps.body, ps.description], ' ', true), 
			ps.date, ps.tags);
	},
	
	/**
	 * 簡単なタスクを追加する。
	 * ブックマークレットのフォーム相当の機能を持つ。
	 *
	 * @param {String} task タスク名。
	 * @param {Date} due 期日。未指定の場合、当日になる。
	 * @param {Array} tags タグ。
	 * @param {String || Number} list 
	 *        追加先のリスト。リスト名またはリストID。未指定の場合、デフォルトのリストとなる。
	 */
	addSimpleTask : function(task, due, tags, list){
		var self = this;
		return request(self.POST_URL).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(!doc.getElementById('miniform'))
				throw new Error(getMessage('error.notLoggedin'));
			
			var form = formContents(doc);
			if(list){
				forEach($x('id("l")/option', doc, true), function(option){
					if(option.textContent == list){
						list = option.value;
						throw StopIteration;
					}
				})
				form.l = list;
			}
			
			return request(self.POST_URL, {
				sendContent : update(form, {
					't'  : task,
					'tx' : joinText(tags, ','),
					'd'  : (due || new Date()).toLocaleFormat('%Y-%m-%d'),
				}),
			});
		});
	}
});


// http://www.kawa.net/works/ajax/romanize/japanese.html
models.register({
	name : 'Kawa',
	
	getRomaReadings : function(text){
		return request('http://www.kawa.net/works/ajax/romanize/romanize.cgi', {
			queryString : {
				// mecab-utf8
				// japanese
				// kana
				mode : 'japanese',
				q : text,
			},
		}).addCallback(function(res){
			return map(function(s){
				return ''+s.@title || ''+s;
			}, convertToXML(res.responseText).li.span);
		});
	},
});


// http://developer.yahoo.co.jp/jlp/MAService/V1/parse.html
models.register({
	name : 'Yahoo',
	APP_ID : '16y9Ex6xg64GBDD.tmwF.WIdXURG0iTT25NUQ72RLF_Jzt2_MfXDDZfKehYkX6dPZqk-',
	
	parse : function(ps){
		ps.appid = this.APP_ID;
		return request('http://jlp.yahooapis.jp/MAService/V1/parse', {
			charset     : 'utf-8',
			sendContent : ps
		}).addCallback(function(res){
			return convertToXML(res.responseText);
		});
	},
	
	getKanaReadings : function(str){
		return this.parse({
			sentence : str,
			response : 'reading',
		}).addCallback(function(res){
			return list(res.ma_result.word_list.word.reading);
		});
	},
	
	getRomaReadings : function(str){
		return this.getKanaReadings(str).addCallback(function(rs){
			return rs.join('\u0000').toRoma().split('\u0000');
		});
	},
});


models.register({
	name : 'YahooBookmarks',
	ICON : 'http://bookmarks.yahoo.co.jp/favicon.ico',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('http://bookmarks.yahoo.co.jp/action/post').addCallback(function(res){
			if(res.responseText.indexOf('login_form')!=-1)
				throw new Error(getMessage('error.notLoggedin'));
			
			return formContents($x('(id("addbookmark")//form)[1]', convertToHTMLDocument(res.responseText)));
		}).addCallback(function(fs){
			return request('http://bookmarks.yahoo.co.jp/action/post/done', {
				redirectionLimit : 0,
				sendContent  : {
					title      : ps.item,
					url        : ps.itemUrl,
					desc       : joinText([ps.body, ps.description], ' ', true),
					tags       : joinText(ps.tags, ' '),
					crumbs     : fs.crumbs,
					visibility : ps.private==null? fs.visibility : (ps.private? 0 : 1),
				},
			});
		});
	},
	
	/**
	 * タグ、おすすめタグを取得する。
	 * ブックマーク済みでも取得することができる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		return request('http://bookmarks.yahoo.co.jp/bookmarklet/showpopup', {
			queryString : {
				u : url,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(!$x('id("bmtsave")', doc))
				throw new Error(getMessage('error.notLoggedin'));
			
			function getTags(part){
				return evalInSandbox(unescapeHTML(res.responseText.extract(RegExp('^' + part + ' ?= ?(.+)(;|$)', 'm'))), 'http://bookmarks.yahoo.co.jp/') || [];
			}
			
			return {
				duplicated : !!$x('//input[@name="docid"]', doc),
				popular : getTags('rectags'),
				tags : getTags('yourtags').map(function(tag){
					return {
						name      : tag,
						frequency : -1,
					}
				}),
			};
		});
	},
});

models.register({
	name : 'Faves',
	ICON : 'http://faves.com/favicon.ico',
	
	/**
	 * タグを取得する。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		// 同期でエラーが起きないようにする
		return succeed().addCallback(function(){
			return request('https://secure.faves.com/v1/tags/get');
		}).addCallback(function(res){
			return {
				duplicated : false,
				tags : reduce(function(memo, tag){
					memo.push({
						name      : tag.@tag,
						frequency : tag.@count,
					});
					return memo;
				}, convertToXML(res.responseText).tag, []),
			};
		});
	},
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('https://secure.faves.com/v1/posts/add', {
			queryString : {
				url         : ps.itemUrl,
				description : ps.item,
				shared      : ps.private? 'no' : '',  
				tags        : joinText(ps.tags, ' '),
				extended    : joinText([ps.body, ps.description], ' ', true),
			},
		});
	},
});

models.register({
	name : 'Snipshot',
	// ICON : 'http://snipshot.com/favicon.ico',
	ICON : "data:image/png,%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%10%00%00%00%10%08%06%00%00%00%1F%F3%FFa%00%00%00%04gAMA%00%00%AF%C87%05%8A%E9%00%00%00%19tEXtSoftware%00Adobe%20ImageReadyq%C9e%3C%00%00%01%E9IDATx%DAbd%00%82%D0%5D%92%FF%BF%FF%F9%C2%80%0E%D8%988%18%D6%BA%BFbX%7F%7F%12%C3%BC%1B5%60%B1%CD%9E%9F%18%7C%B7%F31%B01s2%ACs%7F%C5%08%10%40LA%3B%C5%B0j%06%01G%E9%080%BD%F2N%17%5C%EC%DB%9F%CF%0C%12%5C%0A%0C%BF%FE~%07%5B%0C%10%40L%20%06.%F0%FA%FBc0%9D%A0%D1%04%A6%F9%D8%84%19%B8Xx%19%3E%FC%7C%05%E6%83%2C%06%08%20%16%06%3C%E0%DC%9B%BD%60%DAC6%09%8CA%E0%F4%EB%9D%0C%3F%FE~%83%AB%01%08%20%BC%06%04*%E6%C1%D9w%3E%5E%60%98z5%8F%C1X%C4%0D%1C%0E0%00%10%40x%0DH%D2h%81%B3%0B%8F%D9%01%F9%AD%40Cs%19%EE%7F%BE%CC0%FFF-%83%81%88%23%03%40%00%E14%C0K.%05%85o!%EE%03%D6%FC%F7%FF%1F%86%BC%23%D6%60%B1%F3o%F61%00%04%10%E3%EA%BB%BD%FF%AD%25%02%19%24%B9%141%0CYv%BB%1Dl%5B%B5%D12%B8%D8%A5%B7%87%18%AAO%F9%C0%F9%00%01%C4%12%A2T%84%D3%0B%20%CD%8A%BC%BA(bz%C2v(%7C%80%00b%F8O%00%BC%FF%F1%F2%FF%EA%BB%7D%FF%5B%CFF%FD%7F%FA%E5%0E%5C%1C%E4%F2k%EFN%FC%07%08%20F%10%07d%D3%AD%0Fg%C1%CEcabe(%D4%9B%09%B7%20%ED%A0%01%C3%F3o%F7%E0%FC%D5n%CF%198%98%B9%E1%7C%80%00b%01%25KdPk%BC%12%CE%FE%F1%F7%2B%8Afh%B2g%90%E2Vf%10%E3%90c%B8%F0v%3F%03%40%00%A1%C4%02%2B%13%3B%83%99%98'%9C%BF%E4V3%D6%B0y%F6%F5.%18%83%00%40%001!K%14%EB%CFFQ%B8%F1%C14%06B%00%20%80%98%40%B9%0A%06%AC%25%02%E0%EC%ED%8F%E6%12%D4%CC%C9%C2%C3%00%10%40L%A0%2C%09b%C4%AB7%A2HN%BBZ%88W3%C8b%60%802%02%04%18%00%B1%97%D3qL%D5*%FC%00%00%00%00IEND%AEB%60%82",
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		return request('http://services.snipshot.com/', {
			sendContent : {
				snipshot_input : ps.file || ps.itemUrl,
			},
		}).addCallback(function(res){
			return addTab(res.channel.URI.asciiSpec);
		}).addCallback(function(win){
			win.SnipshotImport = {
				title : ps.page,
				url   : ps.pageUrl,
			};
		});
	},
});

models.register(update({
	name : 'Hatena',
	ICON : 'http://www.hatena.ne.jp/favicon.ico',
	
	getPasswords : function(){
		return getPasswords('https://www.hatena.ne.jp');
	},
	
	login : function(user, password){
		var self = this;
		return (this.getAuthCookie()? this.logout() : succeed()).addCallback(function(){
			return request('https://www.hatena.ne.jp/login', {
				sendContent : {
					name : user,
					password : password,
					persistent : 1,
					location : 'http://www.hatena.ne.jp/',
				},
			});
		}).addCallback(function(){
			self.updateSession();
			self.user = user;
		});
	},
	
	logout : function(){
		return request('http://www.hatena.ne.jp/logout');
	},
	
	getAuthCookie : function(){
		return getCookieString('.hatena.ne.jp', 'rk');
	},
	
	getToken : function(){
		return this.getUserInfo().addCallback(itemgetter('rks'));
	},
	
	getCurrentUser : function(){
		return this.getUserInfo().addCallback(itemgetter('name'));
	},
	
	getUserInfo : function(){
		return this.getSessionValue('userInfo', function(){
			return request('http://b.hatena.ne.jp/my.name').addCallback(function(res){
				return JSON.parse(res.responseText);
			});
		});
	},
	
	reprTags: function (tags) {
		return tags ? tags.map(function(t){
			return '[' + t + ']';
		}).join('') : '' ;
	},
}, AbstractSessionService));


models.register({
	name : 'HatenaFotolife',
	ICON : 'http://f.hatena.ne.jp/favicon.ico',
	
	check : function(ps){
		return ps.type=='photo';
	},
	
	post : function(ps){
		// 拡張子を指定しないとアップロードに失敗する(エラーは起きない)
		return (ps.file? succeed(ps.file) : download(ps.itemUrl, getTempFile(createURI(ps.itemUrl).fileExtension))).addCallback(function(file){
			return models.HatenaFotolife.upload({
				fototitle1 : ps.item || ps.page,
				image1     : file,
			});
		});
	},
	
	// image1 - image5
	// fototitle1 - fototitle5 (optional)
	upload : function(ps){
		return Hatena.getToken().addCallback(function(token){
			ps.rkm = token;
			
			return Hatena.getCurrentUser();
		}).addCallback(function(user){
			return request('http://f.hatena.ne.jp/'+user+'/up', {
				sendContent : update({
					mode : 'enter',
				}, ps),
			});
		});
	},
});

models.register(update({
	name : 'HatenaBookmark',
	ICON : 'http://b.hatena.ne.jp/favicon.ico',
	POST_URL : 'http://b.hatena.ne.jp/add',
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		// タイトルは共有されているため送信しない
		return this.addBookmark(ps.itemUrl, null, ps.tags, joinText([ps.body, ps.description], ' ', true));
	},
	
	getEntry : function(url){
		var self = this;
		return request('http://b.hatena.ne.jp/my.entry', {
			queryString : {
				url : url
			}
		}).addCallback(function(res){
			return JSON.parse(res.responseText);
		});
	},
	
	getUserTags : function(user){
		return request('http://b.hatena.ne.jp/' + user + '/tags.json').addCallback(function(res){
			var tags = JSON.parse(res.responseText)['tags'];
			return items(tags).map(function(pair){
				return {
					name      : pair[0],
					frequency : pair[1].count
				}
			});
		});
	},
	
	addBookmark : function(url, title, tags, description){
		return Hatena.getToken().addCallback(function(token){
			return request('http://b.hatena.ne.jp/bookmarklet.edit', {
				redirectionLimit : 0,
				sendContent : {
					rks     : token,
					url     : url.replace(/%[0-9a-f]{2}/g, function(s){
						return s.toUpperCase();
					}),
					title   : title, 
					comment : Hatena.reprTags(tags) + description.replace(/[\n\r]+/g, ' '),
				},
			});
		});
	},
	
	/**
	 * タグ、おすすめタグ、キーワードを取得する
	 * ページURLが空の場合、タグだけが返される。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		var self = this;
		return Hatena.getCurrentUser().addCallback(function(user){
			return new DeferredHash({
				tags : self.getUserTags(user),
				entry : self.getEntry(url),
			});
		}).addCallback(function(ress){
			var entry = ress.entry[1];
			var tags = ress.tags[1];
			
			var duplicated = !!entry.bookmarked_data;
			var endpoint = HatenaBookmark.POST_URL + '?' + queryString({
				mode : 'confirm',
				url  : url,
			});
			var form = {item : entry.title};
			if(duplicated){
				form = update(form, {
					description : entry.bookmarked_data.comment,
					tags        : entry.bookmarked_data.tags,
					private     : entry.bookmarked_data.private,
				});
			}
			
			return {
				form        : form,
				editPage    : endpoint,
				tags        : tags,
				duplicated  : duplicated,
				recommended : entry.recommend_tags,
			}
		});
	},
}, AbstractSessionService));

models.register( {
	name     : 'HatenaDiary',
	ICON     : 'http://d.hatena.ne.jp/favicon.ico',
	POST_URL : 'http://d.hatena.ne.jp',
	
	check : function(ps){
		return (/(regular|photo|quote|link)/).test(ps.type) && !ps.file;
	},
	
	converters: {
		regular : function(ps, title){
			return ps.description;
		},
		
		photo : function(ps, title){
			return ''+<>
				<blockquote cite={ps.pageUrl} title={title}>
					<img src={ps.itemUrl} />
				</blockquote>
				{ps.description}
			</>;
		},
		
		link : function(ps, title){
			return ''+<>
				<a href={ps.pageUrl} title={title}>{ps.page}</a>
				{ps.description}
			</>;
		},
		
		quote : function(ps, title){
			return ''+<>
				<blockquote cite={ps.pageUrl} title={title}>{ps.body}</blockquote>
				{ps.description}
			</>;
		},
	},
	
	post : function(ps){
		var self = this;
		
		return Hatena.getUserInfo().addCallback(function(info){
			var title = ps.item || ps.page || '';
			var endpoint = [self.POST_URL, info.name, ''].join('/');
			return request(endpoint, {
				redirectionLimit : 0,
				referrer         : endpoint,
				sendContent      : {
					rkm   : info.rkm,
					title : Hatena.reprTags(ps.tags) + title,
					body  : self.converters[ps.type](ps, title),
				},
			});
		});
	}
});

models.register({
	name : 'HatenaStar',
	ICON : 'http://s.hatena.ne.jp/favicon.ico',
	
	getToken : function(){
		return request('http://s.hatena.ne.jp/entries.json').addCallback(function(res){
			if(!res.responseText.match(/"rks":"(.*?)"/))
				throw new Error(getMessage('error.notLoggedin'));
			return RegExp.$1;
		})
	},
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return HatenaStar.getToken().addCallback(function(token){
			return request('http://s.hatena.ne.jp/star.add.json', {
				redirectionLimit : 0,
				queryString : {
					rks      : token,
					title    : ps.item,
					quote    : joinText([ps.body, ps.description], ' ', true),
					location : ps.pageUrl,
					uri      : ps.itemUrl,
				},
			});
		});
	},
	
	remove : function(ps){
		return HatenaStar.getToken().addCallback(function(token){
			return request('http://s.hatena.ne.jp/star.delete.json', {
				redirectionLimit : 0,
				queryString : {
					rks   : token,
					uri   : ps.itemUrl,
					quote : joinText([ps.body, ps.description], ' ', true),
				},
			});
		});
	},
});

models.register(update({
	name     : 'LivedoorClip',
	ICON     : 'http://clip.livedoor.com/favicon.ico',
	POST_URL : 'http://clip.livedoor.com/clip/add',

	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		var self = this;
		return self.getToken().addCallback(function(token){
			return request(self.POST_URL, {
				redirectionLimit : 0,
				sendContent : {
					rate    : ps.rate? ps.rate : 0,
					title   : ps.item,
					postKey : token,
					link    : ps.itemUrl,
					tags    : joinText(ps.tags, ' '),
					notes   : joinText([ps.body, ps.description], ' ', true),
					public  : ps.private? 'off' : 'on',
				},
			});
		}).addCallback(function(res){
			if(res.channel.URI.host == 'clip.livedoor.com')
				throw new Error(getMessage('error.unknown'));
			
			return res;
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('livedoor.com', '.LRC');
	},
	
	getSuggestions : function(url){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		// 何らかのURLを渡す必要がある
		return request(LivedoorClip.POST_URL, {
			queryString : {
				link : url || 'http://tombloo/',
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				duplicated : !!$x('//form[@name="delete_form"]', doc),
				tags : $x('//div[@class="TagBox"]/span/text()', doc, true).map(function(tag){
					return {
						name      : tag,
						frequency : -1,
					};
				}),
			}
		});
	},
	
	getToken : function(){
		switch (this.updateSession()){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
		
		case 'same':
			if(this.token)
				return succeed(this.token);
		
		case 'changed':
			var self = this;
				return request(LivedoorClip.POST_URL, {
					queryString : {
						link  : 'http://tombloo/',
						cache : Date.now(),
					},
				}).addCallback(function(res){
					if(res.responseText.match(/"postkey" value="(.*)"/)){
						self.token = RegExp.$1;
						return self.token;
					}
					throw new Error(getMessage('error.notLoggedin'));
				});
		}
	},
}, AbstractSessionService));

models.register({
	name : 'Wassr',
	ICON : 'http://wassr.jp/favicon.ico',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return this.addMessage(joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true));
	},
	
	addMessage : function(message){
		return request('http://wassr.jp/my/').addCallback(function(res){
			if(!res.channel.URI.asciiSpec.match('http://wassr.jp/my/'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('http://wassr.jp/my/status/add', {
				redirectionLimit : 0,
				sendContent : update(formContents(convertToHTMLDocument(res.responseText)), {
					message : message,
				}),
			});
		})
	},
});

models.register({
	name : 'MediaMarker',
	ICON : 'http://mediamarker.net/favicon.ico',
	check : function(ps){
		return ps.type == 'link' && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookieString('mediamarker.net', 'mediax_ss');
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		return request('http://mediamarker.net/reg', {
			queryString : {
				mode    : 'marklet',
				url     : ps.itemUrl,
				comment : ps.description,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var url = $x('id("reg")/@action', doc);
			if(!url)
				throw new Error(getMessage('error.alreadyExsits'));
			
			return request(url, {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					title : ps.item,
					tag   : joinText(ps.tags, '\n'),
				})
			});
		});
	}
});

models.register({
	name : 'LibraryThing',
	ICON : 'http://www.librarything.com/favicon.ico',
	
	check : function(ps){
		return ps.type == 'link' && !ps.file;
	},
	
	getAuthCookie : function(){
		return getCookies('librarything.com', 'cookie_userid');
	},
	
	getHost : function(){
		var cookies = this.getAuthCookie();
		if(!cookies.length)
			throw new Error(getMessage('error.notLoggedin'));
		
		return cookies[0].host;
	},
	
	post : function(ps){
		var self = this;
		return request('http://' + self.getHost() + '/import_submit.php', {
			sendContent : {
				form_textbox : ps.itemUrl,
			},
		}).addCallback(function(res){
			var err = res.channel.URI.asciiSpec.extract('http://' + self.getHost() + '/import.php?pastealert=(.*)');
			if(err)
				throw new Error(err);
			
			var doc = convertToHTMLDocument(res.responseText);
			return request('http://' + self.getHost() + '/import_questions_submit.php', {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					masstags :	joinText(ps.tags, ','),
				}),
			});
		});
	}
});

models.register({
	name : '8tracks',
	ICON : 'http://8tracks.com/favicon.ico',
	URL  : 'http://8tracks.com',
	
	upload : function(file){
		file = getLocalFile(file);
		return request(this.URL + '/tracks', {
			redirectionLimit : 0,
			sendContent : {
				'track_files[]' : file,
			},
		});
	},
	
	getPlayToken : function(){
		return getJSON(this.URL + '/sets/new.json').addCallback(function(res){
			return res.play_token;
		});
	},
	
	getPlaylist : function(mixId){
		var self = this;
		var tracks = [];
		var number = 0;
		var d = new Deferred();
		
		self.getPlayToken().addCallback(function(token){
			(function(){
				var me = arguments.callee;
				return getJSON(self.URL + '/sets/' + token + '/' + ((number==0)? 'play' : 'next')+ '.json', {
					queryString : {
						mix_id : mixId,
					}
				}).addCallback(function(res){
					var track = res.set.track;
					
					// 最後のトラック以降にはトラック個別情報が含まれない
					if(!track.url){
						d.callback(tracks);
						return;
					}
					
					track.number = ++number;
					tracks.push(track);
					me();
				}).addErrback(function(e){
					error(e);
					
					// 異常なトラックをスキップする(破損したJSONが返る)
					if(e.message.name == 'SyntaxError')
						me();
				});
			})();
		});
		
		return d;
	}
});

models.register({
	name : 'is.gd',
	ICON : 'http://is.gd/favicon.ico',
	URL  : 'http://is.gd/',
	
	shorten : function(url){
		if((/\/\/is\.gd\//).test(url))
			return succeed(url);
		
		return request(this.URL + '/api.php', {
			redirectionLimit : 0,
			queryString : {
				longurl : url,
			},
		}).addCallback(function(res){
			return res.responseText;
		});
	},
	
	expand : function(url){
		return request(url, {
			redirectionLimit : 0,
		}).addCallback(function(res){
			return res.channel.URI.spec;
		});
	},
});

models.register({
	name    : 'bit.ly',
	ICON    : 'http://bit.ly/static/images/favicon.png',
	URL     : 'http://api.bit.ly',
	API_KEY : 'R_8d078b93e8213f98c239718ced551fad',
	USER    : 'to',
	VERSION : '2.0.1',
	
	shorten : function(url){
		var self = this;
		if(url.match('//(bit.ly|j.mp)/'))
			return succeed(url);
		
		return this.callMethod('shorten', {
			longUrl : url,
		}).addCallback(function(res){
			return res[url].shortUrl;
		});
	},
	
	expand : function(url){
		var hash = url.split('/').pop();
		return this.callMethod('expand', {
			hash : hash,
		}).addCallback(function(res){
			return res[hash].longUrl;
		});
	},
	
	callMethod : function(method, ps){
		var self = this;
		return request(this.URL + '/' + method, {
			queryString : update({
				version : this.VERSION,
				login   : this.USER,
				apiKey  : this.API_KEY,
			}, ps),
		}).addCallback(function(res){
			res = evalInSandbox('(' + res.responseText + ')', self.URL);
			if(res.errorCode){
				var error = new Error([res.statusCode, res.errorCode, res.errorMessage].join(': '))
				error.detail = res;
				throw error;
			}
			
			return res.results;
		});
	},
});

models.register(update({}, models['bit.ly'], {
	name : 'j.mp',
	ICON : 'http://j.mp/static/images/favicon.png',
	URL  : 'http://api.j.mp',
}));

models.register({
	name : 'TextConversionServices',
	DATABASE_NAME : 'Text Conversion Services',
	
	actions : {
		replace : function(original, str) {
			return str;
		},
		prepend : function(original, str) {
			return [str, original].join(' ');
		},
		append : function(original, str) {
			return [original, str].join(' ');
		}
	},
	
	charsets : {
		sjis : 'Shift_JIS',
		euc  : 'EUC-JP',
		jis  : 'iso-2022-jp',
		utf8 : 'utf-8',
	},
	
	getServices : function(){
		if(this.services)
			return succeed(this.services);
		
		var self = this;
		return Wedata.Item.findByDatabase(this.DATABASE_NAME).addCallback(function(services){
			return self.services = services;
		});
	},
	
	getService : function(name){
		return this.getServices().addCallback(function(services){
			return ifilter(function(service){
				return service.getMetaInfo().name == name;
			}, services).next();
		});
	},
	
	convert : function(str, name){
		var service;
		var self = this;
		
		return this.getService(name).addCallback(function(res){
			var strForRequest;
			
			service = res;
			
			charset = self.charsets[service.charset];
			if(charset != 'utf-8'){
				strForRequest = escape(str.convertFromUnicode(charset));
			} else {
				strForRequest = encodeURIComponent(str);
			}
			
			return request(service.url.replace(/%s/, strForRequest), {
				charset : charset,
			});
		}).addCallback(function(res){
			res = res.responseText;
			
			if(service.xpath){
				var doc = convertToHTMLDocument(res);
				res = $x(service.xpath, doc);
				res = (res.textContent || res).replace(/\n+/g, '');
			}
			
			return self.actions[service.action || 'replace'](str, res);
		});
	},
});

models.register({
	name : 'Sharebee.com',
	URL  : 'http://sharebee.com/',
	
	decrypt : function(url){
		return request(url.startsWith(this.URL)? url : this.URL + url).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				fileName : $x('//h2/span[@title]/@title', doc),
				links    : $x('//table[@class="links"]//a/@href', doc, true),
			}
		});
	},
});

models.register({
	name : 'Nicovideo',
	URL  : 'http://www.nicovideo.jp',
	ICON : 'http://www.nicovideo.jp/favicon.ico',
	
	getPageInfo : function(id){
		return request(this.URL + '/watch/' + id, {
			charset : 'UTF-8',
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return {
				title : doc.title.extract(/(.*)‐/),
				lists : $x('id("des_2")//a[contains(@href, "/mylist/")]/@href', doc, true),
				links : $x('id("des_2")//a[starts-with(@href, "http") and contains(@href, "/watch/")]/@href', doc, true),
			}
		});
	},
	
	download : function(id, title){
		var self = this;
		return ((title)? succeed(title) : self.getPageInfo(id).addCallback(itemgetter('title'))).addCallback(function(title){
			return request(self.URL + '/api/getflv?v='+id).addCallback(function(res){
				var params = parseQueryString(res.responseText);
				var file = getDownloadDir();
				file.append(validateFileName(title + '.flv'));
				return download(params.url, file, true);
			});
		});
	},
});

models.register({
	name : 'Soundcloud',
	URL  : 'http://soundcloud.com/',
	ICON : 'http://soundcloud.com/favicon.ico',
	
	normalizeTrackUrl : function(url){
		if(!url)
			return;
		
		url = createURI(url);
		url = url.prePath + url.filePath;
		
		return url.replace(/(\/download|\/)+$/g, '');
	},
	
	getPageInfo : function(url){
		var self = this;
		url = this.normalizeTrackUrl(url);
		
		return request(url).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var tokens = url.split('/');
			var track = tokens.pop();
			var user = tokens.pop();
			
			var info = {user:user, track:track};
			['uid', 'token', 'waveformUrl', 'streamUrl'].forEach(function(prop){
				// Unicodeエスケープを戻す
				var value = res.responseText.extract('"' + prop + '":"(.+?)"');
				info[prop] = evalInSandbox('"' + value + '"', self.URL);
			});
			
			info.download = !!$x('//a[contains(@class, "download")]', doc);
			info.type = (info.download)? $x('//span[contains(@class, "file-type")]/text()', doc) || 'mp3' : 'mp3';
			
			info.title = $x('//div[contains(@class, "info-header")]//h1', doc).textContent.replace(/[\n\r\t]/g, '');
			
			return info;
		});
	},
	
	download : function(url, file){
		var self = this;
		url = this.normalizeTrackUrl(url);
		
		return this.getPageInfo(url).addCallback(function(info){
			if(!file){
				file = getDownloadDir();
				file.append(self.name);
				file.append(info.user);
				createDir(file);
				
				file.append(validateFileName(
					info.title + 
					((info.download)? '' : ' (STREAM)') + 
					'.' + info.type));
			}
			
			return download(info.download? url + '/download' : info.streamUrl, file, true);
		});
	},
});

models.register(update({}, AbstractSessionService, {
	name : 'NDrive',
	ICON : 'http://ndrive1.naver.jp/favicon.ico',
	
	check : function(ps){
		return (/(photo|link)/).test(ps.type);
	},
	
	post : function(ps){
		var self = this;
		return (ps.file? succeed(ps.file) : download(ps.itemUrl, getTempDir())).addCallback(function(file){
			return self.upload(file, null, ps.item + '.' + createURI(file).fileExtension);
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('ndrive1.naver.jp', 'njid_inf');
	},
	
	getUserInfo : function(){
		return request('http://ndrive.naver.jp/').addCallback(function(res){
			function getString(name){
				return res.responseText.extract(RegExp('\\s' + name + '\\s*=\\s*[\'"](.+?)[\'"]'));
			}
			
			return {
				userId          : getString('userId'),
				userIdx         : getString('userIdx'),
				cmsServerDomain : getString('cmsServerDomain'),
			}
		});
	},
	
	toW3CDTF : function(date){
		with(date){
			return getFullYear() + '-' + (getMonth()+1).pad(2) + '-' + getDate().pad(2) + 
			'T' + getHours().pad(2) + ':' + getMinutes().pad(2) + ':' + getSeconds().pad(2) + 
			toTimeString().split('GMT').pop().replace(/(\d{2})(\d{2})/, '$1:$2');
		}
	},
	
	/**
	 * ファイルのアップロード可否を確認する。
	 * ファイルが重複する場合など、そのままアップロードできない場合はエラーとなる。
	 * 
	 * @param {String} path 
	 *        アップロード対象のパス。ルート(/)からはじまる相対パスで記述する。
	 * @param {optional Number} size 
	 *        アップロードするファイルのサイズ。
	 * @return {Deferred} 処理結果。
	 */
	checkUpload : function(path, size){
		var self = this;
		
		size = size || 1;
		
		return this.getSessionValue('user', this.getUserInfo).addCallback(function(info){
			return request('http://' + info.cmsServerDomain + '/CheckUpload.ndrive', {
				sendContent : {
					cookie      : getCookieString('ndrive1.naver.jp'),
					userid      : info.userId,
					useridx     : info.userIdx,
					
					dstresource : path,
					uploadsize  : size,
				}
			}).addCallback(function(res){
				res = evalInSandbox('(' + res.responseText + ')', self.ICON);
				
				if(res.resultcode != 0)
					throw res;
				return res;
			});
		});
	},
	
	uniqueFile : function(path){
		var self = this;
		return this.checkUpload(path).addCallback(function(){
			return path;
		}).addErrback(function(err){
			err = err.message;
			
			// Duplicated File Exist以外のエラーは抜ける
			if(err.resultcode != 9)
				throw err;
			
			return self.uniqueFile(self.incrementFile(path));
		});
	},
	
	incrementFile : function(path){
		var paths = path.split('/');
		var name = paths.pop();
		
		// 既に括弧数字が含まれているか?
		var re = /(.*\()(\d+)(\))/;
		if(re.test(name)){
			name = name.replace(re, function(all, left, num, right){
				return left + (++num) + right;
			});
		} else {
			name = (name.contains('.'))?
				name.replace(/(.*)(\..*)/, '$1(2)$2') : 
				name + '(2)';
		}
		
		paths.push(name);
		return paths.join('/');
	},
	
	validateFileName : function(name){
		return name.replace(/[:\|\?\*\/\\]/g, '-').replace(/"/g, "'").replace(/</g, "(").replace(/>/g, ")");
	},
	
	/**
	 * ファイルをアップロードする。
	 * 空要素は除外される。
	 * 配列が空の場合は、空文字列が返される。
	 * 配列の入れ子は直列化される。
	 * 
	 * @param {LocalFile || String} file 
	 *        アップロード対象のファイル。ファイルへのURIでも可。
	 * @param {optional String} dir 
	 *        アップロード先のディレクトリ。
	 *        省略された場合はmodel.ndrive.defaultDirの設定値かルートになる。
	 *        先頭および末尾のスラッシュの有無は問わない。
	 * @param {optional String} name 
	 *        アップロード後のファイル名。
	 *        省略された場合は元のファイル名のままとなる。
	 * @param {optional Boolean} overwrite 
	 *        上書きフラグ。
	 *        上書きせずに同名のファイルが存在した場合は末尾に括弧数字((3)など)が付加される。
	 * @return {Deferred} 処理結果。
	 */
	upload : function(file, dir, name, overwrite){
		var self = this;
		
		file = getLocalFile(file);
		name = this.validateFileName(name || file.leafName);
		
		if(!dir)
			dir = getPref('model.ndrive.defaultDir') || '';
		
		if(dir && dir.slice(-1)!='/')
			dir += '/' ;
		
		if(!dir.startsWith('/'))
			dir = '/' + dir;
		
		var path = dir + name;
		
		// 上書きしない場合はファイル名のチェックを先に行う
		return ((overwrite)? succeed(path) : self.uniqueFile(path)).addCallback(function(fixed){
			path = fixed;
			
			return self.getSessionValue('user', this.getUserInfo);
		}).addCallback(function(info){
			return request('http://' + info.cmsServerDomain + path, {
				sendContent : {
					overwrite       : overwrite? 'T' : 'F',
					NDriveSvcType   : 'NHN/ND-WEB Ver',
					Upload          : 'Submit Query',
					
					// FIXME: マルチパートの場合、自動でエンコードされない(Tumblrはデコードを行わない)
					cookie          : encodeURIComponent(getCookieString('ndrive1.naver.jp')),
					userid          : info.userId,
					useridx         : info.userIdx,
					
					Filename        : file.leafName,
					filesize        : file.fileSize,
					getlastmodified : self.toW3CDTF(new Date(file.lastModifiedTime)),
					Filedata        : file,
				}
			});
		});
	}
}));

models.register({
	name : 'GazoPa',
	icon : 'http://www.gazopa.com/favicon_gazopa.ico',
	getSimilarImages : function(src){
		return request('http://www.gazopa.com/similar', {
			queryString : {
				key_url : src,
			}
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return $x('//img[starts-with(@id, "result_img_")]/parent::a/@href', doc, true).map(function(href){
				return parseQueryString(createURI(href).query).img_url;
			});
		});
	}
});


// 全てのサービスをグローバルコンテキストに置く(後方互換)
models.copyTo(this);


/**
 * ポストを受け取ることができるサービスのリストを取得する。
 * 
 * @param {Object} ps ポスト情報。
 * @return {Array}
 */
models.check = function(ps){
	return this.values.filter(function(m){
		if((ps.favorite && ps.favorite.name==m.name) || (m.check && m.check(ps)))
			return true;
	});
}

/**
 * デフォルトのサービスのリストを取得する。
 * ユーザーの設定が適用される。
 *
 * @param {Object} ps ポスト情報。
 * @return {Array}
 */
models.getDefaults = function(ps){
	var config = eval(getPref('postConfig'));
	return this.check(ps).filter(function(m){
		return models.getPostConfig(config, m.name, ps) == 'default';
	});
}

/**
 * 利用可能なサービスのリストを取得する。
 * ユーザーの設定が適用される。
 *
 * @param {Object} ps ポスト情報。
 * @return {Array}
 */
models.getEnables = function(ps){
	var config = eval(getPref('postConfig'));
	return this.check(ps).filter(function(m){
		m.config = (m.config || {});
		
		// クイックポストフォームにて、取得後にデフォルトなのか利用可能なのかを
		// 判定する必要があったため、サービスに設定値を保存し返す
		var val = m.config[ps.type] = models.getPostConfig(config, m.name, ps);
		return val==null || (/(default|enable)/).test(val);
	});
}

/**
 * ポスト設定値を文字列で取得する。
 * 
 * @param {Object} config ポスト設定。
 * @param {String} name サービス名。
 * @param {Object} ps ポスト情報。
 * @return {String}
 */
models.getPostConfig = function(config, name, ps){
	var c = config[name] || {};
	return (ps.favorite && ps.favorite.name==name)? c.favorite : c[ps.type];
}


function shortenUrls(text, model){
	var reUrl = /https?[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\^]+/g;
	if(!reUrl.test(text))
		return text;
		
	var urls = text.match(reUrl);
	return gatherResults(urls.map(function(url){
		return model.shorten(url);
	})).addCallback(function(ress){
		zip(urls, ress).forEach(function([url, res]){
			text = text.replace(url, res);
		});
		
		return text;
	});
}
