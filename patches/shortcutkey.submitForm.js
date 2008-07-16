shortcutkeys['CTRL + RETURN'] = {
	description : 'Form Submit',
	execute : function(e){
		var target = e.originalTarget;
		if((/^(input|textarea)/i).test(target.nodeName)){
			cancel(e);
			$x('./ancestor::form', target).submit();
		}
	}
}
