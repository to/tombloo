// connectされるオブジェクト(signalを送る方)は必ずunload時にdisconnectAllをしてオブサーバーをクリアする
// ----[utility]-------------------------------------------------
'BOX VBOX HBOX SPACER LABEL TEXTBOX IMAGE DESCRIPTION TOOLTIP BUTTON'.split(' ').forEach(function(tag){
	this[tag] = bind(E, null, tag.toLowerCase());
});

function getElement(id){
	return (typeof(id) == 'string')? document.getElementById(id) : id;
}

// ----[DialogPanel]----------------------------------------------------
function DialogPanel(position, message){
	var self = this;
	window.addEventListener('unload', function(){
		disconnectAll(self);
	}, false);
	
	this.elmWindow = getElement('window');
	this.elmBase = getElement('base');
	if(message){
		// 横に伸びすぎずテキストも選択できるためtextbox要素を使う
		this.elmMessage = getElement('message');
		
		this.elmMessage.setAttribute('rows', message.split('\n').length);
		this.elmMessage.style.display = 'inherit';
		this.elmMessage.value = message;
	}
	
	this.formPanel = new FormPanel(this);
	this.formPanel.show();
	
	connect(this.formPanel, 'post', this, 'close');
	
	this.elmWindow.addEventListener('click', dynamicBind('onClick', this), false);
	this.elmWindow.addEventListener('draggesture', dynamicBind('onDragStart', this), false);
	this.elmWindow.addEventListener('mousedown', dynamicBind('onMouseDown', this), false);
	this.elmWindow.addEventListener('mouseup', dynamicBind('onMouseUp', this), false);
	this.elmWindow.addEventListener('mousemove', dynamicBind('onMouseMove', this), false);
	this.elmWindow.addEventListener('mouseout', dynamicBind('onMouseOut', this), false);
	
	window.addEventListener('keydown', bind('onKeydown', this), true);
	
	// 不可視にして描画を隠す
	// #14 Linuxの場合は透明から復帰できない問題があるため透明にしない
	if(!navigator.platform.contains('Linux'))
		self.elmWindow.style.opacity = 0;
	
	// コントロールと画像のロード後に体裁を整える
	window.addEventListener('load', function(){
		// 画像のロードとサイズ取得を待つ(大抵の場合キャッシュされているので正常に処理される)
		setTimeout(function(){
			// FIXME: エラーメッセージがあるときに見切れる問題に対応
			window.addEventListener('resize', bind('onWindowResize', self), true);
			
			self.onWindowResize();
			
			// FIXME: 状態の復元コードを移動
			// 各オブジェクトが自分の状態を保存/ロードできるように
			var state = QuickPostForm.dialog[ps.type] || {};
			if(state.expandedForm)
				self.formPanel.toggleDetail();
			
			if(state.expandedTags)
				self.formPanel.tagsPanel.toggleSuggestion();
			
			if(ps.type != 'photo' && state.size)
				window.resizeTo(state.size.width, state.size.height);
			
			self.focusToFirstControl();
			
			if(position){
				// ポスト先の一番最初のアイコンの上にマウスカーソルがあるあたりへ移動
				var win = getMostRecentWindow();
				var box = self.formPanel.postersPanel.elmPanel.boxObject;
				window.moveTo(
					Math.min(win.screenX + win.outerWidth - window.innerWidth,  Math.max(win.screenX, position.x - (box.x + 16))), 
					Math.min(win.screenY + win.outerHeight - window.innerHeight, Math.max(win.screenY, position.y - (box.y + (box.height / 2))))
				);
			} else {
				with(QuickPostForm.dialog.snap)
					self.snapToContentCorner(top, left);
			}
			
			self.elmWindow.style.opacity = 1;
		}, 0);
	}, true);
}

DialogPanel.shortcutkeys = {};
DialogPanel.shortcutkeys[KEY_ACCEL + ' + RETURN'] = function(e){
	cancel(e);
	dialogPanel.formPanel.post();
}

DialogPanel.shortcutkeys[KEY_ACCEL + ' + W'] = function(e){
	cancel(e);
	dialogPanel.close();
}

forEach(range(1, 10), function(i){
	DialogPanel.shortcutkeys[KEY_ACCEL + ' + ' + i] = function(){
		var panel = dialogPanel.formPanel.postersPanel;
		panel.toggle(panel.icons[i-1]);
	};
});

// ダイレクト単独ポスト
forEach(range(1, 10), function(i){
	DialogPanel.shortcutkeys['ALT + ' + i] = function(e){
		cancel(e);
		
		var panel = dialogPanel.formPanel.postersPanel;
		panel.allOff();
		panel.toggle(panel.icons[i-1]);
		
		// 何が選択されたか見えるように
		setTimeout(function(){
			dialogPanel.formPanel.post();
		}, 300);
	};
});

