if(typeof(models)=='undefined')
	this.models = models = new Repository();

var Tumblr = update({}, AbstractSessionService, {
	name : 'Tumblr',
	ICON : 'http://www.tumblr.com/images/favicon.gif',
	MEDIA_URL : 'http://media.tumblr.com/',
	TUMBLR_URL : 'http://www.tumblr.com/',
	PAGE_LIMIT : 50,
	
	/**
	 * 各Tumblrの基本情報(総件数/タイトル/タイムゾーン/名前)を取得する。
	 *
	 * @param {String} user ユーザー名。
	 * @param {XML} post ポストノード。
	 * @return {Object} ポスト共通情報。ポストID、タイプ、タグなどを含む。
	 */
	getInfo : function(user, type){
		return request('http://'+user+'.tumblr.com/api/read', {
			queryString : {
				type  : type,
				start : 0,
				num   : 0,
			}
		}).addCallback(function(res){
			var xml = convertToXML(res.responseText);
			return {
				type     : ''+xml.posts.@type,
				start    :  1*xml.posts.@start,
				total    :  1*xml.posts.@total,
				name     : ''+xml.tumblelog.@name,
				title    : ''+xml.tumblelog.@title,
				timezone : ''+xml.tumblelog.@timezone,
			};
		});
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
		var pages = Tumblr._splitRequests(count);
		var result = [];
		
		var d = succeed();
		d.addCallback(function(){
			// 全ページを繰り返す
			return deferredForEach(pages, function(page, pageNum){
				// ページを取得する
				return request('http://'+user+'.tumblr.com/api/read', {
					queryString : {
						type  : type,
						start : page[0],
						num   : page[1],
					},
				}).addCallback(function(res){
					var xml = convertToXML(res.responseText);
					
					// 全ポストを繰り返す
					var posts = map(function(post){
						var info = {
							user : user,
							id   : ''+ post.@id, 
							url  : ''+ post.@url, 
							date : ''+ post.@date, 
							type : ''+ post.@type, 
							tags : map(function(tag){return ''+tag}, post.tag), 
						};
						
						return Tumblr[info.type.capitalize()].convertToModel(post, info);
					}, xml.posts.post);
					
					result = result.concat(posts);
					
					return handler && handler(posts, (pageNum * Tumblr.PAGE_LIMIT));
				}).addCallback(wait, 1); // ウェイト
			});
		});
		d.addErrback(function(err){
			if(err.message!=StopProcess)
				throw err;
		})
		d.addCallback(function(){
			return result;
		});
		
		return d;
	},
	
	/**
	 * API読み込みページリストを作成する。
	 * TumblrのAPIは120件データがあるとき、100件目から50件を読もうとすると、
	 * 差し引かれ70件目から50件が返ってくる。
	 *
	 * @param {Number} count 読み込み件数。
	 * @return {Array}
	 */
	_splitRequests : function(count){
		var res = [];
		var limit = Tumblr.PAGE_LIMIT;
		for(var i=0,len=Math.ceil(count/limit) ; i<len ; i++){
			res.push([i*limit, limit]);
		}
		count%limit && (res[res.length-1][1] = count%limit);
		
		return res;
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
			return request(Tumblr.TUMBLR_URL+'delete', {
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
	 * @param {Array} form reblogフォーム。
	 * @return {Deferred}
	 */
	trimReblogInfo : function(form){
		if(!getPref('trimReblogInfo'))
		 return;
		 
		function trimQuote(entry){
			entry = entry.replace(/<p><\/p>/g, '').replace(/<p><a[^<]+<\/a>:<\/p>/g, '');
			entry = (function(all, contents){
				return contents.replace(/<blockquote>(([\n\r]|.)+)<\/blockquote>/gm, arguments.callee);
			})(null, entry);
			return entry.trim();
		}
		
		switch(form['post[type]']){
		case 'link':
			form['post[three]'] = trimQuote(form['post[three]']);
			break;
		case 'regular':
		case 'photo':
		case 'video':
			form['post[two]'] = trimQuote(form['post[two]']);
			break;
		case 'quote':
			form['post[two]'] = form['post[two]'].replace(/ \(via <a.*?<\/a>\)/g, '').trim();
			break;
		}
		
		return form;
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
	 * 新規エントリーをポストする。
	 *
	 * @param {Object} ps
	 * @return {Deferred}
	 */
	post : function(ps){
		var self = this;
		var endpoint = Tumblr.TUMBLR_URL + 'new/' + ps.type;
		return this.postForm(function(){
			return self.getForm(endpoint).addCallback(function(form){
				update(form, Tumblr[ps.type.capitalize()].convertToForm(ps));
				
				self.appendTags(form, ps);
				
				return request(endpoint, {sendContent : form});
			});
		});
	},
	
	/**
	 * ポストフォームを取得する。
	 * reblogおよび新規エントリーのどちらでも利用できる。
	 *
	 * @param {Object} url フォームURL。
	 * @return {Deferred}
	 */
	getForm : function(url){
		var self = this;
		return request(url).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var form = formContents(doc);
			delete form.preview_post;
			form.redirect_to = Tumblr.TUMBLR_URL+'dashboard';
			
			if(form.reblog_post_id){
				self.trimReblogInfo(form);
				
				// Tumblrから他サービスへポストするため画像URLを取得しておく
				if(form['post[type]']=='photo')
					form.image = $x('id("edit_post")//img[contains(@src, "media.tumblr.com/") or contains(@src, "data.tumblr.com/")]/@src', doc);
			}
			
			return form;
		});
	},
	
	/**
	 * フォームへタグとプライベートを追加する。
	 *
	 * @param {Object} url フォームURL。
	 * @return {Deferred}
	 */
	appendTags : function(form, ps){
		if(ps.private!=null)
			form['post[state]'] = (ps.private)? 'private' : 0;
		
		return update(form, {
			'post[tags]' : (ps.tags && ps.tags.length)? joinText(ps.tags, ',') : '',
		});
	},
	
	/**
	 * reblogする。
	 * Tombloo.Service.extractors.ReBlogの各抽出メソッドを使いreblog情報を抽出できる。
	 *
	 * @param {Object} ps
	 * @return {Deferred}
	 */
	favor : function(ps){
		// メモをreblogフォームの適切なフィールドの末尾に追加する
		var form = ps.favorite.form;
		items(Tumblr[ps.type.capitalize()].convertToForm({
			description : ps.description,
		})).forEach(function([name, value]){
			if(!value)
				return;
			
			form[name] += '\n\n' + value;
		});
		
		this.appendTags(form, ps);
		
		return this.postForm(function(){
			return request(ps.favorite.endpoint, {sendContent : form})
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
		var self = this;
		var d = succeed();
		d.addCallback(fn);
		d.addCallback(function(res){
			var url = res.channel.URI.asciiSpec;
			switch(true){
			case /dashboard/.test(url):
				return;
			
			case /login/.test(url):
				throw new Error(getMessage('error.notLoggedin'));
			
			default:
				// このチェックをするためリダイレクトを追う必要がある
				// You've used 100% of your daily photo uploads. You can upload more tomorrow.
				if(res.responseText.match('more tomorrow'))
					throw new Error("You've exceeded your daily post limit.");
				
				var doc = convertToHTMLDocument(res.responseText);
				throw new Error(convertToPlainText(doc.getElementById('errors')));
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
		var LOGIN_FORM_URL = 'https://www.tumblr.com/login';
		var LOGIN_EXEC_URL = 'https://www.tumblr.com/svc/account/register';
		var self = this;
		return Tumblr.logout().addCallback(function(){
			return request(LOGIN_FORM_URL).addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				var form = doc.getElementById('signup_form');
				return request(LOGIN_EXEC_URL, {
					sendContent : update(formContents(form), {
						'action'         : 'signup_login',
						'user[email]'    : user,
						'user[password]' : password
					})
				});
			}).addCallback(function(){
				self.updateSession();
				self.user = user;
			});
		});
	},
	
	logout : function(){
		return request(Tumblr.TUMBLR_URL+'logout');
	},
	
	getAuthCookie : function(){
		return getCookieString('www.tumblr.com');
	},
	
	/**
	 * ログイン中のユーザーを取得する。
	 * 結果はキャッシュされ、再ログインまで再取得は行われない。
	 * アカウント切り替えのためのインターフェースメソッド。
	 *
	 * @return {Deferred} ログインに使われるメールアドレスが返される。
	 */
	getCurrentUser : function(){
		switch (this.updateSession()){
		case 'none':
			return succeed('');
			
		case 'same':
			if(this.user)
				return succeed(this.user);
			
		case 'changed':
			var self = this;
			return request(Tumblr.TUMBLR_URL+'preferences').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.user = $x('id("user_email")/@value', doc);
			});
		}
	},
	
	/**
	 * ログイン中のユーザーIDを取得する。
	 *
	 * @return {Deferred} ユーザーIDが返される。
	 */
	getCurrentId : function(){
		switch (this.updateSession()){
		case 'none':
			return succeed('');
			
		case 'same':
			if(this.id)
				return succeed(this.id);
			
		case 'changed':
			var self = this;
			return request(Tumblr.TUMBLR_URL+'customize').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.id = $x('id("edit_tumblelog_name")/@value', doc);
			});
		}
	},
	
	/**
	 * ポストや削除に使われるトークン(form_key)を取得する。
	 * 結果はキャッシュされ、再ログインまで再取得は行われない。
	 *
	 * @return {Deferred} トークン(form_key)が返される。
	 */
	getToken : function(){
		switch (this.updateSession()){
		case 'none':
			throw new Error(getMessage('error.notLoggedin'));
			
		case 'same':
			if(this.token)
				return succeed(this.token);
			
		case 'changed':
			var self = this;
			return request(Tumblr.TUMBLR_URL+'new/text').addCallback(function(res){
				var doc = convertToHTMLDocument(res.responseText);
				return self.token = $x('id("form_key")/@value', doc);
			});
		}
	},
	
	getTumblelogs : function(){
		return request(Tumblr.TUMBLR_URL+'new/text').addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			return $x('id("channel_id")//option[@value!=0]', doc, true).map(function(opt){
				return {
					id : opt.value,
					name : opt.textContent,
				}
			});
		});
	},
});


