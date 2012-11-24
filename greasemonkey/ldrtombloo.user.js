// ==UserScript==
// @name       LDR + Tombloo
// @namespace  https://github.com/to/tombloo
// @updateURL  https://raw.github.com/to/tombloo/master/greasemonkey/ldrtombloo.user.js
// @version    1.0
// @include    http://reader.livedoor.com/reader/*
// ==/UserScript==


GM_addStyle("\
	.TMBL_photo .item_title:before{\
		content: url('data:image/png,%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%00%10%00%00%00%10%08%06%00%00%00%1F%F3%FFa%00%00%00%04gAMA%00%00%AF%C87%05%8A%E9%00%00%00%19tEXtSoftware%00Adobe%20ImageReadyq%C9e%3C%00%00%01%EFIDATx%DAb%FA%FF%FF%3F%03%25%18%20%80X%18%80%60%CE%9C9%BD%FF%FE%FD%8B%FE%FE%FD%3B%C7%9F%3F%7F%18%D0%01P%0EL311%81%D9%AC%AC%AC%0Clll%F3%B3%B2%B2%0A%01%02%88%05%AA%20%C6%C7%C7G%94%87%87%87%11%08%C0%8AA%A6%83%D80%1A%26%06%B2%00%84W%ADZ%95%00%14*%04%08%20%B0%01%40%9B%D9%B9%B8%B8%18%81%82p%05RRR%20%5B%C06~%F8%F0%81%E1%FA%F5%EB%60%3E%C8%15%B9%B9%B9%0C%7F%FF%FE%05%9B%0A%10%40L%20%02%A4%01%24%01%B3ERR%12%AC%F8%EB%D7%AF%0C_%BE%7C%01%B3%E5%E5%E5A%16%81%D5%81%D4%C3%5C%05%10%40L%C8~eaa%01%99%0C%D6%F0%F9%F3g%86%9F%3F%7F%825%81%0C%E1%E0%E0%00%B3Aj%90%01%40%00%B1%20%07%14%C8T%90%01%BF%7F%FFf%F8%F5%EB%17%18%83%F8%20%0C%B2%15%A4%06%E4%02X%0C%80%00%40%00%81%5D%80%1CX%CC%CC%CC%60%DBa%86%81%0C%01%B1Ab%9C%9C%9C%60%17%C0b%05%04%00%02%88%05%E6oX4%B1%B3%B33%3C%7F%FE%1CL%834%80%A2%EC%FD%FB%F7%0C%2F_%BEd%10%11%11%01%AB%81%85%17%08%00%04%10%DC%0B%20C%40%B6%834%09%08%080%9C%3Au%8A%01%18%AD%60%DB%40a%A1%A2%A2%02%E6%83%5C%85%EC%02%80%00B1%E0%CE%9D%3B%60I%10%06%19%06%D2%04%12%7F%FC%F81%C3%8B%17%2F%C0ld%CD%20%00%10%40%2C%C8)%CD%C5%C5%05%EE%3CP%88%7F%FB%F6%0D%AC1((%08l%20%B2e0%00%10%40%2C0%BF%23%D3%20%03A%5E%01aaaa%8C%24%0D%0Bt%10%00%08%20%B0%01%C0%80%FA%08%F4%1B%BF%9A%9A%1A%3C%81%A0%DB%84%0C%40%D1%0C%D4%03%96%04%08%20%98%01%2B%D7%ACYc%09%8Ck%5Dd%3F%22G%2F%8A%B3%81Q%09%F4%D2B%10%1B%20%80%18q%D9B%2C%00%080%00%5D%188%F5%B4%20%EF%CD%00%00%00%00IEND%AEB%60%82');\
	}\
	\
	.TMBL_posted,\
	.TMBL_posted a{\
		color : silver !important;\
	}\
	.TMBL_posted .item_body a{\
		color : dimgray !important;\
	}\
	.TMBL_posted img{\
		opacity: 0.5;\
	}\
");


var FEED_TYPE_DEFS = {
	photo : [
			'flickr.com/', 
			'http://ffffound.com', 
			'http://www.bighappyfunhouse.com',
			'http://f.hatena.ne.jp',
	],
	quote : [],
};


var win = unsafeWindow;
var doc = win.document;

window.addEventListener('load', function(){
	win.Keybind.add('T', share);
}, true);

with(win){
	ItemFormatter.TMPL.tmpl = ItemFormatter.TMPL.tmpl.replace(/(\[\[pinned\]\])/, '$1 [[TMBL_type]]')
	
	register_hook('BEFORE_PRINTFEED', function(feed) {
		var type = checkType(feed);
		if(!type)
			return;
		
		var cls = 'TMBL_' + type;
		feed.items.forEach(function(item){
			item.TMBL_type = cls;
		});
	});
}

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
			event     : {},
			title     : null,
			mouse     : null,
			menu      : null,
	}, win.location);
	
	if(checkType(feed, 'photo')){
		ctx.onImage = true;
		ctx.target = $x('.//img[1]', body);
	}
	
	var ext = tombloo.check(ctx)[0];
	tombloo.share(ctx, ext, ext.name.match(/^Link /));
	
	win.addClass(parent, 'TMBL_posted');
}


function checkType(feed, type){
	var link = feed.channel.link;
	if(type){
		if(FEED_TYPE_DEFS[type].some(function(def){return link.indexOf(def) != -1}))
			return type;
	} else {
		for(type in FEED_TYPE_DEFS)
			if(checkType(feed, type))
				return type;
	}
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
