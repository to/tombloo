// ----[Application]-------------------------------------------------
var getPref = partial(getPrefValue, 'extensions.tombloo.');
var setPref = partial(setPrefValue, 'extensions.tombloo.');

const CHROME_DIR = 'chrome://tombloo';
const CHROME_CONTENT_DIR = CHROME_DIR + '/content';

const EXTENSION_ID = 'tombloo@brasil.to';


function getContentDir(){
	var contentDir = getExtensionDir(EXTENSION_ID);
	contentDir.setRelativeDescriptor(contentDir, 'chrome/content');
	
	return contentDir;
}

function openProgressDialog(progress, max, value){
	if(!(progress instanceof Progress))
		progress = new Progress(progress, max, value);
	
	var w = 400;
	var h = 95;
	var x = (screen.width - w) / 2;
	var y = (screen.height - h) / 2;
	window.openDialog('chrome://tombloo/content/library/progressDialog.xul', '_blank', openParamString({
		dialog : null,
		width : w,
		height : h,
		left : x,
		top : y,
	}), progress);
	
	return progress;
}

function autoReload(paths){
	paths = paths || [];
	
	var baseUri = IOService.newURI(location.href, null, null);
	Array.forEach(document.getElementsByTagNameNS(XUL_NS,'script'), function(script){
		var src = script.getAttribute('src');
		if(!src)
			return;
		
		paths.push(IOService.newURI(src, null, baseUri).spec);
	})
	Array.forEach(document.getElementsByTagName('script'), function(script){
		script.src && paths.push(script.src);
	})
	Array.forEach(document.styleSheets, function(style){
		style.href && paths.push(style.href);
	})
	paths.push(location.href);
	
	function getModifiedTime(path){
		var file = getLocalFile(path);
		return file? file.lastModifiedTime : 0;
	}
	
	var original = {};
	paths.forEach(function(path){
		original[path] = getModifiedTime(path);
	});
	
	var intervalId = setInterval(function(){
		paths.forEach(function(path){
			if(original[path] != getModifiedTime(path))
				location.reload();
		});
	}, 1000)
}


// ----[XPCOM]-------------------------------------------------
function createMock(ifcNames, sample, proto, cons){
	var non = function(){};
	var sample = !sample? {QueryInterface : non} : 
		typeof(sample)=='object'? sample : Cc[sample].createInstance();
	ifcNames = [].concat(ifcNames).map(function(ifcNames){
		return ''+ifcNames;
	});
	log(ifcNames);
	
	var Mock = cons || function(){};
	
	var ifcs = [Ci.nsISupports];
	ifcNames.forEach(function(ifcName){
		var ifc = Ci[ifcName];
		ifcs.push(ifc);
		
		sample.QueryInterface(ifc);
	});
	for(var prop in sample){
		if(typeof(sample[prop])=='function')
			Mock.prototype[prop] = non;
	}
	
	Mock.prototype.QueryInterface = function(iid){
		if(ifcs.some(function(ifc){
			return iid.equals(ifc);
		})){
			return this;
		}
		
		throw Components.results.NS_NOINTERFACE;
	}
	
	extend(Mock.prototype, proto);
	extend(Mock, Mock.prototype);
	
	return Mock;
}

function createQueryInterface(ifcNames){
	var ifcs = ['nsISupports'].concat(ifcNames).map(function(ifcNames){
		return Ci[''+ifcNames];
	});
	
	return function(iid){
		if(ifcs.some(function(ifc){
			return iid.equals(ifc);
		})){
			return this;
		}
		
		throw Components.results.NS_NOINTERFACE;
	}
}


// ----[Prototype]-------------------------------------------------
Math.hypot = function(x, y){
	return Math.sqrt(x*x + y*y);
}

Number.prototype.toHexString = function(){
	return ('0' + this.toString(16)).slice(-2);
};

