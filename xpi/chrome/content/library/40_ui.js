function QueryForm(elmForm, params){
	// ユーザー選択ボックスの作成
	var elmUser = $x('//select[@name="user"]', elmForm);
	appendChildNodes(elmUser,
		Tombloo.Photo.findUsers().map(function(user){
			return OPTION({value:user}, user);
		}))
	
	populateForm(elmForm, params);
	
	// イベント処理
	var submit = bind('submit', elmForm);
	$x('//input[@name="random"]', elmForm).onchange = submit;
	elmUser.onchange = submit;
	
	// ページバーの作成
	var entries = params.random? 0 : Tombloo.Photo.countByUser(params);
	if(entries){
		var pagebar = Pagebar({
			current : params.offset/PER+1,
			entries : entries,
			per : PER,
			max : 10,
		});
		insertSiblingNodesBefore(elmForm.childNodes[0], pagebar);
		
		var elmOffset = $x('//input[@name="offset"]', elmForm);
		elmOffset.value=0;
		connect(pagebar, 'onChange', function(e){
			elmOffset.value = (e.event()-1) * PER;
			submit();
		})
	}
}

// ---- [Widget] -------------------------------------------
function SlidePanel(elmPanel){
	var focusing = false;
	var hovering = false;
	var panel = {
		show : function(){
			elmPanel.style.display = '';
			removeElementClass(elmPanel, 'hidden');
		},
		hide : function(){
			elmPanel.style.display = 'none';
		},
		drawBack : function(){
			addElementClass(elmPanel, 'hidden');
		},
	};
	elmPanel.addEventListener('focus', function(e){
		focusing = true;
		panel.show();
	}, true);
	elmPanel.addEventListener('blur', function(e){
		focusing = false;
		hovering || panel.drawBack();
	}, true);
	elmPanel.addEventListener('mouseover', function(e){
		hovering = true;
		panel.show();
	}, true);
	elmPanel.addEventListener('mouseout', function(e){
		hovering = false;
		focusing || panel.drawBack();
	}, true);
	
	return panel;
}

// current / entries / per / max
function Pagebar(opt){
	var total = Math.ceil(opt.entries/opt.per);
	opt.max = opt.max || opt.entries;
	var step = total <= opt.max ? 1 : total/opt.max;
	
	var tds = <></>;
	var pages = {};
	for(var i=1 ; i<total ; i+=step)
		pages[Math.ceil(i)]=true;
	pages[opt.current] = pages[total] = true;
	
	if(opt.current!=1)
		tds+=<td class="pagination" value={opt.current-1}></td>
	
	keys(pages).sort(function(a,b){return a-b}).forEach(function(page){
		tds+=<td class={(page==opt.current)? 'current' : ''} value={page}>{page}</td>
	})
	
	if(opt.current!=total)
		tds+=<td class="pagination" value={opt.current+1}></td>
	
	var elmPagebar = convertToDOM(<table id="pagebar"><tr>{tds}</tr></table>);
	connect(elmPagebar, 'onclick', function(e){
		var target = e.target();
		if(hasElementClass(target, 'current')) return;
		
		signal(elmPagebar, 'onChange', target.getAttribute('value'));
	})
	return elmPagebar;
}


var QuickPostForm = {
	show : function(ps, position, message){
		openDialog(
			'chrome://tombloo/content/quickPostForm.xul', 
			'chrome,alwaysRaised=yes,resizable=yes,dependent=yes,titlebar=no', ps, position, message);
	},
};

// 設定画面が保存されたタイミングでコンテキストがリロードされクリアされる
// 仕様変更の際はsignal/connectでクリアすること
QuickPostForm.candidates = [];
QuickPostForm.dialog = {
	snap : {
		top : true,
		left : false,
	},
};
QuickPostForm.descriptionContextMenus = [
	{
		name : 'j.mp',
		icon : models['j.mp'].ICON,
		
		execute : function(elmText, desc){
			shortenUrls(desc.value, models['j.mp']).addCallback(function(value){
				desc.value = value;
			});
		},
	},
]


