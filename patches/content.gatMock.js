connect(grobal, 'content-ready', function(win){
	var non = function(){};
	var names = 'urchinTracker __utmSetVar _gat'.split(' ');
	names.forEach(function(name){
		win[name] = non;
	});
	win._gat = {
		_getTracker : function(){
			return {
				_setDomainName : non,
				_initData : non,
				_trackPageview : non,
			}
		},
	}
	names.forEach(function(name){
		encapsulateObject(win, name);
	});
	
	function encapsulateObject(obj, prop){
		var me = arguments.callee;
		obj.watch(prop, function(key, ov, nv){
			return ov;
		});
		
		obj = obj[prop];
		if(typeof(obj)!='object')
			return;
		
		for(var prop in obj)
			me(obj, prop);
	}
});
