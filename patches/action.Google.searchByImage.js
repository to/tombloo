Tombloo.Service.actions.register({
	name : 'Google Image Search',
	type : 'context',
	icon : 'http://www.google.com/favicon.ico',
	check : function(ctx){
		return ctx.onImage;
	},
	execute : function(ctx){
		addTab('http://www.google.com/searchbyimage?image_url=' + encodeURIComponent(ctx.target.src));
	},
}, '----');
