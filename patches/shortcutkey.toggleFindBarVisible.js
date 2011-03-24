let(initialized){
	shortcutkeys['CTRL + F'] = {
		description : 'Toggle Find Bar',
		execute : function(e){
			if(!initialized){
				// Firefox 4では一度表示するまでFindToolbarが存在しない
				initialized = true;
				return;
			}
			
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
}
