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

function QuickPostForm(ps){
	this.params = ps;
	this.posters = new Repository(models.check(ps));
}

QuickPostForm.refreshCache = true;
QuickPostForm.candidates = [];
QuickPostForm.prototype = {
	get checked(){
		var checked = [];
		var posters = this.posters;
		forEach(this.notification.getElementsByTagName('checkbox'), function(c){
			if(c.checked)
				checked.push(posters[c.getAttribute('label')]);
		});
		return checked;
	},
	
	post : function(){
		var ps = this.params;
		$x('.//*[@name]', this.notification, true).forEach(function(elm){
			ps[elm.getAttribute('name')] = elm.values || elm.value;
		});
		
		if(!this.checked.length)
			return;
		
		Tombloo.Service.post(ps, this.checked);
		if(this.elmTags)
			QuickPostForm.refreshCache = this.elmTags.includesNewTag;
		this.notification.close();
	},
	
	onKeydown : function(e){
		switch(keyString(e)) {
		case 'CTRL + RETURN':
			cancel(e);
			this.post();
			break;
			
		case 'CTRL + W':
			cancel(e);
			this.notification.close();
			break;
		}
	},
	
	checkPostable : function(){
		this.elmPost.disabled = !this.checked.length;
	},
	
	show : function(){
		// FIXME: 暫定処理(reblog/favorites/starの整理)
		if(this.params.type == 'reblog')
			return Tumblr.openTab(this.params);
		
		var self = this;
		var contentWindow = getMostRecentWindow().getBrowser().contentWindow;
		var selection = broad(contentWindow.getSelection());
		
		var notification = this.notification = showNotification(this.createForm());
		notification.addEventListener('keydown', bind('onKeydown', this), true);
		notification.persistence = 1000;
		addBefore(notification, 'close', function(){
			selection.removeSelectionListener(self);
			contentWindow.focus();
		});
		
		// FIXME: 外部cssに
		notification.style.color = '-moz-DialogText';
		notification.style.backgroundImage = 'none';
		notification.style.backgroundColor = '-moz-Dialog';
		
		this.notification.addEventListener('command', function(e){
			if(e.target.nodeName == 'checkbox')
				self.checkPostable();
		}, true);
		
		this.elmPost = notification.getElementsByTagName('button')[0];
		this.elmPost.addEventListener('command', bind('post', this), true);
		this.checkPostable();
		
		this.elmTags = this.prepareTags();
		
		setTimeout(function(){
			$x('.//xul:textbox', notification).focus();
		}, 50);
		
		this.elmDescription = $x('.//xul:textbox[@name="description"]', this.notification);
		if(this.elmDescription)
			selection.addSelectionListener(this);
	},
	
	prepareTags : function(){
		var elmTags = $x('.//xul:textbox[@name="tags"]', this.notification);
		if(!elmTags)
			return;
		
		elmTags.autoComplete = getPref('tagAutoComplete');
		elmTags.candidates = QuickPostForm.candidates;
		
		var tagProvider = getPref('tagProvider');
		if(!tagProvider || (tagProvider==QuickPostForm.tagProvider && !QuickPostForm.refreshCache))
			return elmTags;
		
		models[tagProvider].getUserTags().addCallback(function(tags){
			if(!tags || !tags.length)
				return;
			
			if(QuickPostForm.candidates.length==tags.length){
				elmTags.candidates = QuickPostForm.candidates
				return;
			}
			
			tags = tags.sort(function(a, b){
				return b.frequency != a.frequency ? compare(b.frequency, a.frequency) : compare(a.name, b.name);
			}).map(itemgetter('name'));
			
			var d = succeed();
			var readings = tags;
			var source = tags.join(' [');
			if(source.includesFullwidth()){
				d = Yahoo.getRomaReadings(source).addCallback(function(rs){
					readings = rs.join('').split(' [');
				});
			}
			
			d.addCallback(function(){
				// 次回すぐに利用できるようにキャッシュする
				QuickPostForm.refreshCache = false;
				QuickPostForm.tagProvider = tagProvider;
				elmTags.candidates = QuickPostForm.candidates = zip(readings, tags).map(function(cand){
					return {
						reading : cand[0],
						value : cand[1],
					}
				});
			});
		});
		
		return elmTags;
	},
	
	// nsISelectionListener
	notifySelectionChanged : function(doc, sel, reason){
		if(!sel.isCollapsed && reason == ISelectionListener.MOUSEUP_REASON){
			var elm = this.elmDescription;
			var value = elm.value;
			var start = elm.selectionStart;
			sel = sel.toString().trim();
			
			this.elmDescription.value = 
				value.substr(0, elm.selectionStart) + 
				sel + 
				value.substr(elm.selectionEnd);
			elm.selectionStart = elm.selectionEnd = start + sel.length;
			elm.focus();
			
			// valueを変えると先頭に戻ってしまうため最後に移動し直す
			var input = elm.ownerDocument.getAnonymousElementByAttribute(this.elmDescription, 'anonid', 'input');
			input.scrollTop = input.scrollHeight;
		}
	},
	
	createForm : function(){
		var ps = update({
			description : '',
		}, this.params);
		var tags = joinText(ps.tags, ' ');
		var config = eval(getPref('postConfig'));
		
		var form = convertToXULElement(<vbox style="margin-bottom: 4px; padding: 7px 1px"  flex="1000">
			<hbox>
				<grid flex="1" >
					<columns>
						<column/>
						<column flex="1"/>
					</columns>
					{(function(){
						switch(ps.type){
						case 'regular':
							return <rows>
								<row>
									<label value="Type"/>
									<label value={ps.type.capitalize()} />
								</row>
								<spacer style="margin-top: 1em;"/>
								<row>
									<label value="Description"/>
									<textbox name="description" multiline="true" rows="6" value={ps.description}/>
								</row>
							</rows>
							
						case 'link':
							return <rows>
								<row>
									<label value="Type"/>
									<label value={ps.type.capitalize()} />
								</row>
								<row>
									<label value="Title"/>
									<label value={ps.item} crop="end" />
								</row>
								<row>
									<label value="URL"/>
									<label value={ps.itemUrl} crop="end" />
								</row>
								<spacer style="margin-top: 1em;"/>
								<row>
									<label value="Tag"/>
									<textbox name="tags" flex="1" value={tags} style="-moz-binding: url(chrome://tombloo/content/library/completion.xml#container);"/>
								</row>
								<row>
									<label value="Description"/>
									<textbox name="description" multiline="true" rows="3" value={ps.description}/>
								</row>
							</rows>
							
						case 'quote':
							return <rows>
								<row>
									<label value="Type"/>
									<label value={ps.type.capitalize()} />
								</row>
								<row>
									<label value="Title"/>
									<label value={ps.item} crop="end" />
								</row>
								<spacer style="margin-top: 1em;"/>
								<row>
									<label value="Tag"/>
									<textbox name="tags" flex="1" value={tags} style="-moz-binding: url(chrome://tombloo/content/library/completion.xml#container)"/>
								</row>
								<row>
									<label value="Quote"/>
									<textbox name="body" multiline="true" rows="3" value={ps.body}/>
								</row>
								<row>
									<label value="Description"/>
									<textbox name="description" multiline="true" rows="3" value={ps.description}/>
								</row>
							</rows>
							
						case 'photo':
							return <rows xmlns:html={HTML_NS}>
								<row>
									<label value="Type"/>
									<label value={ps.type.capitalize()} />
								</row>
								<row>
									<label value="Title"/>
									<label value={ps.item} crop="end" />
								</row>
								<row>
									<label value="Photo"/>
									<html:div>
										<html:img src={ps.itemUrl || (createURI(ps.file).spec + '?' + Date.now())} style="max-height:80px; margin: 2px 4px;"/>
									</html:div>
								</row>
								<spacer style="margin-top: 1em;"/>
								<row>
									<label value="Tag"/>
									<textbox name="tags" flex="1" value={tags} style="-moz-binding: url(chrome://tombloo/content/library/completion.xml#container)"/>
								</row>
								<row>
									<label value="Description"/>
									<textbox name="description" multiline="true" rows="3" value={ps.description}/>
								</row>
							</rows>
							
						case 'video':
							return <rows>
								<row>
									<label value="Type"/>
									<label value={ps.type.capitalize()} />
								</row>
								<row>
									<label value="Title"/>
									<label value={ps.item} crop="end" />
								</row>
								<spacer style="margin-top: 1em;"/>
								<row>
									<label value="Tag"/>
									<textbox name="tags" flex="1" value={tags} style="-moz-binding: url(chrome://tombloo/content/library/completion.xml#container)"/>
								</row>
								<row>
									<label value="Description"/>
									<textbox name="description" multiline="true" rows="3" value={ps.description} />
								</row>
							</rows>
						}
					})()}
				</grid>
				<separator orient="vertical" class="groove-thin" width="1" style="margin: 0 5px 0 9px;" />
				<vbox>
					{
						reduce(function(memo, name){
							var c = config[name] || {};
							if(c[ps.type] !== ''){
								memo.checkbox += <checkbox label={name} src={models[name].ICON} checked={!!c[ps.type]} />
							}
							return memo;
						}, this.posters.names, <vbox/>)
					}
					<spacer flex="1" style="margin-top: 7px;" />
					<button label="Post" disabled="true"/>
				</vbox>
			</hbox>
		</vbox>);
		
		return form;
	},
}