DialogPanel.prototype = {
	close : function(){
		var box = this.elmBase.boxObject;
		QuickPostForm.dialog[ps.type] = {
			expandedForm : this.formPanel.expanded,
			expandedTags : (this.formPanel.tagsPanel) ? this.formPanel.tagsPanel.expanded : false,
			size : {
				width : box.width,
				height : box.height,
			},
		};
		
		// フォーカスを戻すと複数フォームを開いていたときに背後に回ってしまう
		// getMostRecentWindow().focus();
		
		window.close();
	},
	
	focusToFirstControl : function(){
		window.focus();
		document.commandDispatcher.advanceFocus();
	},
	
	snapToContentCorner : function(top, left){
		QuickPostForm.dialog.snap = {
			top : top,
			left : left,
		}
		
		var baseBox = this.elmBase.boxObject;
		var browserBox = getMostRecentWindow().getBrowser().selectedBrowser.boxObject;
				
		var x = left? 
			browserBox.screenX : 
			(browserBox.screenX + browserBox.width - 16) - baseBox.width;
		
		var y = top? 
			browserBox.screenY : 
			(browserBox.screenY + browserBox.height) - baseBox.height;
		
		window.moveTo(x, y);
	},
	
	onWindowResize : function(){
		// 循環イベントの発生を回避する
		if(this.selfResizing){
			this.selfResizing = false;
			return
		}
		
		signal(this, 'resize', this.resizeDirection);
		delete this.resizeDirection;
		
		this.sizeToContent();
	},
	
	sizeToContent : function(shrink){
		// トグル操作では常にシュリンクするため引数が渡ってくる。
		// ウィンドウリサイズ操作では、タイプや状態により異なるためプロパティを見る。
		shrink = shrink || this.formPanel.shrink;
		
		// 一度flexを解除しないと画像下の余白を縮められない
		if(shrink)
			this.elmBase.removeAttribute('flex');
		
		var box = this.elmBase.boxObject;
		if(box.width != window.innerWidth || box.height != window.innerHeight){
			this.selfResizing = true;
			window.resizeTo(box.width, box.height);
		}
		
		if(shrink)
			this.elmBase.setAttribute('flex', '1');
	},
	
	onKeydown : function(e){
		var proc = DialogPanel.shortcutkeys[keyString(e)];
		if(proc)
			proc(e);
	},
}

State.make(DialogPanel, {
	normal : {
		onMouseDown : function(e){
			var cursor = window.getComputedStyle(e.target, '').cursor;
			var match = /(.+)-resize/.exec(cursor);
			if(match){
				this.resizeDirection = match[1];
				this.changeState('resizing');
			}
		},
		
		onChangeState : function(){
			this.elmWindow.style.cursor = '';
		},
		
		onDragStart : function(e){
			var cursor = window.getComputedStyle(e.target, '').cursor;
			if(cursor != '-moz-grab')
				return;
			
			this.grab = {
				x : e.clientX,
				y : e.clientY,
			}
			
			this.changeState('dragging');
		},
		
		onClick : function(e){
			var cursor = window.getComputedStyle(e.target, '').cursor;
			if(cursor == '-moz-grab'){
				// ウィンドウにフォーカスを移しラベル編集を終了させる
				cancel(e);
				this.elmWindow.focus();
			}
			
			var match = (/.+snap-(.+)-(.+)\./).exec(cursor);
			if(match){
				cancel(e);
				this.snapToContentCorner(match[1] == 'top', match[2] == 'left');
			}
		},
	},
	
	dragging : {
		onChangeState : function(){
			this.elmWindow.style.cursor = '-moz-grabbing';
		},
		
		onMouseMove : function(e){
		  window.moveTo(e.screenX - this.grab.x, e.screenY - this.grab.y);
		},
		
		onMouseOut : function(e){
			if(e.relatedTarget.tagName=='window')
				this.changeState('normal');
		},
		
		onMouseUp : function(e){
			cancel(e);
			
			this.changeState('normal');
		},
	},
	
	resizing : {
		onMouseMove : function(e){
			// 画像のみが表示されている場合は小さくなって良い
			if(this.formPanel.shrink)
				return;
			
			// 最小サイズ以下に縮むのを防ぐ
			var box = this.elmBase.boxObject;
			if(box.height > window.innerHeight)
				window.resizeTo(box.width, box.height);
		},
		
		onMouseUp : function(e){
			this.changeState('normal');
		},
	},
}, 'normal');


// ----[FormPanel]----------------------------------------------------
function FormPanel(dialogPanel){
	var self = this;
	window.addEventListener('unload', function(){
		disconnectAll(self);
	}, false);
	
	this.dialogPanel = dialogPanel;
	this.elmForm = getElement('form');
	this.elmToggleDetail = getElement('toggleDetail');
	this.elmToggleDetail.setAttribute('tooltiptext', getMessage('label.showDetail'));
	
	getElement('type').value = ps.type.capitalize();
	getElement('typeIcon').src = 'chrome://tombloo/skin/' + ps.type + '.png';
	getElement('post').addEventListener('command', bind('post', this), true);
	
	this.elmToggleDetail.addEventListener('click', bind('toggleDetail', this), true);
	
	this.postersPanel = new PostersPanel();
}

