Tombloo.Service.actions.register({
	name : 'Send to Instapaper',
	type : 'context',
	icon : 'chrome://tombloo/skin/instapaper.ico',
	execute : function(ctx){
		return models.Instapaper.post(ctx.onLink? {
			item : ctx.link.textContent,
			itemUrl : ctx.link.href,
		} : {
			item : ctx.title,
			itemUrl : ctx.href,
		});
	},
}, '----');
