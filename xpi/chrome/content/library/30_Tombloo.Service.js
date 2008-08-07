Tombloo.Service = {
	check : function(ctx){
		return withWindow(ctx.window, function(){
			if(!ctx.menu && ctx.target){
				ctx.link = $x('.//ancestor::a', ctx.target);
				ctx.onLink = !!ctx.link;
				ctx.onImage = ctx.target instanceof Ci.nsIDOMHTMLImageElement;
			}
			
			return Tombloo.Service.extractors.check(ctx);
		});
	},
	
	reprError : function(err){
		if(err.name && err.name.match('GenericError'))
			err = err.message;
		
		if(err.status)
			err = err.message + '(' + err.status + ')';
		
		if(!err.lineNumber)
			return '' + err;
		
		var msg = [];
		for(var p in err){
			var val = err[p];
			if(val == null || p == 'stack' || typeof(val)=='function')
				continue;
			
			if(p.toLowerCase() == 'filename' || p == 'location')
				val = ('' + val).replace(/file:[^ ]+\/(.+?)( |$)/g, '$1');
			
			msg.push(p + ' : ' + val);
		}
		
		return '\n'+msg.join('\n');
	},
	
	alertError : function(msg, page, pageUrl){
		error(msg);
		
		if(confirm(getMessage('error.post', this.reprError(msg).indent(8), page, pageUrl))){
			addTab(pageUrl);
		}
	},
	
	share : function(ctx, ext, showForm){
		// エラー処理をまとめるためDeferredの中に入れる
		return succeed().addCallback(function(){
			return Tombloo.Service.extractors.extract(ctx, ext);
		}).addCallback(function(ps){
			log(ps);
			
			if(!ps)
				return;
			
			if(showForm){
				new QuickPostForm(ps).show();
				
				return succeed({});
			}
			
			var config = eval(getPref('postConfig'));
			return Tombloo.Service.post(ps, models.check(ps).filter(function(p){
				return config[p.name] && config[p.name][ps.type];
			}));
		}).addErrback(function(err){
			if(err instanceof CancelledError)
				return;
			
			Tombloo.Service.alertError(err, ctx.title, ctx.href);
		});
	},
	
	post : function(ps, posters){
		log(posters);
		var self = this;
		var ds = {};
		posters = [].concat(posters);
		posters.forEach(function(p){
			try{
				ds[p.name] = p.post(ps);
			} catch(e){
				ds[p.name] = fail(e);
			}
		});
		
		return new DeferredHash(ds).addCallback(function(ress){
			log(ress);
			
			var errs = [];
			var ignoreError = getPref('ignoreError');
			ignoreError = ignoreError && new RegExp(getPref('ignoreError'), 'i');
			for(var name in ress){
				var [success, res] = ress[name];
				if(!success){
					var msg = name + ': ' + 
						(res.message.status? 'HTTP Status Code ' + res.message.status : self.reprError(res).indent(4));
					
					if(!ignoreError || !msg.match(ignoreError))
						errs.push(msg);
				}
			}
			
			if(errs.length)
				self.alertError(errs.join('\n'), ps.page, ps.pageUrl);
		}).addErrback(function(err){
			self.alertError(err, ps.page, ps.pageUrl);
		});
	},
	
	/**
	 * 全てのポストデータをデータベースに追加する。
	 * 取得済みのデータの続きから最新のポストまでが対象となる。
	 *
	 * @param {String} user ユーザー名。
	 * @param {String} type ポストタイプ。
	 * @param {optional Progress} p 処理進捗。
	 */
	update : function(user, type, p){
		p = p || new Progress();
		if(p.ended)
			return;
		
		var d = succeed();
		d.addCallback(bind('getInfo', Tumblr), user, type);
		d.addCallback(function(info){
			// 取得済みのデータがウェブで削除されている場合、その件数分隙間となり取得されない
			p.max = info.total - Tombloo[type? capitalize(type) : 'Post'].countByUser(user);
			
			if(p.ended)
				return;
			
			// FIXME: トランザクションを設け高速化する
			return Tumblr.read(user, type, p.max, function(post){
				if(p.ended)
					throw StopProcess;
				
				try{
					Tombloo.Post.insert(post);
					p.value++;
				} catch(e if e instanceof Database.DuplicateKeyException) {
					// 重複エラーを無視し読み飛ばす
				}
			});
		});
		d.addCallback(bind('complete', p));
		
		return d;
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
			
			return deferredForEach(photos, function(photo){
				if(p.ended)
					throw StopIteration;
				
				p.value++;
				
				return Tumblr.Photo.download(photo.getFile(size));
			});
		});
		d.addBoth(bind('complete', p));
		
		return d;
	},
	
	/**
	 * 画像ファイルの有無を条件にphotoポストを取得する。
	 *
	 * @param {String} user ユーザー名。
	 * @param {Number} size 画像サイズ。75や500などピクセル数を指定する。
	 * @param {Boolean} exists trueの場合、画像ファイルが存在するポストだけが返される。falseは、この逆。
	 * @return {Deferred} 取得した全ポストが渡される。
	 */
	getByFileExists : function(user, size, exists){
		exists = exists==null? true : exists;
		
		var all = [];
		var photoAll = Tombloo.Photo.findByUser(user);
		var d = succeed();
		d.addCallback(function(){
			
			// 全てのポストを繰り返す(100件ごと)
			return deferredForEach(photoAll.split(100), function(photos){
				forEach(photos, function(photo){
					if(photo.checkFile(size) == exists)
						all.push(photo);
				})
				
				// 未応答のエラーが起きないようにウェイトを入れる
				return wait(0);
			})
		});
		d.addCallback(function(){
			return all;
		});
		
		return d;
	},
}