FormPanel.prototype = {
	labels : {
		item        : 'Title',
		itemUrl     : 'URL',
		tags        : 'Tags',
		description : 'Description',
	},
	
	types : {
		regular : {
			item        : {toggle : true},
			tags        : {toggle : true},
			description : {
				attributes : {rows : 7},
			},
		},
		link : {
			item        : {type : 'label'},
			itemUrl     : {toggle : true},
			tags        : {},
			description : {},
		},
		quote : {
			item        : {toggle : true},
			itemUrl     : {toggle : true},
			body        : {
				attributes : {
					flex : 1,
					rows : 4,
				},
			},
			tags        : {toggle : true},
			description : {toggle : true},
		},
		photo : {
			item        : {toggle : true},
			itemUrl     : {type : 'photo'},
			tags        : {toggle : true},
			description : {toggle : true},
		},
		video : {
			item        : {type : 'label'},
			itemUrl     : {toggle : true},
			tags        : {toggle : true},
			description : {toggle : true},
		},
    conversation: {
			item        : {type : 'label'},
			itemUrl     : {toggle : true},
			tags        : {toggle : true},
			description : {toggle : true},
    },
	},
	
	toggles : [],
	fields : {},
	
	expanded : false,
	
	get shrink(){
		// photoタイプの縮小時だけシュリンクさせる
		// 他の場合はDescriptionBoxをフレックスにするためシュリンクしない
		return ps.type=='photo' && !this.expanded;
	},
	
	show : function(){
		this.createForm();
	},
	
	post : function(){
		var checked = this.postersPanel.checked;
		if(!checked.length)
			return;
		
		items(this.fields).forEach(function([name, field]){
			// 値が変更されていない場合はフレーバーを保つため元の値を上書きしない
			if(field.value != null && (''+ps[name]) != field.value)
				ps[name] = field.value;
		});
		
		Tombloo.Service.post(ps, checked);
		
		signal(this, 'post');
	},
	
	populateFields : function(ps){
		if(!ps)
			return;
		
		var self = this;
		items(ps).forEach(function([name, value]){
			var field = self.fields[name];
			if(!field || !value)
				return;
			
			field.value = value;
		});
	},
	
	createForm : function(){
		var elmForm = this.elmForm;
		var self = this;
		var controls = this.controls;
		
		withDocument(document, function(){
			items(self.types[ps.type]).forEach(function([name, def]){
				def.attributes = def.attributes || {};
				
				var value = (ps[name] != null)? ps[name] : '';
				var label = self.labels[name] || ps.type.capitalize();
				var attrs = update({
					id        : name,
					name      : name,
					value     : value.join? value.join(' ') : value,
					emptytext : label,
					hidden    : !!def.toggle,
				}, def.attributes);
				
				var elm, field;
				if(name == 'tags'){
					elm = elmForm.appendChild(VBOX(attrs));
					field = self.tagsPanel = new TagsPanel(elm, self);
					
				} else if(name == 'description'){
					elm = elmForm.appendChild(VBOX(attrs, {flex : 1}));
					field = self.descriptionBox = new DescriptionBox(elm, def.attributes, self.dialogPanel);
					
				} else {
					switch(def.type){
					case 'label':
						elm = elmForm.appendChild(BOX(attrs));
						field = new EditableLabel(elm);
						break;
						
					case 'photo':
						var src = ps.itemUrl || (createURI(ps.file).spec + '?' + Date.now());
						
						// flexを大きくし詳細ボックスとバランスを取る
						elm = elmForm.appendChild(BOX(attrs, {flex : 10}));
						field = new FlexImage(elm, src, self.dialogPanel);
						break;
						
					default:
						field = elm = elmForm.appendChild(TEXTBOX(attrs, {
							multiline : !!attrs.rows,
							rows : attrs.rows || 1,
						}));
						break;
					}
				}
				
				if(field)
					self.fields[name] = field;
				
				if(attrs.hidden){
					self.toggles.push(function(){
						elm.hidden = !elm.hidden;
					});
				} else if(def.type == 'label'){
					self.toggles.push(function(){
						field.editable = !field.editable;
					});
				}
			});
		});
	},
	
	addWidgetToTitlebar : function(elm){
		addElementClass(elm, 'widget');
		insertSiblingNodesBefore(document.getElementById('titleSpace'), elm);
		return elm;
	},
	
	toggleDetail : function(){
		toggleElementClass('expanded', this.elmToggleDetail);
		this.expanded = hasElementClass(this.elmToggleDetail, 'expanded');
		this.elmToggleDetail.setAttribute('tooltiptext', 
			getMessage('label.' + (this.expanded? 'hideDetail' : 'showDetail')));
		
		this.lock();
		forEach(this.toggles, function(f){f()});
		this.dialogPanel.sizeToContent(true);
		this.unlock();
	},
	
	lock : function(){
		this.descriptionBox.lock();
	},
	
	unlock : function(){
		this.descriptionBox.unlock();
	},
}