String.prototype = update(String.prototype, {
	link: function(href){
		return '<a href="' + href + '">' + this + '</a>';
	},
	trim : function(){
		return this.replace(/^\s+|\s+$/g, '');
	},
	repeat : function(n){
		return new Array(n+1).join(this);
	},
	extract : function(re, group){
		group = group==null? 1 : group;
		var res = this.match(re);
		return res ? res[group] : '';
	},
	decapitalize : function(){
		return this.substr(0, 1).toLowerCase() + this.substr(1);
	},
	capitalize : function(){
		return this.substr(0, 1).toUpperCase() + this.substr(1);
	},
	toByteArray : function(charset){
		return new UnicodeConverter(charset).convertToByteArray(this, {});
	},
	md5 : function(charset){
		var crypto = new CryptoHash(CryptoHash.MD5);
		var data = this.toByteArray(charset);
		crypto.update(data, data.length);
		
		return crypto.finish(false).split('').map(function(char){
			return char.charCodeAt().toHexString();
		}).join('');
	},
	extract : function(re, group){
		group = group==null? 1 : group;
		var res = this.match(re);
		return res ? res[group] : '';
	},
	convertToUnicode : function(charset){
		return new UnicodeConverter(charset).ConvertToUnicode(this);
	},
	convertFromUnicode : function(charset){
		return new UnicodeConverter(charset).ConvertFromUnicode(this);
	},
});

Array.prototype = update(Array.prototype, {
	split : function(step){
		var res = [];
		for(var i=0,len=this.length ; i<len ;)
			res.push(this.slice(i, i+=step));
		
		return res;
	},
});


// ----[MochiKit]-------------------------------------------------
const StopProcess = {};

function connect(src, sig){
	sig = sig=='onmousewheel' ? 'onDOMMouseScroll' : sig;
	return MochiKit.Signal.connect.apply(null, [].slice.apply(arguments));
}

function maybeDeferred(d) {
	return typeof(d) == 'function'? 
		MochiKit.Async.maybeDeferred(d) : 
		d.addCallback? 
			d : 
			succeed(d);
}

MochiKit.Base.update(MochiKit.Signal.Event.prototype, {
	wheelDelta : function(){
		return 	this.event().detail;
	},
	isStopped : function(){
		var evt = this.event();
		
		return evt.getPreventDefault ?
			evt.getPreventDefault() :
			evt.cancelBubble;
	},
	keyString : function(){
		var keys = [];
		
		var mod = this.modifier();
		mod.shift && keys.push('SHIFT');
		mod.ctrl && keys.push('CTRL');
		mod.alt && keys.push('ALT');
		
		var key = this.key();
		if(key){
			key = key.string.replace(/^KEY_/, '');
			if(!keys.some(function(i){return i==key}))
				keys.push(key);
		}
		
		return keys.join('+');
	},
})

MochiKit.Base.update(MochiKit.Signal._specialKeys, {
	61:  'KEY_SEMICOLON',
	226: 'KEY_HORIZONTAL_BAR'
});

function formContents(elm){
	if(typeof(elm)=='string')
		elm = convertToHTMLDocument(elm);
	
	return reduce(function(p, a){
		p[a[0]]=a[1];
		return p;
	}, zip.apply(null, MochiKit.DOM.formContents(elm)), {});
}

function queryString(params, question){
	if(isEmpty(params))
		return '';
	
	if(typeof(params)=='string')
		return params;
	
	var qeries = [];
	for(var key in params){
		var value = params[key];
		if(value==null) continue;
		qeries.push(encodeURIComponent(key) + '='+ encodeURIComponent(value));
	}
	return (question? '?' : '') + qeries.join('&');
}

function doXHR(url, opts){
	return sendByChannel(url, opts);
}

