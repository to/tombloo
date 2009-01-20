// ----[Application]-------------------------------------------------
var getPref = partial(getPrefValue, 'extensions.tombloo.');
var setPref = partial(setPrefValue, 'extensions.tombloo.');

var CHROME_DIR = 'chrome://tombloo';
var CHROME_CONTENT_DIR = CHROME_DIR + '/content';

var EXTENSION_ID = 'tombloo@brasil.to';

var KEY_ACCEL = (AppInfo.OS == 'Darwin')? 'META' : 'CTRL';

var grobal = this;
disconnectAll(grobal);

// リロードによって変更されない領域を用意する
// イベントに安定してフックするためなどに使われる
if(typeof(constant)=='undefined')
	constant = {};


// ----[XPCOM]-------------------------------------------------
function evalInSandbox(js, url){
	return Components.utils.evalInSandbox(js, Components.utils.Sandbox(url));
}

function wrappedObject(obj){
	return obj.wrappedJSObject || obj;
}

function getCookies(host, name){
	var re = new RegExp(host + '$');
	return filter(function(c){
		return (c.host.search(re) != -1) && 
			(name? c.name == name : true);
	}, CookieManager.enumerator);
}

function getCookieString(host, name){
	return getCookies(host, name).map(function(c){
		return c.name + '=' + c.value ;
	}).join('; ');
}

function getPasswords(host, user){
	// Firefox 2
	if(PasswordManager){
		return filter(function(p){
			return (p.host == host) && 
				(user? p.user == user : true);
		}, PasswordManager.enumerator);
	} else {
		return map(function(p){
			return {
				user : p.username,
				usernameFieldName : p.usernameField,
				password : p.password,
				passwordFieldName : p.passwordField,
			}
		}, ifilter(function(p){
			return (user? p.username == user : true);
		}, LoginManager.findLogins({}, host, host, null)));
	}
}

var stringBundle = StringBundleService.createBundle(CHROME_DIR + '/locale/messages.properties');
function getMessage(key){
	var ps = Array.splice(arguments, 1);
	try{
		if(ps){
			return stringBundle.formatStringFromName(key, ps, ps.length);
		} else {
			return stringBundle.GetStringFromName(key);
		}
	} catch(e){
		return '';
	}
}

function input(form, title){
	var pair;
	if(some(form, function(p){
		pair = p;
		return isArrayLike(p[1]);
	})){
		var selected = {};
		var [msg, list] = pair;
		if(!PromptService.select(null, title || '', msg, list.length, list, selected))
			return;
		
		return list[selected.value];
	} else {
		var args = [null, title || ''];
		for(var msg in form){
			var val = {value : form[msg]};
			form[msg] = val;
			args.push(msg);
			args.push(val);
		}
		
		if(!PromptService.prompt.apply(PromptService, args))
			return;
		
		for(var msg in form)
			form[msg] = form[msg].value;
		
		return form;
	}
}

function download(sourceURL, targetFile){
	var d = new Deferred();
	var targetURI = IOService.newFileURI(targetFile);
	var sourceURI = IOService.newURI(sourceURL, null, null);
	
	var persist = WebBrowserPersist();
	with(persist){
		persist.progressListener = {
			onLocationChange : function(){},
			onProgressChange : function(){},
			onSecurityChange : function(){},
			onStatusChange : function(){},
			onStateChange : function(progress, req, state, status){
				if (state & IWebProgressListener.STATE_STOP)
					d.callback(targetFile);
			},
		}
		
		persistFlags = PERSIST_FLAGS_FROM_CACHE;
		saveURI(sourceURI, null, null, null, null, targetURI);
	}
	
	return d;
}

function createDir(dir){
	var dir = (dir instanceof IFile) ? dir : new LocalFile(dir);
	if(dir.exists()){
		if(dir.isDirectory())
			dir.permissions = 0774;
	} else {
		dir.create(dir.DIRECTORY_TYPE, 0774);
	}
	
	return dir;
}

function uriToFileName(uri){
	uri = createURI(uri);
	uri = (uri.host+uri.filePath).replace(/\/$/, '');
	return validateFileName(uri);
}

function clearCollision(file){
	var name = file.leafName;
	for(var count = 2 ; file.exists() ; count++)
		file.leafName = name.replace(/(.*)\./, '$1('+count+').');
}

function getContentDir(){
	var contentDir = getExtensionDir(EXTENSION_ID);
	contentDir.setRelativeDescriptor(contentDir, 'chrome/content');
	
	return contentDir;
}

function getPatchDir(){
	var dir = getDataDir();
	dir.append('script');
	
	return createDir(dir);
}

function getDataDir(name){
	var path = 'file:///' + getPref('dataDir').replace(/\{(.*?)\}/g, function(all, name){
		return DirectoryService.get(name, IFile).path;
	}).replace(/\\/g, '/')
	
	var dir = createDir(getLocalFile(path));
	name && dir.append(name);
	return dir;
}

function getTempDir(name){
	var dir = DirectoryService.get('TmpD', IFile);
	name && dir.append(name);
	
	return dir;
}

function getTempFile(ext){
	var file = getTempDir();
	file.append(joinText(['tombloo_' + (new Date()).getTime(), ext], '.'));
	
	return file;
}

/**
 * ダイアログを開く。
 * Progressオブジェクト、または、個別の値を渡す。
 *
 * @param {Progress || String} progress Progressオブジェクト。新しく生成する場合は名前。
 * @param {Number} max 最大値。
 * @param {Number} value 現在値。
 */
function openProgressDialog(progress, max, value){
	if(!(progress instanceof Progress))
		progress = new Progress(progress, max, value);
	
	openDialog('chrome://tombloo/content/library/progressDialog.xul', 'dialog,centerscreen', progress);
	
	return progress;
}

/**
 * ダイアログを開く。
 *
 * @param {String} url ウィンドウURL。
 * @param {String} features ウィンドウの特徴。
 * @param {Object} value ウィンドウへ渡す値。
 */
function openDialog(url, features, value){
	var win = getMostRecentWindow(); 
	var args = Array.slice(arguments);
	args.splice(1, 0, '_blank')
	return win.openDialog.apply(win, args);
}

function openParamString(obj){
	var params=[];
	for(var p in obj)
		params.push(p+(obj[p]!=null? '='+obj[p] : ''));
	return params.join(',');
}