// ----[EditableLabel]-------------------------------------------------
function EditableLabel(elmBox){
	var self = this;
	withDocument(document, function(){
		elmBox = getElement(elmBox);
		
		self.elmLabel = elmBox.appendChild(LABEL({
			// cssで指定されているinheritを上書きするためimportantを付加する
			style : 'cursor: text !important;',
			crop  : 'end',
			value : elmBox.getAttribute('value'),
		}));
		
		self.elmTextbox = elmBox.appendChild(TEXTBOX({
			hidden : true,
			value : elmBox.getAttribute('value'),
			emptytext : elmBox.getAttribute('emptytext'),
		}));
		
		self.elmLabel.addEventListener('click', bind('onClick', self), true);
		window.addEventListener('DOMContentLoaded', bind('onLoad', self), false);
	});
}

EditableLabel.prototype = {
	set value(value){
		return this.elmTextbox.value = value;
	},
	
	get value(){
		return this.elmTextbox.value;
	},
	
	get editable(){
		return this._editable;
	},
	
	set editable(value){
		value? this.enable() : this.disable();
		
		return this._editable = value;
	},
	
	onLoad : function(){
		// XBLロード後でないと取得できない
		this.elmInput = document.getAnonymousElementByAttribute(this.elmTextbox, 'anonid', 'input');
		
		// textboxはblurの発生が異常
		this.elmInput.addEventListener('blur', bind('onBlur', this), true);
	},
	
	onBlur : function(){
		if(this.editable)
			return;
		
		this.disable();
	},
	
	onClick : function(e){
		cancel(e);
		
		this.enable();
		this.elmInput.focus();
	},
	
	enable : function(){
		this.elmTextbox.hidden = false;
		this.elmLabel.hidden = true;
	},
	
	disable : function(){
		this.elmLabel.value = this.elmTextbox.value;
		
		this.elmTextbox.hidden = true;
		this.elmLabel.hidden = false;
	},
}


// ----[TagsPanel]-------------------------------------------------
function TagsPanel(elmPanel, formPanel){
	var self = this;
	this.formPanel = formPanel;
	this.tagProvider = getPref('tagProvider');
	this.suggest = (this.tagProvider && ps.type == 'link');
	
	withDocument(document, function(){
		self.elmPanel = elmPanel = getElement(elmPanel);
		self.elmCompletion = elmPanel.appendChild(BOX({
			emptytext : elmPanel.getAttribute('emptytext'),
			class : 'completion',
		}));
	});
		
	if(!self.tagProvider)
		return;
	
	self.elmCompletion.addEventListener('construct', function(){
		self.elmTextbox = self.elmCompletion.textbox;
		
		self.elmCompletion.autoComplete = getPref('tagAutoComplete');
		self.elmCompletion.candidates = QuickPostForm.candidates;
		
		self.value = elmPanel.getAttribute('value');
		
		if(self.suggest){
			withDocument(document, function(){
				self.elmSuggestion = self.elmPanel.appendChild(DESCRIPTION({
					hidden : true,
					style  : 'display: none',
				}));
				self.elmToggleSuggestion = IMAGE({
					class  : 'image-button button', 
					hidden : true,
				});
				self.elmLoading = IMAGE({
					class : 'loading',
				});
			});
			
			insertSiblingNodesAfter(self.elmTextbox.input, self.elmLoading);
			insertSiblingNodesAfter(self.elmTextbox.input, self.elmToggleSuggestion);
			
			self.elmTextbox.addEventListener('input', bind('refreshCheck', self), true);
			self.elmTextbox.addEventListener('terminate', bind('refreshCheck', self), true);
			
			self.elmToggleSuggestion.addEventListener('click', bind('toggleSuggestion', self), true);
			
			new ChekboxPanel(self.elmSuggestion, self);
		}
		
		// linkタイプの場合、既ブックマークかの判定も行うため必ずタグを取得する
		// それ以外のタイプの場合、キャッシュがあればそれを使う
		if(self.suggest || !QuickPostForm.candidates.length){
			models[self.tagProvider].getSuggestions(ps.itemUrl).addCallback(function(res){
				self.arrangeSuggestions(res);
				self.setTags(res.tags);
				
				if(self.suggest){
					self.showSuggestions(res);
				}
				
				if(res.duplicated){
					self.formPanel.populateFields(res.form);
					self.showBookmarked(res.editPage);
				}
			}).addErrback(function(e){
				setTimeout(function(){
					alert(self.tagProvider + ': ' + e.message);
				}, 50);
				error(e);
			}).addBoth(function(){
				self.finishLoading();
			});
		}
	}, false);
	
	connect(formPanel, 'post', self, 'addNewTags');
}

