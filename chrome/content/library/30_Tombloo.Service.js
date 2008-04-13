Tombloo.Service = {
	getThumbnail : function(url){
		return getPref('thumbnailTemplate').replace('{url}', url);
	},
	
	check : function(ctx){
		return withDocument(ctx.document, function(){
			var hits = [];
			var exts = Tombloo.Service.extracters;
			for(var name in exts){
				var ext = exts[name];
				if(ext.check(ctx)){
					ext.name = name;
					hits.push(ext);
				}
			}
			log(hits);
			
			return hits;
		});
	},
	
	share : function(ctx, ext){
		function errback(msg){
			error(msg);
			
			if(typeof(msg)!='string'){
				if(msg.name && msg.name.match('GenericError')){
					msg = msg.message;
				} else {
					msg = repr(msg);
				}
			}
			
			if(confirm([
				'Post failed.',
				msg.replace(/^/gm, '  '),
				'',
				'Will you reopen?',
				'Source page: ',
				'  ' + ctx.title,
				'  ' + ctx.href
			].join('\n'))){
				addTab(ctx.href);
			}
		}
		
		try{
			return withDocument(ctx.document, function(){
				return maybeDeferred(ext.extract(ctx)).addCallback(function(params){
					params = update({
						href  : ctx.href,
						title : ctx.title,
					}, params);
					log(params);
					
					var ds = {};
					var filter = new RegExp(getPref('posterFilter'), 'i');
					var posters = Tombloo.Service.posters;
					for(var name in posters){
						if((name + ': ' + params.type).match(filter))
							ds[name] = posters[name](ctx, params);
					}
					
					return new DeferredHash(ds);
				}).addCallback(function(ress){
					log(ress);
					
					var errs = [];
					var ignoreError = getPref('ignoreError');
					ignoreError = ignoreError && new RegExp(getPref('ignoreError'), 'i');
					for(var name in ress){
						var [success, res] = ress[name];
						if(!success){
							var msg = '  ' + name + ': ' + 
								(res.message.status? 'HTTP Status Code '+res.message.status : res.message)
							if(!ignoreError || !msg.match(ignoreError))
								errs.push(msg);
						}
					}
					
					if(errs.length)
						throw errs.join('\n');
				}).addErrback(errback);
			});
		}catch(err){
			errback(err);
		}
	},
	
	posters : {
		Tumblr : function(ctx, params){
			if(ctx.event.ctrlKey)
				return Tumblr.openTab(params);
			
			return Tumblr.post(params);
		},
		FFFFOUND : function(ctx, params){
			if(ctx.event.ctrlKey || params.type != 'photo')
				return succeed();
			
			if(ctx.href.match('^http://ffffound.com/')){
				var id = params.source.split('/').pop().replace(/[_\.].*/, '');
				return FFFFOUND.iLoveThis(id)
			} else {
				return FFFFOUND.post(params);
			}
		},
		Flickr : function(ctx, params){
			if(ctx.event.ctrlKey || params.type != 'photo' || !ctx.href.match('^http://www.flickr.com/photos/'))
				return succeed();
			
			return Flickr.addFavorite(ctx.href.replace(/\/$/, '').split('/').pop())
		},
	},
	
	extracters : {
		'Photo - Flickr' : {
			RE : new RegExp('^http://.+?.static.flickr.com/\\d+?/(\\d+?)_.*'),
			getImageId : function(img){
				if(img.src.match('spaceball.gif'))
					img = img.previousSibling;
				
				if(!img || !img.src.match(this.RE))
					return;
				
				return RegExp.$1;
			},
			check : function(ctx){
				return ctx.onImage && this.getImageId(ctx.target);
			},
			extract : function(ctx){
				var id = this.getImageId(ctx.target);
				return new DeferredHash({
					'info'  : Flickr.getInfo(id),
					'sizes' : Flickr.getSizes(id),
				}).addCallback(function(r){
					if(!r.info[0])
						throw r.info[1].message;
					
					var info = r.info[1];
					var sizes = r.sizes[1];
					
					ctx.title = info.title._content + ' on Flickr';
					ctx.href  = info.urls.url[0]._content;
					
					return {
						type   : 'photo',
						source : sizes.pop().source, 
						body   : info.title._content.link(ctx.href) + ' (via ' + info.owner.username.link(ctx.href.match('^http://.*?flickr.com/photos/.+?/')) + ')',
					}
				});
			},
		},
		
		'LDR' : {
			check : function(ctx){},
			getItem : function(ctx, getOnly){
				if(ctx.hostname != 'reader.livedoor.com' && ctx.hostname != 'fastladder.com')
					return;
				
				var item  = $x('ancestor::div[starts-with(@id, "item_count")]', ctx.target);
				if(!item)
					return;
				
				var res = {
					author : ($x('div[@class="item_info"]/*[@class="author"]/text()', item) || '').extract(/by (.*)/),
					title  : $x('div[@class="item_header"]//a/text()', item) || 'no title',
					feed   : $x('id("right_body")/div[@class="channel"]//a/text()'),
					href   : $x('(div[@class="item_info"]/a)[1]/@href', item).replace(/[?&;](fr?(om)?|track|ref|FM)=(r(ss(all)?|df)|atom)([&;].*)?/,''),
				};
				if(!getOnly){
					ctx.title    = res.feed + (res.title? ' - ' + res.title : '');
					ctx.href     = res.href;
					ctx.hostname = res.href.match('http://(.*?)/')[1];
				}
				
				return res
			},
		},
		
		'Quote - LDR' : {
			check : function(ctx){
				return Tombloo.Service.extracters.LDR.getItem(ctx, true) && 
					ctx.selection;
			},
			extract : function(ctx){
				with(Tombloo.Service.extracters){
					LDR.getItem(ctx);
					return Quote.extract(ctx);
				}
			},
		},
		
		'ReBlog - LDR' : {
			check : function(ctx){
				var item = Tombloo.Service.extracters.LDR.getItem(ctx, true);
				return item && (
					item.href.match('^http://.*?\\.tumblr\\.com/') || 
					(ctx.onImage && ctx.target.src.match('^http://data\.tumblr\.com/')));
			},
			extract : function(ctx){
				Tombloo.Service.extracters.LDR.getItem(ctx);
				return {
					type   : 'reblog',
					source : ctx.href, 
				}
			},
		},
			
		'Photo - LDR(FFFFOUND!)' : {
			check : function(ctx){
				var item = Tombloo.Service.extracters.LDR.getItem(ctx, true);
				return item && 
					ctx.onImage && 
					item.href.match('^http://ffffound\\.com/');
			},
			extract : function(ctx){
				var item = Tombloo.Service.extracters.LDR.getItem(ctx);
				return {
					type   : 'photo',
					body   : item.title.link(ctx.href) + 
						' (via ' + item.author.link('http://ffffound.com/home/' + item.author + '/found/') + ')',
					source : ctx.target.src.replace(/_m(\..{3})/, '$1'),
				};
			},
		},
			
		'Photo - LDR' : {
			check : function(ctx){
				return Tombloo.Service.extracters.LDR.getItem(ctx, true) && 
					ctx.onImage;
			},
			extract : function(ctx){
				var exts = Tombloo.Service.extracters;
				exts.LDR.getItem(ctx);
				for each(var ext in exts)
					if(ext.check(ctx))
						return ext.extract(ctx);
			},
		},
		
		'Link - LDR' : {
			check : function(ctx){
				return Tombloo.Service.extracters.LDR.getItem(ctx, true);
			},
			extract : function(ctx){
				with(Tombloo.Service.extracters){
					LDR.getItem(ctx);
					return Link.extract(ctx);
				}
			},
		},
		
		'Quote - Twitter' : {
			check : function(ctx){
				return ctx.href.match('//twitter.com/.*?/statuses/\\d+');
			},
			extract : function(ctx){
				ctx.title = ctx.title.substring(0, ctx.title.indexOf(': '));
				return {
					type   : 'quote',
					body   : (ctx.selection? 
						ctx.selection : 
						$x('//div[@class="desc"]/*[1]/text()')).trim(),
					source : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Amazon' : {
			check : function(ctx){
			},
			extract : function(ctx){
				var asin = ctx.document.getElementById('ASIN').value;
				return  Amazon.getItem(asin).addCallback(function(item){
					ctx.href  = Amazon.normalizeUrl(asin);
					ctx.title = item.title + (item.creators.length? ' / ' + item.creators.join(', ') : '');
					return item;
				});
			},
		},
		
		'Photo - Amazon' : {
			check : function(ctx){
				return ctx.hostname.match(/amazon\.co\.jp/) && ctx.target.id == 'prodImage';
			},
			extract : function(ctx){
				var exts = Tombloo.Service.extracters;
				return exts.Amazon.extract(ctx).addCallback(function(item){
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
					
					// [FIXME]
					if(
						img.height < 400 && 
						img.width  < 400){
						if(!confirm('Image size: ' + img.width + ' x ' + img.height + '\nWill you post?'))
							return;
					}
					
					return {
						type   : 'photo',
						body   : ctx.title.link(ctx.href),
						source : img.url,
					};
				});
			},
		},
		
		'Quote - Amazon' : {
			check : function(ctx){
				return ctx.hostname.match(/amazon\.co\.jp/) && ctx.selection;
			},
			extract : function(ctx){
				var exts = Tombloo.Service.extracters;
				return exts.Amazon.extract(ctx).addCallback(function(item){
					return exts.Quote.extract(ctx);
				});
			},
		},
		
		'Link - Amazon' : {
			check : function(ctx){
				return ctx.hostname.match(/amazon\.co\.jp/);
			},
			extract : function(ctx){
				var exts = Tombloo.Service.extracters;
				return exts.Amazon.extract(ctx).addCallback(function(item){
					return exts.Link.extract(ctx);
				});
			},
		},
		
		'ReBlog' : {
			check : function(ctx){},
			extract : function(ctx){
				ctx.title = 'ReBlog: ' + ctx.href;
				
				return {
					type   : 'reblog',
					source : ctx.href, 
				}
			},
		},
		
		'ReBlog - Tumblr' : {
			check : function(ctx){
				return this.getLink();
			},
			extract : function(ctx){
				return {
					type   : 'reblog',
					source : this.getLink(), 
				}
			},
			getLink : function(){
				return $x('//iframe[starts-with(@src, "http://www.tumblr.com/dashboard/iframe")]/@src');
			},
		},
		
		'ReBlog - Dashbord' : {
			check : function(ctx){
				return ctx.href.match(Tumblr.TUMBLR_URL) && this.getLink(ctx);
			},
			extract : function(ctx){
				ctx.href = this.getLink(ctx);
				return  Tombloo.Service.extracters.ReBlog.extract(ctx);
			},
			getLink : function(ctx){
				var target = ctx.target;
				var parent = tagName(target)=='li' ? target : $x('ancestor::li', target);
				if(!parent)
					return;
				
				return $x('.//a[@title="ReBlog"]/@href', parent);
			},
		},
		
		'ReBlog - Mosaic' : {
			check : function(ctx){
				return ctx.href.match(/mosaic.html/i) && ctx.target.photo;
			},
			extract : function(ctx){
				ctx.href = ctx.target.photo.url;
				return  Tombloo.Service.extracters.ReBlog.extract(ctx);
			},
		},
		
		'Photo - Snipshot' : {
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
					type   : 'photo',
					source : 'http://services.snipshot.com/save/'+id+'/snipshot_'+id+'.jpg', 
					body   : ctx.href? ctx.title.link(ctx.href) : '',
				}
			},
		},
		
		'Photo - Fishki.Net' : {
			check : function(ctx){
				return ctx.onImage && 
					ctx.target.src.match('//fishki.net/');
			},
			extract : function(ctx){
				return {
					type   : 'photo',
					source : ctx.target.src.replace('//fishki.net/', '//de.fishki.net/'),
					body   : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Photo - Google.ca' : {
			check : function(ctx){
				return (ctx.onLink && ctx.link.href.match('http://lh..google.ca/.*(png|gif|jpe?g)$'));
			},
			extract : function(ctx){
				return doXHR(ctx.link.href).addCallback(function(res){
					return {
						type   : 'photo',
						source : $x('//img[1]', convertToHTMLDocument(res.responseText)).src,
						body   : ctx.title.link(ctx.href),
					}
				});
			},
		},
		
		'Photo - Picasa' : {
			check : function(ctx){
				return ctx.hostname == 'picasaweb.google.com' && ctx.onImage;
			},
			extract : function(ctx){
				var title = $x('//div[@class="lhcl_albumtitle"]/text()').trim();
				var user = $x('id("lhid_user_nickname")/text()').trim();
				var userPage = $x('id("lhid_portraitlink")/@href');
				
				return {
					type   : 'photo',
					source : ctx.target.src.replace(/\?.*/, ''), 
					body   : title.link(ctx.href) + ' (via ' + user.link(userPage) + ')',
				}
			},
		},
		
		'Photo - webshots' : {
			check : function(ctx){
				return ctx.hostname.match('^.+\.webshots\.com') && this.getUser();
			},
			extract : function(ctx){
				var user = this.getUser();
				var title = $x('//div[@class="media-info"]/h1/text()');
				var link = $x('//li[@class="fullsize first"]/a/@href');
				
				return {
					type   : 'photo',
					source : link, 
					body   : title.link(ctx.href) + ' (via ' + user.textContent.trim().link(user.href) + ')',
				}
			},
			getUser : function(){
				return $x('(//img[@class="user-photo"])[1]/ancestor::a');
			},
		},
		
		'Photo - qoob.tv' : {
			check : function(ctx){
				return ctx.href.match('en.qoob.tv/pict/clip_view.asp');
			},
			extract : function(ctx){
				var info = $x('//a[@class="link_people"][1]');
				var title = ctx.title.match('PICT - (.*) - QOOB')[1] || 'no title';
				
				return {
					type   : 'photo',
					source : ctx.href.split('clip_view').join('download'), 
					body   : title.link(ctx.href) + ' (via ' + info.textContent.link(info.href) + ')',
				}
			},
		},
		
		'Photo - blogspot' : {
			check : function(ctx){
				return ctx.onLink && 
					(''+ctx.link).match(/(png|gif|jpe?g)$/i) &&
					(''+ctx.link).match(/blogger.com\/.*\/s\d{2,}-h\//);
			},
			extract : function(ctx){
				return {
					type   : 'photo',
					source : (''+ctx.link).replace(/\/(s\d{2,})-h\//, '/$1/'), 
					body   : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Photo - FFFFOUND!' : {
			check : function(ctx){
				return ctx.href.match('http://ffffound.com/image/') && 
					ctx.onImage && 
					ctx.target.src.match(/^[^?]*/)[0].match(/_m\.(png|gif|jpe?g)$/i);
			},
			extract : function(ctx){
				var author = $x('//div[@class="saved_by"]/a[1]');
				var title = $x('//div[@class="title"]/text()').trim();
				
				return {
					type   : 'photo',
					source : ctx.target.src.replace(/_m(\..{3})$/, '$1'),
					body   : title.link(ctx.href) + ' (via ' + author.textContent.link(author.href) + ')',
				}
			},
		},
		
		'Photo - FFFFOUND!(short)' : {
			check : function(ctx){
				return ctx.href.match('http://ffffound.com/') && 
					ctx.onImage && 
					ctx.target.src.match(/^[^?]*/)[0].match(/_m\.(png|gif|jpe?g)$/i);
			},
			extract : function(ctx){
				var title  = $x('ancestor::blockquote[@class="asset"]//div[@class="title"]/text()', ctx.target).trim();
				ctx.href = ctx.link.href.split('?').shift();
				
				return {
					type   : 'photo',
					source : ctx.target.src.replace(/_m(\..{3})$/, '$1'),
					body   : title.link(ctx.href),
				}
			},
		},
		
		'Photo - Google Image Search' : {
			check : function(ctx){
				return ctx.host == 'images.google.co.jp' && 
					ctx.onImage && ctx.onLink;
			},
			extract : function(ctx){
				var link  = $x('parent::a/@href', ctx.target);
				var source = decodeURIComponent(link.match(/imgurl=([^&]+)/)[1]);
				ctx.href = decodeURIComponent(link.match(/imgrefurl=([^&]+)/)[1]);
				
				return doXHR(ctx.href, {
					mimeType : 'text/plain; charset=x-user-defined'
				}).addCallback(function(res){
					var html = convertFromUnplaceableHTML(res.responseText);
					var title = html.match(/<title.*?>(.*?)<\/title>/);
					ctx.title = title? RegExp.$1 : 'no title';
					
					return {
						type   : 'photo',
						source : source,
						body   : ctx.title.link(ctx.href),
					}
				});
			},
		},
		
		// [FIXME] firefox 3
		/*
		'Photo - area element' : {
			check : function(ctx){
				if(tagName(ctx.target)=='area')
					return getElementByPosition(ctx.mouse.x, ctx.mouse.y).src;
			},
			extract : function(ctx){
				return {
					type   : 'photo',
					source : getElementByPosition(ctx.mouse.x, ctx.mouse.y).src, 
					body   : ctx.title.link(ctx.href),
				}
			},
		},
		*/
		
		'Photo - image link' : {
			check : function(ctx){
				return (ctx.onLink && ctx.link.href.match(/^[^?]*/)[0].match(/(png|gif|jpe?g)$/i));
			},
			extract : function(ctx){
				return {
					type   : 'photo',
					source : ctx.link.href, 
					body   : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Photo' : {
			check : function(ctx){
				return ctx.onImage;
			},
			extract : function(ctx){
				var target = ctx.target;
				var source = tagName(target)=='object'? target.data : target.src;
				if([
					'wretch.yimg.com/',
					'pics.*\.blog.yam.com/',
					'www.imgscan.com/image_c.php',
					'keep4u.ru/imgs/',
				].some(function(re){
					return source.match(re);
				})){
					return Tombloo.Service.extracters['Photo - Upload from Cache'].extract(ctx);
				};
				
				if(ctx.document.contentType.match(/^image/))
					ctx.title = ctx.href.split('/').pop();
				
				return {
					type   : 'photo',
					source : source,
					body   : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Photo - Upload from Cache' : {
			check : function(ctx){
				return ctx.onImage;
			},
			extract : function(ctx){
				if(ctx.document.contentType.match(/^image/))
					ctx.title = ctx.href.split('/').pop();
				
				var target = ctx.target;
				var file = findCacheFile(tagName(target)=='object'? target.data : target.src);
				if(!file)
					throw 'Cache file is not found.';
				
				return {
					type   : 'photo',
					source : file,
					body   : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Video - Vimeo': {
			check : function(ctx){
				return ctx.hostname.match('vimeo.com');
			},
			extract : function(ctx){
				var user = $x('//div[@class="byline"]/a');
				var title = $x('//div[@class="title"]/text()');
				
				return {
					type   : 'video',
					source : ctx.href,
					body   : title.trim().link(ctx.href) + ' (via ' + user.textContent.link(user.href) + ')'
				};
			},
		},
		
		'Video - MySpace' : {
			check : function(ctx){
				return ctx.hostname.match(/vids\.myspace\.com/);
			},
			extract : function(ctx){
				var tag = $x('//*[@id="links_video_code"]/@value');
				if(!tag) return;
				
				return {
					type   : 'video',
					source : tag.extract(/(<embed.*?embed>)/, 0),
					body   : tag.extract(/^(<a.*?a>)/, 0),
				};
			},
		},
		
		'Video - dailymotion' : {
			check : function(ctx){
				return ctx.hostname.match('dailymotion.com');
			},
			extract : function(ctx){
				var tag = $x('//div[@class="video_player_embed"]/input/@value');
				if(!tag) return;
				
				// タイトル文字化け回避のためctx.titleから取得
				return {
					type   : 'video',
					source : tag.extract(/(<object.*object>)/),
					body   : ctx.title.extract(/Video (.*?) -/).link(tag.extract(/href="(.*?)"/)) + 
						' (via ' + tag.extract(/(<a.*?a>)/g, 1) + ')',
				};
			},
		},
		
		'Video - Rimo' : {
			check : function(ctx){
				return ctx.hostname == 'rimo.tv';
			},
			extract : function(ctx){
				return {
					type   : 'video',
					source : $x('(//table[@class="player-embed-tags"]//input)[last()]/@value'),
					body   : $x('id("play_list_title")/@value').link(ctx.href),
				};
			},
		},
		
		'Video - YouTube' : {
			check : function(ctx){
				return ctx.hostname.match('youtube.com');
			},
			extract : function(ctx){
				var info = $x('id("channelVidsTop")//div[@class="wsHeading"]/a');
				
				return {
					type   : 'video',
					source : ctx.href,
					body   : ctx.title.match(/ - (.*)/)[1] + 
						' (via ' + info.textContent.link(info.href) + ')',
				};
			},
		},
		
		'Video - Google Video' : {
			check : function(ctx){
				return ctx.hostname.match('video.google.com');
			},
			extract : function(ctx){
				return {
					type   : 'video',
					body   : ctx.title.match(/(.*) - /)[1],
					source : ctx.href,
				}
			},
		},
		
		'Quote' : {
			check : function(ctx){
				return ctx.selection;
			},
			extract : function(ctx){
				return {
					type   : 'quote',
					body   : ctx.selection.trim(),
					source : ctx.title.link(ctx.href),
				}
			},
		},
		
		'Link' : {
			check : function(ctx){
				return true;
			},
			extract : function(ctx){
				return {
					type   : 'link',
					title  : ctx.title,
					source : ctx.href,
					body   : Tombloo.Service.getThumbnail(ctx.href),
				}
			},
		},
		
		'Photo - background image' : {
			check : function(ctx){
				return ctx.bgImageURL;
			},
			extract : function(ctx){
				return {
					type   : 'photo',
					source : ctx.bgImageURL,
					body   : ctx.title.link(ctx.document.location.href),
				}
			}
		},
	},
	
	update : function(user, type, p){
		p = p || new Progress();
		if(p.ended)
			return;
		
log('update : ---');
log('update : START');
log('update : user = ' + user);
log('update : type = ' + type);
	return succeed().
		addCallback(bind('getInfo', Tumblr), user, type).
		addCallback(function(info){
			p.max = info.total - Tombloo[type? capitalize(type) : 'Post'].countByUser(user);
log('update : ---');
log('update : p.max = ' + p.max);
log('update : p.ended = ' + p.ended);
			
			if(p.ended)
				return;
			
			return Tumblr.read(user, type, info.total, function(post){
// log('update : ---');
// log('update : UPDATE : ' + type);
// log('update : ' + p.value + '/' + p.max);
// log('update : p.ended = ' + p.ended);
				if(p.ended)
					throw StopProcess;
				
				try{
					Tombloo.Post.insert(post);
					p.value++;
				} catch(e if e instanceof Database.DuplicateKeyException) {
// log('update : DuplicateKeyException!!!!!!!!!!!!!!!!!!!!!!!!!!');
					// 重複エラーを無視し読み飛ばす
				}
			});
		}).
		addBoth(function(res){
log('update : ---');
log('update : END');
log('update : user = ' + user);
log('update : type = ' + type);
// log(res);
			}).
			addCallback(bind('complete', p));
	},
}


Tombloo.Service.Photo = {
	download : function(user, size, p){
		p = p || new Progress();
		if(p.ended)
			return;
log('download : ---');
log('download : user = ' + user);
log('download : size = ' + size);
	
	return Tombloo.Service.Photo.getByFileExists(user, size, false).
		addCallback(function(photos){
			p.max = photos.length;
log('download : ---');
log('download : p.max = ' + p.max);
			
			if(p.ended)
				return;
			
			return deferredForEach(photos, function(photo){
// log('download : ---');
// log('download : ' + p.value + '/' + p.max);
// log('download : ' + p.ended);
// log('download : ' + photo.getFile(size).leafName);
				if(p.ended)
					throw StopIteration;
				
				p.value++;
				
				return Tumblr.Photo.download(photo.getFile(size));
			});
		}).
		addBoth(function(res){
log('download : ---');
log('download : END');
// log(res);
			}).
			addBoth(bind('complete', p));
	},
	getByFileExists : function(user, size, exists){
		exists = exists==null? true : exists;
		
log('getByFileExists : START');
log('getByFileExists : user = ' + user);
		var all = [];
		var photoAll = Tombloo.Photo.findByUser(user);
var c = counter();
log('getByFileExists : photoAll.length = ' + photoAll.length);
// 		return deferredForEach(Tombloo.Photo.findByUser(user).split(100), function(photos){
		return deferredForEach(photoAll.split(100), function(photos){
log('getByFileExists : ' + (c() * 100));
			forEach(photos, function(photo){
				if(photo.checkFile(size) == exists)
					all.push(photo);
			})
			return wait(0);
		}).addCallback(function(){return all});
	},
}
