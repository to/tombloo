shortcutkeys['CTRL + RETURN'] = {
	description : 'Form Submit',
	execute : function(e){
		cancel(e);
		
		var target = e.originalTarget;
		if((/^(input|textarea)/i).test(target.nodeName))
			$x('./ancestor::form', target).submit();
	}
}
