Tombloo.Service.actions.register({
	name : 'TinEye',
	type : 'context',
	icon : 'http://www.tineye.com/favicon.ico',
	check : function(ctx){
		return ctx.onImage;
	},
	execute : function(ctx){
		addTab('http://www.tineye.com/search/?url=' + encodeURIComponent(ctx.target.src));
	},
}, '----');
