Tombloo.Service.actions.register(	{
	name : 'Download Kindai Digital Library',
	type : 'context',
	check : function(ctx){
		return ctx.host == 'kindai.ndl.go.jp' && ctx.window.top && ctx.window.top.location.href.match('http://kindai.ndl.go.jp/BIImgFrame.php');
	},
	execute : function(ctx){
		// FIXME: 本体へ組み込み
		function queryString(params, charset){
			if(isEmpty(params))
				return '';
			
			if(typeof(params)=='string')
				return params;
			
			var qeries = [];
			var e = (charset)? function(str){
				return escape((''+str).convertFromUnicode(charset))
			} : encodeURIComponent;
			for(var key in params){
				var value = params[key];
				if(value==null)
					continue;
				
				if(value instanceof Array){
					value.forEach(function(val){
						qeries.push(e(key) + '=' + e(val));
					});
				} else {
					qeries.push(e(key) + '='+ e(value));
				}
			}
			return qeries.join('&');
		}

		const BAE_URL = 'http://kindai.ndl.go.jp/scrpt/';
		var self = this;
		var top = ctx.window.top;
		var title = top.frames['W_CONTROL'].document.getElementById('titlearea').textContent.replace(/[\n\r\t 　]+/gm, ' ').trim();
		var dir = createDir(ctx.host + '/' + validateFileName(title), getDownloadDir());
		var i = 1;
		
		// 書籍詳細情報を保存する
		var form = formContents($x('//form[@name="form"]', top.frames['W_CONTROL'].document));
		request('http://kindai.ndl.go.jp/BIBibDetail.php?' + queryString(form, 'EUC-JP')).addCallback(function(res){
			var doc = convertToHTMLDocument(res.responseText);
			var detail = $x('//table[@width="70%"]', doc).textContent;
			var file = dir.clone();
			file.append('detail.txt');
			putContents(file, 
				detail.replace(/[\t\r]/gm, '').replace(new RegExp('\n\uFF1A\n', 'gm'), ' : ').replace(/\n+/gm, '\n').trim());
		});
		
		// 全ページ繰り返す
		deferredForEach($x('(//select)[2]/option/@value', top.frames['W_BODY'].document, true), function(page){
			page = page.replace(/l=3/, 'l=5').replace(/sz=\d/, 'sz=3');
			
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