/**
 * ブラウザウィンドウのリストを取得する。
 */
function getWindows(){
	return list(WindowMediator.getEnumerator('navigator:browser'));
}

function addTab(url, background){
	var d = new Deferred();
	var tabbrowser = getMostRecentWindow().getBrowser();
	var tab = tabbrowser.addTab(url);
	var browser = tab.linkedBrowser;
	if(!background)
		tabbrowser.selectedTab = tab;
	
	browser.addEventListener('DOMContentLoaded', function(event){
		browser.removeEventListener('DOMContentLoaded', arguments.callee, true);
		
		d.callback(wrappedObject(event.originalTarget.defaultView));
	}, true);
	
	return d;
}

function getContents(file, charset){
	try{
		return withStream(new FileInputStream(file, -1, 0, false), function(fis){
			return withStream(new ConverterInputStream(fis, charset), function(cis){
				var out = {};
				cis.readString(fis.available(), out);
				return out.value;
			});
		});
	} catch(e){}
}

function putContents(file, text, charset){
	withStream(new FileOutputStream(file, 
		FileOutputStream.PR_WRONLY | FileOutputStream.PR_CREATE_FILE | FileOutputStream.PR_TRUNCATE, 420, -1), function(stream){
		text = text.convertFromUnicode(charset);
		stream.write(text, text.length);
	});
}
	
/**
 * チャンネルにクッキーを付加する。
 * Firefox 3.1でnetwork.cookie.cookieBehaviorの値に関わらずクッキーが設定されなくなった。
 * 詳細調査中。
 *
 * @param {nsIHttpChannel} channel
 */
function setCookie(channel){
	if(!channel.QueryInterface(Ci.nsIHttpChannel))
		return;
	
	// Firefox 3.1で第二引数にchannelを渡すとリダイレクト時にクッキーが返らないためnullにする
	channel.setRequestHeader(
		'Cookie', 
		CookieService.getCookieString(channel.URI, null), 
		true);
}

/**
 * POST/GETの通信を行う。
 * マルチパートを使ったアップロードも行える。
 *
 * @param {String} url リクエストURL。
 * @param {Object} opts リクエストオプション。
 * @param {String} opts.referrer リファラURL。
 * @param {String} opts.charset 文字セット。指定されない場合、レスポンスヘッダの文字セットが使われる。
 * @param {String || Object} opts.queryString クエリ。
 * @param {String || Object} opts.sendContent 
 *        コンテント。設定されているとPOSTメソッドになる。値に直接ファイルをセットしてもよい。
 * @param {nsIInputStream || nsIFile} opts.KEY.file アップロードファイル。
 * @param {String} opts.KEY.fileName 
 *        サーバーへ送信するファイル名。指定されない場合、元のファイル名が使われる。
 * @param {String} opts.KEY.contentType 
 *        コンテントタイプ。指定されない場合、application/octet-streamになる。
 */
function request(url, opts){
	var d = new Deferred();
	
	opts = opts || {};
	
	var uri = createURI(url + queryString(opts.queryString, true));
	var channel = broad(IOService.newChannelFromURI(uri));
	
	if(opts.referrer)
		channel.referrer = createURI(opts.referrer);
	
	setCookie(channel);
	
	if(opts.sendContent){
		var contents = opts.sendContent;
		
		// マルチパートチェック/パラメーター準備
		var multipart;
		for(var name in contents){
			// 値として直接ファイルが設定されているか?
			var value = contents[name];
			if(value instanceof IInputStream || value instanceof IFile)
				value = contents[name] = {file : value};
			
			if(value && value.file)
				multipart = true;
		}
		
		if(!multipart){
			contents = queryString(contents);
			channel.setUploadStream(
				new StringInputStream(contents), 
				'application/x-www-form-urlencoded', -1);
		} else {
			var boundary = '---------------------------' + (new Date().getTime());
			var streams = [];
			
			for(var name in contents){
				var value = contents[name];
				if(value==null)
					continue;
				
				if(!value.file){
					streams.push([
						'--' + boundary,
						'Content-Disposition: form-data; name="' + name + '"',
						'',
						(value.convertFromUnicode? value.convertFromUnicode() : value),
					]);
				} else {
					if(value.file instanceof IFile){
						value.fileName = value.file.leafName;
						value.file = IOService.newChannelFromURI(createURI(value.file)).open();
					}
					
					streams.push([
						'--' + boundary,
						'Content-Disposition: form-data; name="' + name + '"; filename="' + (value.fileName || '_') + '"',
						'Content-Type: ' + (value.contentType || 'application/octet-stream'),
						'',
					])
					streams.push(new BufferedInputStream(value.file));
					streams.push('');
				}
			}
			streams.push('--' + boundary + '--');
			
			var mimeStream = new MIMEInputStream(new MultiplexInputStream(streams));
			mimeStream.addHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
			channel.setUploadStream(mimeStream, null, -1);
		}
	}
	
	var redirectionCount = 0;
	var listener = {
		QueryInterface : createQueryInterface([
			'nsIStreamListener', 
			'nsIProgressEventSink', 
			'nsIHttpEventSink', 
			'nsIInterfaceRequestor', 
			'nsIChannelEventSink']),
		
		isAppOfType : function(val){
			// http://hg.mozilla.org/mozilla-central/file/FIREFOX_3_1b2_RELEASE/docshell/base/nsILoadContext.idl#l78
			//
			// 本リスナが特定のアプリケーション目的で使用され、その
			// アプリケーション種別に対して動作可能かを返す。
			// val にはアプリケーション種別を示す nsIDocShell の
			// APP_TYPE_XXX が渡される。
			//
			//   APP_TYPE_UNKNOWN 0
			//   APP_TYPE_MAIL    1
			//   APP_TYPE_EDITOR  2
			return (val == 0);
		},
		
		// nsIProgressEventSink
		onProgress : function(req, ctx, progress, progressMax){},
		onStatus : function(req, ctx, status, statusArg){},
		
		// nsIInterfaceRequestor
		getInterface : function(iid){
			// Firefox 2でnsIPromptを要求されエラーになるため判定処理を外す
			// インターフェースにないメソッドを呼ばれる可能性があるが確認範囲で発生しなかった
			// http://developer.mozilla.org/ja/docs/Creating_Sandboxed_HTTP_Connections
			return this;
		},
		
		// nsIHttpEventSink
		onRedirect : function(oldChannel, newChannel){},
		
		// nsIChannelEventSink
		onChannelRedirect : function(oldChannel, newChannel, flags){
			// channel.redirectionLimitを使うとリダイレクト後のアドレスが取得できない
			redirectionCount++;
			
			if(opts.redirectionLimit!=null && redirectionCount>opts.redirectionLimit){
				// NS_ERROR_REDIRECT_LOOP
				newChannel.cancel(2152398879);
				
				var res = {
					channel : newChannel,
					responseText : '',
					status : oldChannel.responseStatus,
					statusText : oldChannel.responseStatusText,
				};
				d.callback(res);
				
				return;
			}
			
			setCookie(newChannel);
		},
		
		// nsIStreamListener
		onStartRequest: function(req, ctx){
			this.data = [];
		},
		onDataAvailable: function(req, ctx, stream, sourceOffset, length){
			this.data.push(new InputStream(stream).read(length));
		},
		onStopRequest: function (req, ctx, status){
			// Firefox 3ではcancelするとonStopRequestは呼ばれない
			if(opts.redirectionLimit!=null && redirectionCount>opts.redirectionLimit)
				return;
			
			broad(req);
			
			var text = this.data.join('');
			var charset = opts.charset || req.contentCharset;
			
			try{
				text = charset? text.convertToUnicode(charset) : text;
			} catch(err){
				// [FIXME] 調査中
				error(err);
				error(charset);
				error(text);
			}
			var res = {
				channel : req,
				responseText : text,
				status : req.responseStatus,
				statusText : req.responseStatusText,
			};
			
			if(Components.isSuccessCode(status) && res.status < 400){
				d.callback(res);
			}else{
				res.message = getMessage('error.http.' + res.status);
				d.errback(res);
			}
		},
	};
	
	channel.requestMethod = 
		(opts.method)? opts.method : 
		(opts.sendContent)? 'POST' : 'GET';
	channel.notificationCallbacks = listener;
	channel.asyncOpen(listener, null);
	
	// 確実にガベージコレクトされるように解放する
	listener = null;
	channel = null;
	
	return d;
}


