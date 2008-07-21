connect(grobal, 'browser-load', function(e){
	var doc = e.target;
	var content = doc.getElementById('content');
	content.addEventListener('DOMMouseScroll', function(e){
		var t = e.target;
		
		// ページ余白か?
		if(t == doc.documentElement)
			t = doc.body;
		
		// 縦スクロールがあるか、または、横スクロールしないか
		if(t.clientHeight < t.scrollHeight || t.clientWidth >= t.scrollWidth)
			return;
		
		t.scrollLeft += e.detail * 150;
	}, true);
});