/*
	mimeType
	charset
	referrer
	queryString
	sendContent
		file
		fileName
		contentType
*/
function sendByChannel(url, opts){
	var d = new Deferred();
	
	opts = opts || {};
	
	var uri = createURI(url + queryString(opts.queryString, true));
	var channel = broad(IOService.newChannelFromURI(uri));
	
	if(opts.referrer)
		channel.referrer = createURI(opts.referrer);
	
	if(opts.sendContent){
		var contents = opts.sendContent;
		
		// マルチパートチェック/パラメーター準備
		var multipart;
		for(var name in contents){
			var value = contents[name];
			if(value instanceof IInputStream || value instanceof IFile)
				value = contents[name] = {file : value};
			
			if(value && value.file)
				multipart = true;
		}
		
		if(!multipart){
			contents = queryString(contents);
			channel.setUploadStream(
				new StringInputStream(contents), 
				'application/x-www-form-urlencoded', -1);
		} else {
			var boundary = '---------------------------' + (new Date().getTime());
			var streams = [];
			
			for(var name in contents){
				var value = contents[name];
				if(!value.file){
					streams.push([
						'--' + boundary,
						'Content-Disposition: form-data; name="' + name + '"',
						'',
						value.convertFromUnicode(),
					]);
				} else {
					if(value.file instanceof IFile){
						value.fileName = value.file.leafName;
						value.file = IOService.newChannelFromURI(createURI(value.file)).open();
						// value.file = new BinaryInputStream(new FileInputStream(value.file, 0x01, 00004, null));
					}
					
					streams.push([
						'--' + boundary,
						'Content-Disposition: form-data; name="' + name + '"; filename="' + (value.fileName || '_') + '"',
						'Content-Type: ' + (value.contentType || 'application/octet-stream'),
						'',
					])
					streams.push(new BufferedInputStream(value.file));
					streams.push('');
				}
			}
			streams.push('--' + boundary);
			
			var mimeStream = new MIMEInputStream(new MultiplexInputStream(streams));
			mimeStream.addHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
			channel.setUploadStream(mimeStream, null, -1);
		}
	}
	
	channel.requestMethod = opts.sendContent? 'POST' : 'GET';
	channel.asyncOpen({
		QueryInterface : createQueryInterface(IStreamListener),
		onStartRequest: function(req, ctx){
			this.data = [];
		},
		onDataAvailable: function(req, ctx, stream, sourceOffset, length) {
			this.data.push(new InputStream(stream).read(length));
		},
		onStopRequest: function (req, ctx, status) {
			var text = this.data.join('');
			var charset = opts.charset || req.contentCharset;
			try{
				text = charset? convertToUnicode(text, charset) : text;
			} catch(err){
				// [FIXME] debugging
				error(err);
				error(charset);
				error(text);
			}
			var res = {
				channel : broad(req),
				responseText : text,
				status : req.responseStatus,
			};
			if(Components.isSuccessCode(status) && res.status < 400){
				d.callback(res);
			}else{
				d.errback(res);
			}
			
			channel = null;
		},
	}, null);
	
	return d;
}

function addTab(url){
	var d = new Deferred();
	var browser = getMostRecentWindow().document.getElementById('content').addTab(url).linkedBrowser;
	browser.addEventListener('DOMContentLoaded', function(event){
		browser.removeEventListener('DOMContentLoaded', arguments.callee, true);
		browser = null;
		
		d.callback(event.target.defaultView);
	}, true);
	return d;
}

registerRepr(
	'Error',
	function(err){
		return err.lineNumber!=null;
	},
	function(err){
		var msg = [];
		for(var p in err){
			var val = err[p];
			if(p == 'stack' || typeof(val)=='function')
				continue;
			
			msg.push(p + ' : ' + val);
		}
		return msg.join('\n');
	});

registerIteratorFactory(
	'SimpleEnumerator', 
	function(it){
		return it && typeof(it.hasMoreElements) == "function";
	}, 
	function(it){
		var ifcs;
		return {
			next: function(){
				if(!it.hasMoreElements())
					throw StopIteration;
				
				var res = it.getNext();
				if(!ifcs)
					ifcs = getInterfaces(res);
				return broad(res, ifcs);
			}
		};
	});

