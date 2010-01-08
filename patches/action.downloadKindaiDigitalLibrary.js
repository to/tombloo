Tombloo.Service.actions.register(	{
	name : 'Download Kindai Digital Library',
	type : 'context',
	check : function(ctx){
		return ctx.host == 'kindai.ndl.go.jp' && ctx.window.top && ctx.window.top.location.href.match('http://kindai.ndl.go.jp/BIImgFrame.php');
	},
	execute : function(ctx){
		const BAE_URL = 'http://kindai.ndl.go.jp/scrpt/';
		var self = this;
		var top = ctx.window.top;
		var title = $x('//td[@class="titlehead"]', top.frames['W_CONTROL'].document).textContent;
		var dir = createDir(ctx.host + '/' + title, getDownloadDir());
		var i = 1;
		
		// 書籍詳細情報を保存する
		request('http://kindai.ndl.go.jp/BIBibDetail.php', {
			queryString : formContents($x('//form[@name="form"]', top.frames['W_CONTROL'].document))
		}).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var detail = $x('//table[7]', doc).textContent;
			var file = dir.clone();
			file.append('detail.txt');
			putContents(file, 
				detail.replace(/[\t\r]/gm, '').replace(new RegExp('\n\uFF1A\n', 'gm'), ' : ').replace(/\n+/gm, '\n').trim());
		});
		
		// 全ページ繰り返す
		deferredForEach($x('(//select)[2]/option/@value', top.frames['W_BODY'].document, true), function(page){
			// 画像生成をリクエストする
			return request(BAE_URL + page).addCallback(function(res){
				var img = $x('//img[@usemap="#ClickMapPIC"]/@src', convertToHTMLDocument(res.responseText));
				var file = dir.clone();
				file.append((i++).pad(4) + '.jpg');
				return download(BAE_URL + img, file);
			});
		}).addCallback(function(){
			notify(self.name, 'End: ' + title, notify.ICON_DOWNLOAD);
		});
	},
}, '----');
