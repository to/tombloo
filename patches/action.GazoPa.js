Tombloo.Service.actions.register({
	name : 'GazoPa',
	type : 'context',
	icon : 'http://www.gazopa.com/favicon_gazopa.ico',
	check : function(ctx){
		return ctx.onImage;
	},
	execute : function(ctx){
		addTab('http://www.gazopa.com/similar?key_url=' + encodeURIComponent(ctx.target.src));
	},
}, '----');
