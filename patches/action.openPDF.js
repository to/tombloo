Tombloo.Service.actions.register(	{
	name : 'Open PDF',
	type : 'context',
	icon : 'moz-icon://.pdf?size=16',
	execute : function(ctx){
		// 拡張子がpdfのもの以外もあったためチェックを省略する
		
		// ファイル名を取得しわかりやすくするためにリダイレクトを処理する
		getFinalUrl(ctx.linkURL).addCallback(function(url){
			addTab('http://docs.google.com/gview?url=' + encodeURIComponent(ctx.linkURL) + '&a=b');
		})
	},
}, '----');
