
var DownloadManager = {
	filenameHash: {},
	addMetaData: function (filename, metadata) {
		var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"]
								   .getService(Components.interfaces.nsIXULRuntime);
		if ( xulRuntime.OS == 'Darwin' ) {
			var as = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
			as.initWithPath("/usr/bin/osascript");

			var process = Components.classes["@mozilla.org/process/util;1"]
					.createInstance(Components.interfaces.nsIProcess);
			process.init(as);

			var script = [
				'set aFile to POSIX file ("' + filename + '" as Unicode text)',
				'set cmtStr to ("' + metadata + '" as Unicode text)',
				'tell application "Finder" to set comment of (file aFile) to cmtStr'
			].join(" \n ");
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
						  .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = 'UTF-16';
			var is = converter.convertToInputStream(script);
			var fos = Components.classes["@mozilla.org/network/file-output-stream;1"]
									 .createInstance(Components.interfaces.nsIFileOutputStream);
			var bs = Components.classes["@mozilla.org/binaryinputstream;1"]
									.createInstance(Components.interfaces.nsIBinaryInputStream);
			bs.setInputStream(is);

			var file = Components.classes["@mozilla.org/file/directory_service;1"]
						  .getService(Components.interfaces.nsIProperties)
						  .get("ProfD", Components.interfaces.nsILocalFile);
			file.append( 'setcomment.scpt' );
			fos.init(file, -1, 0664, 0); // write, create, truncate
			do {
			  var b = bs.readBytes(bs.available());
			  fos.write(b, b.length);
			} while (b.length);
			fos.close();

			var as = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
			as.initWithPath("/usr/bin/osascript");
			var process = Components.classes["@mozilla.org/process/util;1"]
					.createInstance(Components.interfaces.nsIProcess);
			process.init(as);
			var args = [ file.path ];
			process.run(false, args, args.length);
		}
	},
	addDownload: function (params) {
		var ios =  Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);
		var dm =  Components.classes["@mozilla.org/download-manager;1"]
						.getService(Components.interfaces.nsIDownloadManager);

		var path = dm.userDownloadsDirectory.path;
		var sourceUri = ios.newURI(params.source, null, null);

		var file;
		do {
			file = Components.classes["@mozilla.org/file/local;1"] .createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath( path );
			var filename = params.title.replace(/["\\\*\:\?\<\>\/\|]/, '');
			var ext = sourceUri.path.match( /\.gif\b/i ) ? ".gif" :
					sourceUri.path.match( /\.jpe?g\b/i ) ? ".jpg" :
					sourceUri.path.match( /\.png\b/i ) ? ".png" :
					sourceUri.path.match( /\.tiff?\b/i ) ? ".tiff" : "";
			if ( this.filenameHash[filename] ) {
				var suffix = ++this.filenameHash[filename];
				filename += "-" + suffix;
			} else {
				this.filenameHash[filename] = 1;
			}
			file.append( filename + ext );
		} while ( file.exists() );

		var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(Components.interfaces.nsIWebBrowserPersist);

		var targetUri = ios.newFileURI(file);
		var dl = dm.addDownload(0, sourceUri, targetUri, params.title, null, null, null, persist);

		// it seems __noSuchMethod__ does not invoked if the emthod is called by xptcall.
		// we need to code every method of nsIWebProgressListener.
		var self = this;
		persist.progressListener = {
			onLocationChange: function () { dl.onLocationChange.apply(dl, arguments); },
			onProgressChange: function () { dl.onProgressChange.apply(dl, arguments); },
			onSecurityChange: function () { dl.onSecurityChange.apply(dl, arguments); },
			onStatusChange:   function () { dl.onStatusChange.apply(dl, arguments);   },
			onStateChange: function (webProgress, request, stateFlags, status) {
				dl.onStateChange.apply(dl, arguments);
				if ( stateFlags & dl.STATE_STOP ) {
					self.addMetaData(file.path, params.href);
				}
			}
		};
		persist.saveURI(sourceUri, null, null, null, null, file);
	},
	post : function(params){
		this.addDownload(params);
		return succeed();
	},
}


Tombloo.Service.posters['DownloadManager'] = function (ctx, params) {
	if ( params.type == 'photo' ) {
		return DownloadManager.post(params);
	} else {
		return succeed();
	}
}

