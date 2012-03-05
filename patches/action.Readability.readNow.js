Tombloo.Service.actions.register({
	name : 'Readability - Read Now',
	type : 'context',
	icon : Readability.ICON,
	execute : function(ctx){
		Readability.queue(ctx.href, true).addCallback(function(res){
			ctx.window.location.href = res.channel.URI.spec;
		});
	},
}, '----');
