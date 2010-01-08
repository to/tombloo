Tombloo.Service.actions.register(	{
	name : 'Print PDF',
	type : 'context',
	execute : function(ctx){
		var webBrowserPrint = getMostRecentWindow().content.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIWebBrowserPrint);
		
		var PrintSettingsService = Components.classes['@mozilla.org/gfx/printsettings-service;1'].getService(Components.interfaces.nsIPrintSettingsService);
		
		var uri = createURI(ctx.window.location.href);
		var file = createDir(uri.host + uri.directory, getDownloadDir());
		file.append(uri.fileName.split('.').shift() + '.pdf');
		
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
			
			printRange : ctx.window.getSelection().isCollapsed? settings.kRangeAllPages : settings.kRangeSelection,
			printSilent : true,
			printToFile : true,
			outputFormat : settings.kOutputFormatPDF,
			toFileName : file.path,
		});
		
		webBrowserPrint.print(settings, null);
	},
}, '----');
