Tombloo.Service = {
	/**
	 * コンテキストからどのような情報が抽出できるのかチェックする。
	 * 処理は同期で行われる。
	 *
	 * @param {Object} ctx 抽出コンテキスト。
	 * @return {Array} extractorのリスト。
	 */
	check : function(ctx){
		return withWindow(ctx.window, function(){
			// コンテキストメニューからの呼び出しの場合そちらで設定されている
			// html要素などのルート要素も除外する
			if(!ctx.menu && ctx.target && 
				(ctx.target.parentNode != ctx.target.ownerDocument && ctx.target != ctx.target.ownerDocument)){
				ctx.link = $x('./ancestor::a', ctx.target);
				ctx.onLink = !!ctx.link;
				ctx.onImage = ctx.target instanceof Ci.nsIDOMHTMLImageElement;
			}
			
			return Tombloo.Service.extractors.check(ctx);
		});
	},
	
	/**
	 * コンテキストから情報を抽出しポストする。
	 * 設定画面で指定されたサービスが、ポスト先の対象となる。
	 * フォームを表示した場合、ポストは行われない。
	 *
	 * @param {Object} ctx 抽出コンテキスト。
	 * @param {Object} ext extractor。抽出方法。
	 * @param {Boolean} showForm クイックポストフォームを表示するか。
	 * @return {Deferred} ポスト完了後に呼び出される。
	 */
	share : function(ctx, ext, showForm){
		// エラー処理をまとめるためDeferredの中に入れる
		return succeed().addCallback(function(){
			return Tombloo.Service.extractors.extract(ctx, ext);
		}).addCallback(function(ps){
			ctx.ps = ps;
			
			// 予期せずに連続してquoteをポストしてしまうのを避けるため選択を解除する
			if(ps.type == 'quote' && ctx.window.getSelection().rangeCount)
				ctx.window.getSelection().collapseToStart();
			
			debug(ps);
			
			if(!ps)
				return succeed({});
			
			if(showForm){
				// 利用可能なサービスがあるか？
				if(models.getEnables(ps).length){
					QuickPostForm.show(ps, (ctx.mouse && (ctx.mouse.post || ctx.mouse.screen)));
				} else {
					Tombloo.Service.alertPreference(ps.type);
				}
				
				// FIXME: クイックポストフォームのポスト結果を伝えるように
				return succeed({});
			}
			
			var posters = models.getDefaults(ps);
			if(!posters.length){
				Tombloo.Service.alertPreference(ps.type);
				return succeed({});
			}
			
			return Tombloo.Service.post(ps, posters);
		}).addErrback(function(err){
			if(err instanceof CancelledError)
				return;
			
			Tombloo.Service.alertError(err, ctx.title, ctx.href, ctx.ps);
		});
	},
	
	/**
	 * 対象のポスト先に一括でポストする。
	 *
	 * @param {Object} ps ポスト内容。
	 * @param {Array} posters ポスト対象サービスのリスト。
	 * @return {Deferred} ポスト完了後に呼び出される。
	 */
	post : function(ps, posters){
		// エラー後再ポスト時のデバッグに使用
		debug(ps);
		debug(posters);
		
		var self = this;
		var ds = {};
		posters = [].concat(posters);
		posters.forEach(function(p){
			try{
				ds[p.name] = (ps.favorite && RegExp('^' + ps.favorite.name + '(\\s|$)').test(p.name))? p.favor(ps) : p.post(ps);
			} catch(e){
				ds[p.name] = fail(e);
			}
		});
		
		return new DeferredHash(ds).addCallback(function(ress){
			debug(ress);
			
			var errs = [];
			var ignoreError = getPref('ignoreError');
			ignoreError = ignoreError && new RegExp(getPref('ignoreError'), 'i');
			for(var name in ress){
				var [success, res] = ress[name];
				if(!success){
					var msg = name + ': ' + 
						(res.message.status? 'HTTP Status Code ' + res.message.status : '\n' + self.reprError(res).indent(4));
					
					if(!ignoreError || !msg.match(ignoreError))
						errs.push(msg);
				}
			}
			
			if(errs.length)
				self.alertError(errs.join('\n'), ps.page, ps.pageUrl, ps);
		}).addErrback(function(err){
			self.alertError(err, ps.page, ps.pageUrl, ps);
		});
	},
	
	/**
	 * 詳細なエラー情報を表す文字列を生成する。
	 *
	 * @param {Error} err 
	 * @return {String}
	 */
	reprError : function(err){
		// MochiKitの汎用エラーの場合、内部の詳細エラーを使う
		if(err.name && err.name.match('GenericError'))
			err = err.message;
		
		if(err.status)
			err = err.message + '(' + err.status + ')';
		
		if(typeof(err) != 'object')
			return '' + err;
		
		var msg = [];
		getAllPropertyNames(err, Object.prototype).forEach(function(prop){
			var val = err[prop];
			if(val == null || /(stack|name)/.test(prop) || typeof(val) == 'function')
				return;
			
			if(prop.toLowerCase() === 'filename' || prop === 'location')
				val = ('' + val).replace(/file:[^ ]+\/(.+?)( |$)/g, '$1');
			
			msg.push(prop + ' : ' + val);
		});
		
		return msg.join('\n');
	},
	
	/**
	 * エラーメッセージ付きでポストフォームを再表示する。
	 *
	 * @param {String || Error} msg エラー、または、エラーメッセージ。
	 * @param {String} page エラー発生ページタイトル。
	 * @param {String} pageUrl エラー発生ページURL。
	 * @param {Object} ps ポスト内容。
	 */
	alertError : function(msg, page, pageUrl, ps){
		error(msg);
		
		msg = getMessage('error.post', this.reprError(msg).indent(2), page, pageUrl);
		if(ps && ps.type){
			// ポスト内容があればフォームを再表示する。
			QuickPostForm.show(ps, null, msg);
		} else {
			if(confirm(msg + '\n\n' + getMessage('message.reopen'))){
				addTab(pageUrl);
			}
		}
	},
	
	/**
	 * 設定画面を開き指定を促す。
	 *
	 * @param {String} type ポストタイプ。
	 */
	alertPreference : function(type){
		var win = openDialog('chrome://tombloo/content/prefs.xul', 'resizable,centerscreen');
		win.addEventListener('load', function(){
			// load時は、まだダイアログが表示されていない
			setTimeout(function(){
				win.alert(getMessage('error.noPoster', type.capitalize()));
			}, 0);
		}, false);
	},
	
	/**
	 * 全てのポストデータをデータベースに追加する。
	 * 取得済みのデータの続きから最新のポストまでが対象となる。
	 *
	 * @param {String} user ユーザー名。
	 * @param {String} type ポストタイプ。未指定の場合、全タイプが対象となる。
	 * @param {optional Progress} p 処理進捗。
	 */
	update : function(user, type, p){
		p = p || new Progress();
		if(p.ended)
			return;
		
		return Tombloo.db.transaction(function(){
			var d = succeed();
			d.addCallback(bind('getInfo', Tumblr), user, type);
			d.addCallback(function(info){
				// 取得済みのデータがウェブで削除されている場合、その件数分隙間となり取得されない
				// 但し、ページ単位で処理が行われ、件数を超えて処理が行われるため、そこで補正される可能性が高い
				p.max = info.total - Tombloo[type? type.capitalize() : 'Post'].countByUser(user);
				
				if(p.ended)
					return;
				
				// 全ポストを繰り返す
				return Tumblr.read(user, type, info.total, function(posts){
					
					// ページ内のポストを繰り返す
					posts.forEach(function(post){
						try{
							Tombloo.Post.insert(post);
							p.value++;
						} catch(e if e instanceof Database.DuplicateKeyException) {
							// 前回の処理を途中で終了したときに発生する重複エラーを無視する
						}
					});
					
					// 件数分処理したら終了しAPIの読み込みを止める
					if(p.ended)
						throw StopProcess;
				});
			});
			d.addCallback(bind('complete', p));
			
			return d;
		});
	},
}


