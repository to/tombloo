Tombloo.Service.actions.register({
	name : 'TwitTalk',
	type : 'context',
	icon : 'http://twittalk.jp/favicon.ico',
	check : function(ctx){
		return ctx.host == 'twitter.com';
	},
	execute : function(ctx){
		var href = $x('./ancestor-or-self::li[starts-with(@id, "status_")]//a[@rel="bookmark"]/@href', ctx.target) || ctx.href;
		if(href)
			addTab(href.replace('twitter.com', 'twittalk.jp'));
	},
}, '----');
