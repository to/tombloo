connect(grobal, 'content-ready', function(window){with(window){
	// ----[Application]-------------------------------------------------
	function standBy(){
		keyTapper('CTRL+J', function(){
			keyTapper.clear();
			start();
		}, {repeat : false});
	}
	
	function start(top){
		top = top!=null? top : true;
		
		// document.body.style.position = 'static';
		
		keyTapper('SPACE', function(){
			viewTop(viewTop() + SPACE_SCROLL_AMOUNT);
		}, {wait : 60});
		keyTapper('SHIFT+SPACE', function(){
			viewTop(viewTop() - SPACE_SCROLL_AMOUNT);
		}, {wait : 60});
		keyTapper('ESCAPE', function(){
			keyTapper.clear();
			standBy();
		}, {repeat : false});
		
		keyTapper('J', function(){
			jump(true);
		});
		keyTapper('K', function(){
			jump(false);
		});
		
		top &&  jump(1);
	}
	
	function jump(next){
		var elms = getElements();
		var op = next ? gt : lt;
		var most = null;
		var border = viewTop();
		
		for(var i=l=elms.length ; i ; i--){
			var elm = elms[next ? l-i : i-1];
			var top = absoluteTop(elm) - MARGIN;
			
			if(
				isTarget(elm) && 
				op(top, border) && 
				(most==null || op(most, top))){
				
				most = top;
			}
		}
		
		viewTop(most);
		
		return border!=viewTop();
	}
	
	function isTarget(obj){
		return obj.style.position!='absolute' && obj.width>=MIN_OBJECT_SIZE && obj.height>=MIN_OBJECT_SIZE;
	}
	
	function getElements(){
		return document.images;
	}

	// ----[Utility]-------------------------------------------------
	function gt(a, b){return a > b}
	function lt(a, b){return a < b}

	function absoluteTop(elm){
		var top = 0
		for(var e = elm ; e ; e = e.offsetParent)
			top += e.offsetTop;
		return top;
	}

	function viewTop(top){
		var view = document.compatMode=='CSS1Compat' ? 
			document.documentElement : 
			document.body;
		return (viewTop = function(top){
			return top==null ? view.scrollTop : (view.scrollTop=top)
		})(top)
	}

	function keyTapper(keys, handler, opt){
		const specialKeys = {
			8  :'BACK',      9  :'TAB',
			13 :'ENTER',     19 :'PAUSE',
			20 :'CAPS_LOCK', 27 :'ESCAPE',     32 :'SPACE',
			33 :'PAGE_UP',   34 :'PAGE_DOWN',
			35 :'END',       36 :'HOME',
			37 :'LEFT',      38 :'UP',         39 :'RIGHT',     40 :'DOWN',
			45 :'INSERT',    46 :'DELETE',
			91 :'WINDOWS_LEFT', 
			92 :'WINDOWS_RIGHT',
			112:'F1',        113:'F2',         114:'F3',        115:'F4',
			116:'F5',        117:'F6',         118:'F7',        119:'F8',
			120:'F9',        121:'F10',        122:'F11',       123:'F12',
			144:'NUM_LOCK',  145:'SCROLL_LOCK',
			
			// 記号(Shiftキーを押していた時に表示される文字列)
			109:'=', 222:'~', 220:'|',
			192:'`', 219:'{',
			61 :'+', 59 :'*', 221: '}',
			188:'<', 190:'>', 191:'?', 226:'_',
		};
		
		function keyString(e){
			var code = e.keyCode;
			var res = [];
			e.shiftKey && res.push('SHIFT');
			e.ctrlKey  && res.push('CTRL');
			e.altKey   && res.push('ALT');
			if(code < 16 || 18 < code)
				res.push(specialKeys[code] || String.fromCharCode(code));
			return res.join('+');
		}
		
		function cancel(e){
			e.preventDefault();
			e.stopPropagation();
		}
		
		var opts = {};
		var intervalIDs = {};
		var downed = {};
		
		document.addEventListener('keydown', function(e){
			if(e.target.tagName.match(/input|textarea/i)) return;
			
			var key = keyString(e);
			var keyCode = e.keyCode;
			var opt = opts[key];
			
			if(opt && opt.cancel) cancel(e);
			if(
				!opt || 
				intervalIDs[keyCode] != null || 
				(!opt.repeat && downed[keyCode])) return;
			
			opt.handler(e, downed[keyCode], opt);
			downed[keyCode] = true;
			
			var now = Date.now();
			var wait = now - opt.last;
			if(wait<1500){
				// 人間の感覚に合わせるため500msを境に時間の伸縮を行う
				// opt.wait = Math.max(150, Math.floor(wait + ((wait - 500) * 0.2)));
				opt.wait = wait;
			}
			opt.last = now;
			
			// 以降のキーリピートはsetIntervalでエミュレートする
			intervalIDs[keyCode] = setTimeout(function(){
				opt.handler(e, true, opt);
				opt.last = 0; // 繰り返しが始まったらタップをクリアする
				intervalIDs[keyCode] = setTimeout(arguments.callee, opt.wait);
			}, opt.wait);
			/*
			// 以降のキーリピートはsetIntervalでエミュレートする
			intervalIDs[keyCode] = setInterval(function(){
				opt.handler(e, true, opt);
				opt.last = 0;
			}, opt.wait);
			*/
		}, true);
		document.addEventListener('keyup', function(e){
			var keyCode = e.keyCode;
			
			if(!downed[keyCode]) return;
			downed[keyCode] = false;
			
			if(intervalIDs[keyCode] == null) return;
			clearInterval(intervalIDs[keyCode]);
			delete intervalIDs[keyCode];
		}, true);
		
		(keyTapper = function(keys, handler, opt){
			opt = opt || {};
			keys.split(',').forEach(function(key){
				opts[key] = {
					handler : handler,
					repeat  : opt.repeat!=null? opt.repeat : true,
					last    : 0,
					wait    : opt.wait || 90,
					cancel  : opt.cancel!=null? opt.cancel : true,
				};
			});
		})(keys, handler, opt)
		
		keyTapper.clear = function(){
			opts = {};
		}
	}
	
	// ----[Main]-------------------------------------------------
	var SPACE_SCROLL_AMOUNT = 50;
	var MARGIN = 10;
	var MIN_OBJECT_SIZE = 100;
	
	var AUTO_START_SITES = [
		'//blogs.yahoo.co.jp/cashewchand/',
		'//fishki.net/',
		'//ebikakiage.exblog.jp/',
		'//andouyuko.exblog.jp/',
		
		'//f.hatena.ne.jp/',
		'//www.webpark.ru/',
		'//knuttz.net/',
		'//englishrussia.com/',
		'//.+.livejournal.com/',
		'//.*darkroastedblend.com/',
		'//.*flickr.com/photos/',
		'//static.iftk.com.br/',
		'//slyr.exblog.jp/',
		'//picsyard.com/',
		'//weirdweirdworld.com/browse/',
		'//whytheluckystiff.net/quiet/',
		'//genmegane.com/',
		'//ameblo.jp/princess-tenko/',
		'//blog.goo.ne.jp/itozakikimio/',
		'//blog.goo.ne.jp/punyor/',
		'//ullam.typepad.com/ullabenulla/',
		'//ifun.ru/',
		'//blog.livedoor.jp/kobateck/',
		'//glob.anewyorkthing.com/',
		'//d.hatena.ne.jp/nht-w2/',
		'//d.hatena.ne.jp/afji/',
		
		'//www.nakedprotesters.com/',
		'//www.squareamerica.com/',
		'//www.brandedinthe80s.com/',
		'//www.lifeinthefastlane.ca/',
		'//www.heronpreston.com/',
		'//www.10eastern.com/foundphotos/',
		'//www.lastnightsparty.com/',
		'//www.hedislimane.com/diary/',
		'//www.widelec.org/',
		'//www.urbanhonking.com/owl/',
		
		'//damncoolpics.blogspot.com/',
		'//bibliodyssey.blogspot.com/',
		'//spluch.blogspot.com/',
		'//facehunter.blogspot.com/',
		'//hemaworst.blogspot.com/',
		'//lotusgreenfotos.blogspot.com/',
		'//iheartphotograph.blogspot.com/',
		'//animationbackgrounds.blogspot.com/',
		'//bradtroemel.blogspot.com/',
		'//johnkstuff.blogspot.com/',
		'//tokyoundressed.blogspot.com/',
		
		'//kp4.jp/',
		'//kinose.exblog.jp/',
		'//fishki.net/',
		'//www.widelec.org/',
		'//www.shorpy.com/',
		'//funtasticus.com/',
	]
	
	if(AUTO_START_SITES.some(function(s){return location.href.match(s)})){
		start(false);
	} else {
		standBy();
	}
}});
