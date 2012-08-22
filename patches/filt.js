(function(){
	const TYPE_DOCUMENT = IContentPolicy.TYPE_DOCUMENT;
	const REDIRECTION_LIMIT = getPrefValue('network.http.redirection-limit') || 20;
	
	// 初期化されていないか?
	// (アプリケーションを通じて一度だけ通過する)
	var filt = grobal.filt;
	var checked = {};
	var disabled = false;
	if(!filt){
		var dir = getPatchDir();
		
		filt = grobal.filt = {
			conds : {},
			debug : false,
			files : {
				host : dir.clone(),
				regexp : dir.clone(),
			},
		};
		filt.files.host.append('filt.host.txt');
		filt.files.regexp.append('filt.regexp.txt');
		ObserverService.addObserver(filt, 'http-on-modify-request', false);
		
		setInterval(function(){
			checked = {};
		}, 3 * 60 * 1000);
		
		reloadList();
	}
	
	// policyチェックが開始する前に起きる通信をブロックする
	// (画像などで先読みが行われているよう)
	filt.observe = function(subject, topic, data){
		try{
			var channel = subject.QueryInterface(IHttpChannel);
			
			// リダイレクトしている場合はメインページとして開いているか元コンテンツなので通す
			// (カウンタなどリダイレクトする画像はブロックできない)
			if(channel.referrer && (REDIRECTION_LIMIT == channel.redirectionLimit) && isBlock(channel.URI))
				subject.cancel(Cr.NS_BINDING_ABORTED);
		}catch(e){
			error(e);
			return;
		}
	};
	
	loadPolicies.push(function(contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra){
		try{
			// メインページとして開かれた場合は無条件に通す
			var url = contentLocation.spec;
			if(contentType == TYPE_DOCUMENT)
				return checked[url] = false;
			
			return isBlock(contentLocation);
		}catch(e){
			error(e);
			return false;
		}
	});
	
	function isBlock(uri){
		if(disabled)
			return;
		
		var url = uri.spec;
		
		// observeかpolicyで処理済みか(または最近アクセスされ判定済みか)?
		var res = checked[url];
		if(res != null)
			return res;
		
		var host = uri.host;
		var hosts = filt.conds.hosts;
		for(var i=0, len=hosts.length ; i<len ; i++){
			if(host.lastIndexOf(hosts[i]) != -1){
				if(filt.debug)
					log([host, hosts[i]]);
				
				return checked[url] = true;;
			}
		}
		
		var regexps = filt.conds.regexps;
		for(var i=0, len=regexps.length ; i<len ; i++){
			if(regexps[i].test(url)){
				if(filt.debug)
					log([url, ''+regexps[i]]);
				
				return checked[url] = true;;
			}
		}
		
		return checked[url] = false;
	}
	
	function reloadList(){
		filt.conds.hosts = loadList('host');
		filt.conds.regexps = loadList('regexp').map(function(r){
			return new RegExp(r);
		});
		checked = {};
	}
	
	function loadList(type){
		// 重複定義を省く
		var lines = keys(getContents(filt.files[type]).split(/[\n\r]+/).reduce(function(memo, r){
			if(r)
				memo[r] = r;
			return memo;
		}, {})).sort();
		
		putContents(filt.files[type], lines.join('\n') + '\n');
		
		return lines;
	}
	
	Tombloo.Service.actions.register({
		name : 'filt',
		type : 'menu',
		icon : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFWSURBVHjaYvz//z8DJQAggJgYKAQAAUSxAQABxILC285SyfD6rwKDGDMDAwcbAwM7FwMDrwADA6ckEMsxMPy8y8DAJvOAQXpNO0wLQACxoBl4C4jbGLgYgQqBUpwcQJoXiIGGsIowMPx6xMDAyByCrAEggFC94PlnLZDcz/AVGLCcIFdwAjXzAzULMzD8/QCU+r+fQWrlWmQtAAGEGQaizDlAb/xmePsDIfbjPhA/+M3AoZyDrhwggDAN8PxzDUjOYkCRAbqG4d8sBomF19CVAwQQ9lgQZa5nePXjLcP7twwMX54CA+/VWwYOxXpsSgECiAGUkLDivRzZ/7cx/v9/kv///3tO2bjUAQQQvnQwi+EvwzWGvyAv/ZyFSxFAAOE2wOn7bwbm/08Y/v19wqB45DcuZQABxII3mQkKbmPg5serBCCAGCnNTAABRHFeAAggig0ACDAAHjd13iiV8AcAAAAASUVORK5CYII=",
		children : [
			{
				name : 'Disable',
				check : function(){
					this.name = ((disabled)? 'Enable' : 'Disable');
					return true;
				},
				execute : function(){
					disabled = !disabled;
				},
			},
			{
				name : 'Reload List',
				execute : reloadList,
			},
			{
				name : 'Open Host List',
				execute : partial(openInEditor, filt.files.host), 
			},
			{
				name : 'Open RegExp List',
				execute : partial(openInEditor, filt.files.regexp), 
			},
			{
				name : 'Debug - On',
				check : function(){
					this.name = 'Debug - ' + ((filt.debug)? 'Off' : 'On');
					return true;
				},
				execute : function(){
					filt.debug = !filt.debug;
					
					// デバッグをオンの場合はキャッシュをクリアして確認できるようにする
					if(filt.debug)
						checked = {};
				},
			},
		],
	}, '----');
})();

connect(grobal, 'content-ready', function(win){
	var non = function(){};
	var names = 'urchinTracker __utmSetVar pageTracker _gat'.split(' ');
	names.forEach(function(name){
		win[name] = non;
	});
	
	var pageTracker = {
		_setDomainName : non,
		_initData      : non,
		_trackPageview : non,
		_trackEvent    : non,
	};
	win._gat = {
		_getTracker : function(){
			return pageTracker;
		},
	}
	win.pageTracker = pageTracker;
	
	names.forEach(function(name){
		sealProp(win, name);
	});
	
	function sealProp(obj, prop){
		Object.defineProperty(obj, prop, {
			configurable : false,
			enumerable   : false,
			writable     : false,
			value        : obj[prop],
		});
		
		obj = obj[prop];
		if(typeof(obj)=='object')
			for(var prop in obj)
				sealProp(obj, prop);
	}
});
