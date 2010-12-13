(function(){
	var BASE_ACTION = {
		name : 'Download Soundcloud',
		type : 'context',
		icon : 'http://soundcloud.com/favicon.ico',
	}
	
	function downloadAll(urls){
		urls = urls.slice(0).filter(function(url){
			return !/\/\/soundcloud.com\/users\//.test(url);
		});
		
		function getTrack(){
			if(!urls.length)
				return;
			
			return Soundcloud.download(urls.shift()).addCallbacks(getTrack, alertError);
		}
		
		function alertError(err){
			alert(err.message.status + ': ' +  err.message.statusText + ': \n' + err.message.channel.URI.spec);
			
			return succeed().addCallbacks(getTrack, alertError);
		}
		
		return succeed().addCallbacks(getTrack, alertError).addCallback(function(){
			notify(BASE_ACTION.name, 'End', notify.ICON_DOWNLOAD);
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
	
	Tombloo.Service.actions.register(update({}, BASE_ACTION, {
		name : 'Download Soundcloud(Set/All)',
		check : function(ctx){
			return ctx.href.match('//soundcloud.com/.*/sets/');
		},
		execute : function(ctx){
			return downloadAll($x('//span[@class="info"]/a', ctx.document, true).map(itemgetter('href')));
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
