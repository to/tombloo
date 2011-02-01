Tombloo.Service.actions.register(	{
	name : 'Collect File Links',
	type : 'context',
	execute : function(ctx){
		var urls = {};
		var RE = /^http.*((box\.net|oron\.com|anonym\.to|share|mediafire|send|upload|rapidspread|depositfiles|link-protector|hotfile|soundcloud|fileserve|fufox\.com)|(zip|mp3)$)/;
		
		forEach(ctx.document.links, function(l){
			if(RE.test(l.href))
				urls[l.href] = true;
		});
		
		forEach($x('//param[@name="FlashVars"]', ctx.document, true), function(e){
			forEach(values(parseQueryString(decodeURIComponent(e.value))), function(url){
				if(RE.test(url))
					urls[url] = true;
			});
		});
		
		forEach($x('//text()', ctx.document.body, true), function(l){
			if(/^http/.test(l) && RE.test(l))
				urls[l] = true;
		});
		
		urls = keys(urls);
		notify(this.name, 'Links: ' + urls.length);
		
		ClipboardHelper.copyString(urls.join('\n') + '\n');
	},
}, '----');
