connect(grobal, 'form-open', function(window){
	with(window){
		DialogPanel.shortcutkeys['ESCAPE'] = function(e){
			cancel(e);
			dialogPanel.close();
		};
	}
});
