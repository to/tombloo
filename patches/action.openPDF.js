Tombloo.Service.actions.register(	{
	name : 'Open PDF',
	type : 'context',
	execute : function(ctx){
		// 拡張子がpdfのもの以外もあったためチェックを省略する
		addTab('http://docs.google.com/gview?url=' + encodeURIComponent(ctx.linkURL) + '&a=b');
	},
}, '----');
