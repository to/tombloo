TextConversionServices.getServices().addCallback(function(services){
	var menus = [];
	services.forEach(function(service){
		var name = service.getMetaInfo().name;
		menus.push({
			name : name,
			execute : function(ctx){
				return TextConversionServices.convert(ctx.target.value, name).addCallback(function(res){
					ctx.target.value = res;
				});
			},
		});
	});
	
	Tombloo.Service.actions.register( {
		name : 'Text Conversion Services',
		type : 'context',
		check : function(ctx){
			return ctx.target.tagName == 'TEXTAREA';
		},
		children : menus,
	}, '----');
});
