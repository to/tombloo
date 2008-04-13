// ==UserScript==
// @name       LDR + Tombloo
// @namespace  http://userscripts.org/users/7010
// @updateURL  http://userscripts.org/scripts/source/23537.user.js
// @include    http://reader.livedoor.com/reader/*
// @include    http://fastladder.com/reader/* 
// ==/UserScript==


GM_addStyle(<><![CDATA[
	.TMBL_posted,
	.TMBL_posted a{
		color : silver !important;
	}
	.TMBL_posted .item_body a{
		color : dimgray !important;
	}
	.TMBL_posted img{
		-moz-opacity: 0.5;
	}
]]></>);


var win = unsafeWindow;
var doc = win.document;

window.addEventListener('load', function(){
	win.Keybind.add('T', share);
}, true);

function share(event){
	var tombloo = GM_Tombloo.Tombloo.Service;
	var feed = win.get_active_feed();
	var item = win.get_active_item(true);
	var target = item.element;
	var parent = $x('ancestor::div[starts-with(@id, "item_count")]/parent::div', target);
	var body = $x('.//div[@class="item_body"]', parent);
	
	var ctx = update({
			document  : doc,
			window    : win,
			selection : '' + win.getSelection(),
			target    : target,
			event     : event,
			title     : null,
			mouse     : null,
			menu      : null,
	}, win.location);
	
	// FFFFOUND / Flickr / iza newsphoto
	if([
		'^http://ffffound\\.com/', 
		'flickr\\.com/photos/', 
		'http://www.bighappyfunhouse.com/',
		'http://f.hatena.ne.jp/',
		'http://pipes.yahoo.com/pipes/pipe.info\\?_id=1eb46a2f1f83c340eee10cd49c144625'].some(function(re){
			return feed.channel.link.match(re);
		})){
		
		ctx.onImage = true;
		ctx.target = $x('.//img[1]', body);
	}
	
	tombloo.share(ctx, tombloo.check(ctx)[0]);
	
	win.addClass(parent, 'TMBL_posted');
}

// ---- [Utility] ----------------------------------------------------
function update(t, s){
	for(var p in s)
		t[p] = s[p];
	return t;
}

function $x(exp, context){
	context = context || document;
	return document.evaluate(exp, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
