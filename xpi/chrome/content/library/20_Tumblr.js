var Tumblr = update({}, AbstractSessionService, {
	name : 'Tumblr',
	ICON : 'http://www.tumblr.com/images/favicon.gif',
	MEDIA_URL : 'http://media.tumblr.com/',
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
		
		return request(url).addCallback(function(res){
			return Tumblr.createInfo(convertToXML(res.responseText));
		});
	},
	
	/**
	 * 各ポストタイプ共通の情報をポストから取得する。
	 *
	 * @param {String} user ユーザー名。
	 * @param {XML} post ポストノード。
	 * @return {Object} ポスト共通情報。ポストID、タイプ、タグなどを含む。
	 */
	getPostInfo : function(user, post){
		return {
				user : user,
				id   : ''+ post.@id, 
				url  : ''+ post.@url, 
				date : ''+ post.@date, 
				type : ''+ post.@type, 
				tags : map(function(tag){return ''+tag}, post.tag), 
		};
	},
	
	/**
	 * Tumblr APIからポストデータを取得する。
	 *
	 * @param {String} user ユーザー名。
	 * @param {optional String} type ポストタイプ。未指定の場合、全タイプとなる。
	 * @param {String} count 先頭から何件を取得するか。
	 * @param {Function} handler 
	 *        各ページ個別処理関数。段階的に処理を行う場合に指定する。
	 *        ページ内の全ポストが渡される。
	 * @return {Deferred} 取得した全ポストが渡される。
	 */
	read : function(user, type, count, handler){
		// FIXME: ストリームにする
		var pages = Tumblr.splitRequests(count);
		var rval = [];
		
		var d = succeed();
		d.addCallback(function(){
			// 全ページを繰り返す
			return deferredForEach(pages, function(page, pageNum){
				var url = Tumblr.buildURL(user, {
					type : type,
					start : page[0],
					num : page[1],
				});
				
				// ページを取得する
				return request(url).addCallback(function(res){
					var xml = convertToXML(res.responseText);
					
					// 全ポストを繰り返す
					var posts = map(function(post){
						var postInfo = Tumblr.getPostInfo(user, post);
						return Tumblr[capitalize(postInfo.type)].convertToModel(post, postInfo);
					}, xml.posts.post);
					
					return handler && handler(posts, (pageNum * Tumblr.PAGE_LIMIT));
				}).addCallback(wait, 1); // ウェイト
			});
		});
		d.addErrback(function(err){
			if(err.message!=StopProcess)
				throw err;
		})
		d.addCallback(function(){
			return rval;
		});
		
		return d;
	},
	
	/**
	 * ポストを削除する。
	 *
	 * @param {Number || String} id ポストID。
	 * @return {Deferred}
	 */
	remove : function(id){
		var self = this;
		return this.getToken().addCallback(function(token){
			return request(self.TUMBLR_URL+'delete', {
				redirectionLimit : 0,
				referrer    : Tumblr.TUMBLR_URL,
				sendContent : {
					id          : id,
					form_key    : token,
					redirect_to : 'dashboard',
				},
			});
		});
	},
	
	/**
	 * reblog情報を取り除く。
	 *
	 * @param {Array} fields reblogポストフォームのフィールドリスト。
	 * @return {Deferred}
	 */
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
	
	/**
	 * ポスト可能かをチェックする。
	 *
	 * @param {Object} ps
	 * @return {Boolean}
	 */
	check : function(ps){
		return (/(regular|photo|quote|link|conversation|video)/).test(ps.type);
	},
	
	/**
	 * 新規エントリー、または、reblogをポストする。
	 * Tombloo.Service.extractors.ReBlogの各抽出メソッドを使いreblog情報を抽出できる。
	 *
	 * @param {Object} ps
	 * @return {Deferred}
	 */
	post : function(ps){
		var endpoint = Tumblr.TUMBLR_URL + 'new/' + ps.type;
		return this.postForm(function(){
			return request(endpoint).addCallback(function(res){
				var form = formContents(res.responseText);
				delete form.preview_post;
				
				update(form, Tumblr[ps.type.capitalize()].convertToForm(ps), {
					'post[tags]' : (ps.tags && ps.tags.length)? joinText(ps.tags, ',') : '',
					'post[is_private]' : ps.private==null? form['post[is_private]'] : (ps.private? 1 : 0),
				});
				
				return request(endpoint, {sendContent : form});
			});
		});
	},
	
	/**
	 * reblogする。
	 *
	 * @param {Object} ps
	 * @return {Deferred}
	 */
	favor : function(ps){
		return this.postForm(function(){
			return request(ps.favorite.endpoint, {
				sendContent : ps.favorite.fields,
			})
		});
	},
	
	/**
	 * フォームをポストする。
	 * 新規エントリーとreblogのエラー処理をまとめる。
	 *
	 * @param {Function} fn
	 * @return {Deferred}
	 */
	postForm : function(fn){
		var d = succeed();
		d.addCallback(fn);
		d.addCallback(function(res){
			var url = res.channel.URI.asciiSpec.replace(/\?.*/,'');
			switch(true){
			case RegExp(Tumblr.TUMBLR_URL+'dashboard').test(url):
				return;
			
			case url == Tumblr.TUMBLR_URL+'login':
				throw new Error(getMessage('error.notLoggedin'));
			
			default:
				// このチェックをするためリダイレクトを追う必要がある
				if(res.responseText.match(/(exceeded|tomorrow)/))
					throw new Error("You've exceeded your daily post limit.");
				
				error(res);
				throw new Error('Error posting entry.');
			}
		});
		return d;
	},
	
	openTab : function(ps){
		if(ps.type == 'reblog')
			return addTab(Tumblr.TUMBLR_URL + 'reblog/' + ps.token.id + '/' + ps.token.token +'?redirect_to='+encodeURIComponent(ps.pageUrl));
		
		var form = Tumblr[ps.type.capitalize()].convertToForm(ps);
		return addTab(Tumblr.TUMBLR_URL+'new/' + ps.type).addCallback(function(win){
			withDocument(win.document, function(){
				populateForm(currentDocument().getElementById('edit_post'), form);
				
				var setDisplay = function(id, style){
					currentDocument().getElementById(id).style.display = style;
				}
				switch(ps.type){
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
	
	getPasswords : function(){
		return getPasswords('http://www.tumblr.com');
	},
	
	login : function(user, password){
		var self = this;
		return request(this.TUMBLR_URL+'login', {
			sendContent : {
				email : user,
				password : password,
			}
		}).addCallback(function(){
			self.updateSession();
			self.user = user;
		});
	},
	
	logout : function(){
		return request(this.TUMBLR_URL+'logout');
	},
	
	getAuthCookie : function(){
		return getCookieString('www.tumblr.com');
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
			return request(this.TUMBLR_URL+'preferences').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.user = $x('id("user_email")/@value', doc);
			});
		}
	},
	
	getCurrentId : function(){
		switch (this.updateSession()){
		case 'none':
			return succeed('');
			
		case 'same':
			if(this.id)
				return succeed(this.id);
			
		case 'changed':
			var self = this;
			return request(this.TUMBLR_URL+'customize').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.id = $x('id("edit_tumblelog_name")/@value', doc);
			});
		}
	},
	
	getToken : function(){
		switch (this.updateSession()){
		case 'none':
			throw new Error('AUTH_FAILD');
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request(this.TUMBLR_URL+'new/text').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.token = $x('id("form_key")/@value', doc);
			});
		}
	},
});


