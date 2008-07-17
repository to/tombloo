function QueryForm(elmForm, params){
	// ユーザー一選択ボックスの作成
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
		this.notification.close();
	},
	
	onKeydown : function(e){
		switch(keyString(e)) {
		case 'CTRL + RETURN':
			cancel(e);
			this.post();
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
		
		this.notification.addEventListener('command', function(e){
			if(e.target.nodeName == 'checkbox')
				self.checkPostable();
		}, true);
		
		this.elmPost = notification.getElementsByTagName('button')[0];
		this.elmPost.addEventListener('command', bind('post', this), true);
		this.checkPostable();
		
		this.prepareTags();
		
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
		
		var tagProvider = getPref('tagProvider');
		if(tagProvider){
			elmTags.candidates = QuickPostForm.candidates;
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
					elmTags.candidates = QuickPostForm.candidates = zip(readings, tags).map(function(cand){
						return {
							reading : cand[0],
							value : cand[1],
						}
					});
				});
			});
		}
		
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
									<label value={ps.item} />
								</row>
								<row>
									<label value="URL"/>
									<label value={ps.itemUrl} />
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
									<label value={ps.item} />
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
									<label value={ps.item} />
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
									<label value={ps.item} />
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


function selectElement(doc){
	var deferred = new Deferred();
	doc = doc || currentDocument();
	
	var target;
	function onMouseOver(e){
		target = e.target;
		target.originalBackground = target.style.background;
		target.style.background = selectElement.TARGET_BACKGROUND;
	}
	function onMouseOut(e){
		unpoint(e.target);
	}
	function onClick(e){
		cancel(e);
		
		finalize();
		deferred.callback(target);
	}
	function onKeyDown(e){
		cancel(e);
		
		switch(keyString(e)){
		case 'ESCAPE':
			finalize();
			deferred.cancel();
			return;
		}
	}
	function unpoint(elm){
		if(elm.originalBackground!=null){
			elm.style.background = elm.originalBackground;
			elm.originalBackground = null;
		}
	}
	function finalize(){
		doc.removeEventListener('mouseover', onMouseOver, true);
		doc.removeEventListener('mouseout', onMouseOut, true);
		doc.removeEventListener('click', onClick, true);
		doc.removeEventListener('keydown', onKeyDown, true);
		
		unpoint(target);
	}
	
	doc.addEventListener('mouseover', onMouseOver, true);
	doc.addEventListener('mouseout', onMouseOut, true);
	doc.addEventListener('click', onClick, true);
	doc.addEventListener('keydown', onKeyDown, true);
	
	return deferred;
}
selectElement.TARGET_BACKGROUND = '#888';


function selectRegion(doc){
	var deferred = new Deferred();
	doc = doc || currentDocument();
	
	doc.documentElement.style.cursor = 'crosshair';
	
	var style = doc.createElement('style');
	style.innerHTML = <><![CDATA[
		* {
			cursor: crosshair !important;
			-moz-user-select: none;
		}
	]]></>;
	doc.body.appendChild(style);
	
	var region, p, d, moving, square;
	function mouse(e){
		return {
			x: e.clientX, 
			y: e.clientY
		};
	}
	
	function onMouseMove(e){
		var to = mouse(e);
		
		if(moving){
			p = {
				x: Math.max(to.x - d.w, 0), 
				y: Math.max(to.y - d.h, 0)
			};
			setElementPosition(region, p);
		}
		
		d = {
			w: to.x - p.x, 
			h: to.y - p.y
		};
		if(square){
			var s = Math.min(d.w, d.h);
			d = {w: s, h: s};
		}
		setElementDimensions(region, d);
	}
	
	function onMouseDown(e){
		cancel(e);
		
		p = mouse(e);
		region = doc.createElement('div');
		region.setAttribute('style', <>
			background : #888;
			opacity    : 0.5;
			position   : fixed;
			z-index    : 999999999;
			top        : {p.y}px;
			left       : {p.x}px;
		</>);
		doc.body.appendChild(region);
		
		doc.addEventListener('mousemove', onMouseMove, true);
		doc.addEventListener('mouseup', onMouseUp, true);
		doc.addEventListener('keydown', onKeyDown, true);
		doc.addEventListener('keyup', onKeyUp, true);
	}
	
	function onKeyDown(e){
		cancel(e);
		
		switch(keyString(e)){
		case 'SHIFT': square = true; return;
		case 'SPACE': moving = true; return;
		case 'ESCAPE':
			finalize();
			deferred.cancel();
			return;
		}
	}
	
	function onKeyUp(e){
		cancel(e);
		
		switch(keyString(e)){
		case 'SHIFT': square = false; return;
		case 'SPACE': moving = false; return;
		}
	}
	
	function onMouseUp(e){
		p = getElementPosition(region);
		finalize();
		
		// FIXME: 暫定/左上方向への選択不可/クリックとのダブルインターフェース未実装
		if(!d || d.w<0 || d.h<0){
			deferred.cancel();
			return;
		}
		
		deferred.callback({
			position: p,
			dimensions: d,
		});
	}
	
	function finalize(){
		doc.removeEventListener('mousedown', onMouseDown, true);
		doc.removeEventListener('mousemove', onMouseMove, true);
		doc.removeEventListener('mouseup', onMouseUp, true);
		doc.removeEventListener('keydown', onKeyDown, true);
		doc.removeEventListener('keyup', onKeyUp, true);
		
		doc.documentElement.style.cursor = '';
		
		removeElement(region);
		removeElement(style);
	}
	
	doc.addEventListener('mousedown', onMouseDown, true);
	doc.defaultView.focus();
	
	return deferred;
}


// ----[Shortcutkey]-------------------------------------------------
var shortcutkeys = {};
forEach({
	'shortcutkey.quickPost.link' : function(e){
		cancel(e);
		
		var win = getMostRecentWindow().getBrowser().contentWindow;
		var doc = win.document;
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
		
		var win = getMostRecentWindow().getBrowser().contentWindow;
		var doc = win.document;
		new QuickPostForm({
			type    : 'regular',
			page    : doc.title,
			pageUrl : win.location.href,
		}).show();
	},
}, function(pair){
	var key = getPref(pair[0]);
	if(key)
		shortcutkeys[key] = {
			execute : pair[1],
		};
});