TagsPanel.prototype = {
	elmTags : {},
	
	set value(values){
		return this.elmCompletion.value = joinText(values, ' ');
	},
	
	get value(){
		return this.elmCompletion.values;
	},
	
	arrangeSuggestions : function(res){
		function toTable(arr){
			return reduce(function(memo, i){
				memo[i.toLowerCase()] = i;
				return memo;
			}, arr, {});
		}
		
		var pops = res.popular || [];
		
		var recos = res.recommended || [];
		var recoTable = toTable(recos);
		
		var tags = this.sort(res.tags || []).map(itemgetter('name'));
		var tagTable = toTable(tags);
		
		// 全てのポピュラーを繰り返す(優先順位を保つ)
		for(var i=0,len=pops.length; i<len; i++){
			var pop = pops[i].toLowerCase();
			
			if(pop in tagTable){
				// 自分のタグと重複しているものは取り除く
				pops.splice(i--, 1);
				len--;
				
				// おすすめに無ければ追加する
				if(!(pop in recoTable))
					recos.push(tagTable[pop]);
			}
		}
		
		res.recommended = recos;
		res.popular = pops;
		res.tags = tags;
	},
	
	showSuggestions : function(res){
		var self = this;
		withDocument(document, function(){
			
			// inputイベントで高速にチェックをする必要があるためハッシュで持つ
			self.elmTags = {};
			
			var i = 0;
			for each(var prop in ['recommended', 'popular']){
				if(i++ && self.elmTags.length)
					self.elmSuggestion.appendChild(SPACER());
				
				res[prop].forEach(function(tag){
					// この処理でパネルが延びるがロックしないため詳細ボックスが縮む。
					// ロード時に開く場合、詳細ボックスはタグパネルの大きさも含んでいるため、
					// 最終的に前回と同程度の大きさと間隔に復元される。
					self.elmTags[tag] = self.elmSuggestion.appendChild(LABEL({
						value : tag,
						class : 'button ' + prop
					}));
				});
			}
			self.refreshCheck();
		});
	},
	
	showBookmarked : function(editPage){
		var self = this;
		withDocument(document, function(){
			var elmStar = self.formPanel.addWidgetToTitlebar(IMAGE({
				tooltiptext : getMessage('label.bookmarked'),
				src : 'chrome://tombloo/skin/star.png',
			}));
			
			if(editPage){
				elmStar.style.cursor = 'pointer';
				elmStar.addEventListener('click', function(){
					addTab(editPage);
				}, true);
			}
		});
	},
	
	finishLoading : function(){
		removeElement(this.elmLoading);
		if(!isEmpty(this.elmTags)){
			this.elmToggleSuggestion.hidden = false;
			
			// おすすめパネル表示によりオーバーフローしないようにする
			this.elmSuggestion.style.display = '';
			this.formPanel.dialogPanel.sizeToContent();
		}
	},
	
	setTags : function(tags){
		// 一度キャッシュを行うと以降はそれが更新されるため不要になる
		// 形態素解析APIへのアクセスを減らす
		if(QuickPostForm.candidates.length)
			return;
		
		var self = this;
		this.comvertToCandidates(tags).addCallback(function(cands){
			self.elmCompletion.candidates = cands;
			QuickPostForm.candidates = cands;
		});
	},
	
	sort : function(tags){
		return tags.sort(function(a, b){
			return (b.frequency != a.frequency)? 
				compare(b.frequency, a.frequency) : 
				compare(a.name, b.name);
		});
	},
	
	comvertToCandidates : function(tags){
		// 各タグサービスで使われてるデリミタを合成
		var source = tags.join(' [');
		var d;
		
		if(source.includesFullwidth()){
			d = Yahoo.getRomaReadings(source).addCallback(function(result){
				return result.join('').split(' [');
			});
		} else {
			d = succeed(tags)
		}
		d.addCallback(function(readings){
			return zip(readings, tags).map(function([reading, tag]){
				return {
					reading : reading,
					value : tag,
				}
			});
		})
		
		return d;
	},
	
	addNewTags : function(){
		var tags = this.elmCompletion.newWords;
		if(!tags || !tags.length)
			return;
		
		this.comvertToCandidates(tags).addCallback(function(newCands){
			var memo = {};
			var cands = []
			QuickPostForm.candidates.concat(newCands).forEach(function(cand){
				if(memo[cand.value])
					return;
				
				cands.push(cand);
				memo[cand.value] = true;
			});
			
			QuickPostForm.candidates = cands;
		});
	},
	
	refreshCheck : function(){
		var self = this;
		
		// 増えたタグを処理する
		var tags = {};
		this.value.forEach(function(tag){
			var elmTag = self.elmTags[tag];
			if(elmTag)
				addElementClass(elmTag, 'used');
			tags[tag] = null;
		});
		
		// 減ったタグを処理する
		items(self.elmTags).forEach(function([tag, elmTag]){
			if(!(tag in tags))
				removeElementClass(elmTag, 'used');
		});
	},
	
	toggleSuggestion : function(){
		toggleElementClass('expanded', this.elmToggleSuggestion);
		this.expanded = hasElementClass(this.elmToggleSuggestion, 'expanded');
		
		this.formPanel.lock();
		this.elmSuggestion.hidden = !this.expanded;
		this.formPanel.dialogPanel.sizeToContent(true);
		this.formPanel.unlock();
	},
	
	toggleTag : function(elmTag){
		var used = hasElementClass(elmTag, 'used');
		var word = elmTag.value;
		if(used){
			removeElementClass(elmTag, 'used');
			this.elmTextbox.removeWord(word);
		} else {
			addElementClass(elmTag, 'used');
			this.elmTextbox.injectCandidate(word, true, false);
		}
	},
	
	// ChekboxPanel
	onCheck : function(e){
		if(e.target.tagName!='label')
			return;
		
		this.toggleTag(e.target);
	},
	
	onCarry : function(e){
		if(e.target.tagName=='label')
			this.toggleTag(e.target);
	},
}


