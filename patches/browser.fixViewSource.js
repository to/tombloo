connect(grobal, 'browser-load', function(e){
	addAround(e.target.defaultView.gViewSourceUtils, 'getExternalViewSourceEditor', function(proceed, args){
		var editor = proceed(args);
		return {
			run : function(blocking, args, count){
				args[0] = args[0].convertFromUnicode((/^win/i).test(AppInfo.OS)? 'Shift_JIS' : 'UTF-8');
				
				editor.run(blocking, args, count);
			}
		};
	});
});
