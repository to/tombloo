var Tumblr = {
	DATA_URL : 'http://data.tumblr.com/',
	TUMBLR_URL : 'http://www.tumblr.com/',
	PAGE_LIMIT : 50,
	
	splitRequests : function(count){
		var res = [];
		var limit = Tumblr.PAGE_LIMIT;
		for(var i=0,len=Math.ceil(count/limit) ; i<len ; i++){
			res.push([i*limit, limit]);
		}
		count%limit && (res[res.length-1][1] = count%limit);
		return res;
	},
	
	normalizeHost : function(host){
		return host.indexOf('.')!=-1 ? host : host+'.tumblr.com';
	},
	
	buildURL : function(host, params){
		host = Tumblr.normalizeHost(host);
		return 'http://' + host + '/api/read?' + queryString(params);
	},
	
	createInfo : function(xml){
		return {
			type     : ''+xml.posts.@type,
			start    :  1*xml.posts.@start,
			total    :  1*xml.posts.@total,
			name     : ''+xml.tumblelog.@name,
			title    : ''+xml.tumblelog.@title,
			timezone : ''+xml.tumblelog.@timezone,
		};
	},
	
	getInfo : function(user, type){
		var url = Tumblr.buildURL(user, {
			type  : type,
			start : 0,
			num   : 0,
		}); 
		
		return doXHR(url).addCallback(function(res){
			return Tumblr.createInfo(convertToXML(res.responseText));
		});
	},
	
	getPostInfo : function(user, post){
		return {
				user : user,
				id   : ''+ post.@id, 
				url  : ''+ post.@url, 
				date : ''+ post.@date, 
				type : ''+ post.@type, 
		};
	},
	
	read : function(user, type, count, handler){
		handler = handler || function(){};
		var pages = Tumblr.splitRequests(count);
		var rval = [];
		return deferredForEach(pages, function(page, pageNum){
			var url = Tumblr.buildURL(user, {
				type : type,
				start : page[0],
				num : page[1],
			});
			
			return doXHR(url).addCallback(function(res){
				var xml = convertToXML(res.responseText);
				return deferredForEach(xml.posts.post, function(post, rowNum){
					var postInfo = Tumblr.getPostInfo(user, post);
					var post = Tumblr[capitalize(postInfo.type)].convertToModel(post, postInfo);
					
					var res = handler(post, (pageNum * Tumblr.PAGE_LIMIT) + rowNum);
					rval.push(post);
					return res;
				});
			}).addCallback(wait, 0.5);
		}).
		addErrback(function(e){
			if(e.message!=StopProcess)
				throw e;
		}).
		addCallback(function(){
			return rval;
		});
	},
	
	remove : function(id){
		return doXHR(this.TUMBLR_URL+'delete', {
			referrer    : Tumblr.TUMBLR_URL,
			sendContent : {
				id : id,
				redirect_to : 'dashboard',
			},
		});
	},
	
	trimReblogInfo : function(fields){
		if(! getPref('trimReblogInfo'))
		 return;
		 
		function trimQuote(entry){
			entry = entry.replace(/<p><\/p>/g, '').replace(/<p><a[^<]+<\/a>:<\/p>/g, '');
			entry = (function(all, contents){
				return contents.replace(/<blockquote>(([\n\r]|.)+)<\/blockquote>/gm, arguments.callee);
			})(null, entry);
			return entry.trim();
		}
		
		switch(fields['post[type]']){
		case 'link':
			fields['post[three]'] = trimQuote(fields['post[three]']);
			break;
		case 'regular':
		case 'photo':
		case 'video':
			fields['post[two]'] = trimQuote(fields['post[two]']);
			break;
		case 'quote':
			fields['post[two]'] = fields['post[two]'].replace(/ \(via <a.*?<\/a>\)/g, '').trim();
			break;
		}
		
		return fields;
	},
	
	getReblogToken : function (url){
		url = unescapeHTML(url);
		if(url.match(/&pid=(.*)&rk=(.*)/) || url.match('/reblog/(.*?)/([^\\?]*)'))
			return {
				id    : RegExp.$1,
				token : RegExp.$2,
			}
	},
	
	reblog : function(url){
		return maybeDeferred(Tumblr.getReblogToken(url) || doXHR(url).addCallback(function(res){
			return Tumblr.getReblogToken(res.responseText.match('iframe src="(.*?)"')[1]);
		})).addCallback(function(token){
			url = Tumblr.TUMBLR_URL+'reblog/'+token.id+'/'+token.token;
			return doXHR(url);
		}).addCallback(function(res){
			if(formContents(res.responseText)['post[type]'] != 'regular')
				return res;
			
			// reblog as quote
			return doXHR(url + '/quote');
		}).addCallback(function(res){
			var fields = formContents(convertToHTMLDocument(res.responseText));
			Tumblr.trimReblogInfo(fields);
			fields.redirect_to = Tumblr.TUMBLR_URL+'dashboard';
			delete fields.preview_post;
			
			return doXHR(url, {
				referrer : Tumblr.TUMBLR_URL,
				sendContent : fields,
			});
		}).addCallback(function(res){
			switch(res.channel.URI.asciiSpec.replace(/\?.*/,'')){
			case Tumblr.TUMBLR_URL+'dashboard':
				return;
			case Tumblr.TUMBLR_URL+'login':
				throw 'Not loggedin.';
			case url:
				if(res.responseText.match(/(exceeded|tomorrow)/))
					throw "You've exceeded your daily post limit.";
			default:
				error(res);
				throw 'Error posting entry.';
			}
		});
	},
	
	post : function(params){
		if(params.type == 'reblog')
			return Tumblr.reblog(params.source);
		
		var url = Tumblr.TUMBLR_URL + 'new/' + params.type;
		return doXHR(url, {
			referrer : url,
			sendContent : Tumblr[capitalize(params.type)].convertToForm(params),
		}).addCallback(function(res){
			switch(res.channel.URI.asciiSpec.replace(/\?.*/,'')){
			case Tumblr.TUMBLR_URL+'dashboard':
				return;
			case Tumblr.TUMBLR_URL+'login':
				throw 'Not loggedin.';
			case Tumblr.TUMBLR_URL+'share':
				if(res.responseText.match(/(exceeded|tomorrow)/))
					throw "You've exceeded your daily post limit.";
			default:
				error(res);
				throw 'Error posting entry.';
			}
		});
	},
	
	openTab : function(params){
		if(params.type == 'reblog')
			return addTab(Tumblr.TUMBLR_URL+'reblog/'+params.id +'?redirect_to='+encodeURIComponent(params.href));
		
		var form = Tumblr[capitalize(params.type)].convertToForm(params);
		return addTab(Tumblr.TUMBLR_URL+'new/' + params.type).addCallback(function(win){
			withDocument(win.document, function(){
				populateForm(currentDocument().getElementById('edit_post'), form);
				
				var setDisplay = function(id, style){
					currentDocument().getElementById(id).style.display = style;
				}
				switch(params.type){
				case 'photo':
					setDisplay('photo_upload', 'none');
					setDisplay('photo_url', 'block');
					
					setDisplay('add_photo_link', 'none');
					setDisplay('photo_link', 'block');
					
					break;
				case 'link':
					setDisplay('add_link_description', 'none');
					setDisplay('link_description', 'block');
					break;
				}
			});
		});
	},
	
	getLoggedInUser : function(){
		return doXHR(this.TUMBLR_URL+'settings').addCallback(function(res){
			switch(res.channel.URI.asciiSpec.replace(/\?.*/,'')){
			case Tumblr.TUMBLR_URL+'login':
				throw 'Not loggedin.';
			default:
				return $x(
					'//input[@name="tumblelog[name]"]/@value', 
					convertToHTMLDocument(res.responseText));
			}
		});
	},
}


