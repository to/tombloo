(function(){
	const TYPE_DOCUMENT = IContentPolicy.TYPE_DOCUMENT;
	
	// 初期化されていないか?
	// (アプリケーションを通じて一度だけ通過する)
	var filt = grobal.filt;
	var checked = {};
	var disabled = false;
	if(!filt){
		var file = getPatchDir();
		file.append('filt.txt');
		
		filt = grobal.filt = {
			blackList : [],
			debug : false,
			file : file,
		};
		ObserverService.addObserver(filt, 'http-on-modify-request', false);
		
		setInterval(function(){
			checked = {};
		}, 3 * 60 * 1000);
		
		reloadList();
	}
	
	// policyチェックが開始する前に起きる通信をブロックする
	// (画像などで先読みが行われているよう)
	filt.observe = function(subject, topic, data){
		var url = subject.QueryInterface(IHttpChannel).URI.spec;
		if(isBlock(url))
			subject.cancel(Cr.NS_BINDING_ABORTED);
	};
	
	loadPolicies.push(function(contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra){
		// メインページとして開かれた場合は無条件に通す
		var url = contentLocation.spec;
 		if(contentType == TYPE_DOCUMENT)
			return checked[url] = false;
 		
		return isBlock(url);
	});
	
	function isBlock(url){
		if(disabled)
			return;
		
		// observeかpolicyで処理済みか(または最近アクセスされ判定済みか)?
		var res = checked[url];
		if(res != null)
			return res;
		
		var list = filt.blackList;
		for(var i=0, len=list.length ; i<len ; i++){
			if(list[i].test(url)){
				if(filt.debug)
					log([url, list[i]]);
				
				return checked[url] = true;;
			}
		}
		
		return checked[url] = false;
	}
	
	function reloadList(){
		// 重複定義を省く(複数のリストをマージするため)
		var list = keys(getContents(filt.file).split(/[\n\r]+/).reduce(function(memo, r){
			if(r)
				memo[r] = r;
			return memo;
		}, {})).sort();
		
		putContents(filt.file, list.join('\n') + '\n');
		
		checked = {};
		filt.blackList = list.map(function(r){
			return new RegExp(r);
		});
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
				name : 'Open List',
				execute : partial(openInEditor, filt.file), 
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
		_initData : non,
		_trackPageview : non,
		_trackEvent : non,
	};
	win._gat = {
		_getTracker : function(){
			return pageTracker;
		},
	}
	win.pageTracker = pageTracker;
	
	names.forEach(function(name){
		fixProp(win, name);
	});
	
	function fixProp(obj, prop){
		obj.watch(prop, function(key, ov, nv){
			return ov;
		});
		
		obj = obj[prop];
		if(typeof(obj)=='object')
			for(var prop in obj)
				fixProp(obj, prop);
	}
});
