Tombloo.Service.actions.register({
	name : 'Twitter Feed',
	type : 'context',
	icon : 'http://twitter.com/favicon.ico',
	check : function(ctx){
		return /twitter\.com/.test(ctx.host) && ctx.document.querySelector('.screen-name');
	},
	execute : function(ctx){
		var user = ctx.document.querySelector('.screen-name').textContent.replace('@', '');
		addTab('https://api.twitter.com/1/statuses/user_timeline.rss?screen_name=' + user);
	},
}, '----');