// ----[MochiKit]-------------------------------------------------
var StopProcess = {};

function connected(src, sig){
	return MochiKit.Signal._observers.some(function(o){
		return o.source === src && o.signal === sig && o.connected;
	});
}

function maybeDeferred(d) {
	return typeof(d) == 'function'? 
		MochiKit.Async.maybeDeferred(d) : 
		(d==null || !d.addCallback)? 
			succeed(d) : 
			d;
}

MochiKit.Base.update(MochiKit.Signal.Event.prototype, {
	// [FIXME] mouse.wheel.yを利用
	wheelDelta : function(){
		return 	this.event().detail;
	},
	isStopped : function(){
		var evt = this.event();
		
		return evt.getPreventDefault ?
			evt.getPreventDefault() :
			evt.cancelBubble;
	},
	
	// FIXME: 統合、現在Stroboで利用
	keyString : function(){
		var keys = [];
		
		var mod = this.modifier();
		mod.ctrl && keys.push('CTRL');
		mod.shift && keys.push('SHIFT');
		mod.alt && keys.push('ALT');
		
		var key = this.key();
		if(key){
			key = key.string.replace(/^KEY_/, '');
			if(!keys.some(function(i){return i==key}))
				keys.push(key);
		}
		
		return keys.join('+');
	},
})

MochiKit.Base.update(MochiKit.Signal._specialKeys, {
	61:  'KEY_SEMICOLON',
	226: 'KEY_HORIZONTAL_BAR'
});

function formContents(elm){
	if(typeof(elm)=='string')
		elm = convertToHTMLDocument(elm);
	
	return reduce(function(p, a){
		p[a[0]]=a[1];
		return p;
	}, zip.apply(null, MochiKit.DOM.formContents(elm)), {});
}

function queryString(params, question){
	if(isEmpty(params))
		return '';
	
	if(typeof(params)=='string')
		return params;
	
	var qeries = [];
	for(var key in params){
		var value = params[key];
		if(value==null)
			continue;
		qeries.push(encodeURIComponent(key) + '='+ encodeURIComponent(value));
	}
	return (question? '?' : '') + qeries.join('&');
}

// FIXME: 互換のため
function doXHR(url, opts){
	error('deprecated: doXHR');
	return request(url, opts);
}

registerIteratorFactory(
	'SimpleEnumerator', 
	function(it){
		return it && typeof(it.hasMoreElements) == "function";
	}, 
	function(it){
		var ifcs;
		return {
			next: function(){
				if(!it.hasMoreElements())
					throw StopIteration;
				
				var res = it.getNext();
				if(!ifcs)
					ifcs = getInterfaces(res);
				return broad(res, ifcs);
			}
		};
	});

registerIteratorFactory(
	'TreeWalker', 
	function(it){
		return it instanceof Ci.nsIDOMTreeWalker;
	}, 
	function(it){
		return {
			next: function(){
				var elm;
				if(!(elm = it.nextNode()))
					throw StopIteration;
				
				return elm;
			}
		};
	});

registerIteratorFactory(
	'XML', 
	function(it){
		return typeof(it) == "xml";
	}, 
	function(it){
		var i = 0;
		var len = it.length();
		return {
			next: function(){
				if(i >= len)
					throw StopIteration;
				
				return it[i++];
			}
		};
	});

if(NavHistoryService){
	registerIteratorFactory(
		'nsINavHistoryContainerResultNode', 
		function(it){
			return it instanceof Ci.nsINavHistoryContainerResultNode;
		}, 
		function(it){
			var i = 0;
			var len = it.childCount;
			return {
				next: function(){
					if(i >= len)
						throw StopIteration;
					
					return it.getChild(i++);
				}
			};
		});
}

// 実験的、itemsの利用を推奨
registerIteratorFactory(
	'Object', 
	function(it){
		return it && typeof(it) == "object";
	}, 
	function(it){
		var props = keys(it).filter(function(prop){
			return it.hasOwnProperty(prop);
		});
		return {
			next: function(){
				var prop = props.shift();
				if(!prop)
					throw StopIteration;
				
				return [prop, it[prop]];
			}
		};
	});

