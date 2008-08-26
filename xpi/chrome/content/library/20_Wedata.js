if(typeof(models)=='undefined')
	this.models = models = new Repository();

var Wedata = {
	name : 'Wedata',
	URL : 'http://wedata.net',
	ICON : 'chrome://tombloo/skin/item.ico',
	API_KEY : '61d69503acff33a28b61c0495eeefd6fb8c919a9',
	
	request :function(path, method, data){
		var opts = {
			method : method,
		};
		data = data || {};
		
		if(!method){
			opts.queryString = data;
		} else {
			data.api_key = Wedata.API_KEY;
			opts.sendContent = data;
		}
		
		path = [Wedata.URL].concat(path);
		
		return request(path.join('/'), opts).addCallback(function(res){
			if(/(json|javascript)/.test(res.channel.contentType)){
				return evalInSandbox('(' + res.responseText + ')', Wedata.URL);
			} else {
				return res;
			}
		});
	},
};

Wedata.Database = function(name, data){
	this.name = name;
	
	update(this, data);
};

update(Wedata.Database.prototype, {
	save : function(){
		var self = this;
		var data = {};
		
		// これ以外のパラメーターを送るとエラーが発生する
		forEach('name description required_keys optional_keys permit_other_keys'.split(' '), function(key){
			data['database[' + key + ']'] = self[key];
		});
		
		if(self.resource_url){
			return Wedata.request(['databases', this.name], 'PUT', data).addCallback(function(){
				return self;
			});
		} else {
			return Wedata.request('databases', 'POST', data).addCallback(function(res){
				self.resource_url = res.channel.getResponseHeader('Location');
				
				return self;
			});
		}
	},
	
	remove : function(){
		return Wedata.request(['databases', this.name], 'DELETE');
	},
	
	getItems : function(){
		return Wedata.Item.findByDatabase(this.name);
	},
});

update(Wedata.Database, {
	findByName : function(name){
		return Wedata.request(['databases', name + '.json']).addCallback(function(db){
			return new Wedata.Database(null, db);
		});
	},
	
	findAll : function(){
		return Wedata.request('databases.json').addCallback(function(dbs){
			return dbs.map(function(db){
				return new Wedata.Database(null, db);
			});
		});
	},
});

Wedata.Item = function(db, name, info){
	// Wedataから取得したデータか?
	if(typeof(info.data)=='object' && info.resource_url){
		info.database = db;
	} else {
		info = {
			name : name,
			database : db,
			data : info,
		};
	}
	
	update(this, info.data);
	
	this.getMetaInfo = function(){
		return info;
	}
};

update(Wedata.Item.prototype, {
	save : function(){
		var self = this;
		var info = this.getMetaInfo();
		var db = info.database;
		var data = {
			name : info.name,
		};
		
		for(var key in this){
			var value = this[key];
			if(typeof(value)=='function')
				continue;
			
			data['data[' + key + ']'] = value;
		}
		
		if(info.resource_url){
			var id = info.resource_url.split('/').pop();
			return Wedata.request(['items', id], 'PUT', data).addCallback(function(){
				return self;
			});
		} else {
			return Wedata.request(['databases', db, 'items'], 'POST', data).addCallback(function(res){
				self.getMetaInfo().resource_url = res.channel.getResponseHeader('Location');
				
				return self;
			});
		}
	},
	
	remove : function(){
		var id = this.getMetaInfo().resource_url.split('/').pop();
		
		return Wedata.request(['items', id], 'DELETE');
	},
});

update(Wedata.Item, {
	findByDatabase : function(db){
		return this.findByDatabaseAndKeyword(db);
	},
	
	findByDatabaseAndKeyword : function(db, word){
		return Wedata.request(['databases', db, 'items.json'], null, {
			query : word,
		}).addCallback(function(items){
			return items.map(function(item){
				return new Wedata.Item(db, item.name, item);
			});
		});
	},
});

models.register(Wedata);
