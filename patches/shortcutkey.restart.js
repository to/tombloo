shortcutkeys['CTRL + SHIFT + ALT + R'] = {
	description : 'Restart Firefox',
	execute : function(e){
		var AppStartup = getService('/toolkit/app-startup;1', Ci.nsIAppStartup);
		AppStartup.quit(AppStartup.eRestart | AppStartup.eAttemptQuit);
	}
}