Tumblr.Regular = {
	convertToModel : function(post, info){
		return update(info, {
			body  : ''+ post['regular-body'],
			title : ''+ post['regular-title'],
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : ps.item,
			'post[two]'  : joinText([getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Photo = {
	convertToModel : function(post, info){
		var photoUrl = post['photo-url'];
		var photoUrl500 = ''+photoUrl.(@['max-width'] == 500);
		var image = Tombloo.Photo.getImageInfo(photoUrl500);
		
		return update(info, {
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
			'post[type]'  : ps.type,
			't'           : ps.item,
			'u'           : ps.pageUrl,
			'post[two]'   : joinText([
				(ps.item? ps.item.link(ps.pageUrl) : '') + (ps.author? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''), 
				ps.description], '\n\n'),
			'post[three]' : ps.pageUrl,
		};
		ps.file? (form['images[o1]'] = ps.file) : (form['photo_src'] = ps.itemUrl);
		
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
	convertToModel : function(post, info){
		return update(info, {
			body    : ''+ post['video-caption'],
			source  : ''+ post['video-source'],
			player  : ''+ post['video-player'],
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : getFlavor(ps.body, 'html') || ps.itemUrl,
			'post[two]'  : joinText([
				(ps.item? ps.item.link(ps.pageUrl) : '') + (ps.author? ' (via ' + ps.author.link(ps.authorUrl) + ')' : ''), 
				ps.description], '\n\n'),
		};
	},
}

Tumblr.Link = {
	convertToModel : function(post, info){
		return update(info, {
			title  : ''+ post['link-text'],
			source : ''+ post['link-url'],
			body   : ''+ post['link-description'],
		});
	},
	
	convertToForm : function(ps){
		var thumb = getPref('thumbnailTemplate').replace(RegExp('{url}', 'g'), ps.pageUrl);
		return {
			'post[type]'  : ps.type,
			'post[one]'   : ps.item,
			'post[two]'   : ps.itemUrl,
			'post[three]' : joinText([thumb, getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Conversation = {
	convertToModel : function(post, info){
		return update(info, {
			title : ''+ post['conversation-title'],
			body  : ''+ post['conversation-text'],
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : ps.item,
			'post[two]'  : joinText([getFlavor(ps.body, 'html'), ps.description], '\n\n'),
		};
	},
}

Tumblr.Quote = {
	convertToModel : function(post, info){
		return update(info, {
			body   : ''+ post['quote-text'],
			source : ''+ post['quote-source'],
		});
	},
	
	convertToForm : function(ps){
		return {
			'post[type]' : ps.type,
			'post[one]'  : getFlavor(ps.body, 'html'),
			'post[two]'  : joinText([(ps.item? ps.item.link(ps.pageUrl) : ''), ps.description], '\n\n'),
		};
	},
}

models.register(Tumblr);


/*
 * Tumblrフォーム変更対応パッチ(2012/1/25周辺)
 * UAを古いAndroidにして旧フォームを取得。
 *
 * polygonplanetのコードを簡略化(パフォーマンス悪化の懸念あり)
 * https://gist.github.com/4643063
*/
var request_ = request;
request = function(url, opts){
	if(/^https?:\/\/(?:\w+\.)*tumblr\..*\/(?:reblog\/|new\/\w+)/.test(url)){
		opts = updatetree(opts, {
			headers : {
				'User-Agent' : 'Mozilla/5.0 (Linux; U; Android 2.3.4; ja-jp; Build) Version/4.0 Mobile Safari/532'
			}
		});
	}
	
	return request_(url, opts);
};
