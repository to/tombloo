Tombloo.Service.actions.register({
	name : 'Amazon Search Seller',
	type : 'context',
	icon : 'http://www.amazon.co.jp/favicon.ico',
	check : function(ctx){
		return /amazon\./.test(ctx.host) && /seller/.test(ctx.search);
	},
	execute : function(ctx){
		addTab('http://www.512x.net/seller/' + parseQueryString(ctx.search).seller + '/');
	},
}, '----');
