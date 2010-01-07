connect(grobal, 'form-open', function(win){
	var types = win.FormPanel.prototype.types;
	for(var i in types) {
		types[i].private.toggle = false;
	}
})
