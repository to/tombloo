connect(grobal, 'form-open', function(win){
	addAround(win.DescriptionBox.prototype, 'notifySelectionChanged', function(proceed, args, target){
		var sel = args[1];
		args[1] = {
			isCollapsed : sel.isCollapsed,
			toString : function(){
				return sel.toString().wrap('"');
			}
		}

		proceed(args);
	});
});
