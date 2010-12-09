Tombloo.Service.actions.register({
	name : 'Retweet by ID',
	type : 'context',
	icon : 'http://twitter.com/phoenix/favicon.ico',
	execute : function(ctx){
		var id = prompt('Satus ID:');
		if(!id)
			return;
		
		Twitter.getToken().addCallback(function(token){
			return request('http://api.twitter.com/1/statuses/retweet/' + id + '.json', {
				referrer : 'http://api.twitter.com/p_receiver.html',
				headers : {
					'X-Requested-With' : 'XMLHttpRequest',
					'X-PHX' : true,
				},
				sendContent : {
					post_authenticity_token : token.authenticity_token,
				},
			});
		}).addBoth(function(res){
			log(res);
		});
	},
}, '----');
