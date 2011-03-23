shortcutkeys[[KEY_ACCEL, 'SHIFT', 'R'].join(' + ')] = {
	description : 'Reload Tombloo Environment',
	execute : function(e){
		cancel(e);
		
		// processNextEventによりpreventDefaultが無視されるのを避ける
		setTimeout(function(){
			reload();
			log('Tombloo: reloaded');
		}, 0);
	}
}
