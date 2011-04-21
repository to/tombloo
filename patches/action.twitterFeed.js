Tombloo.Service.actions.register({
	name : 'Twiiter Feed',
	type : 'context',
	icon : Twitter.ICON,
	check : function(ctx){
		return ctx.host == 'twitter.com';
	},
	execute : function(ctx){
		var name = ctx.hash.split('/')[1];
		request('http://api.twitter.com/1/users/show/' + name + '.json').addCallback(function(res){
			return evalInSandbox('(' + res.responseText + ')', Twitter.URL);
		}).addCallback(function(user){
			addTab('http://twitter.com/statuses/user_timeline/' + user.id + '.atom');
		});
	},
}, '----');