registerIteratorFactory(
	'XML', 
	function(it){
		return typeof(it) == "xml";
	}, 
	function(it){
		var i = 0;
		var len = it.length();
		return {
			next: function(){
				if(i >= len)
					throw StopIteration;
				
				return it[i++];
			}
		};
	});

// experimental
registerIteratorFactory(
	'Object', 
	function(it){
		return it && typeof(it) == "object";
	}, 
	function(it){
		var props = keys(it);
		return {
			next: function(){
				var prop = props.shift();
				if(!prop)
					throw StopIteration;
				
				return [prop, it[prop]];
			}
		};
	});

/*
function deferredForEach(it, func, index){
	index = index || 0;
	it = iter(it);
	
	var d = succeed();
	try{
		return d.
			addCallback(func, it.next(), index).
			addCallback(deferredForEach, it, func, ++index).
			addErrback(function(e){
				if(e.message!=StopIteration) throw e;
			});
	} catch (e if e==StopIteration){
		return d;
	}
}
*/

// 暫定パッチ、事前にリスト作成、無限リストに未対応
function deferredForEach(it, func){
	var d = new Deferred();
	var index = 0
	forEach(it, function(item, a){
		d.addCallback(func, item, index);
		++index;
	});
	d.callback();
	
	return d;
}

function DeferredHash(ds){
	var props = keys(ds);
	
	return new DeferredList(values(ds)).addCallback(function(results){
		var res = {};
		for (var i = 0; i < results.length; i++)
			res[props[i]] = results[i];
		return res;
	});
};


// ----[General]-------------------------------------------------
function log(msg){
	if(!getPref('debug')) return;
	
	firebug('log', arguments) || 
		ConsoleService.logStringMessage(''+msg);
}

function error(err){
	firebug('error', arguments) || 
		Components.utils.reportError(err);
}

function warn(msg){
	firebug('warn', arguments) || 
		ConsoleService.logMessage(new ScriptError(msg, null, null, null, null, IScriptError.warningFlag, null));
}

function firebug(method, args){
	var win = getMostRecentWindow();
	if(win.FirebugConsole && win.FirebugContext) {
	var console = new win.FirebugConsole(win.FirebugContext, win.content);
		console[method].apply(console, args);
	} else if ( win.Firebug && win.Firebug.Console ) {
		// Firebug 1.2~
		win.Firebug.Console.logFormatted.call(win.Firebug.Console, Array.slice(args), win.FirebugContext, method);
	} else {
		return false;
	}
	return true;
}

function clearObject(obj){
	for(var p in obj)
		delete obj[p];
	return obj;
}

function isEmpty(obj){
	for(var i in obj)
		return false;
	return true;
}

function populateForm(form, values){
	for(var name in values){
		var control = $x('//*[@name="' + name + '"]', form);
		if(!control || !values[name])
			continue;
		
		if(control.type == 'checkbox'){
			if(control.value == values[name])
				control.checked = true;
		} else {
			control.value = values[name];
		}
	}
}

function createSet(keys){
	keys = (keys instanceof Array) ? keys : keys.split(/\s/);
	return reduce(function(memo, val){
		memo[val]=val;
		return memo;
	}, keys, {})
}

function pickUp(a, pop){
	var i = random(a.length);
	return pop ? a.splice(i, 1)[0] : a[i];
}

function random(max){
	return Math.floor(Math.random() * max);
}

function absolutePath(path){
  var e = currentDocument().createElement('span');
  e.innerHTML = '<a href="' + path + '" />';
  return e.firstChild.href;
}

function decapitalize(str){
	return str.substr(0, 1).toLowerCase() + str.substr(1);
}

function capitalize(str){
	return str.substr(0, 1).toUpperCase() + str.substr(1);
}