Tumblr.Regular = {
	convertToModel : function(post, postInfo){
		return update(postInfo, {
			body  : ''+ post['regular-body'],
			title : ''+ post['regular-title'],
		});
	},
	convertToForm : function(m){
		return {
			'post[type]'  : 'regular',
			'post[one]'   : m.title,
			'post[two]'   : m.body,
		};
	},
}

Tumblr.Photo = {
	convertToModel : function(post, postInfo){
		var photoUrl = post['photo-url'];
		var photoUrl500 = ''+photoUrl.(@['max-width'] == 500);
		var image = Tombloo.Photo.getImageInfo(photoUrl500);
		
		return update(postInfo, {
			photoUrl500   : photoUrl500,
			photoUrl400   : ''+ photoUrl.(@['max-width'] == 400),
			photoUrl250   : ''+ photoUrl.(@['max-width'] == 250),
			photoUrl100   : ''+ photoUrl.(@['max-width'] == 100),
			photoUrl75    : ''+ photoUrl.(@['max-width'] == 75),
			
			body          : ''+ post['photo-caption'],
			imageId       : image.id,
			revision      : image.revision,
		});
	},
	convertToForm : function(m){
		var form = {
			'post[type]'  : 'photo',
			t             : m.title,
			u             : m.href,
			photo_src     : m.source,
			'post[two]'   : m.body,
			'post[three]' : m.href,
		};
		form[typeof(m.source)=='string' ? 'photo_src' : 'image'] = m.source;
		return form;
	},
	download : function(file){
		return download(file, Tumblr.DATA_URL + file.leafName);
	},
}

Tumblr.Video = {
	convertToModel : function(post, postInfo){
		return update(postInfo, {
			body    : ''+ post['video-caption'],
			source  : ''+ post['video-source'],
			player  : ''+ post['video-player'],
		});
	},
	convertToForm : function(m){
		return {
			'post[type]'  : 'video',
			'post[two]'   : m.body,
			'post[one]'   : m.source,
		};
	},
}

Tumblr.Link = {
	convertToModel : function(post, postInfo){
		return update(postInfo, {
			title  : ''+ post['link-text'],
			source : ''+ post['link-url'],
			body   : ''+ post['link-description'],
		});
	},
	convertToForm : function(m){
		return {
			'post[type]'  : 'link',
			'post[one]'   : m.title,
			'post[three]' : m.body,
			'post[two]'   : m.source,
		};
	},
}

Tumblr.Conversation = {
	convertToModel : function(post, postInfo){
		return update(postInfo, {
			title : ''+ post['conversation-title'],
			body  : ''+ post['conversation-text'],
		});
	},
	convertToForm : function(m){
		return {
			'post[type]'  : 'chat',
			'post[one]'   : m.title,
			'post[two]'   : m.body,
		};
	},
}

Tumblr.Quote = {
	convertToModel : function(post, postInfo){
		return update(postInfo, {
			body   : ''+ post['quote-text'],
			source : ''+ post['quote-source'],
		});
	},
	convertToForm : function(m){
		return {
			'post[type]' : 'quote',
			'post[one]'  : escapeHTML(m.body),
			'post[two]'  : m.source,
		};
	},
}
