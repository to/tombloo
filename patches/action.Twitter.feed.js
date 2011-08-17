Tombloo.Service.actions.register({
	name : 'Twitter Feed',
	type : 'context',
	icon : 'http://twitter.com/favicon.ico',
	check : function(ctx){
		return /twitter\.com/.test(ctx.host) && ctx.document.querySelector('.screen-name');
	},
	execute : function(ctx){
		var user = ctx.document.querySelector('.screen-name').textContent.replace('@', '');
		addTab('http://twitter.com/statuses/user_timeline/' + user + '.rss');
	},
}, '----');
