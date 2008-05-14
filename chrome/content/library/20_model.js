var FFFFOUND = {
	URL : 'http://FFFFOUND.com/',
	
	getToken : function(){
		return doXHR(FFFFOUND.URL + 'bookmarklet.js').addCallback(function(res){
			return res.responseText.match(/token='(.*?)'/)[1];
		});
	},
	
	post : function(ps){
		return this.getToken().addCallback(function(token){
			return doXHR(FFFFOUND.URL + 'add_asset', {
				referrer : ps.href,
				queryString : {
					token   : token,
					url     : ps.source,
					referer : ps.href,
					title   : ps.title,
				},
			}).addCallback(function(res){
				if(res.responseText.match('(FAILED:|ERROR:) (.*?)</span>'))
					throw RegExp.$2;
				
				if(res.responseText.match('login'))
					throw 'AUTH_FAILD';
			});
		});
	},
	
	remove : function(id){
		// 200 {"success":false}
		return doXHR(FFFFOUND.URL + 'gateway/in/api/remove_asset', {
			referrer : FFFFOUND.URL,
			sendContent : {
				collection_id : id,
			},
		});
	},
	
	iLoveThis : function(id){
		return doXHR(FFFFOUND.URL + 'gateway/in/api/add_asset', {
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
}

var Amazon = {
	getItem : function(asin){
		return doXHR('http://webservices.amazon.co.jp/onca/xml', {
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
}

var Flickr = {
	callMethod : function(ps){
		return doXHR('http://flickr.com/services/rest/', {
			queryString : update({
				api_key        : 'ecf21e55123e4b31afa8dd344def5cc5',
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
		return this.getToken(ps.photo_id).addCallback(function(page){
			ps = update(update({
				nojsoncallback : 1,
				format         : 'json',
				src            : 'js',
				cb             : new Date().getTime(),
			}, page.token), ps);
			ps.api_sig = (page.secret + keys(ps).sort().map(function(key){
				return key + ps[key]
			}).join('')).md5();
			
			return doXHR('http://flickr.com/services/rest/', {
				sendContent : ps,
			});
		}).addCallback(function(res){
			eval('var json=' + res.responseText);
			if(json.stat!='ok')
				throw json.message;
			return json;
		});
	},
	getToken : function(id){
		return this.getInfo(id).addCallback(function(photo){
			return doXHR(photo.urls.url[0]._content);
		}).addCallback(function(res){
			var html = res.responseText;
			return {
				secret : html.extract(/global_flickr_secret[ =]+'(.*?)'/),
				token  : {
					api_key    : html.extract(/global_magisterLudi[ =]+'(.*?)'/),
					auth_hash  : html.extract(/global_auth_hash[ =]+'(.*?)'/),
					auth_token : html.extract(/global_auth_token[ =]+'(.*?)'/),
				},
			};
		});
	},
	addFavorite : function(id){
		return this.callAuthMethod({
			method   : 'flickr.favorites.add',
			photo_id : id,
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
		}).addCallback(function(json){
			return json.sizes.size;
		});
	},
	getInfo : function(id){
		return this.callMethod({
			method   : 'flickr.photos.getInfo',
			photo_id : id,
		}).addCallback(function(json){
			return json.photo;
		});
	},
}

var WeHeartIt = {
	URL : 'http://weheartit.com/',
	
	post : function(ps){
		return doXHR(WeHeartIt.URL + 'add.php', {
			referrer : ps.clickThrough,
			queryString : {
				title : ps.title,
				via : ps.clickThrough,
				img : ps.source,
			},
		}).addCallback(function(res){
			if(!res.responseText.match('logout'))
				throw 'AUTH_FAILD';
		});
	},
	
	iHeartIt : function(id){
		return doXHR(WeHeartIt.URL + 'inc_heartedby.php', {
			referrer : ps.clickThrough,
			queryString : {
				do : 'heart',
				entry : id,
			},
		}).addCallback(function(res){
			if(!res.responseText.match('logout'))
				throw 'AUTH_FAILD';
		});
	},
}

var HatenaBookmark = {
	POST_URL : 'http://b.hatena.ne.jp/add',
	
	getToken : function(){
		return doXHR(HatenaBookmark.POST_URL).addCallback(function(res){
			if(res.responseText.match(/Hatena\.rkm\s*=\s*['"](.+?)['"]/))
				return RegExp.$1;
			
			throw 'AUTH_FAILD';
		});
	},
	post : function(ps){
		return HatenaBookmark.getToken().addCallback(function(token){
			var content = {
				mode    : 'enter',
				rkm     : token,
				url     : ps.source,
				comment : (ps.tags? '[' + ps.tags.join('][') + ']' : '') + ps.body,
			};
			if(ps.title)
				content.title = ps.title;
			return doXHR(HatenaBookmark.POST_URL, {
				sendContent : content,
			});
		});
	},
}

// copied from http://userscripts.org/scripts/show/19741
var GoogleWebHistory = {
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
	},
	post : function(url){
		return doXHR('http://www.google.com/search?client=navclient-auto&ch=' + GoogleWebHistory.getCh(url) + '&features=Rank&q=info:' + escape(url));
	},
}

var GoogleBookmarks = {
	post : function(ps){
		return doXHR('http://www.google.com/bookmarks/mark', {
			queryString :	{
				op : 'add',
			},
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(doc.getElementById('gaia_loginform'))
				throw 'AUTH_FAILD';
			
			var fs = formContents(doc);
			return doXHR('http://www.google.com'+$x('//form[@name="add_bkmk_form"]/@action', doc), {
				sendContent  : {
					title      : ps.title,
					bkmk       : ps.source,
					annotation : ps.body,
					labels     : ps.tags? ps.tags.join(',') : '',
					btnA       : fs.btnA,
					sig        : fs.sig,
				},
			});
		});
	},
}

var Twitter = {
	getToken : function(){
		return doXHR('http://twitter.com/account/settings').addCallback(function(res){
			var html = res.responseText;
			if(html.indexOf('signin')!=-1)
				throw 'AUTH_FAILD';
			
			return {
				authenticity_token : html.extract(/authenticity_token.+value="(.+?)"/),
				siv                : html.extract(/logout\?siv=(.+?)"/),
			}
		});
	},
	post : function(ps){
		return Twitter.getToken().addCallback(function(token){
			token.status = [ps.title, ps.source, ps.body].filter(operator.truth).join(' ');
			return doXHR('http://twitter.com/status/update', update({
				sendContent : token,
			}));
		});
	},
	remove : function(id){
		return Twitter.getToken().addCallback(function(ps){
			ps._method = 'delete';
			return doXHR('http://twitter.com/status/destroy/' + id, {
				referrer : 'http://twitter.com/home',
				sendContent : ps,
			});
		});
	},
	addFavorite : function(id){
		return Twitter.getToken().addCallback(function(ps){
			return doXHR('http://twitter.com/favourings/create/' + id, {
				referrer : 'http://twitter.com/home',
				sendContent : ps,
			});
		});
	},
}

var Delicious = {
	post : function(ps){
		return doXHR('http://del.icio.us/post/', {
			queryString :	{
				url   : ps.source,
				title : ps.title,
			},
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			if(!doc.getElementById('delForm'))
				throw 'AUTH_FAILD';
			
			return doXHR('http://del.icio.us'+$x('id("delForm")/@action', doc), {
				sendContent : update(formContents(doc), {
					description : ps.title,
					jump        : 'no',
					notes       : ps.body,
					tags        : ps.tags? ps.tags.join(' ') : '',
					private     : ps.private? 'on' : '',
				}),
			});
		});
	},
}

var HatenaStar = {
	getToken : function(){
		return doXHR('http://s.hatena.ne.jp/entries.json').addCallback(function(res){
			if(!res.responseText.match(/"rks":"(.*?)"/))
				throw 'AUTH_FAILD'
			return RegExp.$1;
		})
	},
	post : function(ps){
		return HatenaStar.getToken().addCallback(function(token){
			return doXHR('http://s.hatena.ne.jp/star.add.json', {
				queryString :	{
					rks      : token,
					title    : ps.title,
					quote    : ps.body,
					location : ps.href,
					uri      : ps.source,
				},
			});
		});
	},
	remove : function(ps){
		return HatenaStar.getToken().addCallback(function(token){
			return doXHR('http://s.hatena.ne.jp/star.delete.json', {
				queryString :	{
					rks   : token,
					uri   : ps.source,
					quote : ps.body,
				},
			});
		});
	},
}

var YahooBookmarks = {
	post : function(ps){
		return doXHR('http://bookmarks.yahoo.co.jp/action/post').addCallback(function(res){
			if(res.responseText.indexOf('login_form')!=-1)
				throw 'AUTH_FAILD';
			
			return formContents($x('(id("addbookmark")//form)[1]', convertToHTMLDocument(res.responseText)));
		}).addCallback(function(fs){
			return doXHR('http://bookmarks.yahoo.co.jp/action/post/done', {
				sendContent  : {
					title      : ps.title,
					url        : ps.source,
					desc       : ps.body,
					tags       : ps.tags? ps.tags.join(' ') : '',
					crumbs     : fs.crumbs,
					visibility : ps.private==null? fs.visibility : (ps.private? 0 : 1),
				},
			});
		});
	},
}
