const EXTENSION_ID = 'tombloo@brasil.to';

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

var ILocalFile = Ci.nsILocalFile;

ConsoleService   = getService('/consoleservice;1', Ci.nsIConsoleService);
AppShellService  = getService('/appshell/appShellService;1', Ci.nsIAppShellService);
ScriptLoader     = getService('/moz/jssubscript-loader;1', Ci.mozIJSSubScriptLoader);
ExtensionManager = getService('/extensions/manager;1', Ci.nsIExtensionManager);
IOService        = getService('/network/io-service;1', Ci.nsIIOService);
WindowMediator   = getService('/appshell/window-mediator;1', Ci.nsIWindowMediator);

Module = {
	CID  : Components.ID('{aec75109-b143-4e49-a708-4904cfe85ea0}'),
	NAME : 'TomblooService',
	PID  : '@brasil.to/tombloo-service;1',
	
	createInstance : function(){
		// createInstanceで呼び出されたときのために独自にシングルトン機構を持つ
		if(this.instance)
			return this.instance;
		
		var env = function(){};
		env.getContentDir = getContentDir;
		env.getLibraries = getLibraries;
		env.PID = this.PID;
		
		// アプリケーション全体で、同じloadSubScripts関数を使いまわし汚染を防ぐ
		env.loadSubScripts = loadSubScripts;
		env.loadAllSubScripts = loadAllSubScripts;
		
		// MochiKit内部で使用しているinstanceofで異常が発生するのを避ける
		env.MochiKit = {};
		
		setupEnvironment(env);
		env.loadAllSubScripts();
		
		// Greasemonkeyコンテキストの準備
		var gm = Components.classes['@greasemonkey.mozdev.org/greasemonkey-service;1'];
		if(gm){
			gm = gm.getService().wrappedJSObject;
			
			var GM_Tombloo = copy({
				Tombloo : {
					Service : copy({}, env.Tombloo.Service, /(check|share|posters|extractors)/),
				}
			}, env, /(Deferred|DeferredHash)/);
			
			for(var name in env.models)
				if(env.models.hasOwnProperty(name))
					GM_Tombloo[name] = copy({}, env.models[name], /^(?!.*(password|cookie))/i);
			
			env.addBefore(gm, 'evalInSandbox', function(code, codebase, sandbox){
				sandbox.GM_Tombloo = GM_Tombloo;
			});
		}
		
		return this.instance = env;
	}, 
}


// ----[Application]--------------------------------------------
function getScriptFiles(dir){
	var scripts = [];
	simpleIterator(dir.directoryEntries, ILocalFile, function(file){
		if(file.leafName.match(/\.js$/))
			scripts.push(file);
	})
	return scripts;
}

function getLibraries(){
	var libDir = getContentDir();
	libDir.append('library');
	
	return getScriptFiles(libDir).sort(function(l, r){
		return l.leafName < r.leafName? -1 : 1;
	});
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
	
	// 変数/定数はhiddenDOMWindowのものを直接使う
	[
		'navigator document window screen',
		'XMLHttpRequest XPathResult Node Element KeyEvent Event DOMParser XSLTProcessor XML NodeFilter',
	].join(' ').split(' ').forEach(function(p){
		global[p] = win[p];
	});
	
	// メソッドはthisが変わるとエラーになることがあるためbindして使う
	[
		'setTimeout setInterval clearTimeout clearInterval',
		'open openDialog',
		'atob btoa',
	].join(' ').split(' ').forEach(function(p){
		global[p] = bind(p, win);
	});
	
	// モーダルにするためhiddenDOMWindowdではなく最新のウィンドウのメソッドを使う
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

function loadAllSubScripts(){
	loadSubScripts(getLibraries(), this);
	loadSubScripts(getScriptFiles(this.getPatchDir()), this);
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

function copy(t, s, re){
	for(var p in s)
		if(!re || re.test(p))
			t[p] = s[p];
	return t;
}

function NSGetModule(compMgr, fileSpec) {
	return {
		registerSelf : function(compMgr, fileSpec, location, type) {
			compMgr.QueryInterface(Ci.nsIComponentRegistrar).registerFactoryLocation(
				Module.CID, Module.NAME, Module.PID,
				fileSpec, location, type);
			
			Module.onRegister && Module.onRegister(compMgr, fileSpec, location, type);
		},
		canUnload : function(compMgr) {
			return true;
		},
 		getClassObject : function(compMgr, cid, iid){
			if (!cid.equals(Module.CID))
				throw Cr.NS_ERROR_NOT_IMPLEMENTED;
			
			if (!iid.equals(Ci.nsIFactory))
				throw Cr.NS_ERROR_NO_INTERFACE;
			
			Module.onInit && Module.onInit(compMgr, cid, iid);
			
			return {
				createInstance: function(outer, iid) {
					if (outer != null)
						throw Cr.NS_ERROR_NO_AGGREGATION;
					
					var obj = Module.createInstance(outer, iid);
					obj.wrappedJSObject = obj;
					return obj;
				}
			};
		},
	};
}
