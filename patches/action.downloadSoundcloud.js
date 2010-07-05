(function(){
	var BASE_ACTION = {
		name : 'Download Soundcloud',
		type : 'context',
		icon : 'http://soundcloud.com/favicon.ico',
	}
	
	function downloadAll(urls){
		return deferredForEach(urls, function(url){
			if(/\/\/soundcloud.com\/users\//.test(url))
				return;
			
			return Soundcloud.download(url);
		}).addCallback(function(){
			notify(BASE_ACTION.name, 'End', notify.ICON_DOWNLOAD);
		}).addErrback(function(err){
			alert(err);
			error(err);
		});
	}
	
	Tombloo.Service.actions.register(update({}, BASE_ACTION, {
		check : function(ctx){
			return Soundcloud.normalizeTrackUrl(ctx.href) && 
				ctx.document.querySelectorAll('.info-body').length;
		},
		execute : function(ctx){
			return downloadAll([ctx.href]);
		},
	}), '----');

	Tombloo.Service.actions.register(update({}, BASE_ACTION, {
		name : 'Download Soundcloud(All)',
		check : function(ctx){
			return ctx.href.match('//soundcloud.com') && !!ctx.document.querySelector('.tracks-list');
		},
		execute : function(ctx){
			return downloadAll($x('//div[contains(@class, "info-header")]//h3/a', ctx.document, true).map(itemgetter('href')));
		},
	}), '----');
	
	var downloadFromLdr = {
		name : 'Download Soundcloud(LDR)',
		check : function(ctx){
			return Soundcloud.normalizeTrackUrl(this.getLink(ctx));
		},
		execute : function(ctx){
			return downloadAll([this.getLink(ctx)]);
		},
		getLink : function(ctx){
			var item = Tombloo.Service.extractors.LDR.getItem(ctx, true);
			return item && /soundcloud\.com/.test(item.href) && item.href;
		}
	};
	
	Tombloo.Service.actions.register(update({}, BASE_ACTION, downloadFromLdr), '----');
	Tombloo.Service.actions.register(update({}, BASE_ACTION, downloadFromLdr, {
		name : 'Download Soundcloud(LDR/All)',
		execute : function(ctx){
			return downloadAll(ctx.window.get_active_feed().items.map(itemgetter('link')));
		},
	}), '----');
})();
