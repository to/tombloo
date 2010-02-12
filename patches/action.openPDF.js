Tombloo.Service.actions.register({
	name : 'Open PDF',
	type : 'context',
	icon : 'http://docs.google.com/favicon.ico',
	check : function(ctx){
		return ctx.onLink;
	},
	execute : function(ctx){
		// ファイル名を取得しわかりやすくするためにリダイレクトを処理する
		getFinalUrl(ctx.linkURL).addCallback(function(url){
			addTab('http://docs.google.com/viewer?url=' + encodeURIComponent(ctx.linkURL));
		})
	},
}, '----');
