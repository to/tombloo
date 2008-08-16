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
		if(ps.pageUrl.match('^http://ffffound.com/')){
			var id = ps.itemUrl.split('/').pop().replace(/[_\.].+/, '');
			return this.iLoveThis(id)
		}
		
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
				if(res.responseText.match('(FAILED:|ERROR:) (.*?)</span>'))
					throw RegExp.$2;
				
				if(res.responseText.match('login'))
					throw new Error(getMessage('error.notLoggedin'));
			});
		});
	},

	remove : function(id){
		// 200 {"success":false}
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
			// NOT_FOUND / EXISTS / AUTH_FAILD
			if(res.responseText.match(/"error":"(.*?)"/))
				throw RegExp.$1;
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
	
	getAuthCookie : function(){
		return getCookieString('flickr.com', 'cookie_accid');
	},
	
	check : function(ps){
		// Favoriteまたはキャプチャか
		// itemUrlをチェックしPhoto - Upload from Cacheを避ける
		return ps.type == 'photo' && 
			(ps.pageUrl.match('^http://www.flickr.com/photos/') || (!ps.itemUrl && ps.file));
	},
	
	post : function(ps){
		if(ps.file){
			return this.upload({
				photo       : ps.file,
				title       : ps.page || '',
				description : ps.description || '',
				is_public   : ps.private? 0 : 1,
				tags        : joinText(ps.tags, ' '),
			});
		} else {
			return this.addFavorite(ps.pageUrl.replace(/\/$/, '').split('/').pop());
		}
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
			return request('http://www.flickr.com/').addCallback(function(res){
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
}, AbstractSessionService));

models.register({
	name : 'WeHeartIt',
	ICON : 'http://weheartit.com/img/favicon.ico',
	URL : 'http://weheartit.com/',
	
	check : function(ps){
		return ps.type == 'photo' && !ps.file;
	},
	
	post : function(ps){
		if(ps.pageUrl.match('^http://weheartit.com/'))
			return this.iHeartIt(ps.source.split('/').pop());
		
		return request(WeHeartIt.URL + 'add.php', {
			referrer : ps.pageUrl,
			queryString : {
				via   : ps.pageUrl,
				title : ps.item,
				img   : ps.itemUrl,
			},
		}).addCallback(function(res){
			if(!res.responseText.match('logout'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},
	
	iHeartIt : function(id){
		return request(WeHeartIt.URL + 'inc_heartedby.php', {
			referrer : ps.pageUrl,
			queryString : {
				do    : 'heart',
				entry : id,
			},
		}).addCallback(function(res){
			if(!res.responseText.match('logout'))
				throw new Error(getMessage('error.notLoggedin'));
		});
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
		if(ps.pageUrl.match('^http://4u.straightline.jp/image/'))
			return this.iLoveHer(ps);
		
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
			if(!res.responseText.match('logout'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},

	iLoveHer : function(ps){
		// request(ps.pageUrl)
		// FIXME: id
		if(!ps.id)
			return;
		
		return request(this.URL + 'user/manage/do_register', {
			redirectionLimit : 0,
			referrer : ps.pageUrl,
			queryString : {
				src : ps.id,
			},
		}).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login')){
				throw new Error(getMessage('error.notLoggedin'));
			}
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
	
	// Mark James
	// http://www.famfamfam.com/lab/icons/silk/
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
				var uri = broad(createURI(ps.itemUrl));
				var fileName = validateFileName(uri.fileName);
				file.append(fileName);
			}
			clearCollision(file);
			
			return succeed().addCallback(function(){
				if(ps.file){
					return ps.file.copyTo(file.parent, file.leafName);
				} else {
					return download(ps.itemUrl, file);
				}
			}).addCallback(function(file){
				if(AppInfo.OS == 'Darwin'){
					var script = getTempDir();
					script.append('setcomment.scpt');
					
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
	name : 'Twitter',
	ICON : 'http://twitter.com/favicon.ico',
	
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type) && !ps.file;
	},
	
	getToken : function(){
		return request('http://twitter.com/account/settings').addCallback(function(res){
			var html = res.responseText;
			if(html.indexOf('signin')!=-1)
				throw new Error(getMessage('error.notLoggedin'));
			
			return {
				authenticity_token : html.extract(/authenticity_token.+value="(.+?)"/),
				siv                : html.extract(/logout\?siv=(.+?)"/),
			}
		});
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
	
	getUserTags : function(user){
		// 同期でエラーが起きないようにする
		return succeed().addCallback(function(){
			return request('http://feeds.delicious.com/feeds/json/tags/' + (user || Delicious.getCurrentUser()));
		}).addCallback(function(res){
			var tags = Components.utils.evalInSandbox(
				res.responseText, 
				Components.utils.Sandbox('http://feeds.delicious.com/'));
			return reduce(function(memo, tag){
				memo.push({
					name      : tag[0],
					frequency : tag[1],
				});
				return memo;
			}, tags, []);
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

models.register({
	name : 'Instapaper',
	ICON : 'chrome://tombloo/skin/instapaper.ico',
	
	check : function(ps){
		return (/(quote|link)/).test(ps.type) && !ps.file;
	},
	
	post : function(ps){
		return request('http://www.instapaper.com/edit', {
			redirectionLimit : 0,
			sendContent : {
				'bookmark[title]' : ps.item, 
				'bookmark[url]' : ps.itemUrl,
				'bookmark[selection]' : joinText([ps.body, ps.description], '\n', true),
			},
		}).addCallback(function(res){
			if(res.channel.URI.asciiSpec.match('login'))
				throw new Error(getMessage('error.notLoggedin'));
		});
	},
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
	
	getUserTags : function(){
		return request('http://bookmarks.yahoo.co.jp/bookmarklet/showpopup').addCallback(function(res){
			if(res.responseText.match(/yourtags =(.*)(;|$)/)[1]){
				return reduce(function(memo, tag){
					memo.push({
						name      : tag,
						frequency : -1,
					});
					return memo;
				}, Components.utils.evalInSandbox(RegExp.$1, Components.utils.Sandbox('http://bookmarks.yahoo.co.jp/')), []);
			}
			
			throw new Error(getMessage('error.notLoggedin'));
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
			// 画面要素やDBアクセスが少なそうなためブックマーク入力画面から取得する
			var self = this;
			return request(HatenaBookmark.POST_URL).addCallback(function(res){
				if(res.responseText.match(/Hatena\.rkm\s*=\s*['"](.+?)['"]/))
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
		return ps.type=='photo' && ps.file;
	},
	
	post : function(ps){
		return this.upload({
			image1     : ps.file,
			fototitle1 : ps.page,
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
				redirectionLimit : 0,
				sendContent : update({
					mode : 'enter',
				}, ps),
			});
		});
	},
});

models.register({
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
	
	addBookmark : function(url, title, tags, description){
		return Hatena.getToken().addCallback(function(token){
			return request(HatenaBookmark.POST_URL, {
				redirectionLimit : 0,
				sendContent : {
					mode    : 'enter',
					rkm     : token,
					url     : url,
					title   : title, 
					comment : Hatena.reprTags(tags) + description.replace(/[\n\r]+/g, ' '),
				},
			});
		});
	},
	
	getUserTags : function(){
		return request(HatenaBookmark.POST_URL+'?mode=confirm').addCallback(function(res){
			if(!res.responseText.match(/var tags ?=(.*);/))
				throw new Error(getMessage('error.notLoggedin'));
			
			return reduce(function(memo, tag){
				memo.push({
					name      : tag,
					frequency : -1,
				});
				return memo;
			}, Components.utils.evalInSandbox(RegExp.$1, Components.utils.Sandbox('http://b.hatena.ne.jp/')), []);
		});
	},
});

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
			regular: '<>{ps.description}</>',
			photo: '<><blockquote class="tombloo_photo" cite={ps.pageUrl} title={ps.page}><img src={ps.itemUrl} /></blockquote>{ps.description}</>',
			link: '<><div class="tombloo_link"><a href={ps.pageUrl} title={ps.page}>{ps.page}</a></div>{ps.description}</>',
			quote: '<>blockquote class="tombloo_quote" cite={ps.pageUrl} title={ps.page}>{ps.body}</blockquote>{ps.description}</>',
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
	
	getUserTags : function(){
		if(!this.getAuthCookie())
			return fail(new Error(getMessage('error.notLoggedin')));
		
		return request(LivedoorClip.POST_URL+'?link=http%3A%2F%2Ftombloo/').addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return $x('id("tag_list")/span/text()', doc, true).map(function(tag){
				return {
					name      : tag,
					frequency : -1,
				};
			});
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
		return request('http://wassr.jp/my/').addCallback(function(res){
			return request('http://wassr.jp/my/status/add', {
				redirectionLimit : 0,
				sendContent : update(formContents(convertToHTMLDocument(res.responseText)), {
					message : joinText([ps.item, ps.itemUrl, ps.body, ps.description], ' ', true),
				}),
			});
		})
	},
});

// 全てのサービスをグローバルコンテキストに置く(後方互換)
models.copyTo(this);

/**
 * デフォルトのサービスのリストを取得する。
 * ユーザーの設定が適用される。
 *
 * @return {Array}
 */
models.getDefaults = function(ps){
	var config = eval(getPref('postConfig'));
	return this.check(ps).filter(function(m){
		return config[m.name] && config[m.name][ps.type];
	});
}

/**
 * 利用可能なサービスのリストを取得する。
 * ユーザーの設定が適用される。
 *
 * @return {Array}
 */
models.getEnables = function(ps){
	var config = eval(getPref('postConfig'));
	function getPostConfigValue(name, type){
		switch((config[name] || {})[type]){
		case true:  return 'default';
		case false: return 'enable';
		case '':    return 'disable';
		default:    return 'undefined';
		}
	}
	
	return this.check(ps).filter(function(m){
		m.config = (m.config || {});
		
		// クイックポストフォームにて、取得後にデフォルトなのか利用可能なのかを
		// 判定する必要があったため、サービスに設定値を保存し返す
		var val = m.config[ps.type] = getPostConfigValue(m.name, ps.type);
		return (/(default|enable)/).test(val);
	});
}
