shortcutkeys['CTRL + SHIFT + R'] = {
	description : 'Reload Tombloo Environment',
	execute : function(e){
		cancel(e);
		
		reload();
		log('Tombloo: reloaded');
	}
}