// ----[FlexImage]-------------------------------------------------
function FlexImage(elmBox, src, dialogPanel){
	var self = this;
	
	withDocument(document, function(){
		elmBox = getElement(elmBox);
		
		self.elmHbox = elmBox.appendChild(HBOX({flex : 1}));
		self.elmImage = IMAGE({src : src});
		self.elmSize = LABEL({class : 'meta'});
		self.elmVbox = self.elmHbox.appendChild(VBOX(
			self.elmImage, {pack : 'center'}, 
			HBOX(SPACER({flex : 1}), self.elmSize)));
		
		self.elmImage.style.minHeight = '0';
		self.elmImage.style.minWidth = '0';
		
		loadImage(src).addCallback(function(img){
			self.naturalWidth = img.naturalWidth;
			self.naturalHeight = img.naturalHeight;
			
			self.elmSize.value = self.naturalWidth + ' * ' + self.naturalHeight;
		});
	});
	
	connect(dialogPanel, 'resize', this, 'fit');
}

FlexImage.prototype = {
	fit : function(dir){
		// 画像以外のラベルや余白などの高さを取得
		var lh = (this.elmVbox.boxObject.height - parseInt(this.elmImage.style.maxHeight)) || 0;
		
		// 測量のため画像を消しボックスを縦に伸縮させる(横は自動的に伸びる)
		this.elmImage.style.maxHeight = '0';
		this.elmVbox.style.maxHeight = '100000px';
		
		// ボックスは一定量以上縮まないためウィンドウのプロパティも併用する
		var bw = Math.min(this.elmHbox.boxObject.width, window.outerWidth);
		var bh = Math.min(this.elmVbox.boxObject.height, window.outerHeight) - lh;
		
		var nw = this.naturalWidth;
		var nh = this.naturalHeight;
		
		// 上下左右を掴んでリサイズを行った場合は、常にそちらを優先する
		var ratio = Math.min(1,
			(dir=='w' || dir=='e')? bw/nw : 
			(dir=='n' || dir=='s')? bh/nh : Math.min(bh/nh, bw/nw));
		
		var width = Math.ceil(nw * ratio);
		var height = Math.ceil(nh * ratio);
		
		this.elmImage.style.maxWidth = width + 'px';
		this.elmImage.style.maxHeight = height + 'px';
		this.elmVbox.style.maxHeight = (height + lh) + 'px';
		
		if(bw > width){
			this.elmHbox.setAttribute('pack', 'center');
		} else {
			// 小さなボックスで中央揃えをすると異常になるため回避する
			this.elmHbox.removeAttribute('pack');
		}
	},
}


// ----[DescriptionBox]-------------------------------------------------
function DescriptionBox(elmBox, attrs, dialogPanel){
	var self = this;
	window.addEventListener('unload', function(){
		disconnectAll(self);
	}, false);
	
	withDocument(document, function(){
		// XBLをロードしinput要素を取得するため一度表示する
		elmBox = self.elmBox = getElement(elmBox);
		self.hidden = elmBox.hidden;
		elmBox.hidden = false;
		
		self.dialogPanel = dialogPanel;
		self.minHeight = parseInt(window.getComputedStyle(elmBox, '').minHeight);
		self.maxHeight = window.screen.height / 2;
		
		self.elmDescription = elmBox.appendChild(TEXTBOX({
			emptytext : elmBox.getAttribute('emptytext'),
			value     : elmBox.getAttribute('value'),
			multiline : true,
			rows      : attrs.rows || 4,
			flex      : 1,
		}));
		
		self.elmLength = LABEL({
			class : 'meta', 
			value : 0,
		});
		
		elmBox.appendChild(HBOX(
			SPACER({flex : 1}), 
			self.elmLength));
		
		self.elmDescription.addEventListener('input', bind('onInput', self), true);
		
		connect(self.dialogPanel, 'resize', self, 'onResize');
		
		window.addEventListener('DOMContentLoaded', bind('onLoad', self), false);
		
		var selection = broad(window.opener.content.getSelection());
		selection.addSelectionListener(self);
		window.addEventListener('unload', function(){
			// FIXME: 対象ウィンドウが先に閉じたときにチェック
			selection.removeSelectionListener(self);
		}, true);
	});
}