// ----[Shortcutkey]-------------------------------------------------
var shortcutkeys = {};
forEach({
	'shortcutkey.quickPost.link' : function(e){
		cancel(e);
		
		var win = getMostRecentWindow().content;
		var doc = win.document;
		
		var ctx = update({
			document  : doc,
			window    : win,
			title     : doc.title,
			selection : ''+win.getSelection(),
			target    : doc.documentElement,
		}, win.location);
		
		var models = Tombloo.Service.check(ctx).filter(function(model){
			return /^Link/.test(model.name);
		});
		Tombloo.Service.extractors.extract(
			ctx, 
			models[0]
		).addCallback(function(ps){
			QuickPostForm.show(ps);
		});
	},
	'shortcutkey.quickPost.regular' : function(e){
		cancel(e);
		
		var win = wrappedObject(e.currentTarget.content);
		var doc = win.document;
		
		QuickPostForm.show({
			type    : 'regular',
			page    : doc.title,
			pageUrl : win.location.href,
		});
	},
	
	// 処理を行わなかった場合はtrueを返す
	'shortcutkey.checkAndPost' : function(e){
		var doc = e.originalTarget.ownerDocument;
		var win = wrappedObject(doc.defaultView);
		
		// XULは処理しない
		if(!doc.body)
			return true;
		
		var ctx = update({
			document  : doc,
			window    : win,
			title     : doc.title,
			selection : ''+win.getSelection(),
			target    : e.originalTarget,
			mouse     : {
				page   : {x : e.pageX, y : e.pageY},
				screen : {x : e.screenX, y : e.screenY},
			},
		}, win.location);
		
		var ext = Tombloo.Service.check(ctx)[0];
		
		// FIXME: xul:popup要素の使用を検討
		var tip = doc.createElement('div');
		tip.setAttribute('style', <>
			font-family        : 'Arial Black', Arial, sans-serif;
			font-size          : 12px;

			color              : #666;
			background         : #EEEEEE no-repeat;
			position           : fixed;
			z-index            : 999999999;
			width              : auto; 
			height             : 16px;
			overflow           : hidden; 
			
			-moz-border-radius : 4px;
			border             : 4px solid #EEE;
			padding-left       : 20px;
			padding-right      : 2px;
		</>);
		tip.textContent = ext.name;
		convertToDataURL(ext.ICON).addCallback(function(dataUrl){
			tip.style.backgroundImage = 'url(' + dataUrl + ')';
		});
		setElementPosition(tip, {x: e.clientX - 24, y: e.clientY - 24});
		doc.body.appendChild(tip);
		setTimeout(function(){
			fade(tip, {
				duration : 0.8,
				afterFinish : function(){
					removeElement(tip);
				},
			});
		}, 250);
		
		Tombloo.Service.share(ctx, ext, ext.name.match(/^Link/));
	},
}, function([key, func]){
	key = getPref(key);
	if(key)
		shortcutkeys[key] = {
			execute : func,
		};
});


