Tombloo.Service.actions.register(	{
	name : 'Collect File Links',
	type : 'context',
	execute : function(ctx){
		var urls = {};
		var RE = /((anonym\.to|share|mediafire|send|upload|rapidspread)|(zip|mp3)$)/;
		
		forEach(ctx.document.links, function(l){
			if(RE.test(l.href))
				urls[l.href] = true;
		});
		
		forEach($x('//text()', ctx.document.body, true), function(l){
			if(/^http/.test(l) && RE.test(l))
				urls[l] = true;
		});
		
		urls = keys(urls);
		notify(this.name, 'Links: ' + urls.length);
		
		ClipboardHelper.copyString(urls.join('\n'));
	},
}, '----');