/*
function deferredForEach(it, func, index){
	index = index || 0;
	it = iter(it);
	
	var d = succeed();
	try{
		return d.
			addCallback(func, it.next(), index).
			addCallback(deferredForEach, it, func, ++index).
			addErrback(function(e){
				if(e.message!=StopIteration) throw e;
			});
	} catch (e if e==StopIteration){
		return d;
	}
}
*/

// 暫定パッチ、事前にリスト作成、無限リストに未対応
function deferredForEach(it, func){
	var d = new Deferred();
	var index = 0
	forEach(it, function(item){
		d.addCallback(func, item, index);
		++index;
	});
	d.addErrback(function(err){
		if(err.message==StopIteration)
			return;
		
		throw err;
	});
	d.callback();
	
	return d;
}

function DeferredHash(ds){
	var props = keys(ds);
	
	return new DeferredList(values(ds)).addCallback(function(results){
		var res = {};
		for (var i = 0; i < results.length; i++)
			res[props[i]] = results[i];
		return res;
	});
};

function getViewDimensions(){
	var d = new Dimensions();
	var doc = currentDocument();

	if(doc.compatMode == 'CSS1Compat'){
		d.h = doc.documentElement.clientHeight;
		d.w = doc.documentElement.clientWidth;
	} else {
		d.h = doc.body.clientHeight;
		d.w = doc.body.clientWidth;
	}
	
	return d;
}

function getPageDimensions(){
	var d = new Dimensions();
	var doc = currentDocument();

	if(doc.compatMode == 'CSS1Compat'){
		d.h = doc.documentElement.scrollHeight;
		d.w = doc.documentElement.scrollWidth;
	} else {
		d.h = doc.body.scrollHeight;
		d.w = doc.body.scrollWidth;
	}
	
	return d;
}

function getElementPosition(elm){
	return withWindow(elm.ownerDocument.defaultView, function(){
		return MochiKit.Style.getElementPosition(elm);
	});
}

function roundPosition(p){
	return new Coordinates(
		Math.round(p.x), 
		Math.round(p.y));
}

// FIXME: UTF-8でスクリプトをロードするように
function isCorruptedScript(){
	try{
		'ウァ'.convertToUnicode();
		return true;
	} catch(e) {
		return false;
	}
}

String.katakana = {
	'ウァ':'wha','ウィ':'wi','ウェ':'we','ウォ':'who',
	'キャ':'kya','キィ':'kyi','キュ':'kyu','キェ':'kye','キョ':'kyo',
	'クャ':'qya','クュ':'qyu',
	'クァ':'qwa','クィ':'qwi','クゥ':'qwu','クェ':'qwe','クォ':'qwo',
	'ギャ':'gya','ギィ':'gyi','ギュ':'gyu','ギェ':'gye','ギョ':'gyo',
	'グァ':'gwa','グィ':'gwi','グゥ':'gwu','グェ':'gwe','グォ':'gwo',
	'シャ':'sha','シィ':'syi','シュ':'shu','シェ':'sye','ショ':'sho',
	'スァ':'swa','スィ':'swi','スゥ':'swu','スェ':'swe','スォ':'swo',
	'ジャ':'ja','ジィ':'jyi','ジュ':'ju','ジェ':'jye','ジョ':'jo',
	'チャ':'cha','チィ':'tyi','チュ':'chu','チェ':'tye','チョ':'cho',
	'ツァ':'tsa','ツィ':'tsi','ツェ':'tse','ツォ':'tso',
	'テャ':'tha','ティ':'thi','テュ':'thu','テェ':'the','テョ':'tho',
	'トァ':'twa','トィ':'twi','トゥ':'twu','トェ':'twe','トォ':'two',
	'ヂャ':'dya','ヂィ':'dyi','ヂュ':'dyu','ヂェ':'dye','ヂョ':'dyo',
	'デャ':'dha','ディ':'dhi','デュ':'dhu','デェ':'dhe','デョ':'dho',
	'ドァ':'dwa','ドィ':'dwi','ドゥ':'dwu','ドェ':'dwe','ドォ':'dwo',
	'ニャ':'nya','ニィ':'nyi','ニュ':'nyu','ニェ':'nye','ニョ':'nyo',
	'ヒャ':'hya','ヒィ':'hyi','ヒュ':'hyu','ヒェ':'hye','ヒョ':'hyo',
	'フャ':'fya','フュ':'fyu','フョ':'fyo',
	'ファ':'fa','フィ':'fi','フゥ':'fwu','フェ':'fe','フォ':'fo',
	'ビャ':'bya','ビィ':'byi','ビュ':'byu','ビェ':'bye','ビョ':'byo',
	'ヴァ':'va','ヴィ':'vi','ヴ':'vu','ヴェ':'ve','ヴォ':'vo',
	'ヴャ':'vya','ヴュ':'vyu','ヴョ':'vyo',
	'ピャ':'pya','ピィ':'pyi','ピュ':'pyu','ピェ':'pye','ピョ':'pyo',
	'ミャ':'mya','ミィ':'myi','ミュ':'myu','ミェ':'mye','ミョ':'myo',
	'リャ':'rya','リィ':'ryi','リュ':'ryu','リェ':'rye','リョ':'ryo',
	
	'ア':'a','イ':'i','ウ':'u','エ':'e','オ':'o',
	'カ':'ka','キ':'ki','ク':'ku','ケ':'ke','コ':'ko',
	'サ':'sa','シ':'shi','ス':'su','セ':'se','ソ':'so',
	'タ':'ta','チ':'chi','ツ':'tsu','テ':'te','ト':'to',
	'ナ':'na','ニ':'ni','ヌ':'nu','ネ':'ne','ノ':'no',
	'ハ':'ha','ヒ':'hi','フ':'fu','ヘ':'he','ホ':'ho',
	'マ':'ma','ミ':'mi','ム':'mu','メ':'me','モ':'mo',
	'ヤ':'ya','ユ':'yu','ヨ':'yo',
	'ラ':'ra','リ':'ri','ル':'ru','レ':'re','ロ':'ro',
	'ワ':'wa','ヲ':'wo','ン':'nn',
	'ガ':'ga','ギ':'gi','グ':'gu','ゲ':'ge','ゴ':'go',
	'ザ':'za','ジ':'zi','ズ':'zu','ゼ':'ze','ゾ':'zo',
	'ダ':'da','ヂ':'di','ヅ':'du','デ':'de','ド':'do',
	'バ':'ba','ビ':'bi','ブ':'bu','ベ':'be','ボ':'bo',
	'パ':'pa','ピ':'pi','プ':'pu','ペ':'pe','ポ':'po',
	
	'ァ':'la','ィ':'li','ゥ':'lu','ェ':'le','ォ':'lo',
	'ヵ':'lka','ヶ':'lke','ッ':'ltu',
	'ャ':'lya','ュ':'lyu','ョ':'lyo','ヮ':'lwa',
	'。':".",'、':",",'ー':"-",
}

