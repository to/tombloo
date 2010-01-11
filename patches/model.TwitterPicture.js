models.register(update({}, Twitter, {
	name : 'Twitter - Picture',
	
	check : function(ps){
		return ps.type == 'photo';
	},
	
	post : function(ps){
		return this.changePicture(ps.itemUrl);
	},
}));