Tumblr.Regular = {
	convertToModel : function(post, postInfo){
		return update(postInfo, {
			body  : ''+ post['regular-body'],
			title : ''+ post['regular-title'],
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : 'regular',
			'post[one]'  : ps.item,
			'post[two]'  : joinText([ps.body, ps.description], '\n\n'),
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
			extension     : image.extension,
		});
	},
	
	convertToForm : function(ps){
		var form = {
			'post[type]'  : 'photo',
			't'           : ps.item,
			'u'           : ps.pageUrl,
			'post[two]'   : joinText([
				ps.item.link(ps.pageUrl) + (ps.author? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''), 
				ps.description], '\n\n'),
			'post[three]' : ps.pageUrl,
		};
		ps.file? (form['image'] = ps.file) : (form['photo_src'] = ps.itemUrl);
		
		return form;
	},
	
	/**
	 * 画像をダウンロードする。
	 *
	 * @param {nsIFile} file 保存先のローカルファイル。このファイル名が取得先のURLにも使われる。
	 * @return {Deferred}
	 */
	download : function(file){
		return download(Tumblr.MEDIA_URL + file.leafName, file);
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
	
	convertToForm : function(ps){
		return {
			'post[type]' : 'video',
			'post[one]'  : ps.body || ps.itemUrl,
			'post[two]'  : joinText([
				ps.item.link(ps.pageUrl) + (ps.author? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''), 
				ps.description], '\n\n'),
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
	
	convertToForm : function(ps){
		var thumb = getPref('thumbnailTemplate').replace('{url}', ps.pageUrl);
		return {
			'post[type]'  : 'link',
			'post[one]'   : ps.item,
			'post[two]'   : ps.itemUrl,
			'post[three]' : joinText([thumb, ps.body, ps.description], '\n\n'),
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
	
	convertToForm : function(ps){
		return {
			'post[type]' : 'chat',
			'post[one]'  : ps.item,
			'post[two]'  : joinText([ps.body, ps.description], '\n\n'),
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
	
	convertToForm : function(ps){
		return {
			'post[type]' : 'quote',
			'post[one]'  : ps.body,
			'post[two]'  : joinText([ps.item.link(ps.pageUrl), ps.description], '\n\n'),
		};
	},
}

if(typeof(models)=='undefined')
	this.models = models = new Repository();
models.register(Tumblr);
