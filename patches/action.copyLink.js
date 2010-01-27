// ----[Usage]--------------------------------------------------
// click         : copy link
// shift + click : copy links of all tabs
// right click   : remove format

(function(){
	var formats;
	var NAME = 'Copy Link';
	var DEFAULT_FORMATS = [
		{name : 'Plain Text', format : '%title%\n%url%'},
		{name : 'Forum Code', format : '[url=%url%]%title%[/url]'},
		{name : 'HTML',       format : '<a href="%url%">%title%</a>'},
		{name : 'Markdown',   format : '[%title%](%url%)'},
		{name : 'Hatena',     format : '[%url%:title=%title%]'},
		{name : 'qwik',       format : '[[%title%|%url%]]'},
	];
	var children = [
		{name : '----'},
		{
			name    : 'Add format',
			execute : function(){
				var res = input({
					'Format Definition' : 'Name,%title% %url%'
				}, 'Copy URL: Add format');
				if(!res)
					return;
				
				res = values(res)[0].match('(.*?),(.*)').slice(1);
				formats.push({name:res[0], format:res[1]});
				
				saveFormats();
			}
		}
	];
	
	Tombloo.Service.actions.register({
		name : NAME,
		type : 'context',
		icon : 'chrome://tombloo/skin/copy.gif',
		DEFAULT_FORMATS : DEFAULT_FORMATS,
		children : children,
		check : function(ctx){
			this.name = NAME + ' - ' + ((ctx.onLink)? 'link' : 'page');
			return true;
		},
	}, '----');
	
	loadFormats();
	
	function saveFormats(){
		setPref('action.copyUrl.formats', uneval(formats));
		updateMenus();
	}
	
	function loadFormats(){
		formats = getPref('action.copyUrl.formats');
		formats = (formats)?
			eval(formats) : DEFAULT_FORMATS;
		
		updateMenus();
	}
	
	function copyUrl(ctx, format){
		// 右クリック
		if(ctx.originalEvent.button != 0){
			if(input('Remove "' + format.name + '" format?', 'Copy URL: Remove format')){
				formats.splice(formats.indexOf(format), 1);
				
				saveFormats();
			}
			return;
		}
		
		var windows;
		if(ctx.originalEvent.shiftKey && !ctx.onLink){
			// 全タブを対象とする
			windows = getMostRecentWindow().getBrowser().browsers.map(itemgetter('contentWindow')).map(wrappedObject);
		} else {
			windows = [ctx.window];
		}
		
		gatherResults(windows.map(function(win){
			try{
				win.location.host;
			}catch(e){
				// about:config などのページを避ける
				return succeed();
			}
			
			// 全タブの場合はコンテキストを作成する
			var doc = win.document;
			var c = (windows.length == 1)? ctx : update({
				document  : doc,
				window    : win,
				title     : doc.title,
				selection : '',
				target    : doc.documentElement,
			}, win.location);
			
			return Tombloo.Service.extractors.extract(c, Tombloo.Service.check(c).reduce(function(memo, e){
				return memo || (/^Link/.test(e.name) && e);
			}));
		})).addCallback(function(ress){
			ress = ress.map(function(ps){
				// 取得されなかったページは抜かす
				return ps && format.format.
					replace('%url%', ps.itemUrl).
					replace('%title%', ps.item);
			})
			
			var text = joinText(ress, format.format.contains('\n')? '\n\n' : '\n');
			if(windows.length > 1)
				text += '\n';
			copyString(text);
		});
	}
	
	function updateMenus(){
		// 初期メニュー以外をクリア
		children.splice(0, children.length - 2);
		
		formats.forEach(function(format){
			// 定義順に並べて追加する
			children.splice(-2, 0, {
				name : format.name,
				execute : function(ctx){
					copyUrl(ctx, format);
				}
			});
		});
	}
})()
