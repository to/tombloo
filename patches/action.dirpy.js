Tombloo.Service.actions.register({
	name : 'Dirpy',
	type : 'context',
	icon : 'http://dirpy.com/favicon.ico',
	check : function(ctx){
		return /youtube\.com/.test(ctx.href);
	},
	execute : function(ctx){
		addTab('http://dirpy.com/studio/' + ctx.href.extract(/v=(.*?)(&|$)/));
	},
}, '----');
