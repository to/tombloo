// ----[Usage]--------------------------------------------------
// click         : shrink(bookmark and close) tab
// shift + click : shrink all tabs
// right click   : remove folder

(function(){
	var folders;
	var bookmark = models.FirefoxBookmark;
	var NAME = 'Shrink Tab';
	var children = [
		{name : '----'},
		{
			name    : 'Add destination folder',
			execute : function(){
				var res = input({
					'Folder name' : ''
				}, NAME + ' - ' + this.name);
				if(!res)
					return;
				
				folders.push(values(res)[0]);
				saveFolders();
			}
		}
	];
	
	Tombloo.Service.actions.register({
		name : NAME,
		type : 'context',
		icon : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAIRSURBVDjLhZM7a5RBFIafme9bv2TjxkS8IN5SWGgKu8QmhYWFbf6DtT8kVoGAKQRBC8HextrGQhDBxoioSJSV7Gbdze53OTOvxV6yaogHXoY5HJ55z5kZJ4mjwjl3BTgPuHEKGBc3ga+SIpKOFLBSlmVhZppWnufa2traBJYAfxxg1cw0GAzU7XbVbrfVbDZlZur3+9re3t4EltwxLaya2WszI8aImVEUBYuLi5OaNE1vef4TSZLgvSdJErIso9Pp0Gq1DiEfXqy8nZlfXnZumiWePbjZHDkhSZKxK5xzmNkhwMlfv7z2uOacG81Y4BxXeXlxqh2SJME5N9lPAJhyYpkVPx4SygT8PM418MnC3zP5BzQEVM7HUGBFDUVRtd/T//6Rxm6TLztzSAFZCUR8fQEUSE6d5tLdpyOA04xCTjVwqDyg6omzaxsspheoz51k+pbGJ39+vj7twJPOnmPhxj0ggoSIFDv36ac1UPhjuLPXHiGJEEIPCCmVpJAT++9Q6KDQRbZPYXWqQY7HhmACMQbK1i69vW/Ksuw20EwpkKIRq5/IOkOI7VOfdZC5oSMZqEKxot6oMZN5k/Rm2EIpOQKyFrL9oUIH4mAE66LwC4UDFHNQDjb5VKQqY9v6e/Wqd6JBbHipBrEBOoNCAZTID1fnA6HoSWUsDgF5sfFpe30VcQdH49h3LcC9Kol6Mk79BmoIbLI/IOsSAAAAAElFTkSuQmCC",
		children : children,
	}, '----');
	
	loadFolders();
	
	
	function saveFolders(){
		setPref('action.shrinkTab.folders', uneval(folders));
		updateMenus();
	}
	
	function loadFolders(){
		folders = getPref('action.shrinkTab.folders');
		folders = (folders)? eval(folders) : [];
		
		updateMenus();
	}
	
	function updateMenus(){
		// 初期メニュー以外をクリア
		children.splice(0, children.length - 2);
		
		folders.forEach(function(folder){
			// 定義順に並べて追加する
			children.splice(-2, 0, {
				name : folder,
				execute : function(ctx){
					// 右クリック
					if(ctx.originalEvent.button != 0){
						if(input('Remove "' + folder + '" from menu?', NAME + ' - Remove destination folder')){
							folders.splice(folders.indexOf(folder), 1);
							
							saveFolders();
						}
						return;
					}
					
					getMostRecentWindow().getBrowser().removeCurrentTab();
					bookmark.addBookmark(ctx.href, ctx.title, null, null, folder);
				}
			});
		});
	}
})()
