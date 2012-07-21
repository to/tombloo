Tombloo.Service.extractors = new Repository([
	{
		name : 'LDR',
		getItem : function(ctx, getOnly){
			if(ctx.host != 'reader.livedoor.com' && ctx.host != 'fastladder.com')
				return;
			
			var item  = $x('ancestor-or-self::div[starts-with(@id, "item_count")]', ctx.target);
			if(!item)
				return;
			
			var channel = $x('id("right_body")/div[@class="channel"]//a');
			var res = {
				author : ($x('div[@class="item_info"]/*[@class="author"]/text()', item) || '').extract(/by (.*)/),
				title  : $x('div[@class="item_header"]//a/text()', item) || '',
				feed   : channel.textContent,
				href   : $x('(div[@class="item_info"]/a)[1]/@href', item).replace(/[?&;](fr?(om)?|track|ref|FM)=(r(ss(all)?|df)|atom)([&;].*)?/,'') || channel.href,
			};
			
			var uri = createURI(res.href);
			if(!getOnly){
				ctx.title = res.feed + (res.title? ' - ' + res.title : '');
				ctx.href  = res.href;
				ctx.host  = uri.host;
			}
			
			return res
		},
	},
	
	{
		name : 'Quote - LDR',
		ICON : 'http://reader.livedoor.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.LDR.getItem(ctx, true) && ctx.selection;
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				LDR.getItem(ctx);
				return Quote.extract(ctx);
			}
		},
	},
	
	{
		name : 'ReBlog - LDR',
		ICON : 'http://reader.livedoor.com/favicon.ico',
		check : function(ctx){
			var item = Tombloo.Service.extractors.LDR.getItem(ctx, true);
			return item && (
				item.href.match('^http://.*?\\.tumblr\\.com/') ||
				(ctx.onImage && ctx.target.src.match('^http://data\.tumblr\.com/')));
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				LDR.getItem(ctx);
				return ReBlog.extractByLink(ctx, ctx.href);
			}
		},
	},
	
	{
		name: 'ReBlog - Clipp',
		ICON: 'http://clipp.in/favicon.ico',
		check: function(ctx) {
			return this.getLink(ctx);
		},
		extract: function(ctx) {
			var link = this.getLink(ctx);
			if(!link)
				return {};
			
			var self = this;
			var endpoint = Clipp.CLIPP_URL + 'bookmarklet' + link;
			return Clipp.getForm(endpoint).addCallback(function(form) {
				return update({
					type     : 'link',
					item     : ctx.title,
					itemUrl  : ctx.href,
					favorite : {
						name     : 'Clipp',
						endpoint : endpoint,
						form     : form
					}
				}, self.convertToParams(form));
			});
		},
		checkEntryPage: function(ctx) {
			return (/clipp.in\/entry\/(\d+)/).test(ctx.href);
		},
		getLink: function(ctx) {
			return this.checkEntryPage(ctx) ? this.getLinkByPage(currentDocument()) : this.getLinkByTarget(ctx);
		},
		getLinkByPage: function(doc) {
			return $x('//a[contains(@href, "add?reblog=")]/@href', doc);
		},
		getLinkByTarget: function(ctx) {
			return $x('./ancestor-or-self::div[contains(concat(" ", @class, " "), " item ")]//a[contains(@href, "add?reblog=")]/@href', ctx.target);
		},
		convertToParams: function(form) {
			if (form.embed_code)
				return {
					type: 'video',
					item: form.title,
					itemUrl: form.address,
					body: form.embed_code
				};
			else if (form.image_address)
				return {
					type: 'photo',
					item: form.title,
					itemUrl: form.image_address
				};
			else if (form.quote && form.quote != '<br>')
				return {
					type: 'quote',
					item: form.title,
					itemUrl: form.address,
					body: form.quote
				};
			return {
				type: 'link',
				item: form.title,
				itemUrl: form.address
			};
		}
	},
	
	{
		name : 'Photo - LDR(FFFFOUND!)',
		ICON : 'http://reader.livedoor.com/favicon.ico',
		check : function(ctx){
			var item = Tombloo.Service.extractors.LDR.getItem(ctx, true);
			return item &&
				ctx.onImage &&
				item.href.match('^http://ffffound\\.com/');
		},
		extract : function(ctx){
			var item = Tombloo.Service.extractors.LDR.getItem(ctx);
			ctx.title = item.title;
			
			with(createURI(ctx.href))
				ctx.href = prePath + filePath;
			
			return {
				type      : 'photo',
				item      : item.title,
				itemUrl   : ctx.target.src.replace(/_m(\..{3})/, '$1'),
				author    : item.author,
				authorUrl : 'http://ffffound.com/home/' + item.author + '/found/',
				favorite : {
					name : 'FFFFOUND',
					id   : ctx.href.split('/').pop(),
				},
			};
		},
	},
	
	{
		name : 'Photo - LDR',
		ICON : 'http://reader.livedoor.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.LDR.getItem(ctx, true) &&
				ctx.onImage;
		},
		extract : function(ctx){
			var exts = Tombloo.Service.extractors;
			exts.LDR.getItem(ctx);
			return exts.check(ctx)[0].extract(ctx);
		},
	},
	
	{
		name : 'Link - LDR',
		ICON : 'http://reader.livedoor.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.LDR.getItem(ctx, true);
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				LDR.getItem(ctx);
				return Link.extract(ctx);
			}
		},
	},
	
	{
		name : 'GoogleReader',
		getItem : function(ctx, getOnly){
			if(!ctx.href.match('//www.google.[^/]+/reader/'))
				return;
			
			var item  = $x('ancestor-or-self::div[contains(concat(" ",@class," ")," entry ")]', ctx.target);
			if(!item)
				return;
			
			var res = {
				author : ($x('descendant::div[@class="entry-author"]/*[@class="entry-author-name"]/text()', item) || ''),
				title  : $x('descendant::a[@class="entry-title-link"]/text()', item) || '',
				feed   : ($x('descendant::a[@class="entry-source-title"]/text()', item) || $x('id("chrome-stream-title")//a/text()')),
				href   : $x('descendant::a[@class="entry-title-link"]/@href', item).replace(/[?&;](fr?(om)?|track|ref|FM)=(r(ss(all)?|df)|atom)([&;].*)?/,''),
			};
			
			if(!getOnly){
				ctx.title = res.feed + (res.title? ' - ' + res.title : '');
				ctx.href  = res.href;
				ctx.host  = res.href.match('http://(.*?)/')[1];
			}
			
			return res
		},
	},
	
	{
		name : 'Quote - GoogleReader',
		ICON : 'http://www.google.com/reader/ui/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.GoogleReader.getItem(ctx, true) && ctx.selection;
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				GoogleReader.getItem(ctx);
				return Quote.extract(ctx);
			}
		},
	},
	
	{
		name : 'ReBlog - GoogleReader',
		ICON : 'http://www.google.com/reader/ui/favicon.ico',
		check : function(ctx){
			var item = Tombloo.Service.extractors.GoogleReader.getItem(ctx, true);
			return item && (
				item.href.match('^http://.*?\\.tumblr\\.com/') ||
				(ctx.onImage && ctx.target.src.match('^http://data\.tumblr\.com/')));
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				GoogleReader.getItem(ctx);
				return ReBlog.extractByLink(ctx, ctx.href);
			}
		},
	},
	
	{
		name : 'Photo - GoogleReader(FFFFOUND!)',
		ICON : 'http://www.google.com/reader/ui/favicon.ico',
		check : function(ctx){
			var item = Tombloo.Service.extractors.LDR.getItem(ctx, true);
			return item &&
				ctx.onImage &&
				item.href.match('^http://ffffound\\.com/');
		},
		extract : function(ctx){
			var item = Tombloo.Service.extractors.GoogleReader.getItem(ctx);
			ctx.title = item.title;
			
			with(createURI(ctx.href))
				ctx.href = prePath + filePath;
			
			return {
				type      : 'photo',
				item      : item.title,
				itemUrl   : ctx.target.src.replace(/_m(\..{3})/, '$1'),
				author    : item.author,
				authorUrl : 'http://ffffound.com/home/' + item.author + '/found/',
				favorite : {
					name : 'FFFFOUND',
					id   : ctx.href.split('/').pop(),
				},
			};
		},
	},
	
	{
		name : 'Photo - GoogleReader',
		ICON : 'http://www.google.com/reader/ui/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.GoogleReader.getItem(ctx, true) &&
				ctx.onImage;
		},
		extract : function(ctx){
			var exts = Tombloo.Service.extractors;
			exts.GoogleReader.getItem(ctx);
			return exts.check(ctx)[0].extract(ctx);
		},
	},
	
	{
		name : 'Link - GoogleReader',
		ICON : 'http://www.google.com/reader/ui/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.GoogleReader.getItem(ctx, true);
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				GoogleReader.getItem(ctx);
				return Link.extract(ctx);
			}
		},
	},
	
	{
		name : 'Quote - Twitter',
		ICON : models.Twitter.ICON,
		check : function(ctx){
			return ctx.href.match('//twitter.com/.*?/(status|statuses)/\\d+');
		},
		extract : function(ctx){
			return {
				type     : 'quote',
				item     : ctx.title.substring(0, ctx.title.indexOf(': ')),
				itemUrl  : ctx.href,
				body     : createFlavoredString(ctx.selection? 
					ctx.window.getSelection() : 
					ctx.document.querySelector('.js-tweet-text') || 
					ctx.document.querySelector('.tweet-text-large') || 
					ctx.document.querySelector('.entry-content')),
				favorite : {
					name : 'Twitter',
					id   : ctx.href.match(/(status|statuses)\/(\d+)/)[2],
				},
			}
		},
	},
	
	{
		name : 'Quote - inyo.jp',
		ICON : 'chrome://tombloo/skin/quote.png',
		check : function(ctx){
			return ctx.href.match('//inyo.jp/quote/[a-f0-9]+');
		},
		extract : function(ctx){
			return {
				type     : 'quote',
				item     : $x('//span[@class="title"]/text()'),
				itemUrl  : ctx.href,
				body     : createFlavoredString((ctx.selection)? 
					ctx.window.getSelection() : $x('//blockquote[contains(@class, "text")]/p')),
			}
		},
	},
	
	{
		name : 'Amazon',
		getAsin : function(ctx){
			return $x('id("ASIN")/@value');
		},
		normalizeUrl : function(host, asin){
			return  'http://' + host + '/o/ASIN/' + asin + 
				(this.affiliateId ? '/' + this.affiliateId + '/ref=nosim' : '');
		},
		get affiliateId(){
			return getPref('amazonAffiliateId');
		},
		preCheck : function(ctx){
			return ctx.host.match(/amazon\./) && this.getAsin(ctx);
		},
		extract : function(ctx){
			// 日本に特化(comの取得方法不明)
			var date = new Date(ctx.document.body.innerHTML.extract('発売日：.*?</b>.*?([\\d/]+)'));
			if(!isNaN(date))
				ctx.date = date;
			
			ctx.href = this.normalizeUrl(ctx.host, this.getAsin(ctx));
			
			var elmTitle = $x('id("btAsinTitle")');
			if(!elmTitle)
				return
			
			var authors = $x([
				'id("handleBuy")/div[@class="buying"]/span//a/text()',
				'id("handleBuy")/div[@class="buying"]/a/text()'
			].join('|'), currentDocument(), true);
			
			ctx.title = 'Amazon: ' + 
				elmTitle.textContent + 
				(authors.length? ': ' + authors.join(', ') : '');
		},
	},
	
	{
		name : 'Photo - Amazon',
		ICON : 'http://www.amazon.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.Amazon.preCheck(ctx) && 
				($x('./ancestor::*[@id="prodImageCell" or @id="prodImageOuter"]', ctx.target) || ctx.target.id == 'magnifierLens');
		},
		extract : function(ctx){
			Tombloo.Service.extractors.Amazon.extract(ctx);
			
			var d = new Deferred();
			
			// 拡大レンズなど画像以外の要素か?
			if(!ctx.target.src)
				ctx.target = $x('id("prodImageCell")/img | id("main-image")');
			
			// tools4hack
			// http://tools4hack.santalab.me/new-ipad-get-largeartwork-amazon-img.html
			var elmImage = IMG({
				src : 'http://z-ecx.images-amazon.com/images/P/' + 
					Tombloo.Service.extractors.Amazon.getAsin(ctx) + 
					'.09.MAIN._FMpng_SCRMZZZZZZ_.png'
			});
			elmImage.onload = function(){
				// 画像が存在しない場合1ピクセル四方の画像が返される
				if(elmImage.width < 50 && elmImage.height < 50)
					return elmImage.onerror();
				
				d.callback(elmImage.src);
			}
			
			// 画像が存在していてもエラーになることがある
			elmImage.onerror = function(){
				var url = ctx.target.src.split('.');
				url.splice(-2, 1, 'LZZZZZZZ');
				url = url.join('.').replace('.L.LZZZZZZZ.', '.L.'); // カスタマーイメージ用
				
				d.callback(url);
			}
			
			d.addCallback(function(url){
				with(ctx.target){
					src = url
					height = '';
					width = '';
					style.height = 'auto';
					style.width = 'auto';
				}
				
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : url,
				};
			});
			
			return d;
		},
	},
	
	{
		name : 'Quote - Amazon',
		ICON : 'http://www.amazon.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.Amazon.preCheck(ctx) && ctx.selection;
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				Amazon.extract(ctx);
				return Quote.extract(ctx);
			}
		},
	},

	{
		name : 'Link - Amazon',
		ICON : 'http://www.amazon.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.Amazon.preCheck(ctx);
		},
		extract : function(ctx){
			with(Tombloo.Service.extractors){
				Amazon.extract(ctx);
				return Link.extract(ctx);
			}
		},
	},
	
	{
		name : 'ReBlog',
		extractByLink : function(ctx, link){
			var self = this;
			return request(link).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				ctx.href = link;
				ctx.title = ($x('//title/text()', doc) || '').replace(/[\n\r]/g, '');
				
				return self.extractByPage(ctx, doc);
			});
		},
		
		extractByPage : function(ctx, doc){
      var m = unescapeHTML(this.getFrameUrl(doc)).match(/.+&pid=([^&]*)&rk=([^&]*)/);
			return this.extractByEndpoint(ctx, Tumblr.TUMBLR_URL+'reblog/' + m[1] + '/' + m[2]);
		},
		
		extractByEndpoint : function(ctx, endpoint){
			var self = this;
			return Tumblr.getForm(endpoint).addCallback(function(form){
				return update({
					type     : form['post[type]'],
					item     : ctx.title,
					itemUrl  : ctx.href,
					favorite : {
						name     : 'Tumblr',
						endpoint : endpoint,
						form     : form,
					},
				}, self.convertToParams(form));
			})
		},
		
		getFrameUrl : function(doc){
			return $x('//iframe[starts-with(@src, "http://assets.tumblr.com/iframe") and contains(@src, "pid=")]/@src', doc);
		},
		
		convertToParams	: function(form){
			switch(form['post[type]']){
			case 'regular':
				return {
					type    : 'quote',
					item    : form['post[one]'],
					body    : form['post[two]'],
				}
			
			case 'photo':
				return {
					itemUrl : form.image,
					body    : form['post[two]'],
				}
			
			case 'link':
				return {
					item    : form['post[one]'],
					itemUrl : form['post[two]'],
					body    : form['post[three]'],
				};
			
			case 'quote':
				// FIXME: post[two]検討
				return {
					body    : form['post[one]'],
				};
			
			case 'video':
				// FIXME: post[one]検討
				return {
					body    : form['post[two]'],
				};
			
			case 'conversation':
				return {
					item : form['post[one]'],
					body : form['post[two]'],
				};
			}
		},
	},
	
	{
		name : 'ReBlog - Tumblr',
		ICON : 'chrome://tombloo/skin/reblog.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.ReBlog.getFrameUrl(currentDocument());
		},
		extract : function(ctx){
			return Tombloo.Service.extractors.ReBlog.extractByPage(ctx, currentDocument());
		},
	},
	
	{
		name : 'ReBlog - Dashboard',
		ICON : 'chrome://tombloo/skin/reblog.ico',
		check : function(ctx){
			return (/(tumblr-beta\.com|tumblr\.com)\//).test(ctx.href) && this.getLink(ctx);
		},
		extract : function(ctx){
			// タイトルなどを取得するためextractByLinkを使う(reblogリンクを取得しextractByEndpointを使った方が速い)
			return Tombloo.Service.extractors.ReBlog.extractByLink(ctx, this.getLink(ctx));
		},
		getLink : function(ctx){
			var link = $x(
				'./ancestor-or-self::li[starts-with(normalize-space(@class), "post")]' + 
				'//a[starts-with(@id,"permalink_")]', ctx.target);
			return link && link.href;
		},
	},
	
	{
		name: 'ReBlog - Tumblr Dashboard for iPhone',
		ICON: 'chrome://tombloo/skin/reblog.ico',
		check: function(ctx){
			return (/(tumblr\.com)\/iphone/).test(ctx.href) && this.getLink(ctx);
		},
		extract : function(ctx){
			return Tombloo.Service.extractors.ReBlog.extractByLink(ctx, this.getLink(ctx));
		},
		getLink : function(ctx){
			var link = $x('./ancestor-or-self::li[starts-with(normalize-space(@id), "post")]//a[contains(concat(" ",normalize-space(@class)," ")," permalink ")]', ctx.target);
			return link && link.href;
		}
	},
	
	{
		name : 'ReBlog - Mosaic',
		ICON : 'chrome://tombloo/skin/reblog.ico',
		check : function(ctx){
			return ctx.href.match(/mosaic.html/i) && ctx.target.photo;
		},
		extract : function(ctx){
			return Tombloo.Service.extractors.ReBlog.extractByLink(ctx, ctx.target.photo.url);
		},
	},
	
	{
		name : 'ReBlog - Tumblr link',
		ICON : 'chrome://tombloo/skin/reblog.ico',
		check : function(ctx){
			return ctx.link && ctx.link.href.match(/^http:\/\/[^.]+.tumblr\.com\/post\/\d+/);
		},
		extract : function(ctx){
			return Tombloo.Service.extractors.ReBlog.extractByLink(ctx, ctx.link.href);
		},
	},
	
	{
		name : 'Photo - Ameba blog',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return ctx.onLink && 
				ctx.host == ('ameblo.jp') &&
				ctx.onImage &&
				ctx.target.src.match(/\/t[0-9]+_/);
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : ctx.target.src.replace(/(\/t[0-9]+_)/, '/o'),
			};
		},
	},
	
	{
		name : 'Photo - Flickr',
		ICON : models.Flickr.ICON,
		
		RE : new RegExp('^http://(?:.+?.)?static.?flickr.com/\\d+?/(\\d+?)_.*'),
		getImageId : function(ctx){
			// 他サイトに貼られているFlickrにも対応する
			if(/flickr\.com/.test(ctx.host)){
				// ログインしているとphoto-drag-proxyが前面に表示される
				// アノテーション上の場合はphoto_notesの孫要素となる
				if(
					(ctx.target.src && ctx.target.src.match('spaceball.gif')) || 
					ctx.target.id == 'photo-drag-proxy' || 
					$x('./ancestor-or-self::div[@id="photo-drag-proxy"]', ctx.target)
				){
					ctx.target = $x('//div[@class="photo-div"]/img') || ctx.target;
				}
			}
			
			if(!ctx.target || !ctx.target.src || !ctx.target.src.match(this.RE))
				return;
			
			return RegExp.$1;
		},
		check : function(ctx){
			return this.getImageId(ctx);
		},
		extract : function(ctx){
			var id = this.getImageId(ctx);
			return new DeferredHash({
				'info'  : Flickr.getInfo(id),
				'sizes' : Flickr.getSizes(id),
			}).addCallback(function(r){
				if(!r.info[0])
					throw new Error(r.info[1].message);
				
				var info = r.info[1];
				var sizes = r.sizes[1];
				
				var title = info.title._content;
				ctx.title = title + ' on Flickr'
				ctx.href  = info.urls.url[0]._content;
				
				return {
					type      : 'photo',
					item      : title,
					itemUrl   : sizes.pop().source,
					author    : info.owner.username,
					authorUrl : ctx.href.extract('^(http://.*?flickr.com/photos/.+?/)'),
					favorite  : {
						name : 'Flickr',
						id   : id,
					},
				}
			}).addErrback(function(err){
				return Tombloo.Service.extractors['Photo'].extract(ctx);
			});
		},
	},
	
	{
		name : 'Photo - Google Book Search',
		ICON : models.Google.ICON,
		check : function(ctx){
			if(!(/^books.google./).test(ctx.host))
				return;
			
			return !!this.getImage(ctx);
		},
		extract : function(ctx){
			ctx.target = this.getImage(ctx);
			
			return Tombloo.Service.extractors['Photo - Upload from Cache'].extract(ctx);
		},
		getImage : function(ctx){
			// 標準モード
			var img = $x('./ancestor::div[@class="pageImageDisplay"]//img[contains(@src, "//books.google.")]', ctx.target);
			if(img)
				return img;
			
			// HTMLモード
			var div = $x('./ancestor::div[@class="html_page_image"]', ctx.target);
			if(div){
				var img = new Image();
				img.src = getStyle(div, 'background-image').replace(/url\((.*)\)/, '$1');
				
				return img;
			}
		},
	},
	
	{
		name : 'Photo - Kiva',
		check : function(ctx){
			return (ctx.onImage && this.isOriginalUrl(ctx.target.src)) || 
				(ctx.onLink && this.isOriginalUrl(ctx.link.href));
		},
		extract : function(ctx){
			return this.getFinalUrl(ctx.onLink? ctx.link.href : ctx.target.src).addCallback(function(url){
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : url,
				}
			});
		},
		isOriginalUrl : function(url){
			return /^http:\/\/www\.kiva\.org\/img\//.test(url);
		},
		getFinalUrl : function(original){
			var self = this;
			return getFinalUrl(original).addCallback(function(url){
				// ホスティングサイトに変わったか?
				if(!self.isOriginalUrl(url))
					return url;
				
				// s3と仮定してテストしてみる
				return getFinalUrl(original.replace('www', 's3'));
			}).addErrback(function(){
				return original;
			});
		},
	},
	
	{
		name : 'Photo - 4u',
		ICON : models['4u'].ICON,
		check : function(ctx){
			return ctx.onImage && 
				ctx.href.match('^http://4u.straightline.jp/image/') && 
				ctx.target.src.match('/static/upload/l/l_');
		},
		extract : function(ctx){
			var author = $x('(//div[@class="entry-information"]//a)[1]');
			var iLoveHer = $x('//div[@class="entry-item fitem"]//a/@href');
			return {
				type      : 'photo',
				item      : ctx.title.extract(/(.*) - 4U/i),
				itemUrl   : ctx.target.src,
				author    : author.textContent.trim(),
				authorUrl : author.href,
				favorite  : {
					name : '4u',
					id   : iLoveHer && decodeURIComponent(iLoveHer.extract('src=([^&]*)')),
				}
			};
		},
	},
	
	{
		name : 'Photo - We Heart It',
		ICON : models.WeHeartIt.ICON,
		check : function(ctx){
			return ctx.onImage &&
				ctx.href.match('^http://weheartit.com/entry/') &&
				ctx.target.src.match('^http://weheartit.com/images/');
		},
		extract : function(ctx){
			var author = $x('(//p[@class="hearters"]/a[@class="user"])[1]');
			return {
				type      : 'photo',
				item      : $x('id("content")//h3/text()'),
				itemUrl   : ctx.target.src,
				author    : author.textContent.trim(),
				authorUrl : author.href,
				favorite  : {
					name : 'WeHeartIt',
					id   : ctx.href.split('/').pop(),
				},
			};
		},
	},
	
	{
		name : 'Photo - Snipshot',
		ICON : models.Snipshot.ICON,
		check : function(ctx){
			return ctx.href.match('http://services.snipshot.com/edit/');
		},
		extract : function(ctx){
			var id = ctx.window.m ? ctx.window.m.id : ctx.window.snipshot.FILE;
			var info = ctx.window.SnipshotImport;
			
			if(info){
				ctx.href  = info.url;
				ctx.title = info.title;
			} else {
				ctx.href  = '';
				ctx.title = '';
			}
			
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : 'http://services.snipshot.com/save/'+id+'/snipshot_'+id+'.jpg',
			}
		},
	},
	
	{
		name : 'Photo - Fishki.Net',
		ICON : 'http://de.fishki.net/favicon.ico',
		check : function(ctx){
			return ctx.onImage &&
				ctx.target.src.match('//fishki.net/');
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : ctx.target.src.replace('//fishki.net/', '//de.fishki.net/'),
			}
		},
	},
	
	{
		name : 'Photo - BRIGIT',
		ICON : 'http://brigit.jp/img/favicon.gif',
		check : function(ctx){
			return ctx.host == 'brigit.jp' && $x('ancestor::div[@id="photo_1"]', ctx.target);
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : $x('preceding-sibling::img', ctx.target).src,
			}
		},
	},
	
	{
		name : 'Photo - Google',
		ICON : models.Google.ICON,
		check : function(ctx){
			return (ctx.onLink && ctx.link.href.match('http://lh..(google.ca|ggpht.com)/.*(png|gif|jpe?g)$'));
		},
		extract : function(ctx){
			return request(ctx.link.href).addCallback(function(res){
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : $x('//img[1]', convertToHTMLDocument(res.responseText)).src,
				}
			});
		},
	},
	
	{
		name : 'Photo - 1101.com/ajisha',
		ICON : 'http://www.1101.com/favicon.ico',
		check : function(ctx){
			return (ctx.onLink && ctx.link.href.match('http://www.1101.com/ajisha/p_.*.html'));
		},
		extract : function(ctx){
			return {
				type      : 'photo',
				item      : ctx.title,
				itemUrl   : ctx.link.href.replace(
					new RegExp('http://www.1101.com/ajisha/p_(.+).html'), 
					'http://www.1101.com/ajisha/photo/p_$1_z.jpg'),
			}
		},
	},
	
	{
		name : 'Photo - Picasa',
		ICON : 'http://picasaweb.google.com/favicon.ico',
		check : function(ctx){
			return (/picasaweb\.google\./).test(ctx.host) && ctx.onImage;
		},
		extract : function(ctx){
			var item = $x('//span[@class="gphoto-context-current"]/text()') || $x('//div[@class="lhcl_albumtitle"]/text()') || '';
			return {
				type      : 'photo',
				item      : item.trim(),
				itemUrl   : ctx.target.src.replace(/\?.*/, ''),
				author    : $x('id("lhid_user_nickname")/text()').trim(),
				authorUrl : $x('id("lhid_portraitlink")/@href'),
			}
		},
	},
	
	{
		name : 'Photo - Picoolio.co.uk',
		ICON : 'chrome://tombloo/skin/item.ico',
		check : function(ctx){
			return ctx.onImage &&
				ctx.target.src.match('//picoolio.co.uk/photos/');
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : ctx.target.src.replace(/(picoolio\.co\.uk\/photos)\/.+?\//, '$1/original/'),
			}
		},
	},
	
	{
		name : 'Photo - webshots',
		ICON : 'http://www.webshots.com/favicon.ico',
		check : function(ctx){
			return ctx.host.match('^.+\.webshots\.com') && this.getAuthor();
		},
		extract : function(ctx){
			var author = this.getAuthor();
			return {
				type      : 'photo',
				item      : $x('//div[@class="media-info"]/h1/text()'),
				itemUrl   : $x('//li[@class="fullsize first"]/a/@href'),
				author    : author.textContent.trim(),
				authorUrl : author.href,
			}
		},
		getAuthor : function(){
			return $x('(//img[@class="user-photo"])[1]/ancestor::a');
		},
	},
	
	{
		name : 'Photo - Blogger',
		ICON : 'https://www.blogger.com/favicon.ico',
		check : function(ctx){
			return ctx.onLink &&
				(''+ctx.link).match(/(png|gif|jpe?g)$/i) &&
				(''+ctx.link).match(/(blogger|blogspot)\.com\/.*\/s\d{2,}-h\//);
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : (''+ctx.link).replace(/\/(s\d{2,})-h\//, '/$1/'),
			}
		},
	},
	
	{
		name : 'Photo - Shorpy',
		ICON : 'http://www.shorpy.com/favicon.ico',
		check : function(ctx){
			return ctx.onImage &&
				ctx.target.src.match(/www.shorpy.com\/.*.preview\.jpg/i);
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : ctx.target.src.replace('\.preview\.jpg', '.jpg'),
			}
		},
	},
	
	{
		name : 'Photo - FFFFOUND!',
		ICON : models.FFFFOUND.ICON,
		check : function(ctx){
			return (ctx.href.match('http://ffffound.com/image/') && (/^asset/).test(ctx.target.id)) ||
				(ctx.onLink && ctx.link.href.match('http://ffffound.com/image/'));
		},
		extract : function(ctx){
			if(ctx.href.match('http://ffffound.com/image/') && (/^asset/).test(ctx.target.id)){
				var d = succeed(currentDocument());
			} else {
				var d = request(ctx.link.href).addCallback(function(res){
					// 相対パスを処理するためdocumentを渡す
					var doc = convertToHTMLDocument(res.responseText, ctx.document);
					
					ctx.href = ctx.link.href;
					ctx.target = $x('(//img[starts-with(@id, "asset")])', doc);
					
					return doc;
				})
			}
			
			d.addCallback(function(doc){
				var author = $x('//div[@class="saved_by"]/a[1]', doc);
				ctx.title = $x('//title/text()', doc) || '';
				
				var uri = createURI(ctx.href);
				ctx.href = uri.prePath + uri.filePath;
				
				return {
					type      : 'photo',
					item      : $x('//div[@class="title"]/a/text()', doc).trim(),
					itemUrl   : ctx.target.src.replace(/_m(\..{3})$/, '$1'),
					author    : author.textContent,
					authorUrl : author.href,
					favorite  : {
						name : 'FFFFOUND',
						id   : ctx.href.split('/').pop(),
					},
				}
			});
			
			return d;
		},
	},
	
	{
		name : 'Photo - Google Image Search',
		ICON : models.Google.ICON,
		check : function(ctx){
			return ctx.host == 'images.google.co.jp' &&
				ctx.onImage && ctx.onLink;
		},
		extract : function(ctx){
			var link  = $x('parent::a/@href', ctx.target);
			var itemUrl = decodeURIComponent(link.match(/imgurl=([^&]+)/)[1]);
			ctx.href = decodeURIComponent(link.match(/imgrefurl=([^&]+)/)[1]);
			
			return request(ctx.href).addCallback(function(res){
				ctx.title =
					res.responseText.extract(/<title.*?>([\s\S]*?)<\/title>/im).replace(/[\n\r]/g, '').trim() ||
					createURI(itemUrl).fileName;
				
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : itemUrl,
				}
			});
		},
	},
	
	{
		name : 'Photo - Frostdesign.net',
		ICON : 'http://mfrost.typepad.com/favicon.ico',
		check : function(ctx){
			return ctx.host == 'mfrost.typepad.com' && (ctx.onLink && ctx.link.href.match('http://mfrost.typepad.com/.shared/image.html'));
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : 'http://mfrost.typepad.com' + ctx.link.href.split('?').pop(),
			}
		},
	},
	
	{
		name : 'Photo - MediaWiki Thumbnail',
		ICON : 'http://www.mediawiki.org/favicon.ico',
		check : function(ctx){
			return ctx.onLink && 
				hasElementClass(ctx.document.body, 'mediawiki') && 
				/wiki\/.+:/.test(ctx.link.href) && 
				(/\.(svg|png|gif|jpe?g)$/i).test(ctx.link.href);
		},
		extract : function(ctx){
			return request(ctx.link.href).addCallback(function(res){
				// SVGの場合サムネイルを取得する
				var xpath = (/\.svg$/i).test(ctx.link.href)?
					'id("file")/a/img/@src':
					'id("file")/a/@href';
				
				return {
					type	  : 'photo',
					item	  : ctx.title,
					itemUrl : $x(xpath, convertToHTMLDocument(res.responseText))
				};
			});
		}
	},
	
	{
		name : 'Photo - ITmedia',
		ICON : 'http://www.itmedia.co.jp/favicon.ico',
		check : function(ctx){
			return ctx.onLink && ctx.link.href.match('http://image.itmedia.co.jp/l/im/');
		},
		extract : function(ctx){
			ctx.target = {
				src : ctx.link.href.replace('/l/im/', '/'),
			};
			return Tombloo.Service.extractors['Photo - Upload from Cache'].extract(ctx);
		}
	},
	
	{
		name : 'Photo - Cheezburger',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return ctx.onImage && /(thereifixedit\.files\.wordpress\.com|chzbgr\.com)/.test(ctx.target.src);
		},
		extract : function(ctx){
			var img = ctx.target;
			var src = capture(img, null, {
				w : img.naturalWidth,
				h : img.naturalHeight - 12,
			});
			return download(src, getTempDir(uriToFileName(ctx.href) + '.png')).addCallback(function(file){
				return {
					type : 'photo',
					item : ctx.title,
					file : file,
				}
			});
		},
	},
	
	{
		name : 'Photo - Tabelog',
		ICON : 'http://r.tabelog.com/favicon.ico',
		check : function(ctx){
			return /tabelog\.com/.test(ctx.host) && /link-(left|right)/.test(ctx.target.id);
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : $x('//p[@class="original-photo"]/a/@href'),
			}
		},
	},
	
	{
		name : 'Photo - Lightbox',
		ICON : 'chrome://tombloo/skin/photo.png',
		PATTERNS : [
			{re: /(nextLink|prevLink|hoverNav)/, image: 'lightboxImage'},
			{re: /(lbPrevLink|lbNextLink|lbImage)/, image: 'lbImage'}
		],
		getPattern : function(ctx){
			var id = ctx.target.id;
			var ps = this.PATTERNS;
			for(var i=0 ; i<ps.length ; i++)
				if(ps[i].re.test(id))
					return ps[i];
		},
		check : function(ctx){
			return !!this.getPattern(ctx);
		},
		extract : function(ctx){
			var img  = $x('id("' + this.getPattern(ctx).image + '")');
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : (img instanceof Ci.nsIDOMHTMLImageElement)? 
					img.src : 
					resolveRelativePath(img.style.backgroundImage.extract(/\([" ]*([^"]+)/), ctx.href),
			}
		}
	},
	
	{
		name : 'Photo - covered',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			if(!currentDocument().elementFromPoint || !ctx.onImage)
				return;
			
			// 1px四方の画像の上でクリックされたか?
			// FIXME: naturalHeight利用
			var img = IMG({src : ctx.target.src});
			return (img.width==1 && img.height==1);
		},
		extract : function(ctx){
			removeElement(ctx.target);
			
			return Tombloo.Service.extractors[ctx.bgImageURL?
				'Photo - background image' :
				'Photo - area element'].extract(ctx);
		},
	},
	
	{
		name : 'Photo - area element',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			if(currentDocument().elementFromPoint && tagName(ctx.target)=='area')
				return true;
		},
		extract : function(ctx){
			var target = ctx.target;
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : $x('//img[@usemap="#' + target.parentNode.name + '"]', target.ownerDocument).src,
			}
		},
	},
	
	{
		name : 'Photo - image link',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			if(!ctx.onLink)
				return;
			
			var uri = createURI(ctx.link.href);
			return uri && (/(png|gif|jpe?g)$/i).test(uri.fileExtension);
		},
		extract : function(ctx){
			ctx.target = {
				src : ctx.link.href
			};
			
			return Tombloo.Service.extractors['Photo'].extract(ctx);
		},
	},
	
	{
		name : 'Photo - Data URI',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return ctx.onImage && ctx.target.src.match(/^data:/);
		},
		extract : function(ctx){
			var src = ctx.target.src || ctx.target.toDataURL();
			return download(src, getTempDir(uriToFileName(ctx.href) + '.png')).addCallback(function(file){
				return {
					type : 'photo',
					item : ctx.title,
					file : file,
				}
			});
		},
	},
	
	{
		name : 'Photo - Canvas',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return tagName(ctx.target)=='canvas';
		},
		extract : function(ctx){
			return Tombloo.Service.extractors['Photo - Data URI'].extract(ctx);
		},
	},
	
	{
		name : 'Photo',
		ICON : 'chrome://tombloo/skin/photo.png',
		PROTECTED_SITES : [
			'files.posterous.com/',
			'image.itmedia.co.jp/',
			'wretch.yimg.com/',
			'pics.*.blog.yam.com/',
			'/www.imgscan.com/image_c.php',
			'keep4u.ru/imgs/',
			'/www.toofly.com/userGallery/',
			'/www.dru.pl/',
			'adugle.com/shareimagebig/',
			'gizmag.com/pictures/',
			'/awkwardfamilyphotos.com/',
			'/docs.google.com/',
			'share-image.com/pictures/big/',
		],
		check : function(ctx){
			return ctx.onImage;
		},
		extract : function(ctx){
			var target = ctx.target;
			var itemUrl = (tagName(target)=='object')? target.data : target.src;
			
			if(this.PROTECTED_SITES.some(function(re){
				return RegExp(re).test(itemUrl);
			})){
				return Tombloo.Service.extractors['Photo - Upload from Cache'].extract(ctx);
			};
			
			if(ctx.document.contentType.match(/^image/))
				ctx.title = ctx.href.split('/').pop();
			
			// ポスト先のサービスがリダイレクトを処理できずエラーになることがあるため必ずチェックをする(テスト中)
			return getFinalUrl(itemUrl).addCallback(function(url){
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : url,
				}
			});
		},
	},
	
	{
		name : 'Photo - Upload from Cache',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return ctx.onImage;
		},
		extract : function(ctx){
			if(ctx.document.contentType.match(/^image/))
				ctx.title = ctx.href.split('/').pop();
			
			var target = ctx.target;
			var itemUrl = (tagName(target)=='object')? target.data : target.src;
			
			var uri = createURI(itemUrl);
			return download(itemUrl, getTempDir()).addCallback(function(file){
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : itemUrl,
					file    : file,
				}
			});
		},
	},
	
	{
		name : 'Video - Vimeo',
		ICON : 'http://vimeo.com/favicon.ico',
		check : function(ctx){
			return ctx.host.match('vimeo.com');
		},
		extract : function(ctx){
			var author = $x('//div[@class="byline"]/a');
			return {
				type      : 'video',
				item      : $x('//div[@class="title"]/text()').trim(),
				itemUrl   : ctx.href,
				author    : author.textContent,
				authorUrl : author.href,
			};
		},
	},
	
	{
		name : 'Video - YouTube',
		ICON : 'http://youtube.com/favicon.ico',
		check : function(ctx){
			return ctx.host.match('youtube.com');
		},
		extract : function(ctx){
			ctx.title = ctx.title.replace(/[\n\r\t]+/gm, ' ').trim();
			
			var ps = {
				type      : 'video',
				item      : $x('//meta[@property="og:title"]/@content') || ctx.title.extract(/(.*) - /),
				itemUrl   : ctx.href,
			}
			
			var elmAuthor = 
				$x('id("watch-channel-stats")/a') || 
				$x('id("watch-username")') || 
				$x('id("watch-uploader-info")/descendant::a[contains(concat(" ", normalize-space(@rel), " "), " author ")]');
			if(elmAuthor){
				ps.authorUrl = elmAuthor.href;
				ps.author = elmAuthor.textContent.trim();
			}
			
			return ps;
		},
	},
	
	{
		name : 'Video - Google Video',
		ICON : models.Google.ICON,
		check : function(ctx){
			return ctx.host.match('video.google.com');
		},
		extract : function(ctx){
			return {
				type    : 'video',
				item    : ctx.title,
				itemUrl : ctx.href,
				body    : $x('id("embed-video")/textarea/text()'),
			}
		},
	},
	
	{
		name : 'Video - MySpaceTV',
		ICON : 'http://vids.myspace.com/favicon.ico',
		check : function(ctx){
			return ctx.host.match(/vids\.myspace\.com/) && this.getTag();
		},
		extract : function(ctx){
			var tag = this.getTag();
			ctx.href = tag.extract(/href="(.+?)"/);
			
			return {
				type    : 'video',
				item    : tag.extract(/<a.+?>(.+?)<\/a>/),
				itemUrl : ctx.href,
				body    : tag.extract(/(<object.+object>)/),
			};
		},
		getTag : function(){
			return $x('id("tv_embedcode_embed_text")/@value');
		},
	},
	
	{
		name : 'Video - Dailymotion',
		ICON : 'http://www.dailymotion.com/favicon.ico',
		check : function(ctx){
			return ctx.host.match('dailymotion.com') && this.getTag();
		},
		extract : function(ctx){
			var tag = this.getTag();
			ctx.href = tag.extract(/href="(.+?)"/);
			
			return {
				type    : 'video',
				item    : ctx.title.extract(/Dailymotion - (.*?) - /),
				itemUrl : ctx.href,
				body    : tag.extract(/(<object.+object>)/),
			};
		},
		getTag : function(){
			return $x('id("video_player_embed_code_text")/@value');
		},
	},
	
	{
		name : 'Video - Nico Nico Douga',
		ICON : models.Nicovideo.ICON,
		check : function(ctx){
			return ctx.href.match('^http://www\.nicovideo\.jp/watch/');
		},
		extract : function(ctx){
			var embedUrl = resolveRelativePath($x('//a[starts-with(@href, "/embed/")]/@href'), ctx.href);
			return request(embedUrl, {charset : 'utf-8'}).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return {
					type    : 'video',
					item    : ctx.title,
					itemUrl : ctx.href,
					body    : $x('//input[@name="script_code"]/@value', doc),
				};
			});
		}
	},
	
	{
		name : 'Quote',
		ICON : 'chrome://tombloo/skin/quote.png',
		check : function(ctx){
			return ctx.selection;
		},
		extract : function(ctx){
			return {
				type    : 'quote',
				item    : ctx.title,
				itemUrl : ctx.href,
				body    : createFlavoredString(ctx.window.getSelection()),
			}
		},
	},
	
	{
		name : 'Link - trim parameters',
		ICON : 'chrome://tombloo/skin/link.png',
		TARGET_SITES : [
			'//itunes.apple.com/',
		],
		check : function(ctx){
			return this.TARGET_SITES.some(function(re){
				return RegExp(re).test(ctx.href);
			});
		},
		extract : function(ctx){
			var uri = createURI(ctx.href);
			ctx.href = uri.prePath + uri.filePath;
			return Tombloo.Service.extractors.Link.extract(ctx);
		},
	},
	
	{
		name : 'Link - link',
		ICON : 'chrome://tombloo/skin/link.png',
		check : function(ctx){
			return ctx.onLink;
		},
		extract : function(ctx){
			// リンクテキストが無い場合はページタイトルで代替する
			var title = convertToPlainText(ctx.link) || ctx.link.title;
			if(!title || title==ctx.link.href)
				title = ctx.title;
			
			return {
				type    : 'link',
				item    : title,
				itemUrl : ctx.link.href,
			};
		},
	},
	
	{
		name : 'Link',
		ICON : 'chrome://tombloo/skin/link.png',
		check : function(ctx){
			return true;
		},
		extract : function(ctx){
			var ps;
			if(ctx.onLink){
				// リンクテキストが無い場合はページタイトルで代替する
				var title = ctx.target.textContent;
				if(!title || title==ctx.target.href)
					title = ctx.title;
				
				ps = {
					type    : 'link',
					item    : title,
					itemUrl : ctx.link.href,
				};
			} else {
				ps = {
					type    : 'link',
					item    : ctx.title,
					itemUrl : ctx.href,
				}
			}
			
			if(ctx.date)
				ps.date = ctx.date;
			
			return ps;
		},
	},
	
	{
		name : 'Photo - background image',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return ctx.bgImageURL;
		},
		extract : function(ctx){
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : ctx.bgImageURL,
			}
		}
	},
	
	{
		name : 'Photo - Capture',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			return true;
		},
		extract : function(ctx){
			// ショートカットキーからポストするためcaptureTypeを追加
			var type = ctx.captureType || input({'Capture Type' : ['Region', 'Element', 'View', 'Page']});
			if(!type)
				return;
			
			var win = ctx.window;
			return succeed().addCallback(function(){
				switch (type){
				case 'Region':
					return selectRegion().addCallback(function(region){
						return capture(win, region.position, region.dimensions);
					});
				
				case 'Element':
					return selectElement().addCallback(function(elm){
						// getBoundingClientRectで少数が返され切り取り範囲がずれるため丸める
						return capture(win, roundPosition(getElementPosition(elm)), getElementDimensions(elm));
					});
				
				case 'View':
					return capture(win, getViewportPosition(), getViewDimensions());
				
				case 'Page':
					return capture(win, {x:0, y:0}, getPageDimensions());
				}
			}).addCallback(function(image){
				return download(image, getTempDir(uriToFileName(ctx.href) + '.png'));
			}).addCallback(function(file){
				return {
					type : 'photo',
					item : ctx.title,
					file : file,
				}
			});
		}
	},
	
	{
		name : 'Text',
		ICON : 'chrome://tombloo/skin/text.png',
		check : function(ctx){
			return true;
		},
		extract : function(ctx){
			return {
				type : 'regular',
			}
		}
	},
]);

