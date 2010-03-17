Tombloo.Service.actions.register({
	name : 'Search 2ch Dat',
	type : 'context',
	icon : 'http://2ch.net/favicon.ico',
	check : function(ctx){
		return ctx.host.match('2ch.net');
	},
	execute : function(ctx){
		addTab('http://www.geocities.jp/mirrorhenkan/url.html?u=' + ctx.href);
	},
}, '----');