// ----[browser]-------------------------------------------------
connect(grobal, 'browser-load', function(e){
	var cwin = e.target.defaultView;
	var doc = cwin.document;
	
	connectToBrowser(cwin);
	
	var context;
	var menuContext = doc.getElementById('contentAreaContextMenu');
	var menuShare   = doc.getElementById('tombloo-menu-share');
	var menuSelect  = doc.getElementById('tombloo-menu-select');
	var menuAction  = doc.getElementById('tombloo-menu-action');
	
	menuShare.setAttribute('accesskey', getPref('accesskey.share'));
	
	var separator = doc.createElement('menuseparator');
	if(getPref('contextMenu.top')){
		insertSiblingNodesAfter(menuAction.parentNode, separator);
	} else {
		// メニューを最下部へ移動する
		menuContext.appendChild(separator);
		menuContext.appendChild(menuShare);
		menuContext.appendChild(menuSelect.parentNode);
		menuContext.appendChild(menuAction.parentNode);
	}
	
	// Menu Editor拡張によって個別メニューのイベントを取得できなくなる現象を回避
	menuContext.addEventListener('popupshowing', function(e){
		if(e.eventPhase != Event.AT_TARGET || (context && context.target == cwin.gContextMenu.target))
			return;
		
		var doc = wrappedObject(cwin.gContextMenu.target.ownerDocument);
		var win = wrappedObject(doc.defaultView);
		try{
			win.location.host;
			
			menuShare.disabled = false;
			menuSelect.parentNode.disabled = false;
		}catch(e){
			// about:config などのページで無効にする
			menuShare.disabled = true;
			menuSelect.parentNode.disabled = true;
			
			return;
		}

		// command時にはクリック箇所などの情報が失われるためコンテキストを保持しておく
		context = update({}, cwin.gContextMenu, win.location, {
			document  : doc,
			window    : win,
			title     : doc.title,
			selection : ''+win.getSelection(),
			target    : wrappedObject(cwin.gContextMenu.target),
			mouse     : {
				page   : {x : e.pageX, y : e.pageY},
				screen : {x : e.screenX, y : e.screenY},
			},
			menu      : cwin.gContextMenu,
		});
		
		// アクションメニューを作成する
		forEach(Tombloo.Service.actions, function([name, action]){
			if(!/context/.test(action.type))
				return;
				
			if(action.check && !action.check(context))
				return;
			
			var elmItem = appendMenuItem(menuAction, action.name);
			elmItem.action = action;
		});
		
		var exts = Tombloo.Service.check(context);
		menuShare.label = 'Share - ' + exts[0].name;
		menuShare.extractor = exts[0].name;
		menuShare.setAttribute('image', exts[0].ICON || 'chrome://tombloo/skin/empty.png');
		
		if(exts.length<=1){
			menuSelect.parentNode.disabled = true;
		} else {
			menuSelect.parentNode.disabled = false;
			
			for(var i=0 ; i<exts.length ; i++){
				var ext = exts[i];
				var elmItem = appendMenuItem(menuSelect, ext.name, ext.ICON || 'chrome://tombloo/skin/empty.png');
				elmItem.extractor = ext.name;
				elmItem.showForm = true;
			}
		}
	}, true);
	
	menuContext.addEventListener('popuphidden', function(e){
		if(e.eventPhase != Event.AT_TARGET)
			return;
		
		context = null;
		
		clearChildren(menuAction);
		clearChildren(menuSelect);
	}, true);
	
	menuContext.addEventListener('command', function(e){
		var target = e.target;
		if(target.extractor){
			var svc = Tombloo.Service;
			svc.share(context, svc.extractors[target.extractor], target.showForm);
			
			return;
		}
		
		if(target.action){
			target.action.execute(context);
			
			return;
		}
	}, true);
	
	// clickイベントはマウス座標が異常
	menuContext.addEventListener('mousedown', function(e){
		if(!e.target.extractor)
			return;
		
		context.mouse.post = {
			x : e.screenX, 
			y : e.screenY
		}
	}, true);
	
	var menuMain = doc.getElementById('tombloo-menu-main');
	menuMain.addEventListener('popupshowing', function(e){
		clearChildren(menuMain);
		
		forEach(Tombloo.Service.actions, function([name, action]){
			// 後方互換のためtypeが存在しないものも可とする
			if(action.type && !/menu/.test(action.type))
				return;
			
			if(action.check && !action.check())
				return;
			
			var elmItem = appendMenuItem(menuMain, action.name);
			elmItem.action = action;
		});
	}, true);
	
	menuMain.addEventListener('command', function(e){
		e.target.action.execute(context);
	}, true);
});

function connectToBrowser(win){
	// パフォーマンスを考慮しconnectしているものがいなければウォッチしない
	// リロードや設定変更により繰り返し呼ばれたときに多重フックしないようにチェック
	// チェック状況をグローバル環境に持つのは複雑になりリークを招くためwindowに置く
	var Tombloo = win.Tombloo = (win.Tombloo || {});
	var hooked = Tombloo.hooked = (Tombloo.hooked || {});
	var tabbrowser = win.getBrowser();
	var version = parseFloat(AppInfo.version);
	
	if(!hooked.contentReady && connected(grobal, 'content-ready')){
		constant.tabWatcher = constant.tabWatcher || new TabWatcher();
		constant.tabWatcher.watchWindow(win);
		hooked.contentReady = true;
	}
	
	if(!hooked.shortcutkey && !isEmpty(shortcutkeys)){
		win.addEventListener('keydown', function(e){
			var key = shortcutkeys[keyString(e)];
			if(!key)
				return;
			
			// Shift + Tなどをテキストエリアで入力できるように
			if((e.ctrlKey || e.altKey) || !(/(input|textarea)/i).test(e.target.tagName))
				key.execute(e);
		}, true);
		hooked.shortcutkey = true;
	}
	
	if(!hooked.mouseShortcut && keys(shortcutkeys).some(function(key){return key.indexOf('_DOWN')!=-1})){
		observeMouseShortcut(win, function(e, key){
			key = shortcutkeys[key];
			if(!key)
				return true;
			
			return key.execute(e);
		});
		hooked.mouseShortcut = true;
	}
}
