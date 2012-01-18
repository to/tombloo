Tombloo.Service.actions.register({
	name : 'AppShopper',
	type : 'context',
	icon : 'http://appshopper.com/favicon.ico',
	check : function(ctx){
		return ctx.host === 'itunes.apple.com';
	},
	execute : function(ctx){
		addTab('http://appshopper.com/search/?search=' + $x('//div[@id="title"]//h1/text()', ctx.document));
	},
}, '----');
