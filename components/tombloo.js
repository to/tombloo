const EXTENSION_ID = 'tombloo@brasil.to';

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

var ILocalFile       = Ci.nsILocalFile;

function initialize(){
	AppShellService  = getService('/appshell/appShellService;1', Ci.nsIAppShellService);
	ScriptLoader     = getService('/moz/jssubscript-loader;1', Ci.mozIJSSubScriptLoader);
	ExtensionManager = getService('/extensions/manager;1', Ci.nsIExtensionManager);
	ConsoleService   = getService('/consoleservice;1', Ci.nsIConsoleService);
	IOService        = getService('/network/io-service;1', Ci.nsIIOService);
	WindowMediator   = getService('/appshell/window-mediator;1', Ci.nsIWindowMediator);
}

function NSGetModule(compMgr, fileSpec) {
	return {
		CID  : Components.ID('{aec75109-b143-4e49-a708-4904cfe85ea0}'),
		NAME : 'TomblooService',
		PID  : '@brasil.to/tombloo-service;1',
		
		registerSelf : function (compMgr, fileSpec, location, type) {
			compMgr.QueryInterface(Ci.nsIComponentRegistrar).registerFactoryLocation(
				this.CID, this.NAME, this.PID,
				fileSpec, location, type);
		},
		canUnload : function(compMgr) {
			return true;
		},
 		getClassObject : function (compMgr, cid, iid) {
			if (!cid.equals(this.CID))
				throw Cr.NS_ERROR_NO_INTERFACE;
				
			if (!iid.equals(Components.interfaces.nsIFactory))
				throw Cr.NS_ERROR_NOT_IMPLEMENTED;
			
			initialize();
			
			return {
				createInstance: function (outer, iid) {
					if (outer != null)
						throw Cr.NS_ERROR_NO_AGGREGATION;
					
					var global = function(){};
					global.getContentDir = getContentDir;
					global.getLibraries = getLibraries;
					
					// アプリケーション全体で、同じloadSubScripts関数を使いまわし汚染を防ぐ
					global.loadSubScripts = loadSubScripts;
					
					// MochiKit内部で使用しているinstanceofで異常が発生するのを避ける
					global.MochiKit = {};
					
					setupEnvironment(global);
					loadSubScripts(getLibraries(), global);
					
					return {wrappedJSObject : global};
				}
			};
		},
	};
}

// ----[Application]--------------------------------------------
function getLibraries(){
	var libDir = getContentDir();
	libDir.append('library');
	
	var libs = [];
	simpleIterator(libDir.directoryEntries, ILocalFile, function(file){
		if(file.leafName.match(/\.js$/))
			libs.push(file);
	})
	
	libs.sort(function(l, r){
		return l.leafName < r.leafName? -1 : 1;
	});
	
	return libs;
}

function getContentDir(){
	var dir = ExtensionManager
		.getInstallLocation(EXTENSION_ID)
		.getItemLocation(EXTENSION_ID).QueryInterface(ILocalFile);
	dir.setRelativeDescriptor(dir, 'chrome/content');
	
	return dir;
}

function setupEnvironment(global){
	var win = AppShellService.hiddenDOMWindow;
	
	[
		'navigator document window screen',
		'XMLHttpRequest XPathResult Node Element Event DOMParser XSLTProcessor XML',
	].join(' ').split(' ').forEach(function(p){
		global[p] = win[p];
	});
	[
		'setTimeout setInterval clearTimeout clearInterval',
		'open openDialog',
		'atob btoa',
	].join(' ').split(' ').forEach(function(p){
		global[p] = bind(p, win);
	});
	[
		'alert confirm prompt',
	].join(' ').split(' ').forEach(function(p){
		global[p] = bind(forwardToWindow, null, p);
	});
}

function forwardToWindow(method){
	var args = Array.slice(arguments, 1);
	var win = WindowMediator.getMostRecentWindow('navigator:browser');
	return win[method].apply(win, args);
}

// ----[Utility]--------------------------------------------
function log(msg){
	ConsoleService.logStringMessage(''+msg);
}

function getService(clsName, ifc){
	try{
		var cls = Cc['@mozilla.org' + clsName];
		return !cls? null : cls.getService(ifc);
	} catch(e) {
		return null;
	}
}

function loadSubScripts(files, global){
	var global = global || function(){};
	files = [].concat(files);
	
	files.forEach(function(file){
		var uri = file instanceof ILocalFile? IOService.newFileURI(file).spec : uri;
		ScriptLoader.loadSubScript(uri, global);
	});
}

function simpleIterator(e, ifc, func){
	if(typeof(ifc)=='string')
		ifc = Components.interfaces[ifc];
	
	try{
		while(e.hasMoreElements()){
			var value = e.getNext();
			func(ifc? value.QueryInterface(ifc) : value);
		}
	} catch(e if e==StopIteration) {}
}

function bind(func, obj) {
	var args = Array.slice(arguments, 2);
	func = (typeof(func) == 'string')? obj[func] : func;
	if(args.length){
		return function() {
			return func.apply(obj, Array.concat(args, Array.slice(arguments)));
		}
	} else {
		return function() {
			return func.apply(obj, arguments);
		}
	}
}
