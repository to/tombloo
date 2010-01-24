Tombloo.Service.actions.register({
	name : 'SoundCloud - Copy Track Urls in Set',
	type : 'context',
	check : function(ctx){
		return /soundcloud\.com\/.*?\/sets\//.test(ctx.href);
	},
	execute : function(ctx){
		copyString($x('//a[@class="gothere button"]', ctx.document, true).map(itemgetter('href')).join('\n'));
	},
}, '----');
