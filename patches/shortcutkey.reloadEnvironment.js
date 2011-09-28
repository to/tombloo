shortcutkeys[[KEY_ACCEL, 'SHIFT', 'R'].join(' + ')] = {
	description : 'Reload Tombloo Environment',
	execute : function(e){
		cancel(e);
		
		reload();
		log('Tombloo: reloaded');
	}
}
