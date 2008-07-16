shortcutkeys['CTRL + F'] = {
	description : 'Toggle Find Bar',
	execute : function(e){
		cancel(e);
		
		with(getMostRecentWindow()){
			var bar = document.getElementById('FindToolbar');
			if(bar.close){
				bar.hidden? gFindBar.onFindCommand() : gFindBar.close();
			} else {
		    bar.hidden? gFindBar.onFindCmd() : gFindBar.closeFindBar();
			}
		}
	}
}
