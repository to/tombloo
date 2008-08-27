Tombloo.Service.extractors = new Repository([
	{
		name : 'LDR',
		getItem : function(ctx, getOnly){
			if(ctx.host != 'reader.livedoor.com' && ctx.host != 'fastladder.com')
				return;
			
			var item  = $x('ancestor::div[starts-with(@id, "item_count")]', ctx.target);
			if(!item)
				return;
			
			var res = {
				author : ($x('div[@class="item_info"]/*[@class="author"]/text()', item) || '').extract(/by (.*)/),
				title  : $x('div[@class="item_header"]//a/text()', item) || '',
				feed   : $x('id("right_body")/div[@class="channel"]//a/text()'),
				href   : $x('(div[@class="item_info"]/a)[1]/@href', item).replace(/[?&;](fr?(om)?|track|ref|FM)=(r(ss(all)?|df)|atom)([&;].*)?/,''),
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
		name : 'Quote - LDR',
		ICON : 'http://reader.livedoor.com/favicon.ico',
		check : function(ctx){
			return Tombloo.Service.extractors.LDR.getItem(ctx, true) && 
				ctx.selection;
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
		name : 'Quote - Twitter',
		ICON : models.Twitter.ICON,
		check : function(ctx){
			return ctx.href.match('//twitter.com/.*?/statuses/\\d+');
		},
		extract : function(ctx){
			var body = ctx.selection;
			if(!body){
				var desc = $x('(//div[@class="desc"]/p)[1]');
				$x('.//a', desc, true).forEach(function(l){l.href = l.href;});
				body = desc.innerHTML.replace(/ (rel|target)=".+?"/g, '');
			}
			
			return {
				type     : 'quote',
				item     : ctx.title.substring(0, ctx.title.indexOf(': ')),
				itemUrl  : ctx.href,
				body     : body.trim(),
				favorite : {
					name : 'Twitter',
					id   : ctx.href.match(/statuses\/(\d+)/)[1],
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
				type    : 'quote',
				item    : $x('//span[@class="title"]/text()'),
				itemUrl : ctx.href,
				body    : escapeHTML((ctx.selection || $x('//blockquote[contains(@class, "text")]/p').textContent).trim()),
			}
		},
	},
	
	{
		name : 'Amazon',
		getAsin : function(ctx){
			return $x('id("ASIN")/@value');
		},
		extract : function(ctx){
			var asin = this.getAsin(ctx);
			return  Amazon.getItem(asin).addCallback(function(item){
				ctx.href  = Amazon.normalizeUrl(asin);
				ctx.title = item.title + (item.creators.length? ' / ' + item.creators.join(', ') : '');
				return item;
			});
		},
	},
	
	{
		name : 'Photo - Amazon',
		ICON : models.Amazon.ICON,
		check : function(ctx){
			return ctx.host.match(/amazon\./) && 
				Tombloo.Service.extractors.Amazon.getAsin(ctx) && 
				ctx.target.id == 'prodImage';
		},
		extract : function(ctx){
			return Tombloo.Service.extractors.Amazon.extract(ctx).addCallback(function(item){
				var img = item.largestImage;
				if(!img){
					alert('Image not found.');
					return;
				}
				
				with(ctx.target){
					src = img.url;
					height = '';
					width = '';
					style.height = 'auto';
					style.width = 'auto';
				}
				
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : img.url,
				};
			});
		},
	},
	
	{
		name : 'Quote - Amazon',
		ICON : models.Amazon.ICON,
		check : function(ctx){
			return ctx.host.match(/amazon\./) && 
				Tombloo.Service.extractors.Amazon.getAsin(ctx) && 
				ctx.selection;
		},
		extract : function(ctx){
			var exts = Tombloo.Service.extractors;
			return exts.Amazon.extract(ctx).addCallback(function(item){
				return exts.Quote.extract(ctx);
			});
		},
	},
	
	{
		name : 'Link - Amazon',
		ICON : models.Amazon.ICON,
		check : function(ctx){
			return ctx.host.match(/amazon\./) && 
				Tombloo.Service.extractors.Amazon.getAsin(ctx);
		},
		extract : function(ctx){
			var exts = Tombloo.Service.extractors;
			return exts.Amazon.extract(ctx).addCallback(function(item){
				return exts.Link.extract(ctx);
			});
		},
	},
	
	{
		name : 'ReBlog',
		extractByLink : function(ctx, link){
			var self = this;
			return request(link).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				ctx.href = link;
				ctx.title = $x('//title/text()', doc).replace(/[\n\r]/g, '') || '';
				
				return self.extractByPage(ctx, doc);
			});
		},
		
		extractByPage : function(ctx, doc){
			return this.extractByEndpoint(ctx, 
				unescapeHTML(this.getFrameUrl(doc)).replace(/.+&pid=(.*)&rk=(.*)/, Tumblr.TUMBLR_URL+'reblog/$1/$2'));
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
			return $x('//iframe[starts-with(@src, "http://www.tumblr.com/dashboard/iframe")]/@src', doc);
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
			var link = $x('./ancestor-or-self::li[starts-with(@class, "post")]//a[@title="Permalink"]', ctx.target);
			return link && link.href;
		},
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
		name : 'Photo - Flickr',
		ICON : models.Flickr.ICON,
		
		RE : new RegExp('^http://(?:.+?.)?static.flickr.com/\\d+?/(\\d+?)_.*'),
		getImageId : function(ctx){
			if(ctx.host == 'flickr.com' && ctx.target.src.match('spaceball.gif')){
				removeElement(ctx.target);
				
				if(currentDocument().elementFromPoint){
					ctx.target = currentDocument().elementFromPoint(ctx.mouse.x, ctx.mouse.y);
				} else {
					ctx.target = ctx.target.previousSibling;
				}
			}
			
			if(!ctx.target || !ctx.target.src.match(this.RE))
				return;
			
			return RegExp.$1;
		},
		check : function(ctx){
			return ctx.onImage && this.getImageId(ctx);
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
			});
		},
	},
	
	{
		name : 'Photo - 4u',
		ICON : models['4u'].ICON,
		check : function(ctx){
			return ctx.onImage && ctx.href.match('^http://4u.straightline.jp/image/') && ctx.target.src.match('/static/upload/l/l_');
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
				favorite : {
					name : '4u',
					id : iLoveHer && decodeURIComponent(iLoveHer.extract('src=([^&]*)')),
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
		name : 'Photo - Picasa',
		ICON : 'http://picasaweb.google.com/favicon.ico',
		check : function(ctx){
			return ctx.host == 'picasaweb.google.com' && ctx.onImage;
		},
		extract : function(ctx){
			return {
				type      : 'photo',
				item      : $x('//div[@class="lhcl_albumtitle"]/text()').trim(),
				itemUrl   : ctx.target.src.replace(/\?.*/, ''), 
				author    : $x('id("lhid_user_nickname")/text()').trim(),
				authorUrl : $x('id("lhid_portraitlink")/@href'),
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
					favorite : {
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
		name : 'Photo - Share-image.com',
		ICON : 'http://www.share-image.com/favicon.ico',
		
		check : function(ctx){
			return ctx.href.match(/share-image\.com\/gallery\//) && this.getImage();
		},
		extract : function(ctx){
			return request(this.getImage()).addCallback(function(res){
				return {
					type    : 'photo',
					item    : ctx.title,
					itemUrl : res.channel.URI.spec, 
				}
			});
		},
		getImage : function(){
			return $x('//img[starts-with(@src, "http://www.share-image.com/pictures/big/")]/@src');
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
		name : 'Photo - coverd',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			if(!currentDocument().elementFromPoint || !ctx.onImage)
				return;
			
			// 1px四方の画像の上でクリックされたか?
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
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : currentDocument().elementFromPoint(ctx.mouse.x, ctx.mouse.y).src, 
			}
		},
	},
	
	{
		name : 'Photo - image link',
		ICON : 'chrome://tombloo/skin/photo.png',
		check : function(ctx){
			var uri = createURI(ctx.link.href);
			return ctx.onLink && (/(png|gif|jpe?g)$/i).test(uri.fileExtension);
		},
		extract : function(ctx){
			ctx.target = ctx.link;
			
			return Tombloo.Service.extractors['Photo'].extract(ctx);
		},
	},
	
	{
		name : 'Photo',
		ICON : 'chrome://tombloo/skin/photo.png',
		PROTECTED_SITES : [
			'files.posterous.com',
			'image.itmedia.co.jp',
			'wretch.yimg.com/',
			'pics.*\.blog.yam.com/',
			'www.imgscan.com/image_c.php',
			'keep4u.ru/imgs/',
			'www.toofly.com/userGallery/',
		],
		check : function(ctx){
			return ctx.onImage;
		},
		extract : function(ctx){
			var target = ctx.target;
			var tag = tagName(target);
			var source = 
				tag=='object'? target.data : 
				tag=='img'? target.src : target.href;
			if(this.PROTECTED_SITES.some(function(re){
				return RegExp(re).test(source);
			})){
				return Tombloo.Service.extractors['Photo - Upload from Cache'].extract(ctx);
			};
			
			if(ctx.document.contentType.match(/^image/))
				ctx.title = ctx.href.split('/').pop();
			
			return {
				type    : 'photo',
				item    : ctx.title,
				itemUrl : source,
			}
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
			var itemUrl = tagName(target)=='object'? target.data : target.src;
			
			var uri = createURI(itemUrl);
			var file = getTempDir();
			file.append(validateFileName(uri.fileName));
			
			return download(itemUrl, file).addCallback(function(file){
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
			var author = $x('id("watch-channel-stats")/a');
			return {
				type      : 'video',
				item      : ctx.title.extract(/ - (.*)/),
				itemUrl   : ctx.href,
				author    : author.textContent,
				authorUrl : author.href,
			};
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
			var tag = $x('id("links_video_code")/@value');
			ctx.href = tag.extract(/href="(.+?)"/);
			
			return {
				type    : 'video',
				item    : tag.extract(/>(.+?)<\/a>/),
				itemUrl : ctx.href,
				body    : tag.extract(/(<object.+object>)/),
			};
		},
		getTag : function(){
			return $x('id("links_video_code")/@value');
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
			var author = tag.extract(/Uploaded by (<a.+?a>)/);
			ctx.href = tag.extract(/href="(.+?)"/);
			
			return {
				type      : 'video',
				item      : ctx.title.extract(/Dailymotion - (.*?), a video from/),
				itemUrl   : ctx.href,
				author    : author.extract(/>([^><]+?)</),
				authorUrl : author.extract(/href="(.+?)"/),
				body      : tag.extract(/(<object.+object>)/),
			};
		},
		getTag : function(){
			return $x('id("video_player_embed_code_text")/text()');
		},
	},
	
	{
		name : 'Video - Rimo',
		ICON : 'http://rimo.tv/favicon.ico',
		check : function(ctx){
			return ctx.host == 'rimo.tv' && this.getTag();
		},
		extract : function(ctx){
			return {
				type    : 'video',
				item    : $x('id("play_list_title")/@value') || ctx.title.extract(/ - (.*)/),
				itemUrl : ctx.href,
				body    : this.getTag(),
			};
		},
		getTag : function(){
			return $x('id("player-tag-M")/@value') || $x('(//table[@class="player-embed-tags"]//input)[last()]/@value');
		},
	},
	
	{
		name : 'Video - Nico Nico Douga',
		ICON : 'http://www.nicovideo.jp/favicon.ico',
		check : function(ctx){
			return ctx.href.match('^http://www\.nicovideo\.jp/watch/');
		},
		extract : function(ctx){
			return {
				type    : 'video',
				item    : ctx.title,
				itemUrl : ctx.href,
				body    : $x('//form[@name="form_iframe"]/input/@value'),
			};
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
				body    : escapeHTML(ctx.selection.trim()),
			}
		},
	},
	
	{
		name : 'Link',
		ICON : 'chrome://tombloo/skin/link.png',
		check : function(ctx){
			return true;
		},
		extract : function(ctx){
			return {
				type    : 'link',
				item    : ctx.title,
				itemUrl : ctx.href,
			}
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

Tombloo.Service.extractors.extract = function(ctx, ext){
	return withWindow(ctx.window, function(){
		return maybeDeferred(ext.extract(ctx)).addCallback(function(ps){
			return ps && update({
				page    : ctx.title,
				pageUrl : ctx.href,
			}, ps);
		});
	});
}
