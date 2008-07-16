addBefore(GoogleBookmarks, 'post', function(ps){
	ps.tags = ps.tags || [];
	ps.tags.push('TOMBLOO');
});
