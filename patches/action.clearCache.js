Tombloo.Service.actions.register({
	name : 'Clear Cache',
	icon : 'chrome://tombloo/skin/firefox.ico',
	execute : function(){
		CacheService.evictEntries(ICache.STORE_ANYWHERE);
	},
}, '----');
