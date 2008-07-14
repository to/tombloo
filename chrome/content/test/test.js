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

function sameObject(act, exp, msg){
	for(var p in exp){
		var exv = exp[p];
		var acv = act[p];
		var m = msg + ': ' + p;
		
		if(exv.test) {
			ok(exv.test(acv), m);
		} else if(typeof(exv) == 'function') {
			exv(acv, m);
		} else if(typeof(exv) == 'object') {
			sameObject(acv, exv, m);
		} else {
			is(acv, exv, m);
		}
	}
}
