(function(){
	var MENU_TITLE = 'Twitter - Recipients';
	var getRecipients = cache(bind('getRecipients', Twitter), Date.TIME_HOUR);
	var menu = {
		name : MENU_TITLE,
		icon : Twitter.ICON,
	}
	QuickPostForm.descriptionContextMenus.push(menu);
	
	connect(grobal, 'form-open', function(win){
		var ps = win.ps;
		if(ps.type != 'regular')
			return;
		
		getRecipients().addCallback(function(recipients){
			menu.children = recipients.map(function(recipient){
				var name = recipient.name;
				return {
					name : name,
					execute : function(elmText, description){
						description.replaceSelection(name);
					},
				};
			});
		});
	});
})();
