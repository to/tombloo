Tombloo.Service.actions.register({
	name : 'Soundcloud Feed',
	type : 'context',
	icon : 'http://soundcloud.com/favicon.ico',
	check : function(ctx){
		return /soundcloud\.com/.test(ctx.href);
	},
	execute : function(ctx){
		var user = ctx.href.extract(/soundcloud\.com\/(.*?)(\/|$)/);
		addTab('http://cloudfeeds.theblackestbox.net/users/' + user + '/tracks');
	},
}, '----');