// ----[Shortcutkey]-------------------------------------------------
var shortcutkeys = {};
forEach({
	'shortcutkey.quickPost.link' : function(e){
		cancel(e);
		
		var win = e.currentTarget.content;
		var doc = win.document;
		win = win.wrappedJSObject || win;
		
		new QuickPostForm({
			type    : 'link',
			page    : doc.title,
			pageUrl : win.location.href,
			item    : doc.title,
			itemUrl : win.location.href,
		}).show();
	},
	'shortcutkey.quickPost.regular' : function(e){
		cancel(e);
		
		var win = e.currentTarget.content;
		var doc = win.document;
		win = win.wrappedJSObject || win;
		
		new QuickPostForm({
			type    : 'regular',
			page    : doc.title,
			pageUrl : win.location.href,
		}).show();
	},
	
	// 処理を行わなかった場合はtrueを返す
	'shortcutkey.checkAndPost' : function(e){
		var doc = e.originalTarget.ownerDocument;
		var win = doc.defaultView;
		win = win.wrappedJSObject || win;
		
		// XULは処理しない
		if(!doc.body)
			return true;
		
		var ctx = update({
			document  : doc,
			window    : win,
			title     : doc.title,
			selection : getSelectionString(win),
			event     : e,
			target    : e.originalTarget,
			mouse     : {
				x : e.pageX,
				y : e.pageY,
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
		fade(tip, {
			duration : 0.8,
			afterFinish : function(){
				removeElement(tip);
			},
		});
		
		Tombloo.Service.share(ctx, ext, ext.name.match(/^Link/));
	},
}, function(pair){
	var key = getPref(pair[0]);
	if(key)
		shortcutkeys[key] = {
			execute : pair[1],
		};
});


// ----[browser]-------------------------------------------------
connect(grobal, 'browser-load', function(e){
	var cwin = e.target.defaultView;
	var doc = cwin.document;
	
	connectToBrowser(cwin);
		
	var context;
	var menuContext = doc.getElementById('contentAreaContextMenu');
	var menuShare = doc.getElementById('tombloo-menu-share');
	var menuSelect = doc.getElementById('tombloo-menu-select');
	
	menuShare.setAttribute('accesskey', getPref('accesskey.share'));
	
	// Menu Editor拡張によって個別メニューのイベントを取得できなくなる現象を回避
	menuContext.addEventListener('popupshowing', function(e){
		if(e.eventPhase != Event.AT_TARGET || (context && context.target == cwin.gContextMenu.target))
			return;
		
		var doc = cwin.gContextMenu.target.ownerDocument;
		var win = doc.defaultView;
		win = win.wrappedJSObject || win;
		
		try{
			// about:config などで無効にする
			win.location.host;
			
			menuShare.disabled = false;
			menuSelect.parentNode.disabled = false;
		}catch(e){
			menuShare.disabled = true;
			menuSelect.parentNode.disabled = true;
			
			return;
		}
		
		// [FIXME] selection文字列化再検討
		// command時にはクリック箇所などの情報が失われるためコンテキストを保持しておく
		context = update({
			document  : doc,
			window    : win,
			title     : ''+doc.title || '',
			selection : getSelectionString(win),
			event     : e,
			mouse     : {
				x : e.pageX,
				y : e.pageY,
			},
			menu      : cwin.gContextMenu,
		}, cwin.gContextMenu, win.location);
		
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
				var item = appendMenuItem(menuSelect, ext.name, ext.ICON || 'chrome://tombloo/skin/empty.png');
				item.extractor = ext.name;
				item.showForm = true;
			}
		}
	}, true);
	
	menuContext.addEventListener('popuphidden', function(e){
		if(e.eventPhase != Event.AT_TARGET)
			return;
		
		context = null;
		
		clearChildren(menuSelect);
	}, true);
	
	menuContext.addEventListener('command', function(e){
		if(!e.target.extractor)
			return;
		
		context.event = e;
		
		var svc = Tombloo.Service;
		svc.share(context, svc.extractors[e.target.extractor], e.target.showForm);
	}, true);
	
	var menuAction = doc.getElementById('tombloo-menu-main');
	Tombloo.Service.actions.names.forEach(function(name){
		appendMenuItem(menuAction, name);
	});
	
	menuAction.addEventListener('command', function(e){
		Tombloo.Service.actions[e.originalTarget.label].execute();
	}, true);
	
	
	// FIXME: docを解決し汎用に
	function appendMenuItem(menu, label, image){
		if((/^----/).test(label))
			return menu.appendChild(doc.createElement('menuseparator'));
		
		var item = menu.appendChild(doc.createElement('menuitem'));
		item.setAttribute('label', label);
		
		if(image){
			item.setAttribute('class', 'menuitem-iconic');
			item.setAttribute('image', image);
		}
		
		return item;
	}
});

function reload(){
	loadAllSubScripts();
	getWindows().forEach(connectToBrowser);
}

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
