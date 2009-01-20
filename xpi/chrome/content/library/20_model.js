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
		return request('https://friendfeed.com/share/publish', {
			redirectionLimit : 0,
			sendContent : {
				at  : self.getToken(),
				url : ps.pageUrl,
				title : ps.page,
				image0 : ps.type == 'photo'? ps.itemUrl : '',
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
	URL : 'http://FFFFOUND.com/',
	
	getToken : function(){
		return request(FFFFOUND.URL + 'bookmarklet.js').addCallback(function(res){
			return res.responseText.match(/token='(.*?)'/)[1];
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

models.register({
	name : 'Amazon',
	ICON : 'http://www.amazon.co.jp/favicon.ico',
	getItem : function(asin){
		return request('http://webservices.amazon.co.jp/onca/xml', {
			queryString : {
				Service        : 'AWSECommerceService',
				SubscriptionId : '0DCQFXHRBNT9GN9Z64R2',
				Operation      : 'ItemLookup',
				ResponseGroup  : 'Small,Images',
				ItemId         : asin,
			},
		}).addCallback(function(res){
			var xml = convertToXML(res.responseText);
			if(xml.Error.length())
				throw res;
			
			return new Amazon.Item(xml.Items.Item);
		});
	},
	
	normalizeUrl : function(asin){
		return  'http://amazon.co.jp/o/ASIN/' + asin + 
			(this.affiliateId ? '/' + this.affiliateId + '/ref=nosim' : '');
	},
	
	get affiliateId(){
		return getPref('amazonAffiliateId');
	},
	
	Item : function(item){
		return {
			get title(){
				return ''+item.ItemAttributes.Title;
			},
			get creators(){
				var creators = [];
				
				// '原著'以外
				for each(var creator in item.ItemAttributes.Creator.(@Role != '\u539F\u8457'))
					creators.push(''+creator);
				return creators;
			},
			get largestImage(){
				return this.largeImage || this.mediumImage || this.smallImage;
			},
			get largeImage(){
				return new Amazon.Image(item.LargeImage);
			},
			get mediumImage(){
				return new Amazon.Image(item.MediumImage);
			},
			get smallImage(){
				return new Amazon.Image(item.SmallImage);
			},
		}
	},
	
	Image : function(img){
		if(!img.length())
			return;
		
		return {
			get size(){
				return (''+img.name()).slice(0, -5).toLowerCase();
			},
			get url(){
				return ''+img.URL;
			},
			get width(){
				return 1*img.Width;
			},
			get height(){
				return 1*img.Height;
			},
		}
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
	name : 'WeHeartIt',
	ICON : 'http://weheartit.com/img/favicon.ico',
	URL : 'http://weheartit.com/',
	
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
	ICON : 'http://www.straightline.jp/html/common/static/favicon.ico',
	
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
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return Twitter.getToken().addCallback(function(token){
			// FIXME: 403が発生することがあったため redirectionLimit:0 を外す
			token.status = joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true);
			return request('http://twitter.com/status/update', update({
				sendContent : token,
			}));
		});
	},
	
	favor : function(ps){
		return this.addFavorite(ps.favorite.id);
	},
	
	
	getToken : function(){
		return request('http://twitter.com/account/settings').addCallback(function(res){
			var html = res.responseText;
			if(~html.indexOf('class="signin"'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return {
				authenticity_token : html.extract(/authenticity_token.+value="(.+?)"/),
				siv                : html.extract(/logout\?siv=(.+?)"/),
			}
		});
	},
	
	remove : function(id){
		return Twitter.getToken().addCallback(function(ps){
			ps._method = 'delete';
			return request('http://twitter.com/status/destroy/' + id, {
				redirectionLimit : 0,
				referrer : 'http://twitter.com/home',
				sendContent : ps,
			});
		});
	},
	
	addFavorite : function(id){
		return Twitter.getToken().addCallback(function(ps){
			return request('http://twitter.com/favourings/create/' + id, {
				redirectionLimit : 0,
				referrer : 'http://twitter.com/home',
				sendContent : ps,
			});
		});
	},
});


models.register({
	name : 'Jaiku',
	ICON : 'http://jaiku.com/favicon.ico',
	
	URL : 'http://jaiku.com/',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	getCurrentUser : function(){
		if(getCookieString('jaiku.com').match(/jaikuuser_.+?=(.+?);/))
			return RegExp.$1;
		
		throw new Error(getMessage('error.notLoggedin'));
	},
	
	post : function(ps){
		this.getCurrentUser();
		
		return request(Jaiku.URL).addCallback(function(res){
			var form =  formContents(convertToHTMLDocument(res.responseText));
			return request(Jaiku.URL, {
				redirectionLimit : 0,
				sendContent : {
					_nonce : form._nonce,
					message : joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true),
				},
			});
		});
	},
});

models.register(update({}, AbstractSessionService, {
	name : 'Rejaw',
	ICON : 'http://rejaw.com/images/logo/favicon.ico',

	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return Rejaw.shout(joinText([ps.item, ps.itemUrl, ps.body, ps.description], '\n', true));
	},
	
	shout : function(text){
		return Rejaw.getToken().addCallback(function(token){
			return request('http://rejaw.com/v1/conversation/shout.json', {
				redirectionLimit : 0,
				sendContent : update(token, {
					text : text,
				}),
			});
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('rejaw.com', 'signin_email') || getCookieString('rejaw.com', 'signin_openid_url');
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
			return request('http://rejaw.com/').addCallback(function(res){
				return self.token = {
					session : res.responseText.extract(/"session":"(.+?)"/)
				};
			});
		}
	},
}));

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
		return getCookieString('plurk.com', 'plurkcookie').extract(/user_id=(.+)/);
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
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('http://www.google.com/bookmarks/mark', {
			queryString :	{
				op : 'add',
			},
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(doc.getElementById('gaia_loginform'))
				throw new Error(getMessage('error.notLoggedin'));
			
			var fs = formContents(doc);
			return request('http://www.google.com'+$x('//form[@name="add_bkmk_form"]/@action', doc), {
				redirectionLimit : 0,
				sendContent  : {
					title      : ps.item,
					bkmk       : ps.itemUrl,
					annotation : joinText([ps.body, ps.description], ' ', true),
					labels     : ps.tags? ps.tags.join(',') : '',
					btnA       : fs.btnA,
					sig        : fs.sig,
				},
			});
		});
	},
});

models.register({
	name : 'Delicious',
	ICON : 'http://delicious.com/favicon.ico',
	
	/**
	 * ユーザーの利用しているタグ一覧を取得する。
	 *
	 * @param {String} user 対象ユーザー名。未指定の場合、ログインしているユーザー名が使われる。
	 * @return {Array}
	 */
	getUserTags : function(user){
		// 同期でエラーが起きないようにする
		return succeed().addCallback(function(){
			return request('http://feeds.delicious.com/feeds/json/tags/' + (user || Delicious.getCurrentUser()));
		}).addCallback(function(res){
			var tags = evalInSandbox(res.responseText, 'http://feeds.delicious.com/');
			return reduce(function(memo, tag){
				memo.push({
					name      : tag[0],
					frequency : tag[1],
				});
				return memo;
			}, tags, []);
		});
	},
	
	/**
	 * タグ、おすすめタグ、ネットワークなどを取得する。
	 * ブックマーク済みでも取得することができる。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		var self = this;
		var ds = {
			tags : this.getUserTags(),
			suggestions : succeed().addCallback(function(){
				// ログインをチェックする
				self.getCurrentUser();
				
				// ブックマークレット用画面の削除リンクを使い既ブックマークを判定する
				return request('http://delicious.com/save', {
					queryString : {
						noui : 1,
						url  : url,
					},
				});
			}).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				
				function getTags(part){
					return $x('id("save-' + part + '-tags")//a[contains(@class, "tag-list-tag")]/text()', doc, true);
				}
				return {
					editPage : editPage = 'http://delicious.com/save?url=' + url,
					form : {
						item        : $x('id("title")', doc).value,
						description : $x('id("notes")', doc).value,
						tags        : $x('id("tags")', doc).value.split(' '),
						private     : $x('id("share")', doc).checked,
					},
					
					duplicated : !!doc.getElementById('delete'),
					recommended : getTags('reco'), 
					popular : getTags('pop'),
					network : getTags('net'),
				}
			})
		};
		
		return new DeferredHash(ds).addCallback(function(ress){
			// エラーチェック
			for each(var [success, res] in ress)
				if(!success)
					throw res;
			
			var res = ress.suggestions[1];
			res.tags = ress.tags[1];
			return res;
		});
	},
	
	getCurrentUser : function(){
		if(decodeURIComponent(getCookieString('delicious.com', '_user')).match(/user=(.*?) /))
			return RegExp.$1;
		
		throw new Error(getMessage('error.notLoggedin'));
	},
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('http://delicious.com/post/', {
			queryString :	{
				title : ps.item,
				url   : ps.itemUrl,
			},
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(!doc.getElementById('saveitem'))
				throw new Error(getMessage('error.notLoggedin'));
			
			return request('http://delicious.com'+$x('id("saveitem")/@action', doc), {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					description : ps.item,
					jump        : 'no',
					notes       : joinText([ps.body, ps.description], ' ', true),
					tags        : ps.tags? ps.tags.join(' ') : '',
					share       : ps.private? 'no' : '',
				}),
			});
		});
	},
});

models.register({
	name : 'Digg',
	ICON : 'http://digg.com/favicon.ico',
	
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

// Firefox 3以降
if(NavBookmarksService){
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
			uri = createURI(uri);
			tags = tags || [];
			
			if(this.isBookmarked(uri))
				return;
			
			var folders = [NavBookmarksService.unfiledBookmarksFolder].concat(tags.map(bind('createTag', this)));
			folders.forEach(function(folder){
				NavBookmarksService.insertBookmark(
					folder, 
					uri,
					NavBookmarksService.DEFAULT_INDEX,
					title);
			});
			
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
			return NavBookmarksService.isBookmarked(createURI(uri));
		},
		
		removeBookmark : function(uri){
			uri = createURI(uri);
			NavBookmarksService.getBookmarkIdsForURI(uri, {}).forEach(function(item){
				NavBookmarksService.removeItem(item);
			});
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
			description = description || '';
			try{
				AnnotationService.setItemAnnotation(this.getBookmarkId(uri), this.ANNO_DESCRIPTION, description, 
					0, AnnotationService.EXPIRE_NEVER);
			} catch(e){}
		},
		
		createTag : function(name){
			return this.createFolder(NavBookmarksService.tagsFolder, name);
		},
		
		createFolder : function(parent, name){
			return NavBookmarksService.getChildFolder(parent, name) || 
				NavBookmarksService.createFolder(parent, name, NavBookmarksService.DEFAULT_INDEX);
		},
	});
}


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
		return request('http://api.jlp.yahoo.co.jp/MAService/V1/parse', {
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
					tags       : ps.tags? ps.tags.join(' ') : '',
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
				tags        : ps.tags ? ps.tags.join(' ') : '',
				extended    : joinText([ps.body, ps.description], ' ', true),
			},
		});
	},
});

models.register({
	name : 'Magnolia',
	ICON : 'http://ma.gnolia.com/favicon.ico',
	
	getCurrentUser : function(){
		return request('https://ma.gnolia.com/').addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var user = $x('//meta[@name="session-userid"]/@content', doc)
			if(user=='') throw new Error(getMessage('error.notLoggedin'));
			return user;
		});
	},
	
	getApiKey : function(){
		var self = this;
		return request('http://ma.gnolia.com/account/applications').addCallback(function(res){
			try {
				return self.apikey = $x(
					'id("api_key")/text()', 
					convertToHTMLDocument(res.responseText)).replace(/[\n\r]+/g, '');
			} catch(e) {
				throw new Error(getMessage('error.notLoggedin'));
			}
		});
	},
	
	/**
	 * タグを取得する。
	 *
	 * @param {String} url 関連情報を取得する対象のページURL。
	 * @return {Object}
	 */
	getSuggestions : function(url){
		// 同期でエラーが起きないようにする
		return succeed().addCallback(function(){
			return Magnolia.getCurrentUser().addCallback(function(user){
				return request('https://ma.gnolia.com/people/' + user + '/tags');
			}).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return {
					duplicated : false,
					tags : $x('id("tag_cloud_1")/div/a/text()', doc, true).map(function(tag){
						return {
							name      : tag,
							frequency : -1,
						};
					}),
				}
			});
		});
	},
	
	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return Magnolia.getApiKey().addCallback(function(apikey){
			return request('http://ma.gnolia.com/api/rest/1/bookmarks_add', {
				queryString : {
					api_key     : apikey,
					url         : ps.itemUrl,
					title       : ps.item,
					description : ps.description,
					private     : ps.private ? 1 : 0,
					tags        : ps.tags ? ps.tags.join(' ') : '',
					rating      : 0,
				},
			});
		});
	},
});

models.register({
	name : 'Snipshot',
	ICON : 'http://snipshot.com/favicon.ico',
	
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
		switch (this.updateSession()){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request('http://d.hatena.ne.jp/edit').addCallback(function(res){
				if(res.responseText.match(/\srkm\s*:\s*['"](.+?)['"]/))
					return self.token = RegExp.$1;
			});
		}
	},
	
	getCurrentUser : function(){
		switch (this.updateSession()){
		case 'none':
			return succeed('');
			
		case 'same':
			if(this.user)
				return succeed(this.user);
			
		case 'changed':
			var self = this;
			return request('http://www.hatena.ne.jp/my').addCallback(function(res){
				return self.user = $x(
					'(//*[@class="username"]//strong)[1]/text()', 
					convertToHTMLDocument(res.responseText));
			});
		}
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
	
	getAuthCookie : function(){
		return Hatena.getAuthCookie();
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
			return request(HatenaBookmark.POST_URL).addCallback(function(res){
				if(res.responseText.extract(/new Hatena.Bookmark.User\('.*?',\s.*'(.*?)'\)/))
					return self.token = RegExp.$1;
			});
		}
	},
	
	addBookmark : function(url, title, tags, description){
		return HatenaBookmark.getToken().addCallback(function(token){
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
		return succeed().addCallback(function(){
			if(!Hatena.getAuthCookie())
				throw new Error(getMessage('error.notLoggedin'));
			
			return request(HatenaBookmark.POST_URL, {
				sendContent : {
					mode : 'confirm',
					url  : url,
				},
			})
		}).addCallback(function(res){
			var tags = evalInSandbox(
				'(' + res.responseText.extract(/var tags =(.*);$/m) + ')', 
				HatenaBookmark.POST_URL) || {};
			
			return {
				duplicated : (/bookmarked-confirm/).test(res.responseText),
				recommended : $x(
					'id("recommend-tags")/span[@class="tag"]/text()', 
					convertToHTMLDocument(res.responseText), 
					true),
				tags : map(function([tag, info]){
					return {
						name      : tag,
						frequency : info.count,
					}
				}, items(tags)),
			}
		});
	},
}, AbstractSessionService));

models.register( {
	name: 'HatenaDiary',
	ICON: 'http://d.hatena.ne.jp/favicon.ico',
	POST_URL : 'http://d.hatena.ne.jp',
	
	/*
	check : function(ps){
		return (/(regular|photo|quote|link)/).test(ps.type) && !ps.file;
	},
	*/
	converters: {
		getTitle: function(ps){
			return Hatena.reprTags(ps.tags) + (ps.page || '')
		},
		renderingTemplates: {
			regular: '<p>{ps.description}</p>',
			photo: '<p><blockquote class="tombloo_photo" cite={ps.pageUrl} title={ps.page}><img src={ps.itemUrl} /></blockquote>{ps.description}</p>',
			link: '<p><div class="tombloo_link"><a href={ps.pageUrl} title={ps.page}>{ps.page}</a></div>{ps.description}</p>',
			quote: '<p><blockquote class="tombloo_quote" cite={ps.pageUrl} title={ps.page}>{ps.body}</blockquote>{ps.description}</p>',
		},
		__noSuchMethod__: function(name, args){
			var ps = args[0];
			return {
				title: (name == 'regular') ? '' : this.getTitle(ps),
				body: eval( this.renderingTemplates[name] ).toString()
			};
		},
	},
	post : function(params){
		var content;
		var self = this;
		return models.Hatena.getToken().addCallback(function(token){
			content = self.converters[params.type](params);
			content.rkm = token;
			return models.Hatena.getCurrentUser();
		}).addCallback(function(id){
			var endpoint = [self.POST_URL, id, ''].join('/');
			return request( endpoint, {
				redirectionLimit : 0,
				referrer    : endpoint,
				sendContent : content
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
				queryString :	{
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
				queryString :	{
					rks   : token,
					uri   : ps.itemUrl,
					quote : joinText([ps.body, ps.description], ' ', true),
				},
			});
		});
	},
});

models.register(update({
	name : 'LivedoorClip',
	ICON : 'http://clip.livedoor.com/favicon.ico',
	POST_URL : 'http://clip.livedoor.com/clip/add',

	check : function(ps){
		return (/(photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return LivedoorClip.getToken().addCallback(function(token){
			var content = {
				rate    : ps.rate? ps.rate : '',
				title   : ps.item,
				postKey : token,
				link    : ps.itemUrl,
				tags    : ps.tags? ps.tags.join(' ') : '',
				notes   : joinText([ps.body, ps.description], ' ', true),
				public  : ps.private? 'off' : 'on',
			};
			return request(LivedoorClip.POST_URL, {
				redirectionLimit : 0,
				sendContent : content,
			});
		});
	},
	
	getAuthCookie : function(){
		return getCookieString('livedoor.com', '.LRC');
	},
	
	getSuggestions : function(url){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		// 何かのURLを渡す必要がある
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
				return request(LivedoorClip.POST_URL+'?link=http%3A%2F%2Ftombloo/').addCallback(function(res){
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
	name: 'Femo',
	ICON: 'http://femo.jp/favicon.ico',
	POST_URL: 'http://femo.jp/create/post',
	
	check: function(ps) {
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	post: function(ps) {
		return this.addMemo(ps);
	},
	
	addMemo : function(ps){
		return request(this.POST_URL, {
			sendContent: {
				title   : ps.item,
				text    : joinText([ps.itemUrl, ps.body, ps.description], '\n'),
				tagtext : joinText(ps.tags, ' '),
			},
		});
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
		return getCookieString('librarything.com', 'LTAnonSessionID');
	},
	
	post : function(ps){
		if(!this.getAuthCookie())
			throw new Error(getMessage('error.notLoggedin'));
		
		return request('http://www.librarything.com/import_submit.php', {
			sendContent : {
				form_textbox : ps.itemUrl,
			},
		}).addCallback(function(res){
			var err = res.channel.URI.asciiSpec.extract('http://www.librarything.com/import.php?pastealert=(.*)');
			if(err)
				throw new Error(err);
			
			var doc = convertToHTMLDocument(res.responseText);
			return request('http://www.librarything.com/import_questions_submit.php', {
				redirectionLimit : 0,
				sendContent : update(formContents(doc), {
					masstags :	joinText(ps.tags, ','),
				}),
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
