TextConversionServices.getServices().addCallback(function(services){
	var menu = QuickPostForm.descriptionContextMenu;
	services.forEach(function(service){
		var name = service.getMetaInfo().name;
		menu.push({
			name : name,
			execute : function(elmText){
				TextConversionServices.convert(elmText.value, name).addCallback(function(res){
					elmText.value = res;
				});
			},
		});
	});
	menu.push({name : '----'});
});