update(Tombloo.Service.extractors, {
	REDIRECT_URLS : [
		'pheedo.jp/',
		'//feedproxy.google.com/',
		'//bit.ly/',
		'//j.mp/',
		'//is.gd/',
		'//goo.gl/',
		'//nico.ms/',
	].map(function(re){
		return RegExp(re);
	}),
	
	normalizeUrl : function(url){
		return (!url || !this.REDIRECT_URLS.some(function(re){return re.test(url)}))? 
			succeed(url) : 
			getFinalUrl(url).addErrback(function(err){
				// bit.lyの統計ページなどHEAD取得未対応ページから返されるエラーを回避する
				return url;
			});
	},
	
	extract : function(ctx, ext){
		var doc = ctx.document;
		var self = this;
		
		// ドキュメントタイトルを取得する
		var title;
		if(typeof(doc.title) == 'string'){
			title = doc.title;
		} else {
			// idがtitleの要素を回避する
			title = $x('//title/text()', doc);
		}
		
		if(!title)
			title = createURI(doc.location.href).fileBaseName;
		
		ctx.title = title.trim();
		
		// canonicalが設定されていれば使う
		var canonical = $x('//link[@rel="canonical"]/@href', doc);
		if(canonical && !new RegExp(getPref('ignoreCanonical')).test(ctx.href))
			ctx.href = resolveRelativePath(canonical, ctx.href);
		ctx.href = ctx.href.replace(/\/#!\//, '/');
		
		return withWindow(ctx.window, function(){
			return maybeDeferred(ext.extract(ctx)).addCallback(function(ps){
				ps = update({
					page    : ctx.title,
					pageUrl : ctx.href,
				}, ps);
				
				return self.normalizeUrl(ps.itemUrl).addCallback(function(url){
					ps.itemUrl = url;
					return ps;
				});
			});
		});
	},
})
