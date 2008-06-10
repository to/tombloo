const XUL_NS  = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const HTML_NS = 'http://www.w3.org/1999/xhtml';

const Ci = Components.interfaces;
const Cc = Components.classes;

var INTERFACES = [];
for(var i in Ci)
	INTERFACES.push(Ci[i]);


const IWebProgressListener = Ci.nsIWebProgressListener;
const IFile                = Ci.nsIFile;
const ILocalFile           = Ci.nsILocalFile;
const IURI                 = Ci.nsIURI;
const IFileProtocolHandler = Ci.nsIFileProtocolHandler;
const IAccessNode          = Ci.nsIAccessNode;
const IHttpChannel         = Ci.nsIHttpChannel;
const IUploadChannel       = Ci.nsIUploadChannel;
const IScriptError         = Ci.nsIScriptError;
const IStreamListener      = Ci.nsIStreamListener;
const IInputStream         = Ci.nsIInputStream;
const ICache               = Ci.nsICache;


// const AccessibilityService = getService('/accessibilityService;1', Ci.nsIAccessibilityService);
const ExtensionManager = getService('/extensions/manager;1', Ci.nsIExtensionManager);
const StorageService   = getService('/storage/service;1', Ci.mozIStorageService);
const DirectoryService = getService('/file/directory_service;1', Ci.nsIProperties);
const IOService        = getService('/network/io-service;1', Ci.nsIIOService);
const AtomService      = getService('/atom-service;1', Ci.nsIAtomService);
const ChromeRegistry   = getService('/chrome/chrome-registry;1', Ci.nsIXULChromeRegistry);
const WindowMediator   = getService('/appshell/window-mediator;1', Ci.nsIWindowMediator);
const ConsoleService   = getService('/consoleservice;1', Ci.nsIConsoleService);
const AlertsService    = getService('/alerts-service;1', Ci.nsIAlertsService);
const MIMEService      = getService('/uriloader/external-helper-app-service;1', Ci.nsIMIMEService);
const PromptService    = getService('/embedcomp/prompt-service;1', Ci.nsIPromptService);
const CacheService     = getService('/network/cache-service;1', Ci.nsICacheService);
const	AppShellService  = getService('/appshell/appShellService;1', Ci.nsIAppShellService);
const	CookieService    = getService('/cookieService;1', Ci.nsICookieService);


const PrefBranch = 
	Components.Constructor('@mozilla.org/preferences;1', 'nsIPrefBranch');
const LocalFile = 
	Components.Constructor('@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath');
const WebBrowserPersist = 
	Components.Constructor('@mozilla.org/embedding/browser/nsWebBrowserPersist;1', 'nsIWebBrowserPersist');
const StorageStatementWrapper = 
	Components.Constructor('@mozilla.org/storage/statement-wrapper;1', 'mozIStorageStatementWrapper', 'initialize');
const ScriptError = 
	Components.Constructor('@mozilla.org/scripterror;1', 'nsIScriptError', 'init');

const InputStream = 
	Components.Constructor('@mozilla.org/scriptableinputstream;1', 'nsIScriptableInputStream', 'init');
const BinaryInputStream = 
	Components.Constructor('@mozilla.org/binaryinputstream;1', 'nsIBinaryInputStream', 'setInputStream');

const FileInputStream = 
	createConstructor('/network/file-input-stream;1', 'nsIFileInputStream', 'init');
const MIMEInputStream = 
	createConstructor('/network/mime-input-stream;1', 'nsIMIMEInputStream', function(stream){
		this.addContentLength = true;
		this.setData(stream);
	});
const BufferedInputStream = 
	createConstructor('/network/buffered-input-stream;1', 'nsIBufferedInputStream', function(stream, bufferSize){
		this.init(stream, bufferSize || 4096);
	});
const StringInputStream = 
	createConstructor('/io/string-input-stream;1', 'nsIStringInputStream', function(str){
		this.setData(str, str.length);
	});
const UnicodeConverter = 
	createConstructor('/intl/scriptableunicodeconverter', 'nsIScriptableUnicodeConverter', function(charset){
		this.charset = charset || 'UTF-8';
	});
