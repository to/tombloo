Tombloo.Service.actions.register(	{
	name : 'Delete All Posts',
	execute : function(){
		var p = new Progress('Delete All Posts');
		var d = succeed();
		d.addCallback(bind('getLoggedInUser', Tumblr));
		d.addCallback(bind('getInfo', Tumblr));
		d.addCallback(function(p, info){
			p.max = info.total;
			return Tumblr.read(info.name, null, info.total, function(post, index){
				if(p.canceled) throw StopProcess;
				p.value++;
				
				return Tumblr.remove(post.id).addCallback(wait, 1);
			});
		}, p.addChild(new Progress('Deleting All Posts')));
		d.addBoth(clearSandbox);
		openProgressDialog(p);
	},
}, '----');