DescriptionBox.prototype = {
	onLoad : function(){
		// XBLロード後でないと取得できない
		this.elmInput = document.getAnonymousElementByAttribute(this.elmDescription, 'anonid', 'input');
		this.elmInput.style.overflow = 'hidden';
		
		// input要素の取得が終わったら初期設定の非表示状態に戻す
		this.elmBox.hidden = this.hidden;
		
		this.elmContext = document.getAnonymousElementByAttribute(
			this.elmInput.parentNode, 'anonid', 'input-box-contextmenu');
		this.elmContext.addEventListener('popupshowing', bind('onPopupShowing', this), true);
	},
	
	onPopupShowing : function(event){
		if(event.eventPhase != Event.AT_TARGET)
			return;
		
		var self = this;
		
		if(this.customMenus)
			forEach(this.customMenus, removeElement);
		this.customMenus = [];
		
		var df = document.createDocumentFragment();
		(function(menus, parent){
			var me = arguments.callee;
			menus.forEach(function(menu){
				var elmItem = appendMenuItem(parent, menu.name, menu.icon, !!menu.children);
				self.customMenus.push(elmItem);
				
				if(menu.execute){
					elmItem.addEventListener('command', function(){
						var d = menu.execute(self.elmDescription, self);
						
						// 非同期処理の場合、カーソルを砂時計にする
						if(d instanceof Deferred){
							self.elmInput.style.cursor = 'wait';
							d.addBoth(function(){
								self.elmInput.style.cursor = '';
							});
						}
					}, true);
				}
				
				// サブメニューがあるか?
				if(menu.children)
					me(menu.children, elmItem.appendChild(document.createElement('menupopup')));
			});
		})(QuickPostForm.descriptionContextMenus, df);
		self.customMenus.push(appendMenuItem(df, '----'));
		
		this.elmContext.insertBefore(df, this.elmContext.firstChild);
	},
	
	set value(value){
		var res = this.elmDescription.value = value;
		this.onInput();
		return res;
	},
	
	get value(){
		return this.elmDescription.value;
	},
	
	replaceSelection : function(text){
		var elm = this.elmDescription;
		var value = elm.value;
		var start = elm.selectionStart;
		
		this.value = 
			value.substr(0, elm.selectionStart) + 
			text + 
			value.substr(elm.selectionEnd);
		elm.selectionStart = elm.selectionEnd = start + text.length;
	},
	
	refreshLength : function(){
		this.elmLength.value = this.elmDescription.value.length;
	},
	
	onResize : function(direction){
		// 手動でリサイズされたら延長機能を終了する
		// 見えづらいなどの理由により縮小されたときに再度拡がるのを防ぐ
		if(direction)
			this.endExpand();
	},
	
	onInput : function(){
		this.expand();
		this.refreshLength();
	},
	
	expand : function(){
		var height = this.elmInput.offsetHeight;
		var scrollHeight = this.elmInput.scrollHeight;
		if(height >= scrollHeight)
			return;
		
		height = Math.min(scrollHeight + 50, this.maxHeight);
		this.resize(height);
		
		// 最大まで拡がったら延長機能を終了する
		if(height >= this.maxHeight)
			this.endExpand();
	},
	
	endExpand : function(){
		// 簡易的にイベントハンドラを解除する
		this.expand = this.onResize = function(){};
		this.elmInput.style.overflow = 'auto';
	},
	
	resize : function(height){
		// flexのためheigtで高さを変えられない
		this.lock(height);
		this.dialogPanel.sizeToContent();
		this.unlock();
	},
	
	lock : function(height){
		if(this.locked || this.elmBox.hidden)
			return;
		
		var style = this.elmBox.style;
		style.minHeight = style.maxHeight = (height || this.elmBox.boxObject.height) + 'px';
		this.locked = true;
	},
	
	unlock : function(){
		if(!this.locked)
			return;
		
		with(this.elmBox.style){
			minHeight = this.minHeight + 'px';
			maxHeight = '10000px';
		}
		this.locked = false;
	},
	
	// FIXME: 非表示時の挙動を検討する
	// nsISelectionListener
	notifySelectionChanged : function(doc, sel, reason){
		if(sel.isCollapsed || reason != ISelectionListener.MOUSEUP_REASON)
			return;
		
		this.replaceSelection(sel.toString().trim());
		
		// 別ウィンドウのため一度ウィンドウのフォーカスも戻す
		window.focus();
		this.elmDescription.focus();
		
		// valueを変えると先頭に戻ってしまうため最後に移動し直す
		this.elmInput.scrollTop = this.elmInput.scrollHeight;
	},
}


