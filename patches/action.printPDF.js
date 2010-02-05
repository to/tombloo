Tombloo.Service.actions.register(	{
	name : 'Print PDF',
	icon : 'moz-icon://.pdf?size=16',
	execute : function(){
		const DEEP_DIR = false;
		
		var win = getMostRecentWindow().content;
		var webBrowserPrint = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIWebBrowserPrint);
		
		var PrintSettingsService = Components.classes['@mozilla.org/gfx/printsettings-service;1'].getService(Components.interfaces.nsIPrintSettingsService);
		
		var uri = createURI(win.location.href);
		var file = DEEP_DIR? createDir('pdf/' + uri.host + uri.directory, getDownloadDir()) : getDownloadDir();
		file.append(validateFileName(win.document.title || uri.fileName.split('.').shift()) + '.pdf');
		
		var settings = PrintSettingsService.newPrintSettings;
		update(settings, {
			footerStrLeft : '',
			footerStrCenter : '',
			footerStrRight : '',
			
			headerStrLeft : '',
			headerStrCenter : '',
			headerStrRight : '',
			
			/*
			marginTop : 0,
			marginBottom : 0,
			marginLeft : 0,
			marginRight : 0,
			
			orientation : settings.kLandscapeOrientation,
			*/
			
			printRange : win.getSelection().isCollapsed? settings.kRangeAllPages : settings.kRangeSelection,
			printSilent : true,
			printToFile : true,
			outputFormat : settings.kOutputFormatPDF,
			toFileName : file.path,
		});
		
		webBrowserPrint.print(settings, null);
	},
}, '----');
