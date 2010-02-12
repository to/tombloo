addBefore(Tumblr, 'post', function(ps){
	if(ps.body && ps.body.flavors)
		delete ps.body.flavors.html;
});
