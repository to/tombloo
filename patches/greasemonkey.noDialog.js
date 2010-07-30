// http://d.hatena.ne.jp/nazoking/20100623/1277302426
(function(){
	var SERVICE_NAME = '@greasemonkey.mozdev.org/greasemonkey-service;1';
	if(Cc[SERVICE_NAME]){
		CategoryManager.deleteCategoryEntry(
			'content-policy', SERVICE_NAME, SERVICE_NAME, true, true);
		
		connect(grobal, 'browser-load', function(e){
			// 通知エリアのインストールボタンが正常に動くようにする
			var win = e.target.defaultView;
			win.GM_BrowserUI.installCurrentScript = win.GM_BrowserUI.installMenuItemClicked;
		});
	}
})();
