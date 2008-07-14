Tombloo.Service.actions = new Repository([
	{
		name : getMessage('label.action.changeAcount'),
		execute : function(){
			openDialog('chrome://tombloo/content/library/login.xul', 300, 250, 'resizable');
		},
	},
	{
		name : getMessage('label.action.downloadPosts'),
		execute : function(){
			var users = getPref('updateUsers') || '';
			users = prompt('Update target users:', users);
			if(!users)
				return;
			
			setPref('updateUsers', users);
			users = users.split(/[\s,]+/);
			
			// プログレス全体のタスク量を決定するため、事前にコールバックチェーンを構成する
			var p = new Progress('Update');
			var d = new Deferred();
			forEach(users, function(user){
				forEach('regular photo video link conversation quote'.split(' '), function(type){
					d.addCallback(
						Tombloo.Service.update, 
						user, 
						type,
						p.addChild(new Progress('Updating ' + user + "'s " + type + ' posts.'), 20));
				});
				d.addCallback(
					Tombloo.Service.Photo.download, 
					user, 
					75,
					p.addChild(new Progress('Downloading ' + user + "'s photos. (75 pixels)")));
				d.addCallback(
					Tombloo.Service.Photo.download, 
					user, 
					500,
					p.addChild(new Progress('Downloading ' + user + "'s photos. (500 pixels)")));
			});
			d.addBoth(p.complete);
			openProgressDialog(p);
			d.callback();
		},
	},
	{
		name : 'Strobo',
		execute : function(){
			addTab('chrome://tombloo/content/library/Strobo.html');
		},
	},
	{
		name : 'Mosaic',
		execute : function(){
			addTab('chrome://tombloo/content/library/Mosaic.html');
		},
	},
	{
		name : 'Mosaic - Compound Users',
		execute : function(){
			function parseFormula(f){
				var vals = f.replace(/^/,'+').replace(/\s/g,'').split(/(\+|-)/).slice(1);
				return reduce(function(mem, val){
					mem[val[0]=='+'? 'add' : 'sub'].push(val[1].quote());
					return mem;
				}, vals.split(2), {add:[], sub:[]});
			}
			
			var params = values(input({'Formula: e.g.(a + b - c)' : '', 'Random' : true}));
			if(!params.length)
				return;

			var users = parseFormula(params[0]);
			var sql = [];
			sql.push(Entity.compactSQL(<>
				SELECT *
				FROM 
					photos
				WHERE 
					user IN ({users.add.join(',')})
			</>)); 
			if(users.sub.length){
				sql.push(Entity.compactSQL(<>
					AND imageId NOT IN (
						SELECT 
							imageId
						FROM 
							photos
						WHERE 
							user IN ({users.sub.join(',')})
					)
				</>));
			}
			sql.push('ORDER BY ' + (params[1]? 'random()' : 'date DESC'));
			sql.push('LIMIT 1000');
			
			addTab('chrome://tombloo/content/library/Mosaic.html?' + queryString({
				query : sql.join(' '),
			}));
		},
	},
	{
		name : 'Mosaic - Check Duplicated ReBlogs',
		execute : function(){
			var params = {
				query : Entity.compactSQL(<>
					SELECT id, user, imageId 
					FROM photos 
					WHERE user=:user
					GROUP BY user, imageId 
					HAVING count(*)>1
				</>),
				args : prompt('Target user:'),
			};
			if(!params.args)
				return;

			addTab('chrome://tombloo/content/library/Mosaic.html?' + queryString(params));
		},
	},
	{
		name : '----',
	},
	{
		name : getMessage('label.action.tomblooOptions'),
		execute : function(){
			openDialog('chrome://tombloo/content/prefs.xul', 600, 500, 'resizable');
		},
	},
]);
