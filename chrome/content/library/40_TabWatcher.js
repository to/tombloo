// ウィンドウが開かれロードされる度に呼び出される
connect(grobal, 'browser-load', function(e){
	// パフォーマンスを考慮しconnectしているものがいなければウォッチしない
	if(!connected(grobal, 'content-ready'))
		return;
	
	TabWatcher.watchWindow(e.target.defaultView);
});

// ガベージコレクトされずに残る可能性があるのと、パフォーマンスを考慮し、ひとつのインスタンスで捕捉する
// 並列動作によりlocationChangedが交差する可能性があるが、観察したかぎり発生しなかった
var TabWatcher = createMock('@mozilla.org/appshell/component/browser-status-filter;1', {
	onLocationChange : function(progress ,request ,location){
		this.locationChanged = true;
	},
	onStateChange : function(progress, request, flag, status){
		// ページ遷移後の一番はじめの条件にマッチするステートのみ取得する
		// layout-dummy-requestはFirefox 2のみ、document-onload-blockerも発生しているがその時点では遅い
		// Firefox 3ではdocument-onload-blockerでよい
		// STATE_IS_REQUEST STATE_START
		if(this.locationChanged && flag==65537 && (request.name=='about:layout-dummy-request' || request.name=='about:document-onload-blocker')){
			this.locationChanged = false;

			signal(grobal, 'content-ready', progress.DOMWindow.wrappedJSObject);
			return;
		}
	},
	watchWindow : function(win){
		var tabbrowser = win.document.getElementById('content');
		tabbrowser.browsers.forEach(function(browser){
			// ブラウザ起動時に開かれているタブにフックする
			TabWatcher.addProgressListener(browser);
		});
		
		win.addEventListener('TabOpen', function(e){
			var tab = e.originalTarget;
			var browser = tab.linkedBrowser;
			
			// 空タブを開いたときも実行される
			TabWatcher.addProgressListener(browser);
		}, false);
		
		win.addEventListener('TabClose', function(e){
			var tab = e.originalTarget;
			var browser = tab.linkedBrowser;
			
			TabWatcher.removeProgressListener(browser);
		}, false);
	},
	addProgressListener : function(browser){
		browser.webProgress.addProgressListener(this, this.NOTIFY_ALL);
	},
	removeProgressListener : function(browser){
		browser.webProgress.removeProgressListener(this);
	},
});
