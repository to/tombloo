addBefore(Tumblr, 'appendTags', function(form, ps){
	if(ps.type != 'photo')
		form['post[state]'] = 2;
});
