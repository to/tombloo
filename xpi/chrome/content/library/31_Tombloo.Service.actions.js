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
			
			// FIXME: アクション用のprefに
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
		name : 'Mosaic',
		execute : function(){
			addTab('chrome://tombloo/content/library/Mosaic.html');
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
