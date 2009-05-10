Tumblr.getTumblelogs().addCallback(function(blogs){
	blogs.forEach(function(blog){
		var model = update({}, Tumblr);
		model.name = 'Tumblr - ' + blog.name;
		addBefore(model, 'appendTags', function(form, ps){
			form.channel_id = blog.id;
		});
		
		models.register(model, 'Tumblr', true);
	});
});