function extend(target, source){
	for(var p in source){
		if(p.match(/get_(.*)/)){
			target.__defineGetter__(RegExp.$1, source[p]);
			continue;
		}
		
		if(p.match(/set_(.*)/)){
			target.__defineSetter__(RegExp.$1, source[p]);
			continue;
		}
		
		target[p] = source[p];
	}
	
	return target;
}

function openParamString(obj){
	var params=[];
	for(var p in obj)
		params.push(p+(obj[p]? '='+obj[p] : ''));
	return params.join(',');
}

function addBefore(target, name, before) {
	var original = target[name];
	target[name] = function() {
		before.apply(target, arguments);
		return original.apply(target, arguments);
	}
}


// ----[DOM]-------------------------------------------------
function unescapeHTML(s){
	return s.replace(
		/&amp;/g, '&').replace(
		/&quot;/g, '"').replace(
		/&lt;/g, '<').replace(
		/&gt;/g, '>');
}

function clearChildren(p){
	Array.slice(p.childNodes).forEach(p.removeChild, p);
}

function tagName(elm){
	return elm.tagName? elm.tagName.toLowerCase() : '';
}

function $x(exp, context, multi) {
	var doc = currentDocument();
	if (!context) context = doc;
	
	var resolver = function (prefix) {
		var o = doc.createNSResolver(context)(prefix);
		return o ? o : (doc.contentType == "text/html") ? "" : "http://www.w3.org/1999/xhtml";
	}
	var exp = doc.createExpression(exp, resolver);
	var value = function(node){
		if(!node)
			return;
		
		switch (node.nodeType) {
		case Node.ELEMENT_NODE:
			return node;
		case Node.ATTRIBUTE_NODE:
		case Node.TEXT_NODE:
			return node.textContent;
		}
	}
	
	var result = exp.evaluate(context, XPathResult.ANY_TYPE, null);
	switch (result.resultType) {
		case XPathResult.STRING_TYPE : return result.stringValue;
		case XPathResult.NUMBER_TYPE : return result.numberValue;
		case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
		case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
			if(!multi)
				return value(result.iterateNext());
			
			result = exp.evaluate(context, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			var ret = [];
			for (var i = 0, len = result.snapshotLength; i < len ; i++) {
				ret.push(value(result.snapshotItem(i)));
			}
			return ret;
		}
	}
	return null;
}

function convertToDOM(xml){
	var elm = currentDocument().createElement('span');
	elm.innerHTML = xml.toXMLString();
	return elm.childNodes[0];
}

function convertToHTMLDocument(html) {
	var xsl = (new DOMParser()).parseFromString(
		'<?xml version="1.0"?>\
			<stylesheet version="1.0" xmlns="http://www.w3.org/1999/XSL/Transform">\
			<output method="html"/>\
		</stylesheet>', "text/xml");
	
	var xsltp = new XSLTProcessor();
	xsltp.importStylesheet(xsl);
	
	var doc = xsltp.transformToDocument(currentDocument().implementation.createDocument("", "", null));
	doc.appendChild(doc.createElement("html"));
	
	var range = doc.createRange();
	range.selectNodeContents(doc.documentElement);
	doc.documentElement.appendChild(range.createContextualFragment(html));
	
	return doc
}

function convertToXML(text){
	return new XML(text.replace(/<\?.*\?>/gm,'').replace(/<!.*?>/gm, '').replace(/xmlns=".*?"/,''));
}

function convertToXULElement(str){
	str = str.toXMLString? str.toXMLString() : str;
	var xul = 
		'<box xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" >'+
			str + 
		'</box>';
	var parser = new DOMParser();
	var elms = parser.parseFromString(xul, 'text/xml').documentElement.childNodes;
	var result = currentDocument().createDocumentFragment();
	for(var i=0 ; i<elms.length ; i++)
		result.appendChild(elms[i]);
	return result;
}
