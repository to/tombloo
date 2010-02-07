(function(){
	const TYPE_DOCUMENT = IContentPolicy.TYPE_DOCUMENT;
	
	var blackList = [];
	var debug = false;
	var file = getPatchDir();
	file.append('filt.txt');
	
	loadPolicies.push(function(contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra){
		if(contentType == TYPE_DOCUMENT)
			return;
		
		var location = contentLocation.spec;
		for(var i=0, len=blackList.length ; i<len ; i++)
			if(blackList[i].test(location)){
				if(debug)
					log([location, blackList[i]]);
				return true;
			}
	});
	
	reloadList();
	
	function reloadList(){
		// 重複定義を省く(複数のリストをマージするため)
		var list = keys(getContents(file).split(/[\n\r]+/).reduce(function(memo, r){
			if(r)
				memo[r] = r;
			return memo;
		}, {})).sort();
		
		putContents(file, list.join('\n') + '\n');
		
		blackList = list.map(function(r){
			return new RegExp(r);
		});
	}
	
	Tombloo.Service.actions.register({
		// メインメニューはサブメニューに対応していないため暫定的にコンテキストのみとする
		name : 'filt',
		type : 'context',
		icon : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFWSURBVHjaYvz//z8DJQAggJgYKAQAAUSxAQABxILC285SyfD6rwKDGDMDAwcbAwM7FwMDrwADA6ckEMsxMPy8y8DAJvOAQXpNO0wLQACxoBl4C4jbGLgYgQqBUpwcQJoXiIGGsIowMPx6xMDAyByCrAEggFC94PlnLZDcz/AVGLCcIFdwAjXzAzULMzD8/QCU+r+fQWrlWmQtAAGEGQaizDlAb/xmePsDIfbjPhA/+M3AoZyDrhwggDAN8PxzDUjOYkCRAbqG4d8sBomF19CVAwQQ9lgQZa5nePXjLcP7twwMX54CA+/VWwYOxXpsSgECiAGUkLDivRzZ/7cx/v9/kv///3tO2bjUAQQQvnQwi+EvwzWGvyAv/ZyFSxFAAOE2wOn7bwbm/08Y/v19wqB45DcuZQABxII3mQkKbmPg5serBCCAGCnNTAABRHFeAAggig0ACDAAHjd13iiV8AcAAAAASUVORK5CYII=",
		children : [
			{
				name : 'Reload List',
				execute : reloadList,
			},
			{
				name : 'Open List',
				execute : partial(openInEditor, file), 
			},
			{
				name : '',
				check : function(){
					this.name = 'Debug - ' + ((debug)? 'Off' : 'On');
					return true;
				},
				execute : function(){
					debug = !debug;
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
	
	var tracker = {
		_trackEvent : non,
		_trackPageview : non,
		_initData : non,
		_setDomainName : non,
	};
	win._gat = {
		_getTracker : function(){
			return tracker;
		},
	}
	win.pageTracker = tracker;
	
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
