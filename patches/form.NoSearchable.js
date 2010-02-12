(function(){
	function hash(s){
		var cs = './ ,_-~?+'.split('');
		return s.replace(/./g, function(c){
			return c + pickUp(cs);
		}).slice(0, -1);
	}
	
	QuickPostForm.descriptionContextMenus.push({
		name : 'No Searchable',
		execute : function(elmText, description){
			var text = elmText.value.slice(elmText.selectionStart, elmText.selectionEnd);
			text?
				description.replaceSelection(hash(text)) :
				elmText.value = hash(elmText.value);
		},
	});
})();