const MultiplexInputStream = 
	createConstructor('/io/multiplex-input-stream;1', 'nsIMultiplexInputStream', function(streams){
		var self = this;
		streams = streams || [];
		streams.forEach(function(stream){
			if(stream.join)
				stream = stream.join('\r\n');
			
			if(typeof(stream)=='string')
				stream = new StringInputStream(stream + '\r\n');
				
			self.appendStream(stream);
		});
	});
const CryptoHash = 
	createConstructor('/security/hash;1', 'nsICryptoHash', 'init');



// ----[Utility]-------------------------------------------------
function createConstructor(pid, ifc, init){
	var cls = Components.classes['@mozilla.org' + pid];
	ifc = typeof(ifc)=='string'? Components.interfaces[ifc] : ifc;
	
	var cons = function(){
		var obj = cls.createInstance(ifc);
		if(init){
			if(typeof(init)=='string'){
				obj[init].apply(obj, arguments);
			} else {
				init.apply(obj, arguments);
			}
		}
		return obj;
	};
	
	for(var prop in ifc)
		cons[prop] = ifc[prop];
	
	return cons;
}

function getService(clsName, ifc){
	try{
		var cls = Components.classes['@mozilla.org' + clsName];
		return !cls? null : cls.getService(ifc);
	} catch(e) {
		return null;
	}
}

function getInterfaces(obj){
	var result = [];
	
	for(var i=0,len=INTERFACES.length ; i<len ; i++){
		var ifc = INTERFACES[i];
		if(obj instanceof ifc)
			result.push(ifc);
	}
	
	return result;
}

function broad(obj, ifcs){
	ifcs = ifcs || INTERFACES;
	for(var i=0,len=ifcs.length ; i<len ; i++)
		if(obj instanceof ifcs[i]);
	return obj;
};

function notify(title, msg, icon){
	AlertsService && AlertsService.showAlertNotification(
		icon, title, msg, 
		false, '', null);
}
notify.ICON_DOWNLOAD = 'chrome://mozapps/skin/downloads/downloadIcon.png';
notify.ICON_INFO     = 'chrome://global/skin/console/bullet-question.png';
notify.ICON_ERROR    = 'chrome://global/skin/console/bullet-error.png';
notify.ICON_WORN     = 'chrome://global/skin/console/bullet-warning.png';

/*
function getElementByPosition(x, y){
	return AccessibilityService.
		getAccessibleFor(currentDocument()).
		getChildAtPoint(x, y).
		QueryInterface(IAccessNode).
		DOMNode;
}
*/

function convertFromUnplaceableHTML(str){
	var arr = [];
	for(var i=0,len=str.length ; i<len ;i++)
		arr.push(str.charCodeAt(i));
	return convertFromByteArray(arr, str.match('charset=([^"; ]+)'));
}

function convertFromByteArray(arr, charset){
	return new UnicodeConverter(charset).convertFromByteArray(text);
}

function convertToUnicode(text, charset){
	return new UnicodeConverter(charset).ConvertToUnicode(text);
}

function convertFromUnicode(text, charset){
	return new UnicodeConverter(charset).ConvertFromUnicode(text);
}


function createURI(path){
	if(path instanceof IURI)
		return path;
	
	try{
		var path = (path instanceof IFile) ? path : new LocalFile(path);
		return IOService.newFileURI(path)	;
	}catch(e if e.name=='NS_ERROR_FILE_UNRECOGNIZED_PATH'){	}
	return IOService.newURI(path, null, null);
}

function getLocalFile(uri){
	var uri = (uri instanceof IURI) ? uri : IOService.newURI(uri, null, null);
	if(uri.scheme=='chrome')
		uri = ChromeRegistry.convertChromeURL(uri);
	
	if(uri.scheme!='file')
		return;
	
	return IOService.getProtocolHandler('file').
		QueryInterface(IFileProtocolHandler).
		getFileFromURLSpec(uri.spec).
		QueryInterface(ILocalFile);
}

function getExtensionDir(id){
	return ExtensionManager.
		getInstallLocation(id).
		getItemLocation(id).QueryInterface(ILocalFile);
}

