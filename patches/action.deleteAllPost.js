Tombloo.Service.actions.register(	{
	name : 'Delete All Posts',
	execute : function(){
		var p = new Progress('Delete All Posts');
		var d = succeed();
		d.addCallback(bind('getCurrentId', Tumblr));
		d.addCallback(function(id){
			if(prompt('Spell your id.: ' + id) != id)
				return d.cancel();
			
			openProgressDialog(p);
			return id;
		});
		d.addCallback(bind('getInfo', Tumblr));
		d.addCallback(function(info){
			p.max = info.total;
			return Tumblr.read(info.name, null, info.total, function(post, index){
				if(p.canceled)
					throw StopProcess;
				
				p.value++;
				
				return Tumblr.remove(post.id);
			});
		});
	},
}, '----');
