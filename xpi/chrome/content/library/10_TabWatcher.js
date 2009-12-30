// ガベージコレクトされずに残る可能性があるのと、パフォーマンスを考慮し、ひとつのインスタンスで捕捉する
// 並列動作によりlocationChangedが交差する可能性があるが、観察したかぎり発生しなかった
var TabWatcher = createMock('@mozilla.org/appshell/component/browser-status-filter;1', {
	
	// nsIWebProgressListener
	onLocationChange : function(progress ,request ,location){
		this.locationChanged = true;
	},
	onStateChange : function(progress, request, flag, status){
		// ページ遷移後の一番はじめの条件にマッチするステートのみ取得する
		if(this.locationChanged && flag==(this.STATE_START | this.STATE_IS_REQUEST)){
			var name = this.getName(request);
			if(name && name=='about:document-onload-blocker'){
				this.locationChanged = false;
				
				signal(grobal, 'content-ready', wrappedObject(progress.DOMWindow));
				return;
			}
		}
	},
	
	watchWindow : function(win){
		var tabbrowser = win.getBrowser();
		tabbrowser.browsers.forEach(function(browser){
			// 取得以前に開かれているタブにフックする
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
		browser.webProgress.addProgressListener(this, this.NOTIFY_STATE_ALL | this.NOTIFY_STATUS | this.NOTIFY_LOCATION);
	},
	removeProgressListener : function(browser){
		try{
			// 再ロードによりインスタンスが変わりremoveできない時あり
			browser.webProgress.removeProgressListener(this);
		}catch(e){}
	},
	getName : function(request){
		try{
			return request.name;
		} catch (e){}
	},
});