Tombloo.Service.Photo = {
	/**
	 * 未取得の画像ファイルを全てダウンロードする。
	 *
	 * @param {String} user ユーザー名。
	 * @param {Number} size 画像サイズ。75や500などピクセル数を指定する。
	 * @param {optional Progress} p 処理進捗。
	 */
	download : function(user, size, p){
		p = p || new Progress();
		if(p.ended)
			return;
		
		var d = succeed();
		d.addCallback(function(){
			return Tombloo.Service.Photo.getByFileExists(user, size, false);
		});
		d.addCallback(function(photos){
			p.max = photos.length;
			
			if(p.ended)
				return;
			
			return Tombloo.db.transaction(function(){
				// 全ての未取得のphotoを繰り返す
				return deferredForEach(photos, function(photo){
					if(p.ended)
						throw StopIteration;
					
					p.value++;
					
					// ダウンロードを試行する拡張子の順序を決定する
					var exts = ['gif', 'png', 'jpg'];
					if(photo.extension)
						exts.unshift(exts.splice(exts.indexOf(photo.extension), 1)[0]);
					
					return (function(){
						if(!exts.length)
							return;
						
						var me = arguments.callee;
						photo.extension = exts.shift();
						return Tumblr.Photo.download(photo.getFile(size)).addCallback(function(){
							// ダウンロードが失敗した場合、拡張子を変えて再試行する
							if(!photo.checkFile(size))
								return succeed().addCallback(me);
							
							// 正しい拡張子とファイル存在を保存する
							photo['file' + size] = 1;
							photo.save();
						});
					})();
				});
			});
		});
		d.addCallback(bind('complete', p));
		
		return d;
	},
	
	/**
	 * 画像ファイルの有無を条件にphotoポストを取得する。
	 * まずデータベースに記録された有無で情報を取得した後、
	 * 実際のファイルの存在を再度確認する。
	 *
	 * @param {String} user ユーザー名。
	 * @param {Number} size 画像サイズ。75や500などピクセル数を指定する。
	 * @param {Boolean} exists 
	 *        trueの場合、画像ファイルが存在するポストだけが返される。falseは、この逆。
	 *        省略された場合は、trueになる。
	 * @return {Deferred} 取得した全ポストが渡される。
	 */
	getByFileExists : function(user, size, exists){
		exists = exists==null? true : exists;
		
		var result = [];
		var photoAll = Tombloo.Photo['findByUserAndFile' + size]([user, Number(exists)]);
		
		var d = Tombloo.db.transaction(function(){
			// 全てのポストを繰り返す(150件ごと)
			return deferredForEach(photoAll.split(150), function(photos){
				forEach(photos, function(photo){
					var actual = photo.checkFile(size);
					if(actual == exists)
						result.push(photo);
					
					// ファイル存在がデータベースと違っていたら更新する
					if(actual != photo['file' + size]){
						photo['file' + size] = Number(actual);
						photo.save();
					}
				});
				
				// 未応答のエラーが起きないようにウェイトを入れる
				return wait(0);
			});
		});
		d.addCallback(function(){
			return result;
		});
		
		return d;
	},
}
