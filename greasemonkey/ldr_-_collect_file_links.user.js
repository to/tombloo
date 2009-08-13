// ==UserScript==
// @name           LDR - Collect File Links
// @namespace      http://github.com/to
// @include        http://reader.livedoor.com/reader/
// ==/UserScript==

window.addEventListener('load', function() {
	var w = unsafeWindow;
	var RE = /((anonym\.to|share|mediafire|send|upload|rapidspread|link-protector)|(zip|mp3)$)/;
	
	w.Keybind.add('ctrl+C', function(){
		var hash = {};
		var urls = [];
		w.get_active_feed().items.forEach(function(i){
			(i.body.match(/(https?:\/\/[^" <]+)/g) || []).forEach(function(l){
				if(RE.test(l))
					hash[l] = true;
			});
		});
		
		for(var url in hash)
			urls.push(url);
		
		GM_Tombloo.notify('Collect File Links', 'Links: ' + urls.length);
		GM_Tombloo.copyString(urls.join('\n'));
	});
}, false);
