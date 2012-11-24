const EXTENSION_ID = 'tombloo@brasil.to';

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

var ILocalFile = Ci.nsILocalFile;

ConsoleService      = getService('/consoleservice;1', Ci.nsIConsoleService);
AppShellService     = getService('/appshell/appShellService;1', Ci.nsIAppShellService);
ScriptLoader        = getService('/moz/jssubscript-loader;1', Ci.mozIJSSubScriptLoader);
IOService           = getService('/network/io-service;1', Ci.nsIIOService);
WindowMediator      = getService('/appshell/window-mediator;1', Ci.nsIWindowMediator);
CategoryManager     = getService('/categorymanager;1', Ci.nsICategoryManager);
FileProtocolHandler = getService('/network/protocol;1?name=file', Ci.nsIFileProtocolHandler);


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

function setupEnvironment(global){
	var win = AppShellService.hiddenDOMWindow;
	
	// 変数/定数はhiddenDOMWindowのものを直接使う
	[
		'navigator document window screen',
		'XMLHttpRequest XPathResult Node Element KeyEvent Event DOMParser XSLTProcessor XML XMLSerializer NodeFilter',
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
	global || (global = function(){});
	files = [].concat(files);
	
	var now = Date.now();
	for(var i=0,len=files.length ; i<len ; i++){
		// クエリを付加しキャッシュを避ける
		ScriptLoader.loadSubScript(
			FileProtocolHandler.getURLSpecFromFile(files[i]) + '?time=' + now, global, 'UTF-8');
	}
}

function getContents(file){
	try{
		var fis = Cc['@mozilla.org/network/file-input-stream;1']
			.createInstance(Ci.nsIFileInputStream);
		fis.init(file, -1, 0, false);
		
		var cis = Cc['@mozilla.org/intl/converter-input-stream;1']
			.createInstance(Ci.nsIConverterInputStream);
		cis.init(fis, 'UTF-8', fis.available(), Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
		
		var out = {};
		cis.readString(fis.available(), out);
		return out.value;
	} finally {
		fis && fis.close();
		cis && cis.close();
	}
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

function exposeProperties(o, recursive){
	if(o == null)
		return;
	
	Object.defineProperty(o, '__exposedProps__', {
		value : {},
		writable : true,
		enumerable : false,
		configurable : true
	});
	
	for(var p in o){
		o.__exposedProps__[p] = 'r';
		
		if(recursive && typeof(o[p]) === 'object')
			exposeProperties(o[p], true);
	}
}


var getContentDir;
ExtensionManager = getService('/extensions/manager;1', Ci.nsIExtensionManager);
if (!ExtensionManager) {  // for firefox4
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
	let dir = null;
	AddonManager.getAddonByID(EXTENSION_ID, function (addon) {
		let root = addon.getResourceURI('/');
		let url = root.QueryInterface(Ci.nsIFileURL)
		let target = url.file.QueryInterface(ILocalFile);
		target.setRelativeDescriptor(target, 'chrome/content');
		dir = target;
	});
	// using id:piro (http://piro.sakura.ne.jp/) method
	let thread = Cc['@mozilla.org/thread-manager;1'].getService().mainThread;
	while (dir === null) {
		thread.processNextEvent(true);
	}
	getContentDir = function getContentDirInFirefox4() {
		return dir.clone();
	}
} else {
	getContentDir = function() {
		var dir = ExtensionManager
			.getInstallLocation(EXTENSION_ID)
			.getItemLocation(EXTENSION_ID).QueryInterface(ILocalFile);
		dir.setRelativeDescriptor(dir, 'chrome/content');
		return dir.clone();
	}
}


Module = {
	CID  : Components.ID('{aec75109-b143-4e49-a708-4904cfe85ea0}'),
	NAME : 'TomblooService',
	PID  : '@brasil.to/tombloo-service;1',
	
	initialized : false,
	
	onRegister : function(){
		CategoryManager.addCategoryEntry('content-policy', this.NAME, this.PID, true, true);
	},
	
	instance : {
		shouldLoad : function(contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra){
			return Ci.nsIContentPolicy.ACCEPT;
		},
		
		shouldProcess : function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeTypeGuess, aExtra){
			return Ci.nsIContentPolicy.ACCEPT;
		},
		
		QueryInterface : function(iid){
			if(iid.equals(Ci.nsIContentPolicy) || iid.equals(Ci.nsISupports) || iid.equals(Ci.nsISupportsWeakReference))
				return this;
			
			throw Cr.NS_NOINTERFACE;
		},
	},
	
	createInstance : function(outer, iid){
		// nsIContentPolicyはhiddenDOMWindowの準備ができる前に取得される
		// 仮に応答できるオブジェクトを返し環境を構築できるまでの代替とする
		if(iid.equals(Ci.nsIContentPolicy))
			return this.instance;
		
		// ブラウザが開かれるタイミングでインスタンスの要求を受け環境を初期化する
		// 2個目以降のウィンドウからは生成済みの環境を返す
		if(this.initialized)
			return this.instance;
		
		// 以降のコードはアプリケーション起動後に一度だけ通過する
		var env = this.instance;
		
		// アプリケーション全体で、同じloadSubScripts関数を使いまわし汚染を防ぐ
		env.loadSubScripts = loadSubScripts;
		env.loadAllSubScripts = loadAllSubScripts;
		env.getContentDir = getContentDir;
		env.getLibraries = getLibraries;
		env.PID = this.PID;
		env.CID = this.CID;
		env.NAME = this.NAME;
		
		// MochiKit内部で使用しているinstanceofで異常が発生するのを避ける
		env.MochiKit = {};
		
		setupEnvironment(env);
		env.loadAllSubScripts();
		
		var GM_Tombloo = copy({
			Tombloo : {
				Service : copy({}, env.Tombloo.Service, /(check|share|posters|extractors)/),
			},
		}, env, /(Deferred|DeferredHash|copyString|notify)/);
		
		for(var name in env.models)
			if(env.models.hasOwnProperty(name))
				GM_Tombloo[name] = copy({}, env.models[name], /^(?!.*(password|cookie))/i);
		
		// 他拡張からの読み取りを許可する(Firefox 17用)
		exposeProperties(GM_Tombloo, true);
		
		// Greasemonkeyサンドボックスの拡張
		var greasemonkey = Cc['@greasemonkey.mozdev.org/greasemonkey-service;1'];
		if(greasemonkey){
			greasemonkey = greasemonkey.getService().wrappedJSObject;
			
			env.addBefore(greasemonkey, 'evalInSandbox', function(){
				for(var i=0, len=arguments.length ; i<len ; i++){
					var arg = arguments[i];
					if(typeof(arg) == 'object'){
						arg.GM_Tombloo = GM_Tombloo;
						return;
					}
				}
			});
		}
		
		try{
			// Scriptishサンドボックスの拡張
			var scope = {};
			Components.utils.import('resource://scriptish/api.js', scope);
			scope.GM_API.prototype.GM_Tombloo = GM_Tombloo;
		}catch(e){
			// インストールされていない場合や無効になっている場合にエラーになる
		}
		
		env.signal(env, 'environment-load');
		
		this.initialized = true;
		return env;
	},
}


var ModuleImpl = {
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
		if(!cid.equals(Module.CID))
			throw Cr.NS_ERROR_NO_INTERFACE;
		
		if(!iid.equals(Ci.nsIFactory))
			throw Cr.NS_ERROR_NOT_IMPLEMENTED;
		
		Module.onInit && Module.onInit(compMgr, cid, iid);
		
		return this.factory;
	},
	factory: {
		createInstance: function(outer, iid) {
			if(outer != null)
				throw Cr.NS_ERROR_NO_AGGREGATION;
			
			var obj = Module.createInstance(outer, iid);
			obj.Module = Module;
			obj.wrappedJSObject = obj;
			return obj;
		}
	}
};

function NSGetModule(compMgr, fileSpec) {
	return ModuleImpl;
}

function NSGetFactory(cid) {
	return ModuleImpl.factory;
}