function getPrefType(key){
	with(PrefBranch()){
		switch(getPrefType(key)){
			case PREF_STRING:
				return 'string';
			case PREF_BOOL:
				return 'boolean';
			case PREF_INT:
				return 'number';
			case PREF_INVALID:
				return 'undefined';
		}
	}
}

function setPrefValue(){
	var value = Array.pop(arguments);
	var key = Array.join(arguments, '');
	
	var prefType = getPrefType(key);
	with(PrefBranch()){
		switch(prefType!='undefined'? prefType : typeof(value)){
			case 'string':
				return setCharPref(key, unescape(encodeURIComponent(value)));
			case 'boolean':
				return setBoolPref(key, value);
			case 'number':
				return setIntPref(key, value);
		}
	}
}

function getPrefValue(){
	var key = Array.join(arguments, '');
	
	with(PrefBranch()){
		switch(getPrefType(key)){
			case PREF_STRING:
				return decodeURIComponent(escape(getCharPref(key)));
			case PREF_BOOL:
				return getBoolPref(key);
			case PREF_INT:
				return getIntPref(key);
		}
	}
}

function getProfileDir(){
	return DirectoryService.get('ProfD', IFile);
}

function download(targetFile, sourceURL){
	var d = new Deferred();
	var targetURI = IOService.newFileURI(targetFile);
	var sourceURI = IOService.newURI(sourceURL, null, null);
	
	var persist = WebBrowserPersist();
	with(persist){
		persist.progressListener = {
			onLocationChange : function(){},
			onProgressChange : function(){},
			onSecurityChange : function(){},
			onStatusChange : function(){},
			onStateChange : function(progress, req, state, status){
				if (state & IWebProgressListener.STATE_STOP)
					d.callback()
			},
		}
		
		persistFlags = PERSIST_FLAGS_FROM_CACHE;
		saveURI(sourceURI, null, null, null, null, targetURI);
	}
	
	return d;
}

function openInEditor(file){
	function getFile(path){
		return path && LocalFile(path);
	}
	
	var editor = 
		getFile(getPrefValue('greasemonkey.editor')) || 
		getFile(getPrefValue('view_source.editor.path'));
	if(!editor || !editor.exists())
		return;
	
	var mimeInfo = MIMEService.getFromTypeAndExtension(
		MIMEService.getTypeFromFile(file), 
		file.leafName.split('.').pop());
	mimeInfo.preferredAction = mimeInfo.useHelperApp;
	mimeInfo.preferredApplicationHandler = editor;
	mimeInfo.launchWithFile(file);
}

function getMostRecentWindow(){
	return WindowMediator.getMostRecentWindow('navigator:browser');
}

function input(form){
	var args = [null, ''];
	for(var msg in form){
		var val = {value : form[msg]};
		form[msg] = val;
		args.push(msg);
		args.push(val);
	}
	
	if(!PromptService.prompt.apply(PromptService, args))
		return;
	
	for(var msg in form)
		form[msg] = form[msg].value;
	
	return form;
}

function findCacheFile(url){
	var entry;
	CacheService.visitEntries({
		visitDevice : function(deviceID, deviceInfo){
			if(deviceID == 'disk')
				return true;
		},
		visitEntry : function(deviceID, info){
			if(info.key != url)
				return true;
			
			entry = {
				clientID    : info.clientID, 
				key         : info.key, 
				streamBased : info.isStreamBased(),
			};
		},
	});
	
	if(!entry)
		return;
	
	try{
		var session = CacheService.createSession(
			entry.clientID, 
			ICache.STORE_ANYWHERE, 
			entry.streamBased);
		session.doomEntriesIfExpired = false;
		var descriptor = session.openCacheEntry(
			entry.key, 
			ICache.ACCESS_READ, 
			false);
		
		return descriptor.file;
	} finally{
		// [FIXME] copy to temp
		// descriptor && descriptor.doom();
		descriptor && descriptor.close();
	}
}

function md5(str, charset){
	var crypto = new CryptoHash(CryptoHash.MD5);
	var data = new UnicodeConverter(charset).convertToByteArray(str, {});
	crypto.update(data, data.length);
	
	return crypto.finish(false).split('').map(function(char){
		return char.charCodeAt().toHexString();
	}).join('');
}

function getCookieString(uri){
	return CookieService.getCookieString(createURI(uri), null);
}
