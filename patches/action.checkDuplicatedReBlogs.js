Tombloo.Service.actions.register({
	name : 'Mosaic - Check Duplicated ReBlogs',
	execute : function(){
		var params = {
			query : Entity.compactSQL(<>
				SELECT id, user, imageId 
				FROM photos 
				WHERE user=:user
				GROUP BY user, imageId 
				HAVING count(*)>1
			</>),
			args : prompt('Target user:'),
		};
		if(!params.args)
			return;

		addTab('chrome://tombloo/content/library/Mosaic.html?' + queryString(params));
	},
}, '----');