if(isCorruptedScript()){
	String.katakana = reduce(function(memo, pair){
		memo[pair[0].convertToUnicode()] = pair[1];
		return memo;
	}, String.katakana, {});
}



Array.prototype = update(Array.prototype, {
	split : function(step){
		var res = [];
		for(var i=0,len=this.length ; i<len ;)
			res.push(this.slice(i, i+=step));
		
		return res;
	},
});


// ----[General]-------------------------------------------------
function debug(msg){
	if(!getPref('debug'))
		return msg;
	
	return log(msg);
}

function log(msg){
	firebug('log', arguments) || 
		ConsoleService.logStringMessage(''+msg);
	
	return msg;
}

function error(err){
	firebug('error', arguments) || 
		Components.utils.reportError(err);
	
	return err;
}

function warn(msg){
	firebug('warn', arguments) || 
		ConsoleService.logMessage(new ScriptError(msg, null, null, null, null, ScriptError.warningFlag, null));
	
	return msg;
}

function firebug(method, args){
	if(!getPref('useFirebug'))
		return false;
	
	var win = getMostRecentWindow();
	if(win.FirebugConsole && win.FirebugContext) {
		var console = new win.FirebugConsole(win.FirebugContext, win.content);
		console[method].apply(console, args);
		return true;
	}
	
	// Firebug 1.2~
	if ( win.Firebug && win.Firebug.Console ) {
		win.Firebug.Console.logFormatted.call(win.Firebug.Console, Array.slice(args), win.FirebugContext, method);
		return true;
	}
	
	return false;
}

function clearObject(obj){
	for(var p in obj)
		delete obj[p];
	return obj;
}

function isEmpty(obj){
	for(var i in obj)
		return false;
	return true;
}

function populateForm(form, values){
	for(var name in values){
		var control = $x('//*[@name="' + name + '"]', form);
		if(!control || !values[name])
			continue;
		
		if(control.type == 'checkbox'){
			if(control.value == values[name])
				control.checked = true;
		} else {
			control.value = values[name];
		}
	}
}

function createSet(keys){
	keys = (keys instanceof Array) ? keys : keys.split(/\s/);
	return reduce(function(memo, val){
		memo[val]=val;
		return memo;
	}, keys, {})
}

function pickUp(a, pop){
	var i = random(a.length);
	return pop ? a.splice(i, 1)[0] : a[i];
}

function random(max){
	return Math.floor(Math.random() * max);
}

function absolutePath(path){
  var e = currentDocument().createElement('span');
  e.innerHTML = '<a href="' + path + '" />';
  return e.firstChild.href;
}

/**
 * オブジェクトのプロパティをコピーする。
 * ゲッター/セッターの関数も対象に含まれる。
 * 
 * @param {Object} target コピー先。
 * @param {Object} source コピー元。
 * @return {Object} コピー先。
 */
function extend(target, source, overwrite){
	overwrite = overwrite==null? true : overwrite;
	
	for(var p in source){
		var getter = source.__lookupGetter__(p);
		if(getter)
			target.__defineGetter__(p, getter);
		
		var setter = source.__lookupSetter__(p);
		if(setter)
			target.__defineSetter__(p, setter);
		
		if(!getter && !setter && (overwrite || !(p in target)))
			target[p] = source[p];
	}
	
	return target;
}

/**
 * メソッドが呼ばれる前に処理を追加する。
 * より詳細なコントロールが必要な場合はaddAroundを使うこと。
 * 
 * @param {Object} target 対象オブジェクト。
 * @param {String} name メソッド名。
 * @param {Function} before 前処理。
 *        対象オブジェクトをthisとして、オリジナルの引数が全て渡されて呼び出される。
 */
function addBefore(target, name, before) {
	var original = target[name];
	target[name] = function() {
		before.apply(target, arguments);
		return original.apply(target, arguments);
	}
}

/**
 * メソッドへアラウンドアドバイスを追加する。
 * 処理を置きかえ、引数の変形や、返り値の加工をできるようにする。
 * 
 * @param {Object} target 対象オブジェクト。
 * @param {String || Array} methodNames 
 *        メソッド名。複数指定することもできる。
 *        set*のようにワイルドカートを使ってもよい。
 * @param {Function} advice 
 *        アドバイス。proceed、args、target、methodNameの4つの引数が渡される。
 *        proceedは対象オブジェクトにバインド済みのオリジナルのメソッド。
 */
function addAround(target, methodNames, advice){
	methodNames = [].concat(methodNames);
	
	// ワイルドカードの展開
	for(var i=0 ; i<methodNames.length ; i++){
		if(methodNames[i].indexOf('*')==-1) continue;
		
		var hint = methodNames.splice(i, 1)[0];
		hint = new RegExp('^' + hint.replace(/\*/g, '.*'));
		for(var prop in target) {
			if(hint.test(prop) && typeof(target[prop]) == 'function')
				methodNames.push(prop);
		}
	}
	
	methodNames.forEach(function(methodName){
		var method = target[methodName];
		target[methodName] = function() {
			var self = this;
			return advice(
				function(args){
					return method.apply(self, args);
				}, 
				arguments, self, methodName);
		};
		target[methodName].overwrite = (method.overwrite || 0) + 1;
	});
}

/**
 * 配列を結合し文字列を作成する。
 * 空要素は除外される。
 * 配列が空の場合は、空文字列が返される。
 * 配列の入れ子は直列化される。
 * 
 * @param {Array} txts 文字列配列。
 * @param {String} delm 区切り文字列。
 * @param {Boolean} trimTag 各文字列からHTMLタグを除外するか。
 * @return {String} 結合された文字列。
 */
function joinText(txts, delm, trimTag){
	if(!txts)
		return '';
	
	if(delm==null)
		delm = ',';
	txts = flattenArray([].concat(txts).filter(operator.truth));
	return (trimTag? txts.map(methodcaller('trimTag')) : txts).join(delm);
}

