addBefore(Tumblr, 'appendTags', function(form, ps){
	if(ps.type != 'regular')
		form['post[state]'] = 2;
});
