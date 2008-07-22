Tombloo.Service = {
	check : function(ctx){
		return withWindow(ctx.window, function(){
			if(!ctx.menu && ctx.target){
				ctx.link = $x('.//ancestor::a', ctx.target);
				ctx.onLink = !!ctx.link;
				ctx.onImage = ctx.target instanceof Ci.nsIImageLoadingContent;
			}
			
			return Tombloo.Service.extracters.check(ctx);
		});
	},
	
	reprError : function(err){
		if(err.name && err.name.match('GenericError'))
			err = err.message;
		
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
		
		return '\n'+msg.join('\n').indent(4);
	},
	
	alertError : function(msg, page, pageUrl){
		error(msg);
		
		if(confirm(getMessage('error.post', this.reprError(msg).indent(4), page, pageUrl))){
			addTab(pageUrl);
		}
	},
	
	share : function(ctx, ext, showForm){
		// エラー処理をまとめるためDeferredの中に入れる
		return succeed().addCallback(function(){
			return Tombloo.Service.extracters.extract(ctx, ext);
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
						(res.message.status? 'HTTP Status Code ' + res.message.status : self.reprError(res));
					
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
