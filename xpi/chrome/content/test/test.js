// ---- [Test Support] -----------------------------------------
function withXHR(process, exp, responseText){
	var org = XMLHttpRequest;
	try{
		XMLHttpRequest = function(){
			// getContentsからの呼び出しにはモックを適用しない
			for(var stack = Components.stack ; stack ; stack = stack.caller)
				if(stack.name == 'getContents')
					return new org();
		};
		XMLHttpRequest.prototype = {
			statusText : 'OK',
			status : 200,
			readyState : 4,
			responseText : responseText,
			
			open : function(method, url, async, username, password){
				this.method = method.toUpperCase();
				if(this.method == 'GET')
					this.test(parseQueryString(broad(createURI(url)).query));
			},
			send : function(text){
				if(this.method != 'GET')
					this.test(parseQueryString(text));
				
				this.onload(this);
				this.onreadystatechange(this);
			},
			test : function(act){
				typeof(exp)=='function'? exp(act) : sameObject(act, exp);
			},
			getAllResponseHeaders : function(){},
			setRequestHeader : function(){},
			onload : function(req){},
			onreadystatechange : function(req){},
		};
		
		process();
	} finally {
		XMLHttpRequest = org;
	}
}

function sameArray(act, exp, msg){
	is(act.toSource(), exp.toSource(), msg);
}

function sameObject(act, exp, msg){
	for(var p in exp){
		var exv = exp[p];
		var acv = act[p];
		var m = msg + ': ' + p;
		
		// 正規表現か
		if(exv.test) {
			ok(exv.test(acv), m);
		} else if(exv.QueryInterface) {
			ok(acv instanceof exv, m);
		} else if(typeof(exv) == 'function') {
			exv(acv, m);
		} else if(typeof(exv) == 'object') {
			sameObject(acv, exv, m);
		} else {
			is(acv, exv, m);
		}
	}
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

function getTestFile(path){
	var file = getContentDir();
	file.append('test');
	
	if(path)
		file.setRelativeDescriptor(file, path);
	
	return file;
}

function copy(src, target){
	if(!src.exists())
		return;
	
	remove(target);
	src.copyTo(target.parent, target.leafName);
	
	return target;
}

function remove(file){
	file.exists() && file.remove(false);
}

function lipsum(){
	return (Math.floor(Math.random()*Math.pow(9,9))).toString(36);
}
