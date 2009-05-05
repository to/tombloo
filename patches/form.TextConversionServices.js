TextConversionServices.getServices().addCallback(function(services){
	var menus = [];
	services.forEach(function(service){
		var name = service.getMetaInfo().name;
		menus.push({
			name : name,
			execute : function(elmText){
				return TextConversionServices.convert(elmText.value, name).addCallback(function(res){
					elmText.value = res;
				});
			},
		});
	});
	
	QuickPostForm.descriptionContextMenus.push({
		name : 'TextConversionServices',
		children : menus,
	});
});
