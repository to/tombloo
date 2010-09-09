Tombloo.Service.actions.register({
	name : 'Copy Installed Extensions',
	icon : 'chrome://tombloo/skin/firefox.ico',
	execute : function(){
    copyString(FuelApplication.extensions.all.reduce(function(m, ext) {
      return m + (ext.enabled ? [ext.name, ext.version].join(" ") + "\n" : '');
    }, ''));
	},
}, '----');