// http://mxr.mozilla.org/mozilla/source/toolkit/content/contentAreaUtils.js#811
function validateFileName(fileName){
	if (navigator.appVersion.indexOf("Windows") != -1) {
		return fileName.
			replace(/[\"]+/g, "'").
			replace(/[\*\:\?]+/g, " ").
			replace(/[\<]+/g, "(").
			replace(/[\>]+/g, ")").
			replace(/[\\\/\|]+/g, "_");
	}
	else if (navigator.appVersion.indexOf("Macintosh") != -1){
		return fileName.replace(/[\:\/]+/g, "_");
	}
	
	return fileName.replace(/[\/]+/g, "_");
}

/**
 * Windows上でWSHを実行する。
 * スクリプト内でWScript.echoなどで出力された文字列も返り値に含まれる。
 * 
 * @param {Function} func WSHスクリプト。
 * @param {Array} args WSHスクリプトの引数。 
 * @return {String} WSHスクリプトの実行結果。
 */
function executeWSH(func, args){
	args = args || [];
	
	var bat = getTempFile('bat');
	var script = getTempFile();
	var out = new LocalFile(script.path + '.out');
	
	putContents(bat, [
		'cscript //E:JScript //Nologo', 
		script.path.quote(), 
		'>', 
		out.path.quote()].join(' '));
	putContents(script, 
		args.map(function(a, i){return 'var ARG_' + i + ' = ' + uneval(a) + ';'}).join('\n') + 
		'WScript.echo(' + func.toSource() + '(' + 
		args.map(function(a, i){return 'ARG_' + i}).join(',') + 
		'));');
	
	new Process(bat).run(true, [], 0);
	
	var res = getContents(out, 'Shift-JIS').replace(/\s+$/, '');
	
	bat.remove(false);
	script.remove(false);
	out.remove(false);
	
	return res;
}


// ----[State]-------------------------------------------------
var State = {
	make : function(cls, stateSetName, stateSet, defaultStateName){
		if(arguments.length == 3){
			defaultStateName = stateSet;
			stateSet = stateSetName;
			stateSetName = void(0);
		}
		
		var p = cls.prototype;
		var K = this.K;
		forEach(this.gatherProperties(stateSet), function(prop){
			for(var i in stateSet){
				var state = stateSet[i];
				if(!state[prop])
					state[prop] = K;
			}
		});
	
		update(p, stateSet[defaultStateName]);
		
		if(stateSetName){
			update(p, this._multiProto);
			if(!p.state){
				p.state={};
				p.stateSet={};
			}
			p.state[stateSetName] = defaultStateName;
			p.stateSet[stateSetName] = stateSet;
		} else {
			update(p, this._singleProto);
			p.state = defaultStateName;
			p.stateSet = stateSet;
		}
	},
	
	gatherProperties : function(stateSet){
		var props = {};
		for(var i in stateSet)
			for(var prop in stateSet[i])
				props[prop] = true;
		
		return keys(props);
	},
	
	K : function(arg){
		return arg; 
	},
	
	_singleProto: {
		changeState : function(stateName){
			update(this, this.stateSet[stateName]);
			this.state = stateName;
			
			if(this.onChangeState)
				this.onChangeState();
		}
	},
	
	_multiProto: {
		changeState : function(stateSetName, stateName){
			update(this, this.stateSet[stateSetName][stateName]);
			
			// 各オブジェクト個別の状態を持つためにクローンを行い変更する
			this.state = update({}, this.state);
			this.state[stateSetName] = stateName;
			
			if(this.onChangeState)
				this.onChangeState();
		}
	}
}

function dynamicBind(func, self){
	return function(){
		return self[func].apply(self, arguments);
	}
}

// ----[Repository]-------------------------------------------------
function Repository(){
	this.register.apply(this, arguments);
}

Repository.prototype = {
	get size(){
		return this.names.length;
	},
	
	get names(){
		return this.values.map(itemgetter('name'));
	},
	
	get values(){
		return map(itemgetter(1), this).filter(function(v){
			return v.name;
		});
	},
	
	clear : function(){
		this.names.forEach(function(name){
			delete this[name];
		}, this);
	},
	
	find : function(name){
		return this.values.filter(function(i){
			return i.name && i.name.search(name) != -1;
		});
	},
	
	copyTo : function(t){
		forEach(this, function(m){
			t[m[0]] = m[1];
		});
		return t;
	},
	
	check : function(){
		var args = arguments;
		return reduce(function(memo, i){
			if(i.check && i.check.apply(i, args))
				memo.push(i);
			return memo;
		}, this.values, []);
	},
	
	/**
	 * 新しい定義を追加する。
	 * 
	 * @param {Array} defs
	 * @param {String} target 追加対象。この名前の前に追加される。
	 */
	register : function(defs, target){
		if(!defs)
			return;
		
		defs = [].concat(defs);
		if(target){
			var vals = this.values;
			this.clear();
			
			for(var i=0 ; i < vals.length ; i++)
				if(vals[i].name == target)
					break;
			
			vals.splice.apply(vals, [i, 0].concat(defs));
			defs = vals;
		}
		
		defs.forEach(function(d){
			this[d.name] = d;
		}, this);
	},
}

// ----[DOM]-------------------------------------------------
'tree treecols treecol treechildren treeitem treerow treecell splitter'.split(' ').forEach(function(tag){
	grobal[tag.toUpperCase()] = bind(E, null, tag);
});

function E(){
	var tag = Array.prototype.shift.call(arguments);
	var elm = currentDocument().createElement(tag);
	
	var text = [];
	function processChild(arr){
		Array.prototype.forEach.call(arr, function(value){
			if(!value)
				return;
			
			if(value && value.nodeType){
				elm.appendChild(value);
				return;
			}
			
			switch (typeof(value)) {
				case 'string':
				case 'number':
					elm.appendChild(currentDocument().createTextNode(value))
					break;
					
				default:
					if(value.forEach){
						processChild(value)
						break;
					}
					
					for(var key in value){
						var attr = value[key];
						switch(key){
						case 'class': elm.className = attr; break;
						case 'style': elm.style.cssText = attr; break;
						default:      elm.setAttribute(key, attr);
						}
					};
					break;
			}
		});
	}
	processChild(arguments);
	
	return elm;
}

function unescapeHTML(s){
	return s.replace(
		/&amp;/g, '&').replace(
		/&quot;/g, '"').replace(
		/&lt;/g, '<').replace(
		/&gt;/g, '>');
}

function clearChildren(p){
	Array.slice(p.childNodes).forEach(p.removeChild, p);
}

function tagName(elm){
	return elm.tagName? elm.tagName.toLowerCase() : '';
}

function $x(exp, context, multi) {
	context = context || currentDocument();
	
	var doc = context.ownerDocument || context;
	var exp = doc.createExpression(exp, {
		lookupNamespaceURI : function(prefix){
			switch (prefix){
			case 'xul':
				return XUL_NS;
			case 'html':
			case 'xhtml':
				return HTML_NS;
			default:
				return '';
			}
		},
	});
	
	var value = function(node){
		if(!node)
			return;
		
		switch (node.nodeType) {
		case Node.ELEMENT_NODE:
			return node;
		case Node.ATTRIBUTE_NODE:
		case Node.TEXT_NODE:
			return node.textContent;
		}
	}
	
	var result = exp.evaluate(context, XPathResult.ANY_TYPE, null);
	switch (result.resultType) {
		case XPathResult.STRING_TYPE : return result.stringValue;
		case XPathResult.NUMBER_TYPE : return result.numberValue;
		case XPathResult.BOOLEAN_TYPE: return result.booleanValue;
		case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
			if(!multi)
				return value(result.iterateNext());
			
			result = exp.evaluate(context, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			var ret = [];
			for (var i = 0, len = result.snapshotLength; i < len ; i++) {
				ret.push(value(result.snapshotItem(i)));
			}
			return ret;
		}
	}
	return null;
}

function convertToDOM(xml){
	var elm = currentDocument().createElementNS(HTML_NS, 'span');
	elm.innerHTML = xml.toXMLString();
	return elm.childNodes[0];
}

function convertToHTMLDocument(html, doc) {
	html = html.replace(/<!DOCTYPE.*?>/, '').replace(/<html.*?>/, '').replace(/<\/html>.*/, '')
	
	doc = doc || currentDocument() || document;
	var xsl = (new DOMParser()).parseFromString(
		'<?xml version="1.0"?>\
			<stylesheet version="1.0" xmlns="http://www.w3.org/1999/XSL/Transform">\
			<output method="html"/>\
		</stylesheet>', 'text/xml');
	
	var xsltp = new XSLTProcessor();
	xsltp.importStylesheet(xsl);
	
	doc = xsltp.transformToDocument(doc.implementation.createDocument('', '', null));
	doc.appendChild(doc.createElement('html'));
	
	var range = doc.createRange();
	range.selectNodeContents(doc.documentElement);
	doc.documentElement.appendChild(range.createContextualFragment(html));
	
	return doc
}

function convertToXML(text){
	return new XML(text.replace(/<\?.*\?>/gm,'').replace(/<!.*?>/gm, '').replace(/xmlns=".*?"/,''));
}

function convertToXULElement(str){
	str = str.toXMLString? str.toXMLString() : str;
	var xul = (
		'<box xmlns="'+XUL_NS+'" >'+
			str + 
		'</box>').replace(/^  +/gm, '').replace(/\n/g, '');
	var parser = new DOMParser();
	var elms = parser.parseFromString(xul, 'text/xml').documentElement.childNodes;
	var result = currentDocument().createDocumentFragment();
	for(var i=0 ; i<elms.length ; i++)
		result.appendChild(elms[i]);
	
	// Firefox 3でstyle属性が適用されないため再設定を行う(暫定パッチ)
	if(parseFloat(AppInfo.version) >= 3){
		for(var style, w = currentDocument().createTreeWalker(result, NodeFilter.SHOW_ELEMENT, null, true) ; e = w.nextNode() ; ){
			if(style = e.getAttribute('style')){
				e.setAttribute('style', '');
				e.setAttribute('style', style);
			}
		}
	}

	return result;
}

function keyString(e){
	// 初回呼び出し時にキーテーブルを作成する
	var table = [];
	for(var name in KeyEvent)
		if(name.indexOf('DOM_VK_')==0)
			table[KeyEvent[name]] = name.substring(7);
	
	return (keyString = function(e){
		var code = e.keyCode;
		var res = [];
		(e.metaKey  || code==KeyEvent.DOM_VK_META)    && res.push('META');
		(e.ctrlKey  || code==KeyEvent.DOM_VK_CONTROL) && res.push('CTRL');
		(e.shiftKey || code==KeyEvent.DOM_VK_SHIFT)   && res.push('SHIFT');
		(e.altKey   || code==KeyEvent.DOM_VK_ALT)     && res.push('ALT');
		
		if((code < KeyEvent.DOM_VK_SHIFT || KeyEvent.DOM_VK_ALT < code) && code != KeyEvent.DOM_VK_META)
			res.push(table[code]);
		
		return res.join(' + ');
	})(e);
}

function cancel(e){
	e.preventDefault();
	e.stopPropagation();
}

function showNotification(fragments, animation){
	var browser = getMostRecentWindow().getBrowser();
	var doc = browser.ownerDocument;
	var box = browser.getNotificationBox(browser.selectedBrowser);
	
	var slideSteps = box.slideSteps;
	if(!animation)
		box.slideSteps = 1;
	
	var notification = this.notification = box.appendNotification('', '', null,	box.PRIORITY_INFO_HIGH, null);
	box.slideSteps = slideSteps;
	
	var outset = doc.getAnonymousNodes(notification)[0];
	outset.setAttribute('align', 'start');
	
	var details = doc.getAnonymousElementByAttribute(notification, 'anonid', 'details');
	clearChildren(details);
	
	notification.appendChild(fragments);
	
	if(!animation){
		notification.__close = notification.close;
		notification.close = function(){
			box.slideSteps = 1;
			notification.__close();
			box.slideSteps = slideSteps;
		}
	}
	
	return notification;
}

function capture(win, pos, dim, scale){
	// デフォルトではAppShellService.hiddenDOMWindowが使われる
	var canvas = document.createElementNS(HTML_NS, 'canvas');
	var ctx = canvas.getContext('2d');
	canvas.width = dim.w;
	canvas.height = dim.h;
	
	if(scale){
		scale	= scale.w? scale.w/dim.w : 
			scale.h? scale.h/dim.h : scale;
		
		canvas.width = dim.w * scale;
		canvas.height = dim.h * scale;
		ctx.scale(scale, scale);
	}
	
	ctx.drawWindow(win, pos.x, pos.y, dim.w, dim.h, '#FFF');
	
	return canvas.toDataURL('image/png', '');
}

function convertToDataURL(src){
	return loadImage(src).addCallback(function(img){
		var canvas = document.createElementNS(HTML_NS, 'canvas');
		var ctx = canvas.getContext('2d');
		
		canvas.width = img.width;
		canvas.height = img.height;
		
		ctx.drawImage(img, 0, 0);
		
		return canvas.toDataURL('image/png', '');
	});
}

function toGrayScale(src){
	return loadImage(src).addCallback(function(img){
		var canvas = document.createElementNS(HTML_NS, 'canvas');
		var ctx = canvas.getContext('2d');

		canvas.width = img.width;
		canvas.height = img.height;
		
		ctx.drawImage(img, 0, 0);

		var image = ctx.getImageData(0, 0, img.width, img.height);
		for(var i=0, d=image.data, len=d.length ; i<len ; i+=4)
			d[i] = d[i+1] = d[i+2] = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
		
		ctx.putImageData(image, 0, 0);
		
		return canvas.toDataURL();
	});
}

function loadImage(src){
	var d = new Deferred();
	
	if(src instanceof Ci.nsIDOMHTMLImageElement){
		var img = src;
	} else {
		var img = document.createElementNS(HTML_NS, 'img');
		img.src = src;
	}
	
	img.onload = function(){
		d.callback(img);
	};
	
	img.onerror = function(){
		d.errback(img);
	};
	
	return d;
}


// ----[UI]-------------------------------------------------
var AbstractTreeView = createMock('@mozilla.org/xul/xul-tree-builder;1');

/**
 * マウスショートカットを監視する。
 * マウスダウンにより1セッションがはじまり、全てのボタンのマウスアップで終わる。
 * 2重実行を防ぐため、そのセッションで一度でも処理が行われると以降は実行されない。
 *
 * @param {Element} target 監視対象のエレメント
 * @param {Function} check イベント処理関数(未処理の場合はtrueを返す)
 */
function observeMouseShortcut(target, check){
	var BUTTONS = ['LEFT_DOWN', 'CENTER_DOWN', 'RIGHT_DOWN'];
	var downed = {};
	var event;
	var executed = false;
	target.addEventListener('mousedown', function(e){
		if(isEmpty(downed)){
			target.addEventListener('keydown', onKeyDown, true);
			target.addEventListener('keypress', cancelEvent, true);
			executed = false;
			
			// Firefox 2において後でclientXなどが取得できなくなるためクローンする
			event = update({}, e);
		}
		
		downed[BUTTONS[e.button]] = true;
		
		checkKey(e, [keyString(e), keys(downed)])
	}, true);
	
	target.addEventListener('mouseup', function(e){
		delete downed[BUTTONS[e.button]];
		if(isEmpty(downed)){
			target.removeEventListener('keydown', onKeyDown, true);
			target.removeEventListener('keypress', cancelEvent, true);
			event = null;
		}
	}, true);

	target.addEventListener('contextmenu', cancelEvent, true);
	target.addEventListener('click', cancelEvent, true);
	
	function cancelEvent(e){
		// クリックによる遷移やコンテキストメニュー、ショートカットキーなどを抑制する
		if(executed)
			cancel(e)
	}
	
	function onKeyDown(e){
		var code = e.keyCode;
		if(KeyEvent.DOM_VK_SHIFT <= code && code <= KeyEvent.DOM_VK_ALT)
			return;
		
		if(executed){
			cancel(e)
			return;
		}
		
		if(checkKey(e, [keys(downed), keyString(e)]))
			cancel(e);
	}
	
	function checkKey(e, keys){
		var hit = !check(event, joinText(keys, (' + ')));
		if(hit)
			executed = true;
		
		return hit;
	}
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
	
	var win = doc.defaultView;
	
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
		win.addEventListener('keydown', onKeyDown, true);
		win.addEventListener('keyup', onKeyUp, true);
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
		cancel(e);
		
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

	function onClick(e){
		// リンククリックによる遷移を抑止する
		cancel(e);
		
		// mouseupよりも後にイベントが発生するため、ここで取り除く
		doc.removeEventListener('click', onClick, true);
	}
	
	function finalize(){
		doc.removeEventListener('mousedown', onMouseDown, true);
		doc.removeEventListener('mousemove', onMouseMove, true);
		doc.removeEventListener('mouseup', onMouseUp, true);
		win.removeEventListener('keydown', onKeyDown, true);
		win.removeEventListener('keyup', onKeyUp, true);
		
		doc.documentElement.style.cursor = '';
		
		removeElement(region);
		removeElement(style);
	}
	
	doc.addEventListener('mousedown', onMouseDown, true);
	doc.addEventListener('click', onClick, true);
	doc.defaultView.focus();
	
	return deferred;
}

function flashView(doc){
	var d = new Deferred();
	var doc = doc || currentDocument();
	var flash = doc.createElement('div');
	flash.setAttribute('style', <>
		background : #EEE;
		position   : fixed;
		z-index    : 999999999;
		top        : 0;
		left       : 0;
	</>);
	setElementDimensions(flash, getViewDimensions());
	doc.body.appendChild(flash);
	fade(flash, {
		duration : 0.1,
		afterFinish : function(){
			removeElement(flash);
			d.callback();
		},
	});
	
	return d;
}

// ----[Model/Service]-------------------------------------------------
AbstractSessionService = {
	updateSession : function(){
		var cookie = this.getAuthCookie();
		if(cookie && this.cookie==cookie)
			return 'same';
		
		delete this.cookie;
		delete this.user;
		delete this.token;
		delete this.password;
		
		if(!cookie)
			return 'none';
		
		this.cookie = cookie;
		
		return 'changed';
	},
	
	getSessionValue : function(key, func){
		var self = this;
		switch (this.updateSession()){
		case 'none':
			return fail(new Error(getMessage('error.notLoggedin')));
			
		case 'same':
			if(self[key])
				return succeed(self[key]);
			
		case 'changed':
			return func().addCallback(function(value){
				return self[key] = value;
			});
		}
	},
}