// ----[PostersPanel]-------------------------------------------------
function PostersPanel(){
	var self = this;
	
	this.elmPanel = getElement('posters');
	this.elmButton = getElement('post');
	this.posters = new Repository(models.getEnables(ps));
	
	withDocument(document, function(){
		self.elmTooltip = self.elmPanel.appendChild(TOOLTIP());
		
		forEach(self.posters, function([name, poster]){
			var disabled = poster.config[ps.type] != 'default';
			var image = self.elmPanel.appendChild(IMAGE({
				class : 'poster button', 
				disabled : disabled,
			}));
			image.name = name;
			
			// OSXではオリジナルのツールチップを利用する
			// FIXME: 表示位置が悪いだけでは(未確認)
			if(AppInfo.OS == 'Darwin'){
				image.setAttribute('tooltiptext', name);
			}
			
			self.setIcon(image, poster, !disabled);
		});
		
		self.elmAllOff = self.elmPanel.appendChild(LABEL({
			value : getMessage('label.allOff'),
			class : 'label-button button',
		}));
		
		self.elmButton.disabled = !self.checked.length;
	});
	
	this.elmAllOff.addEventListener('click', bind('allOff', this), true);
	
	// OSXでopenPopupさせるとmouseout/mouseoverイベントが二重に発生して誤動作する
	if(AppInfo.OS != 'Darwin'){
		// マウスオーバーですぐに表示されるよう自前で用意する
		this.elmPanel.addEventListener('mouseover', bind('showTooltip', this), true);
		this.elmPanel.addEventListener('mouseout', bind('hideTooltip', this), true);
	}
	
	new ChekboxPanel(this.elmPanel, this);
}

PostersPanel.prototype = {
	get checked(){
		var self = this;
		return $x('.//*[@disabled="false"]', this.elmPanel, true).map(function(elm){
			return self.posters[elm.name];
		});
	},
	
	get icons(){
		return $x('.//xul:image', this.elmPanel, true);
	},
	
	setIcon : function(image, poster, enabled){
		var prop = (enabled)? 'ICON' : 'DISABLED_ICON';
		var src = poster[prop];
		var d;
		if(/^data:/.test(src)){
			d = succeed(src);
		} else {
			d = ((enabled)? convertToDataURL(poster.ICON) : toGrayScale(poster.ICON)).addCallback(function(src){
				return poster[prop] = src;
			});
		}
		d.addCallback(function(src){
			image.setAttribute('src', src);
		});
	},
	
	allOff : function(){
		var self = this;
		this.icons.forEach(function(image){
			self.setDisabled(image, true);
		});
	},
	
	setDisabled : function(image, disabled){
		var poster = this.posters[image.name];
		
		image.setAttribute('disabled', disabled);
				
		this.setIcon(image, poster, !disabled);
		
		this.elmButton.disabled = !this.checked.length;
	},
	
	toggle : function(image){
		this.setDisabled(image, !(image.getAttribute('disabled')=='true'));
	},
	
	showTooltip : function(e){
		var name = e.target.name;
		if(!name)
			return;
		
		this.elmTooltip.label = name;
		this.elmTooltip.openPopup(e.target, 'end_before', 0, 26, false);
	},
	
	hideTooltip : function(e){
		this.elmTooltip.hidePopup();
	},
	
	// ChekboxPanel
	onCheck : function(e){
		if((/description|label/).test(e.target.tagName))
			return true;
		
		// cancelをするとactive擬似クラスが有効にならずリアクションがなくなる
		
		// ダイレクト単独ポスト
		if(e.altKey){
			this.allOff();
			this.toggle(e.target);
			
			setTimeout(function(){
				dialogPanel.formPanel.post();
			}, 400);
			
			return true;
		}
			
		this.toggle(e.target);
	},
	
	onCarry : function(e){
		if(!(/description|label/).test(e.target.tagName))
			this.toggle(e.target);
	},
}


// ----[ChekboxPanel]-------------------------------------------------
function ChekboxPanel(elmPanel, handler){
	this.handler = handler;
	
	elmPanel.addEventListener('mousedown', dynamicBind('onMouseDown', this), true);
	elmPanel.addEventListener('mouseover', dynamicBind('onMouseOver', this), true);
	elmPanel.addEventListener('mouseup', dynamicBind('onMouseUp', this), true);
	elmPanel.addEventListener('mouseout', dynamicBind('onMouseOut', this), true);
}

State.make(ChekboxPanel, {
	mouseoutDelay : 500,
	
	normal : {
		onMouseDown : function(e){
			if(! this.handler.onCheck(e))
				this.changeState('dragging');
		},
	},
	
	dragging : {
		onMouseUp : function(){
			this.changeState('normal');
		},
		
		onMouseOut : function(e){
			if(!e.relatedTarget || e.relatedTarget.tagName != 'vbox')
				return;
			
			// アイコンが小さいため外れてもすぐにドラッグを終了しない
			// アイコンが2行になった時、縦にドラッグすると一度マウスアウトするため
			var self = this;
			this.timerId = setTimeout(function(){
				self.changeState('normal');
			}, this.mouseoutDelay);
			
			this.changeState('waitForCancel');
		},
		
		onMouseOver : function(e){
			this.handler.onCarry(e);
		},
	},
	
	waitForCancel : {
		onMouseOver : function(e){
			clearTimeout(this.timerId);
			this.changeState('dragging');
		},
	},
}, 'normal');
